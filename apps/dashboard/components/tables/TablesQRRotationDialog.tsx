'use client'

import { AppIconNodes } from '@garsonless/ui/icons'
import type { TableItem } from './tables-builder-types'
import { AccessibleDialog } from './AccessibleDialog'

export function TablesQRRotationDialog({
  table,
  rotating,
  error,
  onCancel,
  onConfirm,
}: {
  table: TableItem | null
  rotating: boolean
  error: string | null
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!table) return null

  return (
    <AccessibleDialog
      role="alertdialog"
      labelledBy="qr-rotation-title"
      describedBy="qr-rotation-description"
      onClose={onCancel}
      closeDisabled={rotating}
      style={{
        position: 'fixed', inset: 0, zIndex: 110, padding: 20,
        display: 'grid', placeItems: 'center',
        background: 'rgba(17,17,19,.46)', backdropFilter: 'blur(5px)',
      }}
    >
      <div
        style={{
          width: 'min(440px, 100%)', padding: 20,
          border: '1px solid var(--border)', borderRadius: 16,
          background: 'var(--surface)', boxShadow: '0 24px 80px rgba(0,0,0,.24)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span aria-hidden="true" style={{
            width: 38, height: 38, flexShrink: 0, borderRadius: 11,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--warning)', background: 'var(--warning-bg)',
          }}>
            {AppIconNodes.refresh}
          </span>
          <div style={{ minWidth: 0 }}>
            <div id="qr-rotation-title" style={{ fontSize: 16, fontWeight: 750 }}>
              {table.label} için yeni QR oluşturulsun mu?
            </div>
            <p id="qr-rotation-description" style={{ margin: '7px 0 0', color: 'var(--text-2)', fontSize: 13, lineHeight: 1.55 }}>
              Mevcut QR bağlantısı hemen iptal edilir. Masadaki eski baskılar artık menüyü açmaz; yeni QR’ı yeniden indirip kullanmanız gerekir.
            </p>
          </div>
        </div>

        {error && (
          <div role="alert" style={{
            marginTop: 16, padding: '10px 12px', borderRadius: 9,
            border: '1px solid rgba(180,35,24,.18)',
            color: 'var(--critical)', background: 'var(--critical-bg)',
            fontSize: 12.5, lineHeight: 1.45,
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button
            type="button"
            className="tb-hover"
            data-modal-initial-focus
            onClick={onCancel}
            disabled={rotating}
            style={{
              minHeight: 44, padding: '0 13px', borderRadius: 8,
              border: '1px solid var(--border-strong)', background: 'var(--surface)',
              color: 'var(--text)', fontSize: 12.5, fontWeight: 600,
              cursor: rotating ? 'not-allowed' : 'pointer',
            }}
          >Vazgeç</button>
          <button
            type="button"
            className="tb-hover"
            onClick={onConfirm}
            disabled={rotating}
            style={{
              minHeight: 44, padding: '0 14px', borderRadius: 8,
              border: '1px solid var(--critical)', background: 'var(--critical)',
              color: '#fff', fontSize: 12.5, fontWeight: 650,
              cursor: rotating ? 'wait' : 'pointer', opacity: rotating ? .72 : 1,
            }}
          >{rotating ? 'Oluşturuluyor…' : 'Eski QR’ı iptal et'}</button>
        </div>
      </div>
    </AccessibleDialog>
  )
}
