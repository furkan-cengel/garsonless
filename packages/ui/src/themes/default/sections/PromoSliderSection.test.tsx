import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PromoSliderBlock, formatPromoCampaignCountdown } from './PromoSliderSection'
import type { PromoSliderCampaign } from './promoSliderCampaignModel'

test('campaign countdown formatter keeps a stable HH:MM:SS shape', () => {
  const now = Date.parse('2026-07-25T12:00:00.000Z')
  const expiresAt = Date.parse('2026-07-25T13:02:46.000Z')
  assert.equal(formatPromoCampaignCountdown(expiresAt, now), '01:02:46')
  assert.equal(formatPromoCampaignCountdown(now - 1, now), '00:00:00')
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
  assert.match(html, /Americano \+ Serpme Kahvaltı/)
  assert.match(html, /-webkit-line-clamp:2/)
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
        comboEnabled: 'false',
      }}
    />,
  )

  assert.match(html, /Tatlılarda/)
  assert.match(html, /2 al 1 öde/)
  assert.match(html, /garsonless-active-campaign-timer/)
  assert.match(html, /Fırsat bitiyor/)
  assert.match(html, /\d{2}:\d{2}:\d{2}/)
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
        comboEnabled: 'false',
      }}
    />,
  )

  assert.doesNotMatch(html, /Fırsat bitiyor/)
  assert.doesNotMatch(html, /garsonless-active-campaign-timer/)
})
