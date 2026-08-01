-- Bind every transfer request id to one immutable canonical intent.
-- Exact retries remain idempotent; request-id reuse with different input fails.

alter table public.table_transfer_operations
  add column if not exists request_intent jsonb;

create or replace function public.table_transfer_request_intent(
  p_kind text,
  p_source_table_id uuid,
  p_target_table_id uuid,
  p_order_ids uuid[]
) returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'kind', p_kind,
    'sourceTableId', p_source_table_id::text,
    'targetTableId', p_target_table_id::text,
    'orderIds', case
      when p_kind = 'account_transfer' then coalesce((
        select jsonb_agg(canonical.order_id::text order by canonical.order_id)
        from (
          select distinct unnest(coalesce(p_order_ids, '{}'::uuid[])) as order_id
        ) canonical
      ), '[]'::jsonb)
      else '[]'::jsonb
    end
  );
$$;

revoke all on function public.table_transfer_request_intent(text,uuid,uuid,uuid[])
  from public, anon, authenticated;
grant execute on function public.table_transfer_request_intent(text,uuid,uuid,uuid[])
  to service_role;

update public.table_transfer_operations operation
set request_intent = public.table_transfer_request_intent(
  operation.kind,
  operation.source_table_id,
  operation.target_table_id,
  case when operation.kind = 'account_transfer' then array(
    select moved.order_id
    from public.table_transfer_orders moved
    where moved.operation_id = operation.id
    order by moved.order_id
  ) else '{}'::uuid[] end
)
where operation.request_intent is null;

alter table public.table_transfer_operations
  alter column request_intent set not null;

alter table public.table_transfer_operations
  drop constraint if exists table_transfer_request_intent_object_check;
alter table public.table_transfer_operations
  add constraint table_transfer_request_intent_object_check
  check (jsonb_typeof(request_intent) = 'object');

create or replace function public.move_table_session(
  p_restaurant_id uuid, p_source_table_id uuid, p_target_table_id uuid,
  p_actor_id uuid, p_request_id uuid
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_source public.table_sessions%rowtype;
  v_op public.table_transfer_operations%rowtype;
  v_intent jsonb := public.table_transfer_request_intent(
    'table_move', p_source_table_id, p_target_table_id, '{}'::uuid[]
  );
begin
  if p_request_id is null then
    raise exception 'Geçersiz istek kimliği' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_restaurant_id::text || ':' || p_request_id::text, 0
  ));
  select * into v_op
  from public.table_transfer_operations
  where restaurant_id = p_restaurant_id and request_id = p_request_id
  for update;
  if found then
    if v_op.request_intent <> v_intent then
      raise exception 'table_transfer_idempotency_conflict' using errcode = 'P0001';
    end if;
    return jsonb_build_object('operationId', v_op.id, 'idempotent', true);
  end if;

  if p_source_table_id = p_target_table_id then raise exception 'Kaynak ve hedef masa aynı olamaz'; end if;
  perform 1 from public.tables where restaurant_id=p_restaurant_id and id in (p_source_table_id,p_target_table_id) and deleted_at is null order by id for update;
  if (select count(*) from public.tables where restaurant_id=p_restaurant_id and id in (p_source_table_id,p_target_table_id) and deleted_at is null) <> 2 then raise exception 'Masa bulunamadı'; end if;
  select * into v_source from public.table_sessions where restaurant_id=p_restaurant_id and table_id=p_source_table_id and closed_at is null for update;
  if not found then raise exception 'Kaynak masada açık adisyon yok'; end if;
  if exists(select 1 from public.table_sessions where restaurant_id=p_restaurant_id and table_id=p_target_table_id and closed_at is null) then raise exception 'Hedef masa boş olmalı'; end if;
  insert into public.table_transfer_operations(
    restaurant_id,request_id,request_intent,kind,source_table_id,target_table_id,
    source_session_id,target_session_id,created_by,financial_fingerprint
  ) values(
    p_restaurant_id,p_request_id,v_intent,'table_move',p_source_table_id,p_target_table_id,
    v_source.id,v_source.id,p_actor_id,''
  ) returning * into v_op;
  insert into public.table_transfer_orders(operation_id,order_id,guest_session_id)
    select v_op.id,id,session_id from public.orders where restaurant_id=p_restaurant_id and table_session_id=v_source.id and deleted_at is null;
  insert into public.table_transfer_shares(operation_id,share_id)
    select v_op.id,id from public.payment_shares where restaurant_id=p_restaurant_id and table_session_id=v_source.id and status <> 'void';
  update public.table_sessions set table_id=p_target_table_id,updated_at=now() where id=v_source.id;
  update public.orders set table_id=p_target_table_id,updated_at=now() where restaurant_id=p_restaurant_id and table_session_id=v_source.id and deleted_at is null;
  update public.service_requests set table_id=p_target_table_id where restaurant_id=p_restaurant_id and table_session_id=v_source.id and status='pending';
  update public.table_transfer_operations set financial_fingerprint=public.table_transfer_financial_fingerprint(v_op.id) where id=v_op.id;
  return jsonb_build_object('operationId',v_op.id,'idempotent',false);
