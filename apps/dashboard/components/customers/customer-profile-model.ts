import {
  CUSTOMER_POINTS_REASON_MAX_LENGTH,
  isCustomerLapsed,
  isCustomerNew,
  type CustomerTimelineEvent,
  type RestaurantCustomer,
} from '@garsonless/domain/customers'

const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
const DAY_MS = 86_400_000

export function relTime(iso: string | null, referenceNow: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  const days = Math.floor((new Date(referenceNow).getTime() - d.getTime()) / DAY_MS)
  if (days <= 0) return 'Bugün'
  if (days === 1) return 'Dün'
  if (days < 30) return `${days} gün önce`
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export function fmtDate(iso: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getDate()} ${MONTHS[d.getMonth()]} · ${hh}:${mm}`
}

export function initials(name: string | null): string {
  const parts = (name || 'İsimsiz').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toLocaleUpperCase('tr-TR')
  return (parts[0] ?? 'M').slice(0, 2).toLocaleUpperCase('tr-TR')
}

export function softForTier(color: string | undefined): string {
  const map: Record<string, string> = {
    '#b87333': '#f3e7dc',
    '#8a9099': '#eceef0',
    '#c8922a': '#f6ecd6',
    '#5b7a86': '#e3edf0',
  }
  return map[(color ?? '').toLowerCase()] ?? 'var(--surface-3)'
}

/** VIP is derived, never assigned by hand: the third loyalty tier and above. */
export const VIP_HINT = 'VIP etiketi sadakat seviyesinden otomatik gelir: 3. seviye ve üstü.'

export function tagsForCustomer(c: Pick<RestaurantCustomer, 'authLinked' | 'firstSeen' | 'lastSeen' | 'visits' | 'tierIndex'>, referenceNow: string): string[] {
  const tags: string[] = []
  if (c.tierIndex >= 2) tags.push('VIP')
  if (isCustomerNew(c.firstSeen, referenceNow)) tags.push('Yeni müşteri')
  if (c.visits >= 3) tags.push('Sık gelen')
  if (isCustomerLapsed(c.lastSeen, referenceNow)) tags.push('Geri kazanılacak')
  if (!c.authLinked) tags.push('Bağlantısız kayıt')
  return tags.slice(0, 3)
}

/** Names that differ only in case or spacing point at a likely duplicate record. */
export function duplicateNameKey(name: string | null): string | null {
  const key = name?.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR')
  return key ? key : null
}

function unpaidOrderStatusLabel(status: string | undefined): string {
  const labels: Record<string, string> = {
    pending: 'onay bekliyor',
    pending_approval: 'onay bekliyor',
    sent_to_kitchen: 'mutfağa gönderildi',
    preparing: 'hazırlanıyor',
    ready: 'servis bekliyor',
    served: 'servis edildi',
    paid: 'ödeme kaydı bekleniyor',
  }
  return status ? (labels[status] ?? 'ödenmedi') : 'ödenmedi'
}

export type TimelineIcon = 'receipt' | 'gift' | 'star' | 'users' | 'undo' | 'stamp' | 'minus'

/** One line per ledger or order event. Order amounts are absent for staff, so the
 * amount column falls back to an empty string rather than a misleading ₺0. */
export function timelineLabel(e: CustomerTimelineEvent, formatMoney: (value: number) => string): { icon: TimelineIcon; label: string; amount: string; positive: boolean } {
  if (e.kind === 'order') {
    const label = e.status === 'cancelled'
      ? 'Sipariş (iptal - harcamaya dahil değil)'
      : e.collected
        ? 'Sipariş (tahsil edildi)'
        : e.paid
          ? 'Sipariş (ikram - harcamaya dahil değil)'
          : `Sipariş (${unpaidOrderStatusLabel(e.status)} - harcamaya dahil değil)`
    return { icon: 'receipt', label, amount: e.amount === undefined ? '' : formatMoney(e.amount), positive: false }
  }
  const delta = e.delta ?? 0
  const sign = delta >= 0 ? '+' : '−'
  const unit = e.type === 'stamp' ? ' damga' : ''
  const amount = `${sign}${Math.abs(delta)}${unit}`
  if (e.reason?.startsWith('store_credit')) {
    const note = e.reason.slice('store_credit:'.length).trim()
    return { icon: 'gift', label: note && e.reason.includes(':') ? `Elle eklendi · ${note}` : 'Elle eklendi', amount, positive: true }
  }
  if (e.reason?.startsWith('manual_deduction:')) {
    return { icon: 'minus', label: `Elle düşüldü · ${e.reason.slice('manual_deduction:'.length).trim()}`, amount, positive: false }
  }
  if (e.reason === 'welcome') return { icon: 'star', label: 'Hoş geldin bonusu', amount, positive: true }
  if (e.type === 'visit') return { icon: 'users', label: 'Ziyaret', amount, positive: true }
  if (e.direction === 'refund') return { icon: 'undo', label: e.type === 'stamp' ? 'Damga iadesi' : 'Puan iadesi', amount, positive: true }
  if (e.type === 'stamp') return { icon: 'stamp', label: e.direction === 'redeem' ? 'Bedava ürün' : 'Damga kazandı', amount, positive: delta >= 0 }
  return { icon: 'star', label: e.direction === 'redeem' ? 'Puan kullandı' : 'Puan kazandı', amount, positive: delta >= 0 }
}

/** The reason written when a point change is undone, kept inside the ledger's limit. */
export function undoReason(original: string): string {
  return `Geri alındı: ${original}`.slice(0, CUSTOMER_POINTS_REASON_MAX_LENGTH)
}
