import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const customersClient = readFileSync(new URL('./CustomersClient.tsx', import.meta.url), 'utf8')
const dialog = readFileSync(new URL('../ui/dialog.tsx', import.meta.url), 'utf8')

test('segment editor uses the shadcn modal accessibility contract', () => {
  assert.match(customersClient, /<Dialog open onOpenChange=/)
  assert.match(customersClient, /showCloseButton=\{!saving\}/)
  assert.match(customersClient, /<DialogTitle id="customer-segment-editor-title"/)
  assert.match(customersClient, /<DialogDescription id="customer-segment-editor-description"/)
  assert.match(customersClient, /<Alert variant="destructive"/)
  assert.match(customersClient, /<Checkbox checked=\{active\}/)
  assert.match(dialog, /DialogPrimitive\.Root/)
  assert.match(dialog, /DialogPrimitive\.Backdrop/)
  assert.match(dialog, /DialogPrimitive\.Popup/)
  assert.match(dialog, /DialogPrimitive\.Close/)
})
