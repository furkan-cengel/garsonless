'use client'

import { useRef } from 'react'
import type { ChangeEvent } from 'react'
import { I } from '../../lib/ui'

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
    <div aria-busy={uploading} style={{
      borderRadius: 10,
      border: '1.5px dashed var(--border-strong)',
      background: 'var(--surface-2)',
      padding: 12,
      marginBottom: 4,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 10,
    }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: 'none' }}
        onChange={onUpload}
      />
      {logoUrl ? (
        <img
          src={logoUrl}
          alt="Yüklü restoran logosu"
          style={{ height: 56, maxWidth: 160, objectFit: 'contain', borderRadius: 8 }}
        />
      ) : (
        <div style={{
          width: 56,
          height: 56,
          borderRadius: 12,
          background: 'var(--surface-3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-3)',
        }}>
          <I.tag size={22} />
        </div>
      )}
      <div aria-busy={uploading} style={{ display: 'flex', gap: 6, width: '100%' }}>
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          style={{
            ...buttonStyle,
            flex: 1,
            cursor: uploading ? 'not-allowed' : 'pointer',
            opacity: uploading ? 0.6 : 1,
          }}
        >
          {uploading ? <span role="status" aria-live="polite">Logo yükleniyor…</span> : logoUrl ? 'Değiştir' : 'Logo yükle'}
        </button>
        {logoUrl && (
          <button
            type="button"
            disabled={uploading}
            onClick={onRemove}
            style={{
              ...buttonStyle,
              padding: '0 10px',
              borderColor: 'var(--critical-bg, #fee2e2)',
              background: 'var(--critical-bg, #fff5f5)',
              color: 'var(--critical, #dc2626)',
              cursor: uploading ? 'not-allowed' : 'pointer',
              opacity: uploading ? 0.6 : 1,
            }}
          >
            Kaldır
          </button>
        )}
      </div>
      <p style={{ margin: 0, fontSize: 11, color: 'var(--text-3)', textAlign: 'center', lineHeight: 1.4 }}>
        PNG, JPG veya WEBP · Maks 2MB
      </p>
    </div>
  )
}

const buttonStyle: React.CSSProperties = {
  height: 32,
  border: '1px solid var(--border-strong)',
  borderRadius: 7,
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 12,
  fontWeight: 500,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
}
