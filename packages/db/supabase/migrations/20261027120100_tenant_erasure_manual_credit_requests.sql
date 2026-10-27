-- Tenant privacy erasure failed for any restaurant that had ever granted manual
-- store credit: manual_store_credit_requests.loyalty_transaction_id restricts the
-- ledger delete. Found by the CRM phase 1 runtime proof. This redefines the
-- function from 20261027120000 to unlink and delete those requests too
-- (they hold the customer id and the owner's note).

create or replace function public.erase_platform_admin_tenant_privacy_data(
  p_restaurant_id uuid,
  p_actor_user_id uuid,
  p_actor_role text,
  p_reason text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_identity public.platform_admin_users%rowtype;
  v_operation public.platform_tenant_privacy_operations%rowtype;
  v_customer_ids uuid[] := '{}'::uuid[];
  v_summary jsonb;
  v_customer_count integer := 0;
  v_consent_count integer := 0;
  v_order_count integer := 0;
  v_loyalty_count integer := 0;
  v_campaign_count integer := 0;
  v_share_count integer := 0;
  v_anonymized_count integer := 0;
  v_note_count integer := 0;
begin
  if char_length(btrim(coalesce(p_reason, ''))) not between 10 and 1000 or p_request_id is null then
    raise exception 'platform_privacy_input_invalid' using errcode = '22023';
  end if;
  select * into v_identity from public.platform_admin_users where user_id = p_actor_user_id for update;
  if not found or v_identity.status <> 'active' or v_identity.role <> p_actor_role or v_identity.role <> 'superadmin' then
    raise exception 'platform_privacy_not_authorized' using errcode = '42501';
  end if;
  perform 1 from public.restaurants where id = p_restaurant_id and deleted_at is null for update;
  if not found then raise exception 'platform_tenant_not_found' using errcode = 'P0002'; end if;

  select * into v_operation from public.platform_tenant_privacy_operations where request_id = p_request_id;
  if found then
    if v_operation.restaurant_id <> p_restaurant_id or v_operation.operation_type <> 'erase' or v_operation.requested_by <> p_actor_user_id then
      raise exception 'platform_privacy_request_conflict' using errcode = '23505';
    end if;
    return jsonb_build_object('operation', jsonb_build_object('id', v_operation.id, 'restaurantId', v_operation.restaurant_id, 'type', v_operation.operation_type, 'status', v_operation.status, 'reason', v_operation.reason, 'summary', v_operation.result_summary, 'requestedBy', v_operation.requested_by, 'requestId', v_operation.request_id, 'createdAt', v_operation.created_at, 'completedAt', v_operation.completed_at), 'duplicate', true);
  end if;

  select coalesce(array_agg(customer_id), '{}'::uuid[]), count(*) into v_customer_ids, v_customer_count
  from (
    select customer_id from public.customer_restaurants where restaurant_id = p_restaurant_id
    union select customer_id from public.orders where restaurant_id = p_restaurant_id and customer_id is not null
    union select customer_id from public.loyalty_transactions where restaurant_id = p_restaurant_id
    union select customer_id from public.customer_consents where restaurant_id = p_restaurant_id
    union select customer_id from public.payment_shares where restaurant_id = p_restaurant_id and customer_id is not null
    union select customer_id from public.campaign_recipients where restaurant_id = p_restaurant_id
    union select customer_id from public.message_events where restaurant_id = p_restaurant_id and customer_id is not null
    union select customer_id from public.customer_notes where restaurant_id = p_restaurant_id
  ) ids;

  select count(*) into v_consent_count from public.customer_consents where restaurant_id = p_restaurant_id;
  select count(*) into v_order_count from public.orders where restaurant_id = p_restaurant_id and customer_id is not null;
  select count(*) into v_loyalty_count from public.loyalty_transactions where restaurant_id = p_restaurant_id;
  select count(*) into v_campaign_count from public.campaign_recipients where restaurant_id = p_restaurant_id;
  select count(*) into v_share_count from public.payment_shares where restaurant_id = p_restaurant_id and customer_id is not null;
  select count(*) into v_note_count from public.customer_notes where restaurant_id = p_restaurant_id;

  update public.orders set customer_id = null, customer_tier = null where restaurant_id = p_restaurant_id and customer_id is not null;
  update public.payment_shares set customer_id = null, label = null where restaurant_id = p_restaurant_id and customer_id is not null;
  update public.message_events set customer_id = null, recipient_id = null, phone = null, provider_message_id = null, error = null, metadata = '{}'::jsonb where restaurant_id = p_restaurant_id and customer_id is not null;
  delete from public.campaign_recipients where restaurant_id = p_restaurant_id;
  delete from public.customer_consents where restaurant_id = p_restaurant_id;
  delete from public.customer_notes where restaurant_id = p_restaurant_id;
  delete from public.customer_contact_reveals where restaurant_id = p_restaurant_id;
  -- Manual credit requests and their ledger rows reference each other; unlink before deleting both.
  update public.manual_store_credit_requests set loyalty_transaction_id = null where restaurant_id = p_restaurant_id;
  delete from public.loyalty_transactions where restaurant_id = p_restaurant_id;
  delete from public.manual_store_credit_requests where restaurant_id = p_restaurant_id;
  delete from public.manual_point_deduction_requests where restaurant_id = p_restaurant_id;
  delete from public.customer_restaurants where restaurant_id = p_restaurant_id;

  update public.customers customer set name = null, phone = null, email = null, auth_user_id = null, verified_at = null
  where customer.id = any(v_customer_ids)
    and not exists (select 1 from public.customer_restaurants x where x.customer_id = customer.id)
    and not exists (select 1 from public.orders x where x.customer_id = customer.id)
    and not exists (select 1 from public.loyalty_transactions x where x.customer_id = customer.id)
    and not exists (select 1 from public.customer_consents x where x.customer_id = customer.id)
    and not exists (select 1 from public.payment_shares x where x.customer_id = customer.id)
    and not exists (select 1 from public.campaign_recipients x where x.customer_id = customer.id)
    and not exists (select 1 from public.message_events x where x.customer_id = customer.id)
    and not exists (select 1 from public.customer_notes x where x.customer_id = customer.id);
  get diagnostics v_anonymized_count = row_count;

  v_summary := jsonb_build_object('customerCount', v_customer_count, 'consentCount', v_consent_count, 'orderLinkCount', v_order_count, 'loyaltyRowCount', v_loyalty_count, 'campaignRecipientCount', v_campaign_count, 'paymentShareLinkCount', v_share_count, 'customerNoteCount', v_note_count, 'anonymizedGlobalCustomerCount', v_anonymized_count);
  insert into public.platform_tenant_privacy_operations (restaurant_id, operation_type, status, reason, result_summary, requested_by, request_id)
  values (p_restaurant_id, 'erase', 'completed', btrim(p_reason), v_summary, p_actor_user_id, p_request_id)
  returning * into v_operation;
  insert into public.platform_admin_audit_log (actor_user_id, actor_role, action, target_type, target_id, reason, request_id, before_state, after_state)
  values (p_actor_user_id, v_identity.role, 'tenant.privacy.erase', 'restaurant', p_restaurant_id::text, btrim(p_reason), p_request_id,
    jsonb_build_object('customerCount', v_customer_count), jsonb_build_object('operationId', v_operation.id, 'summary', v_summary, 'billingRecordsPreserved', true, 'operationalOrdersPreserved', true));

  return jsonb_build_object('operation', jsonb_build_object('id', v_operation.id, 'restaurantId', v_operation.restaurant_id, 'type', v_operation.operation_type, 'status', v_operation.status, 'reason', v_operation.reason, 'summary', v_operation.result_summary, 'requestedBy', v_operation.requested_by, 'requestId', v_operation.request_id, 'createdAt', v_operation.created_at, 'completedAt', v_operation.completed_at), 'duplicate', false);
end;
$$;

revoke all on function public.erase_platform_admin_tenant_privacy_data(uuid,uuid,text,text,uuid) from public, anon, authenticated;
grant execute on function public.erase_platform_admin_tenant_privacy_data(uuid,uuid,text,text,uuid) to service_role;
