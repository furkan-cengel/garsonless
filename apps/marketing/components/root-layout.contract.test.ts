import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const layout = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8')

test('root layout keeps authored scripts behind typed component boundaries', () => {
  assert.match(layout, /<FocusModalityScript \/>/)
  assert.match(layout, /<WebVitalsReporter/)
  assert.doesNotMatch(layout, /dangerouslySetInnerHTML|<script/)
  assert.doesNotMatch(layout, /history\.scrollRestoration|window\.scrollTo/)
})
