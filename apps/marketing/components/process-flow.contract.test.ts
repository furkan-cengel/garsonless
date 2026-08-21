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
const mobileStyles = styles.slice(styles.indexOf('@media (max-width: 700px) {'))

test('interactive Supademo loads automatically when its step becomes visible', () => {
  assert.doesNotMatch(interactivePoster, /<Image/)
  assert.match(interactivePoster, /\{visible && !frameFailed && \([\s\S]*?<iframe/)
  assert.doesNotMatch(interactivePoster, /started|masabu:supademo-consent|Etkileşimli demoyu başlat/)
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

test('mobile process connectors join each preview to the next step without clipping labels', () => {
  assert.match(mobileStyles, /\.process-connector \{[\s\S]*?width: 100%;[\s\S]*?overflow: visible;/)
  assert.match(processFlow, /data-process-connector=\{index\}/)
  assert.match(processFlow, /M 50 0 V 26 C 50 39 43 48 31 48/)
  assert.match(mobileStyles, /\.process-connector__path path \{[\s\S]*?stroke-linecap: round;[\s\S]*?stroke-linejoin: round;/)
  assert.match(mobileStyles, /\.process-connector__path \.process-connector__track \{[\s\S]*?stroke: rgba\(47, 138, 96, \.09\);/)
  assert.match(mobileStyles, /\.process-connector__path \.process-connector__progress \{[\s\S]*?stroke-dasharray: 100;[\s\S]*?stroke-dashoffset: 100;/)
  assert.match(mobileStyles, /\.process-connector span \{[\s\S]*?max-width: calc\(100% - 72px\);[\s\S]*?background: var\(--story-bg\);[\s\S]*?text-transform: uppercase;/)
  assert.doesNotMatch(mobileStyles, /\.process-connector \{\s*width: 48px;/)
  assert.match(processFlow, /threshold: mobileViewport\.matches \? 0\.08 : 0\.3/)
  assert.match(processFlow, /\{ threshold: 0\.2, rootMargin: '0px 0px -8% 0px' \}/)
  assert.match(processFlow, /progressPath\?\.style\.setProperty\('stroke-dashoffset', String\(100 - progress \* 100\)\)/)
})
