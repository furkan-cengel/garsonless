import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildQRCodeStylingOptions, colorOpts, escapeXML, safeFilePart } from './tables-qr-renderer'
import { defaultQR } from './tables-builder-model'

test('QR export dosya adı Türkçe karakterleri güvenli ve okunur normalize eder', () => {
  assert.equal(safeFilePart('İç Bahçe / Masa 01'), 'ic-bahce-masa-01')
  assert.equal(safeFilePart('  ***  '), 'masa')
})

test('QR kart metni SVG markup içine güvenli biçimde kaçar', () => {
  assert.equal(escapeXML(`Kahve & <Tatlı> "Özel"`), 'Kahve &amp; &lt;Tatlı&gt; &quot;Özel&quot;')
})

test('QR renk seçeneği single ve gradient ayarını aynı renderer sözleşmesine çevirir', () => {
  const qr = defaultQR('https://menu.masabu.co/test')
  assert.deepEqual(colorOpts(qr), { color: qr.fg })

  const gradient = colorOpts({ ...qr, colorType: 'gradient', gradType: 'linear', gradAngle: 180 })
  assert.deepEqual(gradient, {
    gradient: {
      type: 'linear',
      rotation: Math.PI,
      colorStops: [{ offset: 0, color: qr.fg }, { offset: 1, color: qr.fg2 }],
    },
  })
})

test('QR styling adapter geçersiz persist edilmiş enumları güvenli varsayılanlara çeker', () => {
  const qr = {
    ...defaultQR('https://menu.masabu.co/test'),
    dotsType: 'invalid-dot',
    eyeFrame: 'invalid-frame',
    eyeBall: 'invalid-ball',
    ecl: 'invalid-ecl',
  }
  const options = buildQRCodeStylingOptions(qr, {
    width: 280,
    height: 280,
    data: qr.baseUrl,
    margin: 8,
    logoMargin: 4,
  })

  assert.equal(options.dotsOptions?.type, 'rounded')
  assert.equal(options.cornersSquareOptions?.type, 'extra-rounded')
  assert.equal(options.cornersDotOptions?.type, 'dot')
  assert.equal(options.qrOptions?.errorCorrectionLevel, 'M')
  assert.equal(options.type, 'svg')

  const interactiveOptions = buildQRCodeStylingOptions(qr, {
    width: 280,
    height: 280,
    data: qr.baseUrl,
    margin: 8,
    logoMargin: 4,
    type: 'canvas',
  })
  assert.equal(interactiveOptions.type, 'canvas')
})
