'use client'

import { useState } from 'react'
import { I, S, btnPrimary, btnGhost } from '../../lib/ui'

interface Props {
  onClose: () => void
}

const PRESETS = [
  'Bugün', 'Dün', 'Bu hafta', 'Geçen hafta',
  'Son 7 gün', 'Son 30 gün', 'Bu ay', 'Geçen ay', 'Bu çeyrek', 'Bu yıl',
]

const DAY_HEADERS = ['P', 'S', 'Ç', 'P', 'C', 'C', 'P']

export default function DateRangePicker({ onClose }: Props) {
  const [from, setFrom] = useState<number | null>(15)
  const [to, setTo] = useState<number | null>(21)
  const [activePreset, setActivePreset] = useState(4)

  function handleDayClick(d: number) {
    if (from === null || (from !== null && to !== null && d < from)) {
      setFrom(d)
      setTo(null)
    } else if (from !== null && to === null) {
      if (d >= from) setTo(d)
      else { setFrom(d); setTo(null) }
    } else {
      setFrom(d)
      setTo(null)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(17,17,19,.2)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute', right: 220, top: 56,
          width: 540, background: 'var(--surface)',
          borderRadius: 12, boxShadow: '0 12px 48px -8px rgba(0,0,0,.32), 0 0 0 1px rgba(0,0,0,.06)',
          border: '1px solid var(--border)',
          overflow: 'hidden', display: 'flex',
        }}
      >
        {/* Presets */}
        <div style={{
          width: 160, borderRight: '1px solid var(--divider)',
          background: 'var(--surface-2)', padding: 8, flexShrink: 0,
        }}>
          <div style={{ ...S.label, padding: '6px 8px 4px' }}>Hızlı</div>
          {PRESETS.map((p, i) => (
            <button
              key={p}
              onClick={() => setActivePreset(i)}
              style={{
                display: 'block', width: '100%', padding: '7px 10px', textAlign: 'left',
                fontSize: 12.5, border: 'none', cursor: 'pointer',
                background: activePreset === i ? 'var(--surface)' : 'transparent',
                color: activePreset === i ? 'var(--text)' : 'var(--text-2)',
                borderRadius: 6, fontWeight: activePreset === i ? 600 : 500,
                boxShadow: activePreset === i ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
                marginBottom: 1,
              }}
            >{p}</button>
          ))}
        </div>

        {/* Calendar */}
        <div style={{ flex: 1, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button style={{
              width: 26, height: 26, border: 'none',
              background: 'var(--surface-3)', borderRadius: 6,
              cursor: 'pointer', color: 'var(--text-2)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <I.chevLeft size={14} />
            </button>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Mayıs 2026</div>
            <button style={{
              width: 26, height: 26, border: 'none',
              background: 'var(--surface-3)', borderRadius: 6,
              cursor: 'pointer', color: 'var(--text-2)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <I.chevRight size={14} />
            </button>
          </div>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {DAY_HEADERS.map((d, i) => (
              <span key={i} style={{ fontSize: 10, color: 'var(--text-3)', textAlign: 'center', fontWeight: 500 }}>{d}</span>
            ))}
          </div>

          {/* Calendar grid — May 2026 starts on Friday */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {/* Mon–Thu empty (May 1 = Fri = col 5, so 4 empties for Mon–Thu) */}
            {[null, null, null, null].map((_, i) => (
              <div key={'e' + i} style={{ aspectRatio: '1.2' }} />
            ))}
            {/* Days 1–31 */}
            {Array.from({ length: 31 }, (_, i) => {
              const d = i + 1
              const inRange = from !== null && to !== null && d > from && d < to
              const isFrom = d === from
              const isTo = d === to
              const today = d === 20
              const isEndpoint = isFrom || isTo
              return (
                <button
                  key={d}
                  onClick={() => handleDayClick(d)}
                  style={{
                    aspectRatio: '1.2', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: today ? 700 : 500, cursor: 'pointer', border: 'none',
                    background: isEndpoint ? 'var(--text)' : inRange ? 'var(--surface-inset)' : 'transparent',
                    color: isEndpoint ? '#fff' : 'var(--text)',
                    borderRadius: isFrom ? '8px 0 0 8px' : isTo ? '0 8px 8px 0' : inRange ? 0 : 6,
                    position: 'relative',
                  }}
                >
                  {d}
                  {today && (
                    <span style={{
                      position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)',
                      width: 4, height: 4, borderRadius: 999,
                      background: isEndpoint ? '#ffd089' : 'var(--action)',
                    }} />
                  )}
                </button>
              )
            })}
          </div>

          {/* Summary */}
          <div style={{
            marginTop: 14, padding: '10px 12px',
            background: 'var(--surface-2)', borderRadius: 8,
            border: '1px solid var(--divider)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                Seçili aralık
              </div>
              <div style={{ ...S.mono, fontSize: 13, fontWeight: 600, marginTop: 2, color: 'var(--text)' }}>
                {from ?? '—'} May — {to ?? '—'} May 2026
                {from !== null && to !== null && (
                  <span style={{ color: 'var(--text-3)', fontWeight: 400 }}> · {to - from + 1} gün</span>
                )}
              </div>
            </div>
            <button onClick={onClose} style={btnGhost()}>İptal</button>
            <button onClick={onClose} style={btnPrimary()}>Uygula</button>
          </div>
        </div>
      </div>
    </div>
  )
}
