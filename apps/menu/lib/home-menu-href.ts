export interface HomeMenuHrefOptions {
  preview?: boolean
  openCart?: boolean
  itemId?: string | null
  categoryId?: string | null
}

export function buildHomeMenuHref(slug: string, options: HomeMenuHrefOptions = {}): string {
  const path = `/${encodeURIComponent(slug)}/menu`
  const search = new URLSearchParams()

  if (options.preview) search.set('preview', '1')
  if (options.openCart) search.set('open', 'cart')
  if (options.itemId) search.set('item', options.itemId)

  const query = search.size > 0 ? `?${search.toString()}` : ''
  const hash = options.categoryId ? `#category-${encodeURIComponent(options.categoryId)}` : ''
  return `${path}${query}${hash}`
}
