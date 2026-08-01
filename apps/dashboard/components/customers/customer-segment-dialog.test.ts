import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const customersClient = readFileSync(new URL('./CustomersClient.tsx', import.meta.url), 'utf8')
const accessibleDialog = readFileSync(new URL('../tables/AccessibleDialog.tsx', import.meta.url), 'utf8')

test('segment editor uses the shared modal accessibility contract', () => {
  assert.match(customersClient, /<AccessibleDialog[\s\S]*labelledBy="customer-segment-editor-title"/)
  assert.match(customersClient, /describedBy="customer-segment-editor-description"/)
  assert.match(customersClient, /closeDisabled=\{saving\}/)
  assert.match(customersClient, /id="customer-segment-editor-title"/)
  assert.match(customersClient, /role="alert"/)
  assert.match(accessibleDialog, /event\.key === 'Escape'/)
  assert.match(accessibleDialog, /event\.key !== 'Tab'/)
  assert.match(accessibleDialog, /document\.body\.style\.overflow = 'hidden'/)
  assert.match(accessibleDialog, /sibling\.inert = true/)
  assert.match(accessibleDialog, /previousFocus.*focus\(\)/)
})
