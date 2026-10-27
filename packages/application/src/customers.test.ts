import assert from 'node:assert/strict'
import test from 'node:test'
import { err, ok, type RestaurantCustomersPage } from '@garsonless/domain'
import {
  addCustomerNote,
  createCustomerSegment,
  deductCustomerPoints,
  deleteCustomerNote,
  deleteCustomerSegment,
  ensureCustomerIdentity,
  grantCustomerStoreCredit,
  previewCustomerRewardRule,
  readCustomerSegments,
  readCustomerDetail,
  readCustomerTimeline,
  readCustomers,
  revealCustomerContact,
  saveCustomerRewardRule,
  setCustomerBirthdayByOwner,
  updateCustomerConsent,
  type CustomerApplicationPort,
  type CustomerConsentPort,
  type CustomerIdentityPort,
} from './customers'

const context = {
  actor: 'dashboard-member' as const,
  userId: 'staff-a',
  restaurantId: 'restaurant-a',
  permissions: ['customers'],
}

const emptyPage: RestaurantCustomersPage = { customers: [], total: 0, page: 1, pageSize: 25 }

function port(): CustomerApplicationPort {
  return {
    listCustomers: async () => ok(emptyPage),
    countSegments: async () => ok({ total: 0, new: 0, frequent: 0, lapsed: 0, consented: 0 }),
    listSegments: async () => ok([]),
    getSegment: async () => ok(null),
    createSegment: async (input) => ok({
      id: 'segment', restaurantId: input.restaurantId, name: input.name,
      definition: input.definition, createdAt: 'now', updatedAt: 'now',
    }),
    updateSegment: async () => ok(null),
    deleteSegment: async () => ok(false),
    readDetail: async () => ok(null),
    readTimeline: async () => ok(null),
    grantStoreCredit: async (input) => ok({ granted: input.points, replayed: false }),
    deductPoints: async (input) => ok({ deducted: input.points, replayed: false }),
    listNotes: async () => ok([]),
    addNote: async (input) => ok({ id: 'note', body: input.body, authorId: input.authorId, authorLabel: 'Ada', createdAt: 'now' }),
    deleteNote: async () => ok(true),
    revealContact: async () => ok({ phone: '+905321234567', email: 'ada@example.com' }),
    setBirthday: async () => ok(true),
    listRewardRules: async () => ok([]),
    saveRewardRule: async (input) => ok({ ...input.rule, enabledAt: input.rule.enabled ? 'now' : null }),
    previewRewardRule: async () => ok(4),
  }
}

const REQUEST_ID = 'b7e9d88d-5a25-4a66-951f-4ea3ded5b8fb'
const owner = { ...context, isOwner: true }
const spendSegment = {
  id: 'segment', restaurantId: 'restaurant-a', name: 'VIP', definition: { spend: { op: '>=' as const, value: 100 } },
  createdAt: 'now', updatedAt: 'now',
}

test('customer reads reject cross-tenant and missing permission before the port', async () => {
  const adapter = port()
  let called = false
  adapter.listCustomers = async () => {
    called = true
    return ok(emptyPage)
  }
  assert.deepEqual(await readCustomers(context, { restaurantId: 'restaurant-b' }, adapter), err('Not authorized'))
  assert.deepEqual(await readCustomers({ ...context, permissions: ['orders'] }, { restaurantId: 'restaurant-a' }, adapter), err('Not authorized'))
  assert.equal(called, false)
})

test('custom segments are tenant-bound and resolved before listing', async () => {
  const adapter = port()
  adapter.getSegment = async ({ restaurantId }) => ok({
    id: 'segment', restaurantId, name: 'VIP', definition: { spend: { op: '>=', value: 100 } },
    createdAt: 'now', updatedAt: 'now',
  })
  let customSpend = 0
  adapter.listCustomers = async (input) => {
    customSpend = input.customSegment?.spend?.value ?? 0
    return ok(emptyPage)
  }
  const result = await readCustomers(owner, {
    restaurantId: 'restaurant-a', customSegmentId: 'segment', segment: 'new',
  }, adapter)
  assert.equal(result.ok, true)
  assert.equal(customSpend, 100)
})

