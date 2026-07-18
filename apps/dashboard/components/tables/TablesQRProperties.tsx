'use client'

import React, { useRef, useState } from 'react'
import { AppIconNodes } from '@garsonless/ui/icons'
import { defaultQR } from './tables-builder-model'
import type { QRConfig, SaveState, TableItem } from './tables-builder-types'

const I = {
  chevDown: AppIconNodes.chevDown,
  image: AppIconNodes.image,
}

const QRI = {
  upload: AppIconNodes.upload,
  qr: AppIconNodes.qr,
  paint: AppIconNodes.paint,
  frame: AppIconNodes.frame,
  link2: AppIconNodes.link2,
}

const S = {
  mono: { fontFamily: "'Geist Mono', ui-monospace, monospace", fontVariantNumeric: 'tabular-nums' as const },
}

function btnGhost(): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    height: 30, padding: '0 10px', borderRadius: 7,
    border: '1px solid var(--border-strong)', background: 'var(--surface)',
    color: 'var(--text)', fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
    whiteSpace: 'nowrap', flexShrink: 0,
  }
}

function Tag({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: string }) {
  const tones: Record<string, { bg: string; fg: string }> = {
    neutral: { bg: 'var(--surface-3)', fg: 'var(--text-2)' },
    positive: { bg: 'var(--positive-bg)', fg: 'var(--positive)' },
  }
  const value = tones[tone] ?? tones.neutral!
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: value.bg, color: value.fg,
      fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 999, lineHeight: 1.4,
    }}>{children}</span>
  )
}

const DOT_STYLES = [
  { value: 'square', label: 'Kare' },
  { value: 'dots', label: 'Nokta' },
  { value: 'rounded', label: 'Yuvarlak' },
  { value: 'classy', label: 'Klasik' },
  { value: 'classy-rounded', label: 'Klasik+' },
  { value: 'extra-rounded', label: 'Çok yuvarlak' },
]
const EYE_FRAME_STYLES = [
  { value: 'square', label: 'Kare' },
  { value: 'dot', label: 'Nokta' },
  { value: 'extra-rounded', label: 'Yuvarlak' },
]
const EYE_BALL_STYLES = [
  { value: 'square', label: 'Kare' },
  { value: 'dot', label: 'Nokta' },
]
const FRAME_STYLES = [
  { id: 'none', label: 'Yok' },
  { id: 'card', label: 'Kart' },
  { id: 'banner', label: 'Şerit' },
  { id: 'speech', label: 'Balon' },
  { id: 'phone', label: 'Telefon' },
]

/* ─── QRProps shared primitives ─────────────────────────────── */
function Group({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
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
          {React.cloneElement(I.chevDown as React.ReactElement<{ size?: number }>, { size: 14 })}
        </span>
      </button>
      {open && <div style={{ padding: '2px 16px 14px' }}>{children}</div>}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', alignItems: 'center', gap: 10, padding: '5px 0' }}>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{label}</div>
        {hint && <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 1 }}>{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  )
}

function Slider({ value, min, max, step = 1, onChange, onBegin, suffix }: {
  value: number; min: number; max: number; step?: number; onChange: (v: number, transient: boolean) => void; onBegin?: () => void; suffix?: string
}) {
  const dragging = useRef(false)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input type="range" min={min} max={max} step={step} value={value}
        onPointerDown={() => { dragging.current = true; onBegin?.() }}
        onPointerUp={() => { dragging.current = false }}
        onPointerCancel={() => { dragging.current = false }}
        onBlur={() => { dragging.current = false }}
        onChange={e => onChange(Number(e.target.value), dragging.current)}
        style={{ flex: 1, accentColor: 'var(--action)' }} />
      <span style={{ ...S.mono, fontSize: 11.5, color: 'var(--text-2)', minWidth: 36, textAlign: 'right' }}>{value}{suffix}</span>
    </div>
  )
}

function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div role="group" style={{ display: 'inline-flex', background: 'var(--surface-3)', borderRadius: 7, padding: 3, width: '100%' }}>
      {options.map(o => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)} style={{
          flex: 1, height: 26, border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 11.5, fontWeight: 500,
          background: value === o.value ? 'var(--surface)' : 'transparent',
          color: value === o.value ? 'var(--text)' : 'var(--text-2)',
          boxShadow: value === o.value ? 'var(--shadow-1)' : 'none',
          transition: 'all 100ms',
        }}>{o.label}</button>
      ))}
    </div>
  )
}

