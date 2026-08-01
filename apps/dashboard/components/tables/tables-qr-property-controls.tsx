'use client'

import React, { createContext, useContext, useId, useRef, useState } from 'react'
import { AppIconNodes } from '@garsonless/ui/icons'

const MONO_STYLE = {
  fontFamily: "'Geist Mono', ui-monospace, monospace",
  fontVariantNumeric: 'tabular-nums' as const,
}

const FieldContext = createContext<{ labelledBy: string; label: string } | null>(null)

function useFieldAccessibility() {
  return useContext(FieldContext)
}

export function buttonGhost(): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    height: 30, padding: '0 10px', borderRadius: 7,
    border: '1px solid var(--border-strong)', background: 'var(--surface)',
    color: 'var(--text)', fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
    whiteSpace: 'nowrap', flexShrink: 0,
  }
}

export function Tag({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'positive' }) {
  const value = tone === 'positive'
    ? { bg: 'var(--positive-bg)', fg: 'var(--positive)' }
    : { bg: 'var(--surface-3)', fg: 'var(--text-2)' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: value.bg, color: value.fg,
      fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 999, lineHeight: 1.4,
    }}>{children}</span>
  )
}

export function Group({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderBottom: '1px solid var(--divider)' }}>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', padding: '11px 16px', border: 'none', background: 'transparent',
        cursor: 'pointer', textAlign: 'left',
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
        <span style={{ color: 'var(--text-3)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 120ms' }}>
          {React.cloneElement(AppIconNodes.chevDown as React.ReactElement<{ size?: number }>, { size: 14 })}
        </span>
      </button>
      {open && <div style={{ padding: '2px 16px 14px' }}>{children}</div>}
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const id = useId()
  return (
    <div className="tb-qr-field" style={{ display: 'grid', gridTemplateColumns: '90px 1fr', alignItems: 'center', gap: 10, padding: '5px 0' }}>
      <div>
        <div id={id} style={{ fontSize: 12, color: 'var(--text-2)' }}>{label}</div>
        {hint && <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 1 }}>{hint}</div>}
      </div>
      <FieldContext.Provider value={{ labelledBy: id, label }}><div>{children}</div></FieldContext.Provider>
    </div>
  )
}

export function Slider({ value, min, max, step = 1, onChange, onBegin, suffix }: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number, transient: boolean) => void
  onBegin?: () => void
  suffix?: string
}) {
  const dragging = useRef(false)
  const field = useFieldAccessibility()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        type="range"
        aria-labelledby={field?.labelledBy}
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={() => { dragging.current = true; onBegin?.() }}
        onPointerUp={() => { dragging.current = false }}
        onPointerCancel={() => { dragging.current = false }}
        onBlur={() => { dragging.current = false }}
        onChange={event => onChange(Number(event.target.value), dragging.current)}
        style={{ flex: 1, minHeight: 44, accentColor: 'var(--action)', cursor: 'pointer' }}
      />
      <span style={{ ...MONO_STYLE, fontSize: 11.5, color: 'var(--text-2)', minWidth: 36, textAlign: 'right' }}>{value}{suffix}</span>
    </div>
  )
}

export function Segmented({ value, onChange, options }: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  const field = useFieldAccessibility()
  return (
    <div role="group" aria-labelledby={field?.labelledBy} style={{ display: 'inline-flex', background: 'var(--surface-3)', borderRadius: 7, padding: 3, width: '100%' }}>
      {options.map(option => (
        <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)} style={{
          flex: 1, minHeight: 44, border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 11.5, fontWeight: 500,
          background: value === option.value ? 'var(--surface)' : 'transparent',
          color: value === option.value ? 'var(--text)' : 'var(--text-2)',
          boxShadow: value === option.value ? 'var(--shadow-1)' : 'none', transition: 'all 100ms',
        }}>{option.label}</button>
      ))}
    </div>
  )
}

export function ColorField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const field = useFieldAccessibility()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <label style={{ position: 'relative', width: 44, height: 44, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
        <div aria-hidden="true" style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border-strong)', background: value, flexShrink: 0 }} />
        <input aria-label={`${field?.label ?? 'QR'} renk seçici`} type="color" value={value} onChange={event => onChange(event.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
      </label>
      <input aria-label={`${field?.label ?? 'QR'} hex renk değeri`} value={value} onChange={event => onChange(event.target.value)} style={{
        flex: 1, minWidth: 0, height: 44, padding: '0 8px', border: '1px solid var(--border)',
        borderRadius: 6, fontSize: 12.5, ...MONO_STYLE, background: 'var(--surface-2)',
        color: 'var(--text)', outline: 'none',
      }} />
    </div>
  )
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (value: boolean) => void }) {
  const field = useFieldAccessibility()
  return (
    <button type="button" role="switch" aria-labelledby={field?.labelledBy} aria-checked={on} onClick={() => onChange(!on)} style={{
      position: 'relative', width: 44, height: 44, border: 'none', cursor: 'pointer', padding: 0,
      borderRadius: 10, background: 'transparent',
    }}>
      <span aria-hidden="true" style={{ position: 'absolute', width: 36, height: 22, left: 4, top: 11, borderRadius: 999, background: on ? 'var(--action)' : 'var(--surface-inset)', transition: 'background 150ms' }}>
        <span style={{ position: 'absolute', top: 3, left: on ? 17 : 3, width: 16, height: 16, borderRadius: 999, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transition: 'left 150ms' }} />
      </span>
    </button>
  )
}

export function TextInput({ value, onChange, placeholder, prefix }: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  prefix?: React.ReactNode
}) {
  const field = useFieldAccessibility()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, minHeight: 44, padding: '0 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface-2)' }}>
      {prefix && <span style={{ color: 'var(--text-3)' }}>{prefix}</span>}
      <input aria-labelledby={field?.labelledBy} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} style={{ flex: 1, minWidth: 0, minHeight: 42, border: 'none', outline: 'none', background: 'transparent', fontSize: 12.5, color: 'var(--text)' }} />
    </div>
  )
}

