import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { THEME_DEFAULTS } from '../themes/default'
import { SETTINGS_SCHEMA } from '../themes/default/settings'
import { ProductCard } from './ProductCard'
import { ThemeProvider } from './ThemeContext'
import type { MenuItem } from './types'

const source = readFileSync(new URL('./ProductCard.tsx', import.meta.url), 'utf8')
const menuPageSource = readFileSync(new URL('../themes/default/MenuPage.tsx', import.meta.url), 'utf8')
const tagShimmerSource = readFileSync(new URL('./tagShimmer.ts', import.meta.url), 'utf8')
const item: MenuItem = {
  id: 'tiramisu',
  category_id: 'desserts',
  name: 'Tiramisu',
  description: '',
  price: 195,
  images: ['/tiramisu.webp'],
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

function renderConfiguredCard({
  promotionLabel,
  theme = THEME_DEFAULTS,
  cartQuantity = 0,
}: {
  promotionLabel?: string
  theme?: typeof THEME_DEFAULTS
  cartQuantity?: number
} = {}) {
  const card = createElement(ProductCard, {
    item,
    onOpen: () => {},
    onQuickAdd: () => {},
    cartQuantity,
    onIncrement: () => {},
    onDecrement: () => {},
    ...(promotionLabel ? { promotionLabel } : {}),
  })
  return renderToStaticMarkup(createElement(ThemeProvider, { initialTheme: theme, children: card }))
}

function renderCard(promotionLabel?: string) {
  return renderConfiguredCard(promotionLabel ? { promotionLabel } : {})
}

test('quantity stepper keeps compact icons inside 44px touch targets', () => {
  assert.match(source, /const btnSz = 44/)
  assert.match(source, /<AppIcons\.minus size=\{stepperIconSize\}/)
  assert.match(source, /<AppIcons\.plus size=\{stepperIconSize\}/)

  const markup = renderConfiguredCard({ cartQuantity: 2 })
  assert.equal((markup.match(/data-card-quantity-action=/g) ?? []).length, 2)
  assert.equal((markup.match(/width:44px;height:44px/g) ?? []).length >= 2, true)
  assert.match(markup, /data-card-stepper-track="true"[^>]+inset:6px 0/)
  assert.equal((markup.match(/data-card-stepper-visual="true"[^>]+width:28px;height:28px/g) ?? []).length, 2)
})

test('quick-add keeps a 44px hit target while rendering a compact visual button', () => {
  const markup = renderConfiguredCard({
    theme: { ...THEME_DEFAULTS, cols: 1, cardCtaStyle: 'icon' },
  })

  assert.match(markup, /data-card-cta-action="true"[^>]+width:44px;height:44px/)
  assert.match(markup, /data-card-cta-visual="true"[^>]+width:32px;height:32px/)
  assert.match(menuPageSource, /\[data-card-cta-action\]:focus-visible/)
  assert.match(menuPageSource, /\[data-card-quantity-action\]:focus-visible/)
  assert.match(menuPageSource, /outline:2px solid var\(--p-accent\)/)
})

test('every card editor setting has a menu runtime consumer', () => {
  const cardFields = SETTINGS_SCHEMA.find((group) => group.id === 'cards')?.fields ?? []
  const runtimeSources = `${source}\n${menuPageSource}\n${tagShimmerSource}`

  assert.equal(cardFields.length, 18)
  for (const field of cardFields) {
    assert.match(
      runtimeSources,
      new RegExp(`theme\\??\\.${String(field.themeField)}\\b`),
      `${field.id} is present in the editor but has no card runtime consumer`,
    )
  }
})

test('card layout, surface, media, content, and CTA settings reach rendered output', () => {
  const configuredItem = { ...item, description: 'Kahve ve kakao notaları' }
  const configuredTheme = {
    ...THEME_DEFAULTS,
    cols: 1,
    cardLayout: 'horizontal' as const,
    cardRadius: 22,
    cardShadow: 'hard' as const,
    cardBorder: 'solid' as const,
    cardDensity: 'spacious' as const,
    cardImageFit: 'contain' as const,
    cardImagePosition: 'bottom' as const,
    cardHorizontalImageWidth: 132,
    cardPriceAlign: 'right' as const,
    cardCtaStyle: 'pill' as const,
    cardTitleLines: 3 as const,
    cardDescriptionLines: 3 as const,
    cardHover: 'glow' as const,
    tagShimmer: true,
  }
  const card = createElement(ProductCard, {
    item: configuredItem,
    onOpen: () => {},
    onQuickAdd: () => {},
  })
  const markup = renderToStaticMarkup(createElement(ThemeProvider, {
    initialTheme: configuredTheme,
    children: card,
  }))

  assert.match(markup, /data-card-hover="glow"/)
  assert.match(markup, /garsonless-tag-shimmer-enabled/)
  assert.match(markup, /border-radius:22px/)
  assert.match(markup, /border:2px solid var\(--p-border\)/)
  assert.match(markup, /flex-direction:row/)
  assert.match(markup, /min-height:128px/)
  assert.match(markup, /width:clamp\(92px, 132px, 42%\)/)
  assert.match(markup, /object-fit:cover/)
  assert.match(markup, /object-position:bottom/)
  assert.match(markup, /padding:14px 16px 16px/)
  assert.match(markup, /-webkit-line-clamp:2/)
  assert.match(markup, /-webkit-line-clamp:1/)
  assert.match(markup, /flex-direction:row-reverse/)
  assert.match(markup, /data-card-cta-action="true"/)

  const verticalMarkup = renderConfiguredCard({
    theme: { ...THEME_DEFAULTS, cols: 1, cardLayout: 'vertical', cardImageAspect: '16:9' },
  })
  assert.match(verticalMarkup, /aspect-ratio:4\/3/)

  const imageLessMarkup = renderConfiguredCard({
    theme: { ...THEME_DEFAULTS, cols: 1, cardShowImage: false },
  })
  assert.doesNotMatch(imageLessMarkup, /<img/)

  const minimalMarkup = renderConfiguredCard({
    theme: { ...THEME_DEFAULTS, cols: 1, cardLayout: 'minimal' },
  })
  assert.match(minimalMarkup, /data-card-layout="minimal"/)
  assert.match(minimalMarkup, /min-height:60px/)
  assert.match(minimalMarkup, /data-card-cta-action="true"/)
  assert.doesNotMatch(minimalMarkup, /<img|data-component="food-meta"/)
})

test('card density follows measured card width instead of the configured column count', () => {
  assert.match(source, /new ResizeObserver/)
  assert.match(source, /cardWidth < 180/)
  assert.match(source, /data-card-width=\{narrow \? 'narrow' : 'regular'\}/)
})

test('vertical grid derives its columns from usable container width', () => {
  assert.match(menuPageSource, /data-product-grid-shell/)
  assert.match(menuPageSource, /containerType: 'inline-size'/)
  assert.match(menuPageSource, /@container \(max-width:1079px\)/)
  assert.match(menuPageSource, /@container \(max-width:679px\)/)
  assert.match(menuPageSource, /@container \(max-width:279px\)/)
  assert.match(menuPageSource, /repeat\(4, minmax\(0, 420px\)\)/)
  assert.match(menuPageSource, /minmax\(0,420px\)/)
  assert.match(menuPageSource, /justifyContent: theme\.cardLayout === 'vertical' \? 'center' : 'stretch'/)
})

test('legacy automatic-layout overrides remain accepted but no longer affect card rendering', () => {
  const cardFields = SETTINGS_SCHEMA.find((group) => group.id === 'cards')?.fields ?? []
  const removedIds = ['cardColumns', 'cardImageAspect', 'cardImageFit']
  assert.deepEqual(cardFields.filter((field) => removedIds.includes(field.id)), [])
  assert.doesNotMatch(source, /theme\.cardImageAspect|theme\.cardImageFit|theme\.cols/)
})

test('horizontal food tags stay in one compact group at the widest safe media setting', () => {
  const dietaryItem = { ...item, energy_kcal: 239, is_vegan: true, is_vegetarian: true, is_halal: true }
  const card = createElement(ProductCard, { item: dietaryItem, onOpen: () => {}, onQuickAdd: () => {} })
  const markup = renderToStaticMarkup(createElement(ThemeProvider, {
    initialTheme: { ...THEME_DEFAULTS, cardLayout: 'horizontal', cardHorizontalImageWidth: 160 },
    children: card,
  }))

  assert.match(markup, /width:clamp\(92px, 160px, 42%\)/)
  assert.match(markup, /data-component="dietary-badges" data-layout="single-line"/)
  assert.match(markup, />Vegan<|>Vegan<\/span>/)
  assert.match(markup, />Helal<|>Helal<\/span>/)
  assert.doesNotMatch(markup, />Vejetaryen<|>Vejetaryen<\/span>/)
})

test('card hover and motion styles respect device capability and reduced motion', () => {
  assert.match(menuPageSource, /@media \(hover:hover\) and \(pointer:fine\)/)
  assert.match(menuPageSource, /@media \(prefers-reduced-motion:reduce\)/)
  assert.match(menuPageSource, /\[data-product-card\]\{transition:none!important\}/)
})

test('card-only surface tokens fall back to legacy global values', () => {
  assert.match(source, /theme\.cardRadius \?\? theme\.radius/)
  assert.match(source, /theme\.cardShadow \?\? theme\.shadow/)
  assert.match(source, /theme\.cardBorder \?\? theme\.border/)
})

test('image-less cards reserve the configured media placeholder', () => {
  assert.match(source, /const hasProductImage = imageUrl !== null/)
  assert.match(source, /const mediaVisible = showImage/)
  assert.match(source, /\{mediaVisible && <div/)
  assert.match(source, /<ImagePlaceholderIcon \/>/)
  assert.match(source, /theme\.cardPlaceholderStyle === 'accent'/)
})

test('configurable products retain their options label when card media is disabled', () => {
  assert.match(source, /!mediaVisible && \(promotionLabel \|\| \(theme\.cardShowTag && hasModifiers\)\)/)
  assert.match(source, /theme\.cardShowTag && hasModifiers/)
  assert.match(source, /data-image-state=\{hasProductImage \? 'available' : 'missing'\}/)
})

test('an active multi-buy campaign has a dedicated product-card badge', () => {
  assert.match(source, /promotionLabel\?: string/)
  assert.match(source, /data-component="product-promotion-badge"/)
  assert.match(source, /\{promotionLabel && <PromotionBadge/)
  assert.match(renderCard('2 al 1 öde'), /data-component="product-promotion-badge"/)
  assert.match(renderCard('2 al 1 öde'), />2 al 1 öde<\/span>/)
})

test('an ordinary card has no stale campaign badge', () => {
  assert.doesNotMatch(renderCard(), /product-promotion-badge|2 al 1 öde/)
})
