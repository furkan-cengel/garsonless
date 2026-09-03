-- Faz 3a hardening: retain change-request audit without creating a circular
-- delete dependency, and resolve the exact provider-operation reconciliation
-- job when an authoritative provider result successfully schedules the change.

alter table public.subscription_change_requests
  drop constraint if exists subscription_change_requests_provider_operation_fk;
alter table public.subscription_change_requests
  add constraint subscription_change_requests_provider_operation_fk
  foreign key (provider_operation_id)
  references public.billing_provider_operations(id)
  on delete set null;

create function public.resolve_subscription_change_reconciliation_after_schedule()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'scheduled'
    and old.status = 'requires_reconciliation'
    and new.provider_operation_id is not null then
    update public.billing_reconciliation_jobs
    set status = 'resolved', completed_at = coalesce(new.scheduled_at, clock_timestamp()),
        discrepancy_code = null, last_error = null,
        locked_at = null, locked_by = null,
        local_snapshot = local_snapshot || jsonb_build_object(
          'changeRequestId', new.id,
          'providerTargetSubscriptionRef', new.provider_target_subscription_ref
        )
    where dedupe_key = 'provider-operation:' || new.provider_operation_id
      and status <> 'resolved';
  end if;
  return new;
end;
$$;

create trigger resolve_subscription_change_reconciliation_after_schedule
  after update of status on public.subscription_change_requests
  for each row execute function public.resolve_subscription_change_reconciliation_after_schedule();

comment on function public.resolve_subscription_change_reconciliation_after_schedule() is
  'Closes only the exact subscription.change provider-operation reconciliation after exact-bound finalize succeeds.';
