# Six-digit email verification

The production email provider generated eight-digit OTPs while both the form and server accepted six. The provider now generates six digits, and local Supabase email configuration explicitly matches it. Expiry and verification rate limits are unchanged. Previously sent emails require a newly requested code.

Email-code input and server validation remove whitespace, preserve leading zeros, and accept exactly six digits. Pasted overlong codes are rejected in full instead of being silently truncated to a different code. Device and authenticator validation remains unchanged.

The shared auth panel hides its scrollbar while preserving desktop panel scrolling and mobile document scrolling.

Validation: 68 auth tests passed; scoped ESLint and dashboard TypeScript checks passed. Chromium clipboard checks passed for whitespace-padded six-digit codes, leading zeros, normalized form data, eight-digit rejection, and scrolling at 1440×540 and 390×640. Only synthetic values were used; no real verification email was sent or consumed by this test.

Provider configuration and browser evidence are stored beside this document. Production deployment and live browser evidence are added after rollout.
