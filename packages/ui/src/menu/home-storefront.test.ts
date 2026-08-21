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

test('ayrı Video Hero poster-first render edilir ve tekrar eden Menü CTA üretmez', () => {
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
  assert.doesNotMatch(markup, /href="\/test-cafe\/menu"|Menüyü Gör/)
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
    storeStatus: { label: 'Şu an açık', tone: 'open' },
  }))

  assert.match(markup, /data-position-x="75"/)
  assert.match(markup, /data-position-y="20"/)
  assert.match(markup, /left:75%;top:20%/)
  assert.match(markup, /transform:translate\(-75%,-20%\)/)
  assert.match(markup, /text-align:right/)
  assert.doesNotMatch(markup, /Gizli başlık|Şu an açık|HOŞ GELDİNİZ|Menüyü Gör/)
})

test('modern Video Hero publicte eksik medyayla render edilmez, editörde kurulum durumu gösterir', () => {
  const publicMarkup = renderToStaticMarkup(createElement(CustomSectionRenderer, {
    sectionId: 'storefront-video-hero',
    config: { editorialVersion: '2', posterUrl: 'https://assets.example/poster.webp' },
    renderContext: 'home',
    restaurantName: 'Test Cafe',
  }))
  const editorMarkup = renderToStaticMarkup(createElement(CustomSectionRenderer, {
    sectionId: 'storefront-video-hero',
    config: { editorialVersion: '2', posterUrl: 'https://assets.example/poster.webp' },
    renderContext: 'home',
    restaurantName: 'Test Cafe',
    editorPreview: true,
  }))

  assert.equal(publicMarkup, '')
  assert.match(editorMarkup, /Video eksik/)
  assert.match(editorMarkup, /data-video-hero-state="video-missing"/)
})

test('modern Video Hero poster-first SSR ve 3x3 yerleşim kullanır', () => {
  const markup = renderToStaticMarkup(createElement(CustomSectionRenderer, {
    sectionId: 'storefront-video-hero',
    config: {
      editorialVersion: '2',
      videoUrl: 'https://assets.example/hero.webm',
      posterUrl: 'https://assets.example/hero.webp',
      contentPlacement: 'bottom-right',
      title: 'Uzun Türkçe Video Hero Başlığı',
    },
    renderContext: 'home',
    menuHref: '/test-cafe/menu',
    restaurantName: 'Test Cafe',
  }))

  assert.match(markup, /data-video-hero-version="2"/)
  assert.match(markup, /data-placement="bottom-right"/)
  assert.match(markup, /hero\.webp/)
  assert.match(markup, /Sonraki bölümü keşfet|Keşfet/)
  assert.doesNotMatch(markup, /<video/)
  assert.doesNotMatch(markup, /Menüyü Gör/)
})

test('Video Hero katalog kartı tema verisine sahte URL yazmadan örnek önizleme üretir', () => {
  const markup = renderToStaticMarkup(createElement(CustomSectionRenderer, {
    sectionId: 'storefront-video-hero',
    config: {},
    renderContext: 'catalog',
    restaurantName: 'Örnek Mekan',
    catalogPreview: true,
  }))
  assert.match(markup, /Örnek video/)
  assert.match(markup, /data-video-hero-state="catalog"/)
  assert.doesNotMatch(markup, /(?:src|poster)="https?:\/\//)
})
