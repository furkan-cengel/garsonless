-- Recipe inventory: private costs, append-only journal, tenant-scoped commands.
create table public.inventory_settings (
 restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
 enabled boolean not null default false, started_at timestamptz, updated_at timestamptz not null default now()
);
create table public.inventory_items (
 id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.restaurants(id) on delete cascade,
 name text not null check(length(name) between 1 and 160), kind text not null check(kind in ('raw','finished','prepared')),
 unit text not null check(unit in ('g','ml','adet')), category text not null default '', shelf text not null default '',
 threshold numeric(20,6) not null default 0 check(threshold>=0), conversions jsonb not null default '{}', archived boolean not null default false,
 quantity numeric(20,6) not null default 0, cost numeric(24,6) check(cost>=0), version bigint not null default 0,
 unique(restaurant_id,id)
);
create table public.inventory_recipes (
 id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.restaurants(id) on delete cascade,
 menu_item_id uuid, output_item_id uuid, output_quantity numeric(20,6) not null default 1 check(output_quantity>0),
 mode text not null check(mode in ('none','direct','recipe')), version integer not null, lines jsonb not null,
 active boolean not null default true, created_at timestamptz not null default now(),
 check(num_nonnulls(menu_item_id,output_item_id)=1), foreign key(restaurant_id,output_item_id) references public.inventory_items(restaurant_id,id)
);
create unique index inventory_menu_recipe on public.inventory_recipes(restaurant_id,menu_item_id) where active;
create unique index inventory_output_recipe on public.inventory_recipes(restaurant_id,output_item_id) where active;
create table public.inventory_documents (
 id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.restaurants(id) on delete cascade,
 request_id text not null, payload jsonb not null, kind text not null, reason text not null default '',
 actor_id uuid, actor_label text not null default 'Sistem', order_id uuid, created_at timestamptz not null default clock_timestamp(),
 unique(restaurant_id,request_id), unique(restaurant_id,id)
);
create table public.inventory_movements (
 id uuid primary key default gen_random_uuid(), restaurant_id uuid not null, document_id uuid not null, item_id uuid not null,
 quantity numeric(20,6) not null, cost numeric(24,6), reversal_of uuid references public.inventory_movements(id),
 created_at timestamptz not null default clock_timestamp(),
 foreign key(restaurant_id,document_id) references public.inventory_documents(restaurant_id,id),
 foreign key(restaurant_id,item_id) references public.inventory_items(restaurant_id,id)
);
create index inventory_movement_history on public.inventory_movements(restaurant_id,created_at desc,id);
create table public.inventory_counts (
 id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.restaurants(id) on delete cascade,
 version integer not null default 1, status text not null default 'draft' check(status in ('draft','approved')), lines jsonb not null,
 created_at timestamptz not null default now(), document_id uuid references public.inventory_documents(id)
);
-- One origin survives a split; allocations live on the current order, never on array indexes.
create table public.inventory_order_lines (
 restaurant_id uuid not null references public.restaurants(id), order_id uuid not null references public.orders(id) on delete cascade,
 line_id uuid not null, quantity numeric(20,6) not null, recipe_id uuid references public.inventory_recipes(id),
 requirements jsonb not null, consumed boolean not null default false, prepared boolean not null default false,
 cancelled boolean not null default false, returned jsonb not null default '{}', costs jsonb not null default '{}',
 primary key(order_id,line_id)
);
create index inventory_order_origin on public.inventory_order_lines(restaurant_id,line_id);
create table public.inventory_requests (
 restaurant_id uuid not null references public.restaurants(id) on delete cascade, request_id uuid not null,
 payload jsonb not null, result jsonb not null, primary key(restaurant_id,request_id)
);

create function public.inventory_allowed(p_restaurant uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.restaurants r join lateral (
 select s.* from public.billing_subscriptions s where s.restaurant_id=r.id and s.status<>'cancelled' order by s.created_at desc limit 1
 ) s on true where r.id=p_restaurant and r.deleted_at is null and r.plan::text in ('pro','business')
 and (s.status in ('active','past_due','grace_period') or (s.status='trial' and s.trial_ends_at>clock_timestamp())));
$$;
create function public.inventory_actor(p_restaurant uuid,p_actor uuid,p_owner boolean default false) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.restaurants r where r.id=p_restaurant and r.deleted_at is null and (
 r.owner_id=p_actor or (not p_owner and exists(select 1 from public.restaurant_members m where m.restaurant_id=r.id and m.user_id=p_actor and m.status='active' and m.permissions ? 'inventory'))
 or exists(select 1 from public.organization_restaurants link join public.organizations o on o.id=link.organization_id and o.status='active'
 join public.organization_members m on m.organization_id=o.id and m.status='active' where link.restaurant_id=r.id and m.user_id=p_actor
 and (m.role in ('owner','admin') or (not p_owner and m.permissions ? 'inventory')))));
$$;
create function public.inventory_immutable() returns trigger language plpgsql set search_path=public,pg_temp as $$
 begin raise exception 'inventory_journal_immutable' using errcode='23514'; end $$;
create trigger inventory_movements_immutable before update or delete on public.inventory_movements for each row execute function public.inventory_immutable();
create trigger inventory_documents_immutable before update or delete on public.inventory_documents for each row execute function public.inventory_immutable();

