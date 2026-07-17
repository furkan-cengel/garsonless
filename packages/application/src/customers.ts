import {
  err,
  hasSameRestaurant,
  normalizeCustomerEmail,
  ok,
  resolveCustomerName,
  sanitizeCustomerSegmentDefinition,
  type CustomerActorContext,
  type CustomerAuthIdentity,
  type CustomerConsentSnapshot,
  type CustomerConsentSource,
  type CustomerConsentType,
  type EnsureCustomerOptions,
  type EnsureCustomerResult,
  type CustomerListOptions,
  type CustomerSegmentCounts,
  type CustomerSegmentDefinition,
  type DashboardActorContext,
  type RestaurantCustomerDetail,
  type RestaurantCustomersPage,
  type Result,
  type SavedCustomerSegment,
} from '@garsonless/domain'

export interface CustomerIdentityPort {
  upsertIdentity(input: {
    authUserId: string
    email: string
    name: string | null
  }): Promise<EnsureCustomerResult>
  stampCustomerRole(input: {
    authUserId: string
    appMetadata: Readonly<Record<string, unknown>>
  }): Promise<Result<null>>
  associateRestaurant(input: {
    customerId: string
    restaurantId: string
  }): Promise<Result<null>>
  creditWelcomeBonus(input: {
    customerId: string
    restaurantId: string
  }): Promise<void>
  recordConsent(input: {
    customerId: string
    restaurantId: string
    grant: boolean
    source: CustomerConsentSource
    consentType: CustomerConsentType
  }): Promise<Result<null>>
}

export interface CustomerConsentPort {
  recordConsent(input: {
    customerId: string
    restaurantId: string
    grant: boolean
    source: CustomerConsentSource
    consentType: CustomerConsentType
  }): Promise<Result<null>>
  readSnapshot(input: {
    customerId: string
    restaurantId: string
  }): Promise<Result<CustomerConsentSnapshot>>
}

/** First-login orchestration. Required linking steps fail closed; welcome and
 * affirmative consent side effects stay best-effort to preserve login UX. */
export async function ensureCustomerIdentity(
  identity: CustomerAuthIdentity,
  options: EnsureCustomerOptions,
  port: CustomerIdentityPort,
): Promise<EnsureCustomerResult> {
  const email = normalizeCustomerEmail(identity.email)
  if (!email) return { ok: false, error: 'Kimlik sağlayıcısı e-posta adresi döndürmedi.' }

  const linked = await port.upsertIdentity({
    authUserId: identity.authUserId,
    email,
    name: resolveCustomerName(options.name, identity.userMetadata),
  })
  if (!linked.ok) return linked

  const stamped = await port.stampCustomerRole({
    authUserId: identity.authUserId,
    appMetadata: identity.appMetadata,
  })
  if (!stamped.ok) return { ok: false, error: 'Müşteri oturumu damgalanamadı.' }

  if (options.restaurantId) {
    const restaurantId = options.restaurantId
    const associated = await port.associateRestaurant({
      customerId: linked.customer.id,
      restaurantId,
    })
    if (!associated.ok) return { ok: false, error: 'Müşteri işletme bağlantısı oluşturulamadı.' }

    await port.creditWelcomeBonus({ customerId: linked.customer.id, restaurantId })
    if (options.consent === true) {
      await port.recordConsent({
        customerId: linked.customer.id,
        restaurantId,
        grant: true,
        source: 'join',
        consentType: 'contact_data',
      })
    }
    if (options.marketingConsent === true) {
      await port.recordConsent({
        customerId: linked.customer.id,
        restaurantId,
        grant: true,
        source: 'join',
        consentType: 'marketing',
      })
    }
  }

  return linked
}

export async function updateCustomerConsent(
  context: CustomerActorContext,
  input: {
    restaurantId: string
    grant: boolean
    consentType: CustomerConsentType
    source?: CustomerConsentSource
  },
  port: CustomerConsentPort,
): Promise<Result<CustomerConsentSnapshot>> {
  if (!hasSameRestaurant(context, input.restaurantId)) return err('Not authorized')
  const recorded = await port.recordConsent({
    customerId: context.customerId,
    restaurantId: input.restaurantId,
    grant: input.grant,
    source: input.source ?? 'member_sheet',
    consentType: input.consentType,
  })
  return recorded.ok
    ? port.readSnapshot({ customerId: context.customerId, restaurantId: input.restaurantId })
    : recorded
}

export interface CustomerQueryInput extends Omit<CustomerListOptions, 'customSegment'> {
  restaurantId: string
  customSegmentId?: string | null
}

export interface CustomerApplicationPort {
  listCustomers(input: CustomerListOptions & { restaurantId: string }): Promise<Result<RestaurantCustomersPage>>
  countSegments(input: { restaurantId: string }): Promise<Result<CustomerSegmentCounts>>
  listSegments(input: { restaurantId: string }): Promise<Result<SavedCustomerSegment[]>>
  getSegment(input: { restaurantId: string; segmentId: string }): Promise<Result<SavedCustomerSegment | null>>
  createSegment(input: {
    restaurantId: string
    name: string
    definition: CustomerSegmentDefinition
    createdBy: string
  }): Promise<Result<SavedCustomerSegment>>
  updateSegment(input: {
    restaurantId: string
    segmentId: string
    name: string
    definition: CustomerSegmentDefinition
  }): Promise<Result<SavedCustomerSegment | null>>
  deleteSegment(input: { restaurantId: string; segmentId: string }): Promise<Result<boolean>>
  readDetail(input: { restaurantId: string; customerId: string }): Promise<Result<RestaurantCustomerDetail | null>>
  grantStoreCredit(input: {
    restaurantId: string
    customerId: string
    points: number
    grantedBy: string
    note?: string
  }): Promise<Result<{ granted: number }>>
}

