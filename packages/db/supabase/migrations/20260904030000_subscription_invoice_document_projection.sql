-- Add a provider-safe fiscal document state to the owner billing projection
-- and expose the actual provider identity only through a service-role lookup.

begin;

alter function public.read_subscription_billing_settings(uuid)
  rename to read_subscription_billing_settings_before_fiscal_document_projection;
revoke all on function public.read_subscription_billing_settings_before_fiscal_document_projection(uuid)
  from public, anon, authenticated, service_role;

create function public.read_subscription_billing_settings(p_restaurant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_settings jsonb;
  v_invoices jsonb;
begin
  v_settings := public.read_subscription_billing_settings_before_fiscal_document_projection(
    p_restaurant_id
  );

  select coalesce(jsonb_agg(
    item.invoice || jsonb_build_object(
      'fiscalDocumentStatus', case
        when item.invoice->>'status' is distinct from 'paid' then 'not_available'
        when item.provider_name = 'nilvera'
          and nullif(btrim(item.provider_document_ref), '') is not null
          and item.fiscal_document_type in ('e_fatura', 'e_arsiv') then 'ready'
        when item.provider_name is not null and item.provider_name <> 'nilvera' then 'not_available'
        when item.status = 'needs_profile' then 'profile_required'
        when item.status in ('failed', 'succeeded') then 'failed'
        else 'preparing'
      end,
      'fiscalDocumentType', case
        when item.fiscal_document_type in ('e_fatura', 'e_arsiv')
          then item.fiscal_document_type
        else null
      end,
      'canDownload', item.invoice->>'status' = 'paid'
        and item.provider_name = 'nilvera'
        and nullif(btrim(item.provider_document_ref), '') is not null
        and item.fiscal_document_type in ('e_fatura', 'e_arsiv')
    ) order by item.ordinality
  ), '[]'::jsonb)
  into v_invoices
  from (
    select invoice.value as invoice, invoice.ordinality,
      job.status, job.provider_name, job.provider_document_ref,
      job.fiscal_document_type
    from jsonb_array_elements(coalesce(v_settings->'invoices', '[]'::jsonb))
      with ordinality as invoice(value, ordinality)
    left join public.accounting_invoice_jobs job
      on job.restaurant_id = p_restaurant_id
      and job.subscription_invoice_id = (invoice.value->>'id')::uuid
  ) item;

  return jsonb_set(v_settings, '{invoices}', v_invoices, true);
end;
$$;

create function public.read_subscription_invoice_document(
  p_restaurant_id uuid,
  p_invoice_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice_status text;
  v_job public.accounting_invoice_jobs%rowtype;
begin
  select invoice.status into v_invoice_status
  from public.subscription_invoices invoice
  where invoice.restaurant_id = p_restaurant_id
    and invoice.id = p_invoice_id;

  if not found or v_invoice_status <> 'paid' then
    return jsonb_build_object('status', 'not_found');
  end if;

  select job.* into v_job
  from public.accounting_invoice_jobs job
  where job.restaurant_id = p_restaurant_id
    and job.subscription_invoice_id = p_invoice_id;

  if found
    and v_job.provider_name = 'nilvera'
    and nullif(btrim(v_job.provider_document_ref), '') is not null
    and v_job.fiscal_document_type in ('e_fatura', 'e_arsiv') then
    return jsonb_build_object(
      'status', 'ready',
      'providerDocumentRef', v_job.provider_document_ref,
      'fiscalDocumentType', v_job.fiscal_document_type
    );
  end if;

  return jsonb_build_object('status', 'not_ready');
end;
$$;

revoke all on function public.read_subscription_billing_settings(uuid)
  from public, anon, authenticated;
revoke all on function public.read_subscription_invoice_document(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.read_subscription_billing_settings(uuid) to service_role;
grant execute on function public.read_subscription_invoice_document(uuid,uuid) to service_role;

comment on function public.read_subscription_invoice_document(uuid,uuid) is
  'Service-only paid subscription invoice lookup. Provider identity never crosses the owner HTTP boundary.';

commit;
