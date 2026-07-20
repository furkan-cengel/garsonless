-- Team-management audit records share the hardened service-role-only security
-- event sink. Metadata is deliberately small: an owner needs the target email
-- and granted sections, but no request body, token, or provider secret may be
-- persisted here.

alter table public.security_events
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.security_events
  drop constraint if exists security_events_event_type_check;

alter table public.security_events
  add constraint security_events_event_type_check check (
    event_type in (
      'login',
      'password_change',
      'team_member_invited',
      'team_invite_resent',
      'team_member_permissions_updated',
      'team_member_disabled',
      'team_member_activated',
      'team_member_removed',
      'team_invite_accepted'
    )
  );

-- Account activity remains private to its user. Team events are additionally
-- visible to the restaurant's current owner, including after an ownership
-- transfer, while members never receive this audit projection.
drop policy if exists "user_reads_own_security_events" on public.security_events;
create policy "account_or_owner_reads_security_events" on public.security_events
  for select to authenticated
  using (
    user_id = auth.uid()
    or (restaurant_id is not null and public.is_restaurant_owner(restaurant_id))
  );

create index if not exists security_events_team_audit_idx
  on public.security_events (restaurant_id, created_at desc)
  where event_type like 'team_%';
