'use client'

import { useEffect, useRef, useState } from 'react'
import type { OpenTableSessionView, PendingTableRequestView, TableItem } from './tables-builder-types'
import { AccessibleDialog } from './AccessibleDialog'
import { TableDetailPanel } from './TableDetailPanel'

type Presentation = 'desktop' | 'drawer' | 'sheet'

function usePresentation(): Presentation {
  const [presentation, setPresentation] = useState<Presentation>('desktop')
  useEffect(() => {
    const update = () => setPresentation(window.matchMedia('(max-width: 430px)').matches
      ? 'sheet'
      : window.matchMedia('(max-width: 1180px)').matches ? 'drawer' : 'desktop')
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return presentation
}

type Props = {
  restaurantId: string
  table: TableItem
  session: OpenTableSessionView | undefined
  pendingRequests: PendingTableRequestView[]
  now: number
  canCreateOrders: boolean
  onClose: () => void
  onNewOrder: () => void
  onTransferOrders: (orderIds: string[]) => void
  onTransferAll: () => void
  onSettle: () => void
  onCloseSession: () => void
  onResolveRequest: (requestId: string) => void
}

export default function TableDetailSurface(props: Props) {
  const presentation = usePresentation()
  const desktopSurfaceRef = useRef<HTMLElement>(null)
  const { onClose } = props
  useEffect(() => {
    if (presentation !== 'desktop') return
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [onClose, presentation])

  useEffect(() => {
    if (presentation === 'desktop') desktopSurfaceRef.current?.focus()
  }, [presentation, props.table.id])

  if (presentation === 'desktop') {
    return <aside ref={desktopSurfaceRef} tabIndex={-1} className="tb-table-detail-surface is-desktop" aria-labelledby="table-detail-title"><TableDetailPanel {...props} /></aside>
  }

  return (
    <AccessibleDialog
      labelledBy="table-detail-title"
      onClose={props.onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 210, display: 'flex', alignItems: presentation === 'sheet' ? 'flex-end' : 'stretch', justifyContent: 'flex-end', background: 'rgba(17,17,19,.36)', backdropFilter: 'blur(2px)' }}
    >
      <div className={`tb-table-detail-surface is-${presentation}`}><TableDetailPanel {...props} /></div>
    </AccessibleDialog>
  )
}