test('staff cannot see, filter, sort by or change spend and consent segments', async () => {
  const adapter = port()
  adapter.getSegment = async () => ok(spendSegment)
  adapter.listSegments = async () => ok([spendSegment, { ...spendSegment, id: 'visits', definition: { visits: { op: '>=', value: 3 } } }])
  const listed: Array<{ segment: unknown; sort: unknown }> = []
  adapter.listCustomers = async (input) => {
    listed.push({ segment: input.segment, sort: input.sort })
    return ok({ ...emptyPage, customers: [{ spend: 420 } as RestaurantCustomersPage['customers'][number]] })
  }
  let deleted = false
  adapter.deleteSegment = async () => { deleted = true; return ok(true) }

  assert.deepEqual(await readCustomers(context, { restaurantId: 'restaurant-a', customSegmentId: 'segment' }, adapter), err('Segment bulunamadı'))
  const page = await readCustomers(context, { restaurantId: 'restaurant-a', segment: 'consented', sort: 'spend' }, adapter)
  assert.equal(page.ok && page.value.customers[0]?.spend, null)
  assert.deepEqual(listed, [{ segment: null, sort: 'last_seen' }])
  const segments = await readCustomerSegments(context, 'restaurant-a', adapter)
  assert.deepEqual(segments.ok && segments.value.map((segment) => segment.id), ['visits'])
  assert.deepEqual(await createCustomerSegment(context, { restaurantId: 'restaurant-a', name: 'VIP', definition: { consent: 'granted' } }, adapter), err('Not authorized'))
  assert.deepEqual(await deleteCustomerSegment(context, { restaurantId: 'restaurant-a', segmentId: 'segment' }, adapter), ok(false))
  assert.equal(deleted, false)

  const ownerPage = await readCustomers(owner, { restaurantId: 'restaurant-a', sort: 'spend' }, adapter)
  assert.equal(ownerPage.ok && ownerPage.value.customers[0]?.spend, 420)
})

test('the customer list is masked for everyone; owners reveal one customer at a time', async () => {
  const adapter = port()
  const projections: boolean[] = []
  adapter.listCustomers = async (input) => {
    projections.push(input.includeContactData)
    return ok(emptyPage)
  }
  await readCustomers(context, { restaurantId: 'restaurant-a' }, adapter)
  await readCustomers(owner, { restaurantId: 'restaurant-a' }, adapter)
  assert.deepEqual(projections, [false, false])

  let revealedBy = ''
  adapter.revealContact = async (input) => { revealedBy = input.revealedBy; return ok({ phone: '+905321234567', email: null }) }
  assert.deepEqual(await revealCustomerContact(context, { restaurantId: 'restaurant-a', customerId: 'customer-a' }, adapter), err('Not authorized'))
  assert.equal(revealedBy, '')
  assert.deepEqual(await revealCustomerContact(owner, { restaurantId: 'restaurant-a', customerId: 'customer-a' }, adapter), ok({ phone: '+905321234567', email: null }))
  assert.equal(revealedBy, 'staff-a')
})

test('customer detail is tenant-bound, masked, and hides spend from staff', async () => {
  const adapter = port()
  const projections: boolean[] = []
  let calls = 0
  adapter.readDetail = async (input) => {
    calls += 1
    projections.push(input.includeContactData)
    return ok({
      spend: 420,
      timeline: [{ id: 'order', at: 'now', kind: 'order', amount: 120 }, { id: 'points', at: 'now', kind: 'ledger', delta: 5 }],
    } as never)
  }
  assert.deepEqual(await readCustomerDetail(context, {
    restaurantId: 'restaurant-b', customerId: 'foreign-customer',
  }, adapter), err('Not authorized'))
  const staffView = await readCustomerDetail(context, { restaurantId: 'restaurant-a', customerId: 'customer-a' }, adapter)
  const ownerView = await readCustomerDetail(owner, { restaurantId: 'restaurant-a', customerId: 'customer-a' }, adapter)
  assert.equal(calls, 2)
  assert.deepEqual(projections, [false, false])
  assert.equal(staffView.ok && staffView.value?.spend, null)
  assert.equal(staffView.ok && staffView.value?.timeline[0]?.amount, undefined)
  assert.equal(staffView.ok && staffView.value?.timeline[1]?.delta, 5)
  assert.equal(ownerView.ok && ownerView.value?.spend, 420)
  assert.equal(ownerView.ok && ownerView.value?.timeline[0]?.amount, 120)
})

