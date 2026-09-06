export const COUPON_DISCOUNT_TYPES = ['percentage', 'fixed'] as const
export type CouponDiscountType = typeof COUPON_DISCOUNT_TYPES[number]

export const COUPON_SCOPES = ['order', 'category', 'product'] as const
export type CouponScope = typeof COUPON_SCOPES[number]

export const COUPON_AUDIENCES = ['everyone', 'members', 'first_order'] as const
export type CouponAudience = typeof COUPON_AUDIENCES[number]

export const COUPON_STACKING_POLICIES = ['exclusive', 'combine_loyalty'] as const
export type CouponStackingPolicy = typeof COUPON_STACKING_POLICIES[number]

export const COUPON_ERROR_CODES = [
  'COUPON_NOT_FOUND',
  'COUPON_INACTIVE',
  'COUPON_NOT_STARTED',
  'COUPON_EXPIRED',
  'COUPON_MINIMUM_NOT_MET',
  'COUPON_NO_ELIGIBLE_ITEMS',
  'COUPON_AUTH_REQUIRED',
  'COUPON_FIRST_ORDER_ONLY',
  'COUPON_CUSTOMER_LIMIT_REACHED',
  'COUPON_EXHAUSTED',
  'COUPON_CHANGED',
  'COUPON_STACKING_CONFLICT',
] as const
export type CouponErrorCode = typeof COUPON_ERROR_CODES[number]

export interface CouponDefinition {
  id: string
  restaurantId: string
  name: string
  code: string
  enabled: boolean
  discountType: CouponDiscountType
  discountValue: number
  scope: CouponScope
  minimumAmount: number
  maximumDiscountAmount: number | null
  startsAt: string | null
  endsAt: string | null
  totalUsageLimit: number | null
  perCustomerLimit: number | null
  audience: CouponAudience
  stackingPolicy: CouponStackingPolicy
  marketingLabel: string | null
  marketingDescription: string | null
  categoryIds: string[]
  itemIds: string[]
  redemptionCount: number
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface PublicCouponChoice {
  id: string
  name: string
  code: string
  title: string
  subtitle: string
  eyebrow: string
  endsAt: string | null
}

export function normalizeCouponCode(value: string): string {
  return value.trim().toUpperCase()
}

export function isCouponCode(value: string): boolean {
  return /^[A-Z0-9_-]{3,32}$/.test(normalizeCouponCode(value))
}

export function couponErrorMessage(code: CouponErrorCode): string {
  switch (code) {
    case 'COUPON_NOT_FOUND': return 'Kupon kodu bulunamadı.'
    case 'COUPON_INACTIVE': return 'Bu kupon şu anda aktif değil.'
    case 'COUPON_NOT_STARTED': return 'Bu kuponun kullanım süresi henüz başlamadı.'
    case 'COUPON_EXPIRED': return 'Bu kuponun süresi dolmuş.'
    case 'COUPON_MINIMUM_NOT_MET': return 'Kupon için gereken minimum uygun ürün tutarına ulaşılmadı.'
    case 'COUPON_NO_ELIGIBLE_ITEMS': return 'Sepetinizde bu kupona uygun ürün bulunmuyor.'
    case 'COUPON_AUTH_REQUIRED': return 'Bu kuponu kullanmak için üyeliğinizi doğrulayın.'
    case 'COUPON_FIRST_ORDER_ONLY': return 'Bu kupon yalnızca ilk siparişte kullanılabilir.'
    case 'COUPON_CUSTOMER_LIMIT_REACHED': return 'Bu kupon için kullanım hakkınızı doldurdunuz.'
    case 'COUPON_EXHAUSTED': return 'Bu kuponun toplam kullanım hakkı doldu.'
    case 'COUPON_CHANGED': return 'Kupon koşulları güncellendi. Sepetinizi yeniden kontrol edin.'
    case 'COUPON_STACKING_CONFLICT': return 'Bu kupon diğer üyelik avantajlarıyla birlikte kullanılamaz.'
  }
}

export function couponStatus(
  coupon: Pick<CouponDefinition, 'enabled' | 'startsAt' | 'endsAt' | 'totalUsageLimit' | 'redemptionCount' | 'archivedAt'>,
  now = Date.now(),
): 'active' | 'scheduled' | 'paused' | 'expired' | 'exhausted' | 'archived' {
  if (coupon.archivedAt) return 'archived'
  if (!coupon.enabled) return 'paused'
  if (coupon.startsAt && Date.parse(coupon.startsAt) > now) return 'scheduled'
  if (coupon.endsAt && Date.parse(coupon.endsAt) <= now) return 'expired'
  if (coupon.totalUsageLimit !== null && coupon.redemptionCount >= coupon.totalUsageLimit) return 'exhausted'
  return 'active'
}

export { validateCouponWrite, CouponWriteError } from './coupon-write'
export type { CouponWriteInput, CouponFieldErrors, CouponWriteErrorCode } from './coupon-write'
