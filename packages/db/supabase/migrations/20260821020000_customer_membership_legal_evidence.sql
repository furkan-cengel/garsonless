alter table public.legal_document_acceptances
  drop constraint if exists legal_document_acceptances_document_type_check;
alter table public.legal_document_acceptances
  add constraint legal_document_acceptances_document_type_check check (document_type in (
    'b2b_terms',
    'privacy_notice_presented',
    'checkout_summary_accepted',
    'customer_membership_terms',
    'customer_privacy_notice_presented'
  ));

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
  if p_document_type not in (
      'b2b_terms', 'privacy_notice_presented', 'checkout_summary_accepted',
      'customer_membership_terms', 'customer_privacy_notice_presented'
    )
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
    p_occurred_at, nullif(p_ip_hash, ''), nullif(left(p_user_agent, 500), '')
  ) on conflict (user_id, document_type, document_version, evidence_key) do nothing;
  return true;
end;
$$;

create or replace function public.record_customer_membership_legal_evidence(
  p_user_id uuid,
  p_document_version text,
  p_occurred_at timestamptz,
  p_ip_hash text,
  p_user_agent text,
  p_restaurant_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context jsonb := case when p_restaurant_id is null
    then '{}'::jsonb
    else jsonb_build_object('restaurantId', p_restaurant_id)
  end;
begin
  perform public.record_legal_document_acceptance(
    p_user_id, 'customer_membership_terms', p_document_version, p_occurred_at,
    p_ip_hash, p_user_agent, 'customer-auth', v_context
  );
  perform public.record_legal_document_acceptance(
    p_user_id, 'customer_privacy_notice_presented', p_document_version, p_occurred_at,
    p_ip_hash, p_user_agent, 'customer-auth', v_context
  );
  return true;
end;
$$;

revoke all on function public.record_customer_membership_legal_evidence(uuid,text,timestamptz,text,text,uuid)
  from public, anon, authenticated;
grant execute on function public.record_customer_membership_legal_evidence(uuid,text,timestamptz,text,text,uuid)
  to service_role;