test('customer timeline cursor remains tenant-bound and bounded before persistence', async () => {
  const adapter = port()
  let calls = 0
  let receivedCursor: string | null | undefined
  adapter.readTimeline = async (input) => {
    calls += 1
    receivedCursor = input.cursor
    return ok({ events: [], hasMore: false, nextCursor: null })
  }
  assert.deepEqual(await readCustomerTimeline(context, {
    restaurantId: 'restaurant-b', customerId: 'foreign-customer', cursor: 'cursor',
  }, adapter), err('Not authorized'))
  assert.deepEqual(await readCustomerTimeline(context, {
    restaurantId: 'restaurant-a', customerId: 'customer-a', cursor: 'x'.repeat(513),
  }, adapter), err('Geçersiz hareket imleci'))
  const result = await readCustomerTimeline(context, {
    restaurantId: 'restaurant-a', customerId: 'customer-a', cursor: 'opaque-cursor',
  }, adapter)
  assert.deepEqual(result, ok({ events: [], hasMore: false, nextCursor: null }))
  assert.equal(calls, 1)
  assert.equal(receivedCursor, 'opaque-cursor')
})

test('segment and owner-only credit commands derive audit identity from the actor', async () => {
  const adapter = port()
  let creator = ''
  adapter.createSegment = async (input) => {
    creator = input.createdBy
    return ok({ id: 'segment', restaurantId: input.restaurantId, name: input.name, definition: input.definition, createdAt: 'now', updatedAt: 'now' })
  }
  let granter = ''
  let requestId = ''
  adapter.grantStoreCredit = async (input) => {
    granter = input.grantedBy
    requestId = input.requestId
    return ok({ granted: input.points, replayed: false })
  }
  await createCustomerSegment(context, { restaurantId: 'restaurant-a', name: ' VIP ', definition: {} }, adapter)
  await grantCustomerStoreCredit(owner, {
    restaurantId: 'restaurant-a', customerId: 'customer', requestId: REQUEST_ID, points: 10.9, reason: ' Doğum günü ',
  }, adapter)
  assert.equal(creator, 'staff-a')
  assert.equal(granter, 'staff-a')
  assert.equal(requestId, 'b7e9d88d-5a25-4a66-951f-4ea3ded5b8fb')
})

test('customer members cannot grant manual store credit', async () => {
  const adapter = port()
  let called = false
  adapter.grantStoreCredit = async () => {
    called = true
    return ok({ granted: 10, replayed: false })
  }
  const result = await grantCustomerStoreCredit(context, {
    restaurantId: 'restaurant-a', customerId: 'customer', requestId: REQUEST_ID, points: 10, reason: 'Hediye',
  }, adapter)
  assert.deepEqual(result, err('Not authorized'))
  assert.equal(called, false)
})

