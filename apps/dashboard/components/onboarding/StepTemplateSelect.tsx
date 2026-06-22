'use client'

import { useState } from 'react'
import { TEMPLATES, DEFAULT_THEME } from '@garsonless/design-engine'
import type { TemplateId } from '@garsonless/design-engine'
import { saveTheme } from '../../lib/actions/theme'

interface Props {
  restaurantId: string
  restaurantName?: string
  onSelected: (templateId: string) => void
}

const TEMPLATE_NAMES: Record<string, string> = {
  minimal:    'Minimal',
  noir:       'Noir',
  mercato:    'Mercato',
  bento:      'Bento',
  beachside:  'Beachside',
  steakhouse: 'Steakhouse',
  fast:       'Fast',
  mezze:      'Mezze',
}

export default function StepTemplateSelect({ restaurantId, onSelected }: Props) {
  const [selected, setSelected] = useState<TemplateId>('obsidian')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleContinue() {
    setSaving(true)
    setError('')
    const config = TEMPLATES[selected] ?? DEFAULT_THEME
    const result = await saveTheme(restaurantId, config)
    if ('error' in result) { setError(result.error); setSaving(false); return }
    onSelected(selected)
    setSaving(false)
  }

  const templateIds = Object.keys(TEMPLATES) as TemplateId[]

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 18, marginTop: 0 }}>
        Pick a starting theme. You can customize everything later.
      </p>

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: 10, marginBottom: 22,
      }}>
        {templateIds.map((id) => {
          const config = TEMPLATES[id]
          if (!config) return null
          const isSelected = selected === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSelected(id)}
              style={{
                position: 'relative',
                padding: 10,
                borderRadius: 10,
                border: `2px solid ${isSelected ? 'var(--text)' : 'var(--border)'}`,
                background: isSelected ? 'var(--surface-2)' : 'var(--surface)',
                cursor: 'pointer', textAlign: 'left',
                transition: 'border-color 120ms, background 120ms',
                boxShadow: isSelected ? 'var(--shadow-2)' : 'none',
              }}
            >
              <div style={{
                height: 36, borderRadius: 7, marginBottom: 8,
                background: config.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: config.cta }} />
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: config.accent }} />
              </div>

              <span style={{
                fontSize: 12, fontWeight: isSelected ? 700 : 500,
                color: 'var(--text)',
              }}>
                {TEMPLATE_NAMES[id] ?? id}
              </span>

              {isSelected && (
                <span style={{
                  position: 'absolute', top: 7, right: 9,
                  fontSize: 12, fontWeight: 700, color: 'var(--text)',
                }}>✓</span>
              )}
            </button>
          )
        })}
      </div>

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
        {saving ? 'Saving…' : 'Continue'}
      </button>
    </div>
  )
}
