import assert from 'node:assert/strict'
import test from 'node:test'
import { logoutCurrentBrowser, isDashboardLoggingOut } from '../client-logout'

for (const outcome of ['network', 'http-error', 'invalid-json', 'invalid-result', 'success'] as const) {
  test(`logout request: ${outcome}`, async () => {
    const originalFetch = globalThis.fetch
    const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
    let unsubscribed = false
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
      serviceWorker: { getRegistration: async () => ({ pushManager: { getSubscription: async () => ({
        endpoint: 'https://push.example.test/current-browser',
        unsubscribe: async () => { unsubscribed = true; return true },
      }) } }) },
    } })
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/auth/logout')
      assert.equal(options?.method, 'POST')
      assert.equal(options?.credentials, 'same-origin')
      assert.deepEqual(JSON.parse(options?.body as string), { endpoint: 'https://push.example.test/current-browser' })
      if (outcome === 'network') throw new TypeError('Failed to fetch')
      if (outcome === 'invalid-json') return new Response('<html>Login</html>')
      if (outcome === 'http-error') return Response.json({ error: 'Private diagnostic' }, { status: 503 })
      return Response.json(outcome === 'success' ? { success: true } : { success: false })
    }
    try {
      assert.equal(isDashboardLoggingOut(), false)
      const pending = logoutCurrentBrowser()
      assert.equal(isDashboardLoggingOut(), true, 'Polling stops before session revocation')
      assert.equal(logoutCurrentBrowser(), pending, 'Concurrent logout shares one request')
      const result = await pending
      if (outcome === 'success') {
        assert.deepEqual(result, { success: true })
        assert.equal(unsubscribed, true)
        assert.equal(isDashboardLoggingOut(), true, 'Polling stays stopped until navigation')
      } else {
        assert.deepEqual(result, { error: 'Çıkış yapılamadı. Bağlantını kontrol edip tekrar dene.' })
        assert.equal(isDashboardLoggingOut(), false, 'Failed logout resumes background work')
        assert.equal(unsubscribed, false, 'Failed logout preserves subscription for retry')
      }
    } finally {
      globalThis.fetch = originalFetch
      if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor)
      else Reflect.deleteProperty(globalThis, 'navigator')
    }
  })
}
