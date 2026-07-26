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
  assert.match(html, /data-promotion-state="ready"/)
  assert.doesNotMatch(html, /<del|href="#"/)
})

test('split media keeps its own square frame when the content column grows', () => {
  const html = renderToStaticMarkup(
    <DailySpecialBlock
      sectionInstanceId="daily-home"
      config={{
        productId: 'menemen',
        imageSize: '136',
        chefNote: 'Uzun içerik görseli dikey olarak esnetmemeli.',
        countdownEnabled: 'true',
        campaignEndsAt: '2999-01-01T00:00:00.000Z',
      }}
      items={[product]}
    />,
  )

  assert.match(html, /data-daily-media="true"/)
  assert.match(html, /--daily-image-size:136px/)
  assert.match(html, /aspect-ratio:\s*1 \/ 1/)
  assert.match(html, /align-self:start/)
  assert.match(html, /@container \(max-width: 330px\)/)
  assert.match(html, /aspect-ratio:\s*16 \/ 9/)
  assert.doesNotMatch(html, /data-daily-media="true" style="[^"]*(?:min-height:100%|align-self:stretch)/)
})

test('daily special clamps legacy image sizes so media cannot dominate the card', () => {
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
  assert.match(future, /width:14ch/)

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
