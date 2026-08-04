'use client'

import { useState } from 'react'
import { BrewBar, InlineSpinner, LoadingStatus } from '@garsonless/ui/spinners'
import { I, IconButton, Tag, btnGhost, btnPrimary } from '../../lib/ui'
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
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(17,17,19,.5)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 12, padding: 24,
        width: 520, maxWidth: '100%', boxShadow: 'var(--shadow-pop)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 8, flexShrink: 0,
            display: 'grid', placeItems: 'center', background: 'var(--surface-2)',
            border: '1px solid var(--border)',
          }}>
            <I.upload size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 650 }}>Menüyü CSV’den içe aktar</div>
            <div style={{ marginTop: 4, color: 'var(--text-3)', fontSize: 12.5, lineHeight: 1.5 }}>
              Ürünleri eklemeden önce satırları kontrol edip sorunları göstereceğiz.
            </div>
          </div>
          <IconButton icon={<I.close size={15} />} ariaLabel="Kapat" onClick={onCancel} />
        </div>

        <button
          type="button"
          onClick={onChoose}
          onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            const file = event.dataTransfer.files[0]
            if (file) onFile(file)
          }}
          style={{
            width: '100%', minHeight: 156, borderRadius: 9,
            border: `1.5px dashed ${dragging ? 'var(--text)' : 'var(--border-strong)'}`,
            background: dragging ? 'var(--surface-2)' : 'var(--surface-inset)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 8, cursor: 'pointer', color: 'var(--text)',
          }}
        >
          <I.upload size={22} />
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>CSV dosyası seç</span>
          <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>En fazla 1.000 ürün ve 5 MB</span>
        </button>

        {error && (
          <div style={{
            marginTop: 12, padding: '9px 11px', borderRadius: 7,
            background: 'rgba(255,80,65,.08)', color: 'var(--critical)',
            fontSize: 12.5, lineHeight: 1.45,
          }}>
            {error}
          </div>
        )}

        <div style={{
          marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--divider)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>İlk kez mi aktarıyorsun?</div>
          <button type="button" onClick={onDownloadTemplate} style={btnGhost()}>
            Şablonu indir
          </button>
        </div>
      </div>
    </div>
  )
}

function CsvPreviewTable({ rows }: { rows: CsvPreviewRow[] }) {
  return (
    <div style={{ flex: 1, overflow: 'auto', marginBottom: 16 }}>
      <div className="csv-preview-grid" style={{
        padding: '8px 12px', background: 'var(--surface-2)',
        borderRadius: '8px 8px 0 0', border: '1px solid var(--border)',
        borderBottom: 'none', fontSize: 10.5, fontWeight: 500,
        letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text-3)',
      }}>
        <span>Satır</span>
        <span className="csv-preview-category">Kategori</span>
        <span>Ürün</span>
        <span className="csv-preview-price">Fiyat</span>
        <span>Durum</span>
      </div>
      <div style={{ border: '1px solid var(--border)', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
        {rows.map((row, index) => (
          <div key={row.sourceRow} className="csv-preview-grid" style={{
            padding: '8px 12px',
            borderBottom: index < rows.length - 1 ? '1px solid var(--divider)' : 'none',
            background: row.error ? 'rgba(255,80,65,.04)' : 'transparent',
            fontSize: 12.5,
          }}>
            <span style={{ color: 'var(--text-4)', fontFamily: "'Geist Mono', monospace" }}>{row.sourceRow}</span>
            <span className="csv-preview-category" style={{ color: 'var(--text-2)' }}>{row.category || '—'}</span>
            <span className="csv-preview-name" style={{ fontWeight: 500 }}>
              {row.name || '—'}
              <span className="csv-preview-mobile-meta">
                {row.category || 'Kategori yok'} · {!isNaN(row.price) ? `₺${row.price}` : 'Fiyat yok'}
              </span>
            </span>
            <span className="csv-preview-price" style={{ fontFamily: "'Geist Mono', monospace" }}>
              {!isNaN(row.price) ? `₺${row.price}` : '—'}
            </span>
            <span className="csv-preview-status" style={{
              color: row.error ? 'var(--critical)' : row.warning ? 'var(--warning)' : 'var(--positive)',
              fontWeight: 500,
            }}>
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
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(17,17,19,.5)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
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
      <div style={{
        background: 'var(--surface)', borderRadius: 12, padding: 24,
        width: 720, maxWidth: '100%', maxHeight: '86vh', display: 'flex', flexDirection: 'column',
        boxShadow: 'var(--shadow-pop)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 650, fontSize: 15 }}>İçe aktarma önizlemesi</div>
            <div style={{
              color: 'var(--text-3)', fontSize: 11.5, marginTop: 4,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {preview.fileName}
            </div>
          </div>
          <button type="button" onClick={onDownloadTemplate} style={btnGhost()}>
            Şablon indir
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <Tag tone="positive">{valid} hazır</Tag>
          {warnings > 0 && <Tag tone="warning">{warnings} eksik bilgi</Tag>}
          {invalid > 0 && <Tag tone="critical">{invalid} sorunlu</Tag>}
        </div>

        <CsvPreviewTable rows={preview.rows} />

        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14, lineHeight: 1.5 }}>
          Sorunlu satırlar atlanır. İçe aktarılan ürünler yayımlanır; gıda bilgileri işletme tarafından
          kontrol edilene kadar <strong style={{ color: 'var(--text)' }}>Bilgi eksik</strong> etiketi taşır.
        </div>

        {preview.importing && preview.importProgress && (
          <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {preview.importProgress.total > 0
              ? <BrewBar label="Menü içe aktarma ilerlemesi" progress={(preview.importProgress.done / preview.importProgress.total) * 100} />
              : <LoadingStatus label="Menü içe aktarılıyor…" />}
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {preview.importProgress.done}/{preview.importProgress.total} içe aktarıldı…
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel} disabled={preview.importing} style={btnGhost()}>
            İptal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={preview.importing || valid === 0}
            style={{ ...btnPrimary(), opacity: preview.importing || valid === 0 ? 0.55 : 1 }}
          >
            {preview.importing
              ? <><InlineSpinner size={13} color="var(--on-action)" />İçe aktarılıyor…</>
              : `${valid} ürünü içe aktar`}
          </button>
        </div>
      </div>
    </div>
  )
}
