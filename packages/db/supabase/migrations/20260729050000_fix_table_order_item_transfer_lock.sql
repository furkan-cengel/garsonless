-- PostgreSQL rejects a locking query when any selected relation contains a
-- DISTINCT clause. Patch the already-deployed function without duplicating its
-- large transactional body; fresh databases already contain the corrected
-- definition from the preceding migration, so this migration is a no-op there.
do $$
declare
  v_signature constant regprocedure :=
    'public.transfer_table_order_items(uuid,uuid,uuid,jsonb,uuid,uuid)'::regprocedure;
  v_definition text;
  v_old_fragment constant text :=
    E'join (select distinct order_id from item_transfer_selection) selection\n    on selection.order_id = selected_order.id';
  v_new_fragment constant text :=
    E'where selected_order.id in (\n    select selection.order_id from item_transfer_selection selection\n  )';
begin
  select pg_get_functiondef(v_signature) into v_definition;

  if position(v_old_fragment in v_definition) > 0 then
    execute replace(v_definition, v_old_fragment, v_new_fragment);
  elsif position(v_new_fragment in v_definition) = 0 then
    raise exception 'transfer_table_order_items lock query shape is unknown';
  end if;
end;
$$;
