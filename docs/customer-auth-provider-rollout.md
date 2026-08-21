# Customer auth provider rollout

All new customer sign-in methods are fail-closed and can be rolled back without
invalidating existing sessions.

## Release order

1. Apply the customer identity V2 and membership legal-evidence migrations.
2. Deploy and smoke-test the Send SMS Hook with the phone capability still off.
3. Deploy the menu UI/API changes with email OTP kept on as the fallback.
4. Enable Google, Apple and phone independently only after each staging smoke test passes.
5. Keep Supabase Manual Linking off until the authenticated re-verification/linking flow has its own reviewed rollout.

## Netgsm phone OTP

1. Activate the Netgsm OTP package, API sub-user, approved sender and production IP allowlist.
2. Set `SEND_SMS_HOOK_SECRETS`, `NETGSM_USERCODE`, `NETGSM_PASSWORD` and `NETGSM_MSGHEADER` as Supabase Edge Function secrets.
3. Deploy `send-sms-hook`, register it as the Supabase Auth Send SMS Hook and set SMS OTP expiry to 300 seconds.
4. In staging, verify new-user and returning-user delivery, replay rejection and the phone-only customer claim.
5. Set `CUSTOMER_AUTH_PHONE_OTP_ENABLED=true` only after the smoke test. Revert it to `false` for delivery or cost anomalies.

The application intent expires after five minutes and Supabase hosted SMS OTP expiry must also be set to 300 seconds. The local CLI version does not expose that hosted setting in `config.toml`.

## Google and Apple

- Add a provider to `CUSTOMER_AUTH_ENABLED_PROVIDERS` only after hosted Supabase settings and redirect/branding checks pass.
- Google must keep account selection enabled.
- Apple Web OAuth requires the Services ID, redirect domain and a server-side client secret; never expose the `.p8` key to the menu app.
- Track Apple client-secret expiry at 30, 14 and 7 days and rotate it at least every six months.

## Safe telemetry

Alert on send/verify conversion, provider failures, rate limits, CAPTCHA demand and identity conflicts. Never log phone numbers, email addresses, OTP values, access tokens, CAPTCHA tokens or raw provider payloads.