function ColorField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <label style={{ position: 'relative', cursor: 'pointer' }}>
        <div style={{
          width: 24, height: 24, borderRadius: 5, border: '1px solid var(--border-strong)',
          background: value, flexShrink: 0,
        }} />
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
      </label>
      <input value={value} onChange={e => onChange(e.target.value)}
        style={{
          flex: 1, height: 28, padding: '0 8px', border: '1px solid var(--border)',
          borderRadius: 6, fontSize: 12.5, ...S.mono, background: 'var(--surface-2)',
          color: 'var(--text)', outline: 'none',
        }} />
    </div>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} style={{
      position: 'relative', width: 32, height: 18, border: 'none', cursor: 'pointer', padding: 0,
      borderRadius: 9, background: on ? 'var(--action)' : 'var(--surface-inset)', transition: 'background 150ms',
    }}>
      <div style={{
        position: 'absolute', top: 2, left: on ? 14 : 2, width: 14, height: 14,
        borderRadius: 7, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)',
        transition: 'left 150ms',
      }} />
    </button>
  )
}

function TextInput({ value, onChange, placeholder, prefix }: {
  value: string; onChange: (v: string) => void; placeholder?: string; prefix?: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 28, padding: '0 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface-2)' }}>
      {prefix && <span style={{ color: 'var(--text-3)' }}>{prefix}</span>}
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 12.5, color: 'var(--text)' }} />
    </div>
  )
}

function Swatches({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map(c => (
        <button key={c} type="button" aria-label={`${c} rengini seç`} aria-pressed={value === c} onClick={() => onChange(c)} style={{
          width: 22, height: 22, borderRadius: 4, background: c, border: '2px solid ' + (value === c ? 'var(--text)' : 'transparent'),
          cursor: 'pointer', padding: 0,
        }} />
      ))}
    </div>
  )
}

/* ─── StylePicker (3-column grid for dot/eye style) ─────────── */
function StylePicker({ value, onChange, options, renderPreview }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  renderPreview: (v: string) => React.ReactNode
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
      {options.map(o => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          padding: '10px 6px 8px',
          background: value === o.value ? 'var(--surface)' : 'var(--surface-2)',
          border: '1px solid ' + (value === o.value ? 'var(--text)' : 'var(--border)'),
          borderRadius: 8, cursor: 'pointer',
          boxShadow: value === o.value ? '0 0 0 3px rgba(17,17,19,.06)' : 'none',
        }}>
          <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {renderPreview(o.value)}
          </div>
          <span style={{ fontSize: 11, fontWeight: 500, color: value === o.value ? 'var(--text)' : 'var(--text-2)' }}>{o.label}</span>
        </button>
      ))}
    </div>
  )
}

function DotPreview({ kind }: { kind: string }) {
  const cells = [[1,1,0,1],[1,0,1,1],[0,1,1,0],[1,1,0,1]]
  const size = 8, gap = 1.2
  return (
    <svg width="40" height="40" viewBox="0 0 40 40">
      {cells.flatMap((row, y) => row.map((v, x) => {
        if (!v) return null
        const cx = 4 + x * (size + gap) + size / 2
        const cy = 4 + y * (size + gap) + size / 2
        if (kind === 'dots') return <circle key={`${x}-${y}`} cx={cx} cy={cy} r={size/2 - 0.4} fill="#111113" />
        if (kind === 'rounded') return <rect key={`${x}-${y}`} x={cx-size/2} y={cy-size/2} width={size} height={size} rx="2" fill="#111113" />
        if (kind === 'extra-rounded') return <rect key={`${x}-${y}`} x={cx-size/2} y={cy-size/2} width={size} height={size} rx="3.5" fill="#111113" />
        if (kind === 'classy') return <path key={`${x}-${y}`} d={`M${cx-size/2} ${cy-size/2}h${size}v${size}h-${size/2}a${size/2} ${size/2} 0 0 1-${size/2} -${size/2}Z`} fill="#111113" />
        if (kind === 'classy-rounded') return <path key={`${x}-${y}`} d={`M${cx-size/2+2} ${cy-size/2}h${size-2}q2 0 2 2v${size-2}h-${size-2}q-2 0-2-2Z`} fill="#111113" />
        return <rect key={`${x}-${y}`} x={cx-size/2} y={cy-size/2} width={size} height={size} fill="#111113" />
      }))}
    </svg>
  )
}

