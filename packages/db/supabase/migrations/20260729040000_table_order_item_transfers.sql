-- Atomic product/quantity transfers. Fully selected orders keep their identity;
-- partial selections split immutable order snapshots into a derived target order.

alter table public.table_transfer_operations
  drop constraint if exists table_transfer_operations_kind_check;
alter table public.table_transfer_operations
  add constraint table_transfer_operations_kind_check
  check (kind in ('table_move', 'account_transfer', 'item_transfer'));

create table public.table_transfer_item_splits (
  operation_id uuid not null references public.table_transfer_operations(id) on delete cascade,
  source_order_id uuid not null references public.orders(id),
  target_order_id uuid not null references public.orders(id),
  source_items_before jsonb not null,
  source_total_before numeric(12,2) not null,
  moved_quantity integer not null check (moved_quantity > 0),
  primary key (operation_id, source_order_id),
  unique (operation_id, target_order_id)
);

alter table public.table_transfer_item_splits enable row level security;
revoke all on public.table_transfer_item_splits from public, anon, authenticated;
grant all on public.table_transfer_item_splits to service_role;

create or replace function public.table_transfer_item_request_intent(
  p_source_table_id uuid,
  p_target_table_id uuid,
  p_selections jsonb
) returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'kind', 'item_transfer',
    'sourceTableId', p_source_table_id::text,
    'targetTableId', p_target_table_id::text,
    'selections', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'orderId', selection.order_id::text,
          'lineIndex', selection.line_index,
          'quantity', selection.quantity
        ) order by selection.order_id, selection.line_index
      )
      from (
        select distinct
          (entry->>'orderId')::uuid as order_id,
          (entry->>'lineIndex')::integer as line_index,
          (entry->>'quantity')::integer as quantity
        from jsonb_array_elements(coalesce(p_selections, '[]'::jsonb)) entry
      ) selection
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.table_transfer_item_request_intent(uuid,uuid,jsonb)
  from public, anon, authenticated;
grant execute on function public.table_transfer_item_request_intent(uuid,uuid,jsonb)
  to service_role;

