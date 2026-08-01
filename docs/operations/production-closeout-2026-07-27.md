# Production closeout — 2026-07-27

## Decision

**NO-GO (external production evidence pending).** The repository gates and local
smoke suite pass, but a release cannot be accepted until every production scope,
migration history, deployed runtime and real-device notification check has fresh
operator evidence bound to the release candidate.

## Completed repository evidence

- Theme/header/footer cleanup is frozen in `5f0c4eb`.
- Workspace exclusions and generated-cache cleanup are frozen in `eb10bbc`.
- Advisory Knip audit and verified dead-code cleanup are frozen in `1486fc3`.
- Canonical theme normalization, Spain retirement, semantic color/spinner work,
  typed QR options and UI contracts are frozen in `7aad0c3`.
- `pnpm check:ci` passes: lint (zero errors), all workspace typechecks,
  architecture/database tests, and every release-tool contract test.
- Menu, kitchen and dashboard production builds pass.
- Public Playwright smoke passes on desktop and mobile (8/8), including product
  dialog open/add-to-cart visibility/Escape close.
- Five app `.next` trees and reproducible test/build caches were removed without
  deleting dependencies or environment files (about 2.04 GiB reclaimed).

## Evidence still required for GO

1. Provide real `.env.production` files for menu, kitchen, marketing and
   platform-admin, then run preflight/topology for every scope. Only the
   dashboard production env currently exists locally.
2. Capture the linked PROD `supabase migration list`; verify pre-deploy prefix,
   apply the manifest in the change window, then verify post-deploy equality.
3. Capture fresh Edge Function, Auth Hook, Vault, cron and safe probe evidence;
   run runtime verification in post-deploy mode.
4. Complete the business smoke evidence and operator attestation against the
   exact release candidate, including enabled payment/billing capabilities.
5. Verify Web Push and the notification bell on a real device. Automated browser
   coverage is not a substitute for permission prompts and OS delivery.
6. Run authenticated dashboard visual smoke with dedicated visual-test
   credentials; the unauthenticated public matrix is complete.
7. Record backup/PITR restore proof and freeze rollback artifacts before opening
   the execution journal.

The commands and safe evidence schemas are defined in
`docs/operations/production-readiness.md`. No production mutation was performed
during this closeout.

