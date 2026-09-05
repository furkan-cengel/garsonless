-- Replace the table-wide anonymous restaurant read with a deliberately small
-- public projection. Private tenant metadata must never hitch a ride in the
-- settings JSON consumed by the public menu.

drop policy if exists "anon_read_restaurants" on public.restaurants;
revoke select on table public.restaurants from anon;

-- Staff still need the restaurant row after the broad policy is removed, but
-- only for restaurants they can actually access.
drop policy if exists "members_read_restaurants" on public.restaurants;
create policy "members_read_restaurants" on public.restaurants
  for select to authenticated
  using (public.has_restaurant_access(id));

create or replace function public.read_public_restaurant_by_slug(p_slug text)
returns table (
  id uuid,
  name text,
  slug text,
  logo_url text,
  settings jsonb,
  timezone text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    r.name,
    r.slug,
    r.logo_url,
    jsonb_strip_nulls(jsonb_build_object(
      'contact', case
        when jsonb_typeof(r.settings -> 'contact') = 'object' then
          jsonb_strip_nulls(jsonb_build_object(
            'phone', r.settings #> '{contact,phone}',
            'email', r.settings #> '{contact,email}',
            'website', r.settings #> '{contact,website}',
            'address', r.settings #> '{contact,address}',
            'district', r.settings #> '{contact,district}',
            'city', r.settings #> '{contact,city}',
            'zip', r.settings #> '{contact,zip}',
            'instagram', r.settings #> '{contact,instagram}',
            'facebook', r.settings #> '{contact,facebook}',
            'tiktok', r.settings #> '{contact,tiktok}',
            'whatsapp', r.settings #> '{contact,whatsapp}'
          ))
        else null
      end,
      'hours', case
        when jsonb_typeof(r.settings -> 'hours') = 'object' then r.settings -> 'hours'
        else null
      end,
      'loyalty', case
        when jsonb_typeof(r.settings -> 'loyalty') = 'object' then
          jsonb_strip_nulls(jsonb_build_object(
            'stamp_enabled', r.settings #> '{loyalty,stamp_enabled}',
            'stamp_goal', r.settings #> '{loyalty,stamp_goal}',
            'stamp_reward_text', r.settings #> '{loyalty,stamp_reward_text}',
            'points_enabled', r.settings #> '{loyalty,points_enabled}',
            'points_per_lira', r.settings #> '{loyalty,points_per_lira}',
            'points_redeem_rate', r.settings #> '{loyalty,points_redeem_rate}',
            'member_discount_pct', r.settings #> '{loyalty,member_discount_pct}',
            'reward_item_id', r.settings #> '{loyalty,reward_item_id}',
            'welcome_bonus_points', r.settings #> '{loyalty,welcome_bonus_points}',
            'tiers', r.settings #> '{loyalty,tiers}',
            'reward_catalog', r.settings #> '{loyalty,reward_catalog}',
            'scope', r.settings #> '{loyalty,scope}',
            'earn_trigger', r.settings #> '{loyalty,earn_trigger}'
          ))
        else null
      end,
      -- Legacy public fields retained until every theme uses contact.*.
      'address', case
        when jsonb_typeof(r.settings -> 'address') = 'string' then r.settings -> 'address'
        else null
      end,
      'phone', case
        when jsonb_typeof(r.settings -> 'phone') = 'string' then r.settings -> 'phone'
        else null
      end
    )) as settings,
    r.timezone
  from public.restaurants r
  where r.slug = btrim(p_slug)
    and char_length(btrim(p_slug)) between 1 and 120
    and r.deleted_at is null
  limit 1;
$$;

revoke all on function public.read_public_restaurant_by_slug(text)
  from public;
grant execute on function public.read_public_restaurant_by_slug(text)
  to anon, authenticated, service_role;