create or replace function public.table_transfer_item_order_fingerprint(p_order_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select md5(concat_ws(
    ':', order_row.id, order_row.table_id, order_row.table_session_id,
    order_row.items::text, order_row.total, order_row.status, order_row.paid_at,
    order_row.payment_method, order_row.checkout_amount,
    order_row.checkout_reserved_until, order_row.checkout_reservation_id,
    order_row.deleted_at
  ))
  from public.orders order_row
  where order_row.id = p_order_id
$$;

revoke all on function public.table_transfer_item_order_fingerprint(uuid)
  from public, anon, authenticated;
grant execute on function public.table_transfer_item_order_fingerprint(uuid)
  to service_role;

create or replace function public.table_transfer_financial_fingerprint(p_operation_id uuid)
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select md5(
    coalesce((
      select string_agg(concat_ws(':', o.id, o.paid_at, o.payment_method, o.status = 'cancelled'), '|' order by o.id)
      from public.table_transfer_orders x join public.orders o on o.id = x.order_id
      where x.operation_id = p_operation_id
    ), '') || '#' || coalesce((
      select string_agg(concat_ws(':', ps.id, ps.amount, ps.method, ps.status, ps.checkout_amount,
        ps.checkout_reserved_until, exists(select 1 from public.payment_share_tokens pt where pt.share_id = ps.id)), '|' order by ps.id)
      from public.table_transfer_shares x join public.payment_shares ps on ps.id = x.share_id
      where x.operation_id = p_operation_id
    ), '') || '#' || coalesce((
      select string_agg(concat_ws(':', split.source_order_id,
        public.table_transfer_item_order_fingerprint(split.source_order_id),
        split.target_order_id,
        public.table_transfer_item_order_fingerprint(split.target_order_id)), '|' order by split.source_order_id)
      from public.table_transfer_item_splits split
      where split.operation_id = p_operation_id
    ), '') || '#' || coalesce((
      select string_agg(concat_ws(':', moved.order_id,
        public.table_transfer_item_order_fingerprint(moved.order_id)), '|' order by moved.order_id)
      from public.table_transfer_orders moved
      join public.table_transfer_operations operation on operation.id = moved.operation_id
      where moved.operation_id = p_operation_id and operation.kind = 'item_transfer'
    ), '')
  );
$$;

create or replace function public.transfer_table_order_items(
  p_restaurant_id uuid,
  p_source_table_id uuid,
  p_target_table_id uuid,
  p_selections jsonb,
  p_actor_id uuid,
  p_request_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_source public.table_sessions%rowtype;
  v_target public.table_sessions%rowtype;
  v_operation public.table_transfer_operations%rowtype;
  v_order public.orders%rowtype;
  v_target_order_id uuid;
  v_source_items jsonb;
  v_target_items jsonb;
  v_gross_before numeric(12,2);
  v_moved_total numeric(12,2);
  v_moved_quantity integer;
  v_source_closed boolean := false;
  v_target_created boolean := false;
  v_intent jsonb;
begin
  if p_request_id is null then
    raise exception 'Geçersiz istek kimliği' using errcode = '22023';
  end if;
  if p_source_table_id = p_target_table_id then
    raise exception 'Kaynak ve hedef masa aynı olamaz' using errcode = '22023';
  end if;
  if jsonb_typeof(p_selections) <> 'array'
     or jsonb_array_length(p_selections) = 0
     or jsonb_array_length(p_selections) > 500 then
    raise exception 'Geçerli ürün seçin' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_selections) entry
    where jsonb_typeof(entry) <> 'object'
       or not (entry ?& array['orderId','lineIndex','quantity'])
       or entry - array['orderId','lineIndex','quantity'] <> '{}'::jsonb
       or jsonb_typeof(entry->'orderId') <> 'string'
       or jsonb_typeof(entry->'lineIndex') <> 'number'
       or jsonb_typeof(entry->'quantity') <> 'number'
       or (entry->>'lineIndex')::integer < 0
       or (entry->>'quantity')::integer < 1
       or (entry->>'quantity')::integer > 99
  ) then
    raise exception 'Geçersiz ürün seçimi' using errcode = '22023';
  end if;

  create temporary table item_transfer_selection (
    order_id uuid not null,
    line_index integer not null,
    quantity integer not null,
    primary key (order_id, line_index)
  ) on commit drop;

  begin
    insert into item_transfer_selection(order_id, line_index, quantity)
    select (entry->>'orderId')::uuid, (entry->>'lineIndex')::integer, (entry->>'quantity')::integer
    from jsonb_array_elements(p_selections) entry;
  exception when unique_violation then
    raise exception 'Aynı ürün satırı birden fazla kez seçilemez' using errcode = '22023';
  end;

  v_intent := public.table_transfer_item_request_intent(
    p_source_table_id, p_target_table_id, p_selections
  );
  perform pg_advisory_xact_lock(hashtextextended(
    p_restaurant_id::text || ':' || p_request_id::text, 0
  ));
  select * into v_operation
  from public.table_transfer_operations
  where restaurant_id = p_restaurant_id and request_id = p_request_id
  for update;
  if found then
    if v_operation.request_intent <> v_intent then
      raise exception 'table_transfer_idempotency_conflict' using errcode = 'P0001';
    end if;
    return jsonb_build_object('operationId', v_operation.id, 'idempotent', true);
  end if;

  perform 1 from public.tables
  where restaurant_id = p_restaurant_id
    and id in (p_source_table_id, p_target_table_id)
    and deleted_at is null
  order by id for update;
  if (select count(*) from public.tables
      where restaurant_id = p_restaurant_id
        and id in (p_source_table_id, p_target_table_id)
        and deleted_at is null) <> 2 then
    raise exception 'Masa bulunamadı' using errcode = 'P0001';
  end if;

  select * into v_source from public.table_sessions
  where restaurant_id = p_restaurant_id and table_id = p_source_table_id and closed_at is null
  for update;
  if not found then raise exception 'Kaynak masada açık adisyon yok' using errcode = 'P0001'; end if;

  if exists (
    select 1 from public.payment_shares
    where restaurant_id = p_restaurant_id and table_session_id = v_source.id and status <> 'void'
  ) then
    raise exception 'Bölünmüş ödeme bulunan hesapta ürün bazlı taşıma yapılamaz' using errcode = 'P0001';
  end if;

  perform 1
  from public.orders selected_order
  where selected_order.id in (
    select selection.order_id from item_transfer_selection selection
  )
  order by selected_order.id
  for update;

  if exists (
    select 1
    from (select distinct order_id from item_transfer_selection) selection
    left join public.orders selected_order
      on selected_order.id = selection.order_id
      and selected_order.restaurant_id = p_restaurant_id
      and selected_order.table_session_id = v_source.id
      and selected_order.table_id = p_source_table_id
      and selected_order.deleted_at is null
      and selected_order.status <> 'cancelled'
    where selected_order.id is null
  ) then
    raise exception 'Seçimde taşınamayan sipariş var' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.orders selected_order
    join (select distinct order_id from item_transfer_selection) selection on selection.order_id = selected_order.id
    where selected_order.paid_at is not null
       or selected_order.payment_method is not null
       or selected_order.checkout_amount is not null
       or selected_order.checkout_reserved_until is not null
       or selected_order.checkout_reservation_id is not null
       or exists (select 1 from public.order_payment_tokens token where token.order_id = selected_order.id)
       or exists (select 1 from public.loyalty_transactions loyalty where loyalty.order_id = selected_order.id)
  ) then
    raise exception 'Ödeme veya sadakat hareketi bulunan sipariş ürün bazında taşınamaz' using errcode = 'P0001';
  end if;

  select * into v_target from public.table_sessions
  where restaurant_id = p_restaurant_id and table_id = p_target_table_id and closed_at is null
  for update;
  if not found then
    insert into public.table_sessions(restaurant_id, table_id)
    values (p_restaurant_id, p_target_table_id)
    returning * into v_target;
    v_target_created := true;
  end if;

  insert into public.table_transfer_operations(
    restaurant_id, request_id, request_intent, kind, source_table_id, target_table_id,
    source_session_id, target_session_id, source_session_closed, target_session_created,
    created_by, financial_fingerprint
  ) values (
    p_restaurant_id, p_request_id, v_intent, 'item_transfer', p_source_table_id, p_target_table_id,
    v_source.id, v_target.id, false, v_target_created, p_actor_id, ''
  ) returning * into v_operation;

  for v_order in
    select selected_order.*
    from public.orders selected_order
    join (select distinct order_id from item_transfer_selection) selection on selection.order_id = selected_order.id
    order by selected_order.id
  loop
    if jsonb_typeof(v_order.items) <> 'array' or jsonb_array_length(v_order.items) = 0 then
      raise exception 'Sipariş ürünleri doğrulanamadı' using errcode = 'P0001';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(v_order.items) with ordinality line(value, ordinal)
      where jsonb_typeof(line.value) <> 'object'
         or jsonb_typeof(line.value->'quantity') <> 'number'
         or jsonb_typeof(line.value->'price') <> 'number'
         or (line.value->>'quantity')::integer < 1
         or (line.value ? 'modifiersPriceDelta' and jsonb_typeof(line.value->'modifiersPriceDelta') <> 'number')
    ) then
      raise exception 'Sipariş ürünleri doğrulanamadı' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from item_transfer_selection selection
      where selection.order_id = v_order.id
        and (
          selection.line_index >= jsonb_array_length(v_order.items)
          or selection.quantity > (v_order.items->selection.line_index->>'quantity')::integer
        )
    ) then
      raise exception 'Seçilen ürün adedi artık geçerli değil' using errcode = 'P0001';
    end if;

    select round(coalesce(sum(
      ((line.value->>'price')::numeric + coalesce((line.value->>'modifiersPriceDelta')::numeric, 0))
      * (line.value->>'quantity')::integer
    ), 0), 2) into v_gross_before
    from jsonb_array_elements(v_order.items) line(value);
    if round(v_order.total, 2) <> v_gross_before then
      raise exception 'İndirim veya puan uygulanmış sipariş ürün bazında taşınamaz' using errcode = 'P0001';
    end if;

    select
      round(coalesce(sum(
        ((v_order.items->selection.line_index->>'price')::numeric
          + coalesce((v_order.items->selection.line_index->>'modifiersPriceDelta')::numeric, 0))
        * selection.quantity
      ), 0), 2),
      coalesce(sum(selection.quantity), 0)
    into v_moved_total, v_moved_quantity
    from item_transfer_selection selection
    where selection.order_id = v_order.id;

    select coalesce(jsonb_agg(
      case when selection.quantity is null then line.value
           else jsonb_set(line.value, '{quantity}', to_jsonb((line.value->>'quantity')::integer - selection.quantity), true)
      end order by line.ordinal
    ) filter (where selection.quantity is null or selection.quantity < (line.value->>'quantity')::integer), '[]'::jsonb)
    into v_source_items
    from jsonb_array_elements(v_order.items) with ordinality line(value, ordinal)
    left join item_transfer_selection selection
      on selection.order_id = v_order.id and selection.line_index = line.ordinal - 1;

    select jsonb_agg(
      jsonb_set(v_order.items->selection.line_index, '{quantity}', to_jsonb(selection.quantity), true)
      order by selection.line_index
    ) into v_target_items
    from item_transfer_selection selection
    where selection.order_id = v_order.id;

    if jsonb_array_length(v_source_items) = 0 then
      update public.orders
      set table_id = p_target_table_id, table_session_id = v_target.id, updated_at = now()
      where id = v_order.id;
      insert into public.table_transfer_orders(operation_id, order_id, guest_session_id)
      values (v_operation.id, v_order.id, v_order.session_id);
    else
      update public.orders
      set items = v_source_items, total = round(v_order.total - v_moved_total, 2), updated_at = now()
      where id = v_order.id;

      insert into public.orders(
        restaurant_id, table_id, table_session_id, session_id, source,
        customer_id, customer_tier, status, items, total,
        sent_to_kitchen_at, ready_at, served_at
      ) values (
        p_restaurant_id, p_target_table_id, v_target.id, v_order.session_id, 'staff',
        v_order.customer_id, v_order.customer_tier, v_order.status, v_target_items, v_moved_total,
        v_order.sent_to_kitchen_at, v_order.ready_at, v_order.served_at
      ) returning id into v_target_order_id;

      insert into public.table_transfer_item_splits(
        operation_id, source_order_id, target_order_id,
        source_items_before, source_total_before, moved_quantity
      ) values (
        v_operation.id, v_order.id, v_target_order_id,
        v_order.items, v_order.total, v_moved_quantity
      );
    end if;
  end loop;

  if not exists (
    select 1 from public.orders
    where restaurant_id = p_restaurant_id and table_session_id = v_source.id
      and deleted_at is null and status <> 'cancelled'
  ) then
    v_source_closed := true;
    update public.service_requests
    set table_id = p_target_table_id, table_session_id = v_target.id
    where restaurant_id = p_restaurant_id and table_session_id = v_source.id and status = 'pending';
    update public.table_sessions
    set closed_at = now(), close_kind = 'transfer', close_reason = null, updated_at = now()
    where id = v_source.id;
  end if;

  update public.table_transfer_operations
  set source_session_closed = v_source_closed,
      financial_fingerprint = public.table_transfer_financial_fingerprint(v_operation.id)
  where id = v_operation.id;
  return jsonb_build_object('operationId', v_operation.id, 'idempotent', false);
