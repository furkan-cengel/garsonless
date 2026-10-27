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

AI menu reader (2026-10-25): migrations `20261012140000` and `20261025120000`, the
`menu-import-worker` Edge Function (v1) and its Vault secret/cron are on PROD. Still missing on PROD:
the `OPENAI_API_KEY` Edge secret (also used by `menu-translation-worker`) and the dashboard's
`MENU_IMPORT_ENABLED=true` Vercel variable; keep the flag off until the key is set.

Inventory card edits (2026-10-27): migration `20261027130000_inventory_item_details_version` is on DEV
only. The dashboard works with or without it (edits fall back to the old version check).

Stock redesign (2026-10-28): migration `20261028100000_inventory_insights` (read-only function) is on
DEV only. Without it the stock screen still works; daily use, weekly waste, last purchase and per-item
history are simply missing.

Otherwise none from this repo. Verified on 2026-10-27 (migrations, through `20261027120100`) and 2026-10-17: PROD (`svxvloeosiksqfadgkvo`) has every repo migration
through `20261011100200` (the three 3D/AR pilot migrations were applied that day).
PROD and DEV also carry four migrations that are not committed yet (`20260929143000`,
`20261005120000`, `20261006120000`, `20261006130000`); the wrapper's status/push needs them in the
local chain until they are committed.

Edge Functions were last verified on 2026-09-24: `outbox-worker` (v8) and
`menu-translation-worker` (v4) match the repo. Check with `node packages/db/scripts/supabase-target.mjs status --target prod --confirm-prod svxvloeosiksqfadgkvo`
before adding anything here.

## Deployment

- **Vercel deploys every push to `main` to production automatically** (masabu.co,
  app.masabu.co, menu.masabu.co, admin.masabu.co). App code can therefore reach production
  before the migrations it needs: apply PROD migrations *before* merging code that depends on
  them, or keep such code behind a flag until they are applied.
- Edge Functions are not deployed by Vercel. Before deploying one, download the live source
  (`supabase functions download <name> --project-ref <ref> --use-api`) and diff it with the repo so
  only the intended change ships; deploy from `packages/db` so `config.toml` (`verify_jwt`) applies.

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
