import assert from 'node:assert/strict'
import test from 'node:test'

import type { SectionSettingField } from './theme-editor-properties-model'
import {
  getSectionSettingLabel,
  getVisibleSectionSettingFields,
  groupMenuItems,
  resolveSectionSettingValue,
  sectionSettingControlId,
  togglePromoSliderCampaignSelection,
} from './theme-section-settings-model'

const field = (key: string, type: SectionSettingField['type'] = 'text'): SectionSettingField => ({
  key,
  label: key,
  type,
  editorTab: 'content',
})

test('link targets reveal only the URL while category targets reveal the selector', () => {
  const fields = [field('targetType', 'select'), field('targetId', 'select'), field('targetUrl', 'url')]
  assert.deepEqual(getVisibleSectionSettingFields(fields, { targetType: 'link' }).map((item) => item.key), ['targetType', 'targetUrl'])
  assert.deepEqual(getVisibleSectionSettingFields(fields, { targetType: 'category' }).map((item) => item.key), ['targetType', 'targetId'])
})

test('promo slide defaults are projected and disabled slide details stay hidden', () => {
  const fields = [field('couponHeading', 'heading'), field('couponEnabled', 'toggle'), field('couponBody'), field('loyaltyEnabled', 'toggle'), field('loyaltyBody')]
  assert.equal(resolveSectionSettingValue(fields[1]!, {}, true), 'true')
  assert.equal(resolveSectionSettingValue(fields[3]!, {}, true), 'false')
  assert.deepEqual(getVisibleSectionSettingFields(fields, { sourceMode: 'manual' }).map((item) => item.key), ['couponHeading', 'couponEnabled', 'couponBody', 'loyaltyEnabled'])
  assert.ok(getVisibleSectionSettingFields(fields, { sourceMode: 'manual', loyaltyEnabled: 'true' }).some((item) => item.key === 'loyaltyBody'))
  assert.deepEqual(getVisibleSectionSettingFields(fields, { sourceMode: 'active' }), [])
})

test('promo campaign selection removes one card from the implicit all state without inverting the choice', () => {
  const activeIds = ['daily', 'discount', 'combo']
  assert.equal(
    togglePromoSliderCampaignSelection('', 'daily', activeIds),
    'discount,combo',
  )
  assert.equal(
    togglePromoSliderCampaignSelection('discount,combo', 'daily', activeIds),
    'discount,combo,daily',
  )
  assert.equal(
    togglePromoSliderCampaignSelection('discount', 'discount', activeIds),
    'discount',
  )
})

test('manual promo countdown details appear only when automatic retirement is enabled', () => {
  const fields = [
    field('couponHeading', 'heading'),
    field('flashEnabled', 'toggle'),
    field('flashCountdownEnabled', 'toggle'),
    field('flashCampaignEndsAt', 'datetime'),
    field('flashCountdownLabel'),
  ]
  assert.deepEqual(
    getVisibleSectionSettingFields(fields, {
      sourceMode: 'manual',
      flashEnabled: 'true',
      flashCountdownEnabled: 'false',
    }).map((item) => item.key),
    ['couponHeading', 'flashEnabled', 'flashCountdownEnabled'],
  )
  assert.deepEqual(
    getVisibleSectionSettingFields(fields, {
      sourceMode: 'manual',
      flashEnabled: 'true',
      flashCountdownEnabled: 'true',
    }).map((item) => item.key),
    ['couponHeading', 'flashEnabled', 'flashCountdownEnabled', 'flashCampaignEndsAt', 'flashCountdownLabel'],
  )
})

test('explicit section defaults are visible before a setting is stored', () => {
  const range = { ...field('height', 'range'), default: 168 }
  assert.equal(resolveSectionSettingValue(range, {}), '168')
  assert.equal(resolveSectionSettingValue(range, { height: '200' }), '200')
})

