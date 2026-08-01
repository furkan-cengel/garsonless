'use client'

import type { TableTransferFeedback as Feedback } from './table-transfer-feedback-model'
import { canUndoTransfer } from './table-transfer-feedback-model'

export function TableTransferFeedback({
  feedback,
  onUndo,
  onDismiss,
}: {
  feedback: Feedback | null
  onUndo: () => void
  onDismiss: () => void
}) {
  if (!feedback) return null
  const isError = feedback.phase === 'error'
  const canUndo = canUndoTransfer(feedback)
  return (
    <div
      className="tb-transfer-feedback"
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      style={{
        position: 'fixed', right: 18, bottom: 46, zIndex: 170,
        width: 'min(420px, calc(100vw - 24px))', padding: '11px 12px 11px 14px',
        borderRadius: 10, boxShadow: '0 16px 48px rgba(0,0,0,.3)',
        display: 'flex', gap: 10, alignItems: 'center',
        background: isError ? 'var(--critical-bg)' : 'var(--night)',
        color: isError ? 'var(--critical)' : '#fff',
        border: isError ? '1px solid var(--critical)' : '1px solid transparent',
      }}
    >
      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 650 }}>{feedback.message}</span>
      {canUndo && (
        <button
          className="tb-transfer-feedback__action"
          type="button"
          onClick={onUndo}
          style={{ border: 0, background: 'transparent', color: isError ? 'var(--critical)' : '#ffd089', fontWeight: 750, cursor: 'pointer', padding: '6px 4px' }}
        >{isError ? 'Tekrar dene' : 'Geri al'}</button>
      )}
      <button
        className="tb-transfer-feedback__dismiss"
        type="button"
        aria-label="Bildirimi kapat"
        onClick={onDismiss}
        style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', border: 0, borderRadius: 7, background: 'rgba(255,255,255,.1)', color: 'currentColor', cursor: 'pointer', fontSize: 18 }}
      >×</button>
    </div>
  )
}
