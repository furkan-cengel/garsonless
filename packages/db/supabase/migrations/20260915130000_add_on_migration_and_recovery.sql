begin;
alter table public.add_on_purchases add column terms_version text not null default 'one-time-add-ons-v1';
alter table public.add_on_purchases add column reversal_evidence jsonb;

create function public.grant_legacy_add_on_ownership(p_invoice_id uuid,p_add_on text) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.subscription_invoices%rowtype;
begin
 select * into i from public.subscription_invoices where id=p_invoice_id and status='paid' and amount_paid_minor>0 for update;
 if not found or not(p_add_on=any(i.add_ons)) or not exists(select 1 from public.subscription_payment_attempts where invoice_id=i.id and status='succeeded' and provider_payment_id is not null)
 or exists(select 1 from public.subscription_refunds where invoice_id=i.id and status in ('succeeded','processing','requires_reconciliation')) then raise exception 'legacy_add_on_payment_unverified'; end if;
 insert into public.restaurant_add_on_ownership(restaurant_id,add_on,legacy_invoice_id) values(i.restaurant_id,p_add_on,i.id)
 on conflict(restaurant_id,add_on) do nothing;
 return true;
end $$;

create function public.read_legacy_add_on_candidates() returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(jsonb_build_object('invoiceId',i.id,'restaurantId',i.restaurant_id,'addOn',a,
 'subscriptionId',s.id,'ownerId',r.owner_id,'plan',s.plan,'interval',s.billing_interval,'status',s.status,
 'cancelAtPeriodEnd',s.cancel_at_period_end,'scheduledPlan',s.scheduled_plan,'providerSubscriptionRef',s.provider_subscription_ref,
 'transitionStatus',t.status,'providerPaymentId',(select provider_payment_id from public.subscription_payment_attempts where invoice_id=i.id and status='succeeded' and provider_payment_id is not null limit 1))), '[]')
 from public.subscription_invoices i cross join lateral unnest(i.add_ons) a
 join public.restaurants r on r.id=i.restaurant_id
 join public.billing_subscriptions s on s.id=i.subscription_id
 left join public.add_on_transition_log t on t.subscription_id=s.id
 where i.status='paid' and i.amount_paid_minor>0 and r.deleted_at is null
 and exists(select 1 from public.subscription_payment_attempts where invoice_id=i.id and status='succeeded' and provider_payment_id is not null)
 and not exists(select 1 from public.subscription_refunds where invoice_id=i.id and status in ('succeeded','processing','requires_reconciliation'));
$$;

create function public.record_add_on_transition(p_subscription_id uuid,p_status text,p_target_plan_ref text,p_error_code text) returns void
language sql security definer set search_path=public,pg_temp as $$
 insert into public.add_on_transition_log(subscription_id,status,target_plan_ref,error_code) values(p_subscription_id,p_status,p_target_plan_ref,p_error_code)
 on conflict(subscription_id) do update set status=excluded.status,target_plan_ref=excluded.target_plan_ref,error_code=excluded.error_code,updated_at=now();
$$;

-- Definitive initialization failures release the reservation; timeouts remain unresolved.
create function public.fail_add_on_initialization(p_id uuid) returns void language sql security definer set search_path=public,pg_temp as $$
 update public.add_on_purchases set status='failed',updated_at=now() where id=p_id and status='initializing' and provider_token is null;
$$;

-- A verified finance operator may record a final dispute outcome from the acquirer.
create function public.record_add_on_chargeback(p_actor_user_id uuid,p_purchase_id uuid,p_payment_id text,p_evidence_ref text,p_finalized_at timestamptz) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from public.platform_admin_users where user_id=p_actor_user_id and status='active' and role in ('finance','superadmin')) then raise exception 'add_on_reversal_forbidden'; end if;
 if char_length(btrim(coalesce(p_evidence_ref,''))) not between 10 and 500 or p_finalized_at is null or p_finalized_at>now() then raise exception 'add_on_reversal_evidence_invalid'; end if;
 update public.add_on_purchases set status='chargeback',reversal_evidence=jsonb_build_object('actorUserId',p_actor_user_id,'paymentId',p_payment_id,'reference',p_evidence_ref,'finalizedAt',p_finalized_at),updated_at=now()
 where id=p_purchase_id and provider_payment_id=p_payment_id and status='paid';
 if not found then raise exception 'add_on_reversal_identity_mismatch'; end if;
 update public.restaurant_add_on_ownership set revoked_at=now() where purchase_id=p_purchase_id and revoked_at is null;
end $$;

create function public.revoke_refunded_legacy_add_on() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.status='succeeded' and new.scope='full' then
  update public.restaurant_add_on_ownership set revoked_at=coalesce(revoked_at,now()) where legacy_invoice_id=new.invoice_id;
 end if;
 return new;
end $$;
create trigger revoke_refunded_legacy_add_on after insert or update of status on public.subscription_refunds for each row execute function public.revoke_refunded_legacy_add_on();

do $$ declare f record; begin
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname in ('grant_legacy_add_on_ownership','read_legacy_add_on_candidates','record_add_on_transition','fail_add_on_initialization','record_add_on_chargeback') loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
commit;
