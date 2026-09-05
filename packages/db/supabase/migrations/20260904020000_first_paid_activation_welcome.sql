-- Persist the restaurant-lifetime first paid activation and enrich the
-- existing invoice.paid outbox event without changing the payment transition.

begin;

create table public.restaurant_first_paid_activations (
  restaurant_id uuid primary key
    references public.restaurants(id) on delete restrict,
  subscription_invoice_id uuid not null,
  activated_at timestamptz not null,
  recorded_at timestamptz not null default clock_timestamp(),
  foreign key (restaurant_id, subscription_invoice_id)
    references public.subscription_invoices(restaurant_id, id) on delete restrict
);

alter table public.restaurant_first_paid_activations enable row level security;
alter table public.restaurant_first_paid_activations force row level security;
revoke all on public.restaurant_first_paid_activations from public, anon, authenticated;
grant select on public.restaurant_first_paid_activations to service_role;

-- Existing paid tenants have already received their first activation. Backfill
-- the earliest authoritative payment so a renewal cannot become a welcome.
insert into public.restaurant_first_paid_activations (
  restaurant_id, subscription_invoice_id, activated_at
)
select distinct on (invoice.restaurant_id)
  invoice.restaurant_id,
  invoice.id,
  invoice.paid_at
from public.subscription_invoices invoice
where invoice.status = 'paid'
  and invoice.paid_at is not null
  and invoice.amount_paid_minor = invoice.amount_due_minor
order by invoice.restaurant_id, invoice.paid_at, invoice.created_at, invoice.id;

create function public.enrich_invoice_paid_outbox_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.subscription_invoices%rowtype;
  v_first_invoice_id uuid;
  v_onboarding_complete boolean := false;
begin
  if new.event_type <> 'invoice.paid' then
    return new;
  end if;

  if new.aggregate_type <> 'billing_invoice' then
    raise exception 'invoice_paid_outbox_aggregate_invalid' using errcode = 'P0001';
  end if;

  select * into v_invoice
  from public.subscription_invoices invoice
  where invoice.id = new.aggregate_id
    and invoice.restaurant_id = new.restaurant_id;

  if not found
    or v_invoice.status <> 'paid'
    or v_invoice.paid_at is null
    or v_invoice.amount_paid_minor <> v_invoice.amount_due_minor then
    raise exception 'invoice_paid_outbox_invoice_invalid' using errcode = 'P0001';
  end if;

  insert into public.restaurant_first_paid_activations (
    restaurant_id, subscription_invoice_id, activated_at
  ) values (
    v_invoice.restaurant_id, v_invoice.id, v_invoice.paid_at
  ) on conflict (restaurant_id) do nothing;

  select activation.subscription_invoice_id into v_first_invoice_id
  from public.restaurant_first_paid_activations activation
  where activation.restaurant_id = v_invoice.restaurant_id;

  select state.status = 'completed' into v_onboarding_complete
  from public.restaurant_onboarding_states state
  where state.restaurant_id = v_invoice.restaurant_id;

  new.payload := coalesce(new.payload, '{}'::jsonb) || jsonb_build_object(
    'firstPaidActivation', v_first_invoice_id = v_invoice.id,
    'plan', v_invoice.plan,
    'billingInterval', v_invoice.billing_interval,
    'addOns', v_invoice.add_ons,
    'onboardingComplete', coalesce(v_onboarding_complete, false),
    'semanticVersion', 2
  );

  return new;
end;
$$;

create trigger domain_outbox_enrich_invoice_paid
  before insert on public.domain_outbox
  for each row execute function public.enrich_invoice_paid_outbox_event();

revoke all on function public.enrich_invoice_paid_outbox_event()
  from public, anon, authenticated;

comment on table public.restaurant_first_paid_activations is
  'One immutable restaurant-lifetime first paid subscription activation, used to prevent welcome e-mails on renewals or re-entry.';
comment on function public.enrich_invoice_paid_outbox_event() is
  'Atomically enriches invoice.paid with first-activation, commercial and onboarding context while preserving the existing outbox identity.';

commit;
