-- Atomic table/account transfers with permanent audit and conflict-safe undo.

alter table public.table_sessions
  add column if not exists close_kind text not null default 'normal'
  check (close_kind in ('normal', 'abnormal', 'transfer'));

update public.table_sessions
set close_kind = 'abnormal'
where closed_at is not null and close_reason is not null and close_kind = 'normal';

create table public.table_transfer_operations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  request_id uuid not null,
  kind text not null check (kind in ('table_move', 'account_transfer')),
  source_table_id uuid not null references public.tables(id),
  target_table_id uuid not null references public.tables(id),
  source_session_id uuid not null references public.table_sessions(id),
  target_session_id uuid not null references public.table_sessions(id),
  source_session_closed boolean not null default false,
  target_session_created boolean not null default false,
  financial_fingerprint text not null,
  status text not null default 'active' check (status in ('active', 'undone', 'locked')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  undone_by uuid references auth.users(id),
  undone_at timestamptz,
  lock_reason text
);

create unique index table_transfer_request_uidx
  on public.table_transfer_operations(restaurant_id, request_id);
create index table_transfer_history_idx
  on public.table_transfer_operations(restaurant_id, created_at desc);

create table public.table_transfer_orders (
  operation_id uuid not null references public.table_transfer_operations(id) on delete cascade,
  order_id uuid not null references public.orders(id),
  guest_session_id text,
  primary key (operation_id, order_id)
);

create table public.table_transfer_shares (
  operation_id uuid not null references public.table_transfer_operations(id) on delete cascade,
  share_id uuid not null references public.payment_shares(id),
  primary key (operation_id, share_id)
);

alter table public.table_transfer_operations enable row level security;
alter table public.table_transfer_orders enable row level security;
alter table public.table_transfer_shares enable row level security;
revoke all on public.table_transfer_operations, public.table_transfer_orders, public.table_transfer_shares from public, anon, authenticated;
grant all on public.table_transfer_operations, public.table_transfer_orders, public.table_transfer_shares to service_role;

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
    ), '')
  );
$$;
revoke all on function public.table_transfer_financial_fingerprint(uuid) from public, anon, authenticated;
grant execute on function public.table_transfer_financial_fingerprint(uuid) to service_role;

