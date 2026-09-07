BEGIN;
DO $$
DECLARE u uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); c uuid; result text; i integer;
BEGIN
 insert into auth.users(id,email)values(u,'device-sql@example.test');
 insert into auth.sessions(id,user_id,created_at,updated_at)values(s,u,now(),now());
 insert into public.dashboard_security_accounts(user_id)values(u);
 -- Cross-device, session, country and account substitutions cannot increment or consume the real challenge.
 insert into public.dashboard_device_challenges(user_id,session_id,device_hash,code_hash,user_agent_hash,country,ip_hash,expires_at,sent_at)
 values(u,s,repeat('d',64),'good','ua','TR','ip',now()+interval '10 minutes',now())returning id into c;
 foreach result in array ARRAY['device','session','user','country','ip','ua'] loop
  if public.verify_dashboard_device_challenge(c,case when result='user' then gen_random_uuid() else u end,case when result='session' then gen_random_uuid() else s end,case when result='device' then repeat('x',64) else repeat('d',64) end,'good',case when result='ua' then 'other' else 'ua' end,case when result='country' then 'DE' else 'TR' end,case when result='ip' then 'other' else 'ip' end,true)<>'invalid' then raise exception 'substitution accepted: %',result;end if;
 end loop;
 if (select attempts from public.dashboard_device_challenges where id=c)<>0 then raise exception 'substitution consumed attempts';end if;
 for i in 1..5 loop
  if public.verify_dashboard_device_challenge(c,u,s,repeat('d',64),'wrong','ua','TR','ip',true)<>'invalid' then raise exception 'wrong-code result';end if;
 end loop;
 if public.verify_dashboard_device_challenge(c,u,s,repeat('d',64),'good','ua','TR','ip',true)<>'expired' then raise exception 'attempt cap bypass';end if;
 -- Expired and unsent codes never establish session evidence.
 update public.dashboard_device_challenges set attempts=0,expires_at=now()-interval '1 second' where id=c;
 if public.verify_dashboard_device_challenge(c,u,s,repeat('d',64),'good','ua','TR','ip',true)<>'expired' then raise exception 'expired accepted';end if;
 update public.dashboard_device_challenges set expires_at=now()+interval '10 minutes',sent_at=null where id=c;
 if public.verify_dashboard_device_challenge(c,u,s,repeat('d',64),'good','ua','TR','ip',true)<>'expired' then raise exception 'unsent accepted';end if;
 update public.dashboard_device_challenges set sent_at=now() where id=c;
 if public.verify_dashboard_device_challenge(c,u,s,repeat('d',64),'good','ua','TR','ip',true)<>'verified' then raise exception 'valid rejected';end if;
 if (select expires_at from public.dashboard_trusted_devices where token_hash=repeat('d',64))<>now()+interval '15 days' then raise exception 'expiry is not fixed 15 days';end if;
 if public.verify_dashboard_device_challenge(c,u,s,repeat('d',64),'good','ua','TR','ip',true)<>'expired' then raise exception 'replay accepted';end if;
 insert into public.dashboard_device_challenges(user_id,session_id,device_hash,code_hash,user_agent_hash,country,ip_hash,expires_at,sent_at)
 values(u,s,repeat('d',64),'good2','ua','TR','ip',now()+interval '10 minutes',now())returning id into c;
 if public.verify_dashboard_device_challenge(c,u,s,repeat('d',64),'good2','ua','TR','ip',false)<>'verified' then raise exception 'session-only rejected';end if;
 if (select revoked_at from public.dashboard_trusted_devices where token_hash=repeat('d',64))is null then raise exception 'old device trust resurrected';end if;
 if (select expires_at from public.dashboard_verified_sessions where session_id=s)<>now()+interval '24 hours' then raise exception 'session-only expiry invalid';end if;
 if has_function_privilege('authenticated','public.verify_dashboard_device_challenge(uuid,uuid,uuid,text,text,text,text,text,boolean)','execute') then raise exception 'public verification RPC grant';end if;
 if has_table_privilege('authenticated','public.dashboard_trusted_devices','insert') then raise exception 'client can mint trust';end if;
 RAISE NOTICE 'PASS: binding, five attempts, expiry, unsent code, replay, 15 days, session-only trust revocation and service-only privileges';
END $$;
ROLLBACK;
