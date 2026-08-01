'use client'

import { useState } from 'react'
import { InlineSpinner } from '@garsonless/ui'
import { AppIcons } from '@garsonless/ui/icons'
import type { TableItem } from './tables-builder-types'
import { AccessibleDialog } from './AccessibleDialog'

export function TablePropertiesDialog({
  table,
  allowDelete,
  initialDelete = false,
  onClose,
  onSave,
  onDelete,
}: {
  table: TableItem
  allowDelete: boolean
  initialDelete?: boolean
  onClose: () => void
  onSave: (input: { label: string; floorLabel: string; areaLabel: string }) => Promise<string | null>
  onDelete: () => Promise<string | null>
}) {
  const [label, setLabel] = useState(table.label)
  const [floorLabel, setFloorLabel] = useState(table.floorLabel ?? '')
  const [areaLabel, setAreaLabel] = useState(table.areaLabel ?? '')
  const [busy, setBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(initialDelete)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (!label.trim()) {
      setError('Masa adı boş bırakılamaz.')
      return
    }
    setBusy(true)
    setError(null)
    const nextError = await onSave({ label: label.trim(), floorLabel, areaLabel })
    setBusy(false)
    if (nextError) {
      setError(nextError)
      return
    }
    onClose()
  }

  const remove = async () => {
    setBusy(true)
    setError(null)
    const nextError = await onDelete()
    setBusy(false)
    if (nextError) {
      setError(nextError)
      return
    }
    onClose()
  }

  return (
    <AccessibleDialog
      labelledBy="table-properties-title"
      describedBy="table-properties-description"
      onClose={onClose}
      closeDisabled={busy}
      style={{ position: 'fixed', inset: 0, zIndex: 230, display: 'grid', placeItems: 'center', padding: 20, background: 'rgba(17,17,19,.44)', backdropFilter: 'blur(3px)' }}
    >
      <div className="tb-properties-dialog">
        <header>
          <div>
            <strong id="table-properties-title">Masa bilgilerini düzenle</strong>
            <span id="table-properties-description">Masa adı, kat ve alan bilgisi hem listede hem salon planında güncellenir.</span>
          </div>
          <button data-modal-initial-focus type="button" disabled={busy} aria-label="Masa bilgileri penceresini kapat" onClick={onClose}><AppIcons.close size={16} /></button>
        </header>
        <div className="tb-properties-dialog__body">
          <label>Masa adı<input value={label} maxLength={50} onChange={(event) => setLabel(event.target.value)} /></label>
          <div className="tb-properties-dialog__locations">
            <label>Kat<input value={floorLabel} maxLength={40} onChange={(event) => setFloorLabel(event.target.value)} placeholder="Örn. Zemin" /></label>
            <label>Alan<input value={areaLabel} maxLength={40} onChange={(event) => setAreaLabel(event.target.value)} placeholder="Örn. Salon" /></label>
          </div>
          {error && <div role="alert" className="tb-properties-dialog__error">{error}</div>}
          {confirmingDelete && (
            <div role="alert" className="tb-properties-dialog__delete-confirm">
              <strong>{table.label} silinsin mi?</strong>
              <span>Bu masanın QR bağlantısı artık kullanılamaz. Bu işlem yalnız açık adisyon yoksa kabul edilir.</span>
              <div>
                <button type="button" disabled={busy} onClick={() => setConfirmingDelete(false)}>Vazgeç</button>
                <button type="button" disabled={busy} onClick={() => { void remove() }}>{busy ? 'Siliniyor…' : 'Evet, sil'}</button>
              </div>
            </div>
          )}
        </div>
        {!confirmingDelete && <footer>
          {allowDelete && <button type="button" disabled={busy} className="is-destructive" onClick={() => setConfirmingDelete(true)}><AppIcons.trash size={14} />Masayı sil</button>}
          <span />
          <button type="button" disabled={busy} onClick={onClose}>İptal</button>
          <button type="button" disabled={busy} className="is-primary" onClick={() => { void save() }}>
            {busy ? <InlineSpinner size={12} color="var(--on-action)" /> : <AppIcons.check size={14} />}Kaydet
          </button>
        </footer>}
      </div>
    </AccessibleDialog>
  )
}