test('hero yatay konumu legacy metin hizasıyla aynı başlangıç noktasını gösterir', () => {
  const position = { ...field('contentPositionX', 'range'), default: 0 }
  assert.equal(resolveSectionSettingValue(position, { align: 'left' }), '0')
  assert.equal(resolveSectionSettingValue(position, { align: 'center' }), '50')
  assert.equal(resolveSectionSettingValue(position, { align: 'right' }), '100')
  assert.equal(resolveSectionSettingValue(position, { align: 'right', contentPositionX: '35' }), '35')
})

test('hero controls hide disabled copy and irrelevant image controls', () => {
  const fields = [
    field('showTitle', 'toggle'),
    field('title'),
    field('imageMode', 'select'),
    field('imageFit', 'select'),
    field('imagePosition', 'select'),
    field('overlay', 'range'),
  ]
  assert.deepEqual(
    getVisibleSectionSettingFields(fields, { showTitle: 'false', imageMode: 'none' }).map((item) => item.key),
    ['showTitle', 'imageMode'],
  )
  assert.deepEqual(
    getVisibleSectionSettingFields(fields, { imageMode: 'side' }).map((item) => item.key),
    ['showTitle', 'title', 'imageMode', 'imageFit', 'imagePosition'],
  )
})

test('hero content toggles hide only their own editable copy field', () => {
  const fields = [
    field('showEyebrow', 'toggle'), field('eyebrow'),
    field('showTitle', 'toggle'), field('title'),
    field('showBody', 'toggle'), field('body'),
    field('showCta', 'toggle'), field('cta'),
  ]
  assert.deepEqual(
    getVisibleSectionSettingFields(fields, {
      showEyebrow: 'false', showTitle: 'true', showBody: 'false', showCta: 'false',
    }).map((item) => item.key),
    ['showEyebrow', 'showTitle', 'title', 'showBody', 'showCta'],
  )
})

test('promo strip controls reveal only copy and motion settings that can affect the render', () => {
  const fields = [
    field('showTitle', 'toggle'),
    field('title'),
    field('showRepeatText', 'toggle'),
    field('repeatText'),
    field('animation', 'select'),
    field('speed', 'range'),
    field('direction', 'select'),
    field('pauseOnHover', 'toggle'),
  ]
  assert.deepEqual(
    getVisibleSectionSettingFields(fields, {
      showTitle: 'false',
      showRepeatText: 'false',
      animation: 'static',
    }).map((item) => item.key),
    ['showTitle', 'showRepeatText', 'animation'],
  )
  assert.deepEqual(
    getVisibleSectionSettingFields(fields, { animation: 'fade' }).map((item) => item.key),
    ['showTitle', 'title', 'showRepeatText', 'repeatText', 'animation', 'speed'],
  )
  assert.deepEqual(
    getVisibleSectionSettingFields(fields, { animation: 'marquee' }).map((item) => item.key),
    ['showTitle', 'title', 'showRepeatText', 'repeatText', 'animation', 'speed', 'direction', 'pauseOnHover'],
  )
})

test('chef pick reveals manual product slots only up to the selected item count', () => {
  const fields = [
    field('selectionMode', 'select'),
    field('itemCount', 'select'),
    field('item1Id', 'product-select'),
    field('item2Id', 'product-select'),
    field('item3Id', 'product-select'),
    field('item4Id', 'product-select'),
  ]
  assert.deepEqual(
    getVisibleSectionSettingFields(fields, { selectionMode: 'automatic', itemCount: '4' }).map((item) => item.key),
    ['selectionMode', 'itemCount'],
  )
  assert.deepEqual(
    getVisibleSectionSettingFields(fields, { selectionMode: 'manual', itemCount: '2' }).map((item) => item.key),
    ['selectionMode', 'itemCount', 'item1Id', 'item2Id'],
  )
})

