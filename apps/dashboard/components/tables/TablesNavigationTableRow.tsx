'use client'

import React, { useEffect, useState } from 'react'
import { InlineSpinner } from '@garsonless/ui'
import type { OpenTableSessionView, TableItem } from './tables-builder-types'
import { TABLE_OPERATIONAL_COPY, type TableOperationalState } from './tables-operation-model'
import {
  TABLES_NAV_ICONS,
  TABLES_NAV_STYLES,
  TablesMiniQR,
  tablesNavGhostButton,
  tablesNavPrimaryButton,
} from './tables-navigation-ui'

function DeleteTableDialog({
  label,
  busy,
  onCancel,
  onConfirm,
}: {
  label: string
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, onCancel])
  return (
    <div onClick={() => { if (!busy) onCancel() }} style={{ position: 'fixed', inset: 0, zIndex: 90, padding: 20, display: 'grid', placeItems: 'center', background: 'rgba(17,17,19,.48)', backdropFilter: 'blur(4px)' }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="delete-table-title" aria-describedby="delete-table-description" onClick={(event) => event.stopPropagation()} style={{ width: 'min(420px, 100%)', padding: 20, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-pop)' }}>
        <div id="delete-table-title" style={{ fontSize: 16, fontWeight: 750 }}>Masayı sil</div>
        <div id="delete-table-description" style={{ marginTop: 8, color: 'var(--text-2)', fontSize: 12.5, lineHeight: 1.55 }}>
          <strong>{label}</strong> listeden kaldırılacak. Bu masanın tahmin edilemez QR bağlantısı artık kullanılamayacak.
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button type="button" autoFocus disabled={busy} onClick={onCancel} style={tablesNavGhostButton()}>Vazgeç</button>
          <button type="button" disabled={busy} onClick={onConfirm} style={{ ...tablesNavPrimaryButton(), background: 'var(--critical)', opacity: busy ? 0.6 : 1 }}>
            {busy ? <><InlineSpinner size={12} color="#fff" /> Siliniyor…</> : 'Masayı sil'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function TablesNavigationTableRow({
  table,
  operationalState,
  session,
  active,
  onClick,
  onRename,
  onDelete,
  deleteDisabled,
}: {
  table: TableItem
  operationalState: TableOperationalState
  session: OpenTableSessionView | undefined
  active: boolean
  onClick: () => void
  onRename: (input: { label: string; floorLabel: string; areaLabel: string }) => Promise<string | null>
  onDelete: () => Promise<string | null>
  deleteDisabled: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(table.label)
  const [floorDraft, setFloorDraft] = useState(table.floorLabel ?? '')
  const [areaDraft, setAreaDraft] = useState(table.areaLabel ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const dotColor = operationalState === 'late'
    ? 'var(--critical)'
    : operationalState === 'open'
      ? 'var(--positive)'
      : operationalState === 'new'
        ? 'var(--warning)'
        : 'var(--text-4)'
  const statusColor = operationalState === 'late'
    ? 'var(--critical)'
    : operationalState === 'open'
      ? 'var(--positive)'
      : operationalState === 'new'
        ? 'var(--warning)'
        : 'var(--text-3)'

  useEffect(() => {
    if (!editing) {
      setDraft(table.label)
      setFloorDraft(table.floorLabel ?? '')
      setAreaDraft(table.areaLabel ?? '')
    }
  }, [editing, table.areaLabel, table.floorLabel, table.label])

  const commitRename = async () => {
    const nextLabel = draft.trim()
    if (!nextLabel) return
    if (
      nextLabel === table.label
      && floorDraft.trim() === (table.floorLabel ?? '')
      && areaDraft.trim() === (table.areaLabel ?? '')
    ) {
      setEditing(false)
      return
    }
    setBusy(true)
    setError(null)
    const nextError = await onRename({ label: nextLabel, floorLabel: floorDraft, areaLabel: areaDraft })
    setBusy(false)
    if (nextError) {
      setError(nextError)
      return
    }
    setEditing(false)
  }

  const commitDelete = async () => {
    if (deleteDisabled) {
      setError('Bu masada açık adisyon var. Önce adisyonu kapatın.')
      setMenuOpen(false)
      return
    }
    setBusy(true)
    setError(null)
    const nextError = await onDelete()
    setBusy(false)
    if (nextError) {
      setError(nextError)
      return
    }
    setDeleteOpen(false)
  }

  if (editing) {
    return (
      <div style={{ padding: 8, marginBottom: 3, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8 }}>
        <input
          aria-label="Masa adı"
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void commitRename()
            if (event.key === 'Escape') {
              setEditing(false)
              setError(null)
            }
          }}
          style={{ width: '100%', height: 28, padding: '0 8px', marginBottom: 6, border: '1px solid var(--border-strong)', borderRadius: 6, outline: 'none', fontSize: 12.5 }}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
          <input aria-label="Kat" value={floorDraft} maxLength={40} onChange={(event) => setFloorDraft(event.target.value)} placeholder="Kat" style={{ width: '100%', minWidth: 0, height: 30, padding: '0 8px', border: '1px solid var(--border-strong)', borderRadius: 6, outline: 'none', fontSize: 11.5 }} />
          <input aria-label="Alan" value={areaDraft} maxLength={40} onChange={(event) => setAreaDraft(event.target.value)} placeholder="Alan" style={{ width: '100%', minWidth: 0, height: 30, padding: '0 8px', border: '1px solid var(--border-strong)', borderRadius: 6, outline: 'none', fontSize: 11.5 }} />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button type="button" disabled={busy} onClick={() => void commitRename()} style={{ ...tablesNavPrimaryButton(), height: 26, fontSize: 11.5, padding: '0 10px', flex: 1, opacity: busy ? 0.6 : 1 }}>
            {busy ? <><InlineSpinner size={11} color="var(--on-action)" /> Kaydediliyor…</> : <>{React.cloneElement(TABLES_NAV_ICONS.check as React.ReactElement<{ size?: number }>, { size: 12 })}Kaydet</>}
          </button>
          <button type="button" onClick={() => { setEditing(false); setError(null) }} style={{ ...tablesNavGhostButton(), height: 26, fontSize: 11.5, padding: '0 10px' }}>
            {React.cloneElement(TABLES_NAV_ICONS.close as React.ReactElement<{ size?: number }>, { size: 12 })}
          </button>
        </div>
        {error && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--critical)' }}>{error}</div>}
      </div>
    )
  }

  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ position: 'relative', marginBottom: 1 }}>
      <button
        onClick={onClick}
        aria-label={`${table.label}, ${TABLE_OPERATIONAL_COPY[operationalState]}${session ? `, ${session.orderCount} sipariş` : ''}`}
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 8px', background: active ? 'var(--surface-inset)' : (hovered || menuOpen ? 'var(--surface-3)' : 'transparent'), border: 'none', borderRadius: 7, cursor: 'pointer', textAlign: 'left' }}
      >
        <div style={{ width: 26, height: 26, borderRadius: 5, background: '#fff', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <TablesMiniQR seed={table.slug} />
        </div>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          <span style={{ fontSize: 13, fontWeight: active ? 600 : 500, color: 'var(--text)' }}>{table.label}</span>
          <span style={{ fontSize: 10.5, color: statusColor, marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: operationalState === 'late' ? 750 : 550 }}>
            <span style={{ width: 5, height: 5, borderRadius: 999, background: dotColor }} />
            {TABLE_OPERATIONAL_COPY[operationalState]}
            {session && ` · ${session.orderCount} sipariş`}
          </span>
          {(table.floorLabel || table.areaLabel) && (
            <span style={{ fontSize: 9.5, color: 'var(--text-4)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {[table.floorLabel, table.areaLabel].filter(Boolean).join(' · ')}
            </span>
          )}
        </span>
        <span style={{ ...TABLES_NAV_STYLES.mono, fontSize: 10, color: 'var(--text-4)', marginRight: hovered || active || menuOpen ? 28 : 0 }}>/{table.slug}</span>
      </button>
      {(hovered || active || menuOpen) && (
        <button
          className="tb-tables__table-options"
          type="button"
          aria-label={`${table.label} seçenekleri`}
          disabled={busy}
          onClick={(event) => { event.stopPropagation(); setMenuOpen((open) => !open) }}
          style={{ position: 'absolute', top: 7, right: 6, width: 24, height: 24, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: busy ? 'default' : 'pointer' }}
        >
          {React.cloneElement(TABLES_NAV_ICONS.more as React.ReactElement<{ size?: number }>, { size: 13 })}
        </button>
      )}
      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 4 }} />
          <div style={{ position: 'absolute', top: 34, right: 4, zIndex: 5, minWidth: 160, padding: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-pop)' }}>
            <button type="button" onClick={() => { setMenuOpen(false); setEditing(true); setError(null) }} style={{ width: '100%', border: 'none', background: 'transparent', borderRadius: 5, padding: '7px 9px', textAlign: 'left', fontSize: 12, color: 'var(--text)', cursor: 'pointer' }}>Masa bilgilerini düzenle</button>
            <button
              type="button"
              disabled={deleteDisabled}
              onClick={() => { setMenuOpen(false); setDeleteOpen(true); setError(null) }}
              style={{ width: '100%', border: 'none', background: 'transparent', borderRadius: 5, padding: '7px 9px', textAlign: 'left', fontSize: 12, color: deleteDisabled ? 'var(--text-4)' : 'var(--critical)', cursor: deleteDisabled ? 'default' : 'pointer' }}
              title={deleteDisabled ? 'Açık adisyonu olan masa silinemez' : undefined}
            >Sil</button>
          </div>
        </>
      )}
      {error && <div style={{ margin: '3px 6px 4px 36px', fontSize: 11, color: 'var(--critical)' }}>{error}</div>}
      {deleteOpen && (
        <DeleteTableDialog label={table.label} busy={busy} onCancel={() => setDeleteOpen(false)} onConfirm={() => { void commitDelete() }} />
      )}
    </div>
  )
}
