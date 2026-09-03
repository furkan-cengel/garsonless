const DASHBOARD_CALLBACK_ORIGIN = 'https://app.masabu.co'

export function safeCallbackPath(value: string | null, fallback = '/dashboard'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback
  try {
    // URL parsing is intentional: browsers normalize `\\` as an authority
    // separator for special schemes, so string-prefix checks alone allow values
    // such as `/\\evil.example` to escape the dashboard origin.
    const parsed = new URL(value, DASHBOARD_CALLBACK_ORIGIN)
    return parsed.origin === DASHBOARD_CALLBACK_ORIGIN
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : fallback
  } catch {
    return fallback
  }
}
