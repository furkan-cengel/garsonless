import assert from 'node:assert/strict'
import test from 'node:test'
import { inspectAuthSurfaceContrast, resolveAuthSurfacePalette } from './auth-surface-policy'
import { DEFAULT_THEME } from './schema'

test('varsayılan giriş paleti yayınlanabilir kontrast sağlar', () => {
  assert.deepEqual(inspectAuthSurfaceContrast(DEFAULT_THEME), [])
})

test('kritik auth kontrast çiftlerini ayrı ayrı raporlar', () => {
  const theme = {
    ...DEFAULT_THEME,
    surfaces: {
      ...DEFAULT_THEME.surfaces!,
      auth: {
        ...DEFAULT_THEME.surfaces!.auth,
        override: {
          surface: '#ffffff',
          text: '#eeeeee',
          mutedText: '#dddddd',
          fieldSurface: '#ffffff',
          fieldBorder: '#f5f5f5',
          cta: '#ffffff',
          ctaText: '#f0f0f0',
        },
      },
    },
  }
  assert.deepEqual(inspectAuthSurfaceContrast(theme).map((issue) => issue.id), [
    'primary-text', 'secondary-text', 'input-text', 'input-border', 'cta',
  ])
})

test('auth paleti yeni alanları ortak temadan güvenli varsayılanlarla çözer', () => {
  const palette = resolveAuthSurfacePalette(DEFAULT_THEME)
  assert.equal(palette.fieldSurface, '#25262a')
  assert.equal(palette.fieldBorder, '#707279')
  assert.equal(palette.accent, DEFAULT_THEME.accent)
})

test('durum ikonu ve zemini arasındaki düşük kontrastı yayınlama sorunu olarak raporlar', () => {
  const theme = {
    ...DEFAULT_THEME,
    surfaces: {
      ...DEFAULT_THEME.surfaces!,
      auth: {
        ...DEFAULT_THEME.surfaces!.auth,
        states: {
          success: { iconColor: '#777777', iconBackground: '#787878' },
          error: { iconColor: '#999999', iconBackground: '#999999' },
        },
      },
    },
  }
  assert.deepEqual(inspectAuthSurfaceContrast(theme).map((issue) => issue.id), ['success-icon', 'error-icon'])
})
