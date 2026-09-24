@AGENTS.md

# Masabu (formerly Garsonless)

QR menu SaaS for restaurants: customizable public menus, table ordering, kitchen display,
loyalty, coupons, inventory, split payments and İyzico billing.

This file holds durable rules only. Sprint-by-sprint history (every phase, decision and
runtime proof up to 2026-09) lives in [docs/history/claude-sprint-log-2026.md](docs/history/claude-sprint-log-2026.md);
search it when you need the reasoning behind an existing behavior. Do not append sprint
logs here — put feature notes under `docs/`.

## Layout

pnpm workspaces (no Turborepo; root scripts run `corepack pnpm -r`). Next.js 15.5.x everywhere.

| Path | Role | Dev port |
|---|---|---|
| `apps/dashboard` | Restaurant admin, theme editor, billing | 3000 |
| `apps/kitchen` | Kitchen display (session-cookie auth, no Supabase user) | 3002 |
| `apps/marketing` | Public site (masabu.co) | 3003 |
| `apps/platform-admin` | Masabu control plane (AAL2 MFA, platform roles) | 3004 |
| `apps/menu` | Customer QR menu (menu.masabu.co/{slug}) | 3011 |
| `packages/domain` | Browser-safe pure policies, vocabularies, `Result` | — |
| `packages/application` | Actor/tenant-aware commands and queries over ports | — |
| `packages/db` | Supabase adapters (`/server`, `/browser`, `/types`), migrations, Edge Functions | — |
| `packages/design-engine` | Theme schema, sanitizer (`theme-policy`), CSS generation | — |
| `packages/ui` | Shared components, menu themes, icons | — |

Menu translation calls OpenAI from the `menu-translation-worker` Edge Function; there is no
Anthropic SDK or Stripe integration in the codebase.

## Local environment

- node/corepack/pnpm come from nvm and are not on PATH in non-interactive shells:
  `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"`.
- `next build` and `next dev` share `.next`. Stop an app's dev server before building it, then
  `rm -rf apps/<app>/.next` and restart dev. Stale-chunk errors (`__webpack_modules__[id] is not
  a function`, missing `vendor-chunks`) mean this happened.
- `corepack pnpm clean:artifacts` (dry-run by default, `-- --apply` to delete) removes `.next`,
  `.next-<name>` side builds, tsbuildinfo, `.DS_Store` and unpreserved `test-results`.
- Linked Supabase DEV project: `yxsegwkzyiscrxiwdeuf`. PROD: `svxvloeosiksqfadgkvo` — never
  touch PROD without explicit approval.

## Architecture rules

- **Layering:** app → `@garsonless/application` command/query → `@garsonless/db/server` port.
  Apps never create service-role clients; architecture tests enforce this. Pages and actions
  resolve a trusted actor context before calling a command.
- **Authorization:** every dashboard server action starts with `assertAccess(restaurantId,
  section)`, `assertOwner` or `assertMember` (`apps/dashboard/lib/auth/access.ts`), or a
  dedicated resolver such as `resolveTablesCommandActor`. Never rely on RLS row visibility as
  an ownership check: `restaurants` is readable far more broadly than ownership.
- **Tenant scoping:** every write that takes an entity id also filters or locks by
  `restaurant_id` (in TS or inside the RPC).
- **Money is server-authoritative:** prices, discounts, coupon and loyalty amounts are recomputed
  from DB rows and the *published* theme; client totals are ignored. Collected revenue has one
  predicate (`isCollectedOrderRow` / `collectedOrdersFilter`): `paid_at` set, not cancelled,
  `payment_method` not `comp`. Payment settles the bill but never closes the table; only staff
  close or the 180-minute idle sweep frees it.
- **Errors:** return typed `Result`s; user-facing failures use `MAS-*` public codes from
  `@garsonless/domain/errors`, never raw SQL/provider messages.
- **Validation:** Zod at every boundary. Read request bodies with `readBoundedRequestBody`.

## Security conventions

