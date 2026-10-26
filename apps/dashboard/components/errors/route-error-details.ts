/**
 * Support facts for a route error screen. Server errors only carry a digest
 * (Next.js hides their message in production); client errors carry a browser
 * message such as a DOM exception, which is safe to show and is what support
 * needs to find the cause.
 */
export function routeErrorDetails(
  error: Error & { digest?: string },
  pathname: string | null,
  now: Date = new Date(),
): Array<{ label: string; value: string }> {
  const details = [
    { label: 'Ekran', value: pathname || '-' },
    { label: 'Zaman', value: now.toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'medium' }) },
  ]
  if (error.digest) details.push({ label: 'Referans', value: error.digest })
  else if (error.message) details.push({ label: 'Hata', value: `${error.name}: ${error.message}`.slice(0, 240) })
  return details
}
