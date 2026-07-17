-- Explicit application-originated events (welcome/campaign) need the trusted
-- server adapter to enqueue. Browser roles remain denied; aggregate triggers
-- continue to call the same function inside their transaction.

revoke all on function public.enqueue_domain_outbox_event(uuid, text, uuid, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.enqueue_domain_outbox_event(uuid, text, uuid, text, jsonb, text)
  to service_role;
