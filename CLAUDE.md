# Garsonless — Project Intelligence

## Product Vision

SaaS QR menu platform. Restaurants create fully customizable digital menus
with ordering, kitchen display, AI waiter, and payment capabilities.
Comparable to Shopify in customization depth.

## Architecture

- Monorepo: Turborepo
- Apps:
  - `apps/dashboard` — Next.js 15, restaurant admin panel + theme builder
  - `apps/menu` — Next.js 15, customer-facing QR menu (served at menu.garsonless.app/{slug})
  - `apps/kitchen` — Next.js 15, KDS (Kitchen Display System)
- Packages:
  - `packages/ui` — Shared component library (shadcn base + custom)
  - `packages/design-engine` — Token system, theme resolver, CSS variable generator
  - `packages/db` — Supabase client, types, migrations
  - `packages/ai` — Anthropic SDK wrapper, AI waiter prompts
  - `packages/qr` — QR generation with logo overlay

## Tech Stack

- Framework: Next.js 15 App Router
- Database: Supabase (Postgres + Realtime + Auth)
- Styling: Tailwind v4 + CSS custom properties (design tokens)
- AI: Anthropic Claude (claude-sonnet-4) via Anthropic API
- Payments: İyzico (TR) + Stripe
- State: Zustand (client), TanStack Query (server)
- Drag & Drop: dnd-kit + Framer Motion
- QR: qrcode + sharp
- Print: ESC/POS via node-thermal-printer

## Design Engine — CRITICAL

The design engine is the core differentiator. Every UI decision routes through it.

- Tokens stored in DB as JSON per restaurant
- CSS variables generated server-side, injected as <style> tag
- Component-level overrides stored separately
- Never hardcode colors, fonts, or spacing in components — always use CSS vars

## DB Schema Conventions

- snake_case columns
- Every table has: id (uuid), created_at, updated_at
- Soft deletes: deleted_at nullable
- RLS enabled on all tables

## Code Conventions

- TypeScript strict mode
- Zod for all validation
- Server Actions for mutations
- All API routes in `app/api/` with typed responses
- Error handling: never throw raw errors, always return typed Result<T, E>

## Agent Workflow

1. Always read relevant files before editing
2. Plan → get approval → implement
3. One migration per logical change
4. After each feature: update types, run type-check, summarize what changed

## Current Sprint

### Sprint 24 — Payments close the table (Payment epic) 🚧

**P1 — per-order payment method + race-safe auto-close ✅ (merged before this session). Migration: `20260625000000_payment_method_settle.sql`.** Added `orders.payment_method` (`iyzico|cash|pos|comp`, check-constrained) + `orders.settled_by uuid → auth.users`, both DELIBERATELY excluded from the anon column grant (settlement data never reaches the public menu via REST/realtime — same discipline as `customer_tier`). Backfilled existing paid orders with an `order_payment_tokens` row → `'iyzico'`; token-less paid orders left null (legacy-collected, NOT comp). `markOrderPaidDB(orderId, restaurantId, method, settledBy?)` now stamps `paid_at + payment_method + settled_by` under a `paid_at IS NULL` guard (first settlement wins, retries no-op) and fires the new `close_session_if_fully_paid(session)` RPC — a single atomic `closed_at IS NULL`-guarded UPDATE that closes the adisyon iff every non-cancelled order is paid (comp counts as paid). Two concurrent final payments → exactly one wins the close. Collected-ciro is ONE predicate (`isCollectedOrder`/`collectedOrdersFilter` in dashboard `queries.ts`): `paid_at set AND status<>'cancelled' AND payment_method IS DISTINCT FROM 'comp'` (keeps legacy null-method paid, drops only comp). `shouldEarnOnSettlement` blocks loyalty earning for comp. İyzico callback stamps `'iyzico'` (settled_by null = system).

**P2 — manual settlement (cash/pos/comp) + no-silent-drop close + per-order method ✅ (verified + committed `f8d5976`). Migration: `20260625010000_session_close_reason.sql` (db-pushed to DEV; local==remote).**

**The new primitive — `settleOrder` (`apps/dashboard/lib/actions/settlement.ts`):** `settleOrder(orderId, restaurantId, method)` — Zod `method ∈ {cash,pos,comp}` (an errorMap REJECTS `'iyzico'` — callback-only). Gated by `assertAccess('tables')` (owner OR member with the section; the returned `userId` becomes `settled_by`). Delegates to P1 `markOrderPaidDB`, inheriting its restaurant-scoping (cross-tenant orderId → "not found") + `paid_at IS NULL` no-op guard (re-settling an İyzico order never overwrites the method) + auto-close. The product's FIRST manual "mark paid".

**No silent money-drop (`closeTableSession` rewritten):** the old path stamped `closed_at` and silently abandoned `unpaidTotal`. Now: fully-paid → NORMAL close (`close_reason` null, +1 visit); unpaid + NO reason → REJECTED (forces a settlement decision); unpaid + reason → ABNORMAL close (`close_reason` recorded, orders STAY unpaid, NO visit credited). New nullable `table_sessions.close_reason` is the abnormal record/flag (non-null ⇒ abnormal; one column, no drift). **NO path closes unpaid money without an explicit recorded decision.**

**Close-flow UX (`SettlementSheet.tsx`, wired into `TablesBuilderShell`):** closing an adisyon with `unpaidTotal>0` opens a sheet ("Kalan: ₺X — nasıl tahsil edildi?") listing each non-cancelled order with `[Nakit][Fiziksel POS][İkram]` buttons + a bulk "Tümünü Nakit/POS" shortcut (the common single-method case; İkram per-order only). Settling the last unpaid order auto-closes the session (P1) → the sheet closes. A de-emphasized "Ödenmeden kapat (anormal)" sits behind a confirm + required reason prompt. Already-fully-paid → closes directly (no sheet). `getSessionSettlement` feeds the sheet (per-order state; settled_by email resolved for owners only).

**Split bill (per-ORDER grain) + badges:** the staff SettlementSheet IS the per-order "split by order" (clean 1:1) — a 2-order session settled one Nakit one POS stamps both and auto-closes on the last. The customer-facing `apps/menu` `SplitBillModal` was deliberately NOT given staff settlement buttons: `settleOrder` is `assertAccess('tables')`-gated and unreachable from the anon menu (letting a customer stamp cash/comp = fraud), and per-person partial settlement WITHIN one order is the explicitly flagged non-P2 stretch. Shared `lib/payment-method.ts` (`paymentMethodBadge`) renders the method on the orders board + sheet (İkram = distinct dashed violet `₺0`, not money-green); imported from the client-safe `@garsonless/db/order-client` subpath (added `PaymentMethod` there).

