-- Dead-code cleanup: drop the unused marketing_integrations table.
--
-- It was reserved in 20260619020000 for SMS/İYS provider config but never wired
-- into any app code (0 references outside the generated types). Pre-launch with
-- no data of value, so we drop it rather than carry a dormant table. The
-- original migration is kept in history. CASCADE removes the table's own
-- updated-at trigger + RLS; the shared public.update_updated_at() function is
-- left intact (other tables use it).

drop table if exists public.marketing_integrations cascade;
