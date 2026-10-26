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
import { formatTableMoney, sessionDuration, TABLE_OPERATIONAL_COPY, type TableOperationalState } from './tables-operation-model'
import { TABLES_NAV_ICONS } from './tables-navigation-ui'
import { AppIcons } from '@garsonless/ui/icons'
import { TableStatusBadge } from './TableStatusBadge'

export interface TableRowActions {
  canCreateOrders: boolean
  onNewOrder: (tableId: string) => void
  onSettle: (session: OpenTableSessionView, label: string) => void
  onCloseSession: (session: OpenTableSessionView, label: string) => void
  onTransfer: (mode: 'table_move' | 'account_transfer', tableId: string) => void
  onPrefetchTransfer: (tableId: string) => void
}

/** Second row line: the bill while a session is open, otherwise where the table is and that it is free. */
function rowSummary(table: TableItem, session: OpenTableSessionView | undefined, now: number) {
  if (!session) {
    const location = [table.floorLabel, table.areaLabel].filter(Boolean).join(' · ')
    return `${location ? `${location} · ` : ''}${table.seatCount} kişilik · müsait`
  }
  const parts = [`${session.orderCount} sipariş`, sessionDuration(session.openedAt, now)]
  if (session.unpaidTotal > 0) parts.push(`${formatTableMoney(session.unpaidTotal)} açık`)
  else if (session.orderCount > 0) parts.push(`${formatTableMoney(session.total)} ödendi`)
  if (session.splitDeclaredCashTotal > 0) parts.push(`${formatTableMoney(session.splitDeclaredCashTotal)} nakit onayı`)
  return parts.join(' · ')
}

export function TablesNavigationTableRow({
  table,
  operationalState,
  session,
  requestCount,
  now,
  active,
  onClick,
  onRename,
  onDelete,
  deleteDisabled,
  actions,
}: {
  table: TableItem
  operationalState: TableOperationalState
  session: OpenTableSessionView | undefined
  requestCount: number
  now: number
  active: boolean
  onClick: () => void
  onRename: (input: { label: string; floorLabel: string; areaLabel: string }) => Promise<string | null>
  onDelete: () => Promise<string | null>
  deleteDisabled: boolean
  actions: TableRowActions
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(table.label)
  const [floorDraft, setFloorDraft] = useState(table.floorLabel ?? '')
  const [areaDraft, setAreaDraft] = useState(table.areaLabel ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
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
          <Button type="button" size="xs" aria-busy={busy} disabled={busy} onClick={() => void commitRename()} className="flex-1">
            {busy ? <Spinner aria-hidden="true" data-icon="inline-start" /> : React.cloneElement(TABLES_NAV_ICONS.check as React.ReactElement<{ size?: number }>, { size: 12 })}{busy ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
          <Button type="button" variant="outline" size="icon-xs" aria-label="Düzenlemeyi iptal et" onClick={() => { setEditing(false); setError(null) }}>
            {React.cloneElement(TABLES_NAV_ICONS.close as React.ReactElement<{ size?: number }>, { size: 12 })}
          </Button>
        </div>
        {error && <FieldError className="mt-1.5 text-xs">{error}</FieldError>}
      </div>
    )
  }

  // One direct action per row, chosen by what the table needs next; the rest live in the menu.
  const quick = !session
    ? actions.canCreateOrders ? { label: 'Sipariş', aria: `${table.label} için sipariş başlat`, tone: '', run: () => actions.onNewOrder(table.id) } : null
    : operationalState === 'paid'
      ? { label: 'Kapat', aria: `${table.label} adisyonunu kapat`, tone: ' is-positive', run: () => actions.onCloseSession(session, table.label) }
      : session.orderCount === 0
        ? actions.canCreateOrders ? { label: 'Sipariş', aria: `${table.label} için sipariş ekle`, tone: '', run: () => actions.onNewOrder(table.id) } : null
        : { label: 'Tahsilat', aria: `${table.label} için tahsilat`, tone: ' is-primary', run: () => actions.onSettle(session, table.label) }
  const prefetch = () => { if (session) actions.onPrefetchTransfer(table.id) }

  return (
    <div className="tb-row-wrap">
      <div className={`tb-row${active ? ' is-active' : ''}${menuOpen ? ' is-menu-open' : ''}`}>
        <button
          type="button"
          className="tb-row__main"
          onClick={onClick}
          aria-pressed={active}
          aria-label={`${table.label}, ${TABLE_OPERATIONAL_COPY[operationalState]}, ${rowSummary(table, session, now)}${requestCount > 0 ? `, ${requestCount} servis isteği` : ''}`}
        >
          <span className="tb-row__top">
            <strong>{table.label}</strong>
            <TableStatusBadge state={operationalState} />
            {requestCount > 0 && <span className="tb-row__request" title={`${requestCount} servis isteği`}>{TABLES_NAV_ICONS.bellSmall}</span>}
          </span>
          <span className="tb-row__line">{rowSummary(table, session, now)}</span>
        </button>
        {!quick && !actions.canCreateOrders && operationalState !== 'paid' && (
          <button type="button" className="tb-row__quick is-locked" aria-disabled="true" title="Sipariş açma yetkin yok; restoran sahibi bu yetkiyi verebilir." aria-label={`${table.label} için sipariş başlatma yetkin yok`}><AppIcons.lock size={12} />Sipariş</button>
        )}
        {quick && (
          <button type="button" className={`tb-row__quick${quick.tone}`} aria-label={quick.aria} onPointerEnter={prefetch} onFocus={prefetch} onClick={(event) => { event.stopPropagation(); quick.run() }}>{quick.label}</button>
        )}
        <DropdownMenu open={menuOpen} onOpenChange={(open) => { setMenuOpen(open); if (open) prefetch() }}>
          <DropdownMenuTrigger
            aria-label={`${table.label} seçenekleri`}
            disabled={busy}
            onClick={(event) => event.stopPropagation()}
            render={<Button className="tb-tables__table-options" type="button" variant="ghost" size="icon-xs" />}
          >
            {React.cloneElement(TABLES_NAV_ICONS.more as React.ReactElement<{ size?: number }>, { size: 15 })}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={2} className="w-52">
            {session && <>
              <DropdownMenuItem onClick={() => actions.onTransfer('table_move', table.id)}>Masayı taşı</DropdownMenuItem>
              <DropdownMenuItem onClick={() => actions.onTransfer('account_transfer', table.id)}>Ürün veya hesap taşı</DropdownMenuItem>
              {operationalState !== 'paid' && <DropdownMenuItem onClick={() => actions.onCloseSession(session, table.label)}>Adisyonu kapat</DropdownMenuItem>}
              <DropdownMenuSeparator />
            </>}
            <DropdownMenuItem onClick={() => { setEditing(true); setError(null) }}>Masa bilgilerini düzenle</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" disabled={deleteDisabled} onClick={() => { setDeleteOpen(true); setError(null) }} title={deleteDisabled ? 'Açık adisyonu olan masa silinemez' : undefined}>Sil</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {error && <div className="tb-row__error">{error}</div>}
      <AlertDialog open={deleteOpen} onOpenChange={(open) => { if (!busy) setDeleteOpen(open) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Masayı sil</AlertDialogTitle>
            <AlertDialogDescription><strong>{table.label}</strong> listeden kaldırılacak. Bu masanın QR bağlantısı artık kullanılamayacak.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction variant="destructive" aria-busy={busy} disabled={busy} onClick={() => { void commitDelete() }}>{busy && <Spinner aria-hidden="true" data-icon="inline-start" />}{busy ? 'Siliniyor…' : 'Masayı sil'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
