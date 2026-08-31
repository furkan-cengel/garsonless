import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const route = readFileSync(
  new URL('../../../apps/menu/app/api/service-request/route.ts', import.meta.url),
  'utf8',
)
const trigger = readFileSync(new URL('./outbox-worker-trigger.ts', import.meta.url), 'utf8')

test('service requests trigger the outbox worker after the response fast path', () => {
  assert.match(route, /after\(\(\) => triggerDomainOutboxWorker\(\)\)/)
  assert.match(route, /if \(!result\.value\.throttled\)/)
})

test('the fast path invokes the durable worker without replacing cron fallback', () => {
  assert.match(trigger, /rpc\('invoke_domain_outbox_worker'\)/)
  assert.match(trigger, /if \(error\) console\.error/)
})
