import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PromoSliderBlock, formatPromoCampaignCountdown, resolvePromoSliderResizeScrollLeft } from './PromoSliderSection'
import type { PromoSliderCampaign } from './promoSliderCampaignModel'
import type { MenuItem } from '../../../menu/types'

function menuItem(id: string, name: string, price: number, position: number): MenuItem {
  return {
    id,
    category_id: 'coffee',
    name,
    description: `${name} açıklaması`,
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
    is_available: true,
    position,
  }
}

test('campaign countdown formatter keeps a stable HH:MM:SS shape', () => {
  const now = Date.parse('2026-07-25T12:00:00.000Z')
  const expiresAt = Date.parse('2026-07-25T13:02:46.000Z')
  assert.equal(formatPromoCampaignCountdown(expiresAt, now), '01:02:46')
  assert.equal(formatPromoCampaignCountdown(now - 1, now), '00:00:00')
})

test('resize observer never rewrites scroll position during a slider transition', () => {
  assert.equal(resolvePromoSliderResizeScrollLeft({ programmatic: true, position: 1, slideCount: 4, width: 320 }), null)
  assert.equal(resolvePromoSliderResizeScrollLeft({ programmatic: false, position: 1, slideCount: 4, width: 320 }), 320)
  assert.equal(resolvePromoSliderResizeScrollLeft({ programmatic: false, position: 4, slideCount: 4, width: 320 }), 0)
})

test('active campaign cards expose countdown state and preserve long combo titles', () => {
  const expiresAtMs = Date.now() + 3_600_000
  const campaigns: PromoSliderCampaign[] = [
    {
      id: 'daily',
      sectionInstanceId: 'daily',
      kind: 'daily-special',
      sourceLabel: 'Günün Özeli',
      title: 'Menemen',
      subtitle: 'Domates, biber, yumurta',
      badge: 'GÜNÜN ÖZELİ',
      imageUrl: '',
      price: 129,
      oldPrice: 180,
      backgroundColor: '#fdf6ec',
      accentColor: '#a13b7a',
      textColor: '#1c2618',
      allergens: ['milk'],
      hasCrossContact: false,
      expiresAtMs,
      countdownLabel: 'Son saatler',
    },
    {
      id: 'combo',
      sectionInstanceId: 'combo',
      kind: 'combo-ribbon',
      sourceLabel: 'Kombo Şerit',
      title: 'Americano + Serpme Kahvaltı',
      subtitle: '2 ürün birlikte',
      badge: '2 ÜRÜN',
      imageUrl: '',
      price: 435,
      backgroundColor: '#ee6c4d',
      accentColor: '#e86b3d',
      textColor: '#ffffff',
      allergens: [],
      hasCrossContact: true,
    },
  ]

  const html = renderToStaticMarkup(
    <PromoSliderBlock config={{ sourceMode: 'active', autoplay: 'false' }} activeCampaigns={campaigns} />,
  )

  assert.match(html, /data-campaign-kind="daily-special"/)
  assert.match(html, /data-has-countdown="true"/)
  assert.match(html, /Son saatler/)
  assert.match(html, /data-campaign-kind="combo-ribbon"/)
  assert.match(html, /Kombo Şerit/)
  assert.match(html, /Americano \+ Serpme Kahvaltı/)
  assert.match(html, /-webkit-line-clamp:2/)
  assert.match(html, /garsonless-active-campaign-title[^>]+font-family:var\(--p-display\)/)
})

