# Dashboard shell entrypoints production audit

Audit date: 2026-08-04
Scope: left navigation Help and Profile entrypoints
Baseline verdict: **NO-GO**
Implementation status: **Complete; post-fix browser verification pending**
Target verdict after remediation: **Pending visual/runtime gate**

## Method and safety boundary

The baseline was exercised in real Chromium through Playwright at 1440×1000, 820×1000, 390×844, and 200% CSS zoom. The accepted evidence set contains 13 screenshots in `screenshots/`.

The authenticated run used an explicitly approved magic-link session. That may have updated the auth provider's `last_sign_in` metadata. No business entity mutation or real logout was intentionally executed. During the run, the existing dashboard read-model observer may have persisted slow-query telemetry in `dashboard_query_observations`; the browser run was stopped as soon as this hidden read-side write was identified.

The remediation now isolates the default read-side observer from persistent telemetry. The post-fix audit must still use a disposable account because tenant switching and real logout are stateful acceptance scenarios.

## Baseline evidence

| Scenario | Evidence | Result |
| --- | --- | --- |
| Desktop closed / Help / Profile | `desktop-01-closed.png`, `desktop-02-help-open.png`, `desktop-03-profile-open.png` | Rendered without horizontal overflow |
| Long identity and store labels | `desktop-04-long-content.png` | Ellipsis contained long content |
| Tablet closed / Help / Profile | `tablet-01-closed.png`, `tablet-02-help-open.png`, `tablet-03-profile-open.png` | Surfaces remained in viewport |
| Mobile closed / Help / Profile | `mobile-01-closed.png`, `mobile-02-help-open.png`, `mobile-03-profile-open.png` | Help became edge-to-edge; Profile obscured content |
| 200% zoom | `zoom200-help.png` | Help content was vertically clipped |
| Controlled logout failure | `logout-controlled-failure.png` | Menu remained open without useful error or pending feedback |
| Anonymous protected route | `logout-anonymous-redirect.png` | Redirected to `/auth/login` |

No page errors or unexpected HTTP 4xx/5xx responses were observed. Two aborted POST requests were caused by audit navigation/overlay timing and are not classified as service failures. Slow dashboard-query warnings exposed the restaurant identifier in development logs.

## Findings

### Release blockers

1. Help presented quick actions, articles, and live support as interactive controls without handlers.
2. Help had no dialog semantics, focus trap, background inertness, or reliable Escape handling; its content clipped at 200% zoom.
3. Profile had no menu semantics, roving keyboard focus, initial focus, or reliable focus restoration.

### High severity

1. Profile displayed static plan and notification values and included dead menu rows.
2. Profile actions were below the 44×44 target size and store selection had no pending, retry, or accessible selected state.
3. Logout deleted every server push endpoint for the user, did not explicitly request a local auth scope, and had no double-submit or recoverable error state.
4. The dashboard read-model default observer awaited a persistent database write and logged a raw tenant identifier.

### Medium and low severity

1. Help/Profile triggers lacked `aria-expanded`, `aria-haspopup`, and `aria-controls`.
2. Mobile rail behavior varied by route, while Help and Profile lacked a mobile bottom-sheet treatment.
3. Help was eagerly bundled even though opening either surface did not require a direct network request.

## Positive controls

- Help and Profile triggers were native 44×44 buttons with Turkish accessible names.
- Enter and Space opened both entrypoints.
- Overlay state already prevented Help and Profile from being open simultaneously.
- Long user, email, and store labels were visually contained.
- Restaurant portfolio reads enforced owner/member boundaries and filtered deleted/inactive access.
- Plan entitlement checks remained server-side; the static visual badge did not grant access.
- Anonymous access to the protected dashboard redirected to login.
- The 12 targeted settings/access/routing tests passed before remediation.

## Remediation acceptance gate

The release remains **NO-GO** until all blocker/high findings are closed, the automated shell contract tests pass, and a disposable post-fix Playwright run verifies keyboard, responsive, tenant-switch, logout, network, console, and no-read-side-write scenarios.

## Implemented remediation

- Replaced every fake Help action with permission-filtered dashboard routes; optional external support is limited to credential-free HTTPS, no-referrer navigation and an explicit offline state.
- Added dialog semantics, focus trap, background inertness, Escape handling, focus restoration, internal scrolling and mobile bottom-sheet geometry.
- Added Profile menu semantics, roving Arrow/Home/End focus, route-close cleanup, 44px rows, dynamic identity/avatar/plan/unread values, working settings destinations and a first-three-plus-all-stores path.
- Added accessible store-switch pending/retry/selected states without optimistic tenant replacement; unauthorized restaurants remain filtered by the existing server boundary.
- Changed logout to explicit local scope with a synchronous double-submit lock, recoverable error state, dirty-navigation confirmation, hard replace, and cleanup of only the current browser push endpoint.
- Removed persistent telemetry from the default dashboard read path, stopped awaiting observers, and replaced raw tenant/error log fields with a bounded hashed reference.
- Made Help a lazy chunk while retaining Profile as an eager shell control.

## Automated post-fix evidence

- Dashboard architecture suite: **501 passed**.
- Database full regression suite: **380 passed**.
- New shell/help/profile/logout policy tests: **17 passed**.
- Dashboard read-model observability tests: **11 passed**.
- Dashboard and database TypeScript checks: **passed**.
- Dashboard and database ESLint checks: **passed without warnings**.
- Optimized Next.js production build: **passed**.

The in-app browser backend was unavailable in the post-fix session, so new screenshots and interactive keyboard/runtime assertions were not fabricated or substituted with an unapproved browser backend. Those rows remain pending in the scenario matrix.

## Real logout evidence gap

Real logout was intentionally not executed on the current owner account. Local-session scope, current-endpoint cleanup, double-submit protection, back navigation, and server failure recovery must be verified last with a disposable account.
