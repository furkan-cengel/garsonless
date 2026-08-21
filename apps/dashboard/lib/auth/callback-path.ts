export function safeCallbackPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/dashboard'
  try {
    const parsed = new URL(value, 'https://app.masabu.co')
    return parsed.origin === 'https://app.masabu.co'
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : '/dashboard'
  } catch {
    return '/dashboard'
  }
}
