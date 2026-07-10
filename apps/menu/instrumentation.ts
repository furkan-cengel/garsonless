// Boot-time configuration guard (P1.1). Next runs register() once when the
// server process starts. A production deploy that would silently drop every
// customer OTP (mock/unset SMS provider) — or is missing CUSTOMER_SESSION_SECRET,
// or selects a real provider without its credentials — crashes HERE, before
// serving a single request, instead of failing invisibly in the field.
//
// The @garsonless/db import is node-only (node:crypto, service client), so it is
// dynamically imported strictly inside the nodejs-runtime branch — it must never
// load under the edge runtime.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { assertSmsConfig } = await import('@garsonless/db')
    assertSmsConfig()
  }
}
