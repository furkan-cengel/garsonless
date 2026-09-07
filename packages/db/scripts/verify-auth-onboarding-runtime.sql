begin;
do $test$
declare
 owner_a uuid := '8f591e9b-2ab2-4099-9173-678a10d3ca81';
 owner_b uuid := '8f591e9b-2ab2-4099-9173-678a10d3ca82';
 rid uuid;
 create_request uuid := gen_random_uuid();
 draft_request uuid := gen_random_uuid();
 first_result jsonb;
 result jsonb;
 draft jsonb := '{"mode":"manual","categoryName":"Kahveler","itemName":"Latte","price":"12,","description":"","csvFileName":"","csvRows":[]}'::jsonb;
 rev integer;
begin
 insert into auth.users(id,email,raw_app_meta_data) values(owner_a,'sql-auth-a@example.test','{}'),(owner_b,'sql-auth-b@example.test','{}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_a,'role','authenticated')::text,true);
 begin
   perform public.create_restaurant_with_pro_trial_v3('Audit SQL','auth-audit-sql','Europe/Istanbul','pro',create_request,'yearly');
   raise exception 'test_failed_unverified_account_created_restaurant';
 exception when insufficient_privilege then
   assert sqlerrm = 'signup_email_verification_required';
 end;
 update auth.users set email_confirmed_at=clock_timestamp() where id=owner_a;
 begin
   perform public.create_restaurant_with_pro_trial_v3('Audit SQL','auth-audit-sql','Europe/Istanbul','pro',create_request,'yearly');
   raise exception 'test_failed_missing_legal_evidence_accepted';
 exception when insufficient_privilege then
   assert sqlerrm = 'signup_legal_evidence_required';
 end;
 perform public.record_signup_legal_evidence(owner_a,'2026-08-16',clock_timestamp(),null,null);
 first_result:=public.create_restaurant_with_pro_trial_v3('Audit SQL','auth-audit-sql','Europe/Istanbul','pro',create_request,'yearly');
 rid:=(first_result#>>'{snapshot,restaurantId}')::uuid;
 assert first_result#>>'{snapshot,targetBillingInterval}'='yearly';
 assert (select billing_interval from public.billing_subscriptions where restaurant_id=rid)='annual';
 assert (select settings#>>'{notifications,newOrderSoundPreset}' from public.restaurants where id=rid)='masabu-alert';
 result:=public.create_restaurant_with_pro_trial_v3('Audit SQL','auth-audit-sql','Europe/Istanbul','pro',create_request,'yearly');
 assert result->>'outcome'='replayed';
 assert result->'snapshot'=first_result->'snapshot';
 begin
   perform public.create_restaurant_with_pro_trial_v3('Audit SQL','auth-audit-sql','Europe/Istanbul','pro',create_request,'monthly');
   raise exception 'test_failed_request_payload_mismatch';
 exception when invalid_parameter_value then assert sqlerrm='onboarding_idempotency_conflict'; end;
 rev:=(first_result#>>'{snapshot,revision}')::integer;
 result:=public.advance_restaurant_onboarding_branding(rid,'#2e7d52','{"accent":"#2e7d52"}',rev,gen_random_uuid());
 rev:=(result#>>'{snapshot,revision}')::integer;
 result:=public.save_restaurant_onboarding_draft(rid,draft,rev,draft_request);
 assert result->>'outcome'='saved';
 assert result#>>'{snapshot,menuDraft,price}'='12,';
 assert result#>>'{snapshot,currentStep}'='menu';
 assert (select count(*) from public.menu_categories where restaurant_id=rid)=0;
 first_result:=result;
 result:=public.save_restaurant_onboarding_draft(rid,draft,rev,draft_request);
 assert result->>'outcome'='replayed';
 assert result->'snapshot'=first_result->'snapshot';
 result:=public.save_restaurant_onboarding_draft(rid,draft,rev,gen_random_uuid());
 assert result->>'outcome'='conflict';
 begin
   perform public.save_restaurant_onboarding_draft(rid,jsonb_set(draft,'{price}','"13"'),rev,draft_request);
   raise exception 'test_failed_draft_payload_mismatch';
 exception when invalid_parameter_value then assert sqlerrm='onboarding_idempotency_conflict'; end;
 rev:=(first_result#>>'{snapshot,revision}')::integer;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_b,'role','authenticated')::text,true);
 begin
   perform public.save_restaurant_onboarding_draft(rid,draft,rev,gen_random_uuid());
   raise exception 'test_failed_cross_owner_write';
 exception when insufficient_privilege then assert sqlerrm='not_authorized'; end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_a,'role','authenticated')::text,true);
 result:=public.read_owner_restaurant_onboarding();
 assert result->'menuDraft'=draft;
 begin
   perform public.save_restaurant_onboarding_draft(rid,'{"mode":"invalid"}',rev,gen_random_uuid());
   raise exception 'test_failed_invalid_draft';
 exception when invalid_parameter_value then assert sqlerrm='onboarding_draft_invalid'; end;
 assert (public.read_owner_restaurant_onboarding()->>'revision')::integer=rev;
 begin
   perform public.save_restaurant_onboarding_draft(rid,jsonb_set(draft,'{mode}','null'),rev,gen_random_uuid());
   raise exception 'test_failed_null_mode';
 exception when invalid_parameter_value then assert sqlerrm='onboarding_draft_invalid'; end;
 begin
   perform public.save_restaurant_onboarding_draft(rid,draft || '{"extra":"unsupported"}',rev,gen_random_uuid());
   raise exception 'test_failed_extra_draft_key';
 exception when invalid_parameter_value then assert sqlerrm='onboarding_draft_invalid'; end;
 draft := jsonb_set(jsonb_set(draft,'{mode}','"csv"'),'{csvRows}','[{"sourceRow":2,"category":"İçecekler","name":"Çay","description":"","price":"15","error":null},{"sourceRow":3,"category":"","name":"Eksik satır","description":"","price":"","error":"Fiyat gerekli"}]');
 result:=public.save_restaurant_onboarding_draft(rid,draft,rev,gen_random_uuid());
 assert result->>'outcome'='saved';
 assert public.read_owner_restaurant_onboarding()->'menuDraft'=draft;
 assert (select count(*) from public.menu_categories where restaurant_id=rid)=0;
 rev:=(result#>>'{snapshot,revision}')::integer;
 result:=public.create_onboarding_first_menu_item(rid,'Kahveler','Latte',120,null,rev,gen_random_uuid());
 assert result#>>'{snapshot,status}'='completed';
 assert result#>>'{snapshot,itemCount}'='1';
 assert result#>'{snapshot,menuDraft}'='null'::jsonb;
 assert not has_table_privilege('authenticated','public.restaurant_onboarding_states','UPDATE');
 assert not has_function_privilege('anon','public.save_restaurant_onboarding_draft(uuid,jsonb,integer,uuid)','EXECUTE');
 raise notice 'PASS: identity, legal evidence, annual intent, defaults, replay, conflict, draft persistence, ownership and menu completion';
end;
$test$;
rollback;
