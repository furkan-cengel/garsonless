import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createPlatformErrorReadPort,
  recordPlatformErrorEvent,
  type PlatformErrorRpc,
} from './platform-error-event-port'

const fingerprint = 'a'.repeat(32)
const tenantId = '11111111-1111-4111-8111-111111111111'
const now = '2026-07-23T10:00:00.000Z'

function rpc(data: unknown, error?: string): PlatformErrorRpc {
  return async () => ({ data, error: error ? { message: error } : null })
}

test('safe aggregate projection parses through the read port', async () => {
  const result = await createPlatformErrorReadPort(rpc({
    eventCount: 4,
    fingerprintCount: 1,
    criticalFingerprintCount: 0,
    affectedTenantCount: 1,
    items: [{
      fingerprint,
      app: 'dashboard',
      source: 'dashboard-query.order-volume',
      publicCode: 'MAS-SVC-503',
      severity: 'error',
      occurrenceCount: 4,
      affectedTenantCount: 1,
      firstSeenAt: now,
      lastSeenAt: now,
      sampleTenant: { id: tenantId, name: 'Test Cafe' },
    }],
  })).readOverview({ window: '24h', app: null, severity: null, limit: 50 })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.value.items[0]?.publicCode, 'MAS-SVC-503')
  assert.equal(result.value.items[0]?.sampleTenant?.name, 'Test Cafe')
})

test('malformed or raw diagnostic projections fail closed', async () => {
  const result = await createPlatformErrorReadPort(rpc({
    eventCount: 1,
    fingerprintCount: 1,
    criticalFingerprintCount: 0,
    affectedTenantCount: 0,
    items: [{
      fingerprint,
      app: 'dashboard',
      source: 'SQL failed customer@example.com',
      publicCode: 'MAS-SVC-503',
      severity: 'error',
      occurrenceCount: 1,
      affectedTenantCount: 0,
      firstSeenAt: now,
      lastSeenAt: now,
      sampleTenant: null,
      stack: 'secret',
    }],
  })).readOverview({ window: '24h', app: null, severity: null, limit: 50 })
  assert.deepEqual(result, { ok: false, error: 'platform_error_overview_query_failed' })
})

test('event recorder sends only the closed privacy-safe payload', async () => {
  let called: unknown
  const call: PlatformErrorRpc = async (name, args) => {
    called = { name, args }
    return { data: fingerprint, error: null }
  }
  assert.equal(await recordPlatformErrorEvent({
    restaurantId: tenantId,
    app: 'dashboard',
    source: 'dashboard-query.order-volume',
    publicCode: 'MAS-SVC-503',
    severity: 'error',
    referenceId: '12345678-1234-1234-1234-123456789012',
    occurredAt: now,
  }, call), fingerprint)
  assert.deepEqual(called, {
    name: 'record_platform_error_event',
    args: {
      p_restaurant_id: tenantId,
      p_app: 'dashboard',
      p_source: 'dashboard-query.order-volume',
      p_public_code: 'MAS-SVC-503',
      p_severity: 'error',
      p_reference_id: '12345678-1234-1234-1234-123456789012',
      p_occurred_at: now,
    },
  })
})

test('free-form source and invalid tenant fail before RPC', async () => {
  let calls = 0
  const call: PlatformErrorRpc = async () => {
    calls += 1
    return { data: fingerprint, error: null }
  }
  await assert.rejects(recordPlatformErrorEvent({
    restaurantId: 'not-a-tenant',
    app: 'dashboard',
    source: 'SQL failed customer@example.com',
    publicCode: 'MAS-SVC-503',
    severity: 'error',
  }, call), /invalid_platform_error_event/)
  assert.equal(calls, 0)
})
