import { createServiceClient } from '../../packages/db/src/service-client.ts'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const fixturePath = 'test-results/visual-auth/fixture.json'
const devUrl = 'https://yxsegwkzyiscrxiwdeuf.supabase.co'

function fixtureClient() {
  if (process.env['NEXT_PUBLIC_SUPABASE_URL'] !== devUrl) throw new Error('Visual fixtures are DEV-only')
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!key) throw new Error('Visual fixture service key is required')
  return createServiceClient()
}

export async function createDashboardFixture(ownerId: string) {
  await cleanupDashboardFixture()
  const client = fixtureClient()
  const restaurantId = randomUUID()
  const slug = `visual-runtime-${restaurantId}`
  const restaurant = await client.from('restaurants').insert({
    id: restaurantId, owner_id: ownerId, slug, name: 'Visual Runtime Restoranı', plan: 'business',
  })
  if (restaurant.error) throw new Error(`Visual restaurant fixture: ${restaurant.error.code}`)
  mkdirSync(dirname(fixturePath), { recursive: true })
  writeFileSync(fixturePath, JSON.stringify({ restaurantId, slug, ownerId }), { mode: 0o600 })
  try {
    const customerId = randomUUID()
    const customer = await client.from('billing_customers').insert({
      id: customerId, restaurant_id: restaurantId, legal_name: 'Visual Runtime Fixture',
      contact_email: 'visual-runtime@example.invalid',
    })
    if (customer.error) throw new Error(`Visual billing fixture: ${customer.error.code}`)
    const subscription = await client.from('billing_subscriptions').insert({
      restaurant_id: restaurantId, billing_customer_id: customerId, plan: 'business', status: 'active',
      current_period_start: new Date(Date.now() - 60_000).toISOString(),
      current_period_end: new Date(Date.now() + 86_400_000).toISOString(),
    })
    if (subscription.error) throw new Error(`Visual subscription fixture: ${subscription.error.code}`)
    const categoryId = randomUUID()
    const category = await client.from('menu_categories').insert({
      id: categoryId, restaurant_id: restaurantId, name: 'Başlangıçlar', position: 0,
    })
    if (category.error) throw new Error(`Visual category fixture: ${category.error.code}`)
    const item = await client.from('menu_items').insert({
      category_id: categoryId, name: 'Günün çorbası', description: 'Mevsim sebzeleriyle hazırlanır.',
      price: 150, is_available: true, position: 0,
    })
    if (item.error) throw new Error(`Visual item fixture: ${item.error.code}`)
    return restaurantId
  } catch (error) {
    await cleanupDashboardFixture()
    throw error
  }
}

export async function cleanupDashboardFixture() {
  if (!existsSync(fixturePath)) return
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
    restaurantId: string; slug: string; ownerId: string
  }
  if (fixture.slug !== `visual-runtime-${fixture.restaurantId}`) throw new Error('Invalid visual fixture identity')
  const client = fixtureClient()
  const owned = await client.from('restaurants').select('id')
    .eq('id', fixture.restaurantId).eq('slug', fixture.slug).eq('owner_id', fixture.ownerId).maybeSingle()
  if (owned.error) throw new Error('Visual fixture ownership could not be verified')
  if (!owned.data) throw new Error('Visual fixture identity no longer matches')
  const categories = await client.from('menu_categories').select('id').eq('restaurant_id', fixture.restaurantId)
  if (categories.error) throw new Error('Visual category cleanup could not be prepared')
  if (categories.data.length) {
    const items = await client.from('menu_items').delete().in('category_id', categories.data.map(row => row.id))
    if (items.error) throw new Error(`Visual item cleanup: ${items.error.code}`)
  }
  // Catalog delete triggers write invalidations, so their parent must still
  // exist while those triggers run; a restaurant cascade is too late.
  for (const table of ['menu_categories', 'billing_subscriptions', 'billing_customers'] as const) {
    const removed = await client.from(table).delete().eq('restaurant_id', fixture.restaurantId)
    if (removed.error) throw new Error(`Visual fixture cleanup ${table}: ${removed.error.code}`)
  }
  const result = await client.from('restaurants').delete()
    .eq('id', fixture.restaurantId).eq('slug', fixture.slug).eq('owner_id', fixture.ownerId)
  if (result.error) throw new Error(`Visual fixture cleanup: ${result.error.code}`)
  const remaining = await client.from('restaurants').select('id').eq('id', fixture.restaurantId)
  if (remaining.error || remaining.data?.length) throw new Error('Visual fixture cleanup could not be verified')
  unlinkSync(fixturePath)
}

export default cleanupDashboardFixture
