'use client'

import { useId } from 'react'
import { I } from '../../lib/ui'
import { useModalDialogFocus } from './use-modal-dialog-focus'

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
  const dialogRef = useModalDialogFocus(onKeepEditing)
  const titleId = useId()
  const descriptionId = useId()

  return (
    <div className="unsaved-dialog-overlay" role="presentation" onMouseDown={onKeepEditing}>
      <div ref={dialogRef} tabIndex={-1} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} className="unsaved-dialog" onMouseDown={(event) => event.stopPropagation()}>
        <div className="unsaved-dialog-icon"><I.undo size={18} /></div>
        <div>
          <div id={titleId} className="unsaved-dialog-title">{title}</div>
          <p id={descriptionId} className="unsaved-dialog-description">{description}</p>
        </div>
        <div className="unsaved-dialog-actions">
          <button type="button" className="unsaved-dialog-button unsaved-dialog-discard" onClick={onDiscard}>{discardLabel}</button>
          <button data-dialog-initial-focus type="button" className="unsaved-dialog-button unsaved-dialog-keep" onClick={onKeepEditing}>{keepLabel}</button>
        </div>
      </div>
    </div>
  )
}
