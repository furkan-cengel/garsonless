'use client'

import { useState } from 'react'
import { CANONICAL_THEME_ID } from '@garsonless/design-engine'
import { THEME_DEFAULTS } from '@garsonless/ui'
import { publishTheme } from '../../lib/actions/theme'

interface Props {
  restaurantId: string
  restaurantName?: string
  onSelected: (templateId: string) => void
}

export default function StepTemplateSelect({ restaurantId, onSelected }: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleContinue() {
    setSaving(true)
    setError('')
    const result = await publishTheme(restaurantId, THEME_DEFAULTS, CANONICAL_THEME_ID)
    if ('error' in result) { setError(result.error); setSaving(false); return }
    onSelected(CANONICAL_THEME_ID)
    setSaving(false)
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 18, marginTop: 0 }}>
        Masabu menünüz hazır. Renkleri, yazıları ve tüm bölümleri Tema Düzenleyici'den işletmenize göre özelleştirebilirsiniz.
      </p>

      {error && (
        <p style={{ fontSize: 12.5, color: 'var(--critical)', marginBottom: 14 }}>{error}</p>
      )}

      <button
        type="button"
        onClick={handleContinue}
        disabled={saving}
        style={{
          width: '100%', height: 44,
          background: 'var(--action)', color: 'var(--on-action)',
          border: 'none', borderRadius: 10,
          fontSize: 14, fontWeight: 600, cursor: 'pointer',
          opacity: saving ? 0.55 : 1,
          transition: 'opacity 120ms',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.08), 0 2px 8px -2px rgba(0,0,0,.18)',
        }}
      >
        {saving ? 'Kaydediliyor…' : 'Devam et'}
      </button>
    </div>
  )
}
