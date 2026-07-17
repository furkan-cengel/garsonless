import { randomUUID } from 'node:crypto'
import { createServiceClient } from '../src/client'
import { createKitchenLaunchTicket } from '../src/kitchen-session'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function main() {
  const baseUrl = process.env['KITCHEN_RUNTIME_URL'] ?? 'http://localhost:3002'
  const { data: restaurant, error } = await createServiceClient().from('restaurants')
    .select('id, name').eq('slug', 'test-cafe-b').single()
  if (error || !restaurant) throw error ?? new Error('Test Cafe B unavailable')

  const ticket = await createKitchenLaunchTicket(restaurant.id)
  assert(ticket, 'Test Cafe B kitchen access is not configured')

  const legacySecret = 'legacy-query-secret-must-not-authenticate'
  const legacyResponse = await fetch(`${baseUrl}/kitchen/${restaurant.id}?token=${legacySecret}`, {
    redirect: 'manual',
  })
  const legacyHtml = await legacyResponse.text()
  const legacyLocation = legacyResponse.headers.get('location') ?? ''
  assert(legacyResponse.status === 307, `Legacy URL returned ${legacyResponse.status}`)
  assert(legacyLocation === `/kitchen/${restaurant.id}`, 'Legacy URL did not redirect to the clean path')
  const cleanSignedOut = await fetch(new URL(legacyLocation, baseUrl))
  const cleanSignedOutHtml = await cleanSignedOut.text()
  assert(cleanSignedOut.status === 200, 'Clean KDS URL did not render the signed-out state')
  assert(cleanSignedOutHtml.includes('Mutfak oturumu gerekli'), 'Legacy query token unexpectedly authenticated')
  assert(!cleanSignedOutHtml.includes(legacySecret), 'Legacy query token reached the clean KDS payload')

  const wrongTenant = await fetch(`${baseUrl}/kitchen/${randomUUID()}/session`, {
    method: 'POST',
    body: new URLSearchParams({ ticket }),
    redirect: 'manual',
  })
  assert(wrongTenant.status === 401, 'Cross-tenant launch ticket was accepted')

  const exchange = await fetch(`${baseUrl}/kitchen/${restaurant.id}/session`, {
    method: 'POST',
    body: new URLSearchParams({ ticket }),
    redirect: 'manual',
  })
  const setCookie = exchange.headers.get('set-cookie') ?? ''
  const cookie = setCookie.split(';', 1)[0] ?? ''
  const location = exchange.headers.get('location') ?? ''
  assert(exchange.status === 303, `Exchange returned ${exchange.status}`)
  assert(cookie.startsWith(`masabu_kds_${restaurant.id}=`), 'Scoped kitchen cookie was not set')
  assert(/HttpOnly/i.test(setCookie), 'Kitchen cookie is not HttpOnly')
  assert(/SameSite=Lax/i.test(setCookie), 'Kitchen cookie is not SameSite=Lax')
  assert(location.endsWith(`/kitchen/${restaurant.id}`), 'Exchange did not redirect to the clean KDS URL')
  assert(!location.includes('token=') && !location.includes('ticket='), 'Redirect leaked a credential')

  const replayExchange = await fetch(`${baseUrl}/kitchen/${restaurant.id}/session`, {
    method: 'POST',
    body: new URLSearchParams({ ticket }),
    redirect: 'manual',
  })
  assert(replayExchange.status === 401, 'Consumed launch ticket was accepted over HTTP')

  const board = await fetch(location, { headers: { Cookie: cookie } })
  const boardHtml = await board.text()
  assert(board.status === 200, `Authenticated KDS returned ${board.status}`)
  assert(!boardHtml.includes('Mutfak oturumu gerekli'), 'Session cookie did not authenticate KDS')
  assert(boardHtml.includes(restaurant.name), 'Authenticated KDS did not render the restaurant')

  console.log(JSON.stringify({
    legacyQuery: {
      status: legacyResponse.status,
      authenticated: false,
      cleanPayloadReflected: false,
      devRedirectPayloadReflected: legacyHtml.includes(legacySecret),
    },
    crossTenantExchange: wrongTenant.status,
    exchange: {
      status: exchange.status,
      redirect: location.replace(restaurant.id, '<restaurant-id>'),
      cookie: {
        scopedName: true,
        httpOnly: /HttpOnly/i.test(setCookie),
        sameSiteLax: /SameSite=Lax/i.test(setCookie),
      },
    },
    replayExchange: replayExchange.status,
    board: { status: board.status, restaurantRendered: true, cleanUrl: !location.includes('?') },
  }, null, 2))
}

void main()
