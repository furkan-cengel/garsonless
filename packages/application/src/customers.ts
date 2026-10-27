import {
  err,
  hasSameRestaurant,
  normalizeCustomerEmail,
  ok,
  CUSTOMER_NOTE_MAX_LENGTH,
  CUSTOMER_POINTS_REASON_MAX_LENGTH,
  customerSegmentUsesOwnerFields,
  resolveCustomerName,
  sanitizeCustomerSegmentDefinition,
  type CustomerActorContext,
  type CustomerAuthIdentity,
  type CustomerConsentSnapshot,
  type CustomerConsentSource,
  type CustomerConsentType,
  type CustomerContactReveal,
  type CustomerNote,
  type EnsureCustomerOptions,
  type EnsureCustomerResult,
  type CustomerListOptions,
  type CustomerSegmentCounts,
  type CustomerSegmentDefinition,
  type CustomerTimelineEvent,
  type CustomerTimelinePage,
  type DashboardActorContext,
  type RestaurantCustomerDetail,
  type RestaurantCustomersPage,
  type Result,
  type SavedCustomerSegment,
} from '@garsonless/domain'

export interface CustomerIdentityPort {
  upsertIdentity(input: {
    authUserId: string
    verifiedEmail: string | null
    name: string | null
    verifiedPhone: string | null
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
  const verifiedEmail = normalizeCustomerEmail(identity.email)
  const verifiedPhone = identity.phone?.trim() || null
  if (!verifiedEmail && !verifiedPhone) return {
    ok: false,
    error: 'Kimlik sağlayıcısı doğrulanmış bir iletişim bilgisi döndürmedi.',
    code: 'IDENTITY_CONFLICT',
  }

  const linked = await port.upsertIdentity({
    authUserId: identity.authUserId,
    verifiedEmail,
    name: resolveCustomerName(options.name, identity.userMetadata),
    verifiedPhone,
  })
  if (!linked.ok) return linked

  const stamped = await port.stampCustomerRole({
    authUserId: identity.authUserId,
    appMetadata: identity.appMetadata,
  })
  if (!stamped.ok) return {
    ok: false,
    error: 'Müşteri oturumu damgalanamadı.',
    code: 'SERVICE_UNAVAILABLE',
  }

  if (options.restaurantId) {
    const restaurantId = options.restaurantId
    const associated = await port.associateRestaurant({
      customerId: linked.customer.id,
      restaurantId,
    })
    if (!associated.ok) return {
      ok: false,
      error: 'Müşteri işletme bağlantısı oluşturulamadı.',
      code: 'SERVICE_UNAVAILABLE',
    }

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
  /** Contact fields are only projected for restaurant owners. The DB adapter
   * must never expose full PII for a member-only customer query. */
  listCustomers(input: CustomerListOptions & { restaurantId: string; includeContactData: boolean }): Promise<Result<RestaurantCustomersPage>>
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
    expectedUpdatedAt: string
    restaurantId: string
    segmentId: string
    name: string
    definition: CustomerSegmentDefinition
  }): Promise<Result<SavedCustomerSegment | null>>
  deleteSegment(input: { restaurantId: string; segmentId: string }): Promise<Result<boolean>>
  readDetail(input: { restaurantId: string; customerId: string; includeContactData: boolean }): Promise<Result<RestaurantCustomerDetail | null>>
  readTimeline(input: { restaurantId: string; customerId: string; cursor?: string | null }): Promise<Result<CustomerTimelinePage | null>>
  grantStoreCredit(input: {
    restaurantId: string
    customerId: string
    requestId: string
    points: number
    grantedBy: string
    note?: string
  }): Promise<Result<{ granted: number; replayed: boolean }>>
  deductPoints(input: {
    restaurantId: string
    customerId: string
    requestId: string
    points: number
    reason: string
    deductedBy: string
  }): Promise<Result<{ deducted: number; replayed: boolean }>>
  listNotes(input: { restaurantId: string; customerId: string }): Promise<Result<CustomerNote[]>>
  addNote(input: { restaurantId: string; customerId: string; authorId: string; body: string }): Promise<Result<CustomerNote>>
  deleteNote(input: { restaurantId: string; customerId: string; noteId: string; actorId: string; actorIsOwner: boolean }): Promise<Result<boolean>>
  /** Must record an audit row before returning full contact details. */
  revealContact(input: { restaurantId: string; customerId: string; revealedBy: string }): Promise<Result<CustomerContactReveal | null>>
}

function requireCustomerAccess(context: DashboardActorContext, restaurantId: string): Result<true> {
  return hasSameRestaurant(context, restaurantId) && context.permissions.includes('customers')
    ? ok(true)
    : err('Not authorized')
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function readCustomers(
  context: DashboardActorContext,
  input: CustomerQueryInput,
  port: CustomerApplicationPort,
): Promise<Result<RestaurantCustomersPage>> {
  const access = requireCustomerAccess(context, input.restaurantId)
  if (!access.ok) return access

  const owner = context.isOwner === true
  let customSegment: CustomerSegmentDefinition | null = null
  if (input.customSegmentId) {
    const saved = await port.getSegment({ restaurantId: input.restaurantId, segmentId: input.customSegmentId })
    if (!saved.ok) return saved
    if (!saved.value || (!owner && customerSegmentUsesOwnerFields(saved.value.definition))) return err('Segment bulunamadı')
    customSegment = saved.value.definition
  }
  // Staff never filter or sort by spend or consent: the result order would reveal them.
  const segment = !owner && input.segment === 'consented' ? null : input.segment
  const sort = !owner && input.sort === 'spend' ? 'last_seen' : input.sort

  // The list is always masked; the owner reveals one customer at a time through an audited command.
  const page = await port.listCustomers({
    restaurantId: input.restaurantId,
    includeContactData: false,
    customSegment,
    page: Math.max(1, Math.floor(input.page ?? 1)),
    pageSize: Math.min(100, Math.max(1, Math.floor(input.pageSize ?? 25))),
    ...(input.search?.trim() ? { search: input.search.trim() } : {}),
    ...(customSegment ? { segment: null } : segment !== undefined ? { segment } : {}),
    ...(sort ? { sort } : {}),
  })
  if (!page.ok || owner) return page
  return ok({ ...page.value, customers: page.value.customers.map((customer) => ({ ...customer, spend: null })) })
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
  if (!access.ok) return access
  const segments = await port.listSegments({ restaurantId })
  if (!segments.ok || context.isOwner === true) return segments
  return ok(segments.value.filter((segment) => !customerSegmentUsesOwnerFields(segment.definition)))
}

export async function readCustomerDetail(
  context: DashboardActorContext,
  input: { restaurantId: string; customerId: string },
  port: CustomerApplicationPort,
): Promise<Result<RestaurantCustomerDetail | null>> {
  const access = requireCustomerAccess(context, input.restaurantId)
  if (!access.ok) return access
  const detail = await port.readDetail({ ...input, includeContactData: false })
  if (!detail.ok || !detail.value || context.isOwner === true) return detail
  return ok(withoutOwnerFinancials(detail.value))
}

/** Staff see visits and points but not what the customer spent, in total or per order. */
function withoutOwnerFinancials(detail: RestaurantCustomerDetail): RestaurantCustomerDetail {
  return { ...detail, spend: null, timeline: detail.timeline.map(withoutOrderAmount) }
}

function withoutOrderAmount(event: CustomerTimelineEvent): CustomerTimelineEvent {
  if (event.kind !== 'order') return event
  const { amount: _amount, ...rest } = event
  return rest
}

export async function readCustomerTimeline(
  context: DashboardActorContext,
  input: { restaurantId: string; customerId: string; cursor?: string | null },
  port: CustomerApplicationPort,
): Promise<Result<CustomerTimelinePage | null>> {
  const access = requireCustomerAccess(context, input.restaurantId)
  if (!access.ok) return access
  if (input.cursor && input.cursor.length > 512) return err('Geçersiz hareket imleci')
  const page = await port.readTimeline(input)
  if (!page.ok || !page.value || context.isOwner === true) return page
  return ok({ ...page.value, events: page.value.events.map(withoutOrderAmount) })
}

type PointsAdjustmentInput = { restaurantId: string; customerId: string; requestId: string; points: number; reason: string }

/** Shared checks for manual balance changes. These are financial actions: a member
 * with CRM access may read and note customers, but only the owner moves points,
 * and every change carries a reason so the ledger explains itself. */
function validatePointsAdjustment(
  context: DashboardActorContext,
  input: PointsAdjustmentInput,
): Result<{ points: number; reason: string }> {
  const access = requireCustomerAccess(context, input.restaurantId)
  if (!access.ok) return access
  if (context.isOwner !== true) return err('Not authorized')
  if (!UUID_PATTERN.test(input.requestId)) return err('Geçersiz istek kimliği')
  const points = Math.floor(input.points)
  if (!Number.isFinite(points) || points <= 0) return err('Geçersiz puan miktarı')
  if (points > 1_000_000) return err('Puan miktarı çok yüksek')
  const reason = input.reason.trim()
  if (!reason) return err('Bir sebep yazın')
  if (reason.length > CUSTOMER_POINTS_REASON_MAX_LENGTH) return err('Sebep en fazla 80 karakter olabilir')
  return ok({ points, reason })
}

export async function grantCustomerStoreCredit(
  context: DashboardActorContext,
  input: PointsAdjustmentInput,
  port: CustomerApplicationPort,
): Promise<Result<{ granted: number; replayed: boolean }>> {
  const valid = validatePointsAdjustment(context, input)
  if (!valid.ok) return valid
  return port.grantStoreCredit({
    restaurantId: input.restaurantId,
    customerId: input.customerId,
    requestId: input.requestId,
    points: valid.value.points,
    grantedBy: context.userId,
    note: valid.value.reason,
  })
}

export async function deductCustomerPoints(
  context: DashboardActorContext,
  input: PointsAdjustmentInput,
  port: CustomerApplicationPort,
): Promise<Result<{ deducted: number; replayed: boolean }>> {
  const valid = validatePointsAdjustment(context, input)
  if (!valid.ok) return valid
  return port.deductPoints({
    restaurantId: input.restaurantId,
    customerId: input.customerId,
    requestId: input.requestId,
    points: valid.value.points,
    reason: valid.value.reason,
    deductedBy: context.userId,
  })
}

export async function revealCustomerContact(
  context: DashboardActorContext,
  input: { restaurantId: string; customerId: string },
  port: CustomerApplicationPort,
): Promise<Result<CustomerContactReveal | null>> {
  const access = requireCustomerAccess(context, input.restaurantId)
  if (!access.ok) return access
  if (context.isOwner !== true) return err('Not authorized')
  return port.revealContact({ ...input, revealedBy: context.userId })
}

export async function readCustomerNotes(
  context: DashboardActorContext,
  input: { restaurantId: string; customerId: string },
  port: CustomerApplicationPort,
): Promise<Result<CustomerNote[]>> {
  const access = requireCustomerAccess(context, input.restaurantId)
  return access.ok ? port.listNotes(input) : access
}

export async function addCustomerNote(
  context: DashboardActorContext,
  input: { restaurantId: string; customerId: string; body: string },
  port: CustomerApplicationPort,
): Promise<Result<CustomerNote>> {
  const access = requireCustomerAccess(context, input.restaurantId)
  if (!access.ok) return access
  const body = input.body.trim()
  if (!body) return err('Not boş olamaz')
  if (body.length > CUSTOMER_NOTE_MAX_LENGTH) return err('Not en fazla 500 karakter olabilir')
  return port.addNote({ restaurantId: input.restaurantId, customerId: input.customerId, authorId: context.userId, body })
}

export async function deleteCustomerNote(
  context: DashboardActorContext,
  input: { restaurantId: string; customerId: string; noteId: string },
  port: CustomerApplicationPort,
): Promise<Result<boolean>> {
  const access = requireCustomerAccess(context, input.restaurantId)
  if (!access.ok) return access
  if (!UUID_PATTERN.test(input.noteId)) return err('Geçersiz not')
  return port.deleteNote({ ...input, actorId: context.userId, actorIsOwner: context.isOwner === true })
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
  if (context.isOwner !== true && customerSegmentUsesOwnerFields(input.definition)) return err('Not authorized')
  return port.createSegment({
    restaurantId: input.restaurantId,
    name,
    definition: sanitizeCustomerSegmentDefinition(input.definition),
    createdBy: context.userId,
  })
}

export async function updateCustomerSegment(
  context: DashboardActorContext,
  input: { restaurantId: string; segmentId: string; expectedUpdatedAt: string; name: string; definition: CustomerSegmentDefinition },
  port: CustomerApplicationPort,
): Promise<Result<SavedCustomerSegment | null>> {
  const access = requireCustomerAccess(context, input.restaurantId)
  if (!access.ok) return access
  const name = input.name.trim().slice(0, 60)
  if (!name) return err('Segment adı zorunludur')
  if (!input.expectedUpdatedAt || !Number.isFinite(Date.parse(input.expectedUpdatedAt))) return err('Geçersiz segment sürümü')
  if (context.isOwner !== true && customerSegmentUsesOwnerFields(input.definition)) return err('Not authorized')
  const hidden = await isSegmentHiddenFromActor(context, input, port)
  if (!hidden.ok) return hidden
  if (hidden.value) return ok(null)
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
  if (!access.ok) return access
  const hidden = await isSegmentHiddenFromActor(context, input, port)
  if (!hidden.ok) return hidden
  return hidden.value ? ok(false) : port.deleteSegment(input)
}

/** A segment built on spend or consent does not exist for staff, so they cannot change it by id either. */
async function isSegmentHiddenFromActor(
  context: DashboardActorContext,
  input: { restaurantId: string; segmentId: string },
  port: CustomerApplicationPort,
): Promise<Result<boolean>> {
  if (context.isOwner === true) return ok(false)
  const saved = await port.getSegment({ restaurantId: input.restaurantId, segmentId: input.segmentId })
  if (!saved.ok) return saved
  return ok(Boolean(saved.value && customerSegmentUsesOwnerFields(saved.value.definition)))
}