end;
$$;

create or replace function public.undo_table_transfer(
  p_restaurant_id uuid,
  p_operation_id uuid,
  p_actor_id uuid
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_op public.table_transfer_operations%rowtype;
  v_reason text;
  v_split public.table_transfer_item_splits%rowtype;
begin
  select * into v_op from public.table_transfer_operations
  where id = p_operation_id and restaurant_id = p_restaurant_id for update;
  if not found then raise exception 'Taşıma işlemi bulunamadı'; end if;
  if v_op.status = 'undone' then return jsonb_build_object('operationId',v_op.id,'idempotent',true); end if;
  if v_op.status <> 'active' then raise exception '%',coalesce(v_op.lock_reason,'Bu işlem geri alınamaz'); end if;
  perform 1 from public.tables where id in(v_op.source_table_id,v_op.target_table_id) order by id for update;
  perform 1 from public.table_sessions where id in(v_op.source_session_id,v_op.target_session_id) order by id for update;
  perform 1 from public.orders where id in(
    select order_id from public.table_transfer_orders where operation_id = v_op.id
    union select source_order_id from public.table_transfer_item_splits where operation_id = v_op.id
    union select target_order_id from public.table_transfer_item_splits where operation_id = v_op.id
  ) order by id for update;
  perform 1 from public.payment_shares where id in(select share_id from public.table_transfer_shares where operation_id=v_op.id) order by id for update;
  if public.table_transfer_financial_fingerprint(v_op.id) <> v_op.financial_fingerprint then
    v_reason := 'Taşımadan sonra ödeme, ürün veya sipariş durumu değişti';
  end if;
  if v_reason is null and exists(
    with current_orders as (
      select order_id from public.table_transfer_orders where operation_id = v_op.id
      union select source_order_id from public.table_transfer_item_splits where operation_id = v_op.id
      union select target_order_id from public.table_transfer_item_splits where operation_id = v_op.id
    ), later_orders as (
      select moved.order_id, operation.created_at
      from public.table_transfer_orders moved join public.table_transfer_operations operation on operation.id = moved.operation_id
      where operation.status = 'active'
      union all
      select split.source_order_id, operation.created_at
      from public.table_transfer_item_splits split join public.table_transfer_operations operation on operation.id = split.operation_id
      where operation.status = 'active'
      union all
      select split.target_order_id, operation.created_at
      from public.table_transfer_item_splits split join public.table_transfer_operations operation on operation.id = split.operation_id
      where operation.status = 'active'
    )
    select 1 from current_orders current_order join later_orders later on later.order_id = current_order.order_id
    where later.created_at > v_op.created_at
  ) then
    v_reason := 'Ürünler daha sonra başka bir taşıma işlemine dahil edildi';
  end if;
  if v_reason is null and exists(select 1 from public.table_sessions where restaurant_id=p_restaurant_id and table_id=v_op.source_table_id and closed_at is null and id<>v_op.source_session_id) then v_reason:='Kaynak masa yeniden kullanılıyor'; end if;
  if v_reason is null and v_op.kind in ('account_transfer','item_transfer') and not exists(select 1 from public.table_sessions where id=v_op.target_session_id and closed_at is null) then v_reason:='Hedef adisyon artık açık değil'; end if;
  if v_reason is null and v_op.kind in ('account_transfer','item_transfer') and not v_op.source_session_closed and not exists(select 1 from public.table_sessions where id=v_op.source_session_id and closed_at is null) then v_reason:='Kaynak adisyon artık açık değil'; end if;
  if v_reason is not null then
    update public.table_transfer_operations set status='locked',lock_reason=v_reason where id=v_op.id;
    return jsonb_build_object('operationId',v_op.id,'idempotent',false,'error',v_reason);
  end if;
  if v_op.kind='table_move' then
    if not exists(select 1 from public.table_sessions where id=v_op.source_session_id and table_id=v_op.target_table_id and closed_at is null) then raise exception 'Taşınan adisyon artık hedef masada açık değil'; end if;
    update public.table_sessions set table_id=v_op.source_table_id,updated_at=now() where id=v_op.source_session_id;
    update public.orders set table_id=v_op.source_table_id,updated_at=now() where table_session_id=v_op.source_session_id and restaurant_id=p_restaurant_id;
    update public.service_requests set table_id=v_op.source_table_id where table_session_id=v_op.source_session_id and restaurant_id=p_restaurant_id and status='pending';
  else
    if v_op.source_session_closed then update public.table_sessions set closed_at=null,close_kind='normal',close_reason=null,updated_at=now() where id=v_op.source_session_id; end if;
    update public.orders o set table_id=v_op.source_table_id,table_session_id=v_op.source_session_id,updated_at=now() from public.table_transfer_orders x where x.operation_id=v_op.id and x.order_id=o.id;
    update public.payment_shares ps set table_session_id=v_op.source_session_id,updated_at=now() from public.table_transfer_shares x where x.operation_id=v_op.id and x.share_id=ps.id;
    if v_op.kind = 'item_transfer' then
      for v_split in select * from public.table_transfer_item_splits where operation_id = v_op.id order by source_order_id
      loop
        update public.orders
        set items = v_split.source_items_before, total = v_split.source_total_before, updated_at = now()
        where id = v_split.source_order_id;
        update public.orders
        set status = 'cancelled', deleted_at = now(), cancel_reason = 'Ürün taşıma geri alındı',
            cancelled_by = p_actor_id, updated_at = now()
        where id = v_split.target_order_id;
      end loop;
    end if;
    update public.service_requests set table_id=v_op.source_table_id,table_session_id=v_op.source_session_id where table_session_id=v_op.target_session_id and restaurant_id=p_restaurant_id and status='pending' and v_op.source_session_closed;
    if v_op.target_session_created and not exists(select 1 from public.orders where table_session_id=v_op.target_session_id and deleted_at is null and status<>'cancelled') then update public.table_sessions set closed_at=now(),close_kind='transfer',updated_at=now() where id=v_op.target_session_id; end if;
  end if;
  update public.table_transfer_operations set status='undone',undone_by=p_actor_id,undone_at=now() where id=v_op.id;
  return jsonb_build_object('operationId',v_op.id,'idempotent',false);
end;
$$;

drop function if exists public.list_table_transfer_history(uuid, integer);
create function public.list_table_transfer_history(p_restaurant_id uuid,p_limit integer default 50)
returns table(id uuid,kind text,source_table_id uuid,target_table_id uuid,source_session_id uuid,target_session_id uuid,status text,request_id uuid,source_session_closed boolean,target_session_created boolean,created_by uuid,created_at timestamptz,undone_by uuid,undone_at timestamptz,lock_reason text,order_count bigint)
language sql stable security definer set search_path=public,pg_temp as $$
  select operation.id,operation.kind,operation.source_table_id,operation.target_table_id,
    operation.source_session_id,operation.target_session_id,operation.status,operation.request_id,
    operation.source_session_closed,operation.target_session_created,operation.created_by,
    operation.created_at,operation.undone_by,operation.undone_at,operation.lock_reason,
    (select count(*) from public.table_transfer_orders moved where moved.operation_id=operation.id)
      + (select count(*) from public.table_transfer_item_splits split where split.operation_id=operation.id)
  from public.table_transfer_operations operation
  where operation.restaurant_id=p_restaurant_id
  order by operation.created_at desc
  limit least(greatest(p_limit,1),100)
$$;

revoke all on function public.transfer_table_order_items(uuid,uuid,uuid,jsonb,uuid,uuid),
  public.undo_table_transfer(uuid,uuid,uuid), public.list_table_transfer_history(uuid,integer)
  from public, anon, authenticated;
grant execute on function public.transfer_table_order_items(uuid,uuid,uuid,jsonb,uuid,uuid),
  public.undo_table_transfer(uuid,uuid,uuid), public.list_table_transfer_history(uuid,integer)
  to service_role;
