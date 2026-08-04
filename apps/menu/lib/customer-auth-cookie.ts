export const MENU_AUTH_COOKIE_PREFIX = 'msb-menu-'
export const CUSTOMER_AUTH_INTENT_COOKIE = 'msb-menu-auth-intent'
export const CUSTOMER_AUTH_INTENT_TTL_SECONDS = 10 * 60

export interface CookieRecord {
  name: string
  value: string
  options?: Record<string, unknown>
}

function toMenuAuthCookieName(logicalName: string): string {
  return `${MENU_AUTH_COOKIE_PREFIX}${logicalName}`
}

function fromMenuAuthCookieName(physicalName: string): string | null {
  if (physicalName === CUSTOMER_AUTH_INTENT_COOKIE) return null
  return physicalName.startsWith(MENU_AUTH_COOKIE_PREFIX)
    ? physicalName.slice(MENU_AUTH_COOKIE_PREFIX.length)
    : null
}

export function readMenuAuthCookies(
  cookies: ReadonlyArray<{ name: string; value: string }>,
): Array<{ name: string; value: string }> {
  return cookies.flatMap((cookie) => {
    const logicalName = fromMenuAuthCookieName(cookie.name)
    return logicalName ? [{ name: logicalName, value: cookie.value }] : []
  })
}

export function writeMenuAuthCookie(cookie: CookieRecord): CookieRecord {
  const options = { ...(cookie.options ?? {}) }
  delete options['domain']
  const maxAge = typeof cookie.options?.['maxAge'] === 'number'
    ? cookie.options['maxAge']
    : undefined
  return {
    name: toMenuAuthCookieName(cookie.name),
    value: cookie.value,
    options: {
      ...options,
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      ...(maxAge === undefined ? {} : { maxAge }),
    },
  }
}

export function customerAuthIntentCookieOptions(): Record<string, unknown> {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: CUSTOMER_AUTH_INTENT_TTL_SECONDS,
  }
}
