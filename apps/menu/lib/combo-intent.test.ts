import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import type { MenuItem } from '@garsonless/ui/menu'
import { resolveComboIntent } from './combo-intent.ts'
import {
  consumeComboIntentHandoff,
  readComboIntent,
  readPreviewComboConfig,
  removeComboIntentFromUrl,
  storeComboIntentHandoff,
} from './combo-intent-params.ts'

function memoryStorage(): Pick<Storage, 'getItem' | 'removeItem' | 'setItem'> {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => { values.delete(key) },
    setItem: (key, value) => { values.set(key, value) },
  }
}

function item(id: string, name: string, price: number, position: number, available = true): MenuItem {
  return {
    id,
    category_id: 'breakfast',
    name,
    description: null,
    price,
    images: [],
    ingredients: [],
    energy_kcal: null,
    contains_allergens: [],
    may_contain_allergens: [],
    allergen_note: null,
    cross_contact_note: null,
    contains_alcohol: false,
    contains_pork: false,
    is_vegetarian: false,
    is_vegan: false,
    is_halal: false,
    food_info_reviewed_at: null,
    modifier_groups: [],
    is_available: available,
    position,
  }
}

function theme(): GarsonlessTheme {
  return {
    surfaces: {
      home: {
        enabled: true,
        compositionVersion: 2,
        sections: [],
        blocks: [{ id: 'home-combo', sectionId: 'combo-ribbon', enabled: true }],
      },
    },
    sectionSettings: {
      'home-combo': {
        selectionMode: 'manual',
        comboCount: '1',
        itemsPerCombo: '2',
        combo1Item1Id: 'coffee',
        combo1Item2Id: 'corn',
        combo1Price: '390',
        combo1Title: 'Kahve Molası',
      },
    },
  } as unknown as GarsonlessTheme
}

test('reads only a bounded, complete combo intent', () => {
  assert.deepEqual(readComboIntent('?comboSection=home-combo&comboIndex=1'), { sectionInstanceId: 'home-combo', comboIndex: 1 })
  assert.equal(readComboIntent('?comboSection=home-combo&comboIndex=4'), null)
  assert.equal(readComboIntent('?comboSection=home-combo'), null)
})

test('removes combo data while preserving unrelated query and hash state', () => {
  const url = new URL('https://example.test/maf/menu?preview=1&comboSection=home-combo&comboIndex=1&comboItem=coffee&comboItem=corn&comboTotal=390&comboTitle=Kahve#category-coffee')
  assert.equal(removeComboIntentFromUrl(url), '/maf/menu?preview=1#category-coffee')
})

test('builds a bounded manual config from preview URL products', () => {
  const intent = { sectionInstanceId: 'home-combo', comboIndex: 2 }
  assert.deepEqual(readPreviewComboConfig('?comboItem=coffee&comboItem=corn&comboTotal=390&comboTitle=Kahve+Molası', intent), {
    selectionMode: 'manual',
    comboCount: '2',
    itemsPerCombo: '2',
    combo2Item1Id: 'coffee',
    combo2Item2Id: 'corn',
    combo2Price: '390',
    combo2Title: 'Kahve Molası',
  })
  assert.equal(readPreviewComboConfig('?comboItem=coffee&comboTotal=390', intent), null)
  assert.equal(readPreviewComboConfig('?comboItem=coffee&comboItem=corn&comboTotal=0', intent), null)
  assert.deepEqual(readPreviewComboConfig('?comboItem=one&comboItem=two&comboItem=three&comboItem=four&comboTotal=400', intent), {
    selectionMode: 'manual',
    comboCount: '2',
    itemsPerCombo: '4',
    combo2Item1Id: 'one',
    combo2Item2Id: 'two',
    combo2Item3Id: 'three',
    combo2Item4Id: 'four',
    combo2Price: '400',
  })
})

