import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createInitialSectionSettings,
  FOOD_ICON_OPTIONS,
  HOME_SECTION_LIBRARY,
  SECTION_GROUPS,
  SECTION_LIBRARY,
  SECTION_LIBRARY_IDS,
  SECTION_SETTING_SCHEMA,
} from './theme-editor-section-registry'

test('ana sayfa kataloğu menü kataloğundan yalnız üç bağlam bileşenini çıkarır ve Video Hero ekler', () => {
  assert.deepEqual(HOME_SECTION_LIBRARY.map((section) => section.id), [
    'hero-banner',
    'storefront-video-hero',
    'promo-strip',
    'featured-scroll',
    'chef-pick',
    'combo-ribbon',
    'discount-badge',
    'daily-special',
    'promo-slider',
    'gallery',
  ])
  assert.equal(HOME_SECTION_LIBRARY.find((section) => section.id === 'storefront-video-hero')?.plan, 'pro')
  assert.equal(HOME_SECTION_LIBRARY.some((section) => ['request-buttons', 'hours', 'wifi-info'].includes(section.id)), false)
  assert.equal(HOME_SECTION_LIBRARY.length, SECTION_LIBRARY.length - 3 + 1)
  assert.deepEqual(
    HOME_SECTION_LIBRARY.filter((section) => section.id !== 'storefront-video-hero').map((section) => section.id),
    SECTION_LIBRARY.filter((section) => !['request-buttons', 'hours', 'wifi-info'].includes(section.id)).map((section) => section.id),
  )
})

test('section registry keeps unique ids and valid group references', () => {
  assert.equal(new Set(SECTION_LIBRARY_IDS).size, SECTION_LIBRARY_IDS.length)

  const validGroups = new Set<string>(SECTION_GROUPS.filter((group) => group !== 'Tümü'))
  for (const section of SECTION_LIBRARY) {
    assert.ok(validGroups.has(section.group), `${section.id} uses unknown group ${section.group}`)
    assert.ok(section.label.trim().length > 0, `${section.id} has no label`)
    assert.ok(section.sub.trim().length > 0, `${section.id} has no description`)
  }
})

test("Şef'in Seçimi uses the chef hat in catalog and page flow", () => {
  assert.equal(SECTION_LIBRARY.find((section) => section.id === 'chef-pick')?.icon, 'chef-hat')
  assert.equal(HOME_SECTION_LIBRARY.find((section) => section.id === 'chef-pick')?.icon, 'chef-hat')
})

test('section catalog places request buttons before hours and omits retired placeholders', () => {
  const sectionIds = SECTION_LIBRARY.map((section) => section.id)

  assert.deepEqual(sectionIds.slice(8, 12), [
    'gallery',
    'request-buttons',
    'hours',
    'wifi-info',
  ])
  const catalogIds = new Set<string>(sectionIds)
  assert.equal(catalogIds.has('allergens'), false)
  assert.equal(catalogIds.has('reviews'), false)
  assert.equal(catalogIds.has('social-block'), false)
  assert.equal(catalogIds.has('footer'), false)
  assert.equal(sectionIds.length, 12)
  assert.equal(SECTION_GROUPS.includes('Site Sonu' as never), false)
})

