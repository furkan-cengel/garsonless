import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import type { MenuItem, SectionPromotionContext } from '../../../menu/types'
import { DailySpecialBlock } from './DailySpecialSection'

const product: MenuItem = {
  id: 'menemen',
  category_id: 'breakfast',
  name: 'Menemen',
  description: 'Domates, biber, yumurta',
  price: 180,
  images: ['https://images.example/menemen.webp'],
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
  position: 0,
}

test('daily special renders the selected product at its catalog price by default', () => {
  const html = renderToStaticMarkup(
    <DailySpecialBlock
      sectionInstanceId="daily-home"
      config={{ productId: 'menemen' }}
      items={[product]}
      onQuickAdd={() => undefined}
    />,
  )

  assert.match(html, /Menemen/)
  assert.match(html, /Domates, biber, yumurta/)
  assert.match(html, /https:\/\/images\.example\/menemen\.webp/)
  assert.match(html, /₺180,00/)
  assert.match(html, /--daily-image-size:112px/)
  assert.match(html, /data-promotion-state="ready"/)
  assert.doesNotMatch(html, /<del|href="#"/)
})

test('split media keeps the same square footprint as the menu special card', () => {
  const html = renderToStaticMarkup(
    <DailySpecialBlock
      sectionInstanceId="daily-home"
      config={{
        productId: 'menemen',
        imageSize: '112',
        chefNote: 'Uzun içerik görseli dikey olarak esnetmemeli.',
        countdownEnabled: 'true',
        campaignEndsAt: '2999-01-01T00:00:00.000Z',
      }}
      items={[product]}
    />,
  )

  assert.match(html, /data-daily-media="true"/)
  assert.match(html, /--daily-image-size:112px/)
  assert.match(html, /aspect-ratio:\s*1 \/ 1/)
  assert.match(html, /align-self:\s*start/)
  assert.match(html, /garsonless-daily-visual-column[\s\S]*data-daily-media="true"[\s\S]*role="timer"[\s\S]*data-layout="compact"/)
  assert.doesNotMatch(html, /@container \(max-width: 330px\)/)
  assert.doesNotMatch(html, /aspect-ratio:\s*16 \/ 9/)
  assert.doesNotMatch(html, /data-daily-media="true" style="[^"]*(?:min-height:100%|align-self:stretch)/)
})

test('daily special clamps legacy image sizes so media cannot dominate the card', () => {
  const legacyDefault = renderToStaticMarkup(
    <DailySpecialBlock
      sectionInstanceId="daily-home"
      config={{ productId: 'menemen', imageSize: '122' }}
      items={[product]}
    />,
  )
  const oversized = renderToStaticMarkup(
    <DailySpecialBlock
      sectionInstanceId="daily-home"
      config={{ productId: 'menemen', imageSize: '999' }}
      items={[product]}
    />,
  )
  const undersized = renderToStaticMarkup(
    <DailySpecialBlock
      sectionInstanceId="daily-home"
      config={{ productId: 'menemen', imageSize: '12' }}
      items={[product]}
    />,
  )

  assert.match(legacyDefault, /--daily-image-size:112px/)
  assert.match(oversized, /--daily-image-size:180px/)
  assert.match(undersized, /--daily-image-size:76px/)
})

test('daily special forwards a server-verifiable fixed promotion', () => {
  const calls: Array<{
    item: MenuItem
    originalPrice: number | undefined
    promotion: SectionPromotionContext | undefined
  }> = []
  const tree = DailySpecialBlock({
    sectionInstanceId: 'daily-home',
    config: {
      productId: 'menemen',
      discountMode: 'fixed-price',
      campaignPrice: '120',
      discountPolicy: 'promotion-only',
    },
    items: [product],
    onQuickAdd: (item, originalPrice, promotion) => calls.push({ item, originalPrice, promotion }),
  })

  const html = renderToStaticMarkup(tree)
  assert.match(html, /₺120,00/)
  assert.match(html, /₺180,00/)
  assert.match(html, /₺60,00 kazanç/)
  assert.match(html, /diğer üyelik indirimleriyle birleşmez/)

  const addButton = findElementByClassName(tree, 'garsonless-daily-add')
  assert.ok(addButton)
  ;(addButton.props as { onClick?: () => void }).onClick?.()
  assert.deepEqual(calls, [{
    item: { ...product, price: 120 },
    originalPrice: 180,
    promotion: { sectionInstanceId: 'daily-home', kind: 'daily-special' },
  }])
})

