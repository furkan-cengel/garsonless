-- SaaS billing foundation (ADR-0002/0003).
-- This is deliberately separate from restaurant customer order payments.
-- Every table is service-role only; dashboard projections will be exposed by
-- owner-gated application queries in a later slice. No existing tenant is
-- backfilled or moved to a different plan by this migration.

create table public.billing_platform_policies (
  id text primary key default 'default' check (id = 'default'),
  trial_days integer not null check (trial_days > 0),
  pre_due_reminder_days integer not null check (pre_due_reminder_days > 0),
  retry_after_days integer not null check (retry_after_days > 0),
  second_warning_after_days integer not null check (second_warning_after_days > retry_after_days),
  final_warning_after_days integer not null check (final_warning_after_days > second_warning_after_days),
  suspend_after_days integer not null check (suspend_after_days > final_warning_after_days),
  cancelled_retention_days integer not null check (cancelled_retention_days > 0),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.billing_platform_policies (
  id, trial_days, pre_due_reminder_days, retry_after_days,
  second_warning_after_days, final_warning_after_days,
  suspend_after_days, cancelled_retention_days
) values ('default', 14, 3, 1, 3, 7, 14, 90);

create table public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null unique references public.restaurants(id) on delete restrict,
  provider text not null default 'iyzico' check (provider = 'iyzico'),
  provider_customer_ref text,
  legal_name text not null check (char_length(btrim(legal_name)) between 1 and 200),
  contact_email text not null check (char_length(btrim(contact_email)) between 3 and 320),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id),
  unique (provider, provider_customer_ref)
);

create table public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  billing_customer_id uuid not null,
  provider text not null default 'iyzico' check (provider = 'iyzico'),
  provider_subscription_ref text,
  plan text not null check (plan in ('free', 'starter', 'pro', 'enterprise')),
  scheduled_plan text check (scheduled_plan is null or scheduled_plan in ('free', 'starter', 'pro', 'enterprise')),
  status text not null check (status in (
    'trial', 'active', 'past_due', 'grace_period', 'suspended', 'cancelled', 'manual_hold'
  )),
  billing_anchor_day smallint not null default 1 check (billing_anchor_day between 1 and 28),
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  grace_ends_at timestamptz,
  suspended_at timestamptz,
  cancelled_at timestamptz,
  cancel_at_period_end boolean not null default false,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id),
  unique (provider, provider_subscription_ref),
  foreign key (restaurant_id, billing_customer_id)
    references public.billing_customers(restaurant_id, id) on delete restrict,
  check (
    (current_period_start is null and current_period_end is null)
    or (current_period_start is not null and current_period_end > current_period_start)
  )
);

create unique index billing_subscriptions_one_live_per_restaurant_idx
  on public.billing_subscriptions(restaurant_id)
  where status <> 'cancelled';
create index billing_subscriptions_status_idx
  on public.billing_subscriptions(status, current_period_end);

create table public.subscription_invoices (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  subscription_id uuid not null,
  provider text not null default 'iyzico' check (provider = 'iyzico'),
  provider_invoice_ref text,
  idempotency_key text not null unique check (char_length(btrim(idempotency_key)) between 1 and 200),
  plan text not null check (plan in ('starter', 'pro', 'enterprise')),
  currency text not null default 'TRY' check (currency = 'TRY'),
  amount_due_minor bigint not null check (amount_due_minor >= 0),
  amount_paid_minor bigint not null default 0 check (amount_paid_minor >= 0 and amount_paid_minor <= amount_due_minor),
  status text not null default 'draft' check (status in ('draft', 'open', 'paid', 'past_due', 'void', 'uncollectible')),
  period_start timestamptz not null,
  period_end timestamptz not null check (period_end > period_start),
  due_at timestamptz not null,
  finalized_at timestamptz,
  paid_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id),
  unique (restaurant_id, subscription_id, id),
  unique (provider, provider_invoice_ref),
  foreign key (restaurant_id, subscription_id)
    references public.billing_subscriptions(restaurant_id, id) on delete restrict,
  unique (subscription_id, period_start, period_end),
  check (status <> 'paid' or (paid_at is not null and amount_paid_minor = amount_due_minor))
);

create index subscription_invoices_due_idx
  on public.subscription_invoices(status, due_at)
  where status in ('open', 'past_due');
create index subscription_invoices_restaurant_idx
  on public.subscription_invoices(restaurant_id, period_start desc);

