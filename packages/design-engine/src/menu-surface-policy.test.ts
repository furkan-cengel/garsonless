import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveHomeChromeTheme } from './home-surface-policy'
import { inspectMenuHeaderContrast, resolveMenuHeaderTheme } from './menu-surface-policy'
import { DEFAULT_THEME } from './schema'
import { sanitizeThemeTokens } from './theme-policy'

test('menu header override is isolated from the Home header', () => {
  const theme = structuredClone(DEFAULT_THEME)
  theme.headerLogoSize = 40
  theme.headerBottomGap = 18
  theme.surfaces!.menu = {
    chrome: { header: { headerLogoSize: 72, headerBottomGap: 10 } },
  }

  const menuHeader = resolveMenuHeaderTheme(theme)
  const homeHeader = resolveHomeChromeTheme(theme, 'header')

  assert.equal(menuHeader.headerLogoSize, 72)
  assert.equal(menuHeader.headerBottomGap, 10)
  assert.equal(homeHeader.headerLogoSize, 40)
  assert.equal(homeHeader.headerBottomGap, 0)
  assert.equal(theme.headerLogoSize, 40)
})

test('legacy themes keep flat Header fields until a Menu override exists', () => {
  const theme = structuredClone(DEFAULT_THEME)
  theme.headerHeight = 80

  assert.equal(resolveMenuHeaderTheme(theme), theme)
  assert.equal(resolveMenuHeaderTheme(theme).headerHeight, 80)
})

test('sanitizer keeps only allowlisted Menu Header fields', () => {
  const sanitized = sanitizeThemeTokens({
    surfaces: {
      ...DEFAULT_THEME.surfaces,
      menu: {
        chrome: {
          header: {
            headerHeight: 76,
            headerBg: '#123456',
            headerTextColor: '#234567',
            headerIconColor: '#345678',
            headerLogoFit: 'cover',
            headerLogoMaxWidth: 999,
            headerRadius: 99,
            headerShadow: 'strong',
            bg: '#000000',
            sections: ['request-buttons'],
          },
        },
      },
    },
  }, 'default')

  assert.deepEqual(sanitized?.surfaces?.menu?.chrome?.header, {
    headerBg: '#123456',
    headerTextColor: '#234567',
    headerIconColor: '#345678',
    headerHeight: 76,
    headerLogoFit: 'cover',
    headerLogoMaxWidth: 320,
    headerRadius: 40,
    headerShadow: 'strong',
  })
})

test('Menu Header contrast follows the resolved Menu-only colors', () => {
  assert.deepEqual(inspectMenuHeaderContrast(DEFAULT_THEME), [])
  const theme = structuredClone(DEFAULT_THEME)
  theme.surfaces!.menu = {
    chrome: {
      header: {
        headerBg: '#ffffff',
        headerTextColor: '#eeeeee',
        headerIconColor: '#eeeeee',
      },
    },
  }

  assert.deepEqual(inspectMenuHeaderContrast(theme).map((issue) => issue.id), [
    'header-text',
    'header-icon',
    'header-control-icon',
  ])

  theme.surfaces!.menu.chrome!.header = {
    headerBg: '#ffffff',
    headerTextColor: '#111111',
    headerIconColor: '#111111',
  }
  assert.deepEqual(inspectMenuHeaderContrast(theme), [])
})
