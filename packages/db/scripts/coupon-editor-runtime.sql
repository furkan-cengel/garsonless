-- Used only by the networkless disposable database runner.
\set ON_ERROR_STOP on
create function pg_temp.check_true(ok boolean, message text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'FAIL: %',message; end if; raise notice 'PASS: %',message; end $$;
insert into restaurants(id) values('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002') on conflict do nothing;
insert into menu_categories(id,restaurant_id) values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001'),('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002') on conflict do nothing;
insert into menu_items(id,category_id) values('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001') on conflict do nothing;
create or replace function public.fail_coupon_target_test() returns trigger language plpgsql as $$ begin raise exception 'INJECTED_FAILURE'; end $$;
drop trigger if exists fail_target on coupon_items;
create trigger fail_target before insert on coupon_items for each row execute function public.fail_coupon_target_test();
do $$
declare
 r uuid := '10000000-0000-4000-8000-000000000001';
 req uuid := gen_random_uuid();
 p jsonb := '{"name":"Test","code":"TEST10","enabled":true,"discountType":"percentage","discountValue":10,"scope":"category","minimumAmount":0,"maximumDiscountAmount":null,"startsAt":null,"endsAt":null,"totalUsageLimit":1,"perCustomerLimit":null,"audience":"everyone","stackingPolicy":"exclusive","marketingLabel":null,"marketingDescription":null,"categoryIds":["20000000-0000-4000-8000-000000000001"],"itemIds":[]}';
 saved jsonb; replay jsonb; changed jsonb; failed boolean; v_saved_id uuid; original_time timestamptz; order_a uuid := gen_random_uuid(); order_b uuid := gen_random_uuid(); final numeric;
begin
 saved := save_restaurant_coupon_atomic(r,req,p); v_saved_id := (saved->'coupon'->>'id')::uuid;
 perform pg_temp.check_true((select count(*) from coupon_categories where coupon_id=v_saved_id)=1,'coupon and targets created');
 replay:=save_restaurant_coupon_atomic(r,req,p);
 perform pg_temp.check_true(saved=replay and (select count(*) from coupons)=1,'same request returns original result without duplicate');
 failed:=false;begin perform save_restaurant_coupon_atomic(r,req,p||'{"name":"Changed"}');exception when others then failed:=sqlerrm='COUPON_REQUEST_CONFLICT';end;
 perform pg_temp.check_true(failed,'changed payload with same request rejected');
 failed:=false;begin perform save_restaurant_coupon_atomic(r,gen_random_uuid(),p);exception when unique_violation then failed:=true;end;
 perform pg_temp.check_true(failed and (select count(*) from coupons)=1,'duplicate code rejected');
 failed:=false;begin perform save_restaurant_coupon_atomic(r,gen_random_uuid(),p||'{"code":"FOREIGN","categoryIds":["20000000-0000-4000-8000-000000000002"]}');exception when others then failed:=sqlerrm='COUPON_INVALID_TARGET';end;
 perform pg_temp.check_true(failed and (select count(*) from coupons)=1,'foreign restaurant category rejected');
 changed:=p||jsonb_build_object('id',v_saved_id,'expectedUpdatedAt',saved->'coupon'->>'updated_at','scope','product','categoryIds','[]'::jsonb,'itemIds','["30000000-0000-4000-8000-000000000001"]'::jsonb,'name','Failure test');
 failed:=false;begin perform save_restaurant_coupon_atomic(r,gen_random_uuid(),changed);exception when others then failed:=sqlerrm='INJECTED_FAILURE';end;
 perform pg_temp.check_true(failed and (select name from coupons where coupons.id=v_saved_id)='Test' and (select count(*) from coupon_categories where coupon_id=v_saved_id)=1,'target write failure rolls back coupon and deleted links');
 perform pg_temp.check_true((select count(*) from coupon_write_requests)=1,'failed requests do not leave success ledger entries');
 execute 'drop trigger fail_target on coupon_items';
 replay:=save_restaurant_coupon_atomic(r,gen_random_uuid(),changed);
 perform pg_temp.check_true((select count(*) from coupon_items where coupon_id=v_saved_id)=1 and (select count(*) from coupon_categories where coupon_id=v_saved_id)=0,'scope replacement commits atomically');
 failed:=false;begin perform save_restaurant_coupon_atomic(r,gen_random_uuid(),changed);exception when others then failed:=sqlerrm='COUPON_VERSION_CONFLICT';end;
 perform pg_temp.check_true(failed,'stale update rejected');
 failed:=false;begin perform save_restaurant_coupon_atomic(r,gen_random_uuid(),changed-'expectedUpdatedAt');exception when others then failed:=sqlerrm='COUPON_VERSION_CONFLICT';end;
 perform pg_temp.check_true(failed,'missing update version rejected');

 insert into orders(id,restaurant_id,status,total) values(order_a,r,'pending',100),(order_b,r,'pending',100);
 select final_total into final from finalize_order_discount(order_a,r,null,null,100,0,0,100,0,0,null,0,0,null,v_saved_id,(replay->'coupon'->>'updated_at')::timestamptz,100,0,0,90);
 perform pg_temp.check_true(final=90 and (select count(*) from coupon_redemptions where coupon_id=v_saved_id and status='consumed')=1,'saved coupon applies to basket and records redemption');
 failed:=false;begin perform finalize_order_discount(order_b,r,null,null,100,0,0,100,0,0,null,0,0,null,v_saved_id,(replay->'coupon'->>'updated_at')::timestamptz,100,0,0,90);exception when others then failed:=sqlerrm='COUPON_EXHAUSTED';end;
 perform pg_temp.check_true(failed,'basket rejects exhausted usage limit');
 update orders set status='cancelled' where orders.id=order_a;
 perform pg_temp.check_true((select count(*) from coupon_redemptions where coupon_id=v_saved_id and status='consumed')=0,'cancelled order releases usage');
 update coupons set archived_at=clock_timestamp() where coupons.id=v_saved_id;
 failed:=false;begin perform finalize_order_discount(order_b,r,null,null,100,0,0,100,0,0,null,0,0,null,v_saved_id,(replay->'coupon'->>'updated_at')::timestamptz,100,0,0,90);exception when others then failed:=sqlerrm='COUPON_NOT_FOUND';end;
 perform pg_temp.check_true(failed,'archived coupon rejected by checkout');
 update coupons set archived_at=null where coupons.id=v_saved_id;
 select final_total into final from finalize_order_discount(order_b,r,null,null,100,0,0,100,0,0,null,0,0,null,v_saved_id,(replay->'coupon'->>'updated_at')::timestamptz,100,0,0,90);
 perform pg_temp.check_true(final=90,'restored coupon applies after usage release');
 perform pg_temp.check_true(not has_function_privilege('anon','public.save_restaurant_coupon_atomic(uuid,uuid,jsonb)','EXECUTE') and not has_function_privilege('authenticated','public.save_restaurant_coupon_atomic(uuid,uuid,jsonb)','EXECUTE'),'public clients cannot execute coupon writes');
end $$;