test('legacy source modes no longer hide active campaigns or a selected real coupon card', () => {
  const campaign: PromoSliderCampaign = {
    id: 'daily', sectionInstanceId: 'daily', kind: 'daily-special', sourceLabel: 'Günün Özeli',
    title: 'Menemen', subtitle: 'Bugünün seçimi', badge: 'GÜNÜN ÖZELİ', imageUrl: '', price: 129,
    backgroundColor: '#fdf6ec', accentColor: '#a13b7a', textColor: '#1c2618', allergens: [], hasCrossContact: false,
  }

  for (const sourceMode of ['active', 'manual', 'mixed'] as const) {
    const html = renderToStaticMarkup(<PromoSliderBlock
      config={{ sourceMode, autoplay: 'false', couponEnabled: 'true', couponId: 'coupon-live', couponCode: 'HOSGELDIN25', flashEnabled: 'false', freebieEnabled: 'false', loyaltyEnabled: 'false' }}
      activeCampaigns={[campaign]}
    />)
    assert.match(html, /data-campaign-kind="daily-special"/)
    assert.match(html, /HOSGELDIN25/)
  }
})

test('an enabled legacy coupon without a real coupon selection is not published', () => {
  const html = renderToStaticMarkup(<PromoSliderBlock config={{ sourceMode: 'manual', couponEnabled: 'true', flashEnabled: 'false', freebieEnabled: 'false', loyaltyEnabled: 'false' }} />)
  assert.doesNotMatch(html, /HOSGELDIN25/)
})

test('manual flash cards use the canonical live campaign countdown', () => {
  const endsAt = new Date(Date.now() + 3_600_000).toISOString()
  const html = renderToStaticMarkup(
    <PromoSliderBlock
      config={{
        sourceMode: 'manual',
        autoplay: 'false',
        couponEnabled: 'false',
        flashEnabled: 'true',
        flashTitle: 'Tatlılarda',
        flashAccentText: '2 al 1 öde',
        flashCountdownEnabled: 'true',
        flashCampaignEndsAt: endsAt,
        flashCountdownLabel: 'Fırsat bitiyor',
        freebieEnabled: 'false',
        loyaltyEnabled: 'false',
      }}
    />,
  )

  assert.match(html, /Tatlılarda/)
  assert.match(html, /2 al 1 öde/)
  assert.match(html, /garsonless-active-campaign-timer/)
  assert.match(html, /Fırsat bitiyor/)
  assert.match(html, /\d{2}:\d{2}:\d{2}/)
  assert.match(html, /font-family:var\(--p-display\)[^>]*>Tatlılarda/)
})

test('expired manual flash cards retire from the slider without a page refresh', () => {
  const html = renderToStaticMarkup(
    <PromoSliderBlock
      config={{
        sourceMode: 'manual',
        autoplay: 'false',
        couponEnabled: 'false',
        flashEnabled: 'true',
        flashCountdownEnabled: 'true',
        flashCampaignEndsAt: new Date(Date.now() - 1_000).toISOString(),
        flashCountdownLabel: 'Fırsat bitiyor',
        freebieEnabled: 'false',
        loyaltyEnabled: 'false',
      }}
    />,
  )

  assert.doesNotMatch(html, /Fırsat bitiyor/)
  assert.doesNotMatch(html, /garsonless-active-campaign-timer/)
})

test('empty sliders stay hidden publicly and explain the missing setup in editor preview', () => {
  const config = {
    sourceMode: 'active',
    autoplay: 'false',
  }
  const publicMarkup = renderToStaticMarkup(<PromoSliderBlock config={config} />)
  assert.doesNotMatch(publicMarkup, /data-promo-slider-empty/)
  assert.doesNotMatch(publicMarkup, /garsonless-active-campaign-slide/)
  const editor = renderToStaticMarkup(<PromoSliderBlock config={config} editorPreview />)
  assert.match(editor, /data-promo-slider-empty="true"/)
  assert.match(editor, /Gösterilecek kampanya yok/)
})

