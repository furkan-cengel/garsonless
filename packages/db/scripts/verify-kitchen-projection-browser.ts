import { randomBytes, randomUUID } from 'node:crypto'
import { chromium } from '@playwright/test'
import { createServiceClient } from '../src/client'
import { createKitchenLaunchTicket } from '../src/kitchen-session'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const service = createServiceClient()
const suffix = randomUUID().slice(0, 8)
let restaurantId = ''

async function main() {
  const baseUrl = process.env['KITCHEN_RUNTIME_URL'] ?? 'http://localhost:3002'
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null
  let primaryError: unknown = null
  try {
    const { data: fixture, error: fixtureError } = await service.from('restaurants')
      .select('owner_id').eq('slug', 'test-cafe-b').single()
    if (fixtureError || !fixture?.owner_id) throw fixtureError ?? new Error('Fixture owner unavailable')

    const { data: restaurant, error: restaurantError } = await service.from('restaurants').insert({
      owner_id: fixture.owner_id,
      slug: `kitchen-browser-${suffix}`,
      name: `Kitchen browser ${suffix}`,
      settings: { runtimeMarker: suffix },
    }).select('id').single()
    if (restaurantError || !restaurant) throw restaurantError ?? new Error('Restaurant unavailable')
    restaurantId = restaurant.id

    const { data: table, error: tableError } = await service.from('tables').insert({
      restaurant_id: restaurantId,
      label: 'Browser Projection Table',
    }).select('id').single()
    if (tableError || !table) throw tableError ?? new Error('Table unavailable')
    const { error: credentialError } = await service.from('kitchen_credentials').insert({
      restaurant_id: restaurantId,
      token: randomBytes(32).toString('base64url'),
    })
    if (credentialError) throw credentialError
    const { error: initialOrderError } = await service.from('orders').insert({
      restaurant_id: restaurantId,
      table_id: table.id,
      session_id: randomUUID(),
      status: 'sent_to_kitchen',
      items: [{ name: 'Browser initial item', quantity: 1 }],
      total: 10,
    })
    if (initialOrderError) throw initialOrderError

    const ticket = await createKitchenLaunchTicket(restaurantId)
    assert(ticket, 'Kitchen launch ticket unavailable')
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext()
    const page = await context.newPage()
    const consoleErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })

    const exchange = await context.request.post(`${baseUrl}/kitchen/${restaurantId}/session`, {
      form: { ticket },
      maxRedirects: 0,
    })
    assert(exchange.status() === 303, `Kitchen exchange returned ${exchange.status()}`)
    const response = await page.goto(`${baseUrl}/kitchen/${restaurantId}`, { waitUntil: 'networkidle' })
    assert(response?.status() === 200, `Kitchen board returned ${response?.status()}`)
    await page.getByText('Browser initial item', { exact: true }).waitFor({ state: 'visible' })

    const { data: liveOrder, error: liveOrderError } = await service.from('orders').insert({
      restaurant_id: restaurantId,
      table_id: table.id,
      session_id: randomUUID(),
      status: 'preparing',
      items: [{ name: 'Browser delta item', quantity: 2 }],
      total: 20,
    }).select('id').single()
    if (liveOrderError || !liveOrder) throw liveOrderError ?? new Error('Live order unavailable')

    const insertedAt = Date.now()
    await page.getByText('Browser delta item', { exact: true }).waitFor({ state: 'visible', timeout: 12_000 })
    const insertLatencyMs = Date.now() - insertedAt

    const { error: servedError } = await service.from('orders')
      .update({ status: 'served' }).eq('id', liveOrder.id).eq('restaurant_id', restaurantId)
    if (servedError) throw servedError
    const removedAt = Date.now()
    await page.getByText('Browser delta item', { exact: true }).waitFor({ state: 'hidden', timeout: 12_000 })
    const removalLatencyMs = Date.now() - removedAt

    console.log(JSON.stringify({
      exchange: exchange.status(),
      board: response?.status(),
      delta: { inserted: true, insertLatencyMs, tombstoneRemoved: true, removalLatencyMs },
      initialCardPreserved: await page.getByText('Browser initial item', { exact: true }).isVisible(),
      consoleErrors,
    }, null, 2))
  } catch (error) {
    primaryError = error
  }

  if (browser) await browser.close()
  if (restaurantId) {
    const { error } = await service.from('restaurants').delete().eq('id', restaurantId)
    if (error) throw error
  }
  const marker = restaurantId || randomUUID()
  const [restaurants, orders, tables, credentials, launches] = await Promise.all([
    service.from('restaurants').select('id', { count: 'exact', head: true }).eq('id', marker),
    service.from('orders').select('id', { count: 'exact', head: true }).eq('restaurant_id', marker),
    service.from('tables').select('id', { count: 'exact', head: true }).eq('restaurant_id', marker),
    service.from('kitchen_credentials').select('restaurant_id', { count: 'exact', head: true }).eq('restaurant_id', marker),
    service.from('kitchen_session_launches').select('restaurant_id', { count: 'exact', head: true }).eq('restaurant_id', marker),
  ])
  const cleanup = {
    restaurants: restaurants.count,
    orders: orders.count,
    tables: tables.count,
    credentials: credentials.count,
    launches: launches.count,
  }
  console.log(JSON.stringify({ cleanup }))
  assert(Object.values(cleanup).every((count) => count === 0), 'Browser runtime cleanup left orphan rows')
  if (primaryError) throw primaryError
}

void main()
