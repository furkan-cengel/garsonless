import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import type { Database, Json } from '../src/types.gen'

const OWNER_EMAIL = 'furkan_cengel_7@hotmail.com'
const DEV_PROJECT_HOST = 'yxsegwkzyiscrxiwdeuf.supabase.co'

const scenarios = [
  { slug: 'billing-test-01-cancel', name: 'Abonelik Test 01 · İptal ve Geri Alma' },
  { slug: 'billing-test-02-upgrade', name: 'Abonelik Test 02 · Upgrade' },
  { slug: 'billing-test-03-downgrade', name: 'Abonelik Test 03 · Downgrade' },
  { slug: 'billing-test-04-video-addon', name: 'Abonelik Test 04 · Video Hero Add-on' },
  { slug: 'billing-test-05-card-failure', name: 'Abonelik Test 05 · Kart ve Ödeme Hatası' },
  { slug: 'billing-test-06-refund', name: 'Abonelik Test 06 · İade' },
  { slug: 'billing-test-07-annual', name: 'Abonelik Test 07 · Yıllık Plan' },
] as const

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
assert(url && serviceRoleKey, 'DEV Supabase runtime environment is required')
assert.equal(new URL(url).host, DEV_PROJECT_HOST, 'Preparation must target DEV Supabase')
assert.equal(
  process.env.IYZICO_BILLING_BASE_URL,
  'https://sandbox-api.iyzipay.com',
  'Preparation must use Iyzico sandbox configuration',
)

const admin = createClient<Database>(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function findOwnerId(): Promise<string> {
  const matches: string[] = []
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    assert.ifError(error)
    for (const user of data.users) {
      if (user.email?.trim().toLowerCase() === OWNER_EMAIL) matches.push(user.id)
    }
    if (data.users.length < 1000) break
  }
  assert.equal(matches.length, 1, `Expected exactly one DEV auth user for ${OWNER_EMAIL}`)
  return matches[0]!
}

const billingAddress = {
  contactName: 'Furkan Cengel',
  city: 'İstanbul',
  district: 'Kartal',
  country: 'Türkiye',
  address: 'Masabu sandbox abonelik test adresi',
  zipCode: '34860',
  taxOffice: 'Kartal',
} satisfies Json

const profile = {
  legal_name: 'Masabu Sandbox Test',
  contact_name: 'Furkan',
  contact_surname: 'Cengel',
  identity_number: '26179323542',
  contact_email: OWNER_EMAIL,
  gsm_number: '+905072550524',
  billing_address: billingAddress,
  shipping_address: billingAddress,
  profile_completed_at: new Date().toISOString(),
} as const

async function main() {
  const ownerId = await findOwnerId()
  const rows: Array<{ name: string; id: string; state: 'created' | 'existing'; profile: 'created' | 'kept' }> = []

  for (const scenario of scenarios) {
    const existing = await admin.from('restaurants')
      .select('id,owner_id,deleted_at')
      .eq('slug', scenario.slug)
      .maybeSingle()
    assert.ifError(existing.error)

    let restaurantId: string
    let state: 'created' | 'existing'
    if (existing.data) {
      assert.equal(existing.data.owner_id, ownerId, `${scenario.slug} belongs to another owner`)
      assert.equal(existing.data.deleted_at, null, `${scenario.slug} is soft-deleted; refusing to restore implicitly`)
      restaurantId = existing.data.id
      state = 'existing'
    } else {
      const inserted = await admin.from('restaurants').insert({
        owner_id: ownerId,
        name: scenario.name,
        slug: scenario.slug,
        plan: 'starter',
        timezone: 'Europe/Istanbul',
        settings: {
          billingTestScenario: scenario.slug,
          notifications: {
            newOrderSound: true,
            newOrderSoundPreset: 'masabu-alert',
            newOrderSoundVolume: 70,
            newOrderRepeatSeconds: 10,
            newOrderRepeatMaxMinutes: 5,
            newOrderPush: true,
            newOrderToast: true,
            serviceRequestAlert: true,
            serviceRequestPush: false,
          },
        },
      }).select('id').single()
      assert.ifError(inserted.error)
      restaurantId = inserted.data!.id
      state = 'created'
    }

    const customer = await admin.from('billing_customers')
      .select('id,provider_customer_ref')
      .eq('restaurant_id', restaurantId)
      .maybeSingle()
    assert.ifError(customer.error)

    let profileState: 'created' | 'kept' = 'kept'
    if (!customer.data) {
      assert.ifError((await admin.from('billing_customers').insert({
        restaurant_id: restaurantId,
        ...profile,
      })).error)
      profileState = 'created'
    } else if (!customer.data.provider_customer_ref) {
      assert.ifError((await admin.from('billing_customers')
        .update(profile)
        .eq('id', customer.data.id)).error)
    }

    rows.push({ name: scenario.name, id: restaurantId, state, profile: profileState })
  }

  console.log(JSON.stringify({ owner: OWNER_EMAIL, target: 'DEV', count: rows.length, restaurants: rows }, null, 2))
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
