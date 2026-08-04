import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CustomSectionRenderer } from '../themes/default/sections/CustomSectionRenderer'

test('home promo strip never invents secondary campaign copy', () => {
  const markup = renderToStaticMarkup(createElement(CustomSectionRenderer, {
    sectionId: 'promo-strip',
    sectionInstanceId: 'home-promo',
    config: { title: 'Bugün açığız' },
    renderContext: 'home',
    menuHref: '/test-cafe/menu',
    restaurantName: 'Test Cafe',
  }))

  assert.match(markup, /Bugün açığız/)
  assert.doesNotMatch(markup, /BUGÜNE ÖZEL|MASADAN HIZLI SİPARİŞ/)
})

test('ayrı Video Hero poster-first render edilir ve güvenli Menü CTA hedefini korur', () => {
  const markup = renderToStaticMarkup(createElement(CustomSectionRenderer, {
    sectionId: 'storefront-video-hero',
    sectionInstanceId: 'home-video',
    config: {
      videoUrl: 'https://assets.example/hero.webm',
      posterUrl: 'https://assets.example/hero.webp',
      title: 'Hoş geldiniz',
    },
    renderContext: 'home',
    menuHref: '/test-cafe/menu',
    restaurantName: 'Test Cafe',
  }))

  assert.match(markup, /hero\.webp/)
  assert.doesNotMatch(markup, /<video/)
  assert.match(markup, /href="\/test-cafe\/menu"/)
})

test('Video Hero içerik katmanları bağımsız gizlenir ve taşmayan yüzde konumu uygulanır', () => {
  const markup = renderToStaticMarkup(createElement(CustomSectionRenderer, {
    sectionId: 'storefront-video-hero',
    sectionInstanceId: 'home-video-positioned',
    config: {
      showStatus: 'false',
      showEyebrow: 'false',
      showTitle: 'false',
      showBody: 'false',
      showCta: 'false',
      contentPositionX: '75',
      contentPositionY: '20',
      align: 'right',
    },
    renderContext: 'home',
    menuHref: '/test-cafe/menu',
    restaurantName: 'Gizli başlık',
    storeStatus: 'Şu an açık',
  }))

  assert.match(markup, /data-position-x="75"/)
  assert.match(markup, /data-position-y="20"/)
  assert.match(markup, /left:75%;top:20%/)
  assert.match(markup, /transform:translate\(-75%,-20%\)/)
  assert.match(markup, /text-align:right/)
  assert.doesNotMatch(markup, /Gizli başlık|Şu an açık|HOŞ GELDİNİZ|Menüyü Gör/)
})
