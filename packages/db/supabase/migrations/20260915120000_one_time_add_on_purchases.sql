begin;

create table public.add_on_price_versions (
  add_on text not null check (add_on in ('storefront_video_hero','iyzico_online_payments')),
  version integer not null check (version > 0),
  net_amount_minor bigint not null check (net_amount_minor between 1 and 100000000),
  vat_rate integer not null check (vat_rate between 0 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  actor_user_id uuid references auth.users(id),
  primary key (add_on, version)
);
insert into public.add_on_price_versions(add_on,version,net_amount_minor,vat_rate) values
 ('storefront_video_hero',1,39000,20),('iyzico_online_payments',1,300000,20);

create table public.add_on_purchases (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id),
  add_on text not null,
  price_version integer not null,
  request_id uuid not null unique,
  status text not null default 'initializing' check (status in ('initializing','pending','review','paid','failed','refunded','chargeback')),
  net_amount_minor bigint not null check(net_amount_minor > 0),
  vat_rate integer not null check(vat_rate between 0 and 100),
  total_amount_minor bigint not null check(total_amount_minor > 0),
  currency text not null default 'TRY' check(currency = 'TRY'),
  profile jsonb not null,
  return_context jsonb,
  provider_token text unique,
  payment_page_url text,
  provider_payment_id text unique,
  refunded_amount_minor bigint not null default 0 check(refunded_amount_minor >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  last_checked_at timestamptz,
  foreign key(add_on,price_version) references public.add_on_price_versions(add_on,version),
  unique(restaurant_id,id)
);
create unique index add_on_one_open_purchase on public.add_on_purchases(restaurant_id,add_on)
 where status in ('initializing','pending','review','paid');
create table public.restaurant_add_on_ownership (
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  add_on text not null check(add_on in ('storefront_video_hero','iyzico_online_payments')),
  purchase_id uuid references public.add_on_purchases(id),
  legacy_invoice_id uuid references public.subscription_invoices(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key(restaurant_id,add_on),
  check(num_nonnulls(purchase_id,legacy_invoice_id) = 1)
);
create table public.add_on_transition_log (
  subscription_id uuid primary key references public.billing_subscriptions(id),
  status text not null check(status in ('pending','confirmed','failed','cancelled')),
  target_plan_ref text,
  error_code text,
  updated_at timestamptz not null default now()
);

do $$ declare t text; begin
 foreach t in array array['add_on_price_versions','add_on_purchases','restaurant_add_on_ownership','add_on_transition_log'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on table public.%I from public, anon, authenticated',t);
  execute format('grant select, insert, update on table public.%I to service_role',t);
 end loop;
end $$;

create function public.add_on_purchase_json(p public.add_on_purchases) returns jsonb
language sql stable set search_path = public, pg_temp as $$
 select jsonb_build_object('id',p.id,'restaurantId',p.restaurant_id,'addOn',p.add_on,'status',p.status,
 'netAmountMinor',p.net_amount_minor,'totalAmountMinor',p.total_amount_minor,'vatRate',p.vat_rate,'currency',p.currency,
 'token',p.provider_token,'paymentPageUrl',p.payment_page_url,'returnContext',p.return_context,'profile',p.profile);
$$;

create function public.prepare_add_on_purchase(p_restaurant_id uuid,p_user_id uuid,p_add_on text,p_price_version integer,p_request_id uuid,p_return_context jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.restaurants%rowtype; c public.billing_customers%rowtype; v public.add_on_price_versions%rowtype; p public.add_on_purchases%rowtype; ctx jsonb;
begin
 select * into r from public.restaurants where id=p_restaurant_id and owner_id=p_user_id and deleted_at is null for update;
 if not found then raise exception 'add_on_owner_required'; end if;
 if p_add_on not in ('storefront_video_hero','iyzico_online_payments') or p_request_id is null then raise exception 'add_on_invalid'; end if;
 if p_return_context is not null and (p_add_on <> 'storefront_video_hero' or jsonb_typeof(p_return_context) <> 'object'
   or p_return_context->>'sectionId' is distinct from 'storefront-video-hero'
   or coalesce(p_return_context->>'templateId','') !~ '^[a-zA-Z0-9_-]{1,100}$') then raise exception 'add_on_return_invalid'; end if;
 select * into p from public.add_on_purchases where request_id=p_request_id;
 if found then
  if p.restaurant_id <> p_restaurant_id or p.add_on <> p_add_on or p.price_version <> p_price_version or p.return_context is distinct from p_return_context then raise exception 'add_on_request_conflict'; end if;
  return jsonb_build_object('purchase',public.add_on_purchase_json(p),'dispatchable',false);
 end if;
 select * into p from public.add_on_purchases where restaurant_id=p_restaurant_id and add_on=p_add_on and status in ('initializing','pending','review','paid');
 if found then return jsonb_build_object('purchase',public.add_on_purchase_json(p),'dispatchable',false); end if;
 if exists(select 1 from public.restaurant_add_on_ownership where restaurant_id=p_restaurant_id and add_on=p_add_on and revoked_at is null) then raise exception 'add_on_already_owned'; end if;
 if (p_add_on='iyzico_online_payments' and r.plan <> 'pro') or (p_add_on='storefront_video_hero' and r.plan not in ('starter','plus')) then raise exception 'add_on_plan_required'; end if;
 ctx := public.read_restaurant_entitlement_context(p_restaurant_id,'qr_menu');
 if (ctx->>'accessAllowed')::boolean is distinct from true then raise exception 'add_on_active_subscription_required'; end if;
 select * into v from public.add_on_price_versions where add_on=p_add_on order by version desc limit 1;
 if not found or not v.active or v.version <> p_price_version then raise exception 'add_on_price_changed'; end if;
 select * into c from public.billing_customers where restaurant_id=p_restaurant_id;
 if not found or c.contact_name is null or c.contact_surname is null or c.identity_number is null or c.gsm_number is null
 or coalesce(c.billing_address->>'taxOffice','')='' or coalesce(c.billing_address->>'address','')='' or coalesce(c.billing_address->>'city','')='' or coalesce(c.billing_address->>'district','')='' then raise exception 'add_on_billing_profile_required'; end if;
 insert into public.add_on_purchases(restaurant_id,actor_user_id,add_on,price_version,request_id,net_amount_minor,vat_rate,total_amount_minor,profile,return_context)
 values(p_restaurant_id,p_user_id,p_add_on,v.version,p_request_id,v.net_amount_minor,v.vat_rate,
 v.net_amount_minor + round(v.net_amount_minor*v.vat_rate/100.0),
 jsonb_build_object('legalName',c.legal_name,'name',c.contact_name,'surname',c.contact_surname,'identityNumber',c.identity_number,'email',c.contact_email,'gsmNumber',c.gsm_number,'billingAddress',c.billing_address),p_return_context) returning * into p;
 return jsonb_build_object('purchase',public.add_on_purchase_json(p),'dispatchable',true);
end $$;

create function public.attach_add_on_checkout(p_id uuid,p_token text,p_url text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
 if char_length(coalesce(p_token,'')) not between 1 and 1000 or p_url !~ '^https://' then raise exception 'add_on_checkout_invalid'; end if;
 update public.add_on_purchases set provider_token=p_token,payment_page_url=p_url,status='pending',updated_at=now() where id=p_id and status='initializing' and provider_token is null;
 if not found then raise exception 'add_on_checkout_conflict'; end if;
end $$;

-- Fiscal jobs have exactly one sale source. One-time sales have no subscription period.
alter table public.accounting_invoice_jobs alter column subscription_invoice_id drop not null;
alter table public.accounting_invoice_jobs add column add_on_purchase_id uuid unique;
alter table public.accounting_invoice_jobs add constraint accounting_add_on_source_fk foreign key(restaurant_id,add_on_purchase_id) references public.add_on_purchases(restaurant_id,id);
alter table public.accounting_invoice_jobs add constraint accounting_one_source check(num_nonnulls(subscription_invoice_id,add_on_purchase_id)=1);

create function public.apply_add_on_payment(p_id uuid,p_evidence jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.add_on_purchases%rowtype; s text; refunded bigint; final_state text;
begin
 select * into p from public.add_on_purchases where id=p_id for update;
 if not found then raise exception 'add_on_purchase_missing'; end if;
 if p_evidence->>'token' is distinct from p.provider_token or p_evidence->>'basketId' is distinct from p.id::text
 or p_evidence->>'conversationId' is distinct from p.id::text or p_evidence->>'currency' is distinct from p.currency
 or (p_evidence->>'totalAmountMinor')::bigint is distinct from p.total_amount_minor
 or coalesce(p_evidence->>'paymentId','')='' or (p.provider_payment_id is not null and p.provider_payment_id <> p_evidence->>'paymentId') then raise exception 'add_on_evidence_mismatch'; end if;
 s:=p_evidence->>'status'; refunded:=(p_evidence->>'refundedAmountMinor')::bigint;
 if s not in ('paid','review','failed') or refunded is null or refunded < p.refunded_amount_minor or refunded > p.total_amount_minor then raise exception 'add_on_evidence_invalid'; end if;
 final_state:=case when (p_evidence->>'chargeback')::boolean then 'chargeback' when refunded=p.total_amount_minor then 'refunded' else s end;
 -- Paid access never regresses on a delayed unsuccessful notification.
 if p.status in ('refunded','chargeback') or (p.status='paid' and final_state in ('pending','review','failed')) then return public.add_on_purchase_json(p); end if;
 update public.add_on_purchases set status=final_state,provider_payment_id=p_evidence->>'paymentId',refunded_amount_minor=refunded,
 paid_at=case when final_state='paid' then coalesce(paid_at,now()) else paid_at end,last_checked_at=now(),updated_at=now() where id=p_id returning * into p;
 if final_state='paid' then
  insert into public.restaurant_add_on_ownership(restaurant_id,add_on,purchase_id) values(p.restaurant_id,p.add_on,p.id)
  on conflict(restaurant_id,add_on) do update set purchase_id=excluded.purchase_id,legacy_invoice_id=null,revoked_at=null,granted_at=now()
  where public.restaurant_add_on_ownership.revoked_at is not null;
  insert into public.accounting_invoice_jobs(restaurant_id,add_on_purchase_id,status,amount_minor,currency,billing_profile_snapshot)
  values(p.restaurant_id,p.id,'pending',p.total_amount_minor,'TRY',p.profile || jsonb_build_object('kind','add_on','addOn',p.add_on,'netAmountMinor',p.net_amount_minor,'vatRate',p.vat_rate,'paidAt',p.paid_at,'taxOffice',p.profile->'billingAddress'->>'taxOffice'))
  on conflict(add_on_purchase_id) do nothing;
 elsif final_state in ('refunded','chargeback') then
  update public.restaurant_add_on_ownership set revoked_at=coalesce(revoked_at,now()) where purchase_id=p.id;
 end if;
 return public.add_on_purchase_json(p);
end $$;

create function public.read_add_on_store(p_restaurant_id uuid) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object(
 'prices',(select coalesce(jsonb_agg(jsonb_build_object('addOn',v.add_on,'version',v.version,'netAmountMinor',v.net_amount_minor,'vatRate',v.vat_rate,'totalAmountMinor',v.net_amount_minor+round(v.net_amount_minor*v.vat_rate/100.0),'currency','TRY','active',v.active,'createdAt',v.created_at)),'[]') from (select distinct on(add_on) * from public.add_on_price_versions order by add_on,version desc) v),
 'owned',(select coalesce(jsonb_agg(add_on),'[]') from public.restaurant_add_on_ownership where restaurant_id=p_restaurant_id and revoked_at is null),
 'purchases',(select coalesce(jsonb_agg(x order by x->>'createdAt' desc),'[]') from (select jsonb_build_object('id',p.id,'addOn',p.add_on,'status',p.status,'totalAmountMinor',p.total_amount_minor,'createdAt',p.created_at,'paidAt',p.paid_at,'documentReady',exists(select 1 from public.accounting_invoice_jobs j where j.add_on_purchase_id=p.id and j.status='succeeded' and j.provider_document_ref is not null)) x from public.add_on_purchases p where p.restaurant_id=p_restaurant_id) rows));
$$;

create function public.set_add_on_price(p_actor_user_id uuid,p_add_on text,p_expected_version integer,p_net_amount_minor bigint,p_vat_rate integer,p_active boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v integer;
begin
 if not exists(select 1 from public.platform_admin_users where user_id=p_actor_user_id and role='superadmin' and status='active') then raise exception 'add_on_catalog_forbidden'; end if;
 perform pg_advisory_xact_lock(hashtextextended('add_on_price:'||p_add_on,0));
 select max(version) into v from public.add_on_price_versions where add_on=p_add_on;
 if v is distinct from p_expected_version then raise exception 'add_on_price_changed'; end if;
 insert into public.add_on_price_versions(add_on,version,net_amount_minor,vat_rate,active,actor_user_id)
 values(p_add_on,v+1,p_net_amount_minor,p_vat_rate,p_active,p_actor_user_id);
end $$;

alter function public.read_restaurant_entitlement_context(uuid,text) rename to read_restaurant_entitlement_context_before_lifetime;
create function public.read_restaurant_entitlement_context(p_restaurant_id uuid,p_feature text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare ctx jsonb; addons jsonb;
begin
 ctx:=public.read_restaurant_entitlement_context_before_lifetime(p_restaurant_id,p_feature);
 select coalesce(jsonb_agg(distinct a),'[]') into addons from (
 select jsonb_array_elements_text(ctx->'activeAddOns') a
 union select add_on from public.restaurant_add_on_ownership where restaurant_id=p_restaurant_id and revoked_at is null
 ) x;
 return ctx || jsonb_build_object('activeAddOns',addons);
end $$;

-- New recurring checkouts may no longer select add-ons. Historical rows stay readable.
create function public.prevent_new_recurring_add_ons() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if new.operation_type='checkout.initialize' and cardinality(new.requested_add_ons)>0 then raise exception 'add_ons_are_one_time_purchases'; end if;
 return new;
end $$;
create trigger prevent_new_recurring_add_ons before insert on public.billing_provider_operations for each row execute function public.prevent_new_recurring_add_ons();

do $$ declare f record; begin
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname in ('add_on_purchase_json','prepare_add_on_purchase','attach_add_on_checkout','apply_add_on_payment','read_add_on_store','set_add_on_price','read_restaurant_entitlement_context') loop
 execute format('revoke all on function %s from public, anon, authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
create function public.read_add_on_purchase(p_id uuid default null,p_token text default null) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select public.add_on_purchase_json(p) from public.add_on_purchases p where (p_id is not null and p.id=p_id) or (p_token is not null and p.provider_token=p_token);
$$;
create function public.read_add_on_price_history() returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(jsonb_build_object('addOn',add_on,'version',version,'netAmountMinor',net_amount_minor,'vatRate',vat_rate,'totalAmountMinor',net_amount_minor+round(net_amount_minor*vat_rate/100.0),'currency','TRY','active',active,'createdAt',created_at) order by created_at desc),'[]') from public.add_on_price_versions;
$$;
create function public.list_add_on_reconciliation_purchases() returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(public.add_on_purchase_json(p)),'[]') from (select * from public.add_on_purchases where provider_token is not null and status in ('pending','review','paid') and (last_checked_at is null or last_checked_at < now()-interval '1 hour') order by last_checked_at nulls first limit 20) p;
$$;
revoke all on function public.read_add_on_purchase(uuid,text),public.read_add_on_price_history(),public.list_add_on_reconciliation_purchases() from public,anon,authenticated;
grant execute on function public.read_add_on_purchase(uuid,text),public.read_add_on_price_history(),public.list_add_on_reconciliation_purchases() to service_role;

alter function public.claim_accounting_invoice_jobs(text,text,integer) rename to claim_accounting_invoice_jobs_before_add_on;
create function public.claim_accounting_invoice_jobs(p_worker_id text,p_provider_name text,p_limit integer default 5) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare jobs jsonb; begin
 jobs:=public.claim_accounting_invoice_jobs_before_add_on(p_worker_id,p_provider_name,p_limit);
 return (select coalesce(jsonb_agg(item || jsonb_build_object('addOnPurchaseId',j.add_on_purchase_id)),'[]') from jsonb_array_elements(jobs) item join public.accounting_invoice_jobs j on j.id=(item->>'id')::uuid);
end $$;
create function public.read_add_on_invoice_document(p_restaurant_id uuid,p_invoice_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare j public.accounting_invoice_jobs%rowtype; begin
 if not exists(select 1 from public.add_on_purchases where id=p_invoice_id and restaurant_id=p_restaurant_id) then return jsonb_build_object('status','not_found'); end if;
 select * into j from public.accounting_invoice_jobs where add_on_purchase_id=p_invoice_id and restaurant_id=p_restaurant_id;
 if not found or j.status <> 'succeeded' or j.provider_document_ref is null then return jsonb_build_object('status','not_ready'); end if;
 return jsonb_build_object('status','ready','providerDocumentRef',j.provider_document_ref,'fiscalDocumentType',j.fiscal_document_type);
end $$;
revoke all on function public.claim_accounting_invoice_jobs(text,text,integer),public.read_add_on_invoice_document(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_accounting_invoice_jobs(text,text,integer),public.read_add_on_invoice_document(uuid,uuid) to service_role;

create or replace function public.complete_accounting_invoice_job(
  p_job_id uuid,
  p_worker_id text,
  p_provider_contact_ref text,
  p_provider_invoice_ref text,
  p_provider_document_ref text,
  p_fiscal_document_type text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_job public.accounting_invoice_jobs%rowtype;
begin
  if p_fiscal_document_type not in ('e_fatura', 'e_arsiv')
    or nullif(btrim(p_provider_document_ref), '') is null then
    raise exception 'accounting_document_identity_invalid' using errcode = '22023';
  end if;
  update public.accounting_invoice_jobs set
    status = 'succeeded',
    provider_contact_ref = btrim(p_provider_contact_ref),
    provider_invoice_ref = btrim(p_provider_invoice_ref),
    provider_document_ref = btrim(p_provider_document_ref),
    fiscal_document_type = p_fiscal_document_type,
    completed_at = clock_timestamp(), locked_at = null, locked_by = null,
    last_error_code = null, updated_at = clock_timestamp()
  where id = p_job_id and status = 'processing' and locked_by = btrim(p_worker_id)
  returning * into v_job;
  if not found then return false; end if;

  perform public.enqueue_domain_outbox_event(
    v_job.restaurant_id, 'billing_invoice', coalesce(v_job.subscription_invoice_id,v_job.add_on_purchase_id),
    'fiscal_document.ready',
    jsonb_build_object(
      'accountingJobId', v_job.id,
      'invoiceId', coalesce(v_job.subscription_invoice_id,v_job.add_on_purchase_id),
      'fiscalDocumentType', v_job.fiscal_document_type,
      'semanticVersion', 1
    ),
    'billing:fiscal-document-ready:v1:' || coalesce(v_job.subscription_invoice_id,v_job.add_on_purchase_id)
  );
  return true;
end;
$$;

create or replace function public.record_accounting_invoice_email_delivery(
  p_job_id uuid,
  p_provider_message_id text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.accounting_invoice_jobs%rowtype;
  v_owner_id uuid;
  v_email text;
begin
  if p_job_id is null
    or coalesce(char_length(btrim(p_provider_message_id)), 0) not between 1 and 200 then
    raise exception 'accounting_email_delivery_input_invalid' using errcode = '22023';
  end if;
  select job.*
  into v_job
  from public.accounting_invoice_jobs job
  join public.restaurants restaurant on restaurant.id = job.restaurant_id
  where job.id = p_job_id and job.status = 'processing'
  for update of job;
  if not found then return false; end if;
  select restaurant.owner_id into v_owner_id
  from public.restaurants restaurant
  where restaurant.id = v_job.restaurant_id;
  v_email := nullif(btrim(v_job.billing_profile_snapshot ->> 'email'), '');
  if v_email is null then
    raise exception 'accounting_email_recipient_missing' using errcode = '55000';
  end if;

  insert into public.notification_deliveries (
    outbox_id, restaurant_id, recipient_user_id, channel, category,
    dedupe_key, recipient_address, subject, status, attempts,
    provider_message_id, provider_delivery_status, provider_event_at,
    last_error, sent_at, updated_at
  ) values (
    null, v_job.restaurant_id, v_owner_id, 'email', 'billing',
    'fiscal_document.ready:' || coalesce(v_job.subscription_invoice_id,v_job.add_on_purchase_id),
    v_email, case when v_job.add_on_purchase_id is not null then 'masabu eklenti faturanız' else 'masabu abonelik faturanız' end, 'sent', greatest(v_job.attempts, 1),
    btrim(p_provider_message_id), 'sent', clock_timestamp(),
    null, clock_timestamp(), clock_timestamp()
  ) on conflict (recipient_user_id, dedupe_key, channel) do update set
    recipient_address = excluded.recipient_address,
    status = 'sent',
    attempts = greatest(public.notification_deliveries.attempts, excluded.attempts),
    provider_message_id = excluded.provider_message_id,
    provider_delivery_status = coalesce(public.notification_deliveries.provider_delivery_status, 'sent'),
    provider_event_at = coalesce(public.notification_deliveries.provider_event_at, excluded.provider_event_at),
    last_error = null,
    sent_at = coalesce(public.notification_deliveries.sent_at, excluded.sent_at),
    updated_at = clock_timestamp()
  where public.notification_deliveries.restaurant_id = excluded.restaurant_id;
  return true;
end;
$$;

commit;
