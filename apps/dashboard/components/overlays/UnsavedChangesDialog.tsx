'use client'

import { useEffect, useRef } from 'react'
import { I } from '../../lib/ui'

interface Props {
  title?: string
  description: string
  discardLabel?: string
  keepLabel?: string
  onKeepEditing: () => void
  onDiscard: () => void
}

export default function UnsavedChangesDialog({
  title = 'Kaydedilmemiş değişiklikler var',
  description,
  discardLabel = 'Değişiklikleri sil',
  keepLabel = 'Düzenlemeye dön',
  onKeepEditing,
  onDiscard,
}: Props) {
  const safeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    safeButtonRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onKeepEditing()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onKeepEditing])

  return (
    <div className="unsaved-dialog-overlay" role="presentation" onMouseDown={onKeepEditing}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="unsaved-dialog-title" aria-describedby="unsaved-dialog-description" className="unsaved-dialog" onMouseDown={(event) => event.stopPropagation()}>
        <div className="unsaved-dialog-icon"><I.undo size={18} /></div>
        <div>
          <div id="unsaved-dialog-title" className="unsaved-dialog-title">{title}</div>
          <p id="unsaved-dialog-description" className="unsaved-dialog-description">{description}</p>
        </div>
        <div className="unsaved-dialog-actions">
          <button type="button" className="unsaved-dialog-button unsaved-dialog-discard" onClick={onDiscard}>{discardLabel}</button>
          <button ref={safeButtonRef} type="button" className="unsaved-dialog-button unsaved-dialog-keep" onClick={onKeepEditing}>{keepLabel}</button>
        </div>
      </div>
    </div>
  )
}
