'use client'

import React, { memo, useCallback, useEffect, useId, useRef, useState } from 'react'
import { AppIconNodes } from '@garsonless/ui/icons'
import { buildUrl } from './tables-builder-model'
import type { QRConfig, QRHealth, TableItem } from './tables-builder-types'
import type { TableCardExportFormat } from './tables-qr-export'
import { buildQRCodeStylingOptions, loadQRCodeStyling } from './tables-qr-renderer'

interface QRStylingInstance {
  append: (element: HTMLElement) => void
  update: (options: ReturnType<typeof buildQRCodeStylingOptions>) => void
}

const I = {
  check: AppIconNodes.check,
  chevDown: AppIconNodes.chevDown,
  copy: AppIconNodes.copy,
  layout: AppIconNodes.layout,
}

const QRI = {
  download: AppIconNodes.download,
  print: AppIconNodes.print,
  qr: AppIconNodes.qr,
}

const S = {
  mono: { fontFamily: "'Geist Mono', ui-monospace, monospace", fontVariantNumeric: 'tabular-nums' as const },
}

function btnPrimary(): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    height: 30, padding: '0 12px', borderRadius: 7, border: '1px solid var(--action)',
    background: 'var(--action)', color: 'var(--on-action)',
    fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
    whiteSpace: 'nowrap', flexShrink: 0,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.08), 0 1px 0 rgba(0,0,0,.04)',
  }
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


/* ─── QR Frame ──────────────────────────────────────────────── */
function Frame({ qr, table, children }: { qr: QRConfig; table?: TableItem; children: React.ReactNode }) {
  const fg = qr.frameColor

  if (qr.frame === 'none') {
    return <div style={{ background: '#fff', padding: 16, borderRadius: 12, boxShadow: 'var(--shadow-2)' }}>{children}</div>
  }
  if (qr.frame === 'card') {
    return (
      <div style={{
        background: '#fff', padding: '28px 28px 22px', borderRadius: 16,
        border: `2px solid ${fg}`, boxShadow: 'var(--shadow-2)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', width: 'min(360px, calc(100vw - 56px))',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: fg, marginBottom: 8, letterSpacing: '.04em', textTransform: 'uppercase' }}>{table?.label}</div>
        <div style={{ marginBottom: 14 }}>{children}</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: fg, letterSpacing: '-.01em' }}>{qr.frameTitle}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 3, textAlign: 'center', maxWidth: 280 }}>{qr.frameSubtitle}</div>
      </div>
    )
  }
  if (qr.frame === 'banner') {
    return (
      <div style={{
        background: fg, padding: '22px 22px 18px', borderRadius: 16,
        boxShadow: 'var(--shadow-2)', width: 'min(360px, calc(100vw - 56px))',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#fff', opacity: .7, marginBottom: 8, letterSpacing: '.08em', textTransform: 'uppercase' }}>{table?.label}</div>
        <div style={{ background: '#fff', borderRadius: 12, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginTop: 14, letterSpacing: '-.01em' }}>{qr.frameTitle}</div>
        <div style={{ fontSize: 11.5, color: '#fff', opacity: .7, marginTop: 4, textAlign: 'center', maxWidth: 280 }}>{qr.frameSubtitle}</div>
      </div>
    )
  }
  if (qr.frame === 'speech') {
    return (
      <div style={{ position: 'relative', width: 'min(360px, calc(100vw - 56px))' }}>
        <div style={{
          background: '#fff', padding: '24px', borderRadius: 18,
          border: `2px solid ${fg}`, display: 'flex', flexDirection: 'column', alignItems: 'center',
          boxShadow: 'var(--shadow-2)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: fg, marginBottom: 10, letterSpacing: '.04em', textTransform: 'uppercase' }}>{table?.label}</div>
          <div>{children}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: fg, marginTop: 14, letterSpacing: '-.01em' }}>{qr.frameTitle}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 3, textAlign: 'center' }}>{qr.frameSubtitle}</div>
        </div>
        <svg width="40" height="22" viewBox="0 0 40 22" style={{ position: 'absolute', left: '50%', bottom: -20, transform: 'translateX(-50%)', display: 'block' }}>
          <path d="M0 0 H40 L22 20 Q20 22 18 20 Z" fill="#fff" />
          <path d="M0 0 L18 20 Q20 22 22 20 L40 0" stroke={fg} strokeWidth="2" fill="none" />
        </svg>
      </div>
    )
  }
  if (qr.frame === 'phone') {
    return (
      <div style={{ width: 'min(320px, calc(100vw - 56px))', padding: 12, background: '#0b0b0d', borderRadius: 36, boxShadow: 'var(--shadow-2)' }}>
        <div style={{
          background: '#fff', borderRadius: 26, padding: '24px 22px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <div style={{ width: 80, height: 4, background: '#e7e7ea', borderRadius: 4, marginBottom: 16 }} />
          <div style={{ fontSize: 13, fontWeight: 600, color: fg, marginBottom: 8, letterSpacing: '.04em', textTransform: 'uppercase' }}>{table?.label}</div>
          <div style={{ marginBottom: 12 }}>{children}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: fg, letterSpacing: '-.01em' }}>{qr.frameTitle}</div>
          <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 3, textAlign: 'center', maxWidth: 240 }}>{qr.frameSubtitle}</div>
        </div>
      </div>
    )
  }
  return <>{children}</>
}