function EyeFramePreview({ kind }: { kind: string }) {
  const rx = kind === 'extra-rounded' ? 8 : kind === 'dot' ? 18 : 0
  return (
    <svg width="40" height="40" viewBox="0 0 40 40">
      <rect x="3" y="3" width="34" height="34" rx={rx} fill="none" stroke="#111113" strokeWidth="6" />
    </svg>
  )
}

function EyeBallPreview({ kind }: { kind: string }) {
  if (kind === 'dot') return <svg width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="11" fill="#111113" /></svg>
  return <svg width="40" height="40" viewBox="0 0 40 40"><rect x="9" y="9" width="22" height="22" fill="#111113" /></svg>
}

function FramePreview({ kind }: { kind: string }) {
  if (kind === 'none') return <svg width="44" height="32" viewBox="0 0 44 32"><rect x="14" y="6" width="16" height="20" fill="#cbcdd3" rx="2" /></svg>
  if (kind === 'card') return <svg width="44" height="32" viewBox="0 0 44 32"><rect x="6" y="3" width="32" height="26" fill="#fff" stroke="#111113" strokeWidth="1.4" rx="3" /><rect x="14" y="7" width="16" height="16" fill="#111113" rx="1" /></svg>
  if (kind === 'banner') return <svg width="44" height="32" viewBox="0 0 44 32"><rect x="3" y="3" width="38" height="26" fill="#111113" rx="3" /><rect x="14" y="6" width="16" height="16" fill="#fff" rx="1" /><rect x="11" y="24" width="22" height="2.5" fill="#fff" rx="1" /></svg>
  if (kind === 'speech') return <svg width="44" height="32" viewBox="0 0 44 32"><path d="M5 5h34v18H26l-3 4-3-4H5z" fill="#fff" stroke="#111113" strokeWidth="1.4" /><rect x="14" y="8" width="16" height="12" fill="#111113" rx="1" /></svg>
  if (kind === 'phone') return <svg width="44" height="32" viewBox="0 0 44 32"><rect x="14" y="2" width="16" height="28" fill="#fff" stroke="#111113" strokeWidth="1.4" rx="3" /><rect x="17" y="7" width="10" height="10" fill="#111113" rx="1" /><circle cx="22" cy="26" r="1.2" fill="#111113" /></svg>
  return null
}

/* ─── QRProps tabs ──────────────────────────────────────────── */
type SetQRField = (key: string, value: unknown, mode?: 'push' | 'replace' | 'begin') => void

function ShapeTab({ qr, set }: { qr: QRConfig; set: SetQRField }) {
  return (
    <>
      <Group title="Modül şekli" defaultOpen>
        <StylePicker value={qr.dotsType} onChange={v => set('dotsType', v)}
          options={DOT_STYLES} renderPreview={k => <DotPreview kind={k} />} />
      </Group>
      <Group title="Göz çerçevesi">
        <StylePicker value={qr.eyeFrame} onChange={v => set('eyeFrame', v)}
          options={EYE_FRAME_STYLES} renderPreview={k => <EyeFramePreview kind={k} />} />
      </Group>
      <Group title="Göz merkezi">
        <StylePicker value={qr.eyeBall} onChange={v => set('eyeBall', v)}
          options={EYE_BALL_STYLES} renderPreview={k => <EyeBallPreview kind={k} />} />
      </Group>
      <Group title="Genel" defaultOpen={false}>
        <Field label="Boyut"><Slider value={qr.size} min={200} max={1200} step={50} onBegin={() => set('size', qr.size, 'begin')} onChange={(v, transient) => set('size', v, transient ? 'replace' : 'push')} suffix="px" /></Field>
        <Field label="Kenar boşluğu"><Slider value={qr.margin} min={0} max={40} onBegin={() => set('margin', qr.margin, 'begin')} onChange={(v, transient) => set('margin', v, transient ? 'replace' : 'push')} suffix="px" /></Field>
        <Field label="Hata düzeltme" hint="Logo varsa H önerilir">
          <Segmented value={qr.ecl} onChange={v => set('ecl', v)} options={[
            { value: 'L', label: 'L · %7' },
            { value: 'M', label: 'M · %15' },
            { value: 'Q', label: 'Q · %25' },
            { value: 'H', label: 'H · %30' },
          ]} />
        </Field>
      </Group>
    </>
  )
}

