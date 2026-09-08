'use client'

import React, { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { AppIconNodes } from '@garsonless/ui/icons'
import { LoadingStatus } from '@garsonless/ui/spinners'
import { Bell, Check, Eye, Redo2, Undo2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
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

function PresetChip({ preset, active, onClick }: { preset: typeof PRESETS[number]; active: boolean; onClick: () => void }) {
  return (
    <Button type="button" size="sm" variant={active ? 'outline' : 'ghost'} className={active ? 'border-foreground' : undefined} onClick={onClick} title={preset.name}>
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
      <span>{preset.name}</span>
    </Button>
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
  const applyPreset = (p: typeof PRESETS[number]) => setQR({
    ...qr,
    fg: p.fg, bg: p.bg,
    dotsType: p.dots, eyeFrame: p.ef, eyeBall: p.eb,
    colorType: p.grad ? 'gradient' : 'single',
    fg2: ('gradTo' in p ? p.gradTo : qr.fg2) as string,
    _presetId: p.id,
  })
  const status = saveState === 'validating'
    ? { label: 'Okunabilirlik doğrulanıyor', tone: 'warning' as const }
    : saveState === 'blocked'
      ? { label: 'Güvensiz stil kaydedilmedi', tone: 'destructive' as const }
      : saveState === 'saving'
    ? { label: 'Stil kaydediliyor', tone: 'warning' as const }
    : saveState === 'error'
      ? { label: 'Stil kaydedilemedi', tone: 'destructive' as const }
      : saveState === 'conflict'
        ? { label: 'Sunucu sürümü yüklendi', tone: 'warning' as const }
      : { label: 'Stil kaydedildi', tone: 'positive' as const }
  return (
    <div className="tb-tables__topbar" style={{
      height: 'var(--topbar)', flexShrink: 0,
      display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center',
      padding: '0 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface)',
    }}>
      <div className="tb-tables__topbar-left" style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <a href="/dashboard" aria-label="Dashboard ana sayfası" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 8, borderRight: '1px solid var(--border)', height: 28, textDecoration: 'none' }}>
          <Image src="/brand/masabu-logo-transparent.svg" alt="masabu" width={83} height={18} priority style={{ height: 18, width: 'auto', display: 'block' }} />
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
      </div>

      <div className="tb-tables__topbar-right" style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
        <Badge variant={status.tone} className="max-w-40 truncate">
          <span className="size-1.5 shrink-0 rounded-full bg-current" />
          {status.label}
        </Badge>
        <div className="inline-flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={onUndo}
            disabled={!canUndo}
            aria-label="Geri al"
            title="Geri al"
          >
            <Undo2 />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={onRedo}
            disabled={!canRedo}
            aria-label="İleri al"
            title="İleri al"
          >
            <Redo2 />
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="relative"
          onClick={openNotifications}
          aria-label="Bildirimler"
        >
          <Bell />
          {notificationCount > 0 && (
            <Badge variant="destructive" className="absolute -right-1 -top-1 h-4 min-w-4 px-1 text-[9px]">
              {notificationCount > 9 ? '9+' : notificationCount}
            </Badge>
          )}
        </Button>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <Button type="button" variant="outline" size="sm" onClick={onPreview}>
          <Eye data-icon="inline-start" />Menüyü önizle
        </Button>
        <Badge
          variant="positive"
          title="Kaydedilen QR stili otomatik olarak tüm masalara yayınlanır"
          aria-label="Otomatik yayın açık"
          className="h-7"
        >
          <Check data-icon="inline-start" />
          Canlı
        </Badge>
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
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error' | 'stalled'>('loading')
  const [frameKey, setFrameKey] = useState(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearLoadTimeout = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = null
  }
  const retry = () => {
    clearLoadTimeout()
    setLoadState('loading')
    setFrameKey((current) => current + 1)
  }
  useEffect(() => {
    setLoadState('loading')
    clearLoadTimeout()
    timeoutRef.current = setTimeout(() => setLoadState('stalled'), 10_000)
    return clearLoadTimeout
  }, [frameKey, src])
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
        <div aria-busy={loadState === 'loading'} style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 40, overflow: 'hidden', background: 'var(--surface)' }}>
          {loadState === 'loading' && (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--text-3)', zIndex: 1 }}>
              <LoadingStatus size={24} label="Mobil önizleme yükleniyor…" />
            </div>
          )}
          {(loadState === 'error' || loadState === 'stalled') && (
            <div role="alert" style={{ position: 'absolute', inset: 0, zIndex: 4, display: 'grid', placeItems: 'center', padding: 24, background: 'var(--surface)', color: 'var(--text)', textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{loadState === 'stalled' ? 'Önizleme beklenenden uzun sürüyor.' : 'Önizleme yüklenemedi.'}</div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14 }}>
                  <button type="button" onClick={retry} style={{ minHeight: 44, padding: '0 14px', border: 0, borderRadius: 8, background: 'var(--action)', color: 'var(--on-action)', fontWeight: 700, cursor: 'pointer' }}>Tekrar dene</button>
                  <button type="button" onClick={onClose} style={{ minHeight: 44, padding: '0 14px', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, cursor: 'pointer' }}>Kapat</button>
                </div>
              </div>
            </div>
          )}
          <iframe
            key={frameKey}
            src={src}
            onLoad={() => { clearLoadTimeout(); setLoadState('ready') }}
            onError={() => { clearLoadTimeout(); setLoadState('error') }}
            title="Mobil önizleme"
            style={{ position: 'relative', zIndex: 2, width: '100%', height: '100%', border: 'none', background: 'transparent' }}
          />
        </div>
      </div>
    </div>
  )
}

/* ─── Root shell ────────────────────────────────────────────── */
