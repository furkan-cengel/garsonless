import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  FOOD_ICON_OPTIONS,
  SECTION_GROUPS,
  SECTION_LIBRARY,
  SECTION_LIBRARY_IDS,
  SECTION_SETTING_SCHEMA,
} from './theme-editor-section-registry'

test('section registry keeps unique ids and valid group references', () => {
  assert.equal(new Set(SECTION_LIBRARY_IDS).size, SECTION_LIBRARY_IDS.length)

  const validGroups = new Set<string>(SECTION_GROUPS.filter((group) => group !== 'Tümü'))
  for (const section of SECTION_LIBRARY) {
    assert.ok(validGroups.has(section.group), `${section.id} uses unknown group ${section.group}`)
    assert.ok(section.label.trim().length > 0, `${section.id} has no label`)
    assert.ok(section.sub.trim().length > 0, `${section.id} has no description`)
  }
})

test('section catalog pairs hours with gallery and request buttons with wifi', () => {
  const sectionIds = SECTION_LIBRARY.map((section) => section.id)

  assert.deepEqual(sectionIds.slice(8, 14), [
    'gallery',
    'hours',
    'allergens',
    'reviews',
    'request-buttons',
    'wifi-info',
  ])
})

test('section setting schemas keep unique keys and valid editor tabs', () => {
  const validTabs = new Set(['design', 'layout', 'content'])

  for (const [sectionId, fields] of Object.entries(SECTION_SETTING_SCHEMA)) {
    const keys = fields.map((field) => field.key)
    assert.equal(new Set(keys).size, keys.length, `${sectionId} has duplicate setting keys`)
    for (const field of fields) {
      assert.ok(validTabs.has(field.editorTab), `${sectionId}.${field.key} uses an invalid editor tab`)
      assert.ok(field.label.trim().length > 0, `${sectionId}.${field.key} has no label`)
      if (field.type === 'range' && typeof field.default === 'number') {
        assert.ok(field.min === undefined || field.default >= field.min, `${sectionId}.${field.key} default is below min`)
        assert.ok(field.max === undefined || field.default <= field.max, `${sectionId}.${field.key} default is above max`)
      }
    }
  }
})

test('request buttons are a customizable global singleton gated by the pro plan', () => {
  const section = SECTION_LIBRARY.find((entry) => entry.id === 'request-buttons')
  const fields = new Map(SECTION_SETTING_SCHEMA['request-buttons']!.map((field) => [field.key, field]))

  assert.equal(section?.plan, 'pro')
  assert.equal(section?.status, 'ready')
  assert.equal(section?.singleton, true)
  assert.equal(section?.global, true)
  assert.equal(fields.get('position')?.default, 'right')
  assert.deepEqual(fields.get('position')?.options?.map((option) => option.value), ['left', 'right'])
  assert.equal(fields.get('size')?.default, 'normal')
  assert.equal(fields.get('bottomOffset')?.type, 'range')
  assert.equal(fields.get('waiterEnabled')?.default, true)
  assert.equal(fields.get('waiterLabel')?.placeholder, 'Garsonu çağır')
  assert.equal(fields.get('waiterIcon')?.default, 'bell')
  assert.deepEqual(fields.get('cleanTableIcon')?.options?.map((option) => option.value), [
    'bell',
    'spray',
    'cigarette',
    'hand-platter',
    'glass-water',
    'receipt',
    'custom',
    'none',
  ])
  assert.equal(fields.get('cleanTableIcon')?.default, 'spray')
  assert.equal(fields.get('waterIcon')?.default, 'glass-water')
  assert.equal(fields.get('billEnabled')?.default, true)
  assert.equal(fields.get('billLabel')?.placeholder, 'Hesap istiyorum')
  assert.equal(fields.get('billIcon')?.default, 'receipt')
})

test('hero editor defaults match the canonical renderer contract', () => {
  const fields = new Map(SECTION_SETTING_SCHEMA['hero-banner']!.map((field) => [field.key, field]))
  assert.equal(fields.get('overlay')?.default, 25)
  assert.equal(fields.get('height')?.default, 168)
  assert.equal(fields.get('padding')?.default, 18)
  assert.equal(fields.get('radius')?.default, 16)
  assert.equal(fields.get('imageFit')?.default, 'cover')
  assert.equal(fields.get('imagePosition')?.default, 'center')
  assert.equal(fields.get('showTitle')?.default, true)
})

test('hero image is managed only by the upload panel', () => {
  const keys = SECTION_SETTING_SCHEMA['hero-banner']!.map((field) => field.key)

  assert.equal(keys.includes('imageUrl'), false)
})

test('promo strip defaults describe the canonical motion contract', () => {
  const fields = new Map(SECTION_SETTING_SCHEMA['promo-strip']!.map((field) => [field.key, field]))
  assert.equal(fields.get('showTitle')?.default, true)
  assert.equal(fields.get('showRepeatText')?.default, true)
  assert.equal(fields.get('targetType')?.default, 'none')
  assert.equal(fields.get('height')?.default, 40)
  assert.equal(fields.get('animation')?.default, 'marquee')
  assert.equal(fields.get('speed')?.default, 18)
  assert.equal(fields.get('pauseOnHover')?.default, true)
})