/* ─── DownloadMenu ──────────────────────────────────────────── */
function DownloadMenu({ onPick, disabled = false }: { onPick: (fmt: TableCardExportFormat) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const close = useCallback((restoreFocus = false) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }, [])
  useEffect(() => {
    if (!open) return
    const menu = menuRef.current
    const focusable = () => Array.from(menu?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])
    const frame = window.requestAnimationFrame(() => focusable()[0]?.focus())
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !menu?.contains(event.target) && !triggerRef.current?.contains(event.target)) close()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close(true)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [close, open])
  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])
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
  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={triggerRef}
        className="tb-hover"
        type="button"
        disabled={disabled}
        aria-label="İndirme biçimini seç"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => { if (!disabled) setOpen(!open) }}
        style={{ ...btnPrimary(), borderRadius: '0 7px 7px 0', padding: '0 8px', opacity: disabled ? 0.45 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
      >
        {React.cloneElement(I.chevDown as React.ReactElement<{ size?: number }>, { size: 14 })}
      </button>
      {open && (
          <div ref={menuRef} id={menuId} role="menu" aria-label="QR indirme biçimleri" onKeyDown={onMenuKeyDown} style={{
            position: 'absolute', right: 0, top: '110%',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 8, boxShadow: 'var(--shadow-pop)', padding: 4,
            minWidth: 160, zIndex: 6,
          }}>
            {[
              { fmt: 'png',  label: 'PNG',      hint: 'Web için' },
              { fmt: 'svg',  label: 'SVG',      hint: 'Vektör' },
              { fmt: 'jpeg', label: 'JPG',      hint: 'Düşük boyut' },
              { fmt: 'pdf',  label: 'PDF · A4', hint: 'Yazdırılabilir' },
            ].map(o => (
              <button key={o.fmt} type="button" role="menuitem" tabIndex={-1}
                onClick={() => { onPick(o.fmt as TableCardExportFormat); close(true) }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '7px 10px', border: 'none', background: 'transparent',
                  borderRadius: 5, cursor: 'pointer', textAlign: 'left',
                  color: 'var(--text)', fontSize: 12.5,
                }}>
                <span style={{ fontWeight: 500 }}>{o.label}</span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{o.hint}</span>
              </button>
            ))}
          </div>
      )}
    </div>
  )
}

