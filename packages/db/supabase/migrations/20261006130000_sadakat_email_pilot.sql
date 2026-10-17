-- The real-customer pilot uses verified email OTP while SMS is unavailable.
-- Existing verified-phone members remain compatible; unverified contact input
-- never authorizes access to an existing card or merges customer identities.
create or replace function public.join_sadakat(p_restaurant uuid,p_customer uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.sadakat_active(p_restaurant) then raise exception 'SADAKAT_EXPIRED'; end if;
  if not exists(select 1 from public.sadakat_programs where restaurant_id=p_restaurant) then raise exception 'SADAKAT_NOT_FOUND'; end if;
  if not exists(select 1 from public.customers where id=p_customer and merged_at is null and verified_at is not null and (nullif(btrim(email),'') is not null or nullif(btrim(phone),'') is not null)) then raise exception 'SADAKAT_CONTACT_REQUIRED'; end if;
  insert into public.sadakat_memberships values(p_restaurant,p_customer,now()) on conflict do nothing;
  insert into public.customer_restaurants(customer_id,restaurant_id,source) values(p_customer,p_restaurant,'consent') on conflict do nothing;
  return public.read_sadakat_card(p_restaurant,p_customer);
end $$;

create function public.can_sadakat_email_authenticate(p_restaurant uuid,p_email text) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.sadakat_programs p join public.restaurants r on r.id=p.restaurant_id
    where r.id=p_restaurant and r.deleted_at is null and (public.sadakat_active(r.id) or exists(
      select 1 from public.sadakat_memberships m join public.customers c on c.id=m.customer_id
      where m.restaurant_id=r.id and lower(c.email)=lower(btrim(p_email)) and c.merged_at is null and c.verified_at is not null)));
$$;
revoke all on function public.can_sadakat_email_authenticate(uuid,text) from public,anon,authenticated;
grant execute on function public.can_sadakat_email_authenticate(uuid,text) to service_role;
revoke all on function public.join_sadakat(uuid,uuid) from public,anon,authenticated;
grant execute on function public.join_sadakat(uuid,uuid) to service_role;
