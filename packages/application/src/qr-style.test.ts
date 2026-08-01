import assert from 'node:assert/strict'
import test from 'node:test'
import { inspectQRStyleSafety, type PersistedQRStyle } from './qr-style'

const ONE_PIXEL_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

function validStyle(overrides: Partial<PersistedQRStyle> = {}): PersistedQRStyle {
  return {
    dotsType: 'rounded', eyeFrame: 'extra-rounded', eyeBall: 'dot',
    size: 600, margin: 10, ecl: 'H', colorType: 'single',
    fg: '#111113', fg2: '#3b3b40', gradType: 'linear', gradAngle: 90,
    bg: '#ffffff', bgTransparent: false, logo: null, logoSize: .3,
    logoMargin: 8, logoHideBg: true, frame: 'card', frameTitle: 'Menüyü tara',
    frameSubtitle: 'Kameranızla okutun', frameColor: '#111113',
    utmSource: 'qr', utmMedium: 'masa', utmCampaign: '', autoLang: true,
    countdown: false, ...overrides,
  }
}

test('QR safety accepts the bounded persisted contract and a signed PNG', () => {
  const result = inspectQRStyleSafety(validStyle({ logo: ONE_PIXEL_PNG }))
  assert.equal(result.safe, true)
  assert.equal(result.style?.logo, ONE_PIXEL_PNG)
})

test('QR safety blocks unreadable foreground/background combinations', () => {
  const result = inspectQRStyleSafety(validStyle({ fg: '#ffffff', bg: '#ffffff' }))
  assert.equal(result.safe, false)
  assert.ok(result.issues.some((issue) => issue.includes('kontrastı')))
})

test('QR safety rejects baseUrl and legacy SVG instead of persisting client data', () => {
  const result = inspectQRStyleSafety({
    ...validStyle(),
    baseUrl: 'https://attacker.example',
    logo: 'data:image/svg+xml;base64,PHN2Zy8+',
  })
  assert.equal(result.safe, false)
  assert.equal(result.legacyLogo, true)
  assert.ok(result.issues.some((issue) => issue.includes('baseUrl')))
})

test('QR safety verifies PNG signature and IHDR dimensions', () => {
  const forged = inspectQRStyleSafety(validStyle({ logo: 'data:image/png;base64,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' }))
  assert.equal(forged.safe, false)
  assert.ok(forged.issues.some((issue) => issue.includes('PNG logo')))
})