export function Swatches({ value, onChange, options, label }: { value: string; onChange: (value: string) => void; options: string[]; label: string }) {
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', gap: 4 }}>
      {options.map(color => (
        <button key={color} type="button" aria-label={`${color} rengini seç`} aria-pressed={value === color} onClick={() => onChange(color)} style={{
          width: 44, height: 44, borderRadius: 7, background: color,
          border: `2px solid ${value === color ? 'var(--text)' : 'transparent'}`,
          cursor: 'pointer', padding: 0,
        }} />
      ))}
    </div>
  )
}

export function StylePicker({ value, onChange, options, renderPreview, label }: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  renderPreview: (value: string) => React.ReactNode
  label: string
}) {
  return (
    <div role="group" aria-label={label} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
      {options.map(option => (
        <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 6px 8px',
          background: value === option.value ? 'var(--surface)' : 'var(--surface-2)',
          border: `1px solid ${value === option.value ? 'var(--text)' : 'var(--border)'}`,
          borderRadius: 8, cursor: 'pointer', boxShadow: value === option.value ? '0 0 0 3px rgba(17,17,19,.06)' : 'none',
        }}>
          <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{renderPreview(option.value)}</div>
          <span style={{ fontSize: 11, fontWeight: 500, color: value === option.value ? 'var(--text)' : 'var(--text-2)' }}>{option.label}</span>
        </button>
      ))}
    </div>
  )
}

export function DotPreview({ kind }: { kind: string }) {
  const cells = [[1, 1, 0, 1], [1, 0, 1, 1], [0, 1, 1, 0], [1, 1, 0, 1]]
  const size = 8
  const gap = 1.2
  return (
    <svg width="40" height="40" viewBox="0 0 40 40">
      {cells.flatMap((row, y) => row.map((value, x) => {
        if (!value) return null
        const cx = 4 + x * (size + gap) + size / 2
        const cy = 4 + y * (size + gap) + size / 2
        if (kind === 'dots') return <circle key={`${x}-${y}`} cx={cx} cy={cy} r={size / 2 - 0.4} fill="#111113" />
        if (kind === 'rounded') return <rect key={`${x}-${y}`} x={cx - size / 2} y={cy - size / 2} width={size} height={size} rx="2" fill="#111113" />
        if (kind === 'extra-rounded') return <rect key={`${x}-${y}`} x={cx - size / 2} y={cy - size / 2} width={size} height={size} rx="3.5" fill="#111113" />
        if (kind === 'classy') return <path key={`${x}-${y}`} d={`M${cx - size / 2} ${cy - size / 2}h${size}v${size}h-${size / 2}a${size / 2} ${size / 2} 0 0 1-${size / 2} -${size / 2}Z`} fill="#111113" />
        if (kind === 'classy-rounded') return <path key={`${x}-${y}`} d={`M${cx - size / 2 + 2} ${cy - size / 2}h${size - 2}q2 0 2 2v${size - 2}h-${size - 2}q-2 0-2-2Z`} fill="#111113" />
        return <rect key={`${x}-${y}`} x={cx - size / 2} y={cy - size / 2} width={size} height={size} fill="#111113" />
      }))}
    </svg>
  )
}

export function EyeFramePreview({ kind }: { kind: string }) {
  const radius = kind === 'extra-rounded' ? 8 : kind === 'dot' ? 18 : 0
  return <svg width="40" height="40" viewBox="0 0 40 40"><rect x="3" y="3" width="34" height="34" rx={radius} fill="none" stroke="#111113" strokeWidth="6" /></svg>
}

export function EyeBallPreview({ kind }: { kind: string }) {
  if (kind === 'dot') return <svg width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="11" fill="#111113" /></svg>
  return <svg width="40" height="40" viewBox="0 0 40 40"><rect x="9" y="9" width="22" height="22" fill="#111113" /></svg>
}

export function FramePreview({ kind }: { kind: string }) {
  if (kind === 'none') return <svg width="44" height="32" viewBox="0 0 44 32"><rect x="14" y="6" width="16" height="20" fill="#cbcdd3" rx="2" /></svg>
  if (kind === 'card') return <svg width="44" height="32" viewBox="0 0 44 32"><rect x="6" y="3" width="32" height="26" fill="#fff" stroke="#111113" strokeWidth="1.4" rx="3" /><rect x="14" y="7" width="16" height="16" fill="#111113" rx="1" /></svg>
  if (kind === 'banner') return <svg width="44" height="32" viewBox="0 0 44 32"><rect x="3" y="3" width="38" height="26" fill="#111113" rx="3" /><rect x="14" y="6" width="16" height="16" fill="#fff" rx="1" /><rect x="11" y="24" width="22" height="2.5" fill="#fff" rx="1" /></svg>
  if (kind === 'speech') return <svg width="44" height="32" viewBox="0 0 44 32"><path d="M5 5h34v18H26l-3 4-3-4H5z" fill="#fff" stroke="#111113" strokeWidth="1.4" /><rect x="14" y="8" width="16" height="12" fill="#111113" rx="1" /></svg>
  if (kind === 'phone') return <svg width="44" height="32" viewBox="0 0 44 32"><rect x="14" y="2" width="16" height="28" fill="#fff" stroke="#111113" strokeWidth="1.4" rx="3" /><rect x="17" y="7" width="10" height="10" fill="#111113" rx="1" /><circle cx="22" cy="26" r="1.2" fill="#111113" /></svg>
  return null
}

export { MONO_STYLE }
