import type { CampaignEmailDesign } from '@garsonless/domain/campaigns'

/** Editing keeps partial input; validate before rendering a sendable campaign. */
export function campaignDesignIssue(design: CampaignEmailDesign): string | null {
  if (!design.blocks.length) return 'Tasarımınıza en az bir içerik elementi ekleyin.'
  if (design.blocks.length > 40) return 'Bir e-postada en fazla 40 element kullanılabilir.'
  if (JSON.stringify(design).length > 100_000) return 'E-posta tasarımı çok büyük. İçeriği kısaltın.'
  const hex = /^#[0-9a-f]{6}$/i
  const validUrl = (value: string) => {
    try { const url = new URL(value); return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password && !/[\s<>"']/.test(value) && value.length <= 2_000 } catch { return false }
  }
  if ([design.backgroundColor, design.contentBackgroundColor, design.textColor, design.accentColor].some(color => !hex.test(color))) return 'Renkleri #123456 biçiminde girin.'
  if (!Number.isFinite(design.maxWidth) || design.maxWidth < 480 || design.maxWidth > 720) return 'İçerik genişliği 480-720 piksel arasında olmalı.'
  if (!Number.isFinite(design.borderRadius) || design.borderRadius < 0 || design.borderRadius > 32) return 'Köşe yuvarlaklığı 0-32 piksel arasında olmalı.'
  for (const [index, block] of design.blocks.entries()) {
    const at = `${index + 1}. element: `
    if ('color' in block && !hex.test(block.color)) return at + 'Geçerli bir renk girin.'
    if ((block.type === 'heading' || block.type === 'text') && !block.text.trim()) return at + 'Metin boş bırakılamaz.'
    if (block.type === 'button') {
      if (!block.label.trim()) return at + 'Buton metni gerekli.'
      if (!validUrl(block.href)) return at + 'Buton için geçerli bir HTTPS bağlantısı girin.'
      if (!hex.test(block.backgroundColor) || !hex.test(block.textColor)) return at + 'Geçerli bir buton rengi girin.'
    }
    if (block.type === 'image' && !validUrl(block.src)) return at + 'Görsel için geçerli bir HTTPS adresi girin.'
    if (block.type === 'image' && block.href && !validUrl(block.href)) return at + 'Görsel bağlantısı HTTPS olmalı.'
    if (block.type === 'grid' && block.items.some(item => (item.href && !validUrl(item.href)) || (item.imageUrl && !validUrl(item.imageUrl)))) return at + 'Kart bağlantıları ve görselleri için geçerli HTTPS adresleri girin.'
  }
  return null
}