test('chef pick image controls stay hidden when product images are disabled', () => {
  const fields = [field('showImages', 'toggle'), field('imageShape', 'select'), field('imageSize', 'range')]
  assert.deepEqual(
    getVisibleSectionSettingFields(fields, { showImages: 'false' }).map((item) => item.key),
    ['showImages'],
  )
})

test('discount badge reveals only the active pricing model and useful image controls', () => {
  const fields = [
    field('discountMode', 'select'),
    field('discountPercent', 'range'),
    field('campaignPrice'),
    field('showImage', 'toggle'),
    field('imageShape', 'select'),
    field('imageSize', 'range'),
    field('imageFit', 'select'),
    field('imagePosition', 'select'),
  ]

  assert.deepEqual(
    getVisibleSectionSettingFields(fields, { discountMode: 'percentage' }).map((item) => item.key),
    ['discountMode', 'discountPercent', 'showImage', 'imageShape', 'imageSize', 'imageFit', 'imagePosition'],
  )
  assert.deepEqual(
    getVisibleSectionSettingFields(fields, { discountMode: 'fixed-price' }).map((item) => item.key),
    ['discountMode', 'campaignPrice', 'showImage', 'imageShape', 'imageSize', 'imageFit', 'imagePosition'],
  )
  assert.deepEqual(
    getVisibleSectionSettingFields(fields, { discountMode: 'fixed-price', showImage: 'false' }).map((item) => item.key),
    ['discountMode', 'campaignPrice', 'showImage'],
  )
  assert.deepEqual(
    getVisibleSectionSettingFields(fields, { discountMode: 'buy-2-pay-1' }).map((item) => item.key),
    ['discountMode', 'showImage', 'imageShape', 'imageSize', 'imageFit', 'imagePosition'],
  )
})

test('discount badge schedule details and timer colors only appear for timed campaigns', () => {
  const fields = [
    field('countdownEnabled', 'toggle'),
    field('campaignEndsAt', 'datetime'),
    field('countdownLabel'),
    field('timerBgColor', 'color'),
    field('timerTextColor', 'color'),
  ]

  assert.deepEqual(
    getVisibleSectionSettingFields(fields, { countdownEnabled: 'false' }).map((item) => item.key),
    ['countdownEnabled'],
  )
  assert.deepEqual(
    getVisibleSectionSettingFields(fields, { countdownEnabled: 'true' }).map((item) => item.key),
    ['countdownEnabled', 'campaignEndsAt', 'countdownLabel', 'timerBgColor', 'timerTextColor'],
  )
})

test('daily special hides inactive promotion and countdown detail controls', () => {
  const fields = [
    field('discountMode', 'select'),
    field('discountPercent', 'range'),
    field('campaignPrice'),
    field('discountPolicy', 'select'),
    field('countdownEnabled', 'toggle'),
    field('campaignEndsAt', 'datetime'),
    field('countdownLabel'),
    field('timerBgColor', 'color'),
    field('timerTextColor', 'color'),
  ]

  assert.deepEqual(
    getVisibleSectionSettingFields(fields, {
      discountMode: 'none',
      countdownEnabled: 'false',
    }).map((item) => item.key),
    ['discountMode', 'countdownEnabled'],
  )
  assert.deepEqual(
    getVisibleSectionSettingFields(fields, {
      discountMode: 'fixed-price',
      countdownEnabled: 'true',
    }).map((item) => item.key),
    ['discountMode', 'campaignPrice', 'discountPolicy', 'countdownEnabled', 'campaignEndsAt', 'countdownLabel', 'timerBgColor', 'timerTextColor'],
  )
})

