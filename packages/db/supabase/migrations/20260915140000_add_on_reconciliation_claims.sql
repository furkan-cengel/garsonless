begin;
-- Reserve due work before calling the provider: failures cannot starve later purchases.
create or replace function public.list_add_on_reconciliation_purchases() returns jsonb
language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 with due as (
  select id from public.add_on_purchases
  where provider_token is not null and status in ('pending','review','paid')
   and (status<>'paid' or paid_at>now()-interval '2 years')
   and (last_checked_at is null or last_checked_at<now()-interval '1 hour')
  order by last_checked_at nulls first,created_at for update skip locked limit 5
 ), claimed as (
  update public.add_on_purchases p set last_checked_at=now() from due where p.id=due.id returning p.*
 ) select coalesce(jsonb_agg(public.add_on_purchase_json(claimed)),'[]') into result from claimed;
 return result;
end $$;

alter table public.add_on_price_versions add constraint add_on_supported_vat check(vat_rate in (0,1,10,20));
alter table public.add_on_purchases add column payment_evidence jsonb;
create function public.save_add_on_payment_evidence() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 new.payment_evidence:=jsonb_build_object('paymentId',new.provider_payment_id,'amountMinor',new.total_amount_minor,'currency',new.currency,'status',new.status,'refundedAmountMinor',new.refunded_amount_minor,'verifiedAt',now());
 return new;
end $$;
create trigger add_on_payment_evidence before update of provider_payment_id,refunded_amount_minor on public.add_on_purchases for each row execute function public.save_add_on_payment_evidence();

-- Closed/unpaid legacy subscriptions still need a transition report, independently of grant eligibility.
create function public.read_legacy_add_on_transitions() returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(jsonb_build_object('subscriptionId',s.id,'restaurantId',s.restaurant_id,'ownerId',r.owner_id,
 'plan',s.plan,'interval',s.billing_interval,'status',s.status,'cancelAtPeriodEnd',s.cancel_at_period_end,
 'scheduledPlan',s.scheduled_plan,'providerSubscriptionRef',s.provider_subscription_ref,'transitionStatus',t.status)),'[]')
 from public.billing_subscriptions s join public.restaurants r on r.id=s.restaurant_id
 left join public.add_on_transition_log t on t.subscription_id=s.id
 where r.deleted_at is null and (exists(select 1 from public.restaurant_subscription_add_ons a where a.subscription_id=s.id)
 or exists(select 1 from public.subscription_change_requests c where c.subscription_id=s.id and cardinality(c.to_add_ons)>0 and c.status in ('scheduled','requires_reconciliation')));
$$;
revoke all on function public.read_legacy_add_on_transitions() from public,anon,authenticated;
grant execute on function public.read_legacy_add_on_transitions() to service_role;
commit;
