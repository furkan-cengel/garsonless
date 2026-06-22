'use client'

import { useActionState, useEffect, useState } from 'react'
import { createRestaurant, checkSlugAvailable } from '../../lib/actions/restaurant'
import { slugify } from '../../lib/utils'
import { useDebounce } from '../../lib/hooks/useDebounce'

interface Props {
  onCreated: (id: string) => void
}

export default function StepRestaurantInfo({ onCreated }: Props) {
  const [state, action, pending] = useActionState(createRestaurant, null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const [nameFocused, setNameFocused] = useState(false)
  const [slugFocused, setSlugFocused] = useState(false)
  const debouncedSlug = useDebounce(slug, 400)

  useEffect(() => { setSlug(slugify(name)) }, [name])

  useEffect(() => {
    if (!debouncedSlug) { setSlugAvailable(null); return }
    checkSlugAvailable(debouncedSlug).then(setSlugAvailable)
  }, [debouncedSlug])

  useEffect(() => {
    if (state && 'id' in state) onCreated(state.id)
  }, [state, onCreated])

  const inputBase = (focused: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', height: 42,
    background: 'var(--surface)',
    border: `1.5px solid ${focused ? 'var(--border-strong)' : 'var(--border)'}`,
    borderRadius: 10,
    boxShadow: focused ? '0 0 0 3px rgba(0,0,0,.05)' : 'none',
    transition: 'border-color 120ms, box-shadow 120ms',
    overflow: 'hidden',
  })

  return (
    <form action={action}>
      {/* Name field */}
      <div style={{ marginBottom: 18 }}>
        <div style={{
          fontSize: 12.5, fontWeight: 600, color: 'var(--text)',
          marginBottom: 6, display: 'flex', gap: 4,
        }}>
          Restaurant name
          <span style={{ color: 'var(--critical)' }}>*</span>
        </div>
        <div style={inputBase(nameFocused)}>
          <input
            name="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={() => setNameFocused(true)}
            onBlur={() => setNameFocused(false)}
            placeholder="Lezzet Köşesi"
            style={{
              flex: 1, height: '100%', padding: '0 13px',
              border: 'none', outline: 'none', background: 'transparent',
              fontSize: 14, color: 'var(--text)',
            }}
          />
        </div>
      </div>

      {/* Slug field */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
          URL slug
        </div>
        <div style={{
          ...inputBase(slugFocused),
          borderRadius: 10,
        }}>
          <span style={{
            padding: '0 12px', height: '100%',
            display: 'flex', alignItems: 'center',
            background: 'var(--surface-2)',
            borderRight: '1.5px solid var(--border)',
            fontSize: 13, color: 'var(--text-3)',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            garsonless.com/
          </span>
          <input
            name="slug"
            type="text"
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value.replace(/[^a-z0-9-]/g, ''))}
            onFocus={() => setSlugFocused(true)}
            onBlur={() => setSlugFocused(false)}
            style={{
              flex: 1, height: '100%', padding: '0 13px',
              border: 'none', outline: 'none', background: 'transparent',
              fontSize: 14, color: 'var(--text)',
            }}
          />
        </div>
        {slug && slugAvailable !== null && (
          <p style={{
            fontSize: 12, marginTop: 5,
            color: slugAvailable ? 'var(--positive)' : 'var(--critical)',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {slugAvailable ? '✓ Available' : '✗ Already taken'}
          </p>
        )}
      </div>

      {state && 'error' in state && (
        <p style={{ fontSize: 12.5, color: 'var(--critical)', marginBottom: 14 }}>
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || slugAvailable === false}
        style={{
          width: '100%', height: 44,
          background: 'var(--action)', color: 'var(--on-action)',
          border: 'none', borderRadius: 10,
          fontSize: 14, fontWeight: 600, cursor: 'pointer',
          opacity: pending || slugAvailable === false ? 0.55 : 1,
          transition: 'opacity 120ms',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.08), 0 2px 8px -2px rgba(0,0,0,.18)',
        }}
      >
        {pending ? 'Creating…' : 'Continue'}
      </button>
    </form>
  )
}