test('wifi is a ready drawer section with editable guest-network fields', () => {
  const wifi = SECTION_LIBRARY.find((section) => section.id === 'wifi-info')
  assert.equal(wifi?.status, 'ready')
  assert.deepEqual(
    SECTION_SETTING_SCHEMA['wifi-info']?.map((field) => field.key),
    ['networkName', 'password', 'note'],
  )
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

test('Video Hero metin katmanlarını ayrı ayrı gizler ve güvenli yüzde konumu sunar', () => {
  const fields = new Map(SECTION_SETTING_SCHEMA['storefront-video-hero']!.map((field) => [field.key, field]))

  assert.equal(fields.get('showEyebrow')?.type, 'toggle')
  assert.equal(fields.get('showTitle')?.type, 'toggle')
  assert.equal(fields.get('showBody')?.type, 'toggle')
  assert.equal(fields.get('showExplore')?.type, 'toggle')
  assert.equal(fields.get('showExplore')?.editorTab, 'content')
  assert.equal(fields.get('exploreLabel')?.type, 'text')
  assert.equal(fields.get('exploreLabel')?.maxLength, 40)
  assert.equal(fields.get('animateExplore')?.type, 'toggle')
  assert.equal(fields.get('animateExplore')?.editorTab, 'design')
  assert.equal(fields.get('animateExplore')?.default, true)
  assert.equal(fields.has('showCta'), false)
  assert.equal(fields.has('cta'), false)
  assert.deepEqual(fields.get('align')?.options?.map((option) => option.value), ['left', 'center', 'right'])
  assert.deepEqual(
    [fields.get('contentPositionX'), fields.get('contentPositionY')].map((field) => [field?.type, field?.min, field?.max, field?.unit]),
    [['range', 0, 100, '%'], ['range', 0, 100, '%']],
  )
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
  assert.equal(fields.has('showRepeatText'), false)
  assert.equal(fields.has('repeatText'), false)
  assert.equal(fields.has('targetType'), false)
  assert.equal(fields.has('targetId'), false)
  assert.equal(fields.has('targetUrl'), false)
  assert.equal(fields.has('textColor'), false)
  assert.equal(fields.get('accentColor')?.label, 'Yazı')
  assert.equal(fields.get('height')?.default, 40)
  assert.equal(fields.get('animation')?.default, 'marquee')
  assert.equal(fields.get('speed')?.default, 18)
  assert.equal(fields.get('pauseOnHover')?.default, true)
})

test('promo slider loyalty editor configures the promotional front without fake balances', () => {
  const fields = new Map(SECTION_SETTING_SCHEMA['promo-slider']!.map((field) => [field.key, field]))

  assert.equal(fields.get('loyaltyEyebrow')?.type, 'text')
  assert.equal(fields.get('loyaltyTitle')?.label, 'Ödül Vaadi')
  assert.equal(fields.get('loyaltyAccentColor')?.label, 'Altın Vurgu')
  assert.equal(fields.has('loyaltyFilled'), false)
  assert.equal(fields.has('loyaltyTotal'), false)
  assert.equal(fields.has('loyaltyTargetType'), false)
})

test('promo slider uses one automatic campaign flow with independently enabled special cards', () => {
  const fields = new Map(SECTION_SETTING_SCHEMA['promo-slider']!.map((field) => [field.key, field]))

  assert.equal(fields.has('sourceMode'), false)
  assert.equal(fields.has('activeCampaignIds'), true)
  assert.equal(fields.get('sourceHeading')?.label, 'Kampanya akışı')
  assert.match(fields.get('sourceHeading')?.description ?? '', /otomatik eklenir/i)
  assert.equal(fields.get('flashHeading')?.label, '2 · Flash Teklif')
})

test('featured products are always derived from daily order performance', () => {
  const fields = new Map(SECTION_SETTING_SCHEMA['featured-scroll']!.map((field) => [field.key, field]))

  assert.equal(fields.get('contentHeading')?.label, 'Başlık ve metin')
  assert.equal(fields.has('showViewAll'), false)
  assert.equal(fields.has('viewAllText'), false)
  assert.equal(fields.has('targetType'), false)
  assert.equal(fields.has('targetId'), false)
  assert.equal(fields.has('targetUrl'), false)
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
  assert.equal(fields.get('imageFit')?.default, 'cover')
  assert.equal(fields.get('imagePosition')?.default, 'center')
  assert.equal(fields.get('imageSize')?.default, 88)
  assert.equal(fields.get('bgColor')?.inheritToken, 'surface')
  assert.equal(fields.get('buttonBgColor')?.inheritToken, 'cta')
  assert.equal(fields.has('layout'), false)
  assert.equal(fields.has('ctaText'), false)
  assert.equal(fields.has('productCopyHeading'), false)
  assert.equal(fields.has('showProductDescription'), false)
  assert.equal(fields.has('dish1Name'), false)
  assert.equal(fields.has('dish1Price'), false)
})

test('new chef pick instances start as manual editorial curation without changing legacy defaults', () => {
  assert.deepEqual(createInitialSectionSettings('chef-pick'), {
    editorialVersion: '2',
    selectionMode: 'manual',
    itemCount: '3',
    chefIcon: 'sef-sapkasi',
    showQuote: 'false',
  })
  assert.deepEqual(createInitialSectionSettings('gallery'), {
    editorialVersion: '2', layout: 'mosaic', mosaicPattern: 'editorial', columns: '2', maxItems: '6', enableLightbox: 'true',
    rowHeight: '104', gap: '8', padding: '14', radius: '16', imageFit: 'cover', imagePosition: 'center',
  })
  assert.equal(SECTION_SETTING_SCHEMA['chef-pick']?.find((field) => field.key === 'selectionMode')?.default, 'automatic')
})

test('combo ribbon editor uses real products and exposes server-verified bundle prices', () => {
  const fields = new Map(SECTION_SETTING_SCHEMA['combo-ribbon']!.map((field) => [field.key, field]))

  assert.equal(fields.get('selectionMode')?.default, 'automatic')
  assert.equal(fields.get('comboCount')?.default, '2')
  assert.equal(fields.get('itemsPerCombo')?.default, '2')
  assert.equal(fields.get('combo1Item1Id')?.type, 'product-select')
  assert.equal(fields.get('combo3Item3Id')?.type, 'product-select')
  assert.equal(fields.get('combo3Item4Id')?.type, 'product-select')
  assert.deepEqual(fields.get('itemsPerCombo')?.options?.map((option) => option.value), ['2', '3', '4'])
  assert.equal(fields.get('imageFit')?.default, 'cover')
  assert.equal(fields.get('imagePosition')?.default, 'center')
  assert.equal(fields.get('ctaMode')?.default, 'inherit')
  assert.equal(fields.get('combo1Price')?.type, 'text')
  assert.equal(fields.get('combo1DiscountPolicy')?.label, 'İndirim Birleşimi')
  assert.equal(fields.get('combo1DiscountPolicy')?.default, 'stack')
  assert.deepEqual(fields.get('combo2DiscountPolicy')?.options?.map((option) => option.value), ['stack', 'combo-only'])
  assert.equal(fields.get('combo3DiscountPolicy')?.type, 'select')
  assert.equal(fields.has('combo1OldPrice'), false)
  assert.equal(fields.has('combo1ImageUrl'), false)
  assert.deepEqual(createInitialSectionSettings('combo-ribbon'), {
    editorialVersion: '2',
    selectionMode: 'manual',
    comboCount: '1',
    itemsPerCombo: '2',
    showSavings: 'true',
    imageFit: 'cover',
    imagePosition: 'center',
  })
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
  assert.equal(fields.get('imageSize')?.default, 112)
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
