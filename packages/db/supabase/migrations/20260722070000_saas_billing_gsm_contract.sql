-- Faz 5 closure: align the Postgres GSM contract with the dashboard and
-- application validators. With standard_conforming_strings enabled, the
-- original double backslash matched a literal backslash instead of an
-- optional leading plus.

alter table public.billing_customers
  drop constraint billing_customers_gsm_number_check;

alter table public.billing_customers
  add constraint billing_customers_gsm_number_check
    check (gsm_number is null or gsm_number ~ '^\+?[0-9]{10,15}$');

create or replace function public.upsert_subscription_billing_profile(
  p_restaurant_id uuid,
  p_legal_name text,
  p_contact_name text,
  p_contact_surname text,
  p_identity_number text,
  p_contact_email text,
  p_gsm_number text,
  p_billing_address jsonb,
  p_shipping_address jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer public.billing_customers%rowtype;
begin
  if char_length(btrim(p_legal_name)) not between 1 and 200
    or char_length(btrim(p_contact_name)) not between 1 and 100
    or char_length(btrim(p_contact_surname)) not between 1 and 100
    or p_identity_number !~ '^[0-9]{10,11}$'
    or char_length(btrim(p_contact_email)) not between 3 and 320
    or p_contact_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_gsm_number !~ '^\+?[0-9]{10,15}$'
    or jsonb_typeof(p_billing_address) <> 'object'
    or jsonb_typeof(p_shipping_address) <> 'object'
    or pg_column_size(p_billing_address) > 4096
    or pg_column_size(p_shipping_address) > 4096
    or coalesce(char_length(btrim(p_billing_address->>'contactName')), 0) not between 1 and 100
    or coalesce(char_length(btrim(p_billing_address->>'city')), 0) not between 1 and 100
    or coalesce(char_length(btrim(p_billing_address->>'country')), 0) not between 1 and 100
    or coalesce(char_length(btrim(p_billing_address->>'address')), 0) not between 1 and 500
    or coalesce(char_length(btrim(p_shipping_address->>'contactName')), 0) not between 1 and 100
    or coalesce(char_length(btrim(p_shipping_address->>'city')), 0) not between 1 and 100
    or coalesce(char_length(btrim(p_shipping_address->>'country')), 0) not between 1 and 100
    or coalesce(char_length(btrim(p_shipping_address->>'address')), 0) not between 1 and 500 then
    raise exception 'billing_profile_input_invalid' using errcode = '22023';
  end if;

  insert into public.billing_customers (
    restaurant_id, legal_name, contact_name, contact_surname,
    identity_number, contact_email, gsm_number, billing_address,
    shipping_address, profile_completed_at
  ) values (
    p_restaurant_id, btrim(p_legal_name), btrim(p_contact_name),
    btrim(p_contact_surname), btrim(p_identity_number),
    lower(btrim(p_contact_email)), btrim(p_gsm_number), p_billing_address,
    p_shipping_address, clock_timestamp()
  )
  on conflict (restaurant_id) do update set
    legal_name = excluded.legal_name,
    contact_name = excluded.contact_name,
    contact_surname = excluded.contact_surname,
    identity_number = excluded.identity_number,
    contact_email = excluded.contact_email,
    gsm_number = excluded.gsm_number,
    billing_address = excluded.billing_address,
    shipping_address = excluded.shipping_address,
    profile_completed_at = excluded.profile_completed_at
  returning * into v_customer;

  return jsonb_build_object('customerId', v_customer.id);
end;
$$;

revoke all on function public.upsert_subscription_billing_profile(
  uuid,text,text,text,text,text,text,jsonb,jsonb
) from public, anon, authenticated;
grant execute on function public.upsert_subscription_billing_profile(
  uuid,text,text,text,text,text,text,jsonb,jsonb
) to service_role;
