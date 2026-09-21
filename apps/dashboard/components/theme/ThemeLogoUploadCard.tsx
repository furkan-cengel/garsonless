'use client'
import { MediaInput } from '../media-library/MediaInput'

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
  onAsset: (id: string) => Promise<void>
  onRemove: () => void
}

export function ThemeLogoUploadCard({
  logoUrl,
  uploading,
  onUpload,
  onRemove,
  onAsset,
}: ThemeLogoUploadCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div aria-busy={uploading}>
      <MediaInput
        context="theme" purpose="logo" onMedia={async rows => { if(rows[0]) await onAsset(rows[0].asset.id) }}
        ref={fileInputRef}
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        aria-label="Restoran logosu dosyası"
        onChange={onUpload}
      />
      <Attachment state={uploading ? 'uploading' : logoUrl ? 'done' : 'idle'} size="xs" className="w-full flex-nowrap">
        <AttachmentMedia
          variant={logoUrl ? 'image' : 'icon'}
          data-logo-upload-preview
          className="bg-background"
          style={{ width: 56, height: 36, aspectRatio: 'auto' }}
        >
          {logoUrl
            ? <img
                src={logoUrl}
                alt="Yüklü restoran logosu"
                style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 2 }}
              />
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
