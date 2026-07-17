-- Once split settlement fully covers an order, unmapped declared intents can
-- never collect money. Keeping them declared misleads the customer/staff UI and
-- makes a paid table look as if cash/card confirmation is still pending.
--
-- The trigger runs inside the same transaction that stamps orders paid+split.
-- Provider-token-bound shares are deliberately preserved: a real callback may
-- still arrive and must never be silently voided.

create or replace function public.void_stale_split_intents_after_payment()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.paid_at is null
     and new.paid_at is not null
     and new.payment_method = 'split'
     and new.table_session_id is not null then
    update public.payment_shares ps
       set status = 'void',
           checkout_amount = null,
           checkout_reserved_until = null,
           updated_at = now()
     where ps.table_session_id = new.table_session_id
       and ps.restaurant_id = new.restaurant_id
       and ps.status = 'declared'
       and not exists (
         select 1 from public.payment_share_tokens pst where pst.share_id = ps.id
       );
  end if;
  return new;
end;
$$;

drop trigger if exists void_stale_split_intents_on_order_payment on public.orders;
create trigger void_stale_split_intents_on_order_payment
  after update of paid_at, payment_method on public.orders
  for each row execute function public.void_stale_split_intents_after_payment();
