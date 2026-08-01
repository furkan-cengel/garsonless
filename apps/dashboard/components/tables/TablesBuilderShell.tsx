'use client'

import dynamic from 'next/dynamic'
import { useState, type KeyboardEvent } from 'react'
import type { Tables } from '@garsonless/db/types'
import { AccessibleDialog } from './AccessibleDialog'
import { mapDBTables, MENU_ORIGIN } from './tables-builder-model'
import type { TableItem } from './tables-builder-types'
import { TablesMobilePreview, TablesStatusBar, TablesTopBar } from './TablesBuilderChrome'
import { TablesQRCanvas } from './TablesQRCanvas'
import { TablesQRTablePicker } from './TablesQRTablePicker'
import { TABLES_SHELL_CSS, TablesIconRail, TablesSectionTabs } from './TablesShellFrame'
import { validateRenderedQR } from './tables-qr-renderer'
import { useQRStyleEditor } from './use-qr-style-editor'
import { useTableQrTokenRotation } from './use-table-qr-token-rotation'

function DeferredDialogLoading() {
  return (
    <AccessibleDialog labelledBy="qr-dialog-loading-title" onClose={() => undefined} closeDisabled style={{ position: 'fixed', inset: 0, zIndex: 179, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.28)' }}>
      <span id="qr-dialog-loading-title" role="status" aria-live="polite" style={{ padding: '10px 14px', borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-pop)', fontWeight: 650 }}>Pencere hazırlanıyor…</span>
    </AccessibleDialog>
  )
}

const TablesQRRotationDialog = dynamic(() => import('./TablesQRRotationDialog').then((module) => module.TablesQRRotationDialog), {
  ssr: false,
  loading: DeferredDialogLoading,
})

const TablesQRProperties = dynamic(() => import('./TablesQRProperties').then((module) => module.TablesQRProperties), {
  loading: () => <aside className="tb-tables__props" aria-label="QR tasarım araçları" aria-busy="true" style={{ width: 'var(--props)', flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'var(--surface)', display: 'grid', placeItems: 'center' }}><span role="status">Tasarım araçları hazırlanıyor…</span></aside>,
})

interface Props {
  restaurantId: string
  restaurantName: string
  restaurantSlug: string
  initialTables: Tables<'tables'>[]
  initialQrTokens: Record<string, string>
  initialQRStyle?: unknown
  initialQRStyleRevision: number
}

export default function TablesBuilderShell({
  restaurantId,
  restaurantName,
  restaurantSlug,
  initialTables,
  initialQrTokens,
  initialQRStyle,
  initialQRStyleRevision,
}: Props) {
  const baseQRUrl = `${MENU_ORIGIN}/${restaurantSlug}`
  const [tables, setTables] = useState<TableItem[]>(() => mapDBTables(initialTables, [], initialQrTokens))
  const [activeId, setActiveId] = useState(() => tables[0]?.id ?? '')
  const [preview, setPreview] = useState<{ src: string; title: string } | null>(null)
  const [operationError, setOperationError] = useState<string | null>(null)
  const [qrTask, setQrTask] = useState<'preview' | 'design'>('preview')
  const activeTable = tables.find((table) => table.id === activeId)
  const onTaskTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = event.key === 'ArrowRight' || event.key === 'End' ? 'design' : 'preview'
    setQrTask(next)
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    buttons?.[next === 'preview' ? 0 : 1]?.focus()
  }
  const {
    qr,
    setQR,
    replaceQR,
    beginQRChange,
    undo,
    redo,
    canUndo,
    canRedo,
    saveState,
    saveError,
    retrySave: retryQRSave,
    health: qrHealth,
    legacyLogoRejected,
  } = useQRStyleEditor({
    restaurantId,
    baseUrl: baseQRUrl,
    initialStyle: initialQRStyle,
    initialRevision: initialQRStyleRevision,
    activeTable,
    validate: validateRenderedQR,
  })
  const qrTokenRotation = useTableQrTokenRotation({
    restaurantId,
    setTables,
    onError: setOperationError,
  })

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: TABLES_SHELL_CSS }} />
      <div className="tb-tables tb-tables--qr" data-qr-task={qrTask} style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)' }}>
        <TablesTopBar
          qr={qr}
          setQR={setQR}
          restaurantName={restaurantName}
          sectionTitle="QR Studio"
          saveState={saveState}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          onPreview={() => setPreview({ src: qr.baseUrl, title: 'Menü önizleme' })}
        />
        <div className="tb-tables__body">
          <TablesIconRail restaurantId={restaurantId} />
          <div className="tb-tables__content">
            <TablesSectionTabs restaurantId={restaurantId} active="qr" />
            {operationError && (
              <div role="alert" style={{ padding: '8px 14px', background: 'var(--critical-bg)', color: 'var(--critical)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flex: 1 }}>{operationError}</span>
                <button type="button" aria-label="QR hatasını kapat" onClick={() => setOperationError(null)} style={{ width: 32, height: 32, border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer' }}>×</button>
              </div>
            )}
            <div className="tb-tables__workspace" style={{ flex: 1, display: 'flex', minHeight: 0 }}>
              <div className="tb-qr-taskbar" role="tablist" aria-label="QR Studio görevi">
                <button type="button" role="tab" aria-selected={qrTask === 'preview'} aria-controls="qr-preview-panel" tabIndex={qrTask === 'preview' ? 0 : -1} onKeyDown={onTaskTabKeyDown} onClick={() => setQrTask('preview')}>Önizleme</button>
                <button type="button" role="tab" aria-selected={qrTask === 'design'} aria-controls="qr-design-panel" tabIndex={qrTask === 'design' ? 0 : -1} onKeyDown={onTaskTabKeyDown} onClick={() => setQrTask('design')}>Tasarım</button>
              </div>
              <TablesQRTablePicker restaurantId={restaurantId} tables={tables} activeId={activeId} setActiveId={setActiveId} />
              <TablesQRCanvas
                qr={qr}
                table={activeTable}
                tables={tables}
                health={qrHealth}
                rotationPending={qrTokenRotation.rotating}
                onRotateToken={qrTokenRotation.requestRotation}
              />
              <TablesQRProperties qr={qr} setQR={setQR} replaceQR={replaceQR} beginQRChange={beginQRChange} tables={tables} saveState={saveState} saveError={saveError} health={qrHealth} legacyLogoRejected={legacyLogoRejected} onRetry={retryQRSave} />
            </div>
            <TablesStatusBar saveState={saveState} saveError={saveError} onRetry={retryQRSave} tableCount={tables.length} />
          </div>
        </div>
        {preview && <TablesMobilePreview src={preview.src} title={preview.title} onClose={() => setPreview(null)} />}
        {qrTokenRotation.target && (
          <TablesQRRotationDialog
            table={qrTokenRotation.target}
            rotating={qrTokenRotation.rotating}
            error={qrTokenRotation.error}
            onCancel={qrTokenRotation.cancelRotation}
            onConfirm={() => { void qrTokenRotation.confirmRotation() }}
          />
        )}
      </div>
    </>
  )
}
