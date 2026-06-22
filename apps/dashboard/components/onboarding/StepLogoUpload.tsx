'use client'

import { useRef, useState } from 'react'
import { uploadLogo } from '../../lib/actions/restaurant'
import { I } from '../../lib/ui'

interface Props {
  restaurantId: string
  onFinish: () => void
}

export default function StepLogoUpload({ restaurantId, onFinish }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [hov, setHov] = useState(false)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPreview(URL.createObjectURL(file))
  }

  async function handleUpload() {
    const file = inputRef.current?.files?.[0]
    if (!file) { onFinish(); return }

    setUploading(true)
    setError('')
    const fd = new FormData()
    fd.append('file', file)
    const result = await uploadLogo(restaurantId, fd)
    setUploading(false)

    if ('error' in result) { setError(result.error); return }
    onFinish()
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 18, marginTop: 0 }}>
        Upload a square logo (PNG or SVG recommended, max 2 MB). You can skip this for now.
      </p>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          border: `2px dashed ${hov ? 'var(--border-strong)' : 'var(--border)'}`,
          borderRadius: 12, padding: '32px 16px',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 10,
          cursor: 'pointer', marginBottom: 22,
          background: hov ? 'var(--surface-2)' : 'var(--surface)',
          transition: 'border-color 120ms, background 120ms',
        }}
      >
        {preview ? (
          <img
            src={preview}
            alt="Logo preview"
            style={{ width: 80, height: 80, objectFit: 'contain', borderRadius: 10 }}
          />
        ) : (
          <>
            <span style={{ color: 'var(--text-4)', display: 'inline-flex' }}><I.image size={36} /></span>
            <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>
              Click to select image
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>

      {error && (
        <p style={{ fontSize: 12.5, color: 'var(--critical)', marginBottom: 14 }}>{error}</p>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          onClick={onFinish}
          style={{
            flex: 1, height: 44,
            background: 'var(--surface)',
            border: '1.5px solid var(--border)',
            color: 'var(--text-2)',
            borderRadius: 10,
            fontSize: 14, fontWeight: 500, cursor: 'pointer',
            transition: 'border-color 120ms, background 120ms',
          }}
        >
          Skip
        </button>
        <button
          type="button"
          onClick={handleUpload}
          disabled={uploading || !preview}
          style={{
            flex: 1, height: 44,
            background: 'var(--action)', color: 'var(--on-action)',
            border: 'none', borderRadius: 10,
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
            opacity: uploading || !preview ? 0.5 : 1,
            transition: 'opacity 120ms',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.08), 0 2px 8px -2px rgba(0,0,0,.18)',
          }}
        >
          {uploading ? 'Uploading…' : 'Upload & finish'}
        </button>
      </div>
    </div>
  )
}
