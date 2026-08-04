import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_THEME } from './schema'
import { inspectCheckoutSurfaceContrast, resolveCheckoutSurfacePalette } from './checkout-surface-policy'

test('legacy checkout palette stays publishable until a semantic pair is customized', () => {
  assert.deepEqual(inspectCheckoutSurfaceContrast(DEFAULT_THEME), [])
  const palette = resolveCheckoutSurfacePalette(DEFAULT_THEME)
  assert.equal(palette.background, DEFAULT_THEME.bg)
  assert.equal(palette.surface, DEFAULT_THEME.cardColor)
  assert.equal(palette.cta, DEFAULT_THEME.cta)
})

test('custom checkout surface and icon pairs are checked for critical contrast', () => {
  const theme = {
    ...DEFAULT_THEME,
    surfaces: {
      ...DEFAULT_THEME.surfaces!,
      checkout: {
        ...DEFAULT_THEME.surfaces!.checkout,
        override: {
          surface: '#ffffff',
          text: '#eeeeee',
          mutedText: '#dddddd',
          fieldSurface: '#ffffff',
          fieldBorder: '#f5f5f5',
          cta: '#ffffff',
          ctaText: '#f0f0f0',
        },
        states: {
          success: { iconColor: '#777777', iconBackground: '#787878' },
          tablePayment: { iconColor: '#999999', iconBackground: '#999999' },
          error: { iconColor: '#aaaaaa', iconBackground: '#aaaaaa' },
        },
      },
    },
  }

  assert.deepEqual(inspectCheckoutSurfaceContrast(theme).map((issue) => issue.id), [
    'primary-text', 'secondary-text', 'input-text', 'input-border', 'cta',
    'success-icon', 'table-icon', 'error-icon',
  ])
})
