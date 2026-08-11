'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FieldError } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { OpenTableSessionView, TableItem } from './tables-builder-types'
import { TABLE_OPERATIONAL_COPY, type TableOperationalState } from './tables-operation-model'
import {
  TABLES_NAV_ICONS,
  TABLES_NAV_STYLES,
  TablesMiniQR,
} from './tables-navigation-ui'

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
      <div className="mb-1 rounded-lg border bg-muted/30 p-2">
        <Input
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
          className="mb-1.5 h-7 text-xs"
        />
        <div className="mb-1.5 grid grid-cols-2 gap-1.5">
          <Input aria-label="Kat" value={floorDraft} maxLength={40} onChange={(event) => setFloorDraft(event.target.value)} placeholder="Kat" className="h-7 min-w-0 text-xs" />
          <Input aria-label="Alan" value={areaDraft} maxLength={40} onChange={(event) => setAreaDraft(event.target.value)} placeholder="Alan" className="h-7 min-w-0 text-xs" />
        </div>
        <div className="flex gap-1">
          <Button type="button" size="xs" disabled={busy} onClick={() => void commitRename()} className="flex-1">
            {busy ? <Spinner data-icon="inline-start" /> : React.cloneElement(TABLES_NAV_ICONS.check as React.ReactElement<{ size?: number }>, { size: 12 })}Kaydet
          </Button>
          <Button type="button" variant="outline" size="icon-xs" aria-label="Düzenlemeyi iptal et" onClick={() => { setEditing(false); setError(null) }}>
            {React.cloneElement(TABLES_NAV_ICONS.close as React.ReactElement<{ size?: number }>, { size: 12 })}
          </Button>
        </div>
        {error && <FieldError className="mt-1.5 text-xs">{error}</FieldError>}
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
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        {(hovered || active || menuOpen) && (
          <DropdownMenuTrigger
            aria-label={`${table.label} seçenekleri`}
            disabled={busy}
            onClick={(event) => event.stopPropagation()}
            render={<Button className="tb-tables__table-options absolute top-[7px] right-1.5" type="button" variant="outline" size="icon-xs" />}
          >
            {React.cloneElement(TABLES_NAV_ICONS.more as React.ReactElement<{ size?: number }>, { size: 13 })}
          </DropdownMenuTrigger>
        )}
        <DropdownMenuContent align="end" sideOffset={2} className="w-44">
          <DropdownMenuItem onClick={() => { setEditing(true); setError(null) }}>Masa bilgilerini düzenle</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" disabled={deleteDisabled} onClick={() => { setDeleteOpen(true); setError(null) }} title={deleteDisabled ? 'Açık adisyonu olan masa silinemez' : undefined}>Sil</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {error && <div style={{ margin: '3px 6px 4px 36px', fontSize: 11, color: 'var(--critical)' }}>{error}</div>}
      <AlertDialog open={deleteOpen} onOpenChange={(open) => { if (!busy) setDeleteOpen(open) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Masayı sil</AlertDialogTitle>
            <AlertDialogDescription><strong>{table.label}</strong> listeden kaldırılacak. Bu masanın QR bağlantısı artık kullanılamayacak.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={busy} onClick={() => { void commitDelete() }}>{busy && <Spinner data-icon="inline-start" />}Masayı sil</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