function ColorTab({ qr, set }: { qr: QRConfig; set: SetQRField }) {
  return (
    <>
      <Group title="Renk türü">
        <Segmented value={qr.colorType} onChange={v => set('colorType', v)} options={[
          { value: 'single', label: 'Tek' },
          { value: 'gradient', label: 'Gradyan' },
        ]} />
      </Group>
      <Group title="Ön plan">
        <Field label="Renk 1"><ColorField value={qr.fg} onChange={v => set('fg', v)} /></Field>
        {qr.colorType === 'gradient' && <>
          <Field label="Renk 2"><ColorField value={qr.fg2} onChange={v => set('fg2', v)} /></Field>
          <Field label="Tip">
            <Segmented value={qr.gradType} onChange={v => set('gradType', v)} options={[
              { value: 'linear', label: 'Doğrusal' },
              { value: 'radial', label: 'Dairesel' },
            ]} />
          </Field>
          {qr.gradType === 'linear' && (
            <Field label="Açı"><Slider value={qr.gradAngle} min={0} max={360} step={15} onBegin={() => set('gradAngle', qr.gradAngle, 'begin')} onChange={(v, transient) => set('gradAngle', v, transient ? 'replace' : 'push')} suffix="°" /></Field>
          )}
        </>}
        <div style={{ marginTop: 4 }}>
          <Swatches value={qr.fg} onChange={v => set('fg', v)} options={['#111113', '#a13b7a', '#2f6f4e', '#b8551c', '#1f4e8f', '#0e0e10']} />
        </div>
      </Group>
      <Group title="Arka plan">
        <Field label="Renk"><ColorField value={qr.bg} onChange={v => set('bg', v)} /></Field>
        <Field label="Şeffaf"><Toggle on={qr.bgTransparent} onChange={v => set('bgTransparent', v)} /></Field>
        <div style={{ marginTop: 4 }}>
          <Swatches value={qr.bg} onChange={v => set('bg', v)} options={['#ffffff', '#fdf6ec', '#eaf3ed', '#fff6ef', '#f3f3f5', '#e7eef8']} />
        </div>
      </Group>
    </>
  )
}

// Keep the stored logo small — it rides inside restaurants.settings (read on
// every dashboard SSR + the public menu). Raster logos are downscaled to a
// 256px PNG; the result + any SVG is capped to match the server's 256KB limit.
const MAX_LOGO_CHARS = 262_144

function LogoTab({ qr, set }: { qr: QRConfig; set: SetQRField }) {
  const [logoError, setLogoError] = useState<string | null>(null)
  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoError(null)
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      if (!result) return
      // SVG stays vector — just enforce the size cap.
      if (file.type === 'image/svg+xml') {
        if (result.length > MAX_LOGO_CHARS) { setLogoError('Logo çok büyük (en fazla ~256 KB). Daha küçük bir dosya seçin.'); return }
        set('logo', result)
        return
      }
      // Raster → downscale to <=256px PNG so the persisted payload stays tiny.
      const img = new Image()
      img.onload = () => {
        const max = 256
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) { setLogoError('Görsel işlenemedi.'); return }
        ctx.drawImage(img, 0, 0, w, h)
        const out = canvas.toDataURL('image/png')
        if (out.length > MAX_LOGO_CHARS) { setLogoError('Logo çok büyük. Daha küçük/yalın bir görsel deneyin.'); return }
        set('logo', out)
      }
      img.onerror = () => setLogoError('Görsel okunamadı.')
      img.src = result
    }
    reader.readAsDataURL(file)
  }
  return (
    <>
      <Group title="Marka logosu">
        <div style={{
          border: '1.5px dashed var(--border-strong)', borderRadius: 10,
          padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          background: 'var(--surface-2)',
        }}>
          {qr.logo ? (
            <div style={{
              width: 80, height: 80, borderRadius: 12, overflow: 'hidden',
              background: '#fff', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <img src={qr.logo} style={{ maxWidth: '100%', maxHeight: '100%' }} alt="" />
            </div>
          ) : (
            <div style={{
              width: 80, height: 80, borderRadius: 12,
              background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-3)',
            }}>
              {React.cloneElement(QRI.upload as React.ReactElement<{ size?: number }>, { size: 22 })}
            </div>
          )}
          <label style={{ ...btnGhost(), cursor: 'pointer', height: 28, fontSize: 12 }}>
            {qr.logo ? 'Değiştir' : 'Logo yükle'}
            <input type="file" accept="image/*" onChange={onUpload} style={{ display: 'none' }} />
          </label>
          {qr.logo && (
            <button onClick={() => set('logo', null)} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontSize: 11.5, color: 'var(--critical)', padding: '2px 6px',
            }}>Logoyu kaldır</button>
          )}
          <div style={{ fontSize: 10.5, color: 'var(--text-3)', textAlign: 'center', maxWidth: 200 }}>
            PNG veya SVG, en az 200×200 px
          </div>
          {logoError && (
            <div style={{ fontSize: 11, color: 'var(--critical)', textAlign: 'center', maxWidth: 200 }}>{logoError}</div>
          )}
        </div>
      </Group>
      <Group title="Yerleşim">
        <Field label="Boyut"><Slider value={Math.round(qr.logoSize * 100)} min={10} max={50} onBegin={() => set('logoSize', qr.logoSize, 'begin')} onChange={(v, transient) => set('logoSize', v / 100, transient ? 'replace' : 'push')} suffix="%" /></Field>
        <Field label="Boşluk"><Slider value={qr.logoMargin} min={0} max={20} onBegin={() => set('logoMargin', qr.logoMargin, 'begin')} onChange={(v, transient) => set('logoMargin', v, transient ? 'replace' : 'push')} suffix="px" /></Field>
        <Field label="Şeffaf arka"><Toggle on={!qr.logoHideBg} onChange={v => set('logoHideBg', !v)} /></Field>
      </Group>
    </>
  )
}