**P1+P2 gates — DONE on the new toolchain machine (2026-06-26):** `db push` to DEV (P2's `close_reason` migration applied; P1 was already remote; local==remote), `types:gen` regenerated against the real schema (FIXED a drift: the committed `types.gen.ts` was missing `payment_method`/`settled_by`/`close_reason` + the `close_session_if_fully_paid` RPC), typecheck **8/8**, lint **0/0**, db unit **59/59** (incl. comp/settle tests). **Test Cafe B real-auth runtime matrix 42/42** (snapshot→restore; maf-lounge read-only; throwaway members+orders): İyzico last-unpaid close + visits, comp paid+method+0-loyalty+excluded-from-ciro+İkram-reportable, IS DISTINCT FROM keeps legacy null in ciro, race-safe close (5 concurrent → 1), re-settle no-op (method stays iyzico), no-silent-drop reject, abnormal close records `close_reason`, split-bill per-order method, member-without-'tables' rejected + cross-tenant blocked (gate + scoped-write). Committed `f8d5976` on `fix/pano-real-data`.

**P3 — payment report rewrite + comp report + pg_cron safety-net sweep ✅ (verified, this session). Migration: `20260626000000_payment_safety_net_sweep.sql` (db-pushed to DEV; ⚠️ MUST ALSO be applied to PROD at deploy — pg_cron + the schedule are per-project).**

**`getPaymentBreakdown` REWRITE (real method, drops the Sprint 19c inference):** STOPS inferring İyzico-vs-Manuel from `order_payment_tokens` presence (token join deleted) — now reads the REAL `orders.payment_method`. Returns a `PaymentReport`: `collected[]` = 3-way `iyzico|cash|pos` + a `unknown` bucket ("Bilinmiyor (eski)" = legacy null-method paid, KEPT in the tahsilat base), each with `pct` over `collectedTotal`; `comp` = `{amount,count}` reported SEPARATELY (İkram), **never in the collected % base** (it's ₺0 collected). Paid + non-cancelled in range; comp split out in TS.

**Comp report (new metric):** "İkram edilen" = `paid_at not null AND status<>'cancelled' AND payment_method='comp'` → `sum(total)` for the range, surfaced as its OWN KPI + a violet dashed İkram line in the Analytics payment report (`CompLine`), NEVER inside tahsilat. UI drops the old "Manuel tahsilat (inferred)" / "Online token varlığına göre" wording → "Nakit · Fiziksel POS · İyzico" + real method labels (P2 comp badge palette).

**Safety-net sweep (`sweep_fully_paid_idle_sessions(p_idle_minutes int default 30)`, scheduled `*/10 * * * *`):** closes ONLY fully-paid (no unpaid non-cancelled order) idle (newest live order older than the threshold) sessions — a guarded `closed_at IS NULL` + re-checked fully-paid UPDATE (race-safe, mirrors `close_session_if_fully_paid`) tagged SYSTEM `close_reason='auto'`, then credits visits idempotently. **NEVER settles money; a session with ANY unpaid non-cancelled order is LEFT OPEN** (the deep 8h lazy close + manual settle own those). `'auto'` is a system tag distinct from a staff walkout reason → the future abnormal/walkout report is `closed_at is not null AND close_reason is not null AND close_reason <> 'auto'` (nothing reads `close_reason` yet). SECURITY DEFINER + locked search_path; execute revoked from anon/authenticated. **Runtime bug caught + fixed by the gate:** the visit `INSERT … ON CONFLICT (session_id,customer_id,type)` failed ("no unique/exclusion constraint matching") because the idempotency index is PARTIAL (`where session_id is not null`) — the ON CONFLICT must repeat that predicate; fixed + re-applied (migration repair→reverted + re-push, all statements idempotent) + re-verified.

**P3 verify (Test Cafe B real data; maf-lounge read-only; snapshot→restore; 25/25):** breakdown reads real method — cash ₺150/2, pos ₺80/1, iyzico ₺120/1, legacy-null ₺40/1 → collectedTotal ₺390 (5 orders, unpaid ₺999 excluded), comp ₺70/1 SEPARATE + never in the % base; İkram metric sums comp for the range. Sweep: a fully-paid idle session AND a ~15625-min forgotten paid session → REAPED (closed + `close_reason='auto'` + visit credited); an unpaid idle session → LEFT OPEN (order still unpaid); a recently-active paid session → not swept; re-run idempotent (no double-credit). SAFETY: the global sweep was pre-flighted read-only (candidate set ⊆ throwaway sessions) before the real call → zero maf/other-tenant collateral. typecheck 8/8, lint 0/0, db unit 59/59.

### Dashboard performance pass — first-load + SSR payload reduction ✅ (2026-06-26)

**Goal:** speed up the dashboard panel without product behavior changes. Dirty tree treated as the performance change set after P3; no destructive or production-facing DB commands were rerun.

**SSR/query reductions:** Pano now uses `getPanoSnapshot(restaurantId,isOwner)` to collapse dashboard home data into targeted lightweight queries (30-day order rows, today item fold, tables, open sessions, owner-only payment mode) instead of many broad queries. Orders page selects only board fields (`id, restaurant_id, table_id, status, items, total, customer_tier, paid_at, payment_method, created_at`). Analytics initial SSR loads sales + payments only; product/table reports are fetched lazily per active tab through `fetchAnalyticsReportData(report)`. Theme editor SSR uses `getThemeEditorMenuRefs` (`id/name/parent_id/category_id` only) instead of full category/item rows.

**Client bundle splits:** CSV import (`papaparse`) loads only when a CSV file is selected. QR rendering/export (`qr-code-styling`) loads only when QR canvas/grid/download needs it. Menu category DnD moved to `MenuCategoryDndList` and lazy-loads `@dnd-kit`; the sidebar keeps a static fallback so categories render immediately. Theme editor route imports `ThemeEditorClientLoader`, dynamically loading the heavy editor while keeping the route shell tiny. The initial `ssr:false` loader variant caused an internal-server-error risk in dev; removed it while preserving the chunk split. Dashboard `framer-motion` usage was removed from order/service toasts and replaced with CSS animations; dashboard dependency entry was removed (other apps/packages still use it).

**Realtime/layout cleanup:** `RestaurantShell` now derives order/new badges from one `select('status')` query over active statuses instead of two separate count queries.

**Measured production build impact:** `/dashboard/[restaurantId]/theme/[templateId]/edit` `27.3 kB / 230 kB` → `4.42 kB / 108 kB`; `/menu` baseline `20.6 kB / 242 kB` → `13.8 kB / 219 kB`; `/tables` baseline `30.7 kB / 233 kB` → `16.9 kB / 219 kB`; `/orders` first load baseline `242 kB` → `204 kB`. Dashboard shared first-load JS remains ~103 kB.

**Verification:** `corepack pnpm --filter @garsonless/dashboard typecheck`, `lint`, and `build` all pass after the final loader fix. Restarted local dashboard dev server on `localhost:3000`; `/dashboard` returns 307 to `/auth/login`, `/auth/login` returns 200.

### Sprint 23 — Settings stubs → real surfaces 🚧

**23b — Security section real (login/activity log + password change) ✅ (2026-06-22). Migration: `20260622000000_security_events.sql` (db push, `types:gen`, local/remote match through `20260622000000`).**

**Problem closed:** the Settings → Güvenlik section was a full stub — a fake "Authenticator · Aktif" 2FA card, non-functional session-timeout/IP-restriction/new-device checkboxes, and a hardcoded "Denetim günlüğü" with invented names/IPs (`Ayşe … 85.110.4.21`). Nothing was real.

**Source decision (option a):** an explicit `security_events` table we control, written on real events — portable, not dependent on Supabase's `auth.audit_log_entries` internals. Per-USER scope (`user_id` → `auth.users`, `restaurant_id` nullable for future team events), `event_type check ('login','password_change')`, `ip`, `user_agent`, `created_at`. **RLS:** `for select to authenticated using (user_id = auth.uid())` — each user reads ONLY their own; deliberately **NO anon policy and NO authenticated write policy** → all inserts go through the service role (a user can never forge/tamper with their own audit trail). `gen_random_uuid()`.

**Capture (best-effort, never blocks auth):** new `packages/db/src/security.ts` → `recordSecurityEvent(...)` (service-role insert, try/catch-swallow) + `getSecurityEvents`. `recordSecurityEvent('login')` fires in the `signIn` action (password login) AND the `/auth/callback` route (magic-link/OAuth) with IP/UA from request headers. New `apps/dashboard/lib/request-meta.ts` → pure `parseForwardedIp(x-forwarded-for, x-real-ip)` (first hop of the forwarded chain) + `readRequestMeta()`. Password change → new `changePassword` action: **re-authenticates with the current password** (Supabase `updateUser` doesn't require the old one), `updateUser({ password })`, then records a `password_change` event.

**UI (`AdvancedSections.tsx` `SecuritySection`, fully rewritten):** real **Şifre** form (current/new/confirm → `changePassword` → `router.refresh()` re-fetches the SSR log). Real **Hesap etkinliği** list from `security_events` — event label + relative time + `deviceSummary(ua)` (browser·OS) + IP, newest-first, empty state, **the signed-in user's own events only**. 2FA card kept but **clearly disabled with a "Yakında" tag** (no fake toggle); the unbacked session/IP/new-device stubs were deleted. **Read path is RLS-enforced:** `settings/page.tsx` selects `security_events` via the authenticated client (no manual `user_id` filter — RLS scopes it) and threads `securityEvents` + `userEmail` through `SettingsForm` → `SecuritySection`.

**23b verify:** typecheck **9/9**, lint **0/0**. Runtime gate on Test Cafe B (real owner login; throwaway 2nd user for isolation; password changed then restored; all B test rows + the throwaway user cleaned up; maf-lounge untouched) **18/18**: `recordSecurityEvent` persisted a login row with the parsed IP `203.0.113.7` (from a 3-hop `x-forwarded-for`) + exact UA; **RLS** — B (authed) sees only B's rows and not the 2nd user's, the 2nd user sees only its own, anon (no session) sees 0; real **password change** (reauth → updateUser) made the new password work + the old fail + wrote a `password_change` event, then the original password was restored.

**23a — Notifications section real (4 channel toggles) ✅ (2026-06-22). NO migration** — `settings.notifications` JSONB. Real toggles for the 4 implemented channels (new-order sound/desktop-push/in-app-toast + service-request alert), Zod-validated owner-gated `saveNotificationSettings`, gating wired into `useNotificationSW`/`OrderToast`/`RestaurantShell`. Email/SMS/quiet-hours stubs omitted (no backing channel). Verified typecheck 9/9, lint 0/0, Test Cafe B persist round-trip.

### Sprint 22 — Automated smoke gates 🚧

**22a — Playwright HTTP smoke + root check script ✅ (2026-06-21). NO migration.**

**Problem closed:** after lint/typecheck/build were clean, there was still no single command that proved the critical apps boot and the safest public/private routes respond. Runtime route regressions could slip through if TypeScript and production build passed.

**Tooling:** added `@playwright/test`, root `playwright.config.ts`, and `tests/smoke/routes.spec.ts`. The first smoke gate uses Playwright's API/request layer only — no browser binary or screenshot dependency yet. Web servers are managed by Playwright for dashboard (`3005`), menu (`3011`), kitchen (`3002`), and marketing (`3003`), with `SMOKE_*_URL` and `SMOKE_MENU_SLUG` overrides for local/CI environments. Default fixture slug is `maf-lounge`.

**Smoke coverage:** dashboard private `/dashboard` must 307 to `/auth/login`, dashboard `/auth/login` must render, marketing home must render, menu `/{slug}?preview=1` must render, and kitchen `/kitchen/{restaurantId}` without token must fail closed with the token-required page instead of crashing. This catches app boot, middleware/auth redirect, Supabase-backed public menu SSR, and kitchen fail-closed behavior.

**Scripts:** root `smoke` runs `playwright test`; root `test:db` runs the db unit suite through `@garsonless/db`; root `check` now chains `lint → typecheck → test:db → build → smoke`. `@garsonless/db` gained a local `test` script (`tsx --test src/*.test.ts`). During implementation, `pnpm install` was run after adding Playwright to repair pnpm's app symlink tree so Next dev/build resolved correctly.

**22a verify:** root `corepack pnpm check` passes end-to-end: `lint` **0/0**, `typecheck` **9/9**, db unit suite **56/56**, production `build` passes marketing/kitchen/menu/dashboard, and Playwright smoke passes **4/4**. In Codex's sandbox, DB tests need unsandboxed execution because `tsx` opens an IPC pipe, and smoke needs unsandboxed execution because Next dev servers bind local ports; normal local terminal usage does not need special handling. No DB migration/type regeneration needed.

**22b — browser visual smoke + responsive regression gate ✅ (2026-06-21). NO migration.**

**Problem closed:** route/API smoke proved apps booted, but it could not catch visual regressions like page-level horizontal overflow, blank screenshots, broken loading hierarchy, or mobile-only layout collapse. The first run caught two real issues: dashboard auth login still carried the 480px desktop visual panel on mobile, and marketing home kept the desktop nav/hero composition on an iPhone viewport.

**Visual tooling:** added `playwright.visual.config.ts` plus `tests/visual/*`. The visual suite runs Chromium desktop (`1440x950`) and iPhone 15 mobile viewports against dashboard (`3005`), menu (`3011`), kitchen (`3002`), and marketing (`3003`). Public coverage verifies dashboard login, marketing home, menu `maf-lounge?preview=1`, and kitchen token-required fail-closed. Authenticated dashboard visual smoke exists for menu manager, customers, loyalty settings, and theme editor, but is opt-in via `DASHBOARD_VISUAL_RESTAURANT_ID` + `DASHBOARD_VISUAL_STORAGE_STATE` so CI/local runs do not need a real owner session.

**Health assertions:** `assertVisualHealth` checks visible text, visible element count, page-level horizontal overflow, and nonblank screenshots; failures include the first overflowing DOM offenders. Screenshots attach to Playwright output for review. The kitchen fail-closed page uses a lower `minVisibleCount` because it is intentionally sparse. Visual smoke defaults now use `localhost` URLs instead of `127.0.0.1`, avoiding Next dev cross-origin warnings for `_next/*` assets.

**Responsive fixes found by the gate:** `VisualPanel` is hidden under `900px` and auth main/top-link spacing is mobile-safe. Marketing nav now collapses links/actions into a compact CTA on mobile, and the hero switches from the desktop two-column composition to a bounded stacked visual using explicit mobile classes for the dashboard mock, phone mock, and QR badge. `html/body` now clip horizontal overflow in the marketing app, while the visual test still asserts `documentElement.scrollWidth` stays within the viewport budget.

**Scripts:** root `visual:smoke` runs `playwright test --config=playwright.visual.config.ts`; root `check:visual` chains the full `check` gate and then `visual:smoke`. `.gitignore` now excludes Playwright `test-results` and `playwright-report` artifacts.

**22b verify:** `corepack pnpm lint` passes **0/0**; `corepack pnpm typecheck` passes **9/9**; standalone `corepack pnpm visual:smoke` passes **8 public tests**, with **8 authenticated dashboard tests skipped** by missing opt-in env. Full `corepack pnpm check:visual` passes end-to-end: lint **0/0**, typecheck **9/9**, db unit suite **56/56**, production build for marketing/kitchen/menu/dashboard, API smoke **4/4**, and visual smoke **8 passed / 8 skipped**. Browser install required `corepack pnpm exec playwright install chromium` once on this machine.

**22c — authenticated dashboard visual gate ✅ (2026-06-21). NO migration.**

**Problem closed:** 22b had authenticated dashboard screenshot specs, but they required a manually prepared `DASHBOARD_VISUAL_STORAGE_STATE` + `DASHBOARD_VISUAL_RESTAURANT_ID`. That made the most important admin screens easy to skip forever. The suite now has an automatic login/setup path.

**Setup flow:** added `tests/visual/dashboard-auth.setup.ts`. When `DASHBOARD_VISUAL_EMAIL` + `DASHBOARD_VISUAL_PASSWORD` are set, Playwright logs into `/auth/login`, follows `/dashboard` to the owner’s first restaurant dashboard, writes `test-results/visual-auth/dashboard-storage-state.json`, and writes `test-results/visual-auth/dashboard-metadata.json` containing the resolved `restaurantId`. `dashboard-authenticated.spec.ts` reads that metadata at runtime, so setup-created state works in the same Playwright run. Explicit manual mode still works with `DASHBOARD_VISUAL_STORAGE_STATE` + `DASHBOARD_VISUAL_RESTAURANT_ID`.

**Project split:** `playwright.visual.config.ts` now separates `dashboard-auth-setup`, `public-desktop`, `public-mobile`, `dashboard-desktop`, and `dashboard-mobile`. Public tests always run. Authenticated dashboard tests skip unless credentials or explicit storage env are provided. When credentials are provided, dashboard desktop/mobile projects depend on the setup project. Root scripts added: `visual:auth:setup` and `visual:auth`.

**22c runtime verify:** default `corepack pnpm visual:smoke` (no auth env) passes **8 public tests** and skips **9** expected auth/setup tests. Test Cafe B authenticated run using the seeded test owner passes **9/9**: setup login/storage-state generation plus menu manager, customers, loyalty settings, and theme editor on both desktop and iPhone 15 mobile. `corepack pnpm lint` passes **0/0** and `corepack pnpm typecheck` passes **9/9** after the change.

**22d — operational dashboard visual coverage ✅ (2026-06-21). NO migration.**

**Coverage expanded:** authenticated visual smoke now includes the three remaining core operational dashboard surfaces: **Pano** (`/dashboard/{restaurantId}`), **Orders** (`/orders`), and **Tables/QR builder** (`/tables`). The authenticated set now covers Pano, Menu Manager, Orders Board, Customers, Tables Builder, Loyalty Settings, and Theme Editor on both desktop and iPhone 15 mobile.

**Regressions caught/fixed by the gate:** Pano emitted a React console error from `PeakHours` because the `days.map()` fragment had no key and reused hour keys across rows; fixed with keyed `Fragment` + day-scoped hour keys. Tables/QR builder created **880px** page-level horizontal overflow on iPhone 15 because its standalone desktop shell (topbar presets, rail, table nav, QR canvas, properties panel, status bar) tried to render as one horizontal workspace. Fixed with responsive `tb-tables__*` classes: mobile hides the duplicate rail/status/preset topbar, stacks nav/canvas/properties vertically, wraps the canvas toolbar, and bounds QR frames to the viewport.

**22d runtime verify:** Test Cafe B authenticated visual run now passes **15/15**: setup login plus seven dashboard surfaces on desktop and mobile. `corepack pnpm lint` passes **0/0** and `corepack pnpm typecheck` passes **9/9** after the fixes. Full default `corepack pnpm check:visual` also passes: lint/typecheck/db unit **56/56**, production build for marketing/kitchen/menu/dashboard, API smoke **4/4**, visual smoke **8 passed / 15 expected skipped** without auth env.

### Sprint 21 — Quality gates + lint debt visibility 🚧

**21a — real ESLint quality gate ✅ (2026-06-20). NO migration.**

**Problem closed:** repo-level `lint` was only a deterministic type gate after 20d, while Next's old `next lint` path could still fall into interactive setup prompts. The project now has a real non-interactive ESLint gate that covers the monorepo without reintroducing Turbo's local package-manager binary issue.

**Config + scripts:** added root flat config `eslint.config.mjs` with ESLint JS recommended, `typescript-eslint` recommended, Next core-web-vitals rules, React Hooks rules, browser/node/service-worker globals, generated output ignores, and a narrow Lucide deep-import triple-slash exception. Root/app/package `lint` scripts now run `eslint .`; package-level lint is available for `ui`, `db`, `design-engine`, `ai`, and `qr`.

**Code fixes:** fixed the real lint errors exposed by the new gate: expression-only ternary in `ModifierGroupBuilder`, iframe self-assignment in `ThemeEditorClient`, stale Netgsm `eslint-disable`, and unnecessary initialized assignment in SMS parsing. The Lucide ambient module reference was intentionally kept because downstream `@garsonless/ui` typecheck requires it for deep icon imports.

**21a verify:** root `corepack pnpm lint` passes with **0 errors / 39 warnings**. Root `corepack pnpm typecheck` passes across **9/9** workspace packages. Root `corepack pnpm build` passes across marketing, kitchen, menu, and dashboard; the earlier Next "plugin not detected" build warning was removed by globally registering the Next plugin in the flat config. Remaining warnings became explicit Sprint 21b backlog: unused vars, selected `<img>` → `next/image`, custom font placement, and React Hook dependency review. No DB migration/type regeneration needed.

**21b — lint warning burn-down + clean build output ✅ (2026-06-20). NO migration.**

**Problem closed:** the new ESLint gate was real but still noisy: **39 warnings** meant CI/dev output could hide the next real regression. Build output also had a Next workspace-root warning from `apps/marketing/package-lock.json`.

**Warning cleanup:** removed unused imports/constants/legacy helpers across dashboard, menu, marketing, and db surfaces; deleted the unused legacy `FieldEditor` path in the theme editor; removed stale marketing constants; and kept the public DB helper re-exports while trimming unused local imports. Hook warnings were fixed by stabilizing theme-preview messaging with `useCallback`, memoizing derived `previewTheme/pageBlocks/activeSections`, scoping menu table-bill realtime to `tableSessionId`, and adding the QR ref dependency where the QR preview effect writes through it.

**Rule decisions:** dashboard `<img>` usage is intentionally allowed in ESLint because these are admin-only upload/preview/QR artifacts where `next/image` can change fixed geometry or reject blob/data-style sources. Custom Google font link warnings are also disabled intentionally for now; moving to `next/font` is a design/perf migration, not a lint cleanup. Marketing's workspace-root build warning was fixed without deleting files by setting `outputFileTracingRoot` in `apps/marketing/next.config.ts`.

**21b verify:** root `corepack pnpm lint` now passes with **0 errors / 0 warnings**. Root `corepack pnpm typecheck` passes across **9/9** workspace packages. Root `corepack pnpm build` passes across marketing, kitchen, menu, and dashboard with clean lint/build-warning output. No DB migration/type regeneration needed.

### Sprint 20 — UI polish + design system consistency 🚧

**20a — dashboard skeleton hierarchy + shared Lucide icon foundation ✅ (2026-06-20). NO migration.**

**Problem closed:** dashboard route loading states used the same centered `HeroSpinner`, so page geometry collapsed during navigation and broke visual hierarchy. Several dashboard surfaces also carried separate inline SVG icon dictionaries, causing uneven stroke/shape quality.

**Skeleton/loading behavior:** added `DashboardRouteSkeleton` with page-shaped placeholders for pano, analytics, orders, menu, theme, tables, and settings. All dashboard `loading.tsx` route fallbacks now render the matching skeleton instead of the default spinner. Inline spinners remain for button/action pending states where a small spinner is the correct affordance.

**Icon system:** added `lucide-react` to `@garsonless/ui` and exported `AppIcons`, `AppIconNodes`, and `appIconNode`. Dashboard `lib/ui.tsx` now re-exports the shared Lucide-backed `I` map while preserving the existing `<I.search />` / `I.home` API. Settings sidebar, LoyaltySection, Tables/QR builder, and landing-page generic icon dictionaries now derive from the shared icon set; social brand marks + the filled testimonial star remain custom. Lucide was selected over Tabler for this phase because it matches the current stroke-icon API and keeps tree-shakable React components.

**20a verify:** `@garsonless/ui`, `@garsonless/dashboard`, `@garsonless/menu`, and `@garsonless/kitchen` typechecks clean. Dashboard smoke `GET /dashboard` on local port **3004** returned expected auth redirect **307 → /auth/login**.

**20b — menu skeleton parity + AI photo/OCR removal ✅ (2026-06-20). NO migration.**

**Problem closed:** the menu loading state still looked like a generic card grid rather than the real menu manager geometry, and the menu page still exposed AI photo/OCR affordances that are being removed from the product surface.

**Menu loading hierarchy:** route-level `DashboardRouteSkeleton(kind="menu")` now mirrors the actual menu workspace: icon rail + top bar search/actions + category rail + product canvas toolbar/card grid + right editor empty panel. `MenuManager`'s client-only `SkeletonGrid` was also rebuilt to match the real left category list, grid/list controls, product cards, add-card slot, and right detail pane. The old `SkeletonCard` usage is gone.

**AI photo/OCR removal:** removed the menu import/enhance UI from `MenuManager` and deleted the unused `MenuOCRModal`, `EnhancePhotoModal`, `/api/enhance-photo`, and `/api/generate-from-menu-photo` surfaces. The `@fal-ai/client` dependency and lockfile entries were removed from `@garsonless/dashboard`. Menu topbar now keeps only CSV import, preview, and new-product actions. Product/category placeholders use the shared `AppIcons.cutlery` icon instead of emoji.

**20b verify:** `@garsonless/dashboard typecheck` and `@garsonless/dashboard build` pass. Dashboard search shows no remaining `@fal-ai/client`, `EnhancePhoto`, `MenuOCR`, `enhance-photo`, `generate-from-menu-photo`, `SkeletonCard`, or menu AI/OCR references. Menu route bundle remains healthy (`/dashboard/[restaurantId]/menu`, production build).

**20c — dashboard operational icon sweep ✅ (2026-06-20). NO migration.**

**Problem closed:** several high-traffic dashboard surfaces still used emoji or local inline SVGs for operational icons, causing inconsistent weight, alignment, and visual hierarchy despite the new Lucide foundation.

**Dashboard surfaces standardized:** analytics report nav/saved reports, customers list stats, customer detail timeline/stat cards, loyalty summary chips/stamp preview, pano live feed/quick actions, payment methods, notification settings, service-request/order toasts, order card/timeline status markers, notifications empty state, profile logout, onboarding logo placeholder, QR stand request page, tables pending-request chips, and settings logo placeholder now use the shared `I`/`AppIcons` system. Chart SVGs, QR/design previews, and Google/Apple brand marks intentionally remain custom because they are data/brand renderings, not generic UI icons.

**Auth + theme editor sweep:** login/signup form icons now use `AppIcons` (`mail`, `lock`, `eye/eyeOff`, `user`, `store`, `shield`, `clock`, etc.); the auth visual panel testimonial stars and floating menu chips use shared icons. Theme library and theme editor section library/sidebar/toolbar icon helpers now use `AppIcons`; menu-link `↗` and tag placeholders were converted to icon components. `@garsonless/ui/icons` gained the missing shared icons: `mail`, `lock`, `logout`, `megaphone`, `eyeOff`, and `tag`.

**20c verify:** `@garsonless/ui typecheck`, `@garsonless/dashboard typecheck`, and `@garsonless/dashboard build` pass. Dev server restarted on **http://localhost:3005** after build. Remaining emoji references are intentional content controls in the theme editor's food/icon picker or public marketing/demo content; remaining SVGs are charts, QR/preview drawings, or brand marks.

**20d — root tooling + kitchen client bundle hardening ✅ (2026-06-20). NO migration.**

**Problem closed:** root `corepack pnpm typecheck` still failed through Turbo with `Unable to find package manager binary: cannot find binary path` because this machine exposes pnpm through Corepack, not as a bare `pnpm` binary in PATH. Root build then exposed a real kitchen bundle issue: `KitchenBoard`/`KitchenCard` imported runtime helpers through the main `@garsonless/db` barrel, which pulled server-only `loyalty.ts` (`node:crypto`) into the client bundle. Root lint also reached the old `next lint` app scripts, which fell into an interactive ESLint setup prompt because the repo has no ESLint config/deps yet.

**Root scripts:** root `build`, `dev`, `lint`, and `typecheck` now orchestrate workspace scripts via `corepack pnpm -r` instead of Turbo. This keeps the package-level gates but removes the broken package-manager-binary lookup from the root workflow. App `lint` scripts temporarily used `tsc --noEmit` as the deterministic gate in 20d; real ESLint was added in Sprint 21a.

**Kitchen bundle:** client components now import priority/tier snapshot helpers from the browser-safe `@garsonless/db/order-client` subpath and keep `Tables`/`OrderStatus` as type-only imports. Service-role DB exports remain on server-only kitchen page/action/query paths.

**20d verify:** initial root `corepack pnpm typecheck` reproduced the Turbo error; after the script change, root `corepack pnpm typecheck` passes across **9/9** workspace packages. `@garsonless/kitchen typecheck` and `@garsonless/kitchen build` pass after the import split. Root `corepack pnpm build` passes across marketing, kitchen, menu, and dashboard. Root `corepack pnpm lint` passes via the current `tsc --noEmit` app lint gates. No DB migration/type regeneration needed.

### Sprint 19 — Stability + Revenue Semantics 🚧

**19a — loyalty refund on cancellation ✅ (2026-06-19). Migration: `20260619030000_loyalty_cancel_refund.sql` (db push, `types:gen`, local/remote status match).**

**Problem closed:** cancelling an order that had used points/stamps previously left the negative redeem rows in place, so the customer permanently lost spendable balance. The old `warnIfCancellingRedeemedOrder` warning-only guard is superseded.

**DB + ledger model:** `loyalty_transactions.direction` now allows `refund` in addition to `earn|redeem`. Cancel reversal rows are positive deltas with `direction='refund'` and `reason='refund_cancel'`. This restores spendable points/stamps because balances sum `delta`, but **does not inflate lifetime points** because lifetime still only sums `direction='earn'`. Existing `(order_id,type,direction)` uniqueness gives exactly one refund row per order/type.

**RPC + app wiring:** new service-role-only `refund_cancelled_loyalty(p_order)` reads redeem rows, transaction-locks each `(customer,scope_key)`, inserts refund rows with `on conflict ... do nothing`, and returns inserted amounts. `refundCancelledLoyaltyOrder(orderId)` wraps it in `packages/db`; `updateOrderStatusDB(...,'cancelled')` now calls it, so dashboard and kitchen cancel paths share the same refund behavior. Old `warnIfCancellingRedeemedOrder` remains as a back-compat export but delegates to refund.

**UI/data visibility:** `LoyaltyActivity` and CRM `CustomerTimelineEvent` accept `direction='refund'`; MemberHome and customer detail label them as **Puan iadesi / Damga iadesi**.

**19a runtime gate (isolated throwaway restaurant/customer/order; cleanup):** before cancel balance = **60 points / 0 stamps / lifetime 100** after simulated redeem rows; cancel via `updateOrderStatusDB` → **100 points / 3 stamps / lifetime still 100**; direct repeat refund inserted **0**; second cancel inserted **0**; exactly two refund rows remained: **+40 points**, **+3 stamps**. Typecheck **9/9**, db unit suite **56/56**, migration status local/remote match through `20260619030000`.

**19b — analytics/revenue semantics ✅ (2026-06-19). NO migration.**

**Metric contract locked:** dashboard `DashboardKPIs.revenue` now means **Tahsil edilen ciro** = `paid_at is not null AND status <> 'cancelled'`. `DashboardKPIs.orders` now means **Sipariş hacmi** = all non-cancelled orders. `avgBasket` is computed as collected revenue / paid order count (new `paidOrders/paidOrdersYesterday` fields are exposed for UI/future use). Sessions are counted only from non-cancelled rows, avoiding cancelled/noise sessions in daily KPIs.

**Query semantics:** `getHourlySales` and `getSalesOverTime` are paid-only and cancelled-excluding, so pano/analytics charts are tahsilat charts. `getHeatmapData` is non-cancelled order volume, not revenue. `getTopItems` and `getTablesReportData` are paid-only; top item `revenue` remains gross line total (`price*qty`) from paid orders rather than discount-allocated net, so UI labels use **Tutar** instead of ciro. Orders board KPI now sums `paid_at` rows only; floor-plan footer was relabeled from active ciro to **açık adisyon** because it is not collected money.

**UI language:** Pano labels now say **Tahsil edilen ciro**, **Sipariş hacmi**, **Ort. tahsilat**, and **Tahsilat akışı**. Analytics labels use **Tahsilat trendi**, paid-at based subtitles, **Ödemeli sipariş** on table reports, and ciro wording was removed from real report widgets (landing/marketing copy untouched).

**19b verify:** typecheck clean for all 9 packages (`db`, `menu`, `dashboard`, `kitchen`, `ui`, `design-engine`, `ai`, `qr`, `marketing`). DB unit suite via Node test runner: **56/56**. Dashboard smoke `GET /dashboard` on local dev server returned expected auth redirect **307 → /auth/login**. No DB migration/type regeneration needed.

**19c — real payment + product analytics ✅ (2026-06-20). NO migration.**

**Payment report:** removed the placeholder donut. New `PaymentBreakdown` query reads paid, non-cancelled orders for the selected range. Because `orders` currently has no payment-method/provider column, the report uses the existing secure signal: orders with a service-role-only `order_payment_tokens` row are classified as **İyzico online**, paid orders without a token as **Manuel tahsilat**. The token table remains service-role-only; dashboard query first owner-gates `(restaurant_id, owner_id)` with the auth client, then service-role reads only aggregate order ids/totals and returns no token/secret values. Sales report mini donut and the Payments tab now share this real breakdown.

**Product analytics:** removed the mock ABC/matrix/risers/fallers. New `ProductReportItem` is computed from paid, non-cancelled `orders.items` for the selected range and previous equivalent range. It supports both menu orders (`quantity`, modifier deltas) and dashboard manual orders (`qty`). ABC class is revenue-share/cumulative-share based (`A` until cumulative-before-item reaches 80%, `B` until 95%, then `C`; a single dominant first item still lands in A). Product matrix is now correctly labeled **Tahsilat payı × hacim** (no margin data exists yet), and rising/falling lists compare against the previous period.

**Range behavior:** analytics server action now refreshes `topItems`, `paymentBreakdown`, and `productReport` with the selected range; initial SSR uses `week`, pano `getTopItems()` keeps its default `day` behavior.

**19c verify:** typecheck clean for all 9 packages (`db`, `menu`, `dashboard`, `kitchen`, `ui`, `design-engine`, `ai`, `qr`, `marketing`). DB unit suite via Node test runner: **56/56**. Dashboard smoke `GET /dashboard` on local dev server returned expected auth redirect **307 → /auth/login**. No DB migration/type regeneration needed.

**19d — table status ↔ open adisyon alignment ✅ (2026-06-20). NO migration.**

**Problem closed:** Pano/FloorPlan/NewOrderModal table status used to derive from today's latest order per table, which could disagree with the real table-session/adisyon model. A table with an older open adisyon, a fully paid-but-not-closed session, cancelled-only orders, or multiple orders in one session could render misleadingly.

**Data contract:** `getTableStatuses` now reads open `table_sessions` first, then folds orders by `table_session_id`. `TableStatusData` now carries `sessionId`, `openedAt`, `unpaidTotal`, `orderCount`, and `hasUnfinished` in addition to the existing `status/time/total`. Status rules are session-scoped: no open session or no non-cancelled orders → `empty`; any unfinished order older than 20m → `late`; unfinished with fresh activity under 5m → `new`; all non-cancelled orders served and paid → `paid`; otherwise `active`. `total` is the unpaid adisyon when present, otherwise session total.

**UI alignment:** Pano table widget now says **Açık adisyonlar** and shows active/paid/empty counts from session state. FloorPlan footer sums open unpaid adisyon totals and labels paid sessions as **ödendi · kapatılabilir**. NewOrderModal table picker now explains that empty tables open a new adisyon and active tables append to the existing one. `getOpenTableSessions` now counts only non-cancelled orders, matching the Pano status fold.

**19d verify:** typecheck clean for all 9 packages (`db`, `menu`, `dashboard`, `kitchen`, `ui`, `design-engine`, `ai`, `qr`, `marketing`). DB unit suite via Node test runner: **56/56**. Dashboard smoke `GET /dashboard` returned expected auth redirect **307 → /auth/login**. No DB migration/type regeneration needed.

### Sprint 18 — Table/session tenant hardening + direct anon insert closure ✅

**18a — table/session cross-tenant hardening ✅ (2026-06-18). 18b — direct anon orders insert closure ✅ (2026-06-18). Migrations: `20260618020000_table_scoping_hardening.sql` + `20260618030000_close_orders_anon_insert.sql` (db push, types regenerated).**

**Problem closed:** `tableId` was not consistently scoped to `restaurant_id` across menu table SSR, order placement, waiter/service requests, table-session opening, and dashboard manual order paths. A tampered body like **restaurant A + table B** could previously mix table/session/order/request state. Separately, legacy `anyone_create_order with check(true)` still allowed direct PostgREST anon order inserts, bypassing `/api/orders` server-authoritative money and slug checks.

**DB hardening:** added `tables(restaurant_id,id)` unique index and NOT VALID composite FKs for new writes: `orders(restaurant_id,table_id)`, `table_sessions(restaurant_id,table_id)`, `service_requests(restaurant_id,table_id)` → `tables(restaurant_id,id)`. Existing historical data is not validated yet, but all new mismatched writes are blocked. `open_or_get_table_session(p_restaurant_id,p_table_id)` now verifies the table belongs to that restaurant and is not soft-deleted before opening/reusing a session; stale-session close/reuse queries are also restaurant-scoped. RPC remains service-role only (execute revoked from public/anon/authenticated).

**App/data layer:** `createOrder` validates table ownership before RPC/discount/order insert and returns typed `Table not found for this restaurant`; `/api/orders` maps that to 400. `createServiceRequest` validates table ownership and scopes throttle + open-session lookup by both `restaurant_id` and `table_id`; `/api/service-request` maps mismatch to 400. Menu table SSR (`/[slug]/table/[tableId]`) now queries `getTableLabel/getOpenTableSession(restaurantId, tableId)` and calls `notFound()` on mismatch. `MenuPageClient` uses `effectiveTableId` (route table wins, otherwise verified stored table), scopes bill refresh by restaurant, clears stale stored table IDs from other restaurants, and sends `effectiveTableId` in order bodies. Dashboard manual order creation validates table ownership; table dashboard close/delete/QR paths were tightened so service-role visit credit only runs after restaurant-scoped session validation.

**Direct anon insert closure:** dropped policy `anyone_create_order` and revoked `insert` on `orders` from `anon`. Customer order creation continues through `/api/orders` → service-role `createOrder`, where DB prices, loyalty, table ownership, and session opening are server-authoritative. Safe anon order SELECT for menu status tracking remains intact via the existing column grant + recent-orders policy.

**18 runtime gate (isolated throwaway restaurants/tables/items; cleanup; maf-lounge read-only):** cross-tenant order A+tableB → error `Table not found for this restaurant`, **orders rows=0**, **table_sessions rows=0**. Cross-tenant service request A+tableB → same error, **service_requests rows=0**. Scoped table lookup A+tableB → `null` (SSR path therefore 404). Valid A table order still works: subtotal/total **100** from DB price despite client line price **9999**, and attaches a real `table_session_id`; valid service request rows=**1**. Direct service-role mismatched inserts hit composite FK `23503` for both orders and service_requests. Direct anon `orders.insert` now fails `42501`; anon safe order select still **ok**. `maf-lounge` settings JSON byte-identical before/after.

**18 verify:** migration push complete; `db:status` local/remote match through `20260618030000`; `types:gen` regenerated. Typecheck clean for all 9 packages (`db`, `menu`, `dashboard`, `kitchen`, `ui`, `design-engine`, `ai`, `qr`, `marketing`). DB unit suite via Node test runner: **56/56**.

### Sprint 17 — Tier perks + flexible tier count ✅

**17a — flexible model + dynamic editor ✅ (2026-06-17). 17b — perk application (discount/multiplier/bonus stamps) ✅ (2026-06-18). 17c — priority service (order tier snapshot + kitchen/Kanban badge+sort) ✅ (2026-06-18). JSONB config → NO migration for 17a/17b; 17c migration `20260618010000_order_customer_tier_snapshot.sql` adds `orders.customer_tier jsonb` (db push).**

**Phase 17c — priority service: order tier snapshot + kitchen/Kanban badge+sort (logged 2026-06-18):**

**Order-time snapshot, not live lookup.** `computeOrderDiscount` now carries placement-internal `customerTierSnapshot` built server-side from `getMemberBalances` (`tier`, `tierIndex`, `lifetimePoints`, all four perks, `priorityService`, color/name/min). `createOrder` writes it to `orders.customer_tier` on insert. Guests and legacy orders store/read `null` and behave non-priority. This deliberately snapshots the tier at order placement — later tier/config edits do not rewrite old kitchen priority.

**Priority UI + sorting:** new pure helpers in `packages/db/src/loyalty.ts`: `readOrderCustomerTierSnapshot`, `orderHasPriorityService`, `sortOrdersByPriorityThenCreatedAt` (priority first, then older first). Kitchen initial query and realtime state use the helper; dashboard Kanban columns sort with the same helper. `KitchenCard`, dashboard `OrderCard`, and the order detail panel show an **Öncelikli · {tier.name}** badge only when `priorityService=true` in the snapshot.

**Security decision:** `customer_tier` is **NOT** added to the anon `orders` column grant from `20260617000000_security_isolation_fixes.sql`; public menu REST/realtime stays free of customer classification. Kitchen realtime still uses anon only as a change signal, then calls token-validated `getKitchenOrderAction(orderId, restaurantId, kitchenToken)` to fetch the full service-role order including `customer_tier`. Dashboard owner realtime reads it through the authenticated owner/RLS path.

**17c verify:** migration pushed; `types:gen` regenerated. Typecheck clean for db/menu/dashboard/kitchen during implementation; unit `loyalty.test.ts` now **10** (adds legacy-null snapshot, priority flag parsing, priority-first/oldest-first sort) + stack 14/tier 15/redeem 6/stampearn 6. No money/economic behavior changed in 17c; `orders.total`, İyzico amount, points/stamps logic remain 17b paths.

**Phase 17b — perk application: discount % / points × / bonus stamps (logged 2026-06-18):**

**Server-authoritative throughout — tier resolved from DB lifetime points, never client.** (1) **Discount %:** new pure `effectivePct(tier.discountPct, cfg.member_discount_pct) = tier.discountPct>0 ? tier.discountPct : member_discount_pct` — `computeOrderDiscount` passes it as `memberPct` (order of ops UNCHANGED: stamp-free → catalog-free → tier-% → points) and sets `DiscountResult.memberTierName` (cart line "Üye indirimi (Altın %10)", threaded preview→MenuPageClient→CartDrawer). `createOrder` re-stack already uses `discount.memberDiscountPct` (= effective) → placement + İyzico amount + table-bill (orders.total) all reflect it automatically. (2) **Points ×:** `computePointsDelta(total, ppl, multiplier)` gained a multiplier arg; `earnForOrder` resolves the customer's tier from **PRE-this-order lifetime** (sum earn-points EXCLUDING this order's own row → stable across paid→served retries) → `points = floor(total·ppl·tier.pointsMultiplier)`. (3) **Bonus stamps:** pure `applyBonusStamps(stampDelta, bonus) = stampDelta>=1 ? +bonus : unchanged` (never mints from nothing) in `earnForOrder`. All idempotent via the existing `(order_id,type,direction)` key. **Legacy configs (all-zero perks + member_discount_pct=N) behave byte-identical via the fallback.** **Save-time fold** (`saveLoyaltyConfig`): when ANY tier has `discountPct>0` → set `member_discount_pct=0` (fallback inert; no double-apply). Multiplier 1× / bonus 0 / discountPct 0 → identical to pre-17b.

**17b verify:** typecheck 9/9; unit `stack.test.ts` **14** (effectivePct override/fallback/none + tier-% stacking) + `loyalty.test.ts` **7** (multiplier 1.5×/2× floor, bonus-only-when-≥1) + tier 15/redeem 6/stampearn 6. **Runtime gate (Test Cafe B, REAL `createOrder`→`markOrderPaidDB`; snapshot→restore; 13/13):** VIP(min300, 15%/2×/+1) member lifetime 500, order subtotal 90 → **tier discount 13 (15%, NOT member's 10%)**, `orders.total=77` server-authoritative, **points=floor(77·1·2)=154**, **stamp delta=1+1=2**; TAMPER inflated client prices → ignored (DB subtotal); **paid-retry + served → exactly 1 points + 1 stamp earn row, still 154 (not doubled)**; LEGACY all-zero perks → discount 10% (fallback); fold rule (discountPct>0→member_pct 0). Found Test Cafe B holding a **user-built 6-tier perk ladder** (manual 17a editor test) — preserved byte-identical by the gate (guardrail A); maf-lounge untouched.

**Phase 17a — flexible tiers + perks (config + display only, NO economic change) (logged 2026-06-17):**

**`LoyaltyTier` gained 4 perks** (`discountPct`, `pointsMultiplier`, `bonusStamps`, `priorityService`) — flat, not nested. Kept field name **`min`** (not renamed to `minLifetimePoints`) to avoid a JSONB data-migration. **`readTiers` → exported pure `sanitizeTiers(arr)`** (reused by read AND the dashboard save): N≤**`MAX_TIERS`=6**, sort by `min`, `tiers[0].min=0`, **fill concrete perk defaults** (so `MemberBalances.tier` always carries all four), clamp (`discountPct 0–100`, `pointsMultiplier 0.1–10` fractional, `bonusStamps 0–20`), **unique non-empty names** (fallback `Seviye {i+1}` — fixes the old `DEFAULT_TIERS[i]` name-collision for N>4). `computeTier`/`getMemberBalances` already N-driven — now return the perk-filled tier.

**ECONOMICS UNCHANGED in 17a:** `computeOrderDiscount` still passes `cfg.member_discount_pct` (NOT `tier.discountPct`); `earnForOrder` untouched. Perks are config+display only until 17b. **member_discount_pct decision:** the engine will switch to `tier.discountPct > 0 ? tier.discountPct : member_discount_pct` in 17b; the key stays in config as the read-time legacy fallback. The standalone "Üye indirimi %" field is **removed from the dashboard UI** (folded into the base tier's discountPct), but its value persists + still drives the discount in 17a.

**Dashboard `LoyaltySection` — dynamic tier editor** (replaces the 4 locked rows): add/remove tier rows (2–6, base tier min locked 0 + un-removable), each with color picker / name / min / 4 perk fields (discount %, puan × step 0.5, bonus damga, öncelikli servis toggle). **Guardrail B — client-side ladder validation:** ascending `min` + unique non-empty names enforced inline (red row + message), **Save disabled when the ladder is invalid**. `saveLoyaltyConfig` (restaurant.ts) runs the SAME `sanitizeTiers` server-side (defense in depth).

**MemberSheet:** tier card shows a **non-default perks chip row** (`%X indirim · Y× puan · +Z damga · öncelikli servis`) from `balances.tier`.

**17a verify:** typecheck 9/9; unit `tier.test.ts` **15** (2/4/6-tier ranking, perk resolution+clamps, N>4 name fallback, sort/dedupe) + stack 10/redeem 6/stampearn 6/loyalty 5/phone 5. **Runtime gate (Test Cafe B, snapshot→restore loyalty config; maf-lounge read-only; member created+destroyed; 13/13):** N=2 ladder lifetime 500 → VIP+perks resolved, **`computeOrderDiscount` memberDiscountPct=10 (member_discount_pct), NOT VIP's 15 → economics unchanged**, lifetime 100 → Standart(0), B config byte-restored. (Guardrail A: snapshot→restore around any tier-mutating test.)

### Sprint 16 — Müşteriler (Customers CRM) 🚧

**16a — core CRM ✅ (2026-06-17). 16b — saved/custom segments ✅ (2026-06-19). 16c — campaign SMS + marketing consent ✅ (2026-06-19). Migrations: `20260618000000_customers_crm.sql`, `20260619000000_customer_segments.sql`, `20260619010000_campaign_sms_marketing.sql`, `20260619020000_marketing_integrations.sql` (db push). PII + money → ALL reads are owner-validated service-role actions hard-filtered by restaurant_id; `customers`/`customer_consents`/campaign recipient/event/config surfaces stay service-role-only where PII/credentials exist. A+B isolation proof 21/21; 16b segment isolation proof passed; 16c marketing-consent runtime gate passed.**

**Phase 16c — campaign SMS + marketing consent (logged 2026-06-19):**

**DB:** new `campaigns` (owner-managed), `campaign_recipients` (service-role-only PII phone snapshots), `message_events` (service-role-only provider/audit events), and `marketing_integrations` (service-role-only provider/İYS config/credentials reserve). `campaigns` stores segment kind + definition snapshot + sent/failed/skipped counters; recipients are only inserted for eligible marketing-consent customers. `db push`, `types:gen`, and `db:status` are complete through `20260619020000`.

**Consent + member UI:** `recordConsent/getConsentStatus` now accept `contact_data | marketing`. Join flow has a required contact/data consent plus a separate optional campaign SMS consent; `verify-otp` records both independently. MemberHome shows separate toggles; `/api/loyalty/consent` updates the requested consent type. **Compliance rule locked:** contact_data consent is NOT marketing consent.

**Provider/data/actions/UI:** `sms.ts` provider interface now sends arbitrary SMS messages; mock remains default/test, with Netgsm/Twilio fetch providers selected by `SMS_PROVIDER`. `campaigns.ts` resolves audiences through the existing restaurant-scoped segment/customer aggregate, then service-role fetches raw phone only for open `marketing` consent rows. Dashboard `lib/actions/campaigns.ts` owner-gates preview/test/send/list; Customers UI adds an SMS campaign modal (segment select → recipient count → message → test send → campaign send) using the same reference-style surfaces without removing saved segments/list/detail features.

**16c runtime gate (isolated throwaway restaurant/customers; mock SMS; cleanup):** all candidates **3**; eligible marketing recipients **1**; skipped no-marketing **2** (contact-only + revoked); test SMS mock-send ✅; campaign recipient rows **1**, sent **1**, failed **0**, skipped **2**; after revoking the final marketing consent, eligible recipients **0**. Typecheck **9/9** and db unit suite **56/56** passed.

**Phase 16b — saved/custom customer segments (logged 2026-06-19):**

**DB + aggregate:** new `customer_segments` table (`restaurant_id`, `name`, `definition jsonb`, `created_by`, timestamps, `deleted_at`) with owner-scoped RLS and no anon policy. Segment definition v1 is flat JSON: `consent: 'granted'|'missing'`; numeric rules `{op:'>='|'<=', value}` for `last_seen_days`, `visits`, `spend`, `points`, `lifetime_points`. `get_restaurant_customers` was recreated with `p_custom_segment jsonb default null`; built-in segments still work, and custom predicates apply on the existing scoped `base` CTE. **Isolation stays the same:** spend/visits/candidate set are filtered by `restaurant_id`; points/lifetime are filtered by `scope_key`.

**Data/actions/UI:** `packages/db/src/customers.ts` now exports `sanitizeCustomerSegmentDefinition`, `list/get/create/update/deleteCustomerSegment`, and typed `SavedCustomerSegment`. Dashboard customer actions keep the owner gate before service-role calls; `listCustomers` accepts `customSegmentId`, fetches it by `(restaurant_id,id)`, and rejects cross-restaurant ids. Customers UI now shows built-in chips plus saved segment chips, supports apply/edit/delete, and has a compact segment editor for consent + numeric rules. “Filtreyi kaydet” seeds from the active saved segment or built-in segment (`frequent → visits>=3`, `lapsed → last_seen_days>=60`, `consented → consent granted`).

**16b runtime gate (isolated throwaway restaurants/customers/orders/ledger; cleanup):** saved segment visible to A = **1**, visible to B = **0**; B fetch A segment id → `null`; A VIP custom segment (`consent granted + spend>=100 + visits>=3 + points>=100`) → **1** customer (`Segment A VIP`); same definition run on B → **1** B-only customer (`Segment B Only`) proving restaurant-local metrics; update segment to `visits<=1` → **1** A light customer; anon `customer_segments` select visible row = **no**; delete → A saved segments **0**. Migration pushed, `types:gen` regenerated, `db:status` local/remote match through `20260619000000`; typecheck 9/9 and db unit suite **56/56** passed.

**Phase 16a — list + detail + store credit + consent (logged 2026-06-17):**

**Consent = PER-RESTAURANT (`customer_consents`, service-role only).** Each işletme is a separate KVKK veri sorumlusu, so açık rıza to A must never expose the customer to B — a global flag would leak. `(customer_id, restaurant_id, consent_type unique)`; **open = `granted_at not null AND revoked_at is null`**. `consent_type` column designed for a future `'marketing'` type (16c İYS); v1 uses one `'contact_data'`. **Capture:** the JoinScreen KVKK checkbox is now a REAL affirmative opt-in — **default UNCHECKED** (pre-ticked consent is invalid), explicit Turkish copy naming the restaurant + KVKK link; `verify-otp` gains `consent:boolean` → `recordConsent(...,'join')`. **Revoke/re-grant:** MemberHome consent control → cookie-scoped `POST /api/loyalty/consent {restaurantId,grant}` → flips owner phone view to masked on next read. `getMemberBalances` now returns `consentGiven`.

**Owner-scoped list = `get_restaurant_customers(p_restaurant_id, p_scope_key, …)` SQL fn (security definer, REVOKED from anon/authenticated).** Aggregates per customer with activity at the venue: **spend = PAID-ONLY** (`paid_at not null`, non-cancelled), **visits** (`Σ visit delta` at restaurant_id), **points/lifetime** (`Σ points delta` at scope_key → tier via `computeTier`). Candidate set + spend + visits scope by `restaurant_id` (venue); points by `scope_key` (per config; coincide for per-restaurant scope, network shares the bucket). Search (name/phone-tail), 4 built-in segment filters (new/frequent/lapsed/consented), sort, pagination + `count(*) over()`.

**Service-role data layer (`packages/db/src/customers.ts`):** `getRestaurantCustomers` (calls the fn, **masks phone in TS** — raw never leaves without consent: `maskPhone()` → `0532 *** ** 67`), `getRestaurantCustomerDetail` (activity-at-venue gate → null/404 otherwise; venue spend/visits + `getMemberBalances` + merged orders+ledger timeline), `grantStoreCredit` (manual `type='points',direction='earn',reason='store_credit[:note]'`, **`granted_by` audit column** = owner uid; activity-gated; v1 GRANT-ONLY, deduct deferred), `recordConsent`/`getConsentStatus`.

**Dashboard (owner-validated actions `lib/actions/customers.ts` — `assertOwner` checks `restaurants.owner_id=auth.uid()` BEFORE any service-role call):** new **Müşteriler** nav (IconRail `I.users`) → `customers/page.tsx` (SSR list → `CustomersClient`: search + segment chips + sort + pagination, row-click → detail) + `customers/[customerId]/page.tsx` (**sub-route**, SSR → `CustomerDetailClient`: profile w/ masked-or-real phone + consent badge, stat tiles, **Puan/Kredi tanımla** form → `grantStoreCreditAction` → `router.refresh()`, activity timeline). No Tailwind (dashboard inline styles + `lib/ui` `I/S/Tag/EmptyState`).

**16a isolation proof (2 isolated restaurants A+B, shared customer C w/ activity at both, consent to A only; created+destroyed; maf-lounge untouched; 21/21):** A list shows C as A-scoped **spend 300 (paid-only, never B's 999) / visits 2 / points 150**; C phone **FULL for A** (consent) but **MASKED for B**; A detail timeline = 4 events (A-only, zero B leak); `grantStoreCredit(A,C,100)` → A 150→250 but **B unchanged 500** + `granted_by` recorded; `getRestaurantCustomerDetail(A, <B-only customer>)` → null; cross-owner `restaurants where id=B and owner_id=A` → 0 rows (assertOwner rejects); **revoke consent at A → `consentGiven=false` + phone flips to masked**. Typecheck 9/9; menu `/maf-lounge` 200; dashboard customers route compiles (307 auth-redirect, 0 build errors).

### Security — Multi-tenant isolation hardening ✅ (2026-06-17)

**Three confirmed cross-tenant holes closed. Migration `20260617000000_security_isolation_fixes.sql` (applied via `db push`). Proven with 2 isolated test restaurants A+B (20/20 cross-tenant probes; maf-lounge read-only, token relocated + loyalty config intact).**

- **GAP #1 (CRITICAL) — kitchen_token was in anon-readable `restaurants.settings`** (the menu reads restaurants with `select('*')` via the ANON client → the secret was serialized into the public page). Fix: new **`kitchen_credentials`** table (owner-scoped RLS, **NO anon**, mirrors `payment_credentials`); migrated tokens out; **stripped `kitchen_token` from `settings`** (`settings - 'kitchen_token'`). A separate table (not a column) was required because `select('*')` would re-expose any restaurants column. `validateKitchenToken` reads the new table (service-role); `generateKitchenToken` upserts it; dashboard SSR (orders/page + settings/page) reads it owner-scoped and threads `kitchenToken` into `SettingsForm`/`KitchenSectionWrapper`.
- **GAP #2 (HIGH) — anon could read every restaurant's last-24h orders incl. `payment_token` + `customer_id`** (+ realtime). Fix: (a) moved the İyzico token to **`order_payment_tokens`** (service-role-only, NOT in the realtime publication) and **dropped `orders.payment_token`** → the secret can't appear on any anon REST/realtime surface; `payment-credentials.ts` attach/resolve rewired (resolve now also returns `restaurantId`). (b) **Column-grant on `orders`**: `revoke select … from anon` + `grant select (<safe cols>) to anon` — **excludes `customer_id`**; the menu only ever selects safe operational columns (verified), so tracking still works. The 24h row policy stays (operational data only now).
- **GAP #3 (HIGH) — kitchen status write was cross-tenant** (`updateOrderStatusDB(orderId)` token-gated on restaurantId but not scoped). Fix: `updateOrderStatusDB`/`markOrderPaidDB` gained a **`restaurantId` arg** → `UPDATE … WHERE id AND restaurant_id` + `.select('id')`; **0 rows → reject** (`'Order not found for this restaurant'`). Callers pass it: kitchen action (token-validated id), dashboard action (owner-verified id), payment callback (token-resolved id; now marks the token-resolved order, not the İyzico-echoed `basketId`).
- **MEDIUM — `/api/orders` slug cross-check**: the order body now carries `slug`; the route resolves slug→restaurant.id (service-role) and **rejects on mismatch** (mirrors `/api/payment`). The client (`MenuPageClient.orderBody`) sends `restaurant.slug`.
- **GAP #4 (HIGH, found 2026-06-17 by the 16a real-auth e2e test) — dashboard SSR ownership gate was bypassable.** `getRestaurantById(id)` (the gate every dashboard SSR page uses via `if (!restaurant) notFound()`) filtered only `id` and relied on RLS — but the public `anon_read_restaurants` SELECT policy lets ANY authenticated user read ANY restaurant row, so the gate passed for another owner's restaurant. Harmless for RLS-gated pages (orders/menu data still owner-filtered), but the **customers pages load data via the service role** → owner A visiting `/dashboard/<B_id>/customers` would have leaked B's customers + phones. Fix: `getRestaurantById` now fetches the auth user and filters **`.eq('owner_id', user.id)`** → null (notFound) for non-owned restaurants. Hardens every dashboard SSR page. Client-side CRM actions were already safe (`assertOwner` filters owner_id). **Lesson: test the real authenticated path, not just service-role/SSR proofs — this hole was invisible to service-role tests.**
- **GAP #4b (same root cause, found 2026-06-17 via the Test Cafe B login) — `getRestaurantsForUser` was also unscoped** (`select('*')` relying on RLS → returned EVERY restaurant via the public read policy). Effects: (a) the post-login redirect `app/dashboard/page.tsx → /dashboard/${restaurants[0].id}/menu` sent every owner to the **oldest** restaurant (maf-lounge), not their own → a NEW owner (Test Cafe B) hit notFound (after the GAP #4 fix) / would have silently landed on maf's dashboard (before it); (b) the store switcher (`[restaurantId]/layout.tsx`) listed all venues. Fix: same `.eq('owner_id', user.id)` filter → returns only owned restaurants. Verified real-auth: B's login now resolves only Test Cafe B → redirect to its own dashboard.
- **Residual/update:** `customer_id` is blocked on the anon REST path (column-grant, proven); Supabase Realtime "Postgres Changes" also honors column privileges so it's stripped there too. `anon_read_recent_orders` still allows anon to read SAFE columns of any restaurant's 24h orders (no anon identity to scope by) — operational data only, no secrets/PII. The old `anyone_create_order insert check(true)` residual was closed in Sprint 18b (`20260618030000_close_orders_anon_insert.sql`); customer orders now go through `/api/orders` service-role creation. **owners still cannot read `customers` (service-role only) → phone PII isolation unchanged.**

### Sprint 15 — Tiers + Visits + Reward Catalog + Rich Member Home ✅

**Design ref: `ref/Membership_Loyalty.html` (join/OTP/member-home, 8 keyframes, 4 tiers, rewards, activity). 15a = tiers + lifetime points + visits + welcome bonus (data + config) ✅ (2026-06-15). 15b = rich member-home UI rebuild ✅ (2026-06-15). 15c = reward catalog redemption ✅ (2026-06-16). Sprint 15 COMPLETE. NOTE: theme-tokenized palette (var(--p-*)) + fixed gold #c8922a — NOT hard-coded green.**

**Phase 15c — reward catalog redemption (logged 2026-06-16):**

**Catalog reward = redeem points → ONE free unit of a specific item (full item price off the bill), debiting a config-set `pointCost` in points.** `pointCost` is re-read SERVER-SIDE from `settings.loyalty.reward_catalog` (never trusted from client; the only client input is `catalogItemId`).

**Migration `20260616000000_loyalty_phase5_catalog.sql` (applied via `db push`):** `redeem_loyalty` gains `p_points_exact boolean default false` (DROP 7-arg → CREATE 8-arg, re-revoke from anon/auth). **EXACT mode = all-or-nothing on the points slot** (`v_points_bal >= p_points ? p_points : 0`) — required because a catalog `pointCost` is arbitrary (not a ₺-multiple) and the free item must be cleanly VOIDED, not partially paid, when a concurrent order drains the balance. Points-as-₺ keeps the partial whole-₺ path (`p_points_exact=false`). One points slot suffices because of either/or.

**EITHER/OR (locked):** at most ONE points redemption path per order — catalog reward OR points-as-₺, never both. `computeOrderDiscount`: when a catalog reward is claimed, `requestedPoints` is forced 0 (catalog IS the points spend). Stamp-free (stamps) + member-% still STACK. **Order of ops: stamp-free → catalog-free → member-% → points-as-₺** (`computeDiscountStack` gained an optional `catalogDiscountAmount` slot between stamp and member-%; both free-item slots come off at full price first; unit-tested `stack.test.ts`, 10).

**Engine (`computeOrderDiscount`):** new input `requestedCatalogReward?: {itemId}`. Eligible only if member + points_enabled + itemId in `reward_catalog` + that item in cart + `balances.points >= pointCost`; else clamp to no-claim. Produces `catalogDiscountAmount` (= item DB price), `catalogPointsCost` (exact debit), `catalogItemName/Id`. **createOrder**: points slot = `catalogActive ? catalogPointsCost : pointsRedeemed`, `pointsExact = catalogActive`; after the RPC, **re-stack from actual debits** — `catalogClaimed = pointsDebited >= catalogPointsCost`, a voided catalog → free item removed + `orders.total` corrected (`clamped`). `redeemForOrder` gained `pointsExact`. Breakdown carries `catalogDiscountAmount/catalogPointsRedeemed/catalogItemName`.

**Routes:** `catalogItemId` threaded through `preview-discount` + `/api/orders` (guests forced null). İyzico/table-bill auto-reflect via `orders.total`; the 3a clamp/re-confirm (`window.confirm` on increase) covers catalog clamps too.

**Dashboard (LoyaltySection):** new **Ödül kataloğu** editor under the points section (item `<select>` + pointCost + tag + remove + "Ödül ekle"); item choices now load when stamps OR points enabled. `saveLoyaltyConfig` validates EVERY `reward_catalog` itemId belongs to the restaurant + pointCost>0 (drops invalid/dupes, clamps tag to 24 chars). Config types in `loyalty-config.ts` (+`CatalogReward`, `reward_catalog`), threaded through `SettingsForm`.

**Customer UI:** MemberSheet **RewardsSheet** "Yakında" → real **Kullan** (enabled when `points >= pointCost`, else "Yetersiz"); on Kullan, `onRedeemCatalog(itemId)` → MenuPageClient **auto-adds the reward item to the cart if missing** (cleaner one-tap UX), sets `catalogItemId`, drops points-as-₺, opens the cart. **CartDrawer**: catalog-claim banner "🎁 Bedava [ürün] · X puan" + **Vazgeç**, a breakdown line "🎁 Ödül: [ürün] −₺X", and the points-₺ slider is HIDDEN while a catalog reward is active (client-side either/or, server-enforced too). `catalogItemId` auto-clears if the reward item leaves the cart, and resets after placement/logout. `CatalogChoice` gained `itemId`.

**ACTIVITY:** catalog redemption appears as a generic points-redeem row (reason='redeem' → label "Puan kullandın"); item-name labels deferred (would need an order join).

**15c runtime gate (ISOLATED test restaurant via real `createOrder`; created+destroyed; maf-lounge byte-identical; 35/35):** A happy path (claim coffee ₺50 free, debit EXACT 200, spendable 600→400, lifetime 600 + tier UNCHANGED, 1 redeem row −200); B either/or (catalog+300pts requested → only catalog, points-₺ suppressed, 1 debit); C reward not in cart → clamp/no debit; D insufficient points (<cost) → clamp; E item not in catalog → clamp; F **2 concurrent claims, balance exactly 200 → exactly ONE free item, other voided to subtotal, balance 0 never negative, 1 redeem row** (advisory lock + all-or-nothing); G guest → no redemption; H catalog + member-10% stack (−50 then −10 on post-catalog 100 → ₺90). Unit 40/40 (stack.test.ts catalog slot). Typecheck 9/9. Compile/serve via read-only `GET /maf-lounge` (200, 0 error signatures). 0 orphan artifacts.

**Phase 15a — tiers + visits + welcome bonus (logged 2026-06-15):**

**Migration `20260615000000_loyalty_phase4.sql` (applied via `db push`):** extended the type CHECK to `('stamp','points','visit')`; added `loyalty_transactions.session_id uuid` (FK table_sessions, on delete set null); **VISIT IDEMPOTENCY = `unique(session_id, customer_id, type) where session_id is not null`** — a session closed once credits each member exactly once. Tiers/catalog/welcome_bonus_points are JSONB config (no columns); welcome idempotency is **app-layer** (guard on existing `(customer_id, scope_key, reason='welcome')` row).

**Spendable vs LIFETIME points (the critical distinction):** `getMemberBalances` now returns `points` (SPENDABLE = Σ earn−redeem) AND `lifetimePoints` (Σ points WHERE direction='earn', never reduced by redemption). **Tier is driven by lifetimePoints, NOT spendable** — redeeming never drops tier. Also returns `visits`, `tier`, `tierIndex`, `nextTier`, `tierProgress`.

**Tiers:** `settings.loyalty.tiers` = `[{name,min,color}]`, 4 fixed names (Bronz 0 / Gümüş 500 / Altın 1000 / Platin 2500 default, thresholds configurable). Pure `computeTier(lifetimePoints, tiers)` (unit-tested `tier.test.ts`, 8) — highest tier with min ≤ lifetime; `tierProgress` is **band-relative** (`(lp−tier.min)/(next.min−tier.min)`) and **floored** (never shows 100% before promotion). `readLoyaltyConfig` sanitizes tiers (sort by min, Tier[0].min forced 0) + reads `reward_catalog` (15c) + `welcome_bonus_points`.

**Visits:** `creditVisitsForSession(sessionId)` (packages/db, service-role, **best-effort try/catch — never blocks the close**) credits +1 visit (`type='visit',delta=1,direction='earn',session_id`) to each DISTINCT member with a non-cancelled order in the session; `on conflict (session_id,customer_id,type) do nothing`. Wired into BOTH `closeTableSession` AND `deleteTable`'s session-close (tables.ts). Guest-only/empty session → 0 visits.

**Welcome bonus:** `creditWelcomeBonus(customerId, restaurantId)` (best-effort) credits `welcome_bonus_points` once (type='points', direction='earn', reason='welcome') — app-layer guard skips if a welcome row already exists for (customer, scope). Wired into `/api/loyalty/verify-otp` (now takes optional `restaurantId`; MemberSheet sends `restaurant.id`). Single-use OTP codes make a second verify a separate call that finds the existing row → no double.

**Dashboard (LoyaltySection):** config types extracted to `apps/dashboard/components/settings/loyalty-config.ts`. Added tier-thresholds editor (4 rows, Bronz locked at 0) + welcome-bonus field. Saves via existing `saveLoyaltyConfig` (extra JSONB keys pass through).

**15a runtime gate (ISOLATED test restaurant — own auth user + 2 tables + menu, created+destroyed; maf-lounge UNTOUCHED; 14/14):** 2-member session close → each +1 visit (guest order in same session → 0); re-fire close → still 1 each (idempotency key); guest-only session → 0; seed earn 500 → tier Gümüş, then redeem −200 → spendable 300 but lifetime 500 + tier Gümüş UNCHANGED; welcome +100 once, second call no double (1 row); tier boundary 499→Bronz / 500→Gümüş / 1000→Altın. Unit: 36/36 (incl. tier.test.ts). **Runtime fixtures must use run-unique phones + URL-encode `+` as `%2B` in PostgREST `like` filters.**

**Phase 15b — rich member-home UI (logged 2026-06-15):**

**Display-only rebuild — NO engine/economy change, NO migration, NO new route.** `getMemberBalances` already surfaces everything the UI binds to (extended for 15b): `memberCode` (deterministic `GRS-XXXX-XXXX` from the customer UUID — `replaceAll('-','').slice(0,8)` upper, dash-split), `joinedAt`, and `recentActivity` (last 8 ledger rows as `LoyaltyActivity {id,type,direction,delta,reason,createdAt}`, newest-first). **So activity needs NO separate `getMemberActivity` route — it rides on `/api/loyalty/balances`.** Activity labels are reason/type/direction-derived (welcome→"Hoş geldin bonusu", points earn/redeem→"Puan kazandın/kullandın", stamp→"Damga kazandın/Bedava ürün", visit→"Ziyaret"); item-name labels would need an order join → deferred (kept display-only).

**`MemberSheet.tsx` fully rebuilt (apps/menu) into a tall bottom-sheet (92vh) with three screens + two nested sheets:** **JoinScreen** (name + phone + KVKK consent checkbox gating the button + perk chips + ring-expand hero; button suffix "& X puan kazan" only when `welcome_bonus_points>0`; "Şimdilik geç"→close as guest), **OTPScreen** (6-box paste/auto-advance/backspace nav, real **60s** resend cooldown, error state clears+refocuses, dev-code hint + auto-prefill in dev, Spinner; wires real request-otp/verify-otp with `restaurantId`), **MemberHome** (membership card: tier badge+`tier.color` dot, shimmer, `tierProgress` bar + "{nextTier.min−lifetime} puan kaldı", member name + `memberCode`; Stats Puan ⭐=**spendable** + Ziyaret 🏆=visits with countUp; stamp card real `stamps/stampGoal`, 5-col dots, 🎁 on last cell, stampPop on newest, NO demo "+Damga"; rewards teaser → sheet; SON HAREKETLER activity feed w/ relative-time + empty state; "Üyelikten çık"). **RewardsSheet** is a nested overlay. (A member-QR strip + QRSheet were built in 15b via `qrcode.react`, then REMOVED 2026-06-16 — with no scan-to-credit flow the QR opened to nothing, so per user it added no value; `qrcode.react` uninstalled.) Catalog redemption deferred → reward buttons showed "Yakında" (made real in 15c). **MemberHome shows a loading spinner until balances arrive** (after verify, parent refetches then re-renders the sheet).

**Palette/animation:** reference's hard-coded greens → local `--ml-*` vars mapped onto the live theme (`--ml-accent: var(--p-accent)`, `--ml-accent2: color-mix(in srgb, var(--p-accent) 80%, #000)`, `--ml-surface: var(--p-card)`, …) + fixed `--ml-gold: #c8922a` for tier/reward accents, set on the sheet root so the card adapts per-restaurant. All **8 keyframes ported with `ml-` prefix** (ml-pulse-dot/fade-slide/stamp-pop/shimmer/count-up/sheet-up/ring-expand/confetti-drop) + ml-spin, injected via a `<style>` block. **CSS custom-property keys need `as React.CSSProperties` cast** (this @types/react rejects them in a typed literal).

**Wiring:** MenuPageClient resolves `reward_catalog` (config `{itemId,pointCost,tag}` → `{name (from live menu items),pointCost,tag}`, dangling itemIds filtered) + reads `welcome_bonus_points`, passes `restaurantName/welcomeBonus/rewardCatalog` to MemberSheet. **Header chip is tier-aware** — `memberSummary.tierColor` (= `tier.color`) renders a small dot on the compact chip.

**15b gate (ISOLATED test restaurant, created+destroyed; maf-lounge byte-identical; 23/23 data assertions + compile/serve):** seeded welcome+earn+stamp+visit+redeem ledger → `getMemberBalances` returns memberCode `GRS-####-####`, spendable 550 vs lifetime 600, tier Gümüş + progress 20 + color carried, visits 1, stamps 3, 5 activity rows newest-first with correct labels; reward-catalog resolution drops the dangling itemId (2→1). Compile/serve proven by a read-only `GET /maf-lounge` (200, SSR, 0 Next error signatures) forcing the `[slug]`→MemberSheet chain to build. 0 orphan artifacts. Typecheck 9/9 green.

### Sprint 14 — Üyelik + Sadakat (Membership & Loyalty) 🚧

**Phase 1 (2026-06-13) — identity + OTP. Phase 2 (2026-06-14) — earning ledger + balances. Phase 3 — redemption + member discount: 3a points→cart discount ✅ + 3b member auto-% ✅ + 3c stamp→free item ✅ (2026-06-14/15). Sprint 14 COMPLETE.**

**Phase 3c — stamp → free item (logged 2026-06-15):** when a member's stamp balance ≥ `stamp_goal`, they claim ONE free unit of the configured `reward_item_id` in cart (full price off). **NO migration** — `reward_item_id` lives in `settings.loyalty` JSONB; the `redeem_loyalty` RPC already does all-or-nothing stamp debit + advisory lock. Order of ops (final): **stamp-free → member-% → points** — free unit comes off at FULL price first. Engine (`computeOrderDiscount`): `requestedStampClaim` eligible only if member + stamp_enabled + `stamps≥stamp_goal` + `reward_item_id` set + **reward item actually in cart** (else clamped to no-claim); `stampDiscountAmount = DB reward price`, `stampsConsumed = stamp_goal`. createOrder passes `stamps` to the RPC, then **re-stacks from actual debits** (a clamped stamp claim changes the member-% base, so re-stack not patch). **CRITICAL re-earn fix:** `earnForOrder` queries the order's redeem stamp ledger row (`direction='redeem',type='stamp'`); if present (free claimed), `computeStampEarn` subtracts 1 from the reward item's earn so the free unit doesn't re-earn a stamp (edge: order 1 reward unit + claim → earn 0). Config: `LoyaltySection` reward-item `<select>` (items fetched via `getRewardItemChoices`, owner-validated); save via new `saveLoyaltyConfig` which **validates reward_item_id belongs to the restaurant** (clamps invalid→null). Cart: "🎁 Bedava [ürün] ekle" toggle when card full + reward in cart, nudge "Kartın doldu! [ürün] ekle" when full but not in cart, "Bedava [ürün] −₺X" breakdown line. **Runtime (ISOLATED test restaurant — own auth user + menu, created+deleted, maf-lounge untouched; 12/12):** claim free coffee → −₺50 full then member −₺4 → ₺36, stamp ledger −3; free unit no re-earn (1 coffee+claim → 0 earn stamp); claim w/o reward in cart → no discount/no debit; stamp+member%+points stacked → −50/−4/−5 = ₺31 with both redeem rows; double-claim concurrent → only one card debited (advisory lock); guest → no claim. Unit tests: `computeStampEarn` (stampearn.test.ts, 6) + `computeDiscountStack` (stack.test.ts) cover the stack + re-earn.

**Phase 3b — member auto-discount (logged 2026-06-14):** every logged-in member gets `member_discount_pct` off automatically (standing campaign; no opt-in, no ledger row — a price reduction, NOT a balance debit). **NO migration.** Filled the member-% slot in `computeOrderDiscount` via a new pure `computeDiscountStack()` (unit-tested `stack.test.ts`) implementing the locked order **stamp-free → member-% → points-last**: member-% = `floor(afterStamp * pct/100)` (floored to whole ₺) on the post-stamp amount; points then come off the remainder; `finalTotal = max(0, subtotal − stamp − member − points)`. `member_discount_pct` clamped 0–100 on read AND on save (LoyaltySection). Earning still on `finalTotal`. Preview endpoint + `OrderDiscountBreakdown` now carry `memberDiscountPct`; CartDrawer shows an "Üye indirimi %X" line above the points line; MenuPageClient previews when `member && (canRedeem || memberPct>0)` so members with no points still see the discount. **Runtime (maf-lounge, real createOrder, 8/8):** member 10% no points → ₺185→₺167, **0 ledger rows**; member 10% + redeem 50pts → −₺18 then −₺5 = ₺162, only the points −50 redeem row in ledger (member-% writes nothing); guest → no discount; pct=0 → normal total. Member-% is purely a price reduction — only points/stamp redemption debits the ledger.

**Phase 3a — points → cart discount (logged 2026-06-14):**

**Server is the source of truth for money** — discounts are computed/validated server-side; client only previews. `orders.total` and the İyzico amount both come from the server recompute.

**Migration `20260614020000_loyalty_phase3a.sql`:** added `loyalty_transactions.direction text ('earn'|'redeem')`; **dropped `unique(order_id,type)`, created `unique(order_id,type,direction)`** so an earn-points row and a redeem-points row coexist on one order, each idempotent. `redeem_loyalty(...)` RPC (service-role only, `revoke ... from anon, authenticated`): **`pg_advisory_xact_lock(hashtext(customer||scope))`** serializes redemptions per customer+scope (double-spend safe), debits points in whole-₺ multiples, stamps all-or-nothing. `earnForOrder` now inserts `direction:'earn'` with `onConflict 'order_id,type,direction'`.

**Canonical points formula (pinned):** `points_redeem_rate` = **points needed for ₺1** (e.g. 10 → 10 puan = ₺1). ₺-value = `floor(points/rate)`; consumed = `₺ × rate`. Dashboard label: "Kaç puan = ₺1 indirim". `computePointsRedemption()` is the single source (unit-tested `redeem.test.ts`), used by both preview and placement — no client money math.

**Order of operations (forward-compat for 3b/3c):** stamp-free → member-% → **points last**; `finalTotal = max(0, subtotal − stamp − member% − points)`. 3a wires points only (member/stamp = 0). **Earning computes on `finalTotal`** (amount actually paid; storing finalTotal as `orders.total` gives this for free — no farm loop).

**`computeOrderDiscount()` (packages/db, read-only):** recomputes **subtotal from DB `menu_items.price`** (not client prices — closes a tamper hole; modifier deltas still client-supplied, flagged residual), validates redemption vs real balance, clamps. Used by `POST /api/loyalty/preview-discount` (cart preview) AND `createOrder`.

**`createOrder` rewritten** (`lines` + `customerId` + `redeemPoints`, returns `{ orderId, breakdown }`): compute → insert with optimistic finalTotal → `redeem_loyalty` RPC (debit) → if clamped under concurrency, recompute + `UPDATE orders.total`. `/api/orders` returns the authoritative breakdown. **`/api/payment` now reads `orders.total` from the DB** for the İyzico amount (was client `total` — pre-existing hole, fixed). Table-bill auto-reflects discounts (sums `orders.total`).

**Divergence UX (addition C):** `/api/orders` returns `breakdown.clamped`. Pay-first re-confirms via `window.confirm` if the amount increased beyond the previewed total before opening İyzico — never silently overcharges.

**Cancel refund update:** the old warning-only cancel guard was superseded in Sprint 19a. `updateOrderStatusDB(...,'cancelled')` now writes idempotent positive `direction='refund'` ledger rows for prior redeem rows; redeem rows stay queryable by `order_id`.

**Cart UI:** CartDrawer gains a "⭐ Puan kullan" stepper (₺, capped by balance-value and bill) + "Tümünü kullan" + discount line + server-preview total. MenuPageClient: debounced preview call, `redeemPoints` threaded into both place-order and pay-first, balances refetched after placement.

**3a runtime gate (maf-lounge, real `createOrder`/`markOrderPaidDB`, all ✅):** redeem 50 pts (rate 10) → orders.total ₺185→₺180; tamper (redeem 999999 / client price 999) → clamped to balance ₺50, charged ₺135, client ignored; double-spend (2 concurrent ×100 pts, balance 100) → debited 100/100, balance 0, never negative; earn+redeem one order → both rows (−50 redeem, +180 earn), balance net-correct; guest → no discount, 0 rows; anon → RPC 401 + ledger 0 rows. 14/14 assertions. **Ops:** applied via `db push` (CLI linked; `SUPABASE_DB_URL` still empty).

**Phase 2 — earning ledger + balances (logged 2026-06-14):**

**Schema (`20260614010000_loyalty_phase2.sql`, applied via `migration repair` + `db push` — see ops):** `loyalty_transactions` (customer_id, restaurant_id=earning venue, **scope_key**=balance bucket, order_id, type `stamp`|`points`, delta int, reason, created_at) — **balance = sum(delta)**, never a stored balance. Idempotency = `unique(order_id, type) where order_id not null`. `menu_items.earns_stamp boolean default false`. RLS: owner SELECT own-venue rows; **no anon, writes service-role only** (probe: anon 0 rows even with a real row, service 1).

**Stamp model = per-item, ONE aggregated row.** `delta = Σ quantity` of order lines whose `menu_items.earns_stamp` (3 coffees → one stamp row delta=3, not 1). Keeps `unique(order_id,'stamp')`; per-item detail already lives in `orders.items` JSON. **No `order_items` table — items are JSONB** `[{itemId, quantity, …}]`; the "join" is JSON-parse + one `menu_items.in(ids).eq(earns_stamp,true)` lookup. Points = `floor(orders.total * points_per_lira)`.

**Earning seam (`packages/db/src/orders-update.ts` → `loyalty.earnForOrder(orderId, trigger)`):** `markOrderPaidDB`→`earnForOrder('paid')`; `updateOrderStatusDB`→`earnForOrder('served')` **only when status==='served'**. Both funnel through here (dashboard + kitchen + payment callback), so all callers earn with no per-app change. **Best-effort: try/catch, logs, NEVER throws** — a loyalty failure can't break the paid/served write. Gated by `cfg.earn_trigger`, so only the configured trigger credits; the unique index neutralizes paid→served / realtime retries / kitchen re-flips. Reads order total/items/customer_id from the DB (never client input → can't inflate points). `scope_key`: per-restaurant=restaurant_id, network=`NETWORK_SCOPE_KEY` zero-UUID. Pure helpers `computeStampDelta`/`computePointsDelta` are unit-tested (`loyalty.test.ts`).

**Order→member link (REQUIRED for earning):** `/api/orders` now reads the httpOnly cookie → `verifyCustomerSession` → passes `customerId` to `createOrder` (sets `orders.customer_id`). Covers **both** place-order and pay-first (one route). No cookie → guest → `customer_id` null, order still succeeds, earns nothing.

**Balance read:** `getMemberBalances(customerId, restaurantId)` (service-role, scoped) → `{ stamps, points, stampGoal, stampRewardText, stampUnlocked, stampEnabled, pointsEnabled }`. SSR: `page.tsx` (cookie) → `initialMemberBalances`. Live: **`GET /api/loyalty/balances?restaurantId=`** (cookie-scoped) — the menu refetches it when the member's own order fires its earning trigger via the existing realtime order channel (no new anon channel; anon RLS blocks the ledger).

**UI:** Header member chip shows `☕ 3/10` (stamp priority) / `⭐ pts` / "Üye ol" entry. `MemberSheet` gains a balance view (stamp dots `◐◐◐○○`, reward text, "🎉 Ödülün hazır!" when unlocked, points) — display only, verify flow kept for non-members. Promo-slider **loyalty slide connected to real data** via `memberLoyalty` prop threaded `ThemeMenuPageProps→renderCustomSection→PromoSliderBlock` (logged-in→real filled/total; else configured demo). Dashboard MenuManager `ItemEditPanel` → "Sadakat" → **Damga kazandırır** toggle (`earns_stamp`, via existing `updateItem` + zod).

**Runtime proof (maf-lounge, real `markOrderPaidDB`→`earnForOrder` path):** 3 coffees → **stamp delta 3** (not 1) + points 555; **double-fire** (paid retry + served) → still exactly 1 stamp(3) + 1 points row; `getMemberBalances` stamps=3; guest order → 0 rows. SSR with member cookie: chip `☕ 3/10` + slide real `3/10`; anon: "Üye ol" + slide demo `6/10`. All test data reverted.

**Ops:** `SUPABASE_DB_URL` still empty. The CLI **is** linked (types:gen `--linked` works); Phase 1 tables existed remotely but weren't in CLI tracking, so: `supabase migration repair --status applied 20260614000000` then `echo y | supabase db push` applied Phase 2. (SQL editor also works.) Regen types after: `pnpm --filter @garsonless/db types:gen`.

**Identity (global):** `customers` (id, phone unique E.164, name?, verified_at) — ONE phone = one customer platform-wide. `otp_codes` (phone, code_hash sha256, ip, attempts, expires_at, consumed_at). `orders.customer_id` nullable FK (guests stay null). Migration `20260614000000_loyalty_phase1.sql`. **Both tables carry NO anon/authenticated RLS → service-role only** (phone is PII, same discipline as `payment_credentials`); proven via probe: anon reads 0 even with a real row present, service-role reads it.

**Shared `packages/db` modules:** `phone.ts` `normalizePhone()` (centralized E.164, default +90; TR messy variants `0532…`/`532…`/`+90…`/`0090…`/spaces/dashes all → `+905XXXXXXXXX`; 5/5 unit tests via `npx tsx --test src/phone.test.ts`) · `sms.ts` `SmsProvider` iface + `MockSmsProvider` + `getSmsProvider()` (env `SMS_PROVIDER`, default mock) · `loyalty.ts` `requestOtp`/`verifyOtp` (sha256 hashing, customer upsert preserving existing name) · `session.ts` jose HS256 JWT (identity only), `CUSTOMER_SESSION_COOKIE = 'gl_member'`.

**OTP rate limits (locked, enforced via recent-row counts on `otp_codes`):** per-phone **3 / 15 min** + **60 s cooldown**; per-IP **10 / 15 min**; TTL **5 min**; **5** verify attempts then code burned. Throttle → friendly TR + 429, never reveals whether the phone exists.

**Customer session:** signed JWT in **httpOnly, Path=/ (menu app only), SameSite=Lax, Secure-in-prod** cookie — NOT a Supabase Auth user. Carries identity only (never balances). `page.tsx` reads the cookie server-side → `verifyCustomerSession` → service-role fetch of name → `initialMember` to MenuPageClient. **Dev OTP echo strictly gated `NODE_ENV !== 'production'`** (request-otp returns `devCode` only in dev).

**Routes:** `apps/menu/app/api/loyalty/request-otp` + `verify-otp` (service role). **Env (menu .env.local):** `CUSTOMER_SESSION_SECRET` + `SMS_PROVIDER=mock`, documented.

**UI:** Dashboard Settings → **Sadakat** section (`LoyaltySection.tsx`, registered in `SettingsForm`): stamp/points toggles, thresholds, `scope` (restaurant|network), `earn_trigger` (paid|served), `member_discount_pct`, reward text → saved via `updateSettings(restaurantId, { loyalty })` (owner-validated, merged into `restaurants.settings` JSONB — non-secret display/calc values, anon-readable OK). Menu **Header member chip** (`memberSummary`/`onOpenMember` threaded through `ThemeMenuPageProps` → Header; renders only when loyalty enabled) → **verify-only `MemberSheet`** (phone → OTP, dev code auto-fills → optional name → "Üye oldunuz ✓"; NO balance yet).

**Ops:** `SUPABASE_DB_URL` is EMPTY in dashboard .env.local and no supabase CLI login → **migrations applied via the Supabase SQL editor** (service-role key can't run DDL). `types:gen` works (`--linked`). Runtime proof on maf-lounge: enabled loyalty → request-otp (dev code echoed) → verify-otp → `customers` row created with `verified_at` + httpOnly cookie; cookie round-trips into SSR chip ("Test Üye"); test data + loyalty setting reverted.

**Phase 2 (next):** `loyalty_transactions` ledger (idempotent `unique(order_id,type)`, `scope_key` bucket) · `earnForOrder` hook in `orders-update.ts` (both `markOrderPaidDB`/`updateOrderStatusDB` funnel here) · balance display + connect promo-slider loyalty slide to real data. **Phase 3:** redemption + member discount at checkout.

---

### Sprint 12 — Payments as Data + Table Sessions 🚧

**Logged 2026-06-12**

**Payment is a column, not a status:**
- `orders.paid_at timestamptz` — İyzico callback sets ONLY paid_at via `markOrderPaidDB`; status stays in its kitchen stage. `'paid'` remains in the status CHECK for legacy rows; Kanban/KDS map legacy `paid` like `sent_to_kitchen`. ÖDENDİ chips everywhere read `paid_at != null || status==='paid'`.
- Per-restaurant İyzico credentials: `payment_credentials` table (**NO anon RLS**; menu routes read via service role), sandbox/live mode → baseUrl, dashboard Settings→Payments real (masked last4, test via `apiTest`). `serverExternalPackages: ['iyzipay']` required in BOTH menu and dashboard next.config (SDK reads its resources dir at runtime). iyzipay API: `checkoutFormInitialize.create` / `checkoutForm.retrieve` (no `.initialize`, no `checkoutFormRetrieve`).
- Callback flow: init writes `orders.payment_token` → callback resolves token→order→restaurant→credentials server-side, returns HTML page that postMessages `{type:'PAYMENT_SUCCESS'|'PAYMENT_FAILED'}` to the PaymentModal iframe (origin-checked). Local testing needs a cloudflared tunnel + `NEXT_PUBLIC_MENU_URL` (menu and callback must share the tunnel origin).

**Table sessions (adisyon):**
- `table_sessions` + `orders.table_session_id` — ⚠️ `orders.session_id` is the DEVICE/cart session (KPIs use it); do not confuse.
- `open_or_get_table_session(restaurant_id, table_id)` RPC: lazy-open on first order, partial-unique-index race resolution, 8h-inactivity lazy auto-close. **EXECUTE revoked from anon/authenticated — service-role only.**
- Customer: Header "Hesap · ₺X" chip + CartDrawer row → `TableBillSheet` (per-order status/ÖDENDİ, paid/unpaid breakdown); live via realtime filter `table_session_id=eq.{id}`; refresh-on-open detects restaurant close ("Adisyon kapatıldı"). Dashboard: TablesNav session chip + "Kapat" (unpaid override confirm); `deleteTable` closes open session.

**Anon RLS (realtime depends on these — postgres_changes respects RLS):**
- `anon_read_recent_orders`: orders SELECT, 24h window (without it customer realtime got zero events)
- `anon_read_open_table_sessions`: open sessions only
- `supabase_realtime` publication includes `orders` (added 2026-06-11; was missing entirely)

**Order bubble flow:** OrderConfirmation (sheet, ref-design) minimizes to `OrderBubble` (progress arc + unseen badge) + `OrderToastNotification`; `useOrderStore` persists `{orderId, meta, view}` to localStorage `'garsonless-active-order'`, restore re-fetches status (6h TTL, served/cancelled clears silently, never restores into sheet). Realtime callback carries `(status, paidAt)`. Browser supabase client is a singleton — channel topics must be unique per subscriber.

**Ops notes:** project lives at `~/dev/gersonless` (moved off `~/Desktop` 2026-06-13 to stop iCloud creating `"file 2"` duplicates that broke `.next` typecheck and silently split `MenuPageClient.tsx`). Supabase CLI migration tracking repaired (`supabase migration repair`); use `supabase db push` from `packages/db`. `gen_random_uuid()` in new migrations (not `uuid_generate_v4`).

**Backlog:** Garson çağır (OrderConfirmation'da TODO yorumu) · pg_cron gerçek auto-close · Spain theme section renderers · ThemeEditorClient (~4400 satır) + default MenuPage (~2000 satır) refactor · Settings remaining stubs (Team/Workspace team mgmt, Billing real plan/usage, session-timeout/IP-restriction if ever needed) · üyelik + sadakat katmanı.

---

### Sprint 11 — Theme Registry + Section Library 🚧

**Started ~2026-06 (logged 2026-06-10)**

**Architecture shift:** Theme Registry replaces single-theme rendering. `packages/ui/src/themes/` → `THEME_REGISTRY` dict (templateId → `{ id, name, SETTINGS_SCHEMA, THEME_DEFAULTS, MenuPage }`). Themes: `default` (full, ~2000 lines), `spain` (partial — lists 15 section ids in `CUSTOM_SECTION_IDS` but no custom renderers). Editor is `apps/dashboard/components/theme/ThemeEditorClient.tsx` (~4300 lines, needs splitting).

**New app:** `apps/marketing` (port 3003) — company/solutions/resources/legal pages.

**Section library (16 sections):** registered in `SECTION_LIBRARY` + `SECTION_SETTING_SCHEMA` (ThemeEditorClient) + dispatch branches in `renderCustomSection` (default MenuPage). Settings stored as `theme.sectionSettings[sectionId]: Record<string,string>`; page order in `theme.pageBlocks`.

**Key sections built this sprint:**
- `daily-special` (Günün Özeli): product-select dropdown, corner ribbon (scrolling text, corner/size/speed configurable), real HH:MM:SS countdown; when timer expires the whole section unmounts (`DailySpecialOuter` returns null). Discounted price flows to cart: `CartItem.originalPrice`, `addItem(item, mods, groups, qty, originalPrice?)`, CartDrawer shows strikethrough + "İndirimli" badge; cart auto-opens after quick-add.
- `promo-slider` (Kampanya Slider): 5 slide types (coupon+copy, flash countdown, freebie→category scroll, loyalty stamps, combo w/ auto discount %). Infinite loop via clone-of-first-slide technique (pos 0..N, snap to 0 after clone animation). Slides fit 150px height. Defaults: coupon+flash+combo enabled with no saved settings (`bool(key, true)` fallbacks).

**Editor field-type infra:** `SectionFieldType` = text | textarea | color | range | select | url | toggle | `product-select` (grouped by category) | `category-select` | `heading` (panel divider). Per-slide conditional hiding in `SectionSettingsEditor` (promo-slider only, detected via `couponHeading` key). Logo styling fields (`logoShape/logoShadow/logoBorder/logoBg`) + visual pickers for cols/logoShape.

**DB types:** `types.gen.ts` is pure generated output now (regen with `pnpm types:gen`); hand-maintained `OrderStatus`/`RestaurantPlan` unions moved to `packages/db/src/enums.ts`. `order.status` is `string` in generated types — cast `as OrderStatus` at use sites (OrderBoard, OrderBoardDnd, OrderCard, KitchenBoard, KitchenCard).

**Menu app:** runs on port **3011** (not 3001). Preview URL: `localhost:3011/{slug}?preview=1&template={templateId}`.

---

### Sprint 10 — Theme Diversity — Structural Variants 🚧

**Started 2026-05-25**

**Goal:** Maximum visual diversity between AI-generated themes via 6 new structural fields: `headerLayout`, `categoryDisplay`, `cardStyle`, `itemNameStyle`, `priceDisplay`, `sectionHeading`. 8 personality preset templates replace the original 8.

**New fields:**
- `headerLayout: 'classic' | 'hero' | 'minimal-strip' | 'transparent'` — fundamentally changes header structure
- `categoryDisplay: 'horizontal' | 'none' | 'fullscreen-tabs' | 'sidebar-fixed'` — full page geometry change
- `cardStyle: 'default' | 'borderless' | 'image-hero' | 'pill-row'` — card surface treatment
- `itemNameStyle: 'accent' | 'dark' | 'large'` — name color/size override
- `priceDisplay: 'right' | 'below' | 'pill'` — price placement
- `sectionHeading: 'accent' | 'editorial' | 'catalog'` — section header style

**Files changed:**
- `packages/design-engine/src/schema.ts` — 6 new fields in GarsonlessTheme + DEFAULT_THEME
- `packages/ui/src/menu/Header.tsx` — headerLayout branches (hero, minimal-strip, transparent, classic)
- `packages/ui/src/menu/ProductCard.tsx` — cardStyle, itemNameStyle, priceDisplay
- `packages/ui/src/menu/CategoryNav.tsx` — categoryDisplay (none, sidebar-fixed, fullscreen-tabs)
- `apps/menu/app/[slug]/MenuPageClient.tsx` — sidebar layout, sectionHeading styles
- `packages/design-engine/src/templates.ts` — 8 new personality presets
- `apps/dashboard/app/api/generate-theme/route.ts` — structural decision rules in prompt
- `apps/dashboard/components/theme/SectionPanels.tsx` — VisualPicker editors for 6 new fields
- `apps/dashboard/components/theme/ThemeBuilderShell.tsx` — getSectionDefaults updated

---

### Sprint 9 — AI Design Studio 🚧

**Started 2026-05-24**

**Goal:** Three interconnected AI systems: (1) OCR Menu Importer — photo of a paper menu → structured categories/items + auto-suggested GarsonlessTheme; (2) AI Design Assistant — text prompt → theme generation; (3) Claude Design Mode — click any component in the preview iframe → AI-powered property suggestions via natural language comments.

**Key decisions:**
- System 1 uses Anthropic vision API (`claude-sonnet-4-20250514`), returns `{ menuData, theme, description, confidence }` as JSON
- Image sent as base64 via multipart FormData → server converts to Anthropic vision block
- MenuOCRModal 3 phases: upload (drag+drop) → processing (BrewBar + rotating messages) → review (editable table + PhonePreview)
- `onApplyMenu` loops `createCategory` + `createItem` server actions; `onApplyTheme` calls `saveTheme` directly
- System 3 deferred until Systems 1+2 ship

**Files changed:**
- `apps/dashboard/app/api/generate-from-menu-photo/route.ts` — Anthropic vision + GarsonlessTheme generation
- `apps/dashboard/components/menu/MenuOCRModal.tsx` — 3-phase OCR modal
- `apps/dashboard/components/menu/MenuManager.tsx` — "📷 Menüden Aktar" button + OCR modal integration
- `apps/dashboard/app/api/generate-theme/route.ts` — 3-mode theme generation (prompt / photo / chat)
- `apps/dashboard/components/theme/AIDesignModal.tsx` — input → generating → result modal with mini phone mockup
- `apps/dashboard/components/theme/ThemeBuilderShell.tsx` — "✨ AI ile Tasarla" button + AI chat wired to SectionNav
- `apps/dashboard/components/layout/SectionNav.tsx` — AI button + chat input at bottom of left panel
- `apps/dashboard/components/onboarding/StepTemplateSelect.tsx` — featured AI card above template grid

---

### Sprint 8 — Full Dashboard UI ✅

**Completed 2026-05-20**

**Goal:** Build every admin panel screen end-to-end: Pano overview, Orders Kanban, Menu Manager, Tables/QR builder, Analytics, Settings, layout shell, and landing page.

**Key decisions:**
- All dashboard pages wired to real Supabase data via server components; client components receive pre-fetched props
- `PanoClient` subscribes to `orders` Realtime channel for live activity feed; KPI queries run on server
- `OrderBoard` uses `useOrdersRealtime` hook + dnd-kit for drag-to-advance status; `updateOrderStatus` server action
- `TablesBuilderShell` uses `qr-code-styling` (client-side) for live QR preview + download; `buildUrl` generates `/{slug}/table/{tableId}` URLs matching the menu app routes
- `NewOrderModal` fetches real menu items from Supabase on open; `createOrderFromDashboard` action inserts with `sent_to_kitchen` status
- `FloorPlan` overlay accepts real `TableStatusData` and renders in auto-grid layout (position data is a future feature)
- `RestaurantShell` detects `/tables` route and goes full-screen (no rail nav) for the QR builder
- `AnalyticsClient` started as rich mock-data charts; sales/table data was progressively wired, and revenue/payment/product semantics were fully corrected in Sprint 19b/19c
- `globalTheme.ts` centralises CSS variable definitions for the dashboard design system
- Marketing landing page (`apps/dashboard/app/page.tsx`) — ~80KB standalone client component

**Files changed (key):**
- `apps/dashboard/app/page.tsx` — marketing landing page
- `apps/dashboard/app/dashboard/[restaurantId]/page.tsx` — Pano server page
- `apps/dashboard/components/pano/PanoClient.tsx` — real KPIs, hourly chart, activity feed, top items, floor plan
- `apps/dashboard/lib/queries.ts` — `getDashboardKPIs`, `getHourlySales`, `getActivityFeed`, `getTopItems`, `getTableStatuses`
- `apps/dashboard/components/orders/OrderBoard.tsx` + `OrderCard.tsx` — Kanban board with realtime
- `apps/dashboard/components/menu/MenuManager.tsx` — drag-reorder categories + items, image upload
- `apps/dashboard/components/tables/TablesBuilderShell.tsx` — QR builder with presets, shapes, colors, frames, download
- `apps/dashboard/components/analytics/AnalyticsClient.tsx` — sales, items, tables, payments reports (real analytics wired by Sprint 19b/19c)
- `apps/dashboard/components/settings/SettingsForm.tsx` + section files — account, store, hours, tax, languages, payments, AI waiter, kitchen, API, billing, security
- `apps/dashboard/components/layout/RestaurantShell.tsx` + `IconRail.tsx` + `SectionNav.tsx` + `PageTopBar.tsx`
- `apps/dashboard/components/overlays/` — StoreSwitcher, NotificationsPanel, ProfileMenu, HelpModal, NewOrderModal (real data), FloorPlan (real data), DateRangePicker
- `apps/dashboard/lib/actions/orders.ts` — `updateOrderStatus`, `createOrderFromDashboard`
- `apps/dashboard/lib/ui.tsx` — shared UI primitives (Icon, Tag, Button, EmptyState, etc.)

---

### Sprint 7 — Component-Config Architecture (Theme Builder Rewrite) ✅

**Completed 2026-05-18**

**Goal:** Replace the CSS token + postMessage approach with a Shopify-inspired component-config JSON architecture. Every component owns its config schema; `COMPONENT_SCHEMAS` drives the editor UI; postMessage targets individual components.

**Key decisions:**
- `MenuPageConfig` is a flat JSON object (5 components: page, header, categoryNav, productCard, cartDrawer) — no more nested `ThemeTokens.brand/typography/shape/components`
- `COMPONENT_SCHEMAS` is the schema-of-the-schema — each field has a `FieldType` that tells the dashboard how to render it (`color`, `radio`, `slider`, `toggle`, `font`)
- `ThemeProvider` lives in `packages/ui` (not `apps/menu`) to avoid circular dependency; components call `useTheme()` directly
- postMessage protocol: dashboard → menu `{ type: 'COMPONENT_UPDATE', component, config }`; menu → dashboard `{ type: 'COMPONENT_CLICK', component }`
- Clicking a component in the preview iframe selects it in the property panel (bidirectional)
- All component styling via inline styles from `useTheme()` — no CSS vars in components
- `applyFullConfig()` still injects SSR CSS for initial paint (no FOUC), then client postMessages take over
- Theme data stored in `theme_configs.tokens` JSONB as `MenuPageConfig` (was `ThemeTokens`)
- `DEFAULT_CONFIG` fallback used when stored data lacks `page` key (detects old format)
- `?preview=1` query param enables preview mode in `ThemeProvider` (receives postMessages + sends click events)
- 8 templates updated to `MenuPageConfig` format: minimal, noir, mercato, bento, beachside, steakhouse, fast, mezze

**Files changed:**
- `packages/design-engine/src/schema.ts` — `MenuPageConfig` + `DEFAULT_CONFIG`
- `packages/design-engine/src/config-schema.ts` — `COMPONENT_SCHEMAS` (schema-of-the-schema)
- `packages/design-engine/src/templates.ts` — 8 templates as `MenuPageConfig`
- `packages/design-engine/src/apply.ts` — `applyFullConfig`, `applyPageConfig`, `buildFontsUrl`
- `packages/ui/src/menu/ThemeContext.tsx` — `ThemeProvider` + `useTheme()` with postMessage bridge
- `packages/ui/src/menu/Header.tsx` — rewritten, uses `useTheme()`, `data-component="header"`
- `packages/ui/src/menu/CategoryNav.tsx` — rewritten, uses `useTheme()`, `data-component="categoryNav"`
- `packages/ui/src/menu/ProductCard.tsx` — rewritten, 3 layouts (grid/list/compact), `data-component="productCard"`
- `packages/ui/src/menu/CartDrawer.tsx` — rewritten, uses `useTheme()`, `data-component="cartDrawer"`
- `apps/menu/app/[slug]/layout.tsx` — uses `applyFullConfig` + `buildFontsUrl`
- `apps/menu/app/[slug]/page.tsx` — passes `MenuPageConfig` + `isPreview` to `MenuPageClient`
- `apps/menu/app/[slug]/MenuPageClient.tsx` — wraps with `<ThemeProvider>`, no more tokens prop threading
- `apps/dashboard/components/theme/ThemeBuilderShell.tsx` — rewrites around `MenuPageConfig`
- `apps/dashboard/components/theme/PropertyPanel.tsx` — schema-driven field renderer
- `apps/dashboard/components/theme/fields/` — `ColorField`, `RadioField`, `SliderField`, `ToggleField`, `FontField`
- `apps/dashboard/lib/actions/theme.ts` — accepts `MenuPageConfig` instead of `ThemeTokens`

---

### Sprint 6 — Branded QR + Payment ✅

**Completed 2026-05-17**

**Goal:** Branded QR code generation with custom colors/shape/logo + İyzico payment integration + split bill.

**Key decisions:**
- QR rounded shape: SVG output → inject `rx/ry` on all `<rect>` elements → Sharp PNG conversion
- Logo from URL: `fetch()` URL → Buffer → Sharp composite (no local file path needed)
- QR style saved to `restaurants.settings.qr_style` JSONB — no migration needed
- İyzico: `checkoutFormInitialize.create()` → `paymentPageUrl` → iframe in `PaymentModal`
- İyzico callback: POST `/api/payment/callback` updates order status to `paid`
- `'paid'` added to `OrderStatus` enum in types.gen.ts
- Split bill: client-side manual item assignment per person → individual İyzico payment per person
- `deviceId` added to `useCartStore` as persistent device UUID (separate from sessionId)
- Stand orders: static page + Resend email (lead capture, not e-commerce)
- Payment flow: "Ödeme Yap" places order first → gets orderId → opens PaymentModal with İyzico iframe
- iyzipay has no official types — declare module in `apps/menu/lib/iyzipay.d.ts` (different name from `iyzico.ts` to avoid TS treating it as local override)

---

### Sprint 5 — AI Waiter ✅

**Completed 2026-05-17**

**Goal:** Build the AI Waiter feature for the customer menu app — chat UI, streaming API route, tool use (add_to_cart, call_waiter, get_item_details, get_order_status), prompt caching, and dashboard settings panel.

**Key decisions:**
- Streaming via Anthropic SDK `messages.stream()` + `ReadableStream` SSE (no Vercel AI SDK)
- Wire format: newline-delimited JSON — `{ type: 'delta'|'tool_use'|'tool_result'|'done'|'error', ... }`
- Prompt caching: system prompt + menu JSON sent as `cache_control: { type: 'ephemeral' }` block — ~80% cost reduction on multi-turn chats
- Menu cache: `unstable_cache` with tag `menu:{restaurantId}`, revalidated by dashboard menu save actions
- AI settings stored in `restaurants.settings` JSONB: `ai_waiter_enabled`, `ai_persona_name`, `ai_tone`, `ai_language`
- `add_to_cart` + `call_waiter` tools handled client-side; `get_item_details` + `get_order_status` handled server-side in agentic loop

---

### Sprint 4 — Realtime Ordering + Kitchen Display ✅

**Completed 2026-05-17**

**Goal:** Wire up live order flow end-to-end: dashboard Kanban board, Kitchen Display System (KDS), PWA notifications, and Turkish status labels for customers.

**Key decisions:**
- Kitchen app is auth-free; access gated by `kitchenToken` stored in `restaurants.settings.kitchen_token` (existing JSONB), validated server-side before service-key operations
- Realtime channel: `postgres_changes` on `orders` table filtered by `restaurant_id`
- ServiceWorker in `apps/dashboard/public/sw.js` for Web Notification API
- No new DB migration needed

---

### Sprint 1 — Monorepo Foundation ✅

**Completed 2026-05-17**

- Turborepo v2 workspace with pnpm (apps: dashboard:3000, menu:3001, kitchen:3002)
- Packages: ui, design-engine, db, ai, qr — all typecheck clean
- Supabase schema: 6 tables + RLS + soft deletes (migration 20260517000000)
- TypeScript types generated to `packages/db/src/types.gen.ts`
- design-engine: ThemeTokens type + generateThemeCSS() + 8 templates (noir, mercato, bento, beachside, steakhouse, fast, mezze, minimal)
- Tailwind v4 wired via `@theme {}` in each app's globals.css; design-engine CSS vars override at runtime via injected `<style>` tag
- dnd-kit + Framer Motion installed in dashboard

**Next:** Theme builder UI, drag-and-drop menu editor, Supabase auth setup

---

### Sprint 2 — Customer Menu App ✅

**Completed 2026-05-17**

**Route structure**
- `apps/menu/app/[slug]/layout.tsx` — server component: fetches theme_config, calls `generateThemeCSS()`, injects `<style>` + Google Fonts `<link>` tags (React 19 hoists both to `<head>`)
- `apps/menu/app/[slug]/page.tsx` — server component: fetches restaurant, categories, items in parallel; passes to `MenuPageClient`
- `apps/menu/app/[slug]/MenuPageClient.tsx` — `'use client'`: wires Zustand stores to all UI components
- `apps/menu/app/[slug]/table/[tableId]/page.tsx` — same as slug page + sets `tableId` on cart store
- `apps/menu/app/api/orders/route.ts` — `POST /api/orders` with Zod validation; delegates insert to `packages/db/src/orders.ts`

**UI components (packages/ui/src/menu/)**
- `Header` — logo, name, cart badge; 3 styles: minimal/hero/centered
- `CategoryNav` — horizontal scroll tabs or pills; IntersectionObserver tracks active section; smooth scroll
- `ProductCard` — vertical/horizontal layout; image, price, modifier badge; click opens modal or adds direct
- `ProductModal` — Framer Motion bottom sheet; required (radio) / optional (checkbox) modifier groups; qty stepper; disabled Add until required groups satisfied
- `CartDrawer` — Framer Motion slide (bottom or right); qty controls; Place Order button
- `OrderConfirmation` — animated success screen; subscribes to Supabase Realtime for status updates

**State**
- `useCartStore` — Zustand + persist; sessionId auto-generated with `crypto.randomUUID()`, survives page reload
- `useOrderStore` — order id + status + isPlacing

**Fixes applied**
- `exactOptionalPropertyTypes: false` in `apps/menu/tsconfig.json` — Supabase v2 types incompatible with this flag
- `createOrder()` helper in `packages/db/src/orders.ts` encapsulates the cross-package insert type workaround
- `OrderStatus` + `RestaurantPlan` exported from `@garsonless/db`

**Next:** Kitchen Display System, Supabase auth in dashboard, theme builder drag-and-drop UI