-- All callers hold the tenant inventory lock; item locks are acquired in sorted order.
create function public.inventory_post(p_restaurant uuid,p_document uuid,p_item uuid,p_quantity numeric,p_cost numeric default null,p_reversal uuid default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.inventory_items%rowtype; c numeric; mid uuid; old_weight numeric;
begin
 select * into strict i from public.inventory_items where restaurant_id=p_restaurant and id=p_item for update;
 if p_quantity is null or p_quantity::text in ('NaN','Infinity','-Infinity') or (p_cost is not null and (p_cost<0 or p_cost::text in ('NaN','Infinity','-Infinity'))) then raise exception 'invalid_request'; end if;
 c:=case when p_quantity>=0 then p_cost else i.cost end;
 if p_reversal is not null then
   select m.cost into c from public.inventory_movements m where m.id=p_reversal and m.restaurant_id=p_restaurant and m.item_id=p_item;
   if not found then raise exception 'not_found'; end if;
 end if;
 insert into public.inventory_movements(restaurant_id,document_id,item_id,quantity,cost,reversal_of) values(p_restaurant,p_document,p_item,p_quantity,c,p_reversal) returning id into mid;
 old_weight:=greatest(i.quantity,0);
 update public.inventory_items set quantity=quantity+p_quantity, version=version+1,
 cost=case when p_quantity=0 then coalesce(p_cost,cost) when p_quantity>0 then
   case when c is null or (old_weight>0 and i.cost is null) then null
   else round((old_weight*coalesce(i.cost,0)+p_quantity*c)/(old_weight+p_quantity),6) end
 else cost end where id=p_item;
 return mid;
end $$;

create function public.inventory_decimal(p text,p_signed boolean default false) returns numeric language plpgsql immutable set search_path=public,pg_temp as $$
begin
 if p is null or p !~ (case when p_signed then '^-?[0-9]{1,12}(\.[0-9]{1,6})?$' else '^[0-9]{1,12}(\.[0-9]{1,6})?$' end) then raise exception 'invalid_request'; end if;
 return p::numeric;
end $$;

create function public.inventory_snapshot(p_restaurant uuid,p_offset integer default 0,p_as_of timestamptz default clock_timestamp()) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object(
 'asOf',p_as_of,
 'enabled',coalesce((select enabled from public.inventory_settings where restaurant_id=p_restaurant),false),
 'startedAt',(select started_at from public.inventory_settings where restaurant_id=p_restaurant),
 'legacyOpenOrders',(select count(*) from public.orders o where o.restaurant_id=p_restaurant and o.deleted_at is null and o.status::text not in ('served','cancelled') and not exists(select 1 from public.inventory_order_lines l where l.order_id=o.id)),
 'items',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'kind',kind,'unit',unit,'category',category,'shelf',shelf,'threshold',threshold::text,'quantity',quantity::text,'cost',cost::text,'version',version::text,'archived',archived,'conversions',conversions) order by category,shelf,name),'[]') from public.inventory_items where restaurant_id=p_restaurant),
 'recipes',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'menuItemId',menu_item_id,'outputItemId',output_item_id,'outputQuantity',output_quantity::text,'mode',mode,'version',version,'lines',lines)),'[]') from public.inventory_recipes where restaurant_id=p_restaurant and active),
 'menuItems',(select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'ingredients',i.ingredients,'modifiers',i.modifier_groups) order by i.name),'[]') from public.menu_items i join public.menu_categories c on c.id=i.category_id where c.restaurant_id=p_restaurant and c.deleted_at is null and i.deleted_at is null),
 'counts',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'version',version,'status',status,'lines',lines,'createdAt',created_at) order by created_at desc),'[]') from (select * from public.inventory_counts where restaurant_id=p_restaurant order by created_at desc limit 100) c),
 'movements',(select coalesce(jsonb_agg(row_to_json(m)),'[]') from (
 select m.id,m.document_id as "documentId",m.item_id as "itemId",i.name,m.quantity::text,m.cost::text,d.kind,d.reason,d.actor_label as actor,m.created_at as "createdAt",d.order_id as "orderId",m.reversal_of as "reversalOf"
 from public.inventory_movements m join public.inventory_documents d on d.id=m.document_id join public.inventory_items i on i.id=m.item_id where m.restaurant_id=p_restaurant and m.created_at<=p_as_of order by m.created_at desc,m.id desc limit 100 offset greatest(p_offset,0)) m),
 'summary',(select coalesce(jsonb_agg(row_to_json(t)),'[]') from (select m.item_id as "itemId",d.kind,sum(m.quantity)::text quantity,case when bool_or(m.cost is null) then null else sum(abs(m.quantity)*m.cost)::text end value from public.inventory_movements m join public.inventory_documents d on d.id=m.document_id where m.restaurant_id=p_restaurant group by m.item_id,d.kind) t),
 'movementOffset',p_offset,'hasMore',(select count(*)>p_offset+100 from public.inventory_movements where restaurant_id=p_restaurant and created_at<=p_as_of),
 'cancelledWaste',(select coalesce(jsonb_agg(row_to_json(w)),'[]') from (
 select l.order_id as "orderId",i.id as "itemId",i.name,sum((r.value::text)::numeric*l.quantity)::text quantity,
 sum(coalesce((l.returned->>i.id::text)::numeric,0))::text returned
 from public.inventory_order_lines l cross join lateral jsonb_each(l.requirements) r join public.inventory_items i on i.id=r.key::uuid
 where l.restaurant_id=p_restaurant and l.consumed and l.prepared and l.cancelled and l.quantity>0 group by l.order_id,i.id,i.name) w)
 );
$$;

-- Costs and recipes are never in an anonymous/public projection.
do $$ declare t text; begin
 foreach t in array array['inventory_settings','inventory_items','inventory_recipes','inventory_documents','inventory_movements','inventory_counts','inventory_order_lines','inventory_requests'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy inventory_member_read on public.%I for select to authenticated using (public.dashboard_session_is_verified() and public.has_restaurant_section(restaurant_id,''inventory'') and public.inventory_allowed(restaurant_id))',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