test('manual promo actions render only when their target can run', () => {
  const base = {
    sourceMode: 'manual',
    autoplay: 'false',
    couponEnabled: 'false',
    flashEnabled: 'false',
    freebieEnabled: 'true',
    freebieTitle: 'Kahve yanında kurabiye',
    freebieTargetType: 'category',
    freebieCategoryId: 'coffee',
    freebieCtaText: 'Kahvelere git',
    loyaltyEnabled: 'false',
  }
  assert.doesNotMatch(renderToStaticMarkup(<PromoSliderBlock config={base} />), /Kahvelere git/)
  assert.match(renderToStaticMarkup(<PromoSliderBlock config={base} onSelectCategory={() => undefined} />), /Kahvelere git/)
})

test('authenticated loyalty renders the promotional card front and a working account action', () => {
  const html = renderToStaticMarkup(<PromoSliderBlock
    config={{
      sourceMode: 'manual', autoplay: 'false', couponEnabled: 'false', flashEnabled: 'false',
      freebieEnabled: 'false', loyaltyEnabled: 'true', loyaltyCtaText: 'Sadakat hesabımı aç',
    }}
    restaurantName="MAF Cafe Lounge"
    memberLoyalty={{
      filled: 0,
      total: 10,
      points: 1280,
      pointsEnabled: true,
      stampsEnabled: false,
      tierName: 'Altın',
    }}
    onOpenMember={() => undefined}
  />)
  assert.match(html, /data-component="promo-loyalty-front"/)
  assert.match(html, /MAF Cafe Lounge/)
  assert.match(html, /Sadakat kartın hazır/)
  assert.match(html, /Sadakat hesabımı aç/)
  assert.doesNotMatch(html, /data-loyalty-stamp-grid/)
})

test('guest loyalty card uses the join-oriented call to action', () => {
  const html = renderToStaticMarkup(<PromoSliderBlock
    config={{ sourceMode: 'manual', autoplay: 'false', couponEnabled: 'false', flashEnabled: 'false', freebieEnabled: 'false', loyaltyEnabled: 'true' }}
    restaurantName="MAF Cafe Lounge"
    onOpenMember={() => undefined}
  />)
  assert.match(html, /Üyelere özel kahve ödülü/)
  assert.match(html, /Üye ol ve kazan/)
  assert.match(html, /9 kahve al, 1 kahve bizden/)
})

test('legacy manual combo settings no longer create a duplicate slider card', () => {
  const html = renderToStaticMarkup(<PromoSliderBlock
    config={{
      sourceMode: 'manual',
      autoplay: 'false',
      couponEnabled: 'false',
      flashEnabled: 'false',
      freebieEnabled: 'false',
      loyaltyEnabled: 'false',
      comboEnabled: 'true',
      comboTitle: 'Eski manuel kombo',
    }}
  />)
  assert.doesNotMatch(html, /Eski manuel kombo/)
  assert.doesNotMatch(html, /garsonless-promo-slider/)
})

test('manual flash 2 al 1 öde exposes only merchant-selected live products and the pair total', () => {
  const items = [
    menuItem('cake', 'Çikolatalı Pasta', 195, 1),
    menuItem('brownie', 'Brownie', 185, 2),
    menuItem('burger', 'Burger', 240, 3),
  ]
  const html = renderToStaticMarkup(<PromoSliderBlock
    sectionInstanceId="slider-home"
    config={{
      sourceMode: 'manual',
      autoplay: 'false',
      couponEnabled: 'false',
      flashEnabled: 'true',
      flashOfferType: 'buy-2-pay-1',
      flashItem1Id: 'cake',
      flashItem2Id: 'brownie',
      freebieEnabled: 'false',
      loyaltyEnabled: 'false',
    }}
    items={items}
    onQuickAdd={() => undefined}
  />)
  assert.match(html, /2 al 1 öde kampanya ürünü/)
  assert.match(html, /data-component="promo-flash-product-selector"/)
  assert.match(html, /position:absolute;inset:0;width:100%;height:100%/)
  assert.match(html, /Çikolatalı Pasta/)
  assert.match(html, /Brownie/)
  assert.doesNotMatch(html, />Burger</)
  assert.match(html, /data-component="promo-flash-offer-panel"/)
  assert.match(html, /KAMPANYA ÜRÜNÜ/)
  assert.match(html, /2 ÜRÜN · TEK FİYAT/)
  assert.match(html, /₺195,00/)
  assert.match(html, /data-component="promo-flash-pair-action"/)
})

