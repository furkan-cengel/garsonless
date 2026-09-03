-- plpgsql_check cannot infer relations created as temporary tables inside a
-- PL/pgSQL function. Declare the already-existing runtime table shape through
-- its dependency-free string pragma so `supabase db lint` can still validate
-- every statement that reads it. At runtime this PERFORM is a harmless string
-- expression; the plpgsql_check extension does not become a dependency.

begin;

do $migration$
declare
  v_signature constant regprocedure :=
    'public.transfer_table_order_items(uuid,uuid,uuid,jsonb,uuid,uuid)'::regprocedure;
  v_definition text;
  v_temp_table constant text :=
    E'  create temporary table item_transfer_selection (\n'
    || E'    order_id uuid not null,\n'
    || E'    line_index integer not null,\n'
    || E'    quantity integer not null,\n'
    || E'    primary key (order_id, line_index)\n'
    || E'  ) on commit drop;';
  v_lint_pragma constant text :=
    E'  perform ''PRAGMA:TABLE: item_transfer_selection '
    || E'(order_id uuid, line_index integer, quantity integer)'';';
begin
  select pg_get_functiondef(v_signature) into v_definition;

  if position(v_lint_pragma in v_definition) > 0 then
    null;
  elsif position(v_temp_table in v_definition) > 0 then
    execute replace(
      v_definition,
      v_temp_table,
      v_temp_table || E'\n\n' || v_lint_pragma
    );
  else
    raise exception 'transfer_table_order_items temp-table shape is unknown';
  end if;
end;
$migration$;

revoke all on function public.transfer_table_order_items(uuid,uuid,uuid,jsonb,uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.transfer_table_order_items(uuid,uuid,uuid,jsonb,uuid,uuid)
  to service_role;

commit;
