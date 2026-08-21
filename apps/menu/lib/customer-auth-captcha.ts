const RECAPTCHA_TEST_SECRET_KEY = '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe'

export async function verifyCustomerAuthCaptcha(
  token: string | undefined,
  remoteAddress: string,
): Promise<boolean> {
  if (!token || token.length > 4_096) return false
  const secret = process.env.NODE_ENV === 'development'
    ? process.env['RECAPTCHA_SECRET_KEY']?.trim() || RECAPTCHA_TEST_SECRET_KEY
    : process.env['RECAPTCHA_SECRET_KEY']?.trim()
  if (!secret) return false
  try {
    const body = new URLSearchParams({ secret, response: token })
    if (remoteAddress !== 'unknown') body.set('remoteip', remoteAddress)
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(4_000),
      cache: 'no-store',
    })
    if (!response.ok) return false
    const result = await response.json() as { success?: unknown }
    return result.success === true
  } catch {
    return false
  }
}
