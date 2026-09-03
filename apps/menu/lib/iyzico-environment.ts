const LIVE_IYZICO_ORIGIN = 'https://api.iyzipay.com'

/** Production checkout must never accept sandbox or tenant-controlled hosts. */
export function isIyzicoEnvironmentAllowed(
  baseUrl: string,
  nodeEnv: string | undefined = process.env['NODE_ENV'],
): boolean {
  if (nodeEnv !== 'production') return true
  try {
    const parsed = new URL(baseUrl)
    return parsed.origin === LIVE_IYZICO_ORIGIN
      && parsed.pathname === '/'
      && parsed.search === ''
      && parsed.hash === ''
  } catch {
    return false
  }
}
