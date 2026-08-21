import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('../app/[slug]/MenuPageClient.tsx', import.meta.url), 'utf8')

test('promotion modal sends its visible package quantity without a hidden multiplier', () => {
  assert.match(source, /quantityStep=\{pendingPromotion\?\.promotion\.quantityStep \?\? 1\}/)
  assert.match(source, /promotionLabel=\{pendingPromotion\?\.promotion\.quantityStep === 2 \? '2 al 1 öde'/)
  assert.match(source, /item\.modifier_groups,\s*quantity,\s*pendingPromotion\.originalPrice/)
  assert.doesNotMatch(source, /quantity \* \(pendingPromotion\.promotion\.quantityStep/)
})
