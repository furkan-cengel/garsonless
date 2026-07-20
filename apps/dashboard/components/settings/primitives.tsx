'use client'

import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { I } from '../../lib/ui'

export function inputStyle(overrides?: CSSProperties): CSSProperties {
  return {
    height: 30, padding: '0 10px',
    border: '1px solid var(--border-strong)', borderRadius: 6,
    background: 'var(--surface)', fontSize: 12.5, outline: 'none',
    color: 'var(--text)', fontFamily: 'inherit',
    ...overrides,
  }
}

// Controlled when `onChange` is provided (the parent owns the value); otherwise
// falls back to internal state (back-compat for display-only toggles).
export function Toggle({ on: initialOn, onChange, disabled, ariaLabel = 'Ayarı aç veya kapat' }: { on?: boolean; onChange?: (v: boolean) => void; disabled?: boolean; ariaLabel?: string }) {
  const [internal, setInternal] = useState(initialOn ?? false)
  const on = onChange ? (initialOn ?? false) : internal
  return (
    <button
      type="button"
      disabled={disabled}
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      onClick={() => { if (onChange) onChange(!on); else setInternal(v => !v) }}
      style={{
        opacity: disabled ? 0.5 : 1,
        width: 34, height: 20, borderRadius: 999,
        background: on ? 'var(--text)' : 'var(--border-strong)',
        border: 'none', position: 'relative', cursor: 'pointer',
        transition: 'background 120ms', flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: on ? 16 : 2,
        width: 16, height: 16, borderRadius: 999, background: '#fff',
        transition: 'left 120ms', boxShadow: '0 1px 2px rgba(0,0,0,.18)',
      }} />
    </button>
  )
}

export function SelectInput({ value, options }: { value: string; options: string[] }) {
  return (
    <div style={{ position: 'relative' }}>
      <select defaultValue={value} style={{
        ...inputStyle({ width: 200, paddingRight: 28, cursor: 'pointer' }),
      }}>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
      <span style={{ position: 'absolute', right: 8, top: 7, color: 'var(--text-3)', pointerEvents: 'none' }}>
        <I.chevDown size={12} />
      </span>
    </div>
  )
}

export function TimeInput({ value }: { value: string }) {
  return (
    <input
      defaultValue={value}
      style={inputStyle({ width: 64, textAlign: 'center', fontFamily: "'Geist Mono'", fontVariantNumeric: 'tabular-nums' })}
    />
  )
}

export function DangerZone({ title, desc, button = 'Sil' }: { title: string; desc: string; button?: string }) {
  return (
    <div style={{
      marginTop: 16, padding: 16,
      background: 'var(--surface)', borderRadius: 12,
      border: '1px solid var(--critical-bg)',
      borderLeft: '3px solid var(--critical)',
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--critical)' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4, lineHeight: 1.5 }}>{desc}</div>
      </div>
      <button style={{
        height: 30, padding: '0 14px', fontSize: 12.5, fontWeight: 500,
        background: 'var(--surface)', color: 'var(--critical)',
        border: '1px solid var(--critical)',
        borderRadius: 7, cursor: 'pointer',
      }}>{button}</button>
    </div>
  )
}

export function SCard({ title, subtitle, children, style }: {
  title: string; subtitle?: string; children: ReactNode; style?: CSSProperties
}) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', ...style }}>
      <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--divider)' }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{subtitle}</div>}
      </div>
      <div>{children}</div>
    </div>
  )
}

export function FormRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '12px 18px', borderBottom: '1px solid var(--divider)',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        {hint && <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>{hint}</div>}
      </div>
      {children}
    </div>
  )
}
