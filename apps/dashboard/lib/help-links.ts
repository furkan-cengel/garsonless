import type { Icon } from './ui'
import { I } from './ui'

export interface DashboardHelpLink {
  section: string
  category: string
  title: string
  description: string
  href: string
  Icon: Icon
}

export function dashboardHelpLinks(restaurantId: string): DashboardHelpLink[] {
  const base = `/dashboard/${restaurantId}`
  return [
    { section: 'menu', category: 'Menü', title: 'Menüyü düzenle', description: 'Ürünleri, kategorileri ve fiyatları yönet', href: `${base}/menu`, Icon: I.menuDish },
    { section: 'tables', category: 'Masalar', title: 'QR ve masaları yönet', description: 'Masa düzenini ve QR kodlarını aç', href: `${base}/tables`, Icon: I.qr },
    { section: 'orders', category: 'Sipariş', title: 'Siparişleri görüntüle', description: 'Aktif ve tamamlanan siparişlere git', href: `${base}/orders`, Icon: I.clipboard },
    { section: 'theme', category: 'Tema', title: 'Menü görünümünü özelleştir', description: 'Renkleri ve vitrin düzenini güncelle', href: `${base}/theme`, Icon: I.palette },
    { section: 'settings', category: 'Hesap', title: 'Bildirim tercihlerini aç', description: 'Tarayıcı ve operasyon bildirimlerini yönet', href: `${base}/settings?section=notifications`, Icon: I.bell },
    { section: 'settings', category: 'Güvenlik', title: 'Oturum etkinliğini incele', description: 'Hesap güvenliği ve etkinlik geçmişini aç', href: `${base}/settings?section=security`, Icon: I.history },
  ]
}

export function safeSupportUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim() || value.length > 2_048) return null
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' || url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}
