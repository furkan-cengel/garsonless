import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { normalizeProgress } from './spinner-model'

const componentSource = readFileSync(new URL('./index.tsx', import.meta.url), 'utf8')
const cssSource = readFileSync(new URL('./spinners.module.css', import.meta.url), 'utf8')

test('progress normalization is finite, rounded and clamped', () => {
  assert.equal(normalizeProgress(Number.NaN), 0)
  assert.equal(normalizeProgress(Number.POSITIVE_INFINITY), 0)
  assert.equal(normalizeProgress(-12), 0)
  assert.equal(normalizeProgress(52.6), 53)
  assert.equal(normalizeProgress(140), 100)
})

test('inline spinner is decorative and loading status owns announcements', () => {
  assert.match(componentSource, /<svg aria-hidden="true" focusable="false"/)
  assert.match(componentSource, /export function LoadingStatus/)
  assert.match(componentSource, /role="status"/)
  assert.match(componentSource, /aria-live="polite"/)
  assert.match(componentSource, /aria-atomic="true"/)
})

test('BrewBar exposes determinate progress semantics', () => {
  assert.match(componentSource, /role="progressbar"/)
  assert.match(componentSource, /aria-label=\{label\}/)
  assert.match(componentSource, /aria-valuemin=\{0\}/)
  assert.match(componentSource, /aria-valuenow=\{normalized\}/)
})

test('shared spinner animations stop for reduced motion', () => {
  assert.match(cssSource, /prefers-reduced-motion:\s*reduce/)
  assert.match(cssSource, /animation:\s*none\s*!important/)
  assert.match(cssSource, /transition:\s*none\s*!important/)
})
