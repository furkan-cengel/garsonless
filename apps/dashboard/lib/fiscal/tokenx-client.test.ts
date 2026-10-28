import assert from 'node:assert/strict'
import test from 'node:test'
import { createTokenxClient, readTokenxConfig, TokenxError } from './tokenx-client'

const config = {
  authUrl: 'https://auth.test', basketUrl: 'https://basket.test', clientSettingsUrl: 'https://settings.test',
  clientId: 'id', clientSecret: 'secret',
}

function fakeFetch(responses: Array<{ status?: number; body: unknown }>) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const fetcher = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    const next = responses.shift() ?? { body: { status: 0 } }
    return new Response(JSON.stringify(next.body), { status: next.status ?? 200, headers: { 'content-type': 'application/json' } })
  }) as unknown as typeof fetch
  return { fetcher, calls }
}

const auth = { status: 201, body: { status: 201, result: { accessToken: 'tok', expiresIn: 86400, tokenType: 'Bearer' } } }
const basket = { items: [{ name: 'Pizza', price: 15000, sectionNo: 1, taxPercent: 1000, quantity: 1000 }], discount: 0, total: 15000 }
const meta = { title: 'Masa 16', filter: 'Bahçe', checkNumber: null, note: null }

test('config is all-or-nothing and https only', () => {
  const env = { TOKENX_AUTH_URL: 'https://a.test', TOKENX_BASKET_URL: 'https://b.test/', TOKENX_CLIENT_SETTINGS_URL: 'https://c.test', TOKENX_CLIENT_ID: 'i', TOKENX_CLIENT_SECRET: 's' }
  assert.equal(readTokenxConfig(env as unknown as NodeJS.ProcessEnv)?.basketUrl, 'https://b.test')
  assert.equal(readTokenxConfig({ ...env, TOKENX_AUTH_URL: 'http://a.test' } as unknown as NodeJS.ProcessEnv), null)
  assert.equal(readTokenxConfig({ ...env, TOKENX_CLIENT_SECRET: '' } as unknown as NodeJS.ProcessEnv), null)
})

test('a basket is created with Basic then Bearer auth and the branch header; the token is reused', async () => {
  const { fetcher, calls } = fakeFetch([auth, { body: { status: 0 } }, { body: { status: 0 } }])
  const client = createTokenxClient(config, fetcher, () => 0)
  assert.equal(await client.putBasket('branch-1', 'b1', basket, meta), 'created')
  await client.deleteBasket('b1')
  assert.equal(calls[0]!.url, 'https://auth.test/v1/auth/token')
  assert.equal((calls[0]!.init.headers as Record<string, string>).authorization, `Basic ${Buffer.from('id:secret').toString('base64')}`)
  assert.equal(calls[1]!.url, 'https://basket.test/v1/basket')
  const headers = calls[1]!.init.headers as Record<string, string>
  assert.equal(headers.authorization, 'Bearer tok')
  assert.equal(headers['branch-id'], 'branch-1')
  assert.deepEqual(JSON.parse(String(calls[1]!.init.body)), { basketID: 'b1', title: 'Masa 16', filter: 'Bahçe', items: basket.items })
  assert.equal(calls[2]!.init.method, 'DELETE')
  assert.equal(calls.length, 3)
})

test('an existing basket (1007) is replaced with PUT and a discount travels as the adjustment', async () => {
  const { fetcher, calls } = fakeFetch([auth, { status: 400, body: { status: 1007, description: 'Duplicate' } }, { body: { status: 0 } }])
  const client = createTokenxClient(config, fetcher, () => 0)
  assert.equal(await client.putBasket('branch-1', 'b1', { ...basket, discount: 1000, total: 14000 }, meta), 'updated')
  assert.equal(calls[2]!.url, 'https://basket.test/v1/basket/b1')
  assert.equal(calls[2]!.init.method, 'PUT')
  const body = JSON.parse(String(calls[2]!.init.body))
  assert.equal(body.basketID, undefined)
  assert.deepEqual(body.adjust, { description: 'İndirim', discountOrSurcharge: 0, type: 0, value: 1000 })
})

test('a basket that is already gone counts as deleted; data errors are not retried, outages are', async () => {
  const gone = fakeFetch([auth, { status: 404, body: { status: 1006 } }])
  await createTokenxClient(config, gone.fetcher, () => 0).deleteBasket('b1')

  const locked = fakeFetch([auth, { status: 400, body: { status: 1103 } }])
  await assert.rejects(createTokenxClient(config, locked.fetcher, () => 0).putBasket('br', 'b1', basket, meta), (error: unknown) => error instanceof TokenxError && error.code === '1103' && !error.retryable)

  const down = fakeFetch([auth, { status: 503, body: 'nope' }])
  await assert.rejects(createTokenxClient(config, down.fetcher, () => 0).deleteBasket('b1'), (error: unknown) => error instanceof TokenxError && error.retryable)
})

test('device sections keep only active ones', async () => {
  const { fetcher } = fakeFetch([auth, { body: { status: 0, result: { sections: [
    { sectionNo: 1, name: 'Yiyecek', taxPercent: 1000, status: 1 },
    { sectionNo: 2, name: 'Kapalı', taxPercent: 2000, status: 0 },
  ] } } }])
  assert.deepEqual(await createTokenxClient(config, fetcher, () => 0).getSections('AV1'), [{ sectionNo: 1, name: 'Yiyecek', taxPercent: 1000 }])
})
