import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { DEFAULT_THEME, type GarsonlessTheme } from '@garsonless/design-engine'
import { DefaultMenuPage } from '../themes/default/MenuPage'
import { Header } from './Header'
import { ThemeProvider } from './ThemeContext'

Object.assign(globalThis, { React })

function renderHeader(theme: GarsonlessTheme) {
  return renderToStaticMarkup(
    React.createElement(
      ThemeProvider,
      {
        initialTheme: theme,
        initialRestaurantName: 'Masabu',
        initialLogoUrl: null,
        children: React.createElement(Header, {
          categories: [],
          memberSummary: { authenticated: false, name: null },
          onOpenMember: () => undefined,
        }),
      },
    ),
  )
}

function renderBillHeader(theme: GarsonlessTheme) {
  return renderToStaticMarkup(
    React.createElement(
      ThemeProvider,
      {
        initialTheme: theme,
        initialRestaurantName: 'Masabu',
        initialLogoUrl: null,
        children: React.createElement(Header, {
          tableId: '3e89-test-table',
          tableName: 'Masa 3E89',
          categories: [],
          billSummary: { total: 350, count: 2 },
          onOpenBill: () => undefined,
        }),
      },
    ),
  )
}

test('membership action renders on exactly the configured surface', () => {
  const drawerMarkup = renderHeader({ ...DEFAULT_THEME, memberPlacement: 'drawer' })
  assert.doesNotMatch(drawerMarkup, /aria-label="Müşteri hesabını aç"/)
  assert.match(drawerMarkup, /Hesap ve üyelik/)

  const headerMarkup = renderHeader({ ...DEFAULT_THEME, memberPlacement: 'header' })
  assert.match(headerMarkup, /aria-label="Müşteri hesabını aç"/)
  assert.doesNotMatch(headerMarkup, /Hesap ve üyelik/)

  const hiddenMarkup = renderHeader({ ...DEFAULT_THEME, memberPlacement: 'hidden' })
  assert.doesNotMatch(hiddenMarkup, /aria-label="Müşteri hesabını aç"|Hesap ve üyelik/)
})

test('Menu page resolves the scoped Header override before rendering consumers', () => {
  const theme = structuredClone(DEFAULT_THEME)
  theme.headerPreset = 'standard'
  theme.surfaces!.menu = {
    chrome: {
      header: {
        headerPreset: 'compact',
        headerHeight: 52,
        headerRadius: 12,
        headerShadow: 'soft',
        headerTextColor: '#123456',
      },
    },
  }

  const markup = renderToStaticMarkup(
    React.createElement(
      ThemeProvider,
      {
        initialTheme: theme,
        initialRestaurantName: 'Masabu',
        initialLogoUrl: null,
        children: React.createElement(DefaultMenuPage, { categories: [], renderItems: () => null }),
      },
    ),
  )

  assert.match(markup, /data-header-layout="compact"/)
  assert.match(markup, /min-height:52px/)
  assert.match(markup, /border-radius:0 0 12px 12px/)
  assert.match(markup, /color:#123456/)
  assert.match(markup, /box-shadow:0 10px 26px -22px/)
})

test('compact layout respects every configured header height', () => {
  for (const [headerHeight, expectedPadding] of [[56, 6], [64, 10], [80, 16]] as const) {
    const markup = renderHeader({
      ...DEFAULT_THEME,
      headerPreset: 'compact',
      headerHeight,
      headerPadY: 16,
    })

    assert.match(markup, new RegExp(`data-header-main[^>]+height:${headerHeight}px;min-height:${headerHeight}px`))
    assert.match(markup, new RegExp(`padding:${expectedPadding}px 16px`))
  }
})

test('header layout settings are reflected by the rendered surface', () => {
  const markup = renderHeader({
    ...DEFAULT_THEME,
    headerPreset: 'brand',
    headerStyle: 'blur',
    headerBg: '#aabbcc',
    headerTextColor: '#123456',
    headerIconColor: '#654321',
    headerHeight: 80,
    headerPadY: 12,
    headerPadX: 24,
    headerBottomGap: 18,
    headerRadius: 20,
    headerShadow: 'strong',
    headerBorder: false,
    stickyHeader: true,
    headerShowMenu: false,
  })

  assert.match(markup, /data-header-layout="brand"/)
  assert.match(markup, /color-mix\(in srgb, #aabbcc 82%, transparent\)/)
  assert.match(markup, /backdrop-filter:blur\(10px\)/)
  assert.match(markup, /color:#123456/)
  assert.match(markup, /position:sticky/)
  assert.match(markup, /height:80px;min-height:80px/)
  assert.match(markup, /padding:12px 24px/)
  assert.match(markup, /margin-bottom:18px/)
  assert.match(markup, /border-radius:0 0 20px 20px/)
  assert.match(markup, /box-shadow:0 16px 38px -22px/)
  assert.match(markup, /border-bottom:none/)
  assert.doesNotMatch(markup, /aria-label="Menüyü aç"/)

  const iconMarkup = renderHeader({ ...DEFAULT_THEME, headerShowMenu: true, headerIconColor: '#654321' })
  assert.match(iconMarkup, /aria-label="Menüyü aç"[^>]+color:#654321/)
})

test('bill action keeps a 44px target with a compact visual pill', () => {
  const markup = renderBillHeader({
    ...DEFAULT_THEME,
    billPlacement: 'header',
    headerShowContextBar: true,
  })

  assert.match(markup, /data-header-bill-action="true"[^>]+height:44px/)
  assert.match(markup, /data-header-bill-pill="true"[^>]+height:32px/)
  assert.match(markup, /Hesap · ₺350,00/)
})
