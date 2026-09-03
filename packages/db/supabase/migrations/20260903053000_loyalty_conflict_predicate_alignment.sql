-- The refund-aware loyalty index only covers non-refund ledger rows. The
-- active redemption functions still inferred the predecessor predicate, so
-- PostgreSQL could not match their ON CONFLICT clauses to a unique index and
-- raised 42P10 before either redemption insert could run.

begin;

do $loyalty_conflict_fix$
declare
  v_function regprocedure;
  v_definition text;
  v_patched_definition text;
  v_index_definition text;
  v_actual_matches integer;
  v_old_predicate constant text :=
    'on conflict (order_id, type, direction) where order_id is not null do nothing';
  v_new_predicate constant text :=
    'on conflict (order_id, type, direction) where order_id is not null and refund_id is null do nothing';
  v_expected_matches constant integer := 2;
begin
  select pg_get_indexdef(index_row.indexrelid)
    into v_index_definition
    from pg_index index_row
   where index_row.indexrelid = to_regclass('public.loyalty_tx_order_type_dir_uniq')
     and index_row.indisunique;

  if v_index_definition is null
     or position('(order_id, type, direction)' in lower(v_index_definition)) = 0
     or position('order_id is not null' in lower(v_index_definition)) = 0
     or position('refund_id is null' in lower(v_index_definition)) = 0 then
    raise exception 'loyalty conflict target index has an unexpected definition'
      using errcode = '55000';
  end if;

  foreach v_function in array array[
    'public.redeem_loyalty(uuid,uuid,uuid,uuid,integer,integer,integer,boolean)'::regprocedure,
    'public.finalize_order_discount(uuid,uuid,uuid,uuid,numeric,integer,integer,integer,integer,numeric,text,integer,numeric,text,uuid,timestamptz,numeric,numeric,numeric,numeric)'::regprocedure
  ]
  loop
    select pg_get_functiondef(v_function) into strict v_definition;
    v_actual_matches := (
      char_length(v_definition) - char_length(replace(v_definition, v_old_predicate, ''))
    ) / char_length(v_old_predicate);

    if v_actual_matches <> v_expected_matches then
      raise exception 'unexpected ON CONFLICT shape in %: expected %, found %',
        v_function, v_expected_matches, v_actual_matches
        using errcode = '55000';
    end if;

    v_patched_definition := replace(v_definition, v_old_predicate, v_new_predicate);
    execute v_patched_definition;

    select pg_get_functiondef(v_function) into strict v_definition;
    if position(v_old_predicate in v_definition) > 0 then
      raise exception 'legacy ON CONFLICT predicate remains in %', v_function
        using errcode = '55000';
    end if;
    v_actual_matches := (
      char_length(v_definition) - char_length(replace(v_definition, v_new_predicate, ''))
    ) / char_length(v_new_predicate);
    if v_actual_matches <> v_expected_matches then
      raise exception 'patched ON CONFLICT shape is incomplete in %', v_function
        using errcode = '55000';
    end if;
  end loop;
end;
$loyalty_conflict_fix$;

comment on function public.redeem_loyalty(
  uuid, uuid, uuid, uuid, integer, integer, integer, boolean
) is 'Atomically redeems loyalty credit with refund-aware order idempotency.';

comment on function public.finalize_order_discount(
  uuid, uuid, uuid, uuid, numeric, integer, integer, integer, integer, numeric,
  text, integer, numeric, text, uuid, timestamptz, numeric, numeric, numeric, numeric
) is 'Atomically finalizes discounts with refund-aware loyalty idempotency.';

commit;
