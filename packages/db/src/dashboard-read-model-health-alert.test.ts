import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildDashboardInsightsHealthAlertPayload,
  buildDashboardInsightsUnavailableAlertPayload,
  deliverDashboardInsightsHealthAlert,
} from './dashboard-read-model-health-alert'
import type { DashboardInsightsHealthSnapshot } from './dashboard-read-model-health'

const warningSnapshot: DashboardInsightsHealthSnapshot = {
  status: 'warning',
  observedSince: '2026-07-19T08:00:00.000Z',
  operations: [],
  alerts: [{
    level: 'warning',
    operation: 'table-refs',
    metric: 'failures',
    actual: 1,
    threshold: 1,
  }],
}

test('healthy snapshots do not produce an alert while unhealthy payloads stay aggregate-only', () => {
  assert.equal(buildDashboardInsightsHealthAlertPayload({
    ...warningSnapshot,
    status: 'healthy',
    alerts: [],
  }, { environment: 'linked-dev' }), null)

  const payload = buildDashboardInsightsHealthAlertPayload(warningSnapshot, {
    environment: ' Linked DEV ',
    checkedAt: '2026-07-19T08:15:00.000Z',
  })
  assert.deepEqual(payload, {
    schemaVersion: 1,
    event: 'dashboard-insights.health-alert',
    environment: 'linked-dev',
    checkedAt: '2026-07-19T08:15:00.000Z',
    observedSince: '2026-07-19T08:00:00.000Z',
    status: 'warning',
    fingerprint: 'dashboard-insights:linked-dev:warning:warning:table-refs:failures:1',
    alerts: warningSnapshot.alerts,
  })
  assert.doesNotMatch(JSON.stringify(payload), /restaurantId|restaurant_id|error/i)
})

test('unavailable health reads have a stable redacted fingerprint', () => {
  const payload = buildDashboardInsightsUnavailableAlertPayload({
    environment: 'production west',
    checkedAt: '2026-07-19T08:15:00.000Z',
  })
  assert.equal(payload.status, 'unavailable')
  assert.equal(payload.environment, 'production-west')
  assert.equal(payload.observedSince, null)
  assert.equal(payload.fingerprint, 'dashboard-insights:production-west:unavailable:health-read-unavailable')
  assert.deepEqual(payload.alerts, [])
})

test('webhook delivery requires HTTPS and posts only the typed payload', async () => {
  const payload = buildDashboardInsightsHealthAlertPayload(warningSnapshot, { environment: 'dev' })!
  const requests: Array<{ url: string; init: RequestInit | undefined }> = []
  const delivered = await deliverDashboardInsightsHealthAlert({
    webhookUrl: 'https://alerts.example.test/dashboard-insights',
    payload,
    fetcher: async (input, init) => {
      requests.push({ url: String(input), init })
      return new Response(null, { status: 204 })
    },
  })
  const request = requests[0]
  assert.equal(delivered.ok, true)
  assert.equal(request?.url, 'https://alerts.example.test/dashboard-insights')
  assert.equal(request?.init?.method, 'POST')
  assert.deepEqual(JSON.parse(String(request?.init?.body)), payload)

  const rejected = await deliverDashboardInsightsHealthAlert({
    webhookUrl: 'http://alerts.example.test/dashboard-insights',
    payload,
    fetcher: async () => new Response(null, { status: 204 }),
  })
  assert.deepEqual(rejected, { ok: false, error: 'invalid dashboard insights alert webhook URL' })
})

test('webhook failures are sanitized and observable to the scheduler', async () => {
  const payload = buildDashboardInsightsHealthAlertPayload(warningSnapshot, { environment: 'dev' })!
  const failed = await deliverDashboardInsightsHealthAlert({
    webhookUrl: 'https://alerts.example.test/dashboard-insights',
    payload,
    fetcher: async () => new Response(null, { status: 503 }),
  })
  assert.deepEqual(failed, {
    ok: false,
    error: 'dashboard insights alert webhook returned 503',
  })
})
