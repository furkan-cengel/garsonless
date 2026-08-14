import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const processFlow = readFileSync(new URL('./ProcessFlowSection.tsx', import.meta.url), 'utf8')
const dialog = readFileSync(new URL('./SupademoDialog.tsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')

const interactivePoster = processFlow.slice(
  processFlow.indexOf('function InteractiveProcessPoster'),
  processFlow.indexOf('function PaymentCartPoster'),
)
const iframeStyles = styles.slice(
  styles.indexOf('.process-poster__image iframe {'),
  styles.indexOf('.process-poster__image iframe[data-ready="true"]'),
)
const loadingStyles = styles.slice(
  styles.indexOf('.process-poster__loading {'),
  styles.indexOf('.process-poster__loading--error'),
)

test('interactive Supademo frames never render a poster image underneath the iframe', () => {
  assert.doesNotMatch(interactivePoster, /<Image\b/)
  assert.doesNotMatch(styles, /process-poster__fallback/)
  assert.match(interactivePoster, /process-poster__loading/)
})

test('Supademo loading and transparent iframe regions use opaque neutral surfaces', () => {
  assert.match(iframeStyles, /background: #fff;/)
  assert.match(loadingStyles, /background: #f7f9f8;/)
  assert.doesNotMatch(loadingStyles, /rgba\(|transparent/)
})

test('dialog posters render only for non-interactive previews', () => {
  assert.match(dialog, /\{!demoUrl && \([\s\S]*?<Image/)
  assert.match(dialog, /Etkileşimli tur yüklenemedi\. Lütfen daha sonra tekrar deneyin\./)
  assert.doesNotMatch(dialog, /Gerçek ürün ekranı gösteriliyor/)
})
