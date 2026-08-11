'use client'

import { useRef } from 'react'
import type { ChangeEvent } from 'react'
import { I } from '../../lib/ui'
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from '@/components/ui/attachment'
import { Spinner } from '@/components/ui/spinner'

interface ThemeLogoUploadCardProps {
  logoUrl: string | null
  uploading: boolean
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void
  onRemove: () => void
}

export function ThemeLogoUploadCard({
  logoUrl,
  uploading,
  onUpload,
  onRemove,
}: ThemeLogoUploadCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div aria-busy={uploading}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        aria-label="Restoran logosu dosyası"
        onChange={onUpload}
      />
      <Attachment state={uploading ? 'uploading' : logoUrl ? 'done' : 'idle'} size="xs" className="w-full flex-nowrap">
        <AttachmentMedia variant={logoUrl ? 'image' : 'icon'}>
          {logoUrl
            ? <img src={logoUrl} alt="Yüklü restoran logosu" />
            : uploading ? <Spinner /> : <I.tag />}
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>{uploading ? 'Logo yükleniyor…' : logoUrl ? 'Restoran logosu' : 'Logo yükle'}</AttachmentTitle>
          <AttachmentDescription>PNG, JPG veya WEBP · Maks 2MB</AttachmentDescription>
        </AttachmentContent>
        <AttachmentActions>
          <AttachmentAction
            type="button"
            variant="outline"
            size="xs"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {logoUrl ? 'Değiştir' : 'Seç'}
          </AttachmentAction>
          {logoUrl && <AttachmentAction type="button" variant="destructive" size="xs" disabled={uploading} onClick={onRemove}>Kaldır</AttachmentAction>}
        </AttachmentActions>
      </Attachment>
    </div>
  )
}
