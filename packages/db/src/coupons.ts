import {
  couponErrorMessage,
  validateCouponWrite,
  CouponWriteError,
  type CouponWriteInput,
  couponStatus,
  isCouponCode,
  normalizeCouponCode,
  type CouponAudience,
  type CouponDefinition,
  type CouponDiscountType,
  type CouponErrorCode,
  type CouponScope,
  type CouponStackingPolicy,
  type PublicCouponChoice,
} from '@garsonless/domain/coupons'
import { createServiceClient } from './service-client'
import { canRestaurantUseFeature } from './feature-entitlement-port'
import type { DiscountResult, OrderLineInput } from './loyalty'

type CouponRow = {
  id: string
  restaurant_id: string
  name: string
  code: string
  enabled: boolean
  discount_type: string
  discount_value: number
  scope: string
  minimum_amount: number
  maximum_discount_amount: number | null
  starts_at: string | null
  ends_at: string | null
  total_usage_limit: number | null
  per_customer_limit: number | null
  audience: string
  stacking_policy: string
  marketing_label: string | null
  marketing_description: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

export type { CouponWriteInput } from '@garsonless/domain/coupons'

export type CouponFailure = { ok: false; code: CouponErrorCode; error: string }

export interface ResolvedCouponPricing {
  coupon: CouponDefinition
  eligibleSubtotal: number
  stampEligibleDiscount: number
  catalogEligibleDiscount: number
  discountAmount: number
}

export function couponAppliesToLine(
  coupon: Pick<CouponDefinition, 'scope' | 'categoryIds' | 'itemIds'>,
  line: Pick<OrderLineInput, 'itemId' | 'categoryId'>,
): boolean {
  return coupon.scope === 'order'
    || (coupon.scope === 'product' && coupon.itemIds.includes(line.itemId))
    || (coupon.scope === 'category' && Boolean(line.categoryId && coupon.categoryIds.includes(line.categoryId)))
}

export function calculateCouponDiscountAmount(
  coupon: Pick<CouponDefinition, 'discountType' | 'discountValue' | 'maximumDiscountAmount'>,
  eligibleAmount: number,
): number {
  const boundedEligible = Math.max(0, numberValue(eligibleAmount))
  let amount = coupon.discountType === 'percentage'
    ? Math.round(boundedEligible * coupon.discountValue) / 100
    : Math.min(boundedEligible, coupon.discountValue)
  if (coupon.maximumDiscountAmount !== null) amount = Math.min(amount, coupon.maximumDiscountAmount)
  return Math.round(Math.max(0, amount) * 100) / 100
}

function numberValue(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function couponTitle(row: CouponDefinition): string {
  return row.discountType === 'percentage'
    ? `%${numberValue(row.discountValue).toLocaleString('tr-TR')} İndirim`
    : `${numberValue(row.discountValue).toLocaleString('tr-TR')}₺ İndirim`
}

function couponSubtitle(row: CouponDefinition): string {
  if (row.marketingDescription?.trim()) return row.marketingDescription.trim()
  const scope = row.scope === 'order' ? 'tüm siparişlerde' : row.scope === 'category' ? 'seçili kategorilerde' : 'seçili ürünlerde'
  return row.minimumAmount > 0
    ? `${row.minimumAmount.toLocaleString('tr-TR')}₺ üzeri ${scope} geçerli`
    : `${scope.charAt(0).toLocaleUpperCase('tr-TR')}${scope.slice(1)} geçerli`
}

function mapCoupon(row: CouponRow, categoryIds: string[], itemIds: string[], redemptionCount: number): CouponDefinition {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    name: row.name,
    code: row.code,
    enabled: row.enabled,
    discountType: row.discount_type as CouponDiscountType,
    discountValue: numberValue(row.discount_value),
    scope: row.scope as CouponScope,
    minimumAmount: numberValue(row.minimum_amount),
    maximumDiscountAmount: row.maximum_discount_amount === null ? null : numberValue(row.maximum_discount_amount),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    totalUsageLimit: row.total_usage_limit,
    perCustomerLimit: row.per_customer_limit,
    audience: row.audience as CouponAudience,
    stackingPolicy: row.stacking_policy as CouponStackingPolicy,
    marketingLabel: row.marketing_label,
    marketingDescription: row.marketing_description,
    categoryIds,
    itemIds,
    redemptionCount,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function loyaltyEntitled(restaurantId: string): Promise<boolean> {
  const { data } = await createServiceClient().from('restaurants').select('plan').eq('id', restaurantId).maybeSingle()
  return Boolean(data) && canRestaurantUseFeature({ restaurantId, plan: data?.plan, feature: 'loyalty' })
}

async function hydrateCoupons(rows: CouponRow[]): Promise<CouponDefinition[]> {
  if (rows.length === 0) return []
  const db = createServiceClient()
  const ids = rows.map((row) => row.id)
  const [{ data: categories, error: categoryError }, { data: items, error: itemError }, { data: redemptions, error: redemptionError }] = await Promise.all([
    db.from('coupon_categories').select('coupon_id, category_id').in('coupon_id', ids),
    db.from('coupon_items').select('coupon_id, item_id').in('coupon_id', ids),
    db.from('coupon_redemptions').select('coupon_id').in('coupon_id', ids).eq('status', 'consumed'),
  ])
  if (categoryError || itemError || redemptionError) throw new Error('Kupon ayrıntıları yüklenemedi.')
  const categoryMap = new Map<string, string[]>()
  for (const row of categories ?? []) categoryMap.set(row.coupon_id, [...(categoryMap.get(row.coupon_id) ?? []), row.category_id])
  const itemMap = new Map<string, string[]>()
  for (const row of items ?? []) itemMap.set(row.coupon_id, [...(itemMap.get(row.coupon_id) ?? []), row.item_id])
  const countMap = new Map<string, number>()
  for (const row of redemptions ?? []) countMap.set(row.coupon_id, (countMap.get(row.coupon_id) ?? 0) + 1)
  return rows.map((row) => mapCoupon(row, categoryMap.get(row.id) ?? [], itemMap.get(row.id) ?? [], countMap.get(row.id) ?? 0))
}

export async function listRestaurantCoupons(restaurantId: string, includeArchived = false): Promise<CouponDefinition[]> {
  let query = createServiceClient().from('coupons').select('*').eq('restaurant_id', restaurantId).order('created_at', { ascending: false })
  if (!includeArchived) query = query.is('archived_at', null)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return hydrateCoupons((data ?? []) as CouponRow[])
}

export async function listActivePublicCoupons(restaurantId: string): Promise<PublicCouponChoice[]> {
  if (!await loyaltyEntitled(restaurantId)) return []
  const coupons = await listRestaurantCoupons(restaurantId)
  return coupons.filter((coupon) => couponStatus(coupon) === 'active').map((coupon) => ({
    id: coupon.id,
    name: coupon.name,
    code: coupon.code,
    title: couponTitle(coupon),
    subtitle: couponSubtitle(coupon),
    eyebrow: coupon.marketingLabel?.trim() || (coupon.audience === 'first_order' ? 'İLK SİPARİŞE ÖZEL' : 'KUPON FIRSATI'),
    endsAt: coupon.endsAt,
  }))
}

export async function saveRestaurantCoupon(restaurantId: string, input: CouponWriteInput): Promise<CouponDefinition> {
  const fields = validateCouponWrite(input)
  if (Object.keys(fields).length) throw new CouponWriteError('INVALID_INPUT', 'İşaretli alanları kontrol edin.', fields)
  if (!await loyaltyEntitled(restaurantId)) throw new CouponWriteError('FORBIDDEN', 'Kuponlar Pro sadakat özelliğiyle kullanılabilir.')
  const { requestId, ...payload } = input
  const db = createServiceClient()
  const rpc = db.rpc.bind(db) as unknown as (name: string, args: Record<string, unknown>) => Promise<{data: unknown; error: {code?: string; message: string} | null}>
  const {data, error} = await rpc('save_restaurant_coupon_atomic', {p_restaurant:restaurantId, p_request_id:requestId, p_input:payload})
  if (error) {
    if (error.code === '23505') throw new CouponWriteError('CODE_CONFLICT', 'Bu kupon kodu zaten kullanılıyor.', {code:'Farklı bir kod girin veya yeni kod oluşturun.'})
    if (error.message.includes('COUPON_VERSION_CONFLICT')) throw new CouponWriteError('CONFLICT', 'Kupon başka bir oturumda değiştirildi. Taslağınız korundu. Güncel kuponu yükleyip değişiklikleri yeniden uygulayın.')
    if (error.message.includes('COUPON_REQUEST_CONFLICT')) throw new CouponWriteError('REQUEST_CONFLICT', 'Bu kayıt isteği farklı bilgilerle kullanılmış. Formu yeniden açın.')
    if (error.message.includes('COUPON_INVALID_TARGET')) throw new CouponWriteError('INVALID_INPUT', 'Seçili ürün veya kategoriler artık kullanılamıyor.', {[input.scope === 'category' ? 'categoryIds' : 'itemIds']:'Listeyi yenileyip seçiminizi kontrol edin.'})
    if (error.message.includes('COUPON_FORBIDDEN')) throw new CouponWriteError('FORBIDDEN', 'Bu işletmede kupon kaydetme yetkiniz yok.')
    throw new CouponWriteError('UNAVAILABLE', 'Kupon kaydı şu anda tamamlanamıyor. Taslağınız korundu; tekrar deneyin.')
  }
  const saved = data as {coupon: CouponRow; categoryIds:string[]; itemIds:string[]; redemptionCount:number} | null
  if (!saved?.coupon) throw new CouponWriteError('UNAVAILABLE', 'Kayıt yanıtı alınamadı. Aynı işlemi tekrar deneyebilirsiniz.')
  return mapCoupon(saved.coupon,saved.categoryIds,saved.itemIds,saved.redemptionCount)
}

export async function archiveRestaurantCoupon(restaurantId: string, couponId: string, expectedUpdatedAt: string): Promise<string> {
  const updatedAt = new Date().toISOString()
  const { data, error } = await createServiceClient().from('coupons').update({ archived_at: updatedAt, enabled: false, updated_at: updatedAt })
    .eq('id', couponId).eq('restaurant_id', restaurantId).eq('updated_at', expectedUpdatedAt).is('archived_at', null).select('updated_at').maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Kupon başka bir oturumda değiştirildi. Listeyi yenileyip tekrar deneyin.')
  return data.updated_at
}

export async function restoreRestaurantCoupon(restaurantId: string, couponId: string, expectedUpdatedAt: string): Promise<void> {
  const { data, error } = await createServiceClient().from('coupons')
    .update({ archived_at: null, enabled: false, updated_at: new Date().toISOString() })
    .eq('id', couponId).eq('restaurant_id', restaurantId).eq('updated_at', expectedUpdatedAt).not('archived_at', 'is', null)
    .select('id').maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Arşiv kaydı başka bir oturumda değiştirildi. Listeyi yenileyin.')
}

function failure(code: CouponErrorCode): CouponFailure {
  return { ok: false, code, error: couponErrorMessage(code) }
}

export async function resolveCouponPricing(input: {
  restaurantId: string
  customerId: string | null
  code: string
  lines: OrderLineInput[]
  loyalty: DiscountResult
}): Promise<{ ok: true; value: ResolvedCouponPricing } | CouponFailure> {
  const code = normalizeCouponCode(input.code)
  if (!isCouponCode(code) || !await loyaltyEntitled(input.restaurantId)) return failure('COUPON_NOT_FOUND')
  const { data } = await createServiceClient().from('coupons').select('*').eq('restaurant_id', input.restaurantId).eq('code', code).is('archived_at', null).maybeSingle()
  if (!data) return failure('COUPON_NOT_FOUND')
  const [coupon] = await hydrateCoupons([data as CouponRow])
  if (!coupon) return failure('COUPON_NOT_FOUND')
  const now = Date.now()
  if (!coupon.enabled) return failure('COUPON_INACTIVE')
  if (coupon.startsAt && Date.parse(coupon.startsAt) > now) return failure('COUPON_NOT_STARTED')
  if (coupon.endsAt && Date.parse(coupon.endsAt) <= now) return failure('COUPON_EXPIRED')
  if (coupon.totalUsageLimit !== null && coupon.redemptionCount >= coupon.totalUsageLimit) return failure('COUPON_EXHAUSTED')
  if (coupon.audience !== 'everyone' && !input.customerId) return failure('COUPON_AUTH_REQUIRED')
  if (coupon.perCustomerLimit !== null && input.customerId) {
    const { count } = await createServiceClient().from('coupon_redemptions').select('id', { count: 'exact', head: true }).eq('coupon_id', coupon.id).eq('customer_id', input.customerId).eq('status', 'consumed')
    if ((count ?? 0) >= coupon.perCustomerLimit) return failure('COUPON_CUSTOMER_LIMIT_REACHED')
  }
  if (coupon.audience === 'first_order' && input.customerId) {
    const { count } = await createServiceClient().from('orders').select('id', { count: 'exact', head: true }).eq('restaurant_id', input.restaurantId).eq('customer_id', input.customerId).neq('status', 'cancelled').is('deleted_at', null)
    if ((count ?? 0) > 0) return failure('COUPON_FIRST_ORDER_ONLY')
  }

  const ids = [...new Set(input.lines.map((line) => line.itemId))]
  const { data: itemRows } = ids.length > 0
    ? await createServiceClient().from('menu_items').select('id, price, category_id').in('id', ids)
    : { data: [] as Array<{ id: string; price: number; category_id: string }> }
  const catalog = new Map((itemRows ?? []).map((row) => [row.id, row]))
  const eligible = (itemId: string, categoryId?: string) => {
    const resolvedCategoryId = categoryId ?? catalog.get(itemId)?.category_id
    return couponAppliesToLine(coupon, {
      itemId,
      ...(resolvedCategoryId ? { categoryId: resolvedCategoryId } : {}),
    })
  }
  let eligibleSubtotal = 0
  for (const line of input.lines) {
    if (!eligible(line.itemId, line.categoryId)) continue
    const price = line.basePriceOverride ?? numberValue(catalog.get(line.itemId)?.price)
    eligibleSubtotal += (price + numberValue(line.modifiersPriceDelta)) * Math.max(0, numberValue(line.quantity))
  }
  eligibleSubtotal = Math.round(Math.max(0, eligibleSubtotal) * 100) / 100
  if (eligibleSubtotal <= 0) return failure('COUPON_NO_ELIGIBLE_ITEMS')
  const combinesLoyalty = coupon.stackingPolicy === 'combine_loyalty'
  const stampEligibleDiscount = combinesLoyalty && input.loyalty.rewardItemId && eligible(input.loyalty.rewardItemId)
    ? input.loyalty.stampDiscountAmount : 0
  const catalogEligibleDiscount = combinesLoyalty && input.loyalty.catalogItemId && eligible(input.loyalty.catalogItemId)
    ? input.loyalty.catalogDiscountAmount : 0
  const eligibleAfterFree = Math.max(0, eligibleSubtotal - stampEligibleDiscount - catalogEligibleDiscount)
  if (eligibleAfterFree < coupon.minimumAmount) return failure('COUPON_MINIMUM_NOT_MET')
  const discountAmount = calculateCouponDiscountAmount(coupon, eligibleAfterFree)
  if (discountAmount <= 0) return failure('COUPON_NO_ELIGIBLE_ITEMS')
  return { ok: true, value: { coupon, eligibleSubtotal, stampEligibleDiscount, catalogEligibleDiscount, discountAmount } }
}

export function applyCouponToDiscount(loyalty: DiscountResult, resolved: ResolvedCouponPricing): DiscountResult & {
  couponId: string
  couponCode: string
  couponName: string
  couponDiscountAmount: number
  couponStackingPolicy: CouponStackingPolicy
} {
  const exclusive = resolved.coupon.stackingPolicy === 'exclusive'
  const stamp = exclusive ? 0 : loyalty.stampDiscountAmount
  const catalog = exclusive ? 0 : loyalty.catalogDiscountAmount
  const coupon = Math.min(Math.max(0, loyalty.subtotal - stamp - catalog), resolved.discountAmount)
  const afterCoupon = Math.max(0, loyalty.subtotal - stamp - catalog - coupon)
  const memberPct = exclusive ? 0 : loyalty.memberDiscountPct
  const member = memberPct > 0 ? Math.min(afterCoupon, Math.floor(afterCoupon * memberPct / 100)) : 0
  const remaining = Math.max(0, afterCoupon - member)
  const points = exclusive ? 0 : Math.min(remaining, loyalty.pointsDiscountAmount)
  return {
    ...loyalty,
    memberDiscountAmount: member,
    memberDiscountPct: memberPct,
    pointsDiscountAmount: points,
    pointsRedeemed: exclusive ? 0 : loyalty.pointsRedeemed,
    stampDiscountAmount: stamp,
    stampsConsumed: exclusive ? 0 : loyalty.stampsConsumed,
    catalogDiscountAmount: catalog,
    catalogPointsCost: exclusive ? 0 : loyalty.catalogPointsCost,
    finalTotal: Math.round(Math.max(0, loyalty.subtotal - stamp - catalog - coupon - member - points) * 100) / 100,
    couponId: resolved.coupon.id,
    couponCode: resolved.coupon.code,
    couponName: resolved.coupon.name,
    couponDiscountAmount: coupon,
    couponStackingPolicy: resolved.coupon.stackingPolicy,
  }
}
