import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { THEME_DEFAULTS } from '../themes/default'
import { ProductModal } from './ProductModal'
import { ThemeProvider } from './ThemeContext'
import type { MenuItem } from './types'

const source = readFileSync(new URL('./ProductModal.tsx', import.meta.url), 'utf8')
const item: MenuItem = {
  id: 'tiramisu',
  category_id: 'desserts',
  name: 'Tiramisu',
  description: '',
  price: 97.5,
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
  is_available: true,
  position: 1,
}

function renderModal(quantityStep = 1, promotionLabel?: string) {
  const modal = createElement(ProductModal, {
    item,
    onClose: () => {},
    onAddToCart: () => {},
    quantityStep,
    ...(promotionLabel ? { promotionLabel } : {}),
  })
  return renderToStaticMarkup(createElement(ThemeProvider, { initialTheme: THEME_DEFAULTS, children: modal }))
}

const configurableItem: MenuItem = {
  ...item,
  id: 'menemen',
  name: 'Menemen',
  description: 'Taze domates, biber ve yumurta ile hazırlanır.',
  price: 250,
  energy_kcal: 350,
  contains_allergens: ['eggs'],
  ingredients: [
    { id: 'egg', name: 'Yumurta', removable: false, allergen_codes: ['eggs'] },
    { id: 'onion', name: 'Soğan', removable: true, allergen_codes: [] },
  ],
  modifier_groups: [
    {
      id: 'style',
      name: 'Nasıl olsun?',
      selection_mode: 'single',
      required: true,
      min: 1,
      max: 1,
      options: [
        {
          id: 'classic',
          name: 'Klasik',
          price_delta: 0,
          calorie_delta: 0,
          is_default: true,
          allergen_codes: [],
        },
        {
          id: 'cheese',
          name: 'Peynirli',
          price_delta: 100,
          calorie_delta: 80,
          is_default: false,
          allergen_codes: ['milk'],
        },
      ],
    },
  ],
}

const recommendationItem: MenuItem = {
  ...item,
  id: 'tea',
  category_id: 'drinks',
  name: 'Çay',
  price: 35,
}

function renderConfigurableModal(orderingEnabled: boolean) {
  const modal = createElement(ProductModal, {
    item: configurableItem,
    recommendationItems: [recommendationItem],
    orderingEnabled,
    onClose: () => {},
    onAddToCart: () => {},
  })
  return renderToStaticMarkup(createElement(ThemeProvider, { initialTheme: THEME_DEFAULTS, children: modal }))
}

test('2 al 1 öde modal starts from a visible two-item package', () => {
  const html = renderModal(2, '2 al 1 öde')
  assert.match(html, /data-component="product-modal-promotion"/)
  assert.match(html, />2 al 1 öde<\/span>/)
  assert.match(html, /2 adet ₺195,00/)
  assert.match(html, /data-component="product-modal-quantity"[^>]*>2<\/span>/)
})

test('campaign modal controls advance only in complete packages', () => {
  assert.match(source, /q - normalizedQuantityStep/)
  assert.match(source, /q \+ normalizedQuantityStep/)
  assert.match(source, /Math\.floor\(99 \/ normalizedQuantityStep\) \* normalizedQuantityStep/)
})

test('ordinary product modal keeps the one-item flow and no campaign badge', () => {
  const html = renderModal()
  assert.doesNotMatch(html, /product-modal-promotion|2 al 1 öde/)
  assert.match(html, /data-component="product-modal-quantity"[^>]*>1<\/span>/)
})

