begin;
do $$
declare owner uuid; rid uuid:=gen_random_uuid(); cid uuid; pid uuid; req uuid:=gen_random_uuid(); v integer; prepared jsonb; evidence jsonb; before_state jsonb; after_state jsonb; store jsonb; n integer; ctx jsonb; j public.accounting_invoice_jobs%rowtype;
begin
 select owner_id into owner from public.restaurants where slug='test-cafe-b';
 if owner is null then raise exception 'Dev test fixture owner missing'; end if;
 insert into public.restaurants(id,owner_id,name,slug) values(rid,owner,'One-time add-on transaction test','lifetime-'||rid);
 update public.restaurants set plan='starter' where id=rid;
 insert into public.billing_customers(restaurant_id,legal_name,contact_email,contact_name,contact_surname,identity_number,gsm_number,billing_address,shipping_address)
 values(rid,'Test','lifetime@example.com','Test','Owner','11111111111','905350000000','{"contactName":"Test","address":"Test 1","city":"Istanbul","district":"Kadikoy","country":"Turkey","taxOffice":"Test"}','{"contactName":"Test","address":"Test 1","city":"Istanbul","district":"Kadikoy","country":"Turkey","taxOffice":"Test"}')
 on conflict(restaurant_id) do update set contact_name=excluded.contact_name,contact_surname=excluded.contact_surname,identity_number=excluded.identity_number,gsm_number=excluded.gsm_number,billing_address=excluded.billing_address,shipping_address=excluded.shipping_address returning id into cid;
 insert into public.billing_subscriptions(restaurant_id,billing_customer_id,plan,status,billing_interval,current_period_start,current_period_end)
 select rid,cid,'starter','active','monthly',now()-interval '10 days',now()+interval '20 days'
 where not exists(select 1 from public.billing_subscriptions where restaurant_id=rid);
 update public.billing_subscriptions set status='active',plan='starter',billing_interval='monthly',current_period_start=now()-interval '10 days',current_period_end=now()+interval '20 days' where restaurant_id=rid;
 select jsonb_agg(to_jsonb(s)) into before_state from public.billing_subscriptions s where restaurant_id=rid;
 select max(version) into v from public.add_on_price_versions where add_on='storefront_video_hero';
 begin
  perform public.prepare_add_on_purchase(rid,gen_random_uuid(),'storefront_video_hero',v,gen_random_uuid(),null);
  raise exception 'Foreign owner accepted';
 exception when others then if sqlerrm not like '%add_on_owner_required%' then raise; end if; end;
 begin
  perform public.prepare_add_on_purchase(rid,owner,'iyzico_online_payments',1,gen_random_uuid(),null);
  raise exception 'Starter bought Pro-only add-on';
 exception when others then if sqlerrm not like '%add_on_plan_required%' then raise; end if; end;
 begin
  perform public.set_add_on_price(owner,'storefront_video_hero',v,1,20,true);
  raise exception 'Tenant edited catalog';
 exception when others then if sqlerrm not like '%add_on_catalog_forbidden%' then raise; end if; end;
 prepared:=public.prepare_add_on_purchase(rid,owner,'storefront_video_hero',v,req,null);
 assert (prepared->>'dispatchable')::boolean;
 assert (prepared->'purchase'->>'totalAmountMinor')::bigint=46800;
 pid:=(prepared->'purchase'->>'id')::uuid;
 assert not (public.prepare_add_on_purchase(rid,owner,'storefront_video_hero',v,req,null)->>'dispatchable')::boolean;
 assert (public.prepare_add_on_purchase(rid,owner,'storefront_video_hero',v,gen_random_uuid(),null)->'purchase'->>'id')::uuid=pid;
 perform public.attach_add_on_checkout(pid,'token-'||pid,'https://sandbox-cpp.iyzipay.com/test');
 evidence:=jsonb_build_object('token','token-'||pid,'paymentId','payment-'||pid,'basketId',pid,'conversationId',pid,'totalAmountMinor',46800,'currency','TRY','status','review','refundedAmountMinor',0,'chargeback',false);
 perform public.apply_add_on_payment(pid,evidence);
 assert not exists(select 1 from public.restaurant_add_on_ownership where restaurant_id=rid);
 begin
  perform public.apply_add_on_payment(pid,evidence||'{"totalAmountMinor":1}');
  raise exception 'Mismatched evidence accepted';
 exception when others then
  if sqlerrm not like '%add_on_evidence_mismatch%' then raise; end if;
 end;
 evidence:=evidence||'{"status":"paid"}';
 perform public.apply_add_on_payment(pid,evidence);perform public.apply_add_on_payment(pid,evidence);
 select jsonb_agg(to_jsonb(s)) into after_state from public.billing_subscriptions s where restaurant_id=rid;
 assert before_state=after_state, 'Day 10 purchase changed subscription';
 store:=public.read_add_on_store(rid); assert store->'owned'='["storefront_video_hero"]'::jsonb;
 select count(*) into n from public.accounting_invoice_jobs where add_on_purchase_id=pid;assert n=1;
 select * into j from public.accounting_invoice_jobs where add_on_purchase_id=pid;
 assert j.subscription_invoice_id is null and j.billing_profile_snapshot->>'kind'='add_on' and not(j.billing_profile_snapshot ? 'periodStart');
 insert into public.add_on_price_versions(add_on,version,net_amount_minor,vat_rate) values('storefront_video_hero',v+1,50000,20);
 assert (public.read_add_on_store(rid)->'purchases'->0->>'totalAmountMinor')::bigint=46800;
 update public.billing_subscriptions set status='cancelled',cancelled_at=now() where restaurant_id=rid;
 store:=public.read_add_on_store(rid); assert store->'owned'='["storefront_video_hero"]'::jsonb;
 ctx:=public.read_restaurant_entitlement_context(rid,'theme_video_hero');assert not(ctx->>'accessAllowed')::boolean;
 update public.billing_subscriptions set status='active',cancelled_at=null where restaurant_id=rid;
 ctx:=public.read_restaurant_entitlement_context(rid,'theme_video_hero');
 assert (ctx->>'accessAllowed')::boolean and ctx->'activeAddOns' @> '["storefront_video_hero"]'::jsonb;
 update public.restaurants set plan='pro' where id=rid;
 update public.billing_subscriptions set plan='pro' where restaurant_id=rid;
 assert public.read_add_on_store(rid)->'owned'='["storefront_video_hero"]'::jsonb;
 update public.restaurants set plan='starter' where id=rid;
 update public.billing_subscriptions set plan='starter' where restaurant_id=rid;
 assert public.read_add_on_store(rid)->'owned'='["storefront_video_hero"]'::jsonb;
 evidence:=evidence||'{"refundedAmountMinor":1000}';perform public.apply_add_on_payment(pid,evidence);
 assert public.read_add_on_store(rid)->'owned'='["storefront_video_hero"]'::jsonb;
 evidence:=evidence||'{"refundedAmountMinor":46800}';perform public.apply_add_on_payment(pid,evidence);
 assert public.read_add_on_store(rid)->'owned'='[]'::jsonb;
 assert not has_table_privilege('authenticated','public.restaurant_add_on_ownership','INSERT');
 assert not has_function_privilege('authenticated','public.apply_add_on_payment(uuid,jsonb)','EXECUTE');
end $$;
rollback;
select 'PASS: day-10 independent purchase; duplicate request; review; tampered evidence; one fiscal job; price snapshot; cancellation; partial/full refunds; RLS. All fixtures rolled back.' as result;