function FrameTab({ qr, set }: { qr: QRConfig; set: SetQRField }) {
  return (
    <>
      <Group title="Çerçeve stili" defaultOpen>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {FRAME_STYLES.map(f => (
            <button key={f.id} type="button" aria-pressed={qr.frame === f.id} onClick={() => set('frame', f.id)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              padding: '12px 6px 8px', cursor: 'pointer',
              background: qr.frame === f.id ? 'var(--surface)' : 'var(--surface-2)',
              border: '1px solid ' + (qr.frame === f.id ? 'var(--text)' : 'var(--border)'),
              borderRadius: 8,
              boxShadow: qr.frame === f.id ? '0 0 0 3px rgba(17,17,19,.06)' : 'none',
            }}>
              <FramePreview kind={f.id} />
              <span style={{ fontSize: 11, fontWeight: 500, color: qr.frame === f.id ? 'var(--text)' : 'var(--text-2)' }}>{f.label}</span>
            </button>
          ))}
        </div>
      </Group>
      <Group title="Etiket">
        <Field label="Başlık"><TextInput value={qr.frameTitle} onChange={v => set('frameTitle', v)} placeholder="Menüyü tara" /></Field>
        <Field label="Alt yazı"><TextInput value={qr.frameSubtitle} onChange={v => set('frameSubtitle', v)} placeholder="QR'ı telefon kameranızla okutun" /></Field>
        <Field label="Renk"><ColorField value={qr.frameColor} onChange={v => set('frameColor', v)} /></Field>
      </Group>
    </>
  )
}

function DataTab({ qr, set, tables }: { qr: QRConfig; set: SetQRField; tables: TableItem[] }) {
  const exampleTableId = tables[0]?.id ?? '{benzersiz-kimlik}'
  return (
    <>
      <Group title="Bağlantı">
        <Field label="Menü adresi" hint="Her masa için benzersiz, tahmin edilemez bir bağlantı oluşturulur">
          <div style={{
            minHeight: 34, display: 'flex', alignItems: 'center', gap: 7,
            padding: '7px 9px', border: '1px solid var(--divider)', borderRadius: 6,
            background: 'var(--surface-2)', color: 'var(--text-2)', fontSize: 12,
          }}>
            {React.cloneElement(QRI.link2 as React.ReactElement<{ size?: number }>, { size: 13 })}
            <span style={S.mono}>{qr.baseUrl}</span>
          </div>
        </Field>
        <div style={{
          marginTop: 6, padding: '8px 10px', background: 'var(--surface-2)',
          border: '1px solid var(--divider)', borderRadius: 6,
          fontSize: 11, color: 'var(--text-2)', ...S.mono,
        }}>
          Örnek: {qr.baseUrl}/table/{exampleTableId}
        </div>
      </Group>
      <Group title="UTM parametreleri" defaultOpen={false}>
        <Field label="Kaynak"><TextInput value={qr.utmSource} onChange={v => set('utmSource', v)} placeholder="qr" /></Field>
        <Field label="Medya"><TextInput value={qr.utmMedium} onChange={v => set('utmMedium', v)} placeholder="masa" /></Field>
        <Field label="Kampanya"><TextInput value={qr.utmCampaign} onChange={v => set('utmCampaign', v)} /></Field>
      </Group>
    </>
  )
}