test('view-only product detail keeps product information and removes every ordering control', () => {
  const html = renderConfigurableModal(false)

  assert.match(html, /data-ordering-enabled="false"/)
  assert.match(html, /Taze domates, biber ve yumurta ile hazırlanır\./)
  assert.match(html, /İçindekiler/)
  assert.match(html, /Alerjenler · ürün içerir/)
  assert.match(html, /Çıkarılabilir malzemeler/)
  assert.match(html, /Ürün, aşağıdaki malzemeler çıkarılarak hazırlanabilir\./)
  assert.match(html, /data-component="product-modal-readonly-removable"[^>]*>Soğan<\/div>/)
  assert.match(html, /Seçenekler ve fiyat farkları/)
  assert.match(html, /Klasik/)
  assert.match(html, /Standart/)
  assert.match(html, /Peynirli/)
  assert.match(html, /\+₺100,00 · \+80 kcal/)
  assert.match(html, /data-component="product-modal-view-only-notice"/)
  assert.match(html, /Bu menü yalnızca görüntüleme amaçlıdır\./)

  assert.doesNotMatch(html, /data-component="product-note"/)
  assert.doesNotMatch(html, /data-component="product-recommendations"|Yanında iyi gider/)
  assert.doesNotMatch(html, /<div data-component="product-modal-actions"/)
  assert.doesNotMatch(html, /<span data-component="product-modal-quantity"/)
  assert.doesNotMatch(html, /Sepete ekle|Adedi artır|Adedi azalt/)
  assert.doesNotMatch(html, /Soğan malzemesini çıkar|Soğan olmasın/)
  assert.doesNotMatch(html, /type="checkbox"|type="radio"|<textarea/)
  assert.equal((html.match(/<button/g) ?? []).length, 1, 'only the close button stays interactive')
})

test('ordering-enabled product detail preserves the complete Pro order flow', () => {
  const html = renderConfigurableModal(true)

  assert.match(html, /data-ordering-enabled="true"/)
  assert.match(html, /data-component="product-note"/)
  assert.match(html, /data-component="product-recommendations"/)
  assert.match(html, /Yanında iyi gider/)
  assert.match(html, /<div data-component="product-modal-actions"/)
  assert.match(html, /<span data-component="product-modal-quantity"/)
  assert.match(html, /Sepete ekle|Adedi artır|Adedi azalt/)
  assert.match(html, /Soğan malzemesini çıkar/)
  assert.match(html, /type="checkbox"|type="radio"/)
  assert.match(html, /<textarea/)
  assert.doesNotMatch(html, /product-modal-view-only-notice|yalnızca görüntüleme amaçlıdır/)
})

test('combo configuration keeps every bundled product visible and shows the bundle total', () => {
  const modal = createElement(ProductModal, {
    item,
    onClose: () => {},
    onAddToCart: () => {},
    lockQuantity: true,
    contextLabel: 'Kombo ürünü 1/2',
    contextTitle: '2 Ürünlük Kombo · 2 ürün birlikte sepete eklenecek',
    comboContext: {
      baseTotal: 350,
      items: [
        { id: item.id, name: item.name, imageUrl: null, state: 'current' as const },
        { id: 'coffee', name: 'Türk Kahvesi', imageUrl: null, state: 'included' as const },
      ],
    },
    submitLabel: 'Komboyu sepete ekle',
  })
  const html = renderToStaticMarkup(createElement(ThemeProvider, { initialTheme: THEME_DEFAULTS, children: modal }))

  assert.match(html, /Kombo seçenekleri/)
  assert.match(html, /Kombo içeriği: 2 ürün birlikte eklenecek/)
  assert.match(html, /Şimdi seçiliyor/)
  assert.match(html, /Türk Kahvesi/)
  assert.match(html, /Komboya dahil/)
  assert.match(html, /Kombo toplamı/)
  assert.match(html, /₺350,00/)
  assert.doesNotMatch(html, /Kombo ürünü · 1 adet/)
})

test('an optional single-choice variant can be cleared by tapping the selected option again', () => {
  // Native radios never fire change when re-clicked, so the clear is a click on the checked input.
  assert.match(source, /onClick=\{type === "radio" && checked && onReselect \? onReselect : undefined\}/)
  assert.match(source, /onReselect=\{group\.selection_mode === "single" && minimumSelections === 0 \? \(\) => clearGroupSelection\(group\) : undefined\}/)
  // Required groups keep radio behaviour: a choice can be changed but not removed.
  assert.match(source, /const clearGroupSelection = \(group: ModifierGroup\) => \{\s*setSelections\(\(prev\) => \(\{ \.\.\.prev, \[group\.id\]: \[\] \}\)\);/)
})
