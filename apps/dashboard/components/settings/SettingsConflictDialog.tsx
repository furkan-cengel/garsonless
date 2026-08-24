'use client'

import { useId } from 'react'
import { useModalDialogFocus } from '../overlays/use-modal-dialog-focus'
import type { SettingsConflictEventDetail } from './settings-conflict-state'

export default function SettingsConflictDialog({ conflict, onClose }: {
  conflict: SettingsConflictEventDetail
  onClose: () => void
}) {
  const dialogRef = useModalDialogFocus(onClose)
  const titleId = useId()
  const descriptionId = useId()
  return <div className="unsaved-dialog-overlay" role="presentation" onMouseDown={onClose}>
    <div ref={dialogRef} tabIndex={-1} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} className="unsaved-dialog" style={{ width: 'min(720px, calc(100vw - 24px))' }} onMouseDown={(event) => event.stopPropagation()}>
      <div style={{ gridColumn: '1 / -1' }}>
        <div id={titleId} className="unsaved-dialog-title">Sunucuda daha yeni ayarlar var</div>
        <p id={descriptionId} className="unsaved-dialog-description">Taslağınız korunuyor. Sunucudaki sürümü alabilir veya taslağınızı yeni revision üzerine yeniden uygulamaya hazırlayabilirsiniz.</p>
      </div>
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, maxHeight: '40vh', overflow: 'auto', fontSize: 11 }}>
        <div><strong>Sunucudaki değer</strong><pre style={{ overflow: 'auto', padding: 8, borderRadius: 8, background: 'var(--surface-2)' }}>{JSON.stringify(conflict.canonicalSettings, null, 2).slice(0, 2500)}</pre></div>
        <div><strong>Korunan taslak</strong><pre style={{ overflow: 'auto', padding: 8, borderRadius: 8, background: 'var(--surface-2)' }}>{JSON.stringify(conflict.draft, null, 2).slice(0, 2500)}</pre></div>
      </div>
      <div className="unsaved-dialog-actions" style={{ gridColumn: '1 / -1', flexWrap: 'wrap' }}>
        <button data-dialog-initial-focus type="button" className="unsaved-dialog-button" onClick={onClose}>Taslağa dön</button>
        <button type="button" className="unsaved-dialog-button unsaved-dialog-discard" onClick={() => window.location.reload()}>Sunucudaki sürümü al</button>
        <button type="button" className="unsaved-dialog-button unsaved-dialog-keep" onClick={() => { conflict.prepareReapply(); onClose() }}>Taslağı yeni revision’a hazırla</button>
      </div>
    </div>
  </div>
}
