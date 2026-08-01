'use client'

import React, { useEffect, useId, useRef, useState } from 'react'
import { AppIconNodes } from '@garsonless/ui/icons'
import { useShell } from '../../lib/shell-context'
import type { QRConfig, SaveState } from './tables-builder-types'

const PRESETS = [
  { id: 'classic',  name: 'Klasik',     fg: '#111113', bg: '#ffffff', dots: 'square',          ef: 'square',        eb: 'square', grad: false },
  { id: 'soft',     name: 'Yumuşak',    fg: '#111113', bg: '#ffffff', dots: 'rounded',         ef: 'extra-rounded', eb: 'dot',    grad: false },
  { id: 'dotty',    name: 'Noktalı',    fg: '#111113', bg: '#ffffff', dots: 'dots',            ef: 'extra-rounded', eb: 'dot',    grad: false },
  { id: 'amber',    name: 'Kehribar',   fg: '#8a4a1c', bg: '#fdf6ec', dots: 'classy-rounded',  ef: 'extra-rounded', eb: 'dot',    grad: false },
  { id: 'emerald',  name: 'Zümrüt',     fg: '#1b5b3e', bg: '#eaf3ed', dots: 'extra-rounded',  ef: 'extra-rounded', eb: 'dot',    grad: false },
  { id: 'midnight', name: 'Gece',       fg: '#0e0e10', bg: '#f3f3f5', dots: 'rounded',         ef: 'square',        eb: 'square', grad: true, gradTo: '#3b3b40' },
  { id: 'sunset',   name: 'Gün batımı', fg: '#b8551c', bg: '#fff6ef', dots: 'extra-rounded',  ef: 'extra-rounded', eb: 'dot',    grad: true, gradTo: '#a13b7a' },
  { id: 'mint',     name: 'Nane',       fg: '#0e8a64', bg: '#edf9f4', dots: 'classy-rounded',  ef: 'extra-rounded', eb: 'dot',    grad: false },
] as const

const I = {
  cutlery: AppIconNodes.cutlery,
  chair: AppIconNodes.chair,
  palette: AppIconNodes.palette,
  clipboard: AppIconNodes.clipboard,
  gear: AppIconNodes.gear,
  question: AppIconNodes.question,
  chevDown: AppIconNodes.chevDown,
  chevRight: AppIconNodes.chevRight,
  chevLeft: AppIconNodes.chevLeft,
  eye: AppIconNodes.eye,
  warn: AppIconNodes.warn,
  plus: AppIconNodes.plus,
  search: AppIconNodes.search,
  image: AppIconNodes.image,
  copy: AppIconNodes.copy,
  undo: AppIconNodes.undo,
  redo: AppIconNodes.redo,
  history: AppIconNodes.history,
  layout: AppIconNodes.layout,
  bell: AppIconNodes.bell,
  check: AppIconNodes.check,
  close: AppIconNodes.close,
  trash: AppIconNodes.trash,
}

const QRI = {
  download: AppIconNodes.download,
  upload: AppIconNodes.upload,
  qr: AppIconNodes.qr,
  paint: AppIconNodes.paint,
  frame: AppIconNodes.frame,
  print: AppIconNodes.print,
  link2: AppIconNodes.link2,
  scan: AppIconNodes.scan,
  more: AppIconNodes.more,
  refresh: AppIconNodes.refresh,
  star: AppIconNodes.star,
}

