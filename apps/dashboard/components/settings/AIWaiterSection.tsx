'use client'

import { useState, useTransition } from 'react'
import { updateAISettings } from '../../lib/actions/restaurant'

interface AIWaiterSectionProps {
  restaurantId: string
  initialEnabled: boolean
  initialPersonaName: string
  initialTone: 'formal' | 'friendly' | 'playful'
  initialLanguage: 'tr' | 'en' | 'both'
}

const TONE_OPTIONS = [
  { value: 'formal',   label: 'Resmi',    description: 'Kibar ve profesyonel' },
  { value: 'friendly', label: 'Samimi',   description: 'Sıcak ve yaklaşılabilir' },
  { value: 'playful',  label: 'Eğlenceli', description: 'Neşeli ve enerjik' },
] as const

const LANGUAGE_OPTIONS = [
  { value: 'tr',   label: 'Türkçe' },
  { value: 'en',   label: 'English' },
  { value: 'both', label: 'Otomatik' },
] as const

const inputStyle: React.CSSProperties = {
  width: '100%', height: 38, padding: '0 11px',
  border: '1px solid var(--border)', borderRadius: 8,
  background: 'var(--surface)', color: 'var(--text)',
  fontSize: 13.5, outline: 'none', boxSizing: 'border-box',
}

export default function AIWaiterSection({
  restaurantId,
  initialEnabled,
  initialPersonaName,
  initialTone,
  initialLanguage,
}: AIWaiterSectionProps) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [personaName, setPersonaName] = useState(initialPersonaName)
  const [tone, setTone] = useState<'formal' | 'friendly' | 'playful'>(initialTone)
  const [language, setLanguage] = useState<'tr' | 'en' | 'both'>(initialLanguage)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)
    const fd = new FormData()
    fd.append('restaurantId', restaurantId)
    fd.append('ai_waiter_enabled', String(enabled))
    fd.append('ai_persona_name', personaName)
    fd.append('ai_tone', tone)
    fd.append('ai_language', language)
    startTransition(async () => {
      const result = await updateAISettings(fd)
      if ('error' in result) { setError(result.error); return }
      setSuccess(true)
    })
  }

  return (
    <div style={{ paddingTop: 24, borderTop: '1px solid var(--divider)' }}>
      {/* Header row with toggle */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>AI Garson</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 3 }}>
            Müşterilere menü konusunda yardımcı olan yapay zeka asistan
          </div>
        </div>
        {/* Toggle switch */}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled((v) => !v)}
          style={{
            position: 'relative', width: 44, height: 24, borderRadius: 999,
            border: 'none', cursor: 'pointer', flexShrink: 0,
            background: enabled ? 'var(--action)' : 'var(--border)',
            transition: 'background 150ms',
            padding: 0,
          }}
        >
          <span style={{
            position: 'absolute', top: 3, width: 18, height: 18, borderRadius: 999,
            background: '#fff',
            left: enabled ? 23 : 3,
            transition: 'left 150ms',
            boxShadow: '0 1px 3px rgba(0,0,0,.2)',
          }} />
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex', flexDirection: 'column', gap: 18,
          opacity: enabled ? 1 : 0.45,
          pointerEvents: enabled ? 'auto' : 'none',
          transition: 'opacity 150ms',
        }}
      >
        {/* Persona name */}
        <div>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>
            Persona adı
          </label>
          <input
            type="text"
            value={personaName}
            onChange={(e) => setPersonaName(e.target.value)}
            placeholder="Sophia"
            maxLength={50}
            style={inputStyle}
          />
          <p style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 5 }}>
            Müşteriye görünen isim (örn. Sophia, Mira, Ali)
          </p>
        </div>

        {/* Tone */}
        <div>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 8 }}>Ton</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {TONE_OPTIONS.map((opt) => {
              const isActive = tone === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTone(opt.value)}
                  style={{
                    padding: '10px 12px', borderRadius: 9, textAlign: 'left',
                    border: `1.5px solid ${isActive ? 'var(--text)' : 'var(--border)'}`,
                    background: isActive ? 'var(--text)' : 'var(--surface)',
                    cursor: 'pointer', transition: 'all 120ms',
                  }}
                >
                  <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: isActive ? '#fff' : 'var(--text)' }}>
                    {opt.label}
                  </p>
                  <p style={{ fontSize: 11.5, marginTop: 3, margin: '3px 0 0', color: isActive ? 'rgba(255,255,255,.65)' : 'var(--text-3)' }}>
                    {opt.description}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Language */}
        <div>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 8 }}>Dil</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {LANGUAGE_OPTIONS.map((opt) => {
              const isActive = language === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setLanguage(opt.value)}
                  style={{
                    height: 34, padding: '0 14px', borderRadius: 7,
                    border: `1.5px solid ${isActive ? 'var(--text)' : 'var(--border)'}`,
                    background: isActive ? 'var(--text)' : 'var(--surface)',
                    color: isActive ? '#fff' : 'var(--text)',
                    fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    transition: 'all 120ms',
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {error && (
          <p style={{ fontSize: 12.5, color: 'var(--critical)', margin: 0 }}>{error}</p>
        )}
        {success && (
          <p style={{ fontSize: 12.5, color: 'var(--positive)', margin: 0 }}>AI Garson ayarları kaydedildi!</p>
        )}

        <div>
          <button
            type="submit"
            disabled={isPending || !enabled}
            style={{
              height: 38, padding: '0 20px', borderRadius: 8,
              background: 'var(--action)', color: 'var(--on-action)',
              border: 'none', fontSize: 13.5, fontWeight: 600,
              cursor: 'pointer', opacity: isPending || !enabled ? 0.55 : 1,
            }}
          >
            {isPending ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </form>
    </div>
  )
}