test('chef pick CTA overrides stay hidden while the global card CTA is inherited', () => {
  const fields = [
    field('ctaMode', 'select'),
    field('buttonStyle', 'select'),
    field('buttonIcon', 'icon-grid'),
    field('buttonSize', 'select'),
    field('buttonBgColor', 'color'),
    field('buttonTextColor', 'color'),
  ]
  assert.deepEqual(
    getVisibleSectionSettingFields(fields, { ctaMode: 'inherit' }).map((item) => item.key),
    ['ctaMode'],
  )
  assert.deepEqual(
    getVisibleSectionSettingFields(fields, { ctaMode: 'custom' }).map((item) => item.key),
    ['ctaMode', 'buttonStyle', 'buttonIcon', 'buttonSize', 'buttonBgColor', 'buttonTextColor'],
  )
})

test('combo product selectors follow source mode, combo count and item count', () => {
  const fields = [
    field('selectionMode'),
    field('comboCount'),
    field('itemsPerCombo'),
    field('combo1Heading', 'heading'),
    field('combo1Title'),
    field('combo1Item1Id', 'product-select'),
    field('combo1Item2Id', 'product-select'),
    field('combo1Item3Id', 'product-select'),
    field('combo2Heading', 'heading'),
    field('combo2Item1Id', 'product-select'),
    field('combo3Heading', 'heading'),
  ]
  assert.deepEqual(
    getVisibleSectionSettingFields(fields, { selectionMode: 'automatic', comboCount: 'invalid' }).map((item) => item.key),
    ['selectionMode', 'comboCount', 'itemsPerCombo', 'combo1Heading', 'combo1Title', 'combo2Heading'],
  )
  assert.deepEqual(
    getVisibleSectionSettingFields(fields, { selectionMode: 'manual', comboCount: '1', itemsPerCombo: '2' }).map((item) => item.key),
    ['selectionMode', 'comboCount', 'itemsPerCombo', 'combo1Heading', 'combo1Title', 'combo1Item1Id', 'combo1Item2Id'],
  )
})

test('gallery reveals labels, grid columns and external link fields only when relevant', () => {
  const fields = [
    field('showLabels', 'toggle'),
    field('labelsHeading', 'heading'),
    field('tile1Label'),
    field('layout', 'select'),
    field('columns', 'select'),
    field('maxItems', 'select'),
    field('targetType', 'select'),
    field('linkText'),
    field('targetUrl', 'url'),
  ]

  assert.deepEqual(
    getVisibleSectionSettingFields(fields, {
      showLabels: 'false',
      layout: 'mosaic',
      targetType: 'none',
    }).map((item) => item.key),
    ['showLabels', 'layout', 'maxItems', 'targetType'],
  )
  assert.deepEqual(
    getVisibleSectionSettingFields(fields, {
      showLabels: 'true',
      layout: 'grid',
      targetType: 'link',
    }).map((item) => item.key),
    ['showLabels', 'labelsHeading', 'tile1Label', 'layout', 'columns', 'maxItems', 'targetType', 'linkText', 'targetUrl'],
  )
})

test('target labels and control ids are deterministic and accessible', () => {
  assert.equal(getSectionSettingLabel(field('targetId'), 'category'), 'Kategori')
  assert.equal(getSectionSettingLabel(field('targetId'), 'product'), 'Ürün')
  assert.equal(sectionSettingControlId('Hero CTA / URL'), 'section-field-hero-cta-url')
})

test('menu items are grouped in source order without losing category context', () => {
  assert.deepEqual(groupMenuItems([
    { id: '1', name: 'Latte', categoryId: 'c1', categoryName: 'Kahve' },
    { id: '2', name: 'Brownie', categoryId: 'c2', categoryName: 'Tatlı' },
    { id: '3', name: 'Mocha', categoryId: 'c1', categoryName: 'Kahve' },
  ]), [
    { categoryName: 'Kahve', items: [
      { id: '1', name: 'Latte', categoryId: 'c1', categoryName: 'Kahve' },
      { id: '3', name: 'Mocha', categoryId: 'c1', categoryName: 'Kahve' },
    ] },
    { categoryName: 'Tatlı', items: [
      { id: '2', name: 'Brownie', categoryId: 'c2', categoryName: 'Tatlı' },
    ] },
  ])
})