/* ─── QRProps panel ─────────────────────────────────────────── */
export function TablesQRProperties({ qr, setQR, replaceQR, beginQRChange, tables, saveState, saveError, onRetry }: {
  qr: QRConfig
  setQR: (q: QRConfig) => void
  replaceQR: (q: QRConfig) => void
  beginQRChange: () => void
  tables: TableItem[]
  saveState: SaveState
  saveError: string | null
  onRetry: () => void
}) {
  const [tab, setTab] = useState('shape')
  const set: SetQRField = (key, value, mode = 'push') => {
    if (mode === 'begin') {
      beginQRChange()
      return
    }
    const next = { ...qr, [key]: value }
    if (mode === 'replace') replaceQR(next)
    else setQR(next)
  }
  const status = saveState === 'saving'
    ? { label: 'Kaydediliyor', tone: 'neutral', dot: 'var(--warning)' }
    : saveState === 'error'
      ? { label: 'Sorun var', tone: 'neutral', dot: 'var(--critical)' }
      : { label: 'Senkronlu', tone: 'positive', dot: 'var(--positive)' }

  const tabs = [
    { id: 'shape', label: 'Şekil',   icon: QRI.qr },
    { id: 'color', label: 'Renk',    icon: QRI.paint },
    { id: 'logo',  label: 'Logo',    icon: I.image },
    { id: 'frame', label: 'Çerçeve', icon: QRI.frame },
    { id: 'data',  label: 'Veri',    icon: QRI.link2 },
  ]

  return (
    <div className="tb-tables__props" style={{
      width: 'var(--props)', flexShrink: 0,
      borderLeft: '1px solid var(--border)', background: 'var(--surface)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--divider)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>QR Stüdyosu</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>Tüm masalara uygulanır</div>
          </div>
          <Tag tone={status.tone}>
            <span style={{ width: 5, height: 5, borderRadius: 999, background: status.dot }} />
            {status.label}
          </Tag>
        </div>
        {saveState === 'error' && (
          <div role="alert" style={{ marginTop: 10, padding: '8px 9px', borderRadius: 7, background: 'var(--critical-bg)', color: 'var(--critical)', fontSize: 11.5 }}>
            <div>{saveError ?? 'Değişiklikler kaydedilemedi.'}</div>
            <button type="button" onClick={onRetry} style={{ marginTop: 6, padding: 0, border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', fontWeight: 750, textDecoration: 'underline' }}>Tekrar dene</button>
          </div>
        )}
      </div>

      <div className="tb-tables__props-tabs" role="tablist" aria-label="QR stüdyosu ayarları" style={{ display: 'flex', borderBottom: '1px solid var(--divider)', padding: '0 8px', overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '10px 10px', fontSize: 12, fontWeight: 500,
            border: 'none', background: 'transparent', flexShrink: 0,
            color: tab === t.id ? 'var(--text)' : 'var(--text-2)',
            borderBottom: '1.5px solid ' + (tab === t.id ? 'var(--text)' : 'transparent'),
            marginBottom: -1, cursor: 'pointer',
          }}>
            {React.cloneElement(t.icon as React.ReactElement<{ size?: number }>, { size: 13 })}{t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'shape' && <ShapeTab qr={qr} set={set} />}
        {tab === 'color' && <ColorTab qr={qr} set={set} />}
        {tab === 'logo'  && <LogoTab  qr={qr} set={set} />}
        {tab === 'frame' && <FrameTab qr={qr} set={set} />}
        {tab === 'data'  && <DataTab  qr={qr} set={set} tables={tables} />}
      </div>

      <div style={{
        borderTop: '1px solid var(--divider)', padding: '10px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--surface-2)',
      }}>
        <button onClick={() => setQR(defaultQR(qr.baseUrl))} style={{
          fontSize: 11.5, color: 'var(--text-2)', background: 'transparent',
          border: 'none', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2,
        }}>Stili sıfırla</button>
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{tables.length} masa</span>
      </div>
    </div>
  )
}

/* ─── StatusBar ─────────────────────────────────────────────── */
