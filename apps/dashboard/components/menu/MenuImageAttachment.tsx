'use client'

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
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

import { useRef, type CSSProperties, type ReactNode } from 'react'
import { I } from '../../lib/ui'

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/avif'

interface MenuImageAttachmentProps {
  imageUrl: string | null
  title: string
  description: string
  imageAlt: string
  uploading: boolean
  onFileSelected: (file: File) => void | Promise<void>
  onRemove?: () => void | Promise<void>
  orientation?: 'horizontal' | 'vertical'
  className?: string
  mediaClassName?: string
  mediaStyle?: CSSProperties
  placeholder?: ReactNode
}

export function MenuImageAttachment({
  imageUrl,
  title,
  description,
  imageAlt,
  uploading,
  onFileSelected,
  onRemove,
  orientation = 'horizontal',
  className,
  mediaClassName,
  mediaStyle,
  placeholder,
}: MenuImageAttachmentProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const hasImage = Boolean(imageUrl)
  const selectLabel = hasImage ? `${title} görselini değiştir` : `${title} görseli yükle`

  function openFilePicker() {
    if (!uploading) inputRef.current?.click()
  }

  return (
    <>
      <Input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void onFileSelected(file)
        }}
      />
      <Attachment
        className={cn('menu-image-attachment w-full', className)}
        state={uploading ? 'uploading' : hasImage ? 'done' : 'idle'}
        size={orientation === 'horizontal' ? 'sm' : 'default'}
        orientation={orientation}
        aria-busy={uploading}
      >
        <AttachmentMedia
          variant={hasImage ? 'image' : 'icon'}
          className={cn(orientation === 'vertical' && 'aspect-[4/3] w-full', mediaClassName)}
          style={mediaStyle}
        >
          {imageUrl ? <img className="size-full object-cover" src={imageUrl} alt={imageAlt} /> : uploading ? <Spinner /> : (placeholder ?? <I.image />)}
        </AttachmentMedia>
        <AttachmentContent className={cn(orientation === 'vertical' && 'w-full')}>
          <AttachmentTitle>{title}</AttachmentTitle>
          <AttachmentDescription>{uploading ? 'Yükleniyor…' : description}</AttachmentDescription>
        </AttachmentContent>
        <AttachmentActions>
          {hasImage && onRemove && (
            <AttachmentAction type="button" variant="ghost" disabled={uploading} aria-label={`${title} görselini kaldır`} onClick={() => void onRemove()}>
              <I.trash />
            </AttachmentAction>
          )}
          <AttachmentAction type="button" variant="ghost" disabled={uploading} aria-label={selectLabel} onClick={openFilePicker}>
            {uploading ? <Spinner /> : <I.image />}
          </AttachmentAction>
        </AttachmentActions>
        {!uploading && <AttachmentTrigger aria-label={selectLabel} onClick={openFilePicker} />}
      </Attachment>
    </>
  )
}
