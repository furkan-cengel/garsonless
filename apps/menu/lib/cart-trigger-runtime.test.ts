import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const trigger = readFileSync(new URL('../app/[slug]/components/FloatingCartTrigger.tsx', import.meta.url), 'utf8')
const page = readFileSync(new URL('../app/[slug]/MenuPageClient.tsx', import.meta.url), 'utf8')

test('public and preview use one cart trigger renderer', () => {
  assert.match(page, /LazyFloatingCartTrigger/)
  assert.doesNotMatch(page, /LegacyFloatingCartTrigger/)
  assert.match(trigger, /items\?: CartItem\[\]/)
})

test('product preview obeys item-count visibility and footer triggers respect safe areas', () => {
  assert.match(trigger, /showItemCount && <span[^>]*>\{count\} ürün/)
  assert.match(trigger, /env\(safe-area-inset-bottom\)/)
  assert.match(trigger, /resolveReadableMenuForeground/)
  assert.doesNotMatch(trigger, /color: '#fff'/)
})

test('FAB and product preview do not consume the button label', () => {
  const fab = trigger.slice(trigger.indexOf("if (style === 'fab')"), trigger.indexOf("if (style === 'thumbs')"))
  const thumbs = trigger.slice(trigger.indexOf("if (style === 'thumbs')"), trigger.indexOf("if (style === 'bar')"))
  assert.doesNotMatch(fab, /cartButtonText/)
  assert.doesNotMatch(thumbs, /cartButtonText/)
})