create table public.subscription_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  invoice_id uuid not null,
  provider text not null default 'iyzico' check (provider = 'iyzico'),
  provider_attempt_ref text,
  idempotency_key text not null unique check (char_length(btrim(idempotency_key)) between 1 and 200),
  attempt_number integer not null check (attempt_number > 0),
  currency text not null default 'TRY' check (currency = 'TRY'),
  amount_minor bigint not null check (amount_minor >= 0),
  status text not null default 'pending' check (status in ('pending', 'requires_action', 'succeeded', 'failed', 'cancelled')),
  failure_code text,
  failure_message text check (failure_message is null or char_length(failure_message) <= 500),
  attempted_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_attempt_ref),
  unique (invoice_id, attempt_number),
  foreign key (restaurant_id, invoice_id)
    references public.subscription_invoices(restaurant_id, id) on delete restrict
);

create index subscription_payment_attempts_invoice_idx
  on public.subscription_payment_attempts(invoice_id, attempt_number desc);

create table public.billing_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'iyzico' check (provider = 'iyzico'),
  provider_event_id text not null,
  event_type text not null check (event_type in (
    'checkout.completed', 'invoice.payment_succeeded', 'invoice.payment_failed',
    'subscription.cancelled', 'subscription.updated', 'unknown'
  )),
  restaurant_id uuid references public.restaurants(id) on delete restrict,
  subscription_id uuid references public.billing_subscriptions(id) on delete restrict,
  payload_sanitized jsonb not null default '{}'::jsonb,
  payload_hash text not null check (char_length(btrim(payload_hash)) between 1 and 200),
  status text not null default 'received' check (status in ('received', 'processing', 'processed', 'failed', 'dead_lettered')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  processed_at timestamptz,
  last_error text check (last_error is null or char_length(last_error) <= 1000),
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_event_id),
  foreign key (restaurant_id, subscription_id)
    references public.billing_subscriptions(restaurant_id, id) on delete restrict,
  check (subscription_id is null or restaurant_id is not null),
  check (jsonb_typeof(payload_sanitized) = 'object'),
  check (pg_column_size(payload_sanitized) <= 65536)
);

create index billing_provider_events_ready_idx
  on public.billing_provider_events(available_at, received_at)
  where status in ('received', 'failed');
create index billing_provider_events_restaurant_idx
  on public.billing_provider_events(restaurant_id, received_at desc);

create table public.billing_reconciliation_jobs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants(id) on delete restrict,
  subscription_id uuid references public.billing_subscriptions(id) on delete restrict,
  provider text not null default 'iyzico' check (provider = 'iyzico'),
  scope text not null check (scope in ('subscription', 'invoice', 'provider_event', 'tenant')),
  dedupe_key text not null unique check (char_length(btrim(dedupe_key)) between 1 and 200),
  status text not null default 'pending' check (status in ('pending', 'running', 'resolved', 'discrepancy', 'failed')),
  scheduled_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  local_snapshot jsonb not null default '{}'::jsonb,
  provider_snapshot_sanitized jsonb not null default '{}'::jsonb,
  discrepancy_code text,
  attempts integer not null default 0 check (attempts >= 0),
  locked_at timestamptz,
  locked_by text,
  last_error text check (last_error is null or char_length(last_error) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (restaurant_id, subscription_id)
    references public.billing_subscriptions(restaurant_id, id) on delete restrict,
  check (subscription_id is null or restaurant_id is not null),
  check (jsonb_typeof(local_snapshot) = 'object'),
  check (jsonb_typeof(provider_snapshot_sanitized) = 'object'),
  check (pg_column_size(local_snapshot) <= 65536),
  check (pg_column_size(provider_snapshot_sanitized) <= 65536)
);

create index billing_reconciliation_jobs_ready_idx
  on public.billing_reconciliation_jobs(scheduled_at, created_at)
  where status in ('pending', 'failed');

create table public.dunning_runs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  subscription_id uuid not null,
  invoice_id uuid not null unique,
  policy_id text not null default 'default' references public.billing_platform_policies(id) on delete restrict,
  policy_snapshot jsonb not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'running', 'completed', 'stopped', 'failed')),
  current_step text not null default 'due' check (current_step in ('pre_due', 'due', 'retry', 'warning_3', 'warning_7', 'suspend')),
  next_action_at timestamptz,
  last_action_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text check (last_error is null or char_length(last_error) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (restaurant_id, subscription_id, invoice_id)
    references public.subscription_invoices(restaurant_id, subscription_id, id) on delete restrict
);

create index dunning_runs_ready_idx
  on public.dunning_runs(next_action_at, created_at)
  where status in ('scheduled', 'failed');

create table public.tenant_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  subscription_id uuid,
  from_status text check (from_status is null or from_status in (
    'trial', 'active', 'past_due', 'grace_period', 'suspended', 'cancelled', 'manual_hold'
  )),
  to_status text not null check (to_status in (
    'trial', 'active', 'past_due', 'grace_period', 'suspended', 'cancelled', 'manual_hold'
  )),
  actor_type text not null check (actor_type in ('system', 'payment_provider', 'platform_admin', 'tenant_owner')),
  actor_user_id uuid references auth.users(id) on delete set null,
  reason_code text not null check (char_length(btrim(reason_code)) between 1 and 100),
  reason_detail text check (reason_detail is null or char_length(reason_detail) <= 500),
  request_id text not null unique check (char_length(btrim(request_id)) between 1 and 200),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (restaurant_id, subscription_id)
    references public.billing_subscriptions(restaurant_id, id) on delete restrict,
  check (subscription_id is null or restaurant_id is not null),
  check (jsonb_typeof(metadata) = 'object'),
  check (pg_column_size(metadata) <= 65536)
);

