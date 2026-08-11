'use client'

import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress, ProgressLabel } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'

import { useState } from 'react'
import { I } from '../../lib/ui'
import type { CsvImportPreview, CsvPreviewRow } from './use-menu-csv-import'

export function CsvImportStartModal({
  error,
  onChoose,
  onFile,
  onCancel,
  onDownloadTemplate,
}: {
  error: string | null
  onChoose: () => void
  onFile: (file: File) => void
  onCancel: () => void
  onDownloadTemplate: () => void
}) {
  const [dragging, setDragging] = useState(false)

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <DialogContent className="w-[520px] max-w-[calc(100%-2rem)] sm:max-w-[520px]">
        <DialogHeader className="grid grid-cols-[auto_1fr] gap-x-3 pr-8">
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              flexShrink: 0,
              display: 'grid',
              placeItems: 'center',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
            }}
          >
            <I.upload size={18} />
          </div>
          <div className="min-w-0">
            <DialogTitle>Menüyü CSV’den içe aktar</DialogTitle>
            <DialogDescription className="mt-1">Ürünleri eklemeden önce satırları kontrol edip sorunları göstereceğiz.</DialogDescription>
          </div>
        </DialogHeader>

        <Button
          type="button"
          onClick={onChoose}
          onDragEnter={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            const file = event.dataTransfer.files[0]
            if (file) onFile(file)
          }}
          style={{
            width: '100%',
            minHeight: 156,
            borderRadius: 9,
            border: `1.5px dashed ${dragging ? 'var(--text)' : 'var(--border-strong)'}`,
            background: dragging ? 'var(--surface-2)' : 'var(--surface-inset)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            cursor: 'pointer',
            color: 'var(--text)',
          }}
        >
          <I.upload size={22} />
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>CSV dosyası seç</span>
          <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>En fazla 1.000 ürün ve 5 MB</span>
        </Button>

        {error && (
          <Alert variant="destructive">
            <I.warn />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter className="items-center sm:justify-between">
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>İlk kez mi aktarıyorsun?</div>
          <Button type="button" variant="outline" onClick={onDownloadTemplate}>
            Şablonu indir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CsvPreviewTable({ rows }: { rows: CsvPreviewRow[] }) {
  return (
    <div style={{ flex: 1, overflow: 'auto', marginBottom: 16 }}>
      <div
        className="csv-preview-grid"
        style={{
          padding: '8px 12px',
          background: 'var(--surface-2)',
          borderRadius: '8px 8px 0 0',
          border: '1px solid var(--border)',
          borderBottom: 'none',
          fontSize: 10.5,
          fontWeight: 500,
          letterSpacing: '.05em',
          textTransform: 'uppercase',
          color: 'var(--text-3)',
        }}
      >
        <span>Satır</span>
        <span className="csv-preview-category">Kategori</span>
        <span>Ürün</span>
        <span className="csv-preview-price">Fiyat</span>
        <span>Durum</span>
      </div>
      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: '0 0 8px 8px',
          overflow: 'hidden',
        }}
      >
        {rows.map((row, index) => (
          <div
            key={row.sourceRow}
            className="csv-preview-grid"
            style={{
              padding: '8px 12px',
              borderBottom: index < rows.length - 1 ? '1px solid var(--divider)' : 'none',
              background: row.error ? 'rgba(255,80,65,.04)' : 'transparent',
              fontSize: 12.5,
            }}
          >
            <span
              style={{
                color: 'var(--text-4)',
                fontFamily: "'Geist Mono', monospace",
              }}
            >
              {row.sourceRow}
            </span>
            <span className="csv-preview-category" style={{ color: 'var(--text-2)' }}>
              {row.category || '—'}
            </span>
            <span className="csv-preview-name" style={{ fontWeight: 500 }}>
              {row.name || '—'}
              <span className="csv-preview-mobile-meta">
                {row.category || 'Kategori yok'} · {!isNaN(row.price) ? `₺${row.price}` : 'Fiyat yok'}
              </span>
            </span>
            <span className="csv-preview-price" style={{ fontFamily: "'Geist Mono', monospace" }}>
              {!isNaN(row.price) ? `₺${row.price}` : '—'}
            </span>
            <span
              className="csv-preview-status"
              style={{
                color: row.error ? 'var(--critical)' : row.warning ? 'var(--warning)' : 'var(--positive)',
                fontWeight: 500,
              }}
            >
              {row.error ?? row.warning ?? 'Hazır'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CsvImportModal({
  preview,
  onConfirm,
  onCancel,
  onDownloadTemplate,
}: {
  preview: CsvImportPreview
  onConfirm: () => void
  onCancel: () => void
  onDownloadTemplate: () => void
}) {
  const valid = preview.rows.filter((row) => !row.error).length
  const invalid = preview.rows.length - valid
  const warnings = preview.rows.filter((row) => !row.error && row.warning).length

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !preview.importing) onCancel()
      }}
    >
      <style>{`
        .csv-preview-grid {
          display: grid;
          grid-template-columns: 44px 1fr 1fr 74px minmax(126px, 1.15fr);
        }
        .csv-preview-mobile-meta { display: none; }
        @media (max-width: 600px) {
          .csv-preview-grid {
            grid-template-columns: 34px minmax(0, 1fr) minmax(104px, .85fr);
          }
          .csv-preview-category,
          .csv-preview-price { display: none; }
          .csv-preview-mobile-meta {
            display: block;
            margin-top: 3px;
            color: var(--text-3);
            font-size: 10.5px;
            font-weight: 400;
          }
          .csv-preview-name,
          .csv-preview-status {
            min-width: 0;
            overflow-wrap: anywhere;
          }
        }
      `}</style>
      <DialogContent className="flex max-h-[86vh] w-[720px] max-w-[calc(100%-2rem)] flex-col sm:max-w-[720px]" showCloseButton={!preview.importing}>
        <DialogHeader className="grid grid-cols-[1fr_auto] items-start gap-3 pr-8">
          <div style={{ flex: 1, minWidth: 0 }}>
            <DialogTitle>İçe aktarma önizlemesi</DialogTitle>
            <DialogDescription className="mt-1 truncate text-xs">{preview.fileName}</DialogDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onDownloadTemplate}>
            Şablon indir
          </Button>
        </DialogHeader>

        <div
          style={{
            display: 'flex',
            gap: 8,
            marginBottom: 14,
            flexWrap: 'wrap',
          }}
        >
          <Badge variant="positive">{valid} hazır</Badge>
          {warnings > 0 && <Badge variant="warning">{warnings} eksik bilgi</Badge>}
          {invalid > 0 && <Badge variant="destructive">{invalid} sorunlu</Badge>}
        </div>

        <CsvPreviewTable rows={preview.rows} />

        <div
          style={{
            fontSize: 12,
            color: 'var(--text-3)',
            marginBottom: 14,
            lineHeight: 1.5,
          }}
        >
          Sorunlu satırlar atlanır. İçe aktarılan ürünler yayımlanır; gıda bilgileri işletme tarafından kontrol edilene kadar{' '}
          <strong style={{ color: 'var(--text)' }}>Bilgi eksik</strong> etiketi taşır.
        </div>

        {preview.importing && preview.importProgress && (
          <div
            style={{
              marginBottom: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {preview.importProgress.total > 0 ? (
              <Progress value={(preview.importProgress.done / preview.importProgress.total) * 100}>
                <ProgressLabel>Menü içe aktarma ilerlemesi</ProgressLabel>
                <span className="ml-auto text-sm text-muted-foreground tabular-nums">
                  {preview.importProgress.done}/{preview.importProgress.total}
                </span>
              </Progress>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner />
                Menü içe aktarılıyor…
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={preview.importing}>
            İptal
          </Button>
          <Button type="button" onClick={onConfirm} disabled={preview.importing || valid === 0}>
            {preview.importing ? (
              <>
                <Spinner data-icon="inline-start" />
                İçe aktarılıyor…
              </>
            ) : (
              `${valid} ürünü içe aktar`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