test('hands off a bounded combo config once within the same restaurant and intent', () => {
  const storage = memoryStorage()
  const intent = { sectionInstanceId: 'home-combo', comboIndex: 1 }
  assert.equal(storeComboIntentHandoff(storage, {
    ...intent,
    restaurantSlug: 'maf-lounge',
    config: { comboCount: '1', combo1Item1Id: 'coffee', combo1Item2Id: 'corn', bgColor: '#000000' },
  }, 1_000), true)
  assert.deepEqual(consumeComboIntentHandoff(storage, intent, 'maf-lounge', 2_000), {
    comboCount: '1',
    combo1Item1Id: 'coffee',
    combo1Item2Id: 'corn',
  })
  assert.equal(consumeComboIntentHandoff(storage, intent, 'maf-lounge', 2_000), null)
})

test('handoff keeps versioned fourth-product identity and pricing policy', () => {
  const storage = memoryStorage()
  const intent = { sectionInstanceId: 'home-combo', comboIndex: 1 }
  storeComboIntentHandoff(storage, {
    ...intent,
    restaurantSlug: 'maf-lounge',
    config: {
      editorialVersion: '2', selectionMode: 'manual', comboCount: '1', itemsPerCombo: '4',
      combo1Item1Id: 'one', combo1Item2Id: 'two', combo1Item3Id: 'three', combo1Item4Id: 'four',
      combo1Price: '400', combo1DiscountPolicy: 'combo-only',
    },
  }, 1_000)
  const config = consumeComboIntentHandoff(storage, intent, 'maf-lounge', 2_000)
  assert.equal(config?.editorialVersion, '2')
  assert.equal(config?.combo1Item4Id, 'four')
  assert.equal(config?.combo1DiscountPolicy, 'combo-only')
})

test('rejects expired or cross-restaurant combo handoffs', () => {
  const storage = memoryStorage()
  const intent = { sectionInstanceId: 'home-combo', comboIndex: 1 }
  storeComboIntentHandoff(storage, { ...intent, restaurantSlug: 'maf-lounge', config: { comboCount: '1' } }, 1_000)
  assert.equal(consumeComboIntentHandoff(storage, intent, 'another-place', 2_000), null)
  storeComboIntentHandoff(storage, { ...intent, restaurantSlug: 'maf-lounge', config: { comboCount: '1' } }, 1_000)
  assert.equal(consumeComboIntentHandoff(storage, intent, 'maf-lounge', 302_001), null)
})

test('rebuilds the combo from live theme settings and catalog prices', () => {
  const request = resolveComboIntent(
    { sectionInstanceId: 'home-combo', comboIndex: 1 },
    theme(),
    [item('corn', 'Mısır cipsi', 200, 2), item('coffee', 'Türk Kahvesi', 235, 1)],
  )

  assert.equal(request?.title, 'Kahve Molası')
  assert.equal(request?.catalogTotal, 435)
  assert.equal(request?.total, 390)
  assert.deepEqual(request?.items.map(({ id }) => id), ['coffee', 'corn'])
})

test('rebuilds all four modern combo products without truncating the cart request', () => {
  const fourTheme = theme()
  fourTheme.sectionSettings!['home-combo'] = {
    editorialVersion: '2', selectionMode: 'manual', comboCount: '1', itemsPerCombo: '4',
    combo1Item1Id: 'one', combo1Item2Id: 'two', combo1Item3Id: 'three', combo1Item4Id: 'four', combo1Price: '350',
  }
  const request = resolveComboIntent(
    { sectionInstanceId: 'home-combo', comboIndex: 1 },
    fourTheme,
    [item('one', 'Bir', 100, 1), item('two', 'İki', 100, 2), item('three', 'Üç', 100, 3), item('four', 'Dört', 100, 4)],
  )
  assert.deepEqual(request?.items.map(({ id }) => id), ['one', 'two', 'three', 'four'])
  assert.equal(request?.total, 350)
  assert.equal(request?.title, '4 Ürünlük Kombo')
})