test('manual flash uses a static product label when only one unique product is eligible', () => {
  const cheesecake = menuItem('cheesecake', 'Cheesecake', 185, 1)
  const html = renderToStaticMarkup(<PromoSliderBlock
    sectionInstanceId="slider-home"
    config={{
      sourceMode: 'manual',
      autoplay: 'false',
      couponEnabled: 'false',
      flashEnabled: 'true',
      flashOfferType: 'buy-2-pay-1',
      flashItem1Id: 'cheesecake',
      flashItem2Id: 'cheesecake',
      freebieEnabled: 'false',
      loyaltyEnabled: 'false',
    }}
    items={[cheesecake]}
    onQuickAdd={() => undefined}
  />)

  assert.match(html, /data-component="promo-flash-static-product"/)
  assert.match(html, /Cheesecake/)
  assert.doesNotMatch(html, /<select[^>]*garsonless-promo-flash-select/)
  assert.doesNotMatch(html, /2 al 1 öde kampanya ürünü/)
})

test('functional freebie card uses live products, configured media layout and a real CTA', () => {
  const latte = { ...menuItem('latte', 'Latte', 120, 1), images: ['https://example.test/latte.webp'] }
  const cake = { ...menuItem('cake', 'Tiramisu', 195, 2), category_id: 'dessert', images: ['https://example.test/tiramisu.webp'] }
  const html = renderToStaticMarkup(<PromoSliderBlock
    sectionInstanceId="slider-home"
    config={{
      sourceMode: 'manual', autoplay: 'false', couponEnabled: 'false', flashEnabled: 'false', loyaltyEnabled: 'false',
      freebieEnabled: 'true', freebieOfferType: 'gift-with-purchase', freebieQualifierMode: 'category', freebieQualifierCategoryId: 'coffee', freebieRewardItem1Id: 'cake',
      freebieImageSource: 'reward', freebieLayout: 'split', freebieImageFit: 'cover', freebieImagePosition: 'top', freebieCtaText: 'Hediyeni seç',
    }}
    items={[latte, cake]}
    onAddFreebie={() => undefined}
  />)
  assert.match(html, /data-component="promo-freebie-slide"/)
  assert.match(html, /data-layout="split"/)
  assert.match(html, /data-component="promo-freebie-media"/)
  assert.match(html, /data-component="promo-freebie-content"/)
  assert.match(html, /tiramisu\.webp/)
  assert.match(html, /Tiramisu/)
  assert.match(html, /Hediyeni seç/)
  assert.match(html, /white-space:nowrap/)
  const defaultCta = renderToStaticMarkup(<PromoSliderBlock
    sectionInstanceId="slider-home"
    config={{ sourceMode: 'manual', autoplay: 'false', couponEnabled: 'false', flashEnabled: 'false', loyaltyEnabled: 'false', freebieEnabled: 'true', freebieOfferType: 'gift-with-purchase', freebieQualifierMode: 'category', freebieQualifierCategoryId: 'coffee', freebieRewardItem1Id: 'cake' }}
    items={[latte, cake]}
    onAddFreebie={() => undefined}
  />)
  assert.match(defaultCta, /Kahveni ve hediyeni seç/)
  assert.doesNotMatch(renderToStaticMarkup(<PromoSliderBlock config={{ sourceMode: 'manual', couponEnabled: 'false', flashEnabled: 'false', loyaltyEnabled: 'false', freebieEnabled: 'true', freebieOfferType: 'gift-with-purchase', freebieQualifierMode: 'category', freebieQualifierCategoryId: 'coffee', freebieRewardItem1Id: 'cake' }} items={[latte, cake]} />), /promo-freebie-slide/)
})
