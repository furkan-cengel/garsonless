-- Versioned B2B agreement evidence. A privacy notice is presented separately;
-- it is never represented as consent. Raw IP addresses are not persisted.

create table public.legal_document_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  document_type text not null check (document_type in ('b2b_terms', 'privacy_notice_presented', 'checkout_summary_accepted')),
  document_version text not null check (document_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  evidence_key text not null default 'default' check (char_length(evidence_key) between 1 and 200),
  document_context jsonb not null default '{}'::jsonb check (jsonb_typeof(document_context) = 'object'),
  occurred_at timestamptz not null,
  ip_hash text check (ip_hash is null or ip_hash ~ '^[a-f0-9]{64}$'),
  user_agent text check (user_agent is null or char_length(user_agent) <= 500),
  created_at timestamptz not null default now(),
  unique (user_id, document_type, document_version, evidence_key)
);

alter table public.legal_document_acceptances enable row level security;
revoke all on table public.legal_document_acceptances from public, anon, authenticated;
grant select, insert on table public.legal_document_acceptances to service_role;

create or replace function public.record_legal_document_acceptance(
  p_user_id uuid,
  p_document_type text,
  p_document_version text,
  p_occurred_at timestamptz,
  p_ip_hash text,
  p_user_agent text,
  p_evidence_key text default 'default',
  p_document_context jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_document_type not in ('b2b_terms', 'privacy_notice_presented', 'checkout_summary_accepted')
    or p_document_version !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or p_occurred_at > clock_timestamp() + interval '5 minutes'
    or (p_ip_hash is not null and p_ip_hash !~ '^[a-f0-9]{64}$')
    or (p_user_agent is not null and char_length(p_user_agent) > 500)
    or char_length(btrim(p_evidence_key)) not between 1 and 200
    or jsonb_typeof(p_document_context) <> 'object'
    or pg_column_size(p_document_context) > 8192
    or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'legal_acceptance_input_invalid' using errcode = '22023';
  end if;

  insert into public.legal_document_acceptances (
    user_id, document_type, document_version, evidence_key, document_context,
    occurred_at, ip_hash, user_agent
  ) values (
    p_user_id, p_document_type, p_document_version, btrim(p_evidence_key), p_document_context,
    p_occurred_at,
    nullif(p_ip_hash, ''), nullif(left(p_user_agent, 500), '')
  ) on conflict (user_id, document_type, document_version, evidence_key) do nothing;
  return true;
end;
$$;

revoke all on function public.record_legal_document_acceptance(uuid,text,text,timestamptz,text,text,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.record_legal_document_acceptance(uuid,text,text,timestamptz,text,text,text,jsonb)
  to service_role;

create or replace function public.record_signup_legal_evidence(
  p_user_id uuid,
  p_document_version text,
  p_occurred_at timestamptz,
  p_ip_hash text,
  p_user_agent text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.record_legal_document_acceptance(
    p_user_id, 'b2b_terms', p_document_version, p_occurred_at, p_ip_hash, p_user_agent
  );
  perform public.record_legal_document_acceptance(
    p_user_id, 'privacy_notice_presented', p_document_version, p_occurred_at, p_ip_hash, p_user_agent
  );
  return true;
end;
$$;

revoke all on function public.record_signup_legal_evidence(uuid,text,timestamptz,text,text)
  from public, anon, authenticated;
grant execute on function public.record_signup_legal_evidence(uuid,text,timestamptz,text,text)
  to service_role;

comment on table public.legal_document_acceptances is
  'Service-role-only evidence of versioned B2B terms acceptance and separate privacy notice presentation.';
