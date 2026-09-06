import type { CustomerSegment } from '@garsonless/domain/customers'
/** Prevent silently broadening a filter the saved numeric-rule model cannot express. */
export function savedFilterLimitation(search: string, segment: CustomerSegment | ''): string | null {
  if (search.trim()) return 'Arama metni kayıtlı segmente dahil edilemiyor. Segment kaydetmek için önce aramayı temizleyin.'
  if (segment === 'new') return 'Yeni müşteriler hazır filtresi doğrudan kullanılabilir; kayıtlı segment olarak kaydedilemez. Özel segment için başka bir filtre seçin.'
  return null
}

export function isCampaignAudienceReady(target: string, previewTarget: string | null, previewing: boolean, eligibleRecipients: number): boolean {
  return !previewing && target === previewTarget && eligibleRecipients > 0
}
