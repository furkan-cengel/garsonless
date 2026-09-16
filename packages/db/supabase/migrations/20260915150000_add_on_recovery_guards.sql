begin;
create or replace function public.prevent_new_recurring_add_ons() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if new.operation_type in ('checkout.initialize','subscription.change') and cardinality(new.requested_add_ons)>0 then raise exception 'add_ons_are_one_time_purchases'; end if;
 return new;
end $$;
alter table public.add_on_purchases add constraint verified_add_on_requires_checkout check(status not in ('paid','review') or provider_token is not null);
create or replace function public.list_add_on_reconciliation_purchases() returns jsonb
language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 with due as (
  select id from public.add_on_purchases
  where ((provider_token is not null and status in ('pending','review','paid'))
    or (status='initializing' and created_at<now()-interval '5 minutes'))
   and (status<>'paid' or paid_at>now()-interval '2 years')
   and (last_checked_at is null or last_checked_at<now()-interval '1 hour')
  order by last_checked_at nulls first,created_at for update skip locked limit 5
 ), claimed as (
  update public.add_on_purchases p set last_checked_at=now() from due where p.id=due.id returning p.*
 ) select coalesce(jsonb_agg(public.add_on_purchase_json(claimed)),'[]') into result from claimed;
 return result;
end $$;
commit;