function requireCustomerAccess(context: DashboardActorContext, restaurantId: string): Result<true> {
  return hasSameRestaurant(context, restaurantId) && context.permissions.includes('customers')
    ? ok(true)
    : err('Not authorized')
}

export async function readCustomers(
  context: DashboardActorContext,
  input: CustomerQueryInput,
  port: CustomerApplicationPort,
): Promise<Result<RestaurantCustomersPage>> {
  const access = requireCustomerAccess(context, input.restaurantId)
  if (!access.ok) return access

  let customSegment: CustomerSegmentDefinition | null = null
  if (input.customSegmentId) {
    const saved = await port.getSegment({ restaurantId: input.restaurantId, segmentId: input.customSegmentId })
    if (!saved.ok) return saved
    if (!saved.value) return err('Segment bulunamadı')
    customSegment = saved.value.definition
  }

  return port.listCustomers({
    restaurantId: input.restaurantId,
    customSegment,
    page: Math.max(1, Math.floor(input.page ?? 1)),
    pageSize: Math.min(100, Math.max(1, Math.floor(input.pageSize ?? 25))),
    ...(input.search?.trim() ? { search: input.search.trim() } : {}),
    ...(customSegment ? { segment: null } : input.segment !== undefined ? { segment: input.segment } : {}),
    ...(input.sort ? { sort: input.sort } : {}),
  })
}

export async function readCustomerSegmentCounts(
  context: DashboardActorContext,
  restaurantId: string,
  port: CustomerApplicationPort,
): Promise<Result<CustomerSegmentCounts>> {
  const access = requireCustomerAccess(context, restaurantId)
  return access.ok ? port.countSegments({ restaurantId }) : access
}

export async function readCustomerSegments(
  context: DashboardActorContext,
  restaurantId: string,
  port: CustomerApplicationPort,
): Promise<Result<SavedCustomerSegment[]>> {
  const access = requireCustomerAccess(context, restaurantId)
  return access.ok ? port.listSegments({ restaurantId }) : access
}

export async function readCustomerDetail(
  context: DashboardActorContext,
  input: { restaurantId: string; customerId: string },
  port: CustomerApplicationPort,
): Promise<Result<RestaurantCustomerDetail | null>> {
  const access = requireCustomerAccess(context, input.restaurantId)
  return access.ok ? port.readDetail(input) : access
}

export async function grantCustomerStoreCredit(
  context: DashboardActorContext,
  input: { restaurantId: string; customerId: string; points: number; note?: string },
  port: CustomerApplicationPort,
): Promise<Result<{ granted: number }>> {
  const access = requireCustomerAccess(context, input.restaurantId)
  if (!access.ok) return access
  const points = Math.floor(input.points)
  if (!Number.isFinite(points) || points <= 0) return err('Geçersiz puan miktarı')
  if (points > 1_000_000) return err('Puan miktarı çok yüksek')
  return port.grantStoreCredit({
    restaurantId: input.restaurantId,
    customerId: input.customerId,
    points,
    grantedBy: context.userId,
    ...(input.note?.trim() ? { note: input.note.trim().slice(0, 80) } : {}),
  })
}

export async function createCustomerSegment(
  context: DashboardActorContext,
  input: { restaurantId: string; name: string; definition: CustomerSegmentDefinition },
  port: CustomerApplicationPort,
): Promise<Result<SavedCustomerSegment>> {
  const access = requireCustomerAccess(context, input.restaurantId)
  if (!access.ok) return access
  const name = input.name.trim().slice(0, 60)
  if (!name) return err('Segment adı zorunludur')
  return port.createSegment({
    restaurantId: input.restaurantId,
    name,
    definition: sanitizeCustomerSegmentDefinition(input.definition),
    createdBy: context.userId,
  })
}

export async function updateCustomerSegment(
  context: DashboardActorContext,
  input: { restaurantId: string; segmentId: string; name: string; definition: CustomerSegmentDefinition },
  port: CustomerApplicationPort,
): Promise<Result<SavedCustomerSegment | null>> {
  const access = requireCustomerAccess(context, input.restaurantId)
  if (!access.ok) return access
  const name = input.name.trim().slice(0, 60)
  if (!name) return err('Segment adı zorunludur')
  return port.updateSegment({
    ...input,
    name,
    definition: sanitizeCustomerSegmentDefinition(input.definition),
  })
}

export async function deleteCustomerSegment(
  context: DashboardActorContext,
  input: { restaurantId: string; segmentId: string },
  port: CustomerApplicationPort,
): Promise<Result<boolean>> {
  const access = requireCustomerAccess(context, input.restaurantId)
  return access.ok ? port.deleteSegment(input) : access
}
