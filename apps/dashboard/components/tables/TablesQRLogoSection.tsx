'use client'

import React, { useState } from 'react'
import { AppIconNodes } from '@garsonless/ui/icons'
import type { QRConfig } from './tables-builder-types'
import type { SetQRField } from './use-tables-qr-properties-model'
import { buttonGhost, Field, Group, Slider, Toggle } from './tables-qr-property-controls'

// The logo is persisted inside restaurants.settings and read on every dashboard
// SSR plus the public menu. Only a downscaled PNG crosses the server boundary.
const MAX_LOGO_CHARS = 262_144
const ALLOWED_LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

export function TablesQRLogoSection({ qr, set, legacyLogoRejected }: { qr: QRConfig; set: SetQRField; legacyLogoRejected: boolean }) {
  const [logoError, setLogoError] = useState<string | null>(null)

  const onUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setLogoError(null)
    if (!ALLOWED_LOGO_TYPES.has(file.type)) {
      setLogoError('Yalnız PNG, JPEG veya WebP logo yükleyebilirsiniz.')
      event.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      if (!result) return
      const image = new Image()
      image.onload = () => {
        const max = 256
        const scale = Math.min(1, max / Math.max(image.width, image.height))
        const width = Math.max(1, Math.round(image.width * scale))
        const height = Math.max(1, Math.round(image.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')
        if (!context) {
          setLogoError('Görsel işlenemedi.')
          return
        }
        context.drawImage(image, 0, 0, width, height)
        const output = canvas.toDataURL('image/png')
        if (output.length > MAX_LOGO_CHARS) {
          setLogoError('Logo çok büyük. Daha küçük/yalın bir görsel deneyin.')
          return
        }
        set('logo', output)
        event.target.value = ''
      }
      image.onerror = () => setLogoError('Görsel okunamadı.')
      image.src = result
    }
    reader.readAsDataURL(file)
  }

  return (
    <>
      <Group title="Marka logosu">
        <div style={{
          border: '1.5px dashed var(--border-strong)', borderRadius: 10,
          padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          background: 'var(--surface-2)',
        }}>
          {qr.logo ? (
            <div style={{
              width: 80, height: 80, borderRadius: 12, overflow: 'hidden',
              background: '#fff', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <img src={qr.logo} style={{ maxWidth: '100%', maxHeight: '100%' }} alt="" />
            </div>
          ) : (
            <div style={{
              width: 80, height: 80, borderRadius: 12,
              background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-3)',
            }}>
              {React.cloneElement(AppIconNodes.upload as React.ReactElement<{ size?: number }>, { size: 22 })}
            </div>
          )}
          <label style={{ ...buttonGhost(), cursor: 'pointer', minHeight: 44, fontSize: 12 }}>
            {qr.logo ? 'Değiştir' : 'Logo yükle'}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onUpload} style={{ display: 'none' }} />
          </label>
          {qr.logo && (
            <button type="button" onClick={() => set('logo', null)} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              minHeight: 44, fontSize: 11.5, color: 'var(--critical)', padding: '2px 10px',
            }}>Logoyu kaldır</button>
          )}
          <div style={{ fontSize: 10.5, color: 'var(--text-3)', textAlign: 'center', maxWidth: 200 }}>
            PNG, JPEG veya WebP · en fazla 256×256 px olarak güvenle dönüştürülür
          </div>
          {legacyLogoRejected && !qr.logo && (
            <div role="alert" style={{ fontSize: 11, color: 'var(--warning)', textAlign: 'center', maxWidth: 220 }}>
              Eski veya desteklenmeyen logo güvenlik nedeniyle gösterilmedi. Lütfen yeniden yükleyin.
            </div>
          )}
          {logoError && (
            <div role="alert" style={{ fontSize: 11, color: 'var(--critical)', textAlign: 'center', maxWidth: 200 }}>{logoError}</div>
          )}
        </div>
      </Group>
      <Group title="Yerleşim">
        <Field label="Boyut"><Slider value={Math.round(qr.logoSize * 100)} min={10} max={50} onBegin={() => set('logoSize', qr.logoSize, 'begin')} onChange={(value, transient) => set('logoSize', value / 100, transient ? 'replace' : 'push')} suffix="%" /></Field>
        <Field label="Boşluk"><Slider value={qr.logoMargin} min={0} max={20} onBegin={() => set('logoMargin', qr.logoMargin, 'begin')} onChange={(value, transient) => set('logoMargin', value, transient ? 'replace' : 'push')} suffix="px" /></Field>
        <Field label="Şeffaf arka"><Toggle on={!qr.logoHideBg} onChange={value => set('logoHideBg', !value)} /></Field>
      </Group>
    </>
  )
}
