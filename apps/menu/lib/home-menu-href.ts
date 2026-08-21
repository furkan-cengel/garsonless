export interface HomeMenuHrefOptions {
  tableToken?: string | null
  preview?: boolean
  previewTemplateId?: string | null
  previewAccessToken?: string | null
  openCart?: boolean
  itemId?: string | null
  categoryId?: string | null
  comboSectionId?: string | null
  comboIndex?: number | null
  comboItemIds?: string[] | null
  comboTotal?: number | null
  comboTitle?: string | null
  freebieSectionId?: string | null
  promotionSectionId?: string | null
  promotionKind?: 'discount-badge' | 'daily-special' | 'promo-slider' | null
}

export function buildHomeMenuHref(slug: string, options: HomeMenuHrefOptions = {}): string {
  const path = options.tableToken
    ? `/${encodeURIComponent(slug)}/table/${encodeURIComponent(options.tableToken)}`
    : `/${encodeURIComponent(slug)}/menu`
  const search = new URLSearchParams()

  if (options.tableToken) search.set('surface', 'menu')
  if (options.preview) search.set('preview', '1')
  if (options.preview && options.previewTemplateId) search.set('template', options.previewTemplateId)
  if (options.preview && options.previewAccessToken) search.set('previewAccess', options.previewAccessToken)
  if (options.openCart) search.set('open', 'cart')
  if (options.itemId) search.set('item', options.itemId)
  if (options.itemId && options.promotionSectionId && options.promotionKind) {
    search.set('promotionSection', options.promotionSectionId)
    search.set('promotionKind', options.promotionKind)
  }
  if (options.comboSectionId && Number.isInteger(options.comboIndex) && Number(options.comboIndex) > 0 && Number(options.comboIndex) <= 3) {
    search.set('comboSection', options.comboSectionId)
    search.set('comboIndex', String(options.comboIndex))
    if (
      options.preview
      && options.comboItemIds
      && options.comboItemIds.length >= 2
      && options.comboItemIds.length <= 3
      && Number.isFinite(options.comboTotal)
      && Number(options.comboTotal) > 0
    ) {
      options.comboItemIds.forEach((itemId) => search.append('comboItem', itemId))
      search.set('comboTotal', String(options.comboTotal))
      if (options.comboTitle) search.set('comboTitle', options.comboTitle)
    }
  }
  if (options.freebieSectionId?.trim()) search.set('freebieSection', options.freebieSectionId.trim())

  const query = search.size > 0 ? `?${search.toString()}` : ''
  const hash = options.categoryId ? `#category-${encodeURIComponent(options.categoryId)}` : ''
  return `${path}${query}${hash}`
}