create index tenant_lifecycle_events_restaurant_idx
  on public.tenant_lifecycle_events(restaurant_id, occurred_at desc);

create trigger billing_platform_policies_updated_at
  before update on public.billing_platform_policies
  for each row execute function public.update_updated_at();
create trigger billing_customers_updated_at
  before update on public.billing_customers
  for each row execute function public.update_updated_at();
create trigger billing_subscriptions_updated_at
  before update on public.billing_subscriptions
  for each row execute function public.update_updated_at();
create trigger subscription_invoices_updated_at
  before update on public.subscription_invoices
  for each row execute function public.update_updated_at();
create trigger subscription_payment_attempts_updated_at
  before update on public.subscription_payment_attempts
  for each row execute function public.update_updated_at();
create trigger billing_provider_events_updated_at
  before update on public.billing_provider_events
  for each row execute function public.update_updated_at();
create trigger billing_reconciliation_jobs_updated_at
  before update on public.billing_reconciliation_jobs
  for each row execute function public.update_updated_at();
create trigger dunning_runs_updated_at
  before update on public.dunning_runs
  for each row execute function public.update_updated_at();

alter table public.billing_platform_policies enable row level security;
alter table public.billing_customers enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.subscription_invoices enable row level security;
alter table public.subscription_payment_attempts enable row level security;
alter table public.billing_provider_events enable row level security;
alter table public.billing_reconciliation_jobs enable row level security;
alter table public.dunning_runs enable row level security;
alter table public.tenant_lifecycle_events enable row level security;

revoke all on public.billing_platform_policies from public, anon, authenticated;
revoke all on public.billing_customers from public, anon, authenticated;
revoke all on public.billing_subscriptions from public, anon, authenticated;
revoke all on public.subscription_invoices from public, anon, authenticated;
revoke all on public.subscription_payment_attempts from public, anon, authenticated;
revoke all on public.billing_provider_events from public, anon, authenticated;
revoke all on public.billing_reconciliation_jobs from public, anon, authenticated;
revoke all on public.dunning_runs from public, anon, authenticated;
revoke all on public.tenant_lifecycle_events from public, anon, authenticated;

grant select, insert, update, delete on public.billing_platform_policies to service_role;
grant select, insert, update, delete on public.billing_customers to service_role;
grant select, insert, update, delete on public.billing_subscriptions to service_role;
grant select, insert, update, delete on public.subscription_invoices to service_role;
grant select, insert, update, delete on public.subscription_payment_attempts to service_role;
grant select, insert, update, delete on public.billing_provider_events to service_role;
grant select, insert, update, delete on public.billing_reconciliation_jobs to service_role;
grant select, insert, update, delete on public.dunning_runs to service_role;
grant select, insert on public.tenant_lifecycle_events to service_role;

comment on table public.billing_customers is 'Service-role-only SaaS billing identity; never tenant order-payment credentials.';
comment on table public.billing_provider_events is 'Idempotent provider event inbox containing only redacted/allowlisted diagnostics.';
comment on column public.billing_reconciliation_jobs.provider_snapshot_sanitized is 'Allowlisted/redacted provider projection; raw provider payloads are forbidden.';
comment on table public.tenant_lifecycle_events is 'Immutable actor/reason/request audit trail for subscription lifecycle transitions.';

-- Reserve typed billing events in the shared transactional outbox. No trigger
-- emits them in this foundation slice; Faz 5.2 atomic billing RPCs will do so.
alter table public.domain_outbox drop constraint if exists domain_outbox_aggregate_type_check;
alter table public.domain_outbox add constraint domain_outbox_aggregate_type_check
  check (aggregate_type in (
    'order', 'table_session', 'service_request', 'customer', 'campaign',
    'billing_subscription', 'billing_invoice'
  ));

alter table public.domain_outbox drop constraint if exists domain_outbox_event_type_check;
alter table public.domain_outbox add constraint domain_outbox_event_type_check
  check (event_type in (
    'order.created',
    'order.status_changed',
    'order.settled',
    'table_session.closed',
    'service_request.created',
    'customer.welcome_bonus_requested',
    'campaign.delivery_requested',
    'subscription.trial_started',
    'subscription.status_changed',
    'invoice.created',
    'invoice.payment_failed',
    'invoice.paid',
    'tenant.suspended',
    'tenant.reactivated'
  ));