- Redirect targets from users go through `safeReturnPath` (`@garsonless/domain/navigation`);
  it re-checks the path after normalization (`/.//evil.com` → `//evil.com`).
- Worker endpoints compare shared secrets with `isAuthorizedWorkerRequest`
  (`@garsonless/application/worker-secret`) or, in Edge Functions, `workerSecretMatches`
  (`functions/_shared/worker-secret.ts`). Never use `!==` for secrets.
- Public, unauthenticated endpoints need a rate limit whose key is built only from
  server-verified inputs (table, address), never from client-chosen ids.
- **Column grants:** menu customers sign in to the same Supabase project, so `authenticated`
  is not "staff". When a table has a public row policy, restrict *both* `anon` and
  `authenticated` with column grants (see `menu_items`).
- New SECURITY DEFINER functions: `set search_path = public, pg_temp`, and
  `revoke all ... from public, anon, authenticated` unless the function is meant to be public.
- Tenant-controlled URLs are limited to `https:` when saved (`safeUrl` in theme-policy) or to
  `http(s):` when rendered.
- CSP is still **Report-Only**; violations are logged as `csp.violation` by each app's
  `/api/csp-report`. Enforce only after the logs are clean.

## Database workflow

- Migrations go through the guarded wrapper, never raw `supabase db push`:
  `node packages/db/scripts/supabase-target.mjs push --target dev --expect-pending <version>`,
  then `node packages/db/scripts/supabase-target.mjs types --target dev`.
- One migration per logical change, `gen_random_uuid()`, and a sibling
  `<version>_<name>.rollback.md` describing recovery (down migrations are not used; fix forward).
- Every migration applied only to DEV must be listed below until it reaches PROD.

### PROD-at-deploy pending items

