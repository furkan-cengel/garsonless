import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyReviewInvalidatingPatch,
  calculateMarginPercent,
  getDietaryClaimsConflict,
  normalizeAllergenCodes,
  normalizeMenuNumericText,
  parseBundlePrice,
  allocateBundlePrice,
  parseMenuNumericInput,
  resolveSectionPromotionPrice,
  resolveSectionCampaignTiming,
  resolveComboRibbonSelection,
  separateAllergenDeclarations,
  toggleAllergenDeclaration,
} from './menu'

test('normalizes only supported allergen codes', () => {
  assert.deepEqual(normalizeAllergenCodes(['milk', 'invalid', 'milk', 'eggs']), ['milk', 'eggs'])
})

test('parses and allocates merchant bundle prices without losing cents', () => {
  assert.equal(parseBundlePrice('₺ 200,50'), 200.5)
  assert.equal(parseBundlePrice('₺1.999.999,99'), 1_999_999.99)
  assert.equal(parseBundlePrice(''), null)
  assert.equal(parseBundlePrice('-1'), null)
  const allocated = allocateBundlePrice([100, 200, 300], 199.99)
  assert.equal(Math.round(allocated.reduce((sum, price) => sum + price, 0) * 100), 19999)
  assert.deepEqual(allocateBundlePrice([0, 0, 0], 1), [0.34, 0.33, 0.33])
})

test('combo selection is the shared four-product and versioned price contract', () => {
  const products = [1, 2, 3, 4].map((index) => ({ id: String(index), price: 100, position: index, isAvailable: true }))
  const resolved = resolveComboRibbonSelection({
    editorialVersion: '2', selectionMode: 'manual', comboCount: '1', itemsPerCombo: '4',
    combo1Item1Id: '1', combo1Item2Id: '2', combo1Item3Id: '3', combo1Item4Id: '4', combo1Price: '300',
  }, products)
  assert.deepEqual(resolved.groups[0]?.itemIds, ['1', '2', '3', '4'])
  assert.equal(resolved.groups[0]?.savings, 100)

  const invalid = resolveComboRibbonSelection({ editorialVersion: '2', comboCount: '1', combo1Price: '400' }, products.slice(0, 2))
  assert.deepEqual(invalid.groups, [])
  assert.ok(invalid.issues.some(({ code }) => code === 'invalid-campaign-price'))
})

test('resolves percentage and localized fixed-price section promotions in exact cents', () => {
  assert.deepEqual(
    resolveSectionPromotionPrice({ catalogPrice: 199.9, mode: 'percentage', percentage: '25' }),
    { kind: 'percentage', percentage: 25, price: 149.93, savings: 49.97 },
  )
  assert.deepEqual(
    resolveSectionPromotionPrice({ catalogPrice: 200, mode: 'fixed-price', fixedPrice: '129,90' }),
    { kind: 'fixed-price', percentage: 35, price: 129.9, savings: 70.1 },
  )
})

test('resolves a real two-for-one pair without overcharging odd kuruş prices', () => {
  assert.deepEqual(
    resolveSectionPromotionPrice({ catalogPrice: 185, mode: 'buy-2-pay-1' }),
    {
      kind: 'buy-2-pay-1',
      percentage: 50,
      price: 92.5,
      savings: 92.5,
      quantity: 2,
      originalTotal: 370,
      totalPrice: 185,
    },
  )
  assert.deepEqual(
    resolveSectionPromotionPrice({ catalogPrice: 10.01, mode: 'buy-2-pay-1' }),
    {
      kind: 'buy-2-pay-1',
      percentage: 50,
      price: 5,
      savings: 5.01,
      quantity: 2,
      originalTotal: 20.02,
      totalPrice: 10,
    },
  )
})

test('campaign timing uses one absolute deadline and fails closed when malformed', () => {
  const now = Date.parse('2026-07-25T12:00:00.000Z')
  assert.deepEqual(resolveSectionCampaignTiming({ enabled: false, endsAt: '', now }), {
    enabled: false, active: true, endsAtMs: null, remainingMs: null, valid: true,
  })
  assert.deepEqual(resolveSectionCampaignTiming({ enabled: true, endsAt: 'invalid', now }), {
    enabled: true, active: false, endsAtMs: null, remainingMs: 0, valid: false,
  })
  assert.deepEqual(resolveSectionCampaignTiming({ enabled: 'true', endsAt: '2026-07-25T13:00:00.000Z', now }), {
    enabled: true,
    active: true,
    endsAtMs: Date.parse('2026-07-25T13:00:00.000Z'),
    remainingMs: 3_600_000,
    valid: true,
  })
  assert.equal(resolveSectionCampaignTiming({ enabled: true, endsAt: '2026-07-25T11:00:00.000Z', now }).active, false)
})

test('fails closed for malformed, zero or non-discounted section promotions', () => {
  assert.equal(resolveSectionPromotionPrice({ catalogPrice: 200, mode: 'percentage', percentage: 0 }), null)
  assert.equal(resolveSectionPromotionPrice({ catalogPrice: 200, mode: 'percentage', percentage: 91 }), null)
  assert.equal(resolveSectionPromotionPrice({ catalogPrice: 200, mode: 'fixed-price', fixedPrice: '200' }), null)
  assert.equal(resolveSectionPromotionPrice({ catalogPrice: 200, mode: 'fixed-price', fixedPrice: 'abc' }), null)
})

test('rejects contradictory dietary claims', () => {
  assert.equal(getDietaryClaimsConflict({
    vegetarian: false,
    vegan: true,
    halal: false,
    containsAlcohol: false,
    containsPork: false,
  }), 'Vegan olarak işaretlenen ürün vejetaryen de olmalıdır')
  assert.equal(getDietaryClaimsConflict({
    vegetarian: true,
    vegan: false,
    halal: true,
    containsAlcohol: true,
    containsPork: false,
  }), 'Helal olarak işaretlenen ürün alkol veya domuz kaynaklı bileşen içeremez')
})

test('parses localized numeric input without accepting malformed values', () => {
  assert.deepEqual(parseMenuNumericInput('12,5', { min: 0 }), { ok: true, value: 12.5 })
  assert.equal(parseMenuNumericInput('1.2.3', { min: 0 }).ok, false)
  assert.equal(parseMenuNumericInput('-1', { min: 0 }).ok, false)
  assert.equal(normalizeMenuNumericText('12,5 TL'), '12.5')
})

test('keeps contains and trace allergen declarations mutually exclusive', () => {
  assert.deepEqual(
    separateAllergenDeclarations(['milk', 'eggs'], ['milk', 'sesame']),
    { contains: ['milk', 'eggs'], traces: ['sesame'] },
  )
  assert.deepEqual(
    toggleAllergenDeclaration([], ['milk'], 'milk', 'contains'),
    { contains: ['milk'], traces: [] },
  )
})

test('invalidates review on policy-relevant patches and calculates margin', () => {
  assert.deepEqual(
    applyReviewInvalidatingPatch({ reviewed: true, energyKcal: '300' }, { energyKcal: '320' }),
    { reviewed: false, energyKcal: '320' },
  )
  assert.equal(calculateMarginPercent(100, 40), 60)
  assert.equal(calculateMarginPercent(0, 40), null)
})
