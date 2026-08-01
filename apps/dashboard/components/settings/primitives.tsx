'use client'

import { cloneElement, isValidElement, useId, useState } from 'react'
import type { CSSProperties, ReactElement, ReactNode } from 'react'

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
        width: 44, height: 44, padding: 0,
        background: 'transparent', border: 'none',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', flexShrink: 0,
      }}
    >
      <span aria-hidden="true" style={{
        width: 34, height: 20, borderRadius: 999,
        background: on ? 'var(--text)' : 'var(--border-strong)',
        position: 'relative', transition: 'background 120ms',
      }}>
        <span style={{
          position: 'absolute', top: 2, left: on ? 16 : 2,
          width: 16, height: 16, borderRadius: 999, background: '#fff',
          transition: 'left 120ms', boxShadow: '0 1px 2px rgba(0,0,0,.18)',
        }} />
      </span>
    </button>
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
  const generatedControlId = useId()
  const hintId = useId()
  const nativeControl = isValidElement(children)
    && typeof children.type === 'string'
    && ['input', 'select', 'textarea'].includes(children.type)
  const control = nativeControl
    ? cloneElement(children as ReactElement<{ id?: string; 'aria-describedby'?: string }>, {
      id: (children.props as { id?: string }).id ?? generatedControlId,
      'aria-describedby': [
        (children.props as { 'aria-describedby'?: string })['aria-describedby'],
        hint ? hintId : undefined,
      ].filter(Boolean).join(' ') || undefined,
    })
    : children
  const controlId = nativeControl
    ? ((children.props as { id?: string }).id ?? generatedControlId)
    : undefined

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '12px 18px', borderBottom: '1px solid var(--divider)',
    }}>
      <div style={{ flex: 1 }}>
        {controlId
          ? <label htmlFor={controlId} style={{ fontSize: 13, fontWeight: 500 }}>{label}</label>
          : <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>}
        {hint && <div id={hintId} style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>{hint}</div>}
      </div>
      {control}
    </div>
  )
}
