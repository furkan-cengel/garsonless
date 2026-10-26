'use client'

import React, { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Copy, Download, Printer, QrCode, RefreshCw, TriangleAlert } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { buildUrl } from './tables-builder-model'
import type { QRConfig, QRHealth, TableItem } from './tables-builder-types'
import type { TableCardExportFormat } from './tables-qr-export'
import { buildQRCodeStylingOptions, loadQRCodeStyling } from './tables-qr-renderer'

interface QRStylingInstance {
  append: (element: HTMLElement) => void
  update: (options: ReturnType<typeof buildQRCodeStylingOptions>) => void
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
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button type="button" size="icon-sm" variant="outline" className="rounded-l-none border-l-0" disabled={disabled} aria-label="İndirme biçimini seç" />}>
        <ChevronDown />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44" aria-label="QR indirme biçimleri">
        {[
          { fmt: 'png', label: 'PNG', hint: 'Web için' },
          { fmt: 'svg', label: 'SVG', hint: 'Vektör' },
          { fmt: 'jpeg', label: 'JPG', hint: 'Düşük boyut' },
          { fmt: 'pdf', label: 'PDF · A4', hint: 'Yazdırılabilir' },
        ].map((option) => (
          <DropdownMenuItem key={option.fmt} onClick={() => onPick(option.fmt as TableCardExportFormat)}>
            {option.label}<DropdownMenuShortcut>{option.hint}</DropdownMenuShortcut>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ─── QR mount ──────────────────────────────────────────────
   qr-code-styling empties its container (innerHTML = '') and refills it on
   every update. Handing it a React-rendered element lets it delete nodes React
   still owns, which later crashes React with removeChild. So the library only
   ever gets a private node created here; React renders an empty host and the
   private node is moved into whichever host is mounted now. */
function useQRMount() {
  const nodeRef = useRef<HTMLDivElement | null>(null)
  const [host, setHost] = useState<HTMLElement | null>(null)
  const node = useCallback(() => {
    nodeRef.current ??= Object.assign(document.createElement('div'), { className: 'tb-qr-mount' })
    return nodeRef.current
  }, [])
  useEffect(() => {
    if (host && node().parentNode !== host) host.appendChild(node())
  }, [host, node])
  return { setHost, node }
}

/* ─── GridCard: one thumbnail in the bulk-print strip; picking it previews that table ─── */
const THUMB_SIZE = 92
const GridCard = memo(function GridCard({ qr, table, active, onSelect }: { qr: QRConfig; table: TableItem; active: boolean; onSelect: (tableId: string) => void }) {
  const cardRef = useRef<HTMLButtonElement>(null)
  const mount = useQRMount()
  const mountNode = mount.node
  const instanceRef = useRef<QRStylingInstance | null>(null)
  const [visible, setVisible] = useState(false)
  // Until the first canvas exists the square would be blank white; keep a skeleton.
  const [rendered, setRendered] = useState(false)
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
    if (!visible) return
    let cancelled = false
    const run = async () => {
      const QRCodeStyling = await loadQRCodeStyling()
      if (cancelled) return
      const options = buildQRCodeStylingOptions(qr, {
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        data: buildUrl(qr, table),
        margin: qr.margin / 4,
        logoMargin: qr.logoMargin / 4,
        type: 'canvas',
      })
      if (!instanceRef.current) {
        instanceRef.current = new QRCodeStyling(options) as QRStylingInstance
        instanceRef.current.append(mountNode())
        setRendered(true)
      } else {
        instanceRef.current.update(options)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [mountNode, qr, table, visible])
  return (
    <button ref={cardRef} type="button" className="tb-qr-thumb" aria-pressed={active} aria-label={`${table.label} QR kodunu önizle`} onClick={() => onSelect(table.id)}>
      <span className="tb-qr-thumb__code">
        <span ref={mount.setHost} aria-hidden="true" />
        {!rendered && <span aria-hidden="true" className="tb-qr-thumb__skeleton animate-pulse" />}
      </span>
      <span className="tb-qr-thumb__label">{table.label}</span>
    </button>
  )
})

/* ─── QRCanvas ──────────────────────────────────────────────── */
export function TablesQRCanvas({ qr, table, tables, health, rotationPending = false, onRotateToken, onSelectTable }: {
  qr: QRConfig
  table?: TableItem
  tables: TableItem[]
  health: QRHealth
  rotationPending?: boolean
  onRotateToken: (table: TableItem) => void
  onSelectTable: (tableId: string) => void
}) {
  const mount = useQRMount()
  const mountNode = mount.node
  const qrInstanceRef = useRef<QRStylingInstance | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle')
  const [exportState, setExportState] = useState<'idle' | 'working'>('idle')
  const [exportError, setExportError] = useState<string | null>(null)
  const deferredGridQR = React.useDeferredValue(qr)
  const PREVIEW_SIZE = 280

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const QRCodeStyling = await loadQRCodeStyling()
      if (cancelled) return
      const url = buildUrl(qr, table)
      const cfg = buildQRCodeStylingOptions(qr, {
        width: PREVIEW_SIZE,
        height: PREVIEW_SIZE,
        data: url,
        margin: Math.round(qr.margin * PREVIEW_SIZE / 600),
        logoMargin: Math.round(qr.logoMargin * PREVIEW_SIZE / 600),
        type: 'canvas',
      })
      if (!qrInstanceRef.current) {
        qrInstanceRef.current = new QRCodeStyling(cfg) as QRStylingInstance
        qrInstanceRef.current.append(mountNode())
      } else {
        qrInstanceRef.current.update(cfg)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [mountNode, qr, table])

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

  const exportBlocked = exportState === 'working' || health.state === 'invalid' || health.state === 'checking'
  const healthVariant = health.state === 'invalid' ? 'destructive' : health.state === 'warning' || health.state === 'checking' ? 'warning' : 'positive'

  return (
    <div id="qr-preview-panel" role="tabpanel" className="tb-tables__canvas tb-qr-canvas">
      <header className="tb-qr-canvas__head">
        <div>
          <h1>Masa QR kodları</h1>
          <span>Stil {tables.length} masanın hepsine uygulanır</span>
        </div>
        <Badge className="tb-qr-health max-w-64 truncate" title={health.message} variant={healthVariant}>
          {health.state === 'invalid' || health.state === 'warning' ? <TriangleAlert data-icon="inline-start" /> : health.state === 'checking' ? <span className="size-1.5 shrink-0 rounded-full bg-current" /> : <Check data-icon="inline-start" />}
          {health.message}
        </Badge>
      </header>

      <span className="sr-only" role={copyState === 'error' ? 'alert' : 'status'} aria-live="polite">
        {copyState === 'success' ? 'Masa QR bağlantısı panoya kopyalandı.' : copyState === 'error' ? 'Bağlantı panoya kopyalanamadı.' : ''}
      </span>

      {exportError && (
        <Alert variant="destructive" className="rounded-none border-x-0">
          <AlertDescription>{exportError} · QR stilini sadeleştirip yeniden deneyin.</AlertDescription>
        </Alert>
      )}

      {!table && tables.length === 0 ? (
        <div className="tb-tables__canvas-body flex flex-1 items-center justify-center overflow-auto p-10">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><QrCode /></EmptyMedia>
              <EmptyTitle>Henüz masa yok</EmptyTitle>
              <EmptyDescription>QR önizlemesi için sol panelden masa ekleyin.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : (
        <>
          <div className="tb-tables__canvas-body tb-qr-canvas__stage">
            {/* Keyed so a frame change rebuilds the frame instead of React reusing one variant's nodes for another. */}
            <Frame key={qr.frame} qr={qr} table={table}>
              <div ref={mount.setHost} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
            </Frame>
          </div>

          <div className="tb-tables__canvas-toolbar tb-qr-canvas__table-bar">
            <div className="tb-tables__canvas-toolbar-left">
              <strong>{table?.label}</strong>
              <span className="tb-qr-canvas__url" title={url}>{url}</span>
              <Button
                type="button"
                size="sm"
                variant={copyState === 'success' ? 'positive' : copyState === 'error' ? 'destructive' : 'outline'}
                aria-label="Masa QR bağlantısını kopyala"
                onClick={() => {
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
                }}
              >
                {copyState === 'success'
                  ? <><Check data-icon="inline-start" />Kopyalandı</>
                  : copyState === 'error'
                    ? 'Kopyalanamadı'
                    : <><Copy data-icon="inline-start" />Kopyala</>}
              </Button>
            </div>
            <div className="tb-tables__canvas-toolbar-actions">
              {table && (
                <Button type="button" size="sm" variant="outline" onClick={() => onRotateToken(table)} disabled={rotationPending} title="Eski QR bağlantısını geçersiz kılıp yeni bir QR üretir">
                  <RefreshCw data-icon="inline-start" />{rotationPending ? 'QR yenileniyor…' : 'Yeni QR'}
                </Button>
              )}
              <div className="tb-qr-export-actions inline-flex">
                <Button type="button" size="sm" variant="outline" aria-busy={exportState === 'working'} onClick={() => { if (table) void download('png') }} disabled={!table || exportBlocked} title={health.state === 'invalid' ? health.message : undefined} className="rounded-r-none">
                  <Download data-icon="inline-start" />{exportState === 'working' ? 'Hazırlanıyor…' : 'İndir PNG'}
                </Button>
                <DownloadMenu onPick={download} disabled={!table || exportBlocked} />
              </div>
            </div>
          </div>

          <section className="tb-qr-canvas__bulk" aria-labelledby="qr-bulk-title">
            <div className="tb-qr-canvas__bulk-head">
              <h2 id="qr-bulk-title">Toplu yazdırma</h2>
              <span>Her masa kendi koduyla; bir koda dokunarak önizle.</span>
              <Button type="button" size="sm" aria-busy={exportState === 'working'} onClick={() => { void printAll() }} disabled={tables.length === 0 || exportBlocked} title={health.state === 'invalid' ? health.message : undefined}>
                <Printer data-icon="inline-start" />{exportState === 'working' ? 'Hazırlanıyor…' : `${tables.length} masayı yazdır (PDF)`}
              </Button>
            </div>
            <div className="tb-qr-canvas__thumbs">
              {tables.map(t => <GridCard key={t.id} qr={deferredGridQR} table={t} active={t.id === table?.id} onSelect={onSelectTable} />)}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