test('featured products are always derived from daily order performance', () => {
  const fields = new Map(SECTION_SETTING_SCHEMA['featured-scroll']!.map((field) => [field.key, field]))

  assert.equal(fields.has('selectionMode'), false)
  assert.equal(fields.has('item1Id'), false)
  assert.equal(fields.has('item8Id'), false)
  assert.equal(fields.get('itemCount')?.default, '4')
  assert.match(fields.get('productHeading')?.label ?? '', /bugün satış yoksa dün/i)
})

test('chef pick editor is backed by real menu products and backward-compatible defaults', () => {
  const fields = new Map(SECTION_SETTING_SCHEMA['chef-pick']!.map((field) => [field.key, field]))

  assert.equal(fields.get('selectionMode')?.default, 'automatic')
  assert.equal(fields.get('itemCount')?.default, '3')
  assert.equal(fields.get('showImages')?.default, true)
  assert.equal(fields.get('chefIcon')?.type, 'icon-grid')
  assert.equal(fields.get('chefIcon')?.default, 'catal-kasik')
  assert.equal(fields.get('chefIcon')?.options?.length, 17)
  assert.equal(fields.get('chefIconSize')?.default, 'medium')
  assert.equal(fields.get('ctaMode')?.default, 'inherit')
  assert.equal(fields.get('buttonIcon')?.type, 'icon-grid')
  assert.equal(fields.get('buttonSize')?.default, 'medium')
  assert.equal(fields.get('item1Id')?.type, 'product-select')
  assert.equal(fields.get('item4Id')?.type, 'product-select')
  assert.equal(fields.has('dish1Name'), false)
  assert.equal(fields.has('dish1Price'), false)
})

test('combo ribbon editor uses real products and exposes server-verified bundle prices', () => {
  const fields = new Map(SECTION_SETTING_SCHEMA['combo-ribbon']!.map((field) => [field.key, field]))

  assert.equal(fields.get('selectionMode')?.default, 'automatic')
  assert.equal(fields.get('comboCount')?.default, '2')
  assert.equal(fields.get('itemsPerCombo')?.default, '2')
  assert.equal(fields.get('combo1Item1Id')?.type, 'product-select')
  assert.equal(fields.get('combo3Item3Id')?.type, 'product-select')
  assert.equal(fields.get('ctaMode')?.default, 'inherit')
  assert.equal(fields.get('combo1Price')?.type, 'text')
  assert.equal(fields.get('combo1DiscountPolicy')?.label, 'İndirim Birleşimi')
  assert.equal(fields.get('combo1DiscountPolicy')?.default, 'stack')
  assert.deepEqual(fields.get('combo2DiscountPolicy')?.options?.map((option) => option.value), ['stack', 'combo-only'])
  assert.equal(fields.get('combo3DiscountPolicy')?.type, 'select')
  assert.equal(fields.has('combo1OldPrice'), false)
  assert.equal(fields.has('combo1ImageUrl'), false)
})

test('discount badge editor uses a real product and an explicit stacking policy', () => {
  const fields = new Map(SECTION_SETTING_SCHEMA['discount-badge']!.map((field) => [field.key, field]))

  assert.equal(fields.get('productId')?.type, 'product-select')
  assert.equal(fields.get('discountMode')?.default, 'percentage')
  assert.equal(fields.get('discountPercent')?.default, 20)
  assert.equal(fields.get('campaignPrice')?.type, 'text')
  assert.equal(fields.get('discountPolicy')?.default, 'combine-loyalty')
  assert.deepEqual(
    fields.get('discountMode')?.options?.map((option) => option.value),
    ['percentage', 'fixed-price', 'buy-2-pay-1'],
  )
  assert.deepEqual(
    fields.get('discountPolicy')?.options?.map((option) => option.value),
    ['combine-loyalty', 'promotion-only'],
  )
  assert.equal(fields.get('ctaMode')?.default, 'inherit')
  assert.equal(fields.get('countdownEnabled')?.default, false)
  assert.equal(fields.get('campaignEndsAt')?.type, 'datetime')
  assert.equal(fields.has('targetProductId'), false)
  assert.equal(fields.has('targetCategoryId'), false)
})

test('daily special uses a real product, optional server-verified price and absolute expiry', () => {
  const fields = new Map(SECTION_SETTING_SCHEMA['daily-special']!.map((field) => [field.key, field]))

  assert.equal(fields.get('productId')?.type, 'product-select')
  assert.equal(fields.get('discountMode')?.default, 'none')
  assert.deepEqual(
    fields.get('discountMode')?.options?.map((option) => option.value),
    ['none', 'percentage', 'fixed-price'],
  )
  assert.equal(fields.get('discountPolicy')?.default, 'combine-loyalty')
  assert.equal(fields.get('countdownEnabled')?.default, false)
  assert.equal(fields.get('campaignEndsAt')?.type, 'datetime')
  assert.equal(fields.get('ctaMode')?.default, 'inherit')
  assert.equal(fields.has('timer'), false)
  assert.equal(fields.has('price'), false)
  assert.equal(fields.has('oldPrice'), false)
  assert.equal(fields.has('imageUrl'), false)
})

test('food icon options are unique and safe for select rendering', () => {
  const values = FOOD_ICON_OPTIONS.map((option) => option.value)
  assert.equal(new Set(values).size, values.length)
  assert.ok(FOOD_ICON_OPTIONS.every((option) => option.value.length > 0 && option.label.trim().length > 0))
})
