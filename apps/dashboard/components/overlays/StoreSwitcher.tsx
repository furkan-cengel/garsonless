'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Tables } from '@garsonless/db/types'
import { I, S } from '../../lib/ui'

const GRADIENTS = [
  'linear-gradient(135deg, #ffd089 0%, #ff8b6b 100%)',
  'linear-gradient(135deg, #a4f7c8 0%, #4caf7f 100%)',
  'linear-gradient(135deg, #c4d0ff 0%, #6e87e5 100%)',
  'linear-gradient(135deg, #f5dcea 0%, #d97757 100%)',
  'linear-gradient(135deg, #fde7c2 0%, #f0a46c 100%)',
  'linear-gradient(135deg, #dce6f0 0%, #8baed4 100%)',
]

interface Props {
  restaurants: Tables<'restaurants'>[]
  currentRestaurantId: string
  onClose: () => void
}

export default function StoreSwitcher({ restaurants, currentRestaurantId, onClose }: Props) {
  const [q, setQ] = useState('')
  const router = useRouter()
  const filtered = q
    ? restaurants.filter(r => r.name.toLowerCase().includes(q.toLowerCase()))
    : restaurants

  function handleSelect(id: string) {
    if (id !== currentRestaurantId) {
      router.push(`/dashboard/${id}`)
    }
    onClose()
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 90 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute', left: 80, top: 50,
          width: 320, background: 'var(--surface)',
          borderRadius: 12, boxShadow: 'var(--shadow-pop)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '10px 14px 4px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 10px', background: 'var(--surface-3)',
            borderRadius: 7, color: 'var(--text-3)',
          }}>
            <I.search size={13} />
            <input
              placeholder="Mağaza ara"
              value={q}
              onChange={e => setQ(e.target.value)}
              style={{
                flex: 1, border: 'none', outline: 'none',
                background: 'transparent', fontSize: 12,
              }}
            />
          </div>
        </div>

        <div style={{ padding: '4px 6px' }}>
          <div style={{ ...S.label, padding: '6px 10px 4px' }}>
            {filtered.length} mağaza
          </div>
          {filtered.map((r, i) => {
            const active = r.id === currentRestaurantId
            return (
              <button
                key={r.id}
                onClick={() => handleSelect(r.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '8px 10px', borderRadius: 7,
                  background: active ? 'var(--surface-inset)' : 'transparent',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface-3)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 7, flexShrink: 0,
                  background: GRADIENTS[i % GRADIENTS.length],
                  color: '#fff', fontWeight: 800, fontSize: 13,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {r.name.slice(0, 1).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: active ? 600 : 500 }}>{r.name}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{r.slug}</div>
                </div>
                {active && (
                  <span style={{ color: 'var(--positive)' }}>
                    <I.check size={14} />
                  </span>
                )}
                {!active && (
                  <span style={{ ...S.mono, fontSize: 10, color: 'var(--text-4)', padding: '1px 5px', background: 'var(--surface-3)', borderRadius: 3 }}>
                    ⌘{i + 1}
                  </span>
                )}
              </button>
            )
          })}

          {filtered.length === 0 && (
            <div style={{ padding: '12px 10px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
              Sonuç bulunamadı
            </div>
          )}
        </div>

        <div style={{ height: 1, background: 'var(--divider)', margin: 4 }} />

        <div style={{ padding: '4px 6px 8px' }}>
          <button
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '7px 10px', borderRadius: 6,
              border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left',
              color: 'var(--text-2)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-3)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <div style={{
              width: 26, height: 26, borderRadius: 6,
              background: 'var(--surface-3)', color: 'var(--text-2)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <I.plus size={14} />
            </div>
            <span style={{ fontSize: 12.5, fontWeight: 500 }}>Yeni mağaza ekle</span>
            <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--text-3)' }}>+₺200/ay</span>
          </button>
          <button
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '7px 10px', borderRadius: 6,
              border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left',
              color: 'var(--text-2)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-3)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <div style={{
              width: 26, height: 26, borderRadius: 6,
              background: 'var(--surface-3)', color: 'var(--text-2)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <I.gear size={14} />
            </div>
            <span style={{ fontSize: 12.5, fontWeight: 500 }}>Mağazaları yönet</span>
          </button>
        </div>
      </div>
    </div>
  )
}