- ⚠️ **`20260923090000_add_on_reconciliation_schedule.sql` yalnız DEV'e uygulandı** — ödenmiş/bekleyen add-on mutabakatı için kademeli kontrol takvimi; veri yazmaz.
- ⚠️ **`20260923100000_menu_items_authenticated_column_grant.sql` yalnız DEV'e uygulandı** — `authenticated` rolünün `menu_items` okumasını anon kolon listesiyle sınırlar (giriş yapmış müşterilere maliyet/makro sızıntısını kapatır).
- ⚠️ **Edge Functions `outbox-worker` ve `menu-translation-worker` yeniden deploy edilmeli** — sabit zamanlı secret karşılaştırması (`_shared/worker-secret.ts`).
- ⚠️ **`20260711020000_customer_restaurant_associations.sql` yalnız DEV'e uygulandı** — PROD deploy aşamasında uygulanacak PROD-at-deploy migration setine EKLENMELİ (yeni `customer_restaurants` tablosu + orders/loyalty ledger/consents backfill'i; insert'ler `on conflict do nothing` ile idempotent, PROD verisi üzerinde de çalışır).
- ⚠️ **`20260718010000_dashboard_query_observations.sql` yalnız DEV'e uygulandı** — PROD deploy aşamasında uygulanacak PROD-at-deploy migration setine EKLENMELİ (yalnız service-role erişimli anomaly/slow-query gözlem tablosu + tenant/zaman ve failure/degraded index'leri).
- ⚠️ **`20260718020000_dashboard_query_observation_operations.sql` yalnız DEV'e uygulandı** — PROD deploy aşamasında uygulanacak PROD-at-deploy migration setine EKLENMELİ (15 dakikalık aggregate health rollup, service-role-only prune RPC'si ve 30 günlük günlük retention cron'u).
- ⚠️ **Dashboard Insights Health workflow'u push sonrasında repo secret'larıyla aktive edilmeli** — `DEV_SUPABASE_URL` ve `DEV_SUPABASE_SERVICE_ROLE_KEY` zorunlu; `DASHBOARD_INSIGHTS_ALERT_WEBHOOK_URL` opsiyonel HTTPS alarm kanalıdır. Secret değerleri loglanmaz ve webhook payload'u tenant/ham hata taşımaz.
- ⚠️ **`20260721010000_dashboard_push_subscriptions.sql` yalnız linked DEV'e uygulandı** — dashboard Web Push teslimatı için subscription/delivery tablolarını ve own-user + tenant RLS politikalarını ekler. PROD deploy setine ancak push endpoint/worker environment'ları birlikte hazırlandığında eklenmelidir.
- ⚠️ **`20260721020000_menu_items_anon_allergen_note_grant.sql` yalnız DEV'e uygulandı** — PROD-at-deploy migration setine EKLENMELİ (`allergen_note` + `cross_contact_note` kolonlarını anon SELECT allowlist'ine ekler; bu grant olmadan public menü sorgusu 42501 alır ve menü boş görünür).
- ⚠️ **`20260721030000_notification_inbox.sql` yalnız DEV'e uygulandı** — PROD-at-deploy migration setine EKLENMELİ (per-user `notification_inbox` + `notification_preferences`; own-user RLS, service-role-only yazma, anon revoke). Deploy'da Edge worker secret'ına `OUTBOX_INBOX_CONSUMER_URL` da eklenmelidir.
- ⚠️ **`20260721040000_notification_email_channel.sql` yalnız DEV'e uygulandı** — PROD-at-deploy migration setine EKLENMELİ (`notification_templates` + `notification_deliveries`, her ikisi service-role-only). Deploy'da Edge secret'a `OUTBOX_EMAIL_CONSUMER_URL`, dashboard env'e `RESEND_API_KEY`/`RESEND_FROM_EMAIL` gerekir.
- ⚠️ **`20260721050000_notification_inbox_realtime.sql` yalnız DEV'e uygulandı** — PROD-at-deploy setine EKLENMELİ (`notification_inbox` supabase_realtime publication'a eklenir; zil rozetinin canlı düşmesi buna bağlı).
- ⚠️ **SaaS billing `20260722010000`–`20260722080000` migration'ları yalnız linked DEV'e uygulandı; PROD'a uygulanmadı.** PROD-at-deploy setine sekiz migration birlikte ve sıralı eklenmeli. Edge rollout'ta `BILLING_MAINTENANCE_URL`, `OUTBOX_INBOX_CONSUMER_URL` ve `OUTBOX_EMAIL_CONSUMER_URL`; gerçek İyzico için ayrı `IYZICO_BILLING_*` anahtar/plan/fiyat env'leri zorunludur.
- ⚠️ **`20260722160000_platform_billing_dunning_interventions.sql` yalnız linked DEV'e uygulandı; PROD'a uygulanmadı.** PROD-at-deploy setine platform-admin migration'larıyla sıralı eklenmeli. Bu RPC ödeme sonucu üretmez; yalnız finance/superadmin için denetimli `retry_now` veya 1–30 günlük `defer` zamanlaması sağlar.


## Verification

- Quality gate: `corepack pnpm check:ci` (lint, typecheck, architecture/domain/application/db
  tests, production release and bundle-budget tests). `corepack pnpm check` adds builds + smoke.
- Bundle budgets (`scripts/dashboard-bundle-budget.mjs`, `tables-bundle-budget.mjs`) fail on
  more than 5% growth over a recorded baseline. Fix the regression (usually an eager import of
  a heavy client component) before moving a baseline, and comment why when you do.
- Runtime proofs run against DEV with throwaway data on the Test Cafe B fixture; `maf-lounge`
  is read-only. Snapshot before, restore after, and prove zero orphan rows.
- Test the real authenticated path, not only service-role calls: several isolation bugs were
  invisible to service-role tests.
- GitHub Actions: the account is on the Free plan (2,000 private-repo minutes/month, $0 spending
  limit). The quota ran out on 2026-09-17 (~2,400 min in the previous 30 days) and jobs stop
  starting until the monthly reset. Heavy gates are path-filtered and the DEV health monitor
  runs daily to stay under the quota; add path filters to any new heavy workflow. While jobs
  are blocked, CI results are not evidence — run `corepack pnpm check:ci` locally.
