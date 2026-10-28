# Rollback: 20261101100000_team_cash_permission

Redefines `mutate_team_member_with_audit` so a member's permissions may include `cash`
(Pano shift till). Grants are unchanged: `create or replace` keeps them.

Down migrations are not used; fix forward. To withdraw the permission, re-run the function from
`20261005120000_sadakat_pilot.sql` and remove `cash` from members:
`update public.restaurant_members set permissions = permissions - 'cash' where permissions ? 'cash';`
