import assert from 'node:assert/strict'
import test from 'node:test'
import { TEMPLATES } from './templates'
import { normalizeThemeTemplateId, resolveTheme, sanitizeThemeTokens } from './theme-policy'

test('retired template ids normalize to the canonical menu while preserving safe tenant tokens', () => {
  const resolved = resolveTheme({
    settings: { active_template_id: 'spain' },
    themeTokens: {
      __template_id: 'spain',
      accent: '#123456',
      bodyFont: 'Inter',
      cardVariant: 'spain',
    },
  })

  assert.equal(normalizeThemeTemplateId('spain'), 'default')
  assert.equal(resolved.templateId, 'default')
  assert.equal(resolved.theme.accent, '#123456')
  assert.equal(resolved.theme.bodyFont, 'Inter')
  assert.equal(Object.hasOwn(resolved.theme, 'cardVariant'), false)
})

test('theme sanitizer rejects CSS-shaped values and keeps canonical fallbacks', () => {
  const sanitized = sanitizeThemeTokens({
    accent: 'var(--stolen)',
    bodyFont: 'Inter; background:red',
    cols: 99,
  }, 'default')

  assert.ok(sanitized)
  assert.equal(sanitized.accent, TEMPLATES.default!.accent)
  assert.equal(sanitized.bodyFont, TEMPLATES.default!.bodyFont)
  assert.equal(sanitized.cols, 4)
})
