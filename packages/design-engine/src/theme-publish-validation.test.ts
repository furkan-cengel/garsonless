import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_THEME } from './schema'
import { sanitizeThemeTokens } from './theme-policy'
import { inspectThemePublishContrast } from './theme-publish-validation'

test('shared publication contract accepts the default palette across all eight groups', () => {
  const groups = inspectThemePublishContrast(DEFAULT_THEME)
  assert.equal(Object.keys(groups).length, 8)
  assert.deepEqual(Object.values(groups).flat(), [])
})

test('a header-only violation survives server sanitization and blocks the shared contract', () => {
  const theme = structuredClone(DEFAULT_THEME)
  theme.surfaces!.menu = { chrome: { header: { headerBg: '#ffffff', headerTextColor: '#eeeeee', headerIconColor: '#eeeeee' } } }
  const sanitized = sanitizeThemeTokens(theme, 'default')
  assert.ok(sanitized)
  const groups = inspectThemePublishContrast(sanitized)
  assert.equal(groups.menuHeaderContrastIssues.length, 3)
  assert.ok(groups.menuHeaderContrastIssues.every((issue) => issue.ratio < issue.minimum))
  for (const [key, issues] of Object.entries(groups)) {
    if (key !== 'menuHeaderContrastIssues') assert.deepEqual(issues, [])
  }
  assert.deepEqual(inspectThemePublishContrast(theme), groups)
})
