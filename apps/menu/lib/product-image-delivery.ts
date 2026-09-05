const assetHosts = new Set([
  'yxsegwkzyiscrxiwdeuf.supabase.co',
  'svxvloeosiksqfadgkvo.supabase.co',
])

/** Only our public product assets may enter the application's image optimizer. */
export function productImageDelivery(source: string | undefined) {
  if (!source) return undefined
  let url: URL
  try { url = new URL(source) } catch { return undefined }
  if (url.protocol !== 'https:' || !assetHosts.has(url.hostname)
    || !url.pathname.startsWith('/storage/v1/object/public/restaurant-assets/')
    || url.username || url.password || url.port || url.search || url.hash) return undefined
  const sized = (width: number) => `/_next/image?url=${encodeURIComponent(source)}&w=${width}&q=75`
  return {
    src: sized(640),
    srcSet: [384, 640, 1080].map(width => `${sized(width)} ${width}w`).join(', '),
    sizes: '(max-width: 760px) 50vw, (max-width: 1024px) 33vw, 320px',
  }
}
