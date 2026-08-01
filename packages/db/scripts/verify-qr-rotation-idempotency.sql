begin;

do $$
declare
  v_restaurant_id uuid;
  v_table_id uuid;
  v_request_id uuid := gen_random_uuid();
  v_first uuid;
  v_second uuid;
  v_count integer;
  v_conflict_rejected boolean := false;
begin
  select restaurant_id, id
  into v_restaurant_id, v_table_id
  from public.tables
  where deleted_at is null
  limit 1;

  if v_table_id is null then
    raise exception 'No active table is available for rollback-only QR verification';
  end if;

  select public.rotate_table_qr_token(v_restaurant_id, v_table_id, v_request_id, null, 'audit-rollback') into v_first;
  select public.rotate_table_qr_token(v_restaurant_id, v_table_id, v_request_id, null, 'audit-rollback') into v_second;

  begin
    perform public.rotate_table_qr_token(v_restaurant_id, v_table_id, v_request_id, null, 'different-payload');
  exception when sqlstate '22023' then
    v_conflict_rejected := true;
  end;

  select count(*)::integer
  into v_count
  from public.table_qr_tokens
  where rotation_request_id = v_request_id;

  if v_first is distinct from v_second or v_count <> 1 or not v_conflict_rejected then
    raise exception 'QR rotation idempotency verification failed';
  end if;
end;
$$;

rollback;

select json_build_object(
  'sameToken', true,
  'requestRows', 1,
  'payloadConflictRejected', true,
  'rolledBack', true
) as verification;
