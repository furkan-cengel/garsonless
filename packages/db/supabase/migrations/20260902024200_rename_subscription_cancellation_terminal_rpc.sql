-- PostgreSQL truncates identifiers to 63 bytes. Rename the terminal resolver
-- from its automatically truncated creation name to a stable public RPC name.

begin;

alter function public.resolve_subscription_cancellation_target_terminal_reconciliatio(
  uuid,uuid,uuid,text,text,timestamptz,text,timestamptz
) rename to resolve_subscription_cancellation_target_terminal;

notify pgrst, 'reload schema';

commit;
