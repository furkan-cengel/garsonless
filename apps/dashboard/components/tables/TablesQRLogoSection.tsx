'use client'

import { useRef, useState } from 'react'
import { ImageIcon, Trash2, Upload } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from '@/components/ui/attachment'
import { Input } from '@/components/ui/input'
import type { QRConfig } from './tables-builder-types'
import type { SetQRField } from './use-tables-qr-properties-model'
import { Field, Group, Slider, Toggle } from './tables-qr-property-controls'

// The logo is persisted inside restaurants.settings and read on every dashboard
// SSR plus the public menu. Only a downscaled PNG crosses the server boundary.
const MAX_LOGO_CHARS = 262_144
const ALLOWED_LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

export function TablesQRLogoSection({ qr, set, legacyLogoRejected }: { qr: QRConfig; set: SetQRField; legacyLogoRejected: boolean }) {
  const [logoError, setLogoError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const onUpload = (file: File) => {
    setLogoError(null)
    if (!ALLOWED_LOGO_TYPES.has(file.type)) {
      setLogoError('Yalnız PNG, JPEG veya WebP logo yükleyebilirsiniz.')
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
      }
      image.onerror = () => setLogoError('Görsel okunamadı.')
      image.src = result
    }
    reader.readAsDataURL(file)
  }

  return (
    <>
      <Group title="Marka logosu">
        <Input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) onUpload(file)
          }}
        />
        <Attachment
          orientation="horizontal"
          size="sm"
          state={logoError ? 'error' : qr.logo ? 'done' : 'idle'}
          className="w-full"
        >
          <AttachmentMedia variant={qr.logo ? 'image' : 'icon'}>
            {qr.logo ? <img src={qr.logo} alt="Yüklenen QR logosu" /> : <ImageIcon />}
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>{qr.logo ? 'QR logosu' : 'Logo yükle'}</AttachmentTitle>
            <AttachmentDescription>PNG, JPEG veya WebP · en fazla 256×256 px</AttachmentDescription>
          </AttachmentContent>
          <AttachmentActions>
            {qr.logo && (
              <AttachmentAction type="button" variant="destructive" aria-label="QR logosunu kaldır" onClick={() => set('logo', null)}>
                <Trash2 />
              </AttachmentAction>
            )}
            <AttachmentAction type="button" aria-label={qr.logo ? 'QR logosunu değiştir' : 'QR logosu yükle'} onClick={() => inputRef.current?.click()}>
              <Upload />
            </AttachmentAction>
          </AttachmentActions>
          <AttachmentTrigger aria-label={qr.logo ? 'QR logosunu değiştir' : 'QR logosu yükle'} onClick={() => inputRef.current?.click()} />
        </Attachment>
        {legacyLogoRejected && !qr.logo && (
          <Alert className="mt-2">
            <AlertDescription>Eski veya desteklenmeyen logo güvenlik nedeniyle gösterilmedi. Lütfen yeniden yükleyin.</AlertDescription>
          </Alert>
        )}
        {logoError && (
          <Alert variant="destructive" className="mt-2">
            <AlertDescription>{logoError}</AlertDescription>
          </Alert>
        )}
      </Group>
      <Group title="Yerleşim">
        <Field label="Boyut"><Slider value={Math.round(qr.logoSize * 100)} min={10} max={50} onBegin={() => set('logoSize', qr.logoSize, 'begin')} onChange={(value, transient) => set('logoSize', value / 100, transient ? 'replace' : 'push')} suffix="%" /></Field>
        <Field label="Boşluk"><Slider value={qr.logoMargin} min={0} max={20} onBegin={() => set('logoMargin', qr.logoMargin, 'begin')} onChange={(value, transient) => set('logoMargin', value, transient ? 'replace' : 'push')} suffix="px" /></Field>
        <Field label="Şeffaf arka"><Toggle on={!qr.logoHideBg} onChange={value => set('logoHideBg', !value)} /></Field>
      </Group>
    </>
  )
}