create or replace function public.move_table_session(
  p_restaurant_id uuid, p_source_table_id uuid, p_target_table_id uuid,
  p_actor_id uuid, p_request_id uuid
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_source public.table_sessions%rowtype; v_op public.table_transfer_operations%rowtype;
begin
  select * into v_op from public.table_transfer_operations where restaurant_id=p_restaurant_id and request_id=p_request_id;
  if found then return jsonb_build_object('operationId',v_op.id,'idempotent',true); end if;
  if p_source_table_id = p_target_table_id then raise exception 'Kaynak ve hedef masa aynı olamaz'; end if;
  perform 1 from public.tables where restaurant_id=p_restaurant_id and id in (p_source_table_id,p_target_table_id) and deleted_at is null order by id for update;
  if (select count(*) from public.tables where restaurant_id=p_restaurant_id and id in (p_source_table_id,p_target_table_id) and deleted_at is null) <> 2 then raise exception 'Masa bulunamadı'; end if;
  select * into v_source from public.table_sessions where restaurant_id=p_restaurant_id and table_id=p_source_table_id and closed_at is null for update;
  if not found then raise exception 'Kaynak masada açık adisyon yok'; end if;
  if exists(select 1 from public.table_sessions where restaurant_id=p_restaurant_id and table_id=p_target_table_id and closed_at is null) then raise exception 'Hedef masa boş olmalı'; end if;
  insert into public.table_transfer_operations(restaurant_id,request_id,kind,source_table_id,target_table_id,source_session_id,target_session_id,created_by,financial_fingerprint)
  values(p_restaurant_id,p_request_id,'table_move',p_source_table_id,p_target_table_id,v_source.id,v_source.id,p_actor_id,'') returning * into v_op;
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
declare v_source public.table_sessions%rowtype; v_target public.table_sessions%rowtype; v_op public.table_transfer_operations%rowtype;
  v_active uuid[]; v_full boolean; v_created boolean := false;
begin
  select * into v_op from public.table_transfer_operations where restaurant_id=p_restaurant_id and request_id=p_request_id;
  if found then return jsonb_build_object('operationId',v_op.id,'idempotent',true); end if;
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
  insert into public.table_transfer_operations(restaurant_id,request_id,kind,source_table_id,target_table_id,source_session_id,target_session_id,source_session_closed,target_session_created,created_by,financial_fingerprint)
  values(p_restaurant_id,p_request_id,'account_transfer',p_source_table_id,p_target_table_id,v_source.id,v_target.id,v_full,v_created,p_actor_id,'') returning * into v_op;
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

create or replace function public.undo_table_transfer(p_restaurant_id uuid,p_operation_id uuid,p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_op public.table_transfer_operations%rowtype; v_reason text;
begin
  select * into v_op from public.table_transfer_operations where id=p_operation_id and restaurant_id=p_restaurant_id for update;
  if not found then raise exception 'Taşıma işlemi bulunamadı'; end if;
  if v_op.status='undone' then return jsonb_build_object('operationId',v_op.id,'idempotent',true); end if;
  if v_op.status<>'active' then raise exception '%',coalesce(v_op.lock_reason,'Bu işlem geri alınamaz'); end if;
  perform 1 from public.tables where id in(v_op.source_table_id,v_op.target_table_id) order by id for update;
  perform 1 from public.table_sessions where id in(v_op.source_session_id,v_op.target_session_id) order by id for update;
  perform 1 from public.orders where id in(select order_id from public.table_transfer_orders where operation_id=v_op.id) order by id for update;
  perform 1 from public.payment_shares where id in(select share_id from public.table_transfer_shares where operation_id=v_op.id) order by id for update;
  if public.table_transfer_financial_fingerprint(v_op.id)<>v_op.financial_fingerprint then v_reason:='Taşımadan sonra ödeme veya iptal değişikliği oluştu'; end if;
  if v_reason is null and exists(select 1 from public.table_transfer_orders x join public.table_transfer_orders y on y.order_id=x.order_id join public.table_transfer_operations o on o.id=y.operation_id where x.operation_id=v_op.id and o.created_at>v_op.created_at and o.status='active') then v_reason:='Siparişler daha sonra başka bir taşıma işlemine dahil edildi'; end if;
  if v_reason is null and exists(select 1 from public.table_sessions where restaurant_id=p_restaurant_id and table_id=v_op.source_table_id and closed_at is null and id<>v_op.source_session_id) then v_reason:='Kaynak masa yeniden kullanılıyor'; end if;
  if v_reason is null and v_op.kind='account_transfer' and not exists(select 1 from public.table_sessions where id=v_op.target_session_id and closed_at is null) then v_reason:='Hedef adisyon artık açık değil'; end if;
  if v_reason is null and v_op.kind='account_transfer' and not v_op.source_session_closed and not exists(select 1 from public.table_sessions where id=v_op.source_session_id and closed_at is null) then v_reason:='Kaynak adisyon artık açık değil'; end if;
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
    update public.service_requests set table_id=v_op.source_table_id,table_session_id=v_op.source_session_id where table_session_id=v_op.target_session_id and restaurant_id=p_restaurant_id and status='pending' and v_op.source_session_closed;
    if v_op.target_session_created and not exists(select 1 from public.orders where table_session_id=v_op.target_session_id and deleted_at is null) then update public.table_sessions set closed_at=now(),close_kind='transfer',updated_at=now() where id=v_op.target_session_id; end if;
  end if;
  update public.table_transfer_operations set status='undone',undone_by=p_actor_id,undone_at=now() where id=v_op.id;
  return jsonb_build_object('operationId',v_op.id,'idempotent',false);
end; $$;

create or replace function public.list_table_transfer_history(p_restaurant_id uuid,p_limit integer default 50)
returns table(id uuid,kind text,source_table_id uuid,target_table_id uuid,source_session_id uuid,target_session_id uuid,status text,created_by uuid,created_at timestamptz,undone_at timestamptz,lock_reason text,order_count bigint)
language sql stable security definer set search_path=public,pg_temp as $$
 select o.id,o.kind,o.source_table_id,o.target_table_id,o.source_session_id,o.target_session_id,o.status,o.created_by,o.created_at,o.undone_at,o.lock_reason,count(x.order_id)
 from public.table_transfer_operations o left join public.table_transfer_orders x on x.operation_id=o.id
 where o.restaurant_id=p_restaurant_id group by o.id order by o.created_at desc limit least(greatest(p_limit,1),100)
$$;

create or replace function public.resolve_guest_transfer(p_restaurant_id uuid,p_source_table_id uuid,p_guest_session_id text)
returns uuid language sql stable security definer set search_path=public,pg_temp as $$
  select o.target_table_id
  from public.table_transfer_operations o
  join public.table_transfer_orders x on x.operation_id=o.id
  join public.orders ord on ord.id=x.order_id
  join public.table_sessions ts on ts.id=ord.table_session_id and ts.closed_at is null
  where o.restaurant_id=p_restaurant_id and o.source_table_id=p_source_table_id
    and o.status='active' and x.guest_session_id=p_guest_session_id
  order by o.created_at desc limit 1
$$;

revoke all on function public.move_table_session(uuid,uuid,uuid,uuid,uuid), public.transfer_table_orders(uuid,uuid,uuid,uuid[],uuid,uuid), public.undo_table_transfer(uuid,uuid,uuid), public.list_table_transfer_history(uuid,integer) from public,anon,authenticated;
grant execute on function public.move_table_session(uuid,uuid,uuid,uuid,uuid), public.transfer_table_orders(uuid,uuid,uuid,uuid[],uuid,uuid), public.undo_table_transfer(uuid,uuid,uuid), public.list_table_transfer_history(uuid,integer) to service_role;
revoke all on function public.resolve_guest_transfer(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.resolve_guest_transfer(uuid,uuid,text) to service_role;

-- Transfer closures are operational moves, not completed visits/outbox closes.
create or replace function public.outbox_table_sessions_after_update() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if old.closed_at is null and new.closed_at is not null and new.close_kind <> 'transfer' then
    perform public.enqueue_domain_outbox_event(new.restaurant_id,'table_session',new.id,'table_session.closed',jsonb_build_object('tableId',new.table_id,'closedAt',new.closed_at,'closeReason',new.close_reason),'table_session.closed:'||new.id::text||':'||new.closed_at::text);
  end if; return new;
end; $$;
