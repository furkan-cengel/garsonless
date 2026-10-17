# Theme publication and MAF QR investigation — 2026-10-07

Contrast is advisory when publishing a saved theme. Both the client lifecycle and server action no longer reject publication for contrast alone. The publish button keeps its normal label. A separate “Kontrast önerisi” notice opens the affected surface; existing repair controls remain available.

Authorization, owned video/poster validation, menu-reference validation, draft saving, revision concurrency and recovery checks are preserved. No restaurant theme was published on the owner's behalf.

Validation: all 280 theme tests passed; dashboard TypeScript and targeted ESLint passed. Deployment uses an isolated archive of production commit `4327aeaac131cf8f68bf9e9e4c19f4469f280399`, with only six theme runtime files changed. Other local work is excluded.

MAF checks: all 13 active production table-token URLs returned HTTP 200 with the restaurant title. The production persisted QR style was rendered in headless Chromium for each token and decoded through the application's jsQR validator; all 13 passed (18.9:1 contrast). This verifies current persisted QR output, not the designer's unavailable downloaded file.

Vercel production dashboard/menu 500 queries and dashboard error-level query over the last two days returned no matching records; a separate unfiltered sample confirmed logs were available. Supabase API Gateway/Auth logs were queried in bounded windows spanning October 6 and the available October 7 period. No October 6 server error was returned. The October 7 Auth admin users-list failure was the already repaired imported unconfirmed account NULL-token issue; it is not correlated with the reported designer failure.

Pending diagnostic evidence: the affected screen/action and approximate time, and the failing QR's URL or original file. No speculative geography or QR-security change was applied.

Released to production: deployment `dpl_8RRjevuEMpH3MPSQWTvDdgJkthdy` built successfully and was promoted to `app.masabu.co`. Previous deployment: `dpl_GCW7NEbt8ARFcxmk3AM5JjYxrrhj`. Pre-promotion protected login smoke passed. Post-promotion project target was verified, login returned HTTP 200 and anonymous dashboard access redirected to login (307). No other app was deployed.

Follow-up: user narrowed the incident to October 6, 19:00–20:00 (assumed Europe/Istanbul; queried 16:00–17:00 UTC). Supabase edge JWT subject matched the designer account for onboarding RPC 409 responses at 19:04:54 and 19:05:04. Postgres reported `restaurants_slug_key`: slug `test` already existed. A subsequent request by the same actor returned 200 at 19:05:09. Existing onboarding action already handles SQLSTATE 23505 with “Bu menü adresi kullanımda.” These events do not establish a 500 cause.

The precise historical Vercel query was rejected with HTTP 400; CLI classified it as `ExceedsBillingLimitError`. Earlier broad queries returning no rows must not be interpreted as proof of no historical dashboard error. No hosting plan change was made. The failing screen/QR remains needed for correlation.