/* ─── GridCard ──────────────────────────────────────────────── */
const GridCard = memo(function GridCard({ qr, table }: { qr: QRConfig; table: TableItem }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<QRStylingInstance | null>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const node = cardRef.current
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setVisible(true)
        observer.disconnect()
      }
    }, { rootMargin: '240px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!visible || !hostRef.current) return
    let cancelled = false
    const run = async () => {
      const QRCodeStyling = await loadQRCodeStyling()
      if (cancelled || !hostRef.current) return
      const options = buildQRCodeStylingOptions(qr, {
        width: 180,
        height: 180,
        data: buildUrl(qr, table),
        margin: qr.margin / 2,
        logoMargin: qr.logoMargin / 2,
      })
      if (!instanceRef.current) {
        instanceRef.current = new QRCodeStyling(options) as QRStylingInstance
        hostRef.current.innerHTML = ''
        instanceRef.current.append(hostRef.current)
      } else {
        instanceRef.current.update(options)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [qr, table, visible])
  return (
    <div ref={cardRef} style={{
      background: '#fff', borderRadius: 12, border: '1px solid var(--border)',
      padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      boxShadow: 'var(--shadow-1)',
    }}>
      <div ref={hostRef} aria-label={`${table.label} QR önizlemesi`} style={{ width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', background: visible ? 'transparent' : 'var(--surface-3)', borderRadius: 8 }} />
      <div style={{ fontSize: 13, fontWeight: 600 }}>{table.label}</div>
      <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>Benzersiz masa bağlantısı</div>
    </div>
  )
})

/* ─── QRCanvas ──────────────────────────────────────────────── */
export function TablesQRCanvas({ qr, table, tables, health, rotationPending = false, onRotateToken }: {
  qr: QRConfig
  table?: TableItem
  tables: TableItem[]
  health: QRHealth
  rotationPending?: boolean
  onRotateToken: (table: TableItem) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const qrInstanceRef = useRef<QRStylingInstance | null>(null)
  const qrHostRef = useRef<HTMLElement | null>(null)
  const [view, setView] = useState<'preview' | 'grid' | 'print'>('preview')
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle')
  const [exportState, setExportState] = useState<'idle' | 'working'>('idle')
  const [exportError, setExportError] = useState<string | null>(null)
  const deferredQR = React.useDeferredValue(qr)
  const PREVIEW_SIZE = 280

  useEffect(() => {
    if (!hostRef.current) return
    let cancelled = false
    const run = async () => {
      const QRCodeStyling = await loadQRCodeStyling()
      if (cancelled || !hostRef.current) return
      const url = buildUrl(deferredQR, table)
      const cfg = buildQRCodeStylingOptions(deferredQR, {
        width: PREVIEW_SIZE,
        height: PREVIEW_SIZE,
        data: url,
        margin: Math.round(deferredQR.margin * PREVIEW_SIZE / 600),
        logoMargin: Math.round(deferredQR.logoMargin * PREVIEW_SIZE / 600),
      })
      if (!qrInstanceRef.current) qrInstanceRef.current = new QRCodeStyling(cfg) as QRStylingInstance
      else qrInstanceRef.current.update(cfg)
      if (qrHostRef.current !== hostRef.current) {
        hostRef.current.innerHTML = ''
        qrInstanceRef.current.append(hostRef.current)
        qrHostRef.current = hostRef.current
      }
    }
    void run()
    return () => { cancelled = true }
  }, [deferredQR, table, view])

  const download = useCallback(async (format: TableCardExportFormat) => {
    if (!table) return
    setExportState('working')
    setExportError(null)
    try {
      const { downloadTableCard } = await import('./tables-qr-export')
      await downloadTableCard(qr, table, format)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'QR dosyası indirilemedi')
    } finally {
      setExportState('idle')
    }
  }, [qr, table])

  const printAll = useCallback(async () => {
    setExportState('working')
    setExportError(null)
    try {
      const { printTableCards } = await import('./tables-qr-export')
      await printTableCards(qr, tables)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Baskı görünümü hazırlanamadı')
    } finally {
      setExportState('idle')
    }
  }, [qr, tables])

  const url = buildUrl(qr, table)

  return (
    <div id="qr-preview-panel" role="tabpanel" className="tb-tables__canvas" style={{
      flex: 1, minWidth: 0,
      background: 'var(--bg)',
      backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,.07) 1px, transparent 0)',
      backgroundSize: '20px 20px',
      display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden',
    }}>
      {/* Canvas toolbar */}
      <div className="tb-tables__canvas-toolbar" style={{
        height: 44, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 14px', borderBottom: '1px solid var(--border)',
        background: 'rgba(255,255,255,.7)', backdropFilter: 'blur(8px)',
      }}>
        <div className="tb-tables__canvas-toolbar-left" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text-2)', minWidth: 0 }}>
          <span style={{ ...S.mono, fontSize: 11.5, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>
            {url}
          </span>
          <button className="tb-hover" style={{
            marginLeft: 2, minHeight: 44, padding: '3px 9px', border: '1px solid ' + (copyState === 'success' ? 'var(--positive)' : copyState === 'error' ? 'var(--critical)' : 'var(--border)'),
            background: copyState === 'success' ? 'var(--positive-bg)' : copyState === 'error' ? 'var(--critical-bg)' : 'var(--surface)',
            borderRadius: 7, color: copyState === 'success' ? 'var(--positive)' : copyState === 'error' ? 'var(--critical)' : 'var(--text-2)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 11, fontWeight: copyState === 'success' ? 600 : 400,
          }} aria-label="Masa QR bağlantısını kopyala" onClick={() => {
            void (async () => {
              try {
                if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
                await navigator.clipboard.writeText(url)
                setCopyState('success')
              } catch {
                setCopyState('error')
              }
              window.setTimeout(() => setCopyState('idle'), 2200)
            })()
          }}>
            {copyState === 'success'
              ? <>{React.cloneElement(I.check as React.ReactElement<{ size?: number }>, { size: 11 })}Kopyalandı</>
              : copyState === 'error'
                ? 'Kopyalanamadı'
                : <>{React.cloneElement(I.copy as React.ReactElement<{ size?: number }>, { size: 11 })}Kopyala</>}
          </button>
        </div>

        <div className="tb-tables__canvas-toolbar-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span className="tb-qr-health" title={health.message} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, maxWidth: 190,
            color: health.state === 'invalid' ? 'var(--critical)' : health.state === 'warning' || health.state === 'checking' ? 'var(--warning)' : 'var(--positive)',
            fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: 'currentColor', flexShrink: 0 }} />
            {health.message}
          </span>
          {table && (
            <button
              type="button"
              className="tb-hover"
              onClick={() => onRotateToken(table)}
              disabled={rotationPending}
              title="Eski QR bağlantısını geçersiz kılıp yeni bir QR üretir"
              style={{ ...btnGhost(), padding: '4px 8px', fontSize: 11, opacity: rotationPending ? .55 : 1 }}
            >{rotationPending ? 'QR yenileniyor…' : 'Yeni QR'}</button>
          )}
          <div className="tb-qr-view-switch" style={{
            display: 'inline-flex', alignItems: 'center', gap: 2,
            background: 'var(--surface-3)', borderRadius: 7, padding: 3,
          }}>
            {([
              { id: 'preview', label: 'Tek',    icon: QRI.qr },
              { id: 'grid',    label: 'Izgara', icon: I.layout },
              { id: 'print',   label: 'Baskı',  icon: QRI.print },
            ] as const).map(v => (
              <button key={v.id} type="button" aria-pressed={view === v.id} className="tb-hover" onClick={() => setView(v.id as typeof view)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px',
                fontSize: 11.5, fontWeight: 500, borderRadius: 5, border: 'none',
                background: view === v.id ? 'var(--surface)' : 'transparent',
                color: view === v.id ? 'var(--text)' : 'var(--text-2)',
                boxShadow: view === v.id ? 'var(--shadow-1)' : 'none',
                cursor: 'pointer',
              }}>
                {React.cloneElement(v.icon as React.ReactElement<{ size?: number }>, { size: 12 })}{v.label}
              </button>
            ))}
          </div>
          <div className="tb-qr-divider" style={{ width: 1, height: 20, background: 'var(--border)' }} />
          <div className="tb-qr-export-actions" style={{ display: 'inline-flex' }}>
            <button
              className="tb-hover"
              aria-busy={exportState === 'working'}
              onClick={() => { if (table) void download('png') }}
              disabled={!table || exportState === 'working' || health.state === 'invalid' || health.state === 'checking'}
              title={health.state === 'invalid' ? health.message : undefined}
              style={{ ...btnPrimary(), borderRadius: '7px 0 0 7px', borderRight: '1px solid rgba(255,255,255,.15)', paddingRight: 10, opacity: table && health.state !== 'invalid' && health.state !== 'checking' ? 1 : 0.45, cursor: table && health.state !== 'invalid' && health.state !== 'checking' ? 'pointer' : 'not-allowed' }}
            >
              {React.cloneElement(QRI.download as React.ReactElement<{ size?: number }>, { size: 13 })}{exportState === 'working' ? 'Hazırlanıyor…' : 'İndir PNG'}
            </button>
            <DownloadMenu onPick={download} disabled={!table || exportState === 'working' || health.state === 'invalid' || health.state === 'checking'} />
          </div>
        </div>
      </div>

      <span className="sr-only" role={copyState === 'error' ? 'alert' : 'status'} aria-live="polite">
        {copyState === 'success' ? 'Masa QR bağlantısı panoya kopyalandı.' : copyState === 'error' ? 'Bağlantı panoya kopyalanamadı.' : ''}
      </span>

      {exportError && (
        <div role="alert" style={{ padding: '8px 14px', color: 'var(--critical)', background: 'var(--critical-bg)', borderBottom: '1px solid var(--critical)', fontSize: 12 }}>
          {exportError} · QR stilini sadeleştirip yeniden deneyin.
        </div>
      )}

      {/* Canvas body */}
      {view === 'preview' && !table && tables.length === 0 && (
        <div className="tb-tables__canvas-body" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, overflow: 'auto' }}>
          <div style={{ textAlign: 'center', color: 'var(--text-3)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Henüz masa yok</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>QR önizlemesi için sol panelden masa ekleyin.</div>
          </div>
        </div>
      )}
      {view === 'preview' && (table || tables.length > 0) && (
        <div className="tb-tables__canvas-body" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, overflow: 'auto' }}>
          <Frame qr={qr} table={table}>
            <div ref={hostRef} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
          </Frame>
        </div>
      )}
      {view === 'grid' && (
        <div style={{ flex: 1, overflow: 'auto', padding: 32 }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>Tüm masalar</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Aynı stil, farklı bağlantılar — {tables.length} QR</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="tb-hover" aria-busy={exportState === 'working'} onClick={() => { void printAll() }} disabled={tables.length === 0 || exportState === 'working' || health.state === 'invalid' || health.state === 'checking'} title={health.state === 'invalid' ? health.message : undefined} style={{ ...btnGhost(), opacity: tables.length && exportState !== 'working' && health.state !== 'invalid' && health.state !== 'checking' ? 1 : .45, cursor: tables.length && exportState !== 'working' && health.state !== 'invalid' && health.state !== 'checking' ? 'pointer' : 'not-allowed' }}>
                  {React.cloneElement(QRI.print as React.ReactElement<{ size?: number }>, { size: 13 })}{exportState === 'working' ? 'Hazırlanıyor…' : 'Yazdır'}
                </button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
              {tables.map(t => <GridCard key={t.id} qr={deferredQR} table={t} />)}
            </div>
          </div>
        </div>
      )}
      {view === 'print' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 32, overflow: 'auto' }}>
          <div style={{
            width: 595 * .8, background: '#fff',
            boxShadow: 'var(--shadow-2)', borderRadius: 4, padding: 50,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            {/* Print-context brand: vector SVG stays sharp at A4 print resolution. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start' }}>
              <img src="/brand/masabu-logo-transparent.svg" alt="Masabu" style={{ height: 13, width: 'auto', display: 'block' }} />
              <span style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: '.06em', textTransform: 'uppercase' }}>· A4</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 30, color: qr.frameColor, letterSpacing: '-.02em' }}>{qr.frameTitle}</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>{qr.frameSubtitle}</div>
            <div style={{ marginTop: 30 }}>
              <Frame qr={qr} table={table}><div ref={hostRef} /></Frame>
            </div>
            <div style={{ marginTop: 40, fontSize: 10, ...S.mono, color: 'var(--text-3)' }}>{url}</div>
          </div>
        </div>
      )}
    </div>
  )
}