test('rebuilds a manual promo-slider combo through the same cart handoff', () => {
  const promoTheme = theme()
  promoTheme.surfaces!.home.blocks = [{ id: 'home-slider', sectionId: 'promo-slider', enabled: true }]
  promoTheme.sectionSettings = {
    'home-slider': {
      comboItem1Id: 'coffee',
      comboItem2Id: 'corn',
      comboPrice: '390',
      comboTitle: 'Slider Kahve Molası',
    },
  }
  const request = resolveComboIntent(
    { sectionInstanceId: 'home-slider', comboIndex: 1 },
    promoTheme,
    [item('coffee', 'Türk Kahvesi', 235, 1), item('corn', 'Mısır cipsi', 200, 2)],
  )
  assert.equal(request?.title, 'Slider Kahve Molası')
  assert.equal(request?.total, 390)
  assert.deepEqual(request?.items.map(({ id }) => id), ['coffee', 'corn'])
})

test('rejects stale sections and combos containing unavailable products', () => {
  const catalog = [item('coffee', 'Türk Kahvesi', 235, 1), item('corn', 'Mısır cipsi', 200, 2, false)]
  assert.equal(resolveComboIntent({ sectionInstanceId: 'missing', comboIndex: 1 }, theme(), catalog), null)
  assert.equal(resolveComboIntent({ sectionInstanceId: 'home-combo', comboIndex: 1 }, theme(), catalog), null)
})

test('uses the same-tab handoff when the destination theme has not received the home block', () => {
  const fallbackConfig = theme().sectionSettings?.['home-combo'] ?? null
  const request = resolveComboIntent(
    { sectionInstanceId: 'home-combo', comboIndex: 1 },
    {} as GarsonlessTheme,
    [item('coffee', 'Türk Kahvesi', 235, 1), item('corn', 'Mısır cipsi', 200, 2)],
    fallbackConfig,
  )
  assert.equal(request?.total, 390)
  assert.deepEqual(request?.items.map(({ id }) => id), ['coffee', 'corn'])
})

test('prefers the exact clicked-card handoff over stale destination settings', () => {
  const staleTheme = theme()
  staleTheme.sectionSettings!['home-combo'] = {
    ...staleTheme.sectionSettings!['home-combo'],
    combo1Price: '435',
  }
  const clickedConfig = {
    ...theme().sectionSettings!['home-combo'],
    combo1Price: '390',
  }
  const request = resolveComboIntent(
    { sectionInstanceId: 'home-combo', comboIndex: 1 },
    staleTheme,
    [item('coffee', 'Türk Kahvesi', 235, 1), item('corn', 'Mısır cipsi', 200, 2)],
    clickedConfig,
  )
  assert.equal(request?.total, 390)
})

test('home combo actions cross into the menu with an unsaved-preview fallback', () => {
  const home = readFileSync(new URL('../app/[slug]/HomePageClient.tsx', import.meta.url), 'utf8')
  const sharedSection = readFileSync(new URL('../app/[slug]/SharedHomeSection.tsx', import.meta.url), 'utf8')
  const menu = readFileSync(new URL('../app/[slug]/MenuPageClient.tsx', import.meta.url), 'utf8')
  assert.match(home, /onAddCombo: \(combo, comboConfig\) =>/)
  assert.match(home, /storeComboIntentHandoff\(window\.sessionStorage/)
  assert.match(home, /comboSectionId: combo\.sectionInstanceId/)
  assert.match(home, /comboItemIds: combo\.items\.map/)
  assert.match(home, /openCart: true/)
  assert.match(menu, /<ComboIntentConsumer/)
  assert.match(menu, /readPreviewComboConfig\(window\.location\.search, intent\)/)
  assert.match(menu, /resolveComboIntent\(intent, theme, items, fallbackConfig\)/)
  assert.match(menu, /\{\.\.\.\(orderingEnabled \? \{ onAddCombo: handleAddCombo \} : \{\}\)\}/)
  assert.match(menu, /comboInteractionState=\{orderingEnabled \? 'enabled' : 'ordering-disabled'\}/)
  assert.match(sharedSection, /comboInteractionState=\{onAddCombo \? 'enabled' : editorPreview \? 'preview' : 'ordering-disabled'\}/)
})
