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
