import assert from 'node:assert/strict'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CustomSectionRenderer } from './CustomSectionRenderer'

const baseProps = { restaurantName: 'MAF Cafe Lounge' }

test('catalog hours preview reads the restaurant settings source', () => {
  const html = renderToStaticMarkup(
    <CustomSectionRenderer
      {...baseProps}
      sectionId="hours"
      renderContext="catalog"
      storeInfo={{
        hours: {
          mon: { open: '06:30', close: '21:15', active: true },
          tue: { open: '06:30', close: '21:15', active: true },
          wed: { open: '06:30', close: '21:15', active: true },
          thu: { open: '06:30', close: '21:15', active: true },
          fri: { open: '06:30', close: '21:15', active: true },
          sat: { open: '06:30', close: '21:15', active: true },
          sun: { open: '06:30', close: '21:15', active: true },
        },
      }}
    />,
  )

  assert.match(html, /data-hours-info-preview/)
  assert.match(html, /Çalışma Saatleri/)
  assert.match(html, /Bugün/)
  assert.match(html, /06:30-21:15/)
  assert.doesNotMatch(html, /09:00-23:00/)
})

test('catalog hours preview stays honest when settings have not been saved', () => {
  const html = renderToStaticMarkup(
    <CustomSectionRenderer {...baseProps} sectionId="hours" renderContext="catalog" />,
  )

  assert.match(html, /Çalışma saatleri henüz eklenmedi/)
  assert.doesNotMatch(html, /09:00-23:00/)
})

test('catalog wifi preview uses a safe representative network', () => {
  const html = renderToStaticMarkup(
    <CustomSectionRenderer {...baseProps} sectionId="wifi-info" renderContext="catalog" />,
  )

  assert.match(html, /data-wifi-info-preview/)
  assert.match(html, /Wi-Fi Bilgisi/)
  assert.match(html, /MAF Guest/)
  assert.match(html, /Şifre/)
  assert.doesNotMatch(html, /misafir2026/)
})

test('wifi preview reflects editor values while keeping the password masked', () => {
  const html = renderToStaticMarkup(
    <CustomSectionRenderer
      {...baseProps}
      sectionId="wifi-info"
      renderContext="catalog"
      config={{ networkName: 'Salon Misafir', password: 'cokgizli', note: 'Kasadan destek alabilirsiniz.' }}
    />,
  )

  assert.match(html, /Salon Misafir/)
  assert.match(html, /Kasadan destek alabilirsiniz/)
  assert.doesNotMatch(html, /cokgizli/)
})
