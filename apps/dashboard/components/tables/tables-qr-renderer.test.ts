import assert from 'node:assert/strict'
import { test } from 'node:test'
import { colorOpts, escapeXML, safeFilePart } from './tables-qr-renderer'
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