const S = {
  label: { fontSize: 11, fontWeight: 500, letterSpacing: '.06em', textTransform: 'uppercase' as const, color: 'var(--text-3)' },
  mono:  { fontFamily: "'Geist Mono', ui-monospace, monospace", fontVariantNumeric: 'tabular-nums' as const },
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
function PresetChip({ preset, active, onClick }: { preset: typeof PRESETS[number]; active: boolean; onClick: () => void }) {
  return (
    <button className="tb-hover" onClick={onClick} title={preset.name} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      height: 28, padding: '0 10px 0 4px',
      background: active ? 'var(--surface)' : 'transparent',
      border: '1px solid ' + (active ? 'var(--text)' : 'var(--border)'),
      borderRadius: 6, cursor: 'pointer',
      boxShadow: active ? '0 0 0 3px rgba(17,17,19,.06)' : 'none',
    }}>
      <span style={{
        width: 20, height: 20, borderRadius: 4, background: preset.bg,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="14" height="14" viewBox="0 0 14 14">
          {preset.dots === 'dots'
            ? ([2,5,8,11] as number[]).flatMap(x => ([2,5,8,11] as number[]).map(y =>
                <circle key={`${x}-${y}`} cx={x} cy={y} r="1" fill={preset.fg} />
              ))
            : <>
                <rect x="1" y="1" width="3" height="3" rx={preset.dots === 'rounded' ? 1 : 0} fill={preset.fg} />
                <rect x="10" y="1" width="3" height="3" rx={preset.dots === 'rounded' ? 1 : 0} fill={preset.fg} />
                <rect x="1" y="10" width="3" height="3" rx={preset.dots === 'rounded' ? 1 : 0} fill={preset.fg} />
                {([[5,2],[7,4],[9,6],[5,7],[6,9],[8,9],[9,11]] as [number,number][]).map(([x,y], i) => (
                  <rect key={i} x={x} y={y} width="1.6" height="1.6" rx={preset.dots === 'rounded' ? .5 : 0} fill={preset.fg} />
                ))}
              </>
          }
        </svg>
      </span>
      <span style={{ fontSize: 11.5, fontWeight: 500, color: active ? 'var(--text)' : 'var(--text-2)' }}>{preset.name}</span>
    </button>
  )
}

/* ─── TablesTopBar ──────────────────────────────────────────── */
export function TablesTopBar({ qr, setQR, restaurantName, sectionTitle, saveState, onUndo, onRedo, canUndo, canRedo, onPreview }: {
  qr: QRConfig
  setQR: (q: QRConfig) => void
  restaurantName: string
  sectionTitle: string
  saveState: SaveState
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  onPreview: () => void
}) {
  const { openNotifications, notificationCount } = useShell()
  const [morePresets, setMorePresets] = useState(false)
  const presetTriggerRef = useRef<HTMLButtonElement>(null)
  const presetMenuRef = useRef<HTMLDivElement>(null)
  const presetMenuId = useId()
  const applyPreset = (p: typeof PRESETS[number]) => setQR({
    ...qr,
    fg: p.fg, bg: p.bg,
    dotsType: p.dots, eyeFrame: p.ef, eyeBall: p.eb,
    colorType: p.grad ? 'gradient' : 'single',
    fg2: ('gradTo' in p ? p.gradTo : qr.fg2) as string,
    _presetId: p.id,
  })
  useEffect(() => {
    if (!morePresets) return
    const menu = presetMenuRef.current
    const items = () => Array.from(menu?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])
    const frame = window.requestAnimationFrame(() => items()[0]?.focus())
    const close = (restoreFocus = false) => {
      setMorePresets(false)
      if (restoreFocus) window.requestAnimationFrame(() => presetTriggerRef.current?.focus())
    }
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !menu?.contains(event.target) && !presetTriggerRef.current?.contains(event.target)) close()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      close(true)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [morePresets])
  const onPresetMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(presetMenuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])
    const index = items.indexOf(document.activeElement as HTMLButtonElement)
    let next: number | null = null
    if (event.key === 'ArrowDown') next = index < 0 ? 0 : (index + 1) % items.length
    else if (event.key === 'ArrowUp') next = index < 0 ? items.length - 1 : (index - 1 + items.length) % items.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = items.length - 1
    if (next === null || !items[next]) return
    event.preventDefault()
    items[next]?.focus()
  }
  const status = saveState === 'validating'
    ? { label: 'Okunabilirlik doğrulanıyor', color: 'var(--warning)' }
    : saveState === 'blocked'
      ? { label: 'Güvensiz stil kaydedilmedi', color: 'var(--critical)' }
      : saveState === 'saving'
    ? { label: 'Stil kaydediliyor', color: 'var(--warning)' }
    : saveState === 'error'
      ? { label: 'Stil kaydedilemedi', color: 'var(--critical)' }
      : saveState === 'conflict'
        ? { label: 'Sunucu sürümü yüklendi', color: 'var(--warning)' }
      : { label: 'Stil kaydedildi', color: 'var(--positive)' }
  return (
    <div className="tb-tables__topbar" style={{
      height: 'var(--topbar)', flexShrink: 0,
      display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center',
      padding: '0 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface)',
    }}>
      <div className="tb-tables__topbar-left" style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <a href="/dashboard" aria-label="Dashboard ana sayfası" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 8, borderRight: '1px solid var(--border)', height: 28, textDecoration: 'none' }}>
          <img src="/brand/masabu-logo-transparent.svg" alt="Masabu" style={{ height: 18, width: 'auto', display: 'block' }} />
        </a>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12,
          color: 'var(--text-2)',
          padding: '5px 8px', borderRadius: 6,
        }}>
          <span>{restaurantName}</span>
        </div>
        <span style={{ color: 'var(--text-4)' }}>/</span>
        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Mağaza</span>
        <span style={{ color: 'var(--text-4)' }}>/</span>
        <span style={{ fontSize: 12, fontWeight: 500 }}>{sectionTitle}</span>
      </div>

      <div className="tb-tables__topbar-presets" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span style={{ ...S.label, marginRight: 4 }}>Hazır</span>
        {PRESETS.slice(0, 5).map(p => (
          <PresetChip key={p.id} preset={p} active={qr._presetId === p.id} onClick={() => applyPreset(p)} />
        ))}
        <div style={{ position: 'relative' }}>
          <button
            ref={presetTriggerRef}
            type="button"
            className="tb-hover"
            aria-label="Tüm stiller"
            aria-haspopup="menu"
            aria-expanded={morePresets}
            aria-controls={morePresets ? presetMenuId : undefined}
            title="Tüm stiller"
            onClick={() => setMorePresets(v => !v)}
            style={{
              height: 28, width: 28, border: '1px solid var(--border-strong)',
              background: morePresets ? 'var(--surface-3)' : 'var(--surface)', borderRadius: 6, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-2)',
            }}
          >
            {React.cloneElement(QRI.more as React.ReactElement<{ size?: number }>, { size: 14 })}
          </button>
          {morePresets && (
              <div ref={presetMenuRef} id={presetMenuId} role="menu" aria-label="Tüm hazır QR stilleri" onKeyDown={onPresetMenuKeyDown} style={{
                position: 'absolute', top: '110%', left: '50%', transform: 'translateX(-50%)', zIndex: 21,
                minWidth: 190, padding: 6, background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-pop)',
              }}>
                <div style={{ ...S.label, padding: '4px 8px 6px' }}>Tüm stiller</div>
                {PRESETS.map(p => {
                  const active = qr._presetId === p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={active}
                      tabIndex={-1}
                      className="tb-hover"
                      onClick={() => { applyPreset(p); setMorePresets(false); window.requestAnimationFrame(() => presetTriggerRef.current?.focus()) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                        padding: '6px 8px', border: 'none', borderRadius: 6, cursor: 'pointer', textAlign: 'left',
                        background: active ? 'var(--surface-inset)' : 'transparent',
                      }}
                    >
                      <span style={{ width: 18, height: 18, borderRadius: 4, background: p.bg, border: '1px solid var(--border)', flexShrink: 0, display: 'inline-block', position: 'relative' }}>
                        <span style={{ position: 'absolute', inset: 4, borderRadius: 2, background: p.grad && 'gradTo' in p ? `linear-gradient(135deg, ${p.fg}, ${p.gradTo})` : p.fg }} />
                      </span>
                      <span style={{ flex: 1, fontSize: 12.5, fontWeight: active ? 600 : 500, color: 'var(--text)' }}>{p.name}</span>
                      {active && React.cloneElement(I.check as React.ReactElement<{ size?: number }>, { size: 13 })}
                    </button>
                  )
                })}
              </div>
          )}
        </div>
      </div>

      <div className="tb-tables__topbar-right" style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, width: 112, flexShrink: 0, padding: '0 6px', color: 'var(--text-3)', fontSize: 11.5, whiteSpace: 'nowrap' }}>
          <div style={{ width: 6, height: 6, borderRadius: 999, background: status.color }} />
          {status.label}
        </div>
        <div style={{ display: 'inline-flex', gap: 2 }}>
          <button
            className="tb-hover"
            onClick={onUndo}
            disabled={!canUndo}
            aria-label="Geri al"
            title="Geri al"
            style={{
              width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 6,
              background: 'var(--surface)', color: 'var(--text-2)', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {React.cloneElement(I.undo as React.ReactElement<{ size?: number }>, { size: 14 })}
          </button>
          <button
            className="tb-hover"
            onClick={onRedo}
            disabled={!canRedo}
            aria-label="İleri al"
            title="İleri al"
            style={{
              width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 6,
              background: 'var(--surface)', color: 'var(--text-2)', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {React.cloneElement(I.redo as React.ReactElement<{ size?: number }>, { size: 14 })}
          </button>
        </div>
        <button
          className="tb-hover"
          onClick={openNotifications}
          aria-label="Bildirimler"
          style={{
            position: 'relative',
            width: 30, height: 30, border: 'none', borderRadius: 7,
            background: 'transparent', color: 'var(--text-2)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          {React.cloneElement(I.bell as React.ReactElement<{ size?: number }>, { size: 16 })}
          {notificationCount > 0 && (
            <span style={{
              position: 'absolute', top: 2, right: 2,
              minWidth: 15, height: 15, padding: '0 4px', borderRadius: 999,
              background: 'var(--critical)', color: '#fff',
              fontSize: 9.5, fontWeight: 700, lineHeight: '15px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1.5px solid var(--surface)',
            }}>
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
        </button>
        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
        <button className="tb-hover" style={btnGhost()} onClick={onPreview}>
          {React.cloneElement(I.eye as React.ReactElement<{ size?: number }>, { size: 13 })}Menüyü önizle
        </button>
        <div
          title="Kaydedilen QR stili otomatik olarak tüm masalara yayınlanır"
          aria-label="Otomatik yayın açık"
          style={{
            height: 30, minWidth: 82, padding: '0 10px 0 7px', flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', gap: 7,
            border: '1px solid rgba(19,122,77,.18)', borderRadius: 999,
            background: 'linear-gradient(180deg, #f3fbf6 0%, var(--positive-bg) 100%)',
            color: 'var(--positive)', whiteSpace: 'nowrap',
            fontSize: 11.5, fontWeight: 650, lineHeight: 1,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.8)',
          }}
        >
          <span aria-hidden="true" style={{
            width: 18, height: 18, flexShrink: 0, borderRadius: 999,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--positive)', color: '#fff',
          }}>
            {React.cloneElement(I.check as React.ReactElement<{ size?: number; strokeWidth?: number }>, { size: 11, strokeWidth: 2.5 })}
          </span>
          Canlı
        </div>
      </div>
    </div>
  )
}

/* ─── MiniQR (deterministic static SVG) ────────────────────── */
/* ─── QR utility fns ────────────────────────────────────────── */
export function TablesStatusBar({ saveState, saveError, onRetry, tableCount, activeCount }: {
  saveState: SaveState
  saveError: string | null
  onRetry: () => void
  tableCount: number
  activeCount?: number
}) {
  const statusText = saveState === 'validating'
    ? 'Okunabilirlik doğrulanıyor'
    : saveState === 'blocked'
      ? 'Güvensiz stil kaydedilmedi'
      : saveState === 'saving'
    ? 'Otomatik kayıt çalışıyor'
    : saveState === 'error'
      ? 'Otomatik kayıt başarısız'
      : saveState === 'conflict'
        ? 'Kayıt çakışması çözüldü'
      : 'Otomatik kayıt açık'
  const attention = saveState === 'blocked' || saveState === 'error' || saveState === 'conflict'
  return (
    <div className="tb-tables__statusbar" style={{
      height: 'var(--statusbar)', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 14px', borderTop: '1px solid var(--border)', background: 'var(--surface)',
      fontSize: 11.5, color: 'var(--text-3)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          color: saveState === 'blocked' || saveState === 'error' ? 'var(--critical)' : saveState === 'conflict' ? 'var(--warning)' : 'var(--text-3)',
          fontSize: 11.5,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: 999,
            background: attention ? (saveState === 'blocked' || saveState === 'error' ? 'var(--critical)' : 'var(--warning)') : saveState === 'validating' || saveState === 'saving' ? 'var(--warning)' : 'var(--positive)',
          }} />
          {statusText}
        </span>
        {attention && (
          <>
            <span role={saveState === 'blocked' || saveState === 'error' ? 'alert' : 'status'} aria-live="polite" title={saveError ?? undefined} style={{ color: saveState === 'blocked' || saveState === 'error' ? 'var(--critical)' : 'var(--warning)', maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {saveError ?? (saveState === 'conflict' ? 'Sunucudaki güncel sürüm yüklendi.' : saveState === 'blocked' ? 'Okunamayan stil kaydedilmedi.' : 'Değişiklikler sunucuya yazılamadı.')}
            </span>
            {saveState === 'error' && <button type="button" className="tb-hover" onClick={onRetry} style={{
              border: '1px solid var(--critical)', borderRadius: 5, background: 'var(--surface)',
              color: 'var(--critical)', cursor: 'pointer', minHeight: 44, padding: '0 8px', fontSize: 11, fontWeight: 700,
            }}>Tekrar dene</button>}
          </>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, ...S.mono }}>
        <span>{tableCount} masa</span>
        {typeof activeCount === 'number' && <><span style={{ color: 'var(--text-4)' }}>·</span><span>{activeCount} aktif</span></>}
        <span style={{ color: 'var(--text-4)' }}>·</span>
        <span>tr-TR</span>
      </div>
    </div>
  )
}

/* ─── MobilePreview (Shopify-style phone mockup) ────────────── */
export function TablesMobilePreview({ src, title, onClose }: { src: string; title: string; onClose: () => void }) {
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 80,
        background: 'rgba(10,10,15,.62)', backdropFilter: 'blur(7px)', WebkitBackdropFilter: 'blur(7px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 16, padding: 24,
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: '@keyframes tbmp-spin{to{transform:rotate(360deg)}}' }} />

      {/* Top controls */}
      <div onClick={(e) => e.stopPropagation()} style={{
        display: 'flex', alignItems: 'center', gap: 8, maxWidth: '92vw',
        padding: '7px 8px 7px 14px', borderRadius: 999,
        background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.14)',
        color: '#fff', backdropFilter: 'blur(8px)',
      }}>
        {React.cloneElement(QRI.scan as React.ReactElement<{ size?: number }>, { size: 14 })}
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{title}</span>
        <span style={{ width: 1, height: 16, background: 'rgba(255,255,255,.25)', margin: '0 2px' }} />
        <span style={{ ...S.mono, fontSize: 11, color: 'rgba(255,255,255,.7)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{src}</span>
        <button
          onClick={() => window.open(src, '_blank', 'noopener')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, height: 28, padding: '0 11px',
            border: '1px solid rgba(255,255,255,.2)', borderRadius: 999,
            background: 'rgba(255,255,255,.08)', color: '#fff', fontSize: 11.5, fontWeight: 500,
            cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          {React.cloneElement(I.eye as React.ReactElement<{ size?: number }>, { size: 12 })}Yeni sekmede
        </button>
        <button
          onClick={onClose}
          aria-label="Kapat"
          style={{
            width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(255,255,255,.2)', borderRadius: 999,
            background: 'rgba(255,255,255,.08)', color: '#fff', cursor: 'pointer',
          }}
        >
          {React.cloneElement(I.close as React.ReactElement<{ size?: number }>, { size: 14 })}
        </button>
      </div>

      {/* Phone */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative', height: 'min(820px, 82vh)', aspectRatio: '420 / 860',
          background: 'linear-gradient(155deg,#202024,#0b0b0d)', borderRadius: 52, padding: 13,
          boxShadow: '0 50px 90px -30px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.07), inset 0 0 0 2px rgba(0,0,0,.5)',
        }}
      >
        {/* Dynamic island */}
        <div style={{
          position: 'absolute', top: 22, left: '50%', transform: 'translateX(-50%)',
          width: 104, height: 28, background: '#000', borderRadius: 999, zIndex: 3,
        }} />
        {/* Screen */}
        <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 40, overflow: 'hidden', background: 'var(--surface)' }}>
          {!loaded && (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--text-3)', zIndex: 1 }}>
              <div style={{
                width: 24, height: 24, borderRadius: 999,
                border: '2px solid currentColor', borderRightColor: 'transparent',
                animation: 'tbmp-spin 700ms linear infinite',
              }} />
            </div>
          )}
          <iframe
            src={src}
            onLoad={() => setLoaded(true)}
            title="Mobil önizleme"
            style={{ position: 'relative', zIndex: 2, width: '100%', height: '100%', border: 'none', background: 'transparent' }}
          />
        </div>
      </div>
    </div>
  )
}

/* ─── Root shell ────────────────────────────────────────────── */
