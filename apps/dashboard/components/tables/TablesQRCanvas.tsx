'use client'

import React, { memo, useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Check, ChevronDown, Copy, Download, Grid3X3, Printer, QrCode, RefreshCw } from 'lucide-react'
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
import { Separator } from '@/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { buildUrl } from './tables-builder-model'
import type { QRConfig, QRHealth, TableItem } from './tables-builder-types'
import type { TableCardExportFormat } from './tables-qr-export'
import { buildQRCodeStylingOptions, loadQRCodeStyling } from './tables-qr-renderer'

interface QRStylingInstance {
  append: (element: HTMLElement) => void
  update: (options: ReturnType<typeof buildQRCodeStylingOptions>) => void
}

const S = {
  mono: { fontFamily: "'Geist Mono', ui-monospace, monospace", fontVariantNumeric: 'tabular-nums' as const },
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
      <DropdownMenuTrigger render={<Button type="button" size="icon" className="rounded-l-none border-l border-primary-foreground/15" disabled={disabled} aria-label="İndirme biçimini seç" />}>
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
      <div className="tb-tables__canvas-toolbar flex h-12 shrink-0 items-center justify-between gap-3 border-b bg-background/80 px-3 backdrop-blur-sm">
        <div className="tb-tables__canvas-toolbar-left flex min-w-0 items-center gap-2">
          <span className="max-w-[300px] truncate font-mono text-xs text-muted-foreground">
            {url}
          </span>
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
          }}>
            {copyState === 'success'
              ? <><Check data-icon="inline-start" />Kopyalandı</>
              : copyState === 'error'
                ? 'Kopyalanamadı'
                : <><Copy data-icon="inline-start" />Kopyala</>}
          </Button>
        </div>

        <div className="tb-tables__canvas-toolbar-actions flex shrink-0 items-center gap-2">
          <Badge
            className="tb-qr-health max-w-48 truncate"
            title={health.message}
            variant={health.state === 'invalid' ? 'destructive' : health.state === 'warning' || health.state === 'checking' ? 'warning' : 'positive'}
          >
            <span className="size-1.5 shrink-0 rounded-full bg-current" />
            {health.message}
          </Badge>
          {table && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onRotateToken(table)}
              disabled={rotationPending}
              title="Eski QR bağlantısını geçersiz kılıp yeni bir QR üretir"
            ><RefreshCw data-icon="inline-start" />{rotationPending ? 'QR yenileniyor…' : 'Yeni QR'}</Button>
          )}
          <ToggleGroup
            className="tb-qr-view-switch bg-muted p-0.5"
            value={[view]}
            onValueChange={(values) => { const next = values[0] as typeof view | undefined; if (next) setView(next) }}
            size="sm"
            spacing={1}
            aria-label="QR önizleme görünümü"
          >
            {([
              { id: 'preview', label: 'Tek', icon: QrCode },
              { id: 'grid', label: 'Izgara', icon: Grid3X3 },
              { id: 'print', label: 'Baskı', icon: Printer },
            ] as const).map(v => (
              <ToggleGroupItem key={v.id} value={v.id} aria-label={v.label} className="gap-1 px-2">
                <v.icon />{v.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Separator orientation="vertical" className="tb-qr-divider h-5" />
          <div className="tb-qr-export-actions inline-flex">
            <Button
              type="button"
              aria-busy={exportState === 'working'}
              onClick={() => { if (table) void download('png') }}
              disabled={!table || exportState === 'working' || health.state === 'invalid' || health.state === 'checking'}
              title={health.state === 'invalid' ? health.message : undefined}
              className="rounded-r-none"
            >
              <Download data-icon="inline-start" />{exportState === 'working' ? 'Hazırlanıyor…' : 'İndir PNG'}
            </Button>
            <DownloadMenu onPick={download} disabled={!table || exportState === 'working' || health.state === 'invalid' || health.state === 'checking'} />
          </div>
        </div>
      </div>

      <span className="sr-only" role={copyState === 'error' ? 'alert' : 'status'} aria-live="polite">
        {copyState === 'success' ? 'Masa QR bağlantısı panoya kopyalandı.' : copyState === 'error' ? 'Bağlantı panoya kopyalanamadı.' : ''}
      </span>

      {exportError && (
        <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
          <AlertDescription>{exportError} · QR stilini sadeleştirip yeniden deneyin.</AlertDescription>
        </Alert>
      )}

      {/* Canvas body */}
      {view === 'preview' && !table && tables.length === 0 && (
        <div className="tb-tables__canvas-body flex flex-1 items-center justify-center overflow-auto p-10">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><QrCode /></EmptyMedia>
              <EmptyTitle>Henüz masa yok</EmptyTitle>
              <EmptyDescription>QR önizlemesi için sol panelden masa ekleyin.</EmptyDescription>
            </EmptyHeader>
          </Empty>
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
                <Button variant="outline" aria-busy={exportState === 'working'} onClick={() => { void printAll() }} disabled={tables.length === 0 || exportState === 'working' || health.state === 'invalid' || health.state === 'checking'} title={health.state === 'invalid' ? health.message : undefined}>
                  <Printer data-icon="inline-start" />{exportState === 'working' ? 'Hazırlanıyor…' : 'Yazdır'}
                </Button>
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
              <Image src="/brand/masabu-logo-transparent.svg" alt="Masabu" width={60} height={13} style={{ height: 13, width: 'auto', display: 'block' }} />
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
