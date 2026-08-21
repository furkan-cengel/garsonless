import assert from 'node:assert/strict'
import test from 'node:test'

import type { SectionSettingField } from './theme-editor-properties-model'
import {
  getChefPickSettingIssues,
  getComboRibbonSettingIssues,
  getThemeComboRibbonIssues,
  getSectionSettingLabel,
  getSectionSettingLayout,
  getPromoSliderSettingIssues,
  getVisibleSectionSettingFields,
  groupSectionSettingFields,
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

test('section setting headings create semantic groups and keep a headingless first group', () => {
  const groups = groupSectionSettingFields([
    field('sourceMode', 'select'),
    { ...field('campaignHeading', 'heading'), label: 'Kampanya' },
    field('productId', 'product-select'),
    { ...field('emptyHeading', 'heading'), label: 'Boş grup' },
    { ...field('copyHeading', 'heading'), label: 'Metin' },
    field('title'),
    field('description', 'textarea'),
  ])

  assert.deepEqual(groups.map((group) => ({ id: group.id, title: group.title, keys: group.fields.map((item) => item.key) })), [
    { id: 'general', title: null, keys: ['sourceMode'] },
    { id: 'campaignHeading', title: 'Kampanya', keys: ['productId'] },
    { id: 'copyHeading', title: 'Metin', keys: ['title', 'description'] },
  ])
})

test('section setting headings preserve optional explanatory copy', () => {
  const groups = groupSectionSettingFields([
    { ...field('campaignHeading', 'heading'), label: 'Kampanya akışı', description: 'Aktif kampanyalar otomatik eklenir.' },
    field('campaigns', 'campaign-multi-select'),
  ])

  assert.equal(groups[0]?.description, 'Aktif kampanyalar otomatik eklenir.')
})

test('section setting controls use predictable compact layouts by field type', () => {
  assert.equal(getSectionSettingLayout(field('title')), 'inline')
  assert.equal(getSectionSettingLayout(field('mode', 'select')), 'inline')
  assert.equal(getSectionSettingLayout(field('enabled', 'toggle')), 'toggle')
  assert.equal(getSectionSettingLayout(field('opacity', 'range')), 'range')
  assert.equal(getSectionSettingLayout(field('description', 'textarea')), 'stacked')
  assert.equal(getSectionSettingLayout(field('productId', 'product-select')), 'stacked')
  assert.equal(getSectionSettingLayout(field('couponId', 'coupon-select')), 'stacked')
  assert.equal(getSectionSettingLayout(field('palette', 'color')), 'stacked')
  assert.equal(getSectionSettingLayout(field('layout', 'icon-grid')), 'stacked')
})

test('link targets reveal only the URL while category targets reveal the selector', () => {
  const fields = [field('targetType', 'select'), field('targetId', 'select'), field('targetUrl', 'url')]
  assert.deepEqual(getVisibleSectionSettingFields(fields, { targetType: 'link' }).map((item) => item.key), ['targetType', 'targetUrl'])
  assert.deepEqual(getVisibleSectionSettingFields(fields, { targetType: 'category' }).map((item) => item.key), ['targetType', 'targetId'])
})

test('promo cards are independent from the legacy source mode and disabled details stay hidden', () => {
  const fields = [field('couponHeading', 'heading'), field('couponEnabled', 'toggle'), field('couponBody'), field('loyaltyEnabled', 'toggle'), field('loyaltyBody')]
  assert.equal(resolveSectionSettingValue(fields[1]!, {}, true), 'false')
  assert.equal(resolveSectionSettingValue(fields[1]!, { sourceMode: 'manual' }, true), 'true')
  assert.equal(resolveSectionSettingValue(fields[3]!, {}, true), 'false')
  assert.deepEqual(getVisibleSectionSettingFields(fields, { sourceMode: 'manual' }).map((item) => item.key), ['couponHeading', 'couponEnabled', 'couponBody', 'loyaltyEnabled'])
  assert.ok(getVisibleSectionSettingFields(fields, { sourceMode: 'manual', loyaltyEnabled: 'true' }).some((item) => item.key === 'loyaltyBody'))
  assert.deepEqual(getVisibleSectionSettingFields(fields, { sourceMode: 'active' }).map((item) => item.key), ['couponHeading', 'couponEnabled', 'loyaltyEnabled'])
  assert.deepEqual(getVisibleSectionSettingFields(fields, { sourceMode: 'active', couponEnabled: 'true' }).map((item) => item.key), ['couponHeading', 'couponEnabled', 'couponBody', 'loyaltyEnabled'])
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

test('Flash 2 al 1 öde reveals eligible product slots instead of display-only targets', () => {
  const fields = [
    field('couponHeading', 'heading'),
    field('flashEnabled', 'toggle'),
    field('flashOfferType', 'select'),
    field('flashItem1Id', 'product-select'),
    field('flashItem2Id', 'product-select'),
    field('flashDiscountPolicy', 'select'),
    field('flashTargetType', 'select'),
    field('flashCategoryId', 'category-select'),
    field('flashCtaText'),
  ]
  assert.deepEqual(getVisibleSectionSettingFields(fields, {
    sourceMode: 'manual', flashEnabled: 'true', flashOfferType: 'buy-2-pay-1', flashTargetType: 'category',
  }).map((item) => item.key), [
    'couponHeading', 'flashEnabled', 'flashOfferType', 'flashItem1Id', 'flashItem2Id', 'flashDiscountPolicy',
  ])
})

test('promo validation blocks invalid countdowns', () => {
  const now = Date.parse('2026-08-17T12:00:00.000Z')
  assert.deepEqual(getPromoSliderSettingIssues({
    sourceMode: 'manual',
    flashEnabled: 'true',
    flashCountdownEnabled: 'true',
    flashCampaignEndsAt: '2026-08-17T11:00:00.000Z',
  }, now), [
    'Flash sayaç için gelecekte geçerli bir bitiş tarihi seçin.',
  ])
  assert.deepEqual(getPromoSliderSettingIssues({
    sourceMode: 'manual',
    flashEnabled: 'true',
    flashCountdownEnabled: 'true',
    flashCampaignEndsAt: '2026-08-17T13:00:00.000Z',
  }, now), [])
})

test('promo validation requires distinct live selections for a Flash pair campaign', () => {
  assert.deepEqual(getPromoSliderSettingIssues({
    sourceMode: 'manual',
    flashEnabled: 'true',
    flashOfferType: 'buy-2-pay-1',
    flashItem1Id: 'cake',
    flashItem2Id: 'cake',
  }), ['Flash 2 al 1 öde ürünleri birbirinden farklı olmalıdır.'])
  assert.deepEqual(getPromoSliderSettingIssues({
    sourceMode: 'manual',
    flashEnabled: 'true',
    flashOfferType: 'buy-2-pay-1',
  }), ['Flash 2 al 1 öde kampanyası için en az bir ürün seçin.'])
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

test('Video Hero keşfet yönlendirmesi kapalıyken metin ve animasyon ayarlarını gizler', () => {
  const fields = [
    field('showExplore', 'toggle'),
    field('exploreLabel'),
    field('animateExplore', 'toggle'),
  ]
  assert.deepEqual(
    getVisibleSectionSettingFields(fields, { showExplore: 'false' }).map((item) => item.key),
    ['showExplore'],
  )
  assert.deepEqual(
    getVisibleSectionSettingFields(fields, { showExplore: 'true' }).map((item) => item.key),
    ['showExplore', 'exploreLabel', 'animateExplore'],
  )
})

test('promo strip controls reveal only copy and motion settings that can affect the render', () => {
  const fields = [
    field('showTitle', 'toggle'),
    field('title'),
    field('animation', 'select'),
    field('speed', 'range'),
    field('direction', 'select'),
    field('pauseOnHover', 'toggle'),
  ]
  assert.deepEqual(
    getVisibleSectionSettingFields(fields, {
      showTitle: 'false',
      animation: 'static',
    }).map((item) => item.key),
    ['showTitle', 'animation'],
  )
  assert.deepEqual(
    getVisibleSectionSettingFields(fields, { animation: 'fade' }).map((item) => item.key),
    ['showTitle', 'title', 'animation', 'speed'],
  )
  assert.deepEqual(
    getVisibleSectionSettingFields(fields, { animation: 'marquee' }).map((item) => item.key),
    ['showTitle', 'title', 'animation', 'speed', 'direction', 'pauseOnHover'],
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
  const fields = [field('showImages', 'toggle'), field('imageShape', 'select'), field('imageFit', 'select'), field('imagePosition', 'select'), field('imageSize', 'range')]
  assert.deepEqual(
    getVisibleSectionSettingFields(fields, { showImages: 'false' }).map((item) => item.key),
    ['showImages'],
  )
})

test('chef note copy is visible only when its toggle is enabled', () => {
  const fields = [field('showQuote', 'toggle'), field('quote')]
  assert.deepEqual(getVisibleSectionSettingFields(fields, { showQuote: 'false' }).map((item) => item.key), ['showQuote'])
  assert.deepEqual(getVisibleSectionSettingFields(fields, { showQuote: 'true' }).map((item) => item.key), ['showQuote', 'quote'])
})

test('chef pick editor diagnoses duplicate, passive, missing and incomplete manual selections', () => {
  const issues = getChefPickSettingIssues({
    selectionMode: 'manual',
    itemCount: '4',
    item1Id: 'one',
    item2Id: 'one',
    item3Id: 'hidden',
    item4Id: 'removed',
  }, [
    { id: 'one', name: 'Latte', categoryId: 'drinks', categoryName: 'İçecekler', isAvailable: true },
    { id: 'hidden', name: 'Filtre Kahve', categoryId: 'drinks', categoryName: 'İçecekler', isAvailable: false },
  ])

  assert.equal(issues.length, 4)
  assert.match(issues[0] ?? '', /tekrarlıyor/)
  assert.match(issues[1] ?? '', /pasif/)
  assert.match(issues[2] ?? '', /bulunmuyor/)
  assert.match(issues[3] ?? '', /1 geçerli ürün/)
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
    field('combo1Item4Id', 'product-select'),
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
  assert.deepEqual(
    getVisibleSectionSettingFields(fields, { selectionMode: 'manual', comboCount: '1', itemsPerCombo: '4' }).map((item) => item.key),
    ['selectionMode', 'comboCount', 'itemsPerCombo', 'combo1Heading', 'combo1Title', 'combo1Item1Id', 'combo1Item2Id', 'combo1Item3Id', 'combo1Item4Id'],
  )
})

test('combo editor diagnoses duplicate, passive, removed and invalid-price products', () => {
  const issues = getComboRibbonSettingIssues({
    editorialVersion: '2', selectionMode: 'manual', comboCount: '1', itemsPerCombo: '4',
    combo1Item1Id: 'one', combo1Item2Id: 'one', combo1Item3Id: 'hidden', combo1Item4Id: 'removed', combo1Price: '500',
  }, [
    { id: 'one', name: 'Latte', categoryId: 'drinks', categoryName: 'İçecekler', price: 100, isAvailable: true },
    { id: 'hidden', name: 'Filtre Kahve', categoryId: 'drinks', categoryName: 'İçecekler', price: 100, isAvailable: false },
  ])
  assert.ok(issues.some((issue) => issue.includes('tekrarlıyor')))
  assert.ok(issues.some((issue) => issue.includes('pasif')))
  assert.ok(issues.some((issue) => issue.includes('bulunmuyor')))
  assert.ok(issues.some((issue) => issue.includes('1 geçerli ürün')))

  const priceIssues = getComboRibbonSettingIssues({
    editorialVersion: '2', selectionMode: 'manual', comboCount: '1', itemsPerCombo: '2',
    combo1Item1Id: 'one', combo1Item2Id: 'two', combo1Price: '200',
  }, [
    { id: 'one', name: 'Bir', categoryId: 'food', categoryName: 'Yemek', price: 100, isAvailable: true },
    { id: 'two', name: 'İki', categoryId: 'food', categoryName: 'Yemek', price: 100, isAvailable: true },
  ])
  assert.deepEqual(priceIssues, ['Kombo 1 kampanya fiyatı normal toplamdan düşük olmalıdır.'])
})

test('theme publishing validates only modern combo instances against live menu references', () => {
  const items = [
    { id: 'one', name: 'Bir', categoryId: 'food', categoryName: 'Yemek', price: 100, isAvailable: true },
    { id: 'two', name: 'İki', categoryId: 'food', categoryName: 'Yemek', price: 100, isAvailable: true },
  ]
  const modern = {
    pageBlocks: [{ type: 'section', id: 'combo-instance', sectionId: 'combo-ribbon' }],
    sectionSettings: {
      'combo-instance': {
        editorialVersion: '2', selectionMode: 'manual', comboCount: '1', itemsPerCombo: '2',
        combo1Item1Id: 'one', combo1Item2Id: 'two', combo1Price: '200',
      },
    },
  } as never
  assert.match(getThemeComboRibbonIssues(modern, items)[0] ?? '', /normal toplamdan düşük/)
  const legacy = structuredClone(modern) as { sectionSettings: Record<string, Record<string, string>> }
  delete legacy.sectionSettings['combo-instance']!.editorialVersion
  assert.deepEqual(getThemeComboRibbonIssues(legacy as never, items), [])
})

test('gallery reveals labels, grid columns and external link fields only when relevant', () => {
  const fields = [
    field('showLabels', 'toggle'),
    field('labelsHeading', 'heading'),
    field('tile1Label'),
    field('layout', 'select'),
    field('mosaicPattern', 'select'),
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
    ['showLabels', 'layout', 'mosaicPattern', 'maxItems', 'targetType'],
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