end; $$;

create or replace function public.transfer_table_orders(
  p_restaurant_id uuid, p_source_table_id uuid, p_target_table_id uuid,
  p_order_ids uuid[], p_actor_id uuid, p_request_id uuid
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_source public.table_sessions%rowtype;
  v_target public.table_sessions%rowtype;
  v_op public.table_transfer_operations%rowtype;
  v_active uuid[];
  v_full boolean;
  v_created boolean := false;
  v_intent jsonb := public.table_transfer_request_intent(
    'account_transfer', p_source_table_id, p_target_table_id, p_order_ids
  );
begin
  if p_request_id is null then
    raise exception 'Geçersiz istek kimliği' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_restaurant_id::text || ':' || p_request_id::text, 0
  ));
  select * into v_op
  from public.table_transfer_operations
  where restaurant_id = p_restaurant_id and request_id = p_request_id
  for update;
  if found then
    if v_op.request_intent <> v_intent then
      raise exception 'table_transfer_idempotency_conflict' using errcode = 'P0001';
    end if;
    return jsonb_build_object('operationId', v_op.id, 'idempotent', true);
  end if;

  if p_source_table_id=p_target_table_id or coalesce(array_length(p_order_ids,1),0)=0 then raise exception 'Geçersiz taşıma seçimi'; end if;
  perform 1 from public.tables where restaurant_id=p_restaurant_id and id in (p_source_table_id,p_target_table_id) and deleted_at is null order by id for update;
  if (select count(*) from public.tables where restaurant_id=p_restaurant_id and id in (p_source_table_id,p_target_table_id) and deleted_at is null) <> 2 then raise exception 'Masa bulunamadı'; end if;
  select * into v_source from public.table_sessions where restaurant_id=p_restaurant_id and table_id=p_source_table_id and closed_at is null for update;
  if not found then raise exception 'Kaynak masada açık adisyon yok'; end if;
  select array_agg(id order by id) into v_active from public.orders where restaurant_id=p_restaurant_id and table_session_id=v_source.id and deleted_at is null and status<>'cancelled';
  if exists(select 1 from unnest(p_order_ids) x where not (x=any(coalesce(v_active,'{}'::uuid[])))) then raise exception 'Seçimde taşınamayan sipariş var'; end if;
  v_full := (select count(distinct x)=coalesce(array_length(v_active,1),0) from unnest(p_order_ids) x);
  if exists(select 1 from public.payment_shares where restaurant_id=p_restaurant_id and table_session_id=v_source.id and status<>'void') and not v_full then raise exception 'Bölünmüş ödeme bulunan hesap yalnız tamamen taşınabilir'; end if;
  select * into v_target from public.table_sessions where restaurant_id=p_restaurant_id and table_id=p_target_table_id and closed_at is null for update;
  if not found then insert into public.table_sessions(restaurant_id,table_id) values(p_restaurant_id,p_target_table_id) returning * into v_target; v_created:=true; end if;
  insert into public.table_transfer_operations(
    restaurant_id,request_id,request_intent,kind,source_table_id,target_table_id,
    source_session_id,target_session_id,source_session_closed,target_session_created,
    created_by,financial_fingerprint
  ) values(
    p_restaurant_id,p_request_id,v_intent,'account_transfer',p_source_table_id,p_target_table_id,
    v_source.id,v_target.id,v_full,v_created,p_actor_id,''
  ) returning * into v_op;
  insert into public.table_transfer_orders(operation_id,order_id,guest_session_id)
    select v_op.id,id,session_id from public.orders where id=any(p_order_ids) and restaurant_id=p_restaurant_id;
  if v_full then insert into public.table_transfer_shares(operation_id,share_id)
    select v_op.id,id from public.payment_shares where restaurant_id=p_restaurant_id and table_session_id=v_source.id and status<>'void'; end if;
  update public.orders set table_id=p_target_table_id,table_session_id=v_target.id,updated_at=now() where id=any(p_order_ids) and restaurant_id=p_restaurant_id;
  if v_full then
    update public.payment_shares set table_session_id=v_target.id,updated_at=now() where restaurant_id=p_restaurant_id and table_session_id=v_source.id and status<>'void';
    update public.service_requests set table_id=p_target_table_id,table_session_id=v_target.id where restaurant_id=p_restaurant_id and table_session_id=v_source.id and status='pending';
    update public.table_sessions set closed_at=now(),close_kind='transfer',close_reason=null,updated_at=now() where id=v_source.id;
  end if;
  update public.table_transfer_operations set financial_fingerprint=public.table_transfer_financial_fingerprint(v_op.id) where id=v_op.id;
  return jsonb_build_object('operationId',v_op.id,'idempotent',false);
end; $$;

revoke all on function public.move_table_session(uuid,uuid,uuid,uuid,uuid),
  public.transfer_table_orders(uuid,uuid,uuid,uuid[],uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.move_table_session(uuid,uuid,uuid,uuid,uuid),
  public.transfer_table_orders(uuid,uuid,uuid,uuid[],uuid,uuid)
  to service_role;
