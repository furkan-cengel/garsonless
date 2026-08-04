'use client'

import { InlineSpinner } from '@garsonless/ui/spinners'

import { I, btnGhost } from '../../lib/ui'

export function MenuConfirmDialog({
  title,
  message,
  confirmLabel = 'Sil',
  cancelLabel = 'Vazgeç',
  loading = false,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(17,17,19,.42)', zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 18, backdropFilter: 'blur(4px)',
      }}
    >
      <div style={{
        background: 'var(--surface)', borderRadius: 14, padding: 18, width: 'min(390px, 100%)',
        boxShadow: 'var(--shadow-pop)', border: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'var(--critical-bg)', color: 'var(--critical)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <I.trash size={17} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{title}</div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>{message}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <button type="button" onClick={onCancel} disabled={loading} style={btnGhost()}>{cancelLabel}</button>
          <button
            type="button"
            aria-busy={loading}
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: '7px 14px', borderRadius: 7, border: 'none',
              background: 'var(--critical)', color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: loading ? 'default' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              opacity: loading ? .72 : 1,
            }}
          >
            {loading ? <InlineSpinner size={13} color="#fff" /> : <I.trash size={13} />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