test('daily special honors custom button form and icon on the home surface', () => {
  const renderButton = (buttonStyle: 'icon' | 'pill' | 'full', buttonIcon: 'plus' | 'cart' | 'bag') => renderToStaticMarkup(
    <DailySpecialBlock
      sectionInstanceId={`daily-${buttonStyle}`}
      actionMode="discover"
      config={{ productId: 'menemen', ctaMode: 'custom', buttonStyle, buttonIcon }}
      items={[product]}
      onQuickAdd={() => undefined}
    />,
  )

  const iconOnly = renderButton('icon', 'cart')
  assert.match(iconOnly, /data-cta-icon="cart" data-button-style="icon"/)
  assert.doesNotMatch(iconOnly, />İncele</)

  const pill = renderButton('pill', 'plus')
  assert.match(pill, /data-cta-icon="plus" data-button-style="pill"/)
  assert.match(pill, />İncele</)

  const full = renderButton('full', 'bag')
  assert.match(full, /data-cta-icon="bag" data-button-style="full"/)
  assert.match(full, /width:100%/)
})

test('daily special preserves the default discover CTA when it inherits global settings', () => {
  const html = renderToStaticMarkup(
    <DailySpecialBlock
      sectionInstanceId="daily-home"
      actionMode="discover"
      config={{ productId: 'menemen', ctaMode: 'inherit', buttonStyle: 'icon', buttonIcon: 'cart' }}
      items={[product]}
      onQuickAdd={() => undefined}
    />,
  )

  assert.match(html, /data-cta-source="inherit" data-cta-icon="arrow" data-button-style="pill"/)
})

test('timed daily special renders a stable timer and expired content is absent', () => {
  const future = renderToStaticMarkup(
    <DailySpecialBlock
      sectionInstanceId="daily-home"
      config={{
        productId: 'menemen',
        countdownEnabled: 'true',
        campaignEndsAt: '2999-01-01T00:00:00.000Z',
      }}
      items={[product]}
    />,
  )
  assert.match(future, /role="timer"/)
  assert.match(future, /data-layout="compact"/)
  assert.match(future, /width:100%/)

  const expired = renderToStaticMarkup(
    <DailySpecialBlock
      sectionInstanceId="daily-home"
      config={{
        productId: 'menemen',
        countdownEnabled: 'true',
        campaignEndsAt: '2020-01-01T00:00:00.000Z',
      }}
      items={[product]}
    />,
  )
  assert.equal(expired, '')
})

test('daily special fails honestly for a missing product or malformed deadline', () => {
  const missing = renderToStaticMarkup(
    <DailySpecialBlock sectionInstanceId="daily-home" config={{ productId: 'missing' }} items={[product]} />,
  )
  assert.match(missing, /configuration-required/)
  assert.match(missing, /satışta olan bir ürün seçin/)

  const malformed = DailySpecialBlock({
    sectionInstanceId: 'daily-home',
    config: {
      productId: 'menemen',
      countdownEnabled: 'true',
      campaignEndsAt: 'not-a-date',
    },
    items: [product],
    onQuickAdd: () => undefined,
  })
  assert.match(renderToStaticMarkup(malformed), /geçerli bir bitiş tarihi/)
  assert.equal(findElementByClassName(malformed, 'garsonless-daily-add'), null)
})

function findElementByClassName(node: React.ReactNode, className: string): React.ReactElement | null {
  if (!React.isValidElement(node)) return null
  const props = node.props as { className?: string; children?: React.ReactNode }
  if (props.className?.split(/\s+/).includes(className)) return node
  for (const child of React.Children.toArray(props.children)) {
    const match = findElementByClassName(child, className)
    if (match) return match
  }
  return null
}
