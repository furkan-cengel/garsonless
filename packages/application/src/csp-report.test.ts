import assert from 'node:assert/strict'
import test from 'node:test'
import { createCspViolationThrottle, handleCspReport, normalizeCspReports } from './csp-report'

const legacyReport = (overrides: Record<string, string> = {}) => ({
  'csp-report': {
    'document-uri': 'https://menu.masabu.co/cafe/table/0b8f2a1e-3c4d-4e5f-8a9b-1c2d3e4f5a6b?session=secret-value',
    'effective-directive': 'script-src-elem',
    'blocked-uri': 'https://evil.example/payload.js?token=abc',
    'source-file': 'https://menu.masabu.co/_next/static/chunks/app.js?v=1',
    disposition: 'report',
    ...overrides,
  },
})

test('legacy reports keep only the directive, blocked origin and masked path', () => {
  assert.deepEqual(normalizeCspReports(legacyReport()), [{
    directive: 'script-src-elem',
    blocked: 'https://evil.example',
    path: '/cafe/table/:id',
    sourceOrigin: 'https://menu.masabu.co',
    disposition: 'report',
  }])
})

test('keyword and scheme sources are reported without URLs', () => {
  assert.equal(normalizeCspReports(legacyReport({ 'blocked-uri': 'inline' }))[0]?.blocked, 'inline')
  assert.equal(normalizeCspReports(legacyReport({ 'blocked-uri': 'data' }))[0]?.blocked, 'data')
  assert.equal(normalizeCspReports(legacyReport({ 'blocked-uri': 'blob:' }))[0]?.blocked, 'blob')
})

test('reports caused by browser extensions are dropped', () => {
  assert.deepEqual(normalizeCspReports(legacyReport({ 'blocked-uri': 'chrome-extension://abc/inject.js' })), [])
  assert.deepEqual(normalizeCspReports(legacyReport({ 'source-file': 'moz-extension://abc/content.js' })), [])
})

test('reporting API batches are normalized and capped', () => {
  const entry = {
    type: 'csp-violation',
    body: {
      documentURL: 'https://app.masabu.co/dashboard/0b8f2a1e-3c4d-4e5f-8a9b-1c2d3e4f5a6b/menu',
      effectiveDirective: 'connect-src',
      blockedURL: 'https://collector.example/beacon',
      disposition: 'enforce',
    },
  }
  const violations = normalizeCspReports([entry, { type: 'deprecation', body: {} }, ...Array.from({ length: 30 }, () => entry)])
  assert.equal(violations.length, 19)
  assert.deepEqual(violations[0], {
    directive: 'connect-src',
    blocked: 'https://collector.example',
    path: '/dashboard/:id/menu',
    sourceOrigin: null,
    disposition: 'enforce',
  })
})

test('malformed payloads produce no violations', () => {
  for (const payload of [null, 'text', 42, {}, { 'csp-report': 'x' }, [{ type: 'csp-violation' }]]) {
    assert.deepEqual(normalizeCspReports(payload), [])
  }
})

test('throttle logs a key once per window and carries the suppressed count', () => {
  const throttle = createCspViolationThrottle(1_000)
  assert.deepEqual(throttle('k', 0), { log: true, suppressed: 0 })
  assert.deepEqual(throttle('k', 10), { log: false, suppressed: 0 })
  assert.deepEqual(throttle('k', 20), { log: false, suppressed: 0 })
  assert.deepEqual(throttle('k', 1_500), { log: true, suppressed: 2 })
  assert.deepEqual(throttle('other', 1_500), { log: true, suppressed: 0 })
})

test('handler logs sanitized JSON, always answers 204 and ignores other content types', async () => {
  const lines: string[] = []
  const options = { log: (line: string) => lines.push(line), now: () => 0, throttle: createCspViolationThrottle() }
  const post = (body: string, contentType: string) => handleCspReport(
    new Request('https://menu.masabu.co/api/csp-report', { method: 'POST', headers: { 'content-type': contentType }, body }),
    'menu',
    options,
  )

  const first = await post(JSON.stringify(legacyReport()), 'application/csp-report')
  const duplicate = await post(JSON.stringify(legacyReport()), 'application/csp-report')
  const ignored = await post(JSON.stringify(legacyReport()), 'text/plain')
  const invalid = await post('{not json', 'application/csp-report')
  assert.deepEqual([first.status, duplicate.status, ignored.status, invalid.status], [204, 204, 204, 204])
  assert.equal(lines.length, 1)
  const logged = JSON.parse(lines[0]!)
  assert.equal(logged.event, 'csp.violation')
  assert.equal(logged.app, 'menu')
  assert.doesNotMatch(lines[0]!, /secret-value|token=abc|0b8f2a1e/)
})