test('point changes need a reason, and only the owner can deduct', async () => {
  const adapter = port()
  const deductions: Array<{ points: number; reason: string; deductedBy: string }> = []
  adapter.deductPoints = async (input) => {
    deductions.push({ points: input.points, reason: input.reason, deductedBy: input.deductedBy })
    return ok({ deducted: input.points, replayed: false })
  }
  let grantNote: string | undefined
  adapter.grantStoreCredit = async (input) => { grantNote = input.note; return ok({ granted: input.points, replayed: false }) }

  const base = { restaurantId: 'restaurant-a', customerId: 'customer', requestId: REQUEST_ID, points: 25 }
  assert.deepEqual(await grantCustomerStoreCredit(owner, { ...base, reason: '  ' }, adapter), err('Bir sebep yazın'))
  assert.deepEqual(await deductCustomerPoints(owner, { ...base, reason: '' }, adapter), err('Bir sebep yazın'))
  assert.deepEqual(await deductCustomerPoints(owner, { ...base, reason: 'x'.repeat(81) }, adapter), err('Sebep en fazla 80 karakter olabilir'))
  assert.deepEqual(await deductCustomerPoints(context, { ...base, reason: 'Hata' }, adapter), err('Not authorized'))
  assert.equal(grantNote, undefined)
  assert.deepEqual(deductions, [])

  assert.deepEqual(await deductCustomerPoints(owner, { ...base, reason: ' Yanlış giriş ' }, adapter), ok({ deducted: 25, replayed: false }))
  assert.deepEqual(deductions, [{ points: 25, reason: 'Yanlış giriş', deductedBy: 'staff-a' }])
})

test('any customer member can add notes; deletes carry the actor role to the port', async () => {
  const adapter = port()
  let author = ''
  adapter.addNote = async (input) => { author = input.authorId; return ok({ id: 'note', body: input.body, authorId: input.authorId, authorLabel: 'Ada', createdAt: 'now' }) }
  const deletes: Array<{ actorId: string; actorIsOwner: boolean }> = []
  adapter.deleteNote = async (input) => { deletes.push({ actorId: input.actorId, actorIsOwner: input.actorIsOwner }); return ok(true) }

  assert.deepEqual(await addCustomerNote(context, { restaurantId: 'restaurant-a', customerId: 'customer', body: '   ' }, adapter), err('Not boş olamaz'))
  assert.deepEqual(await addCustomerNote(context, { restaurantId: 'restaurant-a', customerId: 'customer', body: 'x'.repeat(501) }, adapter), err('Not en fazla 500 karakter olabilir'))
  assert.deepEqual(await addCustomerNote({ ...context, permissions: ['orders'] }, { restaurantId: 'restaurant-a', customerId: 'customer', body: 'Fıstık alerjisi' }, adapter), err('Not authorized'))
  const added = await addCustomerNote(context, { restaurantId: 'restaurant-a', customerId: 'customer', body: ' Fıstık alerjisi ' }, adapter)
  assert.equal(added.ok && added.value.body, 'Fıstık alerjisi')
  assert.equal(author, 'staff-a')

  assert.deepEqual(await deleteCustomerNote(context, { restaurantId: 'restaurant-a', customerId: 'customer', noteId: 'nope' }, adapter), err('Geçersiz not'))
  await deleteCustomerNote(context, { restaurantId: 'restaurant-a', customerId: 'customer', noteId: REQUEST_ID }, adapter)
  await deleteCustomerNote(owner, { restaurantId: 'restaurant-a', customerId: 'customer', noteId: REQUEST_ID }, adapter)
  assert.deepEqual(deletes, [{ actorId: 'staff-a', actorIsOwner: false }, { actorId: 'staff-a', actorIsOwner: true }])
})

test('manual credit rejects a malformed request id before persistence', async () => {
  const adapter = port()
  let called = false
  adapter.grantStoreCredit = async () => {
    called = true
    return ok({ granted: 10, replayed: false })
  }
  const result = await grantCustomerStoreCredit(owner, {
    restaurantId: 'restaurant-a', customerId: 'customer', requestId: 'retry-me', points: 10, reason: 'Hediye',
  }, adapter)
  assert.deepEqual(result, err('Geçersiz istek kimliği'))
  assert.equal(called, false)
})

