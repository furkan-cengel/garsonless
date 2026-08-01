import assert from 'node:assert/strict'
import test from 'node:test'
import { redactDiagnosticText, sanitizeServerDiagnostic } from './server-log-redaction'

test('diagnostic text redacts credentials, bearer tokens and common PII', () => {
  const value = redactDiagnosticText(
    'api_key=plain-secret Bearer abc.def user@example.invalid 123e4567-e89b-42d3-a456-426614174000 +90 555 111 22 33',
  )
  assert.doesNotMatch(value, /plain-secret|abc\.def|user@example|123e4567|555 111/)
  assert.match(value, /\[REDACTED\]/)
})

test('structured diagnostics redact sensitive keys and circular values', () => {
  const cause: Record<string, unknown> = {
    message: 'provider rejected request for owner@example.invalid',
    apiKey: 'sensitive-api-key',
    nested: { authorization: 'Bearer sensitive-token' },
  }
  cause['self'] = cause
  const safe = JSON.stringify(sanitizeServerDiagnostic(cause))
  assert.doesNotMatch(safe, /sensitive-api-key|sensitive-token|owner@example/)
  assert.match(safe, /REDACTED/)
  assert.match(safe, /CIRCULAR/)
})
