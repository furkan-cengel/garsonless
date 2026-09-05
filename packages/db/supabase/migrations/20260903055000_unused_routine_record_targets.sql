-- Two service-only routines selected complete rows only to drive PL/pgSQL's
-- FOUND flag. Their record targets were never read. Replace just those SELECT
-- targets with PERFORM while preserving every predicate and row lock.

begin;

do $unused_routine_record_targets$
declare
  v_patch record;
  v_definition text;
  v_patched_definition text;
  v_before_acl aclitem[];
  v_after_acl aclitem[];
  v_before_config text[];
  v_after_config text[];
  v_before_security_definer boolean;
  v_after_security_definer boolean;
  v_declaration_matches integer;
  v_statement_matches integer;
begin
  for v_patch in
    select * from (values
      (
        'public.apply_order_loyalty_adjustment(uuid,uuid,boolean)'::regprocedure,
        E'  v_refund public.order_refunds%rowtype;\n'::text,
        'select * into v_refund'::text,
        'perform 1'::text
      ),
      (
        'public.set_platform_admin_tenant_service_status(uuid,uuid,text,text,text,uuid)'::regprocedure,
        E'  v_restaurant public.restaurants%rowtype;\n'::text,
        'select * into v_restaurant'::text,
        'perform 1'::text
      )
    ) as patch(function_id, declaration, old_statement, new_statement)
  loop
    select
      pg_get_functiondef(routine.oid),
      routine.proacl,
      routine.proconfig,
      routine.prosecdef
    into strict
      v_definition,
      v_before_acl,
      v_before_config,
      v_before_security_definer
    from pg_proc routine
    where routine.oid = v_patch.function_id::oid;

    if not v_before_security_definer
       or not coalesce('search_path=public, pg_temp' = any(v_before_config), false) then
      raise exception 'unexpected security boundary for %', v_patch.function_id
        using errcode = '55000';
    end if;

    v_declaration_matches := (
      char_length(v_definition) - char_length(replace(v_definition, v_patch.declaration, ''))
    ) / char_length(v_patch.declaration);
    v_statement_matches := (
      char_length(v_definition) - char_length(replace(v_definition, v_patch.old_statement, ''))
    ) / char_length(v_patch.old_statement);
    if v_declaration_matches <> 1 or v_statement_matches <> 1 then
      raise exception 'unexpected unused-record shape in %: declaration %, statement %',
        v_patch.function_id, v_declaration_matches, v_statement_matches
        using errcode = '55000';
    end if;

    v_patched_definition := replace(v_definition, v_patch.declaration, '');
    v_patched_definition := replace(
      v_patched_definition,
      v_patch.old_statement,
      v_patch.new_statement
    );
    execute v_patched_definition;

    select
      pg_get_functiondef(routine.oid),
      routine.proacl,
      routine.proconfig,
      routine.prosecdef
    into strict
      v_definition,
      v_after_acl,
      v_after_config,
      v_after_security_definer
    from pg_proc routine
    where routine.oid = v_patch.function_id::oid;

    if position(v_patch.declaration in v_definition) > 0
       or position(v_patch.old_statement in v_definition) > 0 then
      raise exception 'unused record target remains in %', v_patch.function_id
        using errcode = '55000';
    end if;
    v_statement_matches := (
      char_length(v_definition) - char_length(replace(v_definition, v_patch.new_statement, ''))
    ) / char_length(v_patch.new_statement);
    if v_statement_matches <> 1 then
      raise exception 'replacement statement shape is incomplete in %', v_patch.function_id
        using errcode = '55000';
    end if;
    if not v_after_security_definer
       or not coalesce('search_path=public, pg_temp' = any(v_after_config), false)
       or v_after_acl is distinct from v_before_acl then
      raise exception 'function security metadata changed for %', v_patch.function_id
        using errcode = '55000';
    end if;
  end loop;
end;
$unused_routine_record_targets$;

commit;