test('first-login preserves required ordering and only affirmative consent side effects', async () => {
  const calls: string[] = []
  const identityPort: CustomerIdentityPort = {
    async upsertIdentity(input) {
      calls.push(`upsert:${input.verifiedEmail}:${input.name}:${input.verifiedPhone ?? 'none'}`)
      return { ok: true, customer: { id: 'customer-a', email: input.verifiedEmail, name: input.name } }
    },
    async stampCustomerRole() { calls.push('stamp'); return ok(null) },
    async associateRestaurant() { calls.push('associate'); return ok(null) },
    async creditWelcomeBonus() { calls.push('bonus') },
    async recordConsent(input) { calls.push(`consent:${input.consentType}`); return ok(null) },
  }
  const result = await ensureCustomerIdentity({
    authUserId: 'auth-a',
    email: ' MEMBER@EXAMPLE.COM ',
    phone: '+905321234567',
    userMetadata: { full_name: ' Ada ' },
    appMetadata: { provider: 'email' },
  }, {
    restaurantId: 'restaurant-a',
    consent: true,
    marketingConsent: false,
  }, identityPort)
  assert.equal(result.ok, true)
  assert.deepEqual(calls, [
    'upsert:member@example.com:Ada:+905321234567',
    'stamp',
    'associate',
    'bonus',
    'consent:contact_data',
  ])
})

test('first-login accepts a confirmed phone without inventing an email', async () => {
  let contact: { verifiedEmail: string | null; verifiedPhone: string | null } | null = null
  const identityPort: CustomerIdentityPort = {
    async upsertIdentity(input) {
      contact = { verifiedEmail: input.verifiedEmail, verifiedPhone: input.verifiedPhone }
      return { ok: true, customer: { id: 'customer-phone', email: null, name: null } }
    },
    async stampCustomerRole() { return ok(null) },
    async associateRestaurant() { return ok(null) },
    async creditWelcomeBonus() {},
    async recordConsent() { return ok(null) },
  }
  const result = await ensureCustomerIdentity({
    authUserId: 'auth-phone',
    email: null,
    phone: '+905321234567',
    userMetadata: {},
    appMetadata: { provider: 'phone' },
  }, {}, identityPort)
  assert.equal(result.ok, true)
  assert.deepEqual(contact, { verifiedEmail: null, verifiedPhone: '+905321234567' })
})

test('consent updates reject a cross-tenant customer before persistence', async () => {
  let called = false
  const consentPort: CustomerConsentPort = {
    async recordConsent() { called = true; return ok(null) },
    async readSnapshot() { return ok({ consentGiven: true, marketingConsentGiven: false }) },
  }
  const result = await updateCustomerConsent({
    actor: 'customer-member',
    authUserId: 'auth-a',
    customerId: 'customer-a',
    restaurantId: 'restaurant-a',
  }, {
    restaurantId: 'restaurant-b',
    grant: true,
    consentType: 'marketing',
  }, consentPort)
  assert.deepEqual(result, err('Not authorized'))
  assert.equal(called, false)
})

test('only the owner can change automatic rewards and birthdays', async () => {
  const rule = { restaurantId: 'restaurant-a', kind: 'visit' as const, enabled: true, points: 200, params: { every: 10 } }
  assert.equal((await saveCustomerRewardRule(context, rule, port())).ok, false)
  assert.equal((await saveCustomerRewardRule(owner, rule, port())).ok, true)
  assert.equal((await saveCustomerRewardRule(owner, { ...rule, params: { every: 1 } }, port())).ok, false)
  assert.equal((await saveCustomerRewardRule(owner, { ...rule, kind: 'birthday', params: { leadDays: 5 as 3 } }, port())).ok, false)
  assert.equal((await previewCustomerRewardRule(context, rule, port())).ok, false)
  const birthday = { restaurantId: 'restaurant-a', customerId: 'c', month: 2, day: 30 }
  assert.equal((await setCustomerBirthdayByOwner(owner, birthday, port())).ok, false)
  assert.equal((await setCustomerBirthdayByOwner(owner, { ...birthday, day: 29 }, port())).ok, true)
  assert.equal((await setCustomerBirthdayByOwner(context, { ...birthday, day: 29 }, port())).ok, false)
})
