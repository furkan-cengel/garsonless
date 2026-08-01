-- Analytics must never project impossible monetary values or object-shaped
-- item snapshots. Abort on legacy violations so operators can reconcile the
-- business data explicitly; do not silently rewrite financial history.

do $$
begin
  if exists (
    select 1
    from public.orders
    where total < 0 or total = 'NaN'::numeric
  ) then
    raise exception using
      errcode = '23514',
      message = 'orders contains negative or NaN totals; reconcile legacy rows before applying analytics guards';
  end if;

  if exists (
    select 1
    from public.orders
    where jsonb_typeof(items) <> 'array'
  ) then
    raise exception using
      errcode = '23514',
      message = 'orders contains non-array items; reconcile legacy rows before applying analytics guards';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_total_finite_nonnegative_check'
  ) then
    alter table public.orders
      add constraint orders_total_finite_nonnegative_check
      check (total >= 0 and total <> 'NaN'::numeric) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_items_array_check'
  ) then
    alter table public.orders
      add constraint orders_items_array_check
      check (jsonb_typeof(items) = 'array') not valid;
  end if;
end;
$$;

alter table public.orders validate constraint orders_total_finite_nonnegative_check;
alter table public.orders validate constraint orders_items_array_check;

comment on constraint orders_total_finite_nonnegative_check on public.orders is
  'Rejects negative and PostgreSQL numeric NaN totals before financial reporting.';
comment on constraint orders_items_array_check on public.orders is
  'Keeps order item snapshots array-shaped for deterministic product allocation.';
