import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import type { MenuItem, SectionPromotionContext } from '../../../menu/types'
import { DiscountBadgeSection } from './DiscountBadgeSection'

const product: MenuItem = {
  id: 'latte',
  category_id: 'coffee',
  name: 'Buzlu Latte',
  description: 'Çift shot espresso',
  price: 200,
  images: ['https://images.example/latte.webp'],
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

test('discount badge renders the selected live product and an exact campaign price', () => {
  const html = renderToStaticMarkup(
    <DiscountBadgeSection
      sectionInstanceId="discount-home"
      config={{
        productId: 'latte',
        discountMode: 'fixed-price',
        campaignPrice: '129,90',
        discountPolicy: 'promotion-only',
      }}
      items={[product]}
      onQuickAdd={() => undefined}
    />,
  )

  assert.match(html, /Buzlu Latte/)
  assert.match(html, /Çift shot espresso/)
  assert.match(html, /https:\/\/images\.example\/latte\.webp/)
  assert.match(html, /₺129,90/)
  assert.match(html, /₺200,00/)
  assert.match(html, /₺70,10 kazanç/)
  assert.match(html, /diğer üyelik indirimleriyle birleşmez/)
  assert.match(html, /data-promotion-state="ready"/)
  assert.doesNotMatch(html, /🌭|FALL 2x1 OFFER/)
})

test('discount badge forwards the exact section identity and promotional price', () => {
  const calls: Array<{
    item: MenuItem
    originalPrice: number | undefined
    promotion: SectionPromotionContext | undefined
  }> = []
  const tree = DiscountBadgeSection({
    sectionInstanceId: 'discount-home',
    config: { productId: 'latte', discountMode: 'percentage', discountPercent: '25' },
    items: [product],
    onQuickAdd: (item, originalPrice, promotion) => calls.push({ item, originalPrice, promotion }),
  })
  const addButton = findElementByClassName(tree, 'garsonless-discount-add')

  assert.ok(addButton)
  const props = addButton.props as { onClick?: () => void }
  props.onClick?.()
  assert.deepEqual(calls, [{
    item: { ...product, price: 150 },
    originalPrice: 200,
    promotion: { sectionInstanceId: 'discount-home', kind: 'discount-badge' },
  }])
})

test('discount badge shows an honest configuration state instead of fake campaign data', () => {
  const html = renderToStaticMarkup(
    <DiscountBadgeSection
      sectionInstanceId="discount-home"
      config={{ productId: 'missing', discountMode: 'percentage', discountPercent: '20' }}
      items={[product]}
      onQuickAdd={() => undefined}
    />,
  )

  assert.match(html, /data-promotion-state="configuration-required"/)
  assert.match(html, /satışta olan bir ürün seçin/)
  assert.doesNotMatch(html, /Buzlu Latte|₺160,00/)
})

test('2 al 1 öde adds a pair and renders the pair total', () => {
  const calls: Array<{ item: MenuItem; promotion?: SectionPromotionContext }> = []
  const tree = DiscountBadgeSection({
    sectionInstanceId: 'discount-home',
    config: { productId: 'latte', discountMode: 'buy-2-pay-1' },
    items: [product],
    onQuickAdd: (item, _originalPrice, promotion) => calls.push({
      item,
      ...(promotion ? { promotion } : {}),
    }),
  })
  const html = renderToStaticMarkup(tree)
  assert.match(html, /2 AL 1 ÖDE/)
  assert.match(html, /2 ürün · ₺200,00/)
  assert.match(html, /₺400,00/)

  const addButton = findElementByClassName(tree, 'garsonless-discount-add')
  assert.ok(addButton)
  ;(addButton.props as { onClick?: () => void }).onClick?.()
  assert.equal(calls[0]?.item.price, 100)
  assert.deepEqual(calls[0]?.promotion, {
    sectionInstanceId: 'discount-home',
    kind: 'discount-badge',
    quantityStep: 2,
  })
})

test('timed discount renders a live timer and expired section is removed', () => {
  const futureHtml = renderToStaticMarkup(
    <DiscountBadgeSection
      sectionInstanceId="discount-home"
      config={{
        productId: 'latte',
        discountMode: 'percentage',
        discountPercent: '20',
        countdownEnabled: 'true',
        campaignEndsAt: '2999-01-01T00:00:00.000Z',
      }}
      items={[product]}
    />,
  )
  assert.match(futureHtml, /role="timer"/)
  assert.match(futureHtml, /Fırsatın bitmesine/)
  assert.match(futureHtml, /garsonless-discount-media/)
  assert.match(futureHtml, /garsonless-discount-offer-chip/)
  assert.match(futureHtml, /garsonless-discount-clock/)

  const mediaMarkup = futureHtml.match(/<div class="garsonless-discount-media"[\s\S]*?<\/div>/)?.[0] ?? ''
  assert.doesNotMatch(mediaMarkup, /%20 avantaj/)

  const expiredHtml = renderToStaticMarkup(
    <DiscountBadgeSection
      sectionInstanceId="discount-home"
      config={{
        productId: 'latte',
        discountMode: 'percentage',
        discountPercent: '20',
        countdownEnabled: 'true',
        campaignEndsAt: '2020-01-01T00:00:00.000Z',
      }}
      items={[product]}
    />,
  )
  assert.equal(expiredHtml, '')
})

test('malformed timed discount fails closed and does not expose an add action', () => {
  const calls: MenuItem[] = []
  const tree = DiscountBadgeSection({
    sectionInstanceId: 'discount-home',
    config: {
      productId: 'latte',
      discountMode: 'percentage',
      discountPercent: '20',
      countdownEnabled: 'true',
      campaignEndsAt: 'not-a-date',
    },
    items: [product],
    onQuickAdd: (item) => calls.push(item),
  })
  const html = renderToStaticMarkup(tree)

  assert.match(html, /configuration-required/)
  assert.match(html, /geçerli bir bitiş tarihi ve saati seçin/)
  assert.equal(findElementByClassName(tree, 'garsonless-discount-add'), null)
  assert.deepEqual(calls, [])
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
