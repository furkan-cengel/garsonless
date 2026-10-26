'use client'

import type { QRConfig, QRHealth, SaveState, TableItem } from './tables-builder-types'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useTablesQRPropertiesModel } from './use-tables-qr-properties-model'
import { TablesQRPropertiesFooter, TablesQRPropertiesHeader } from './TablesQRPropertiesChrome'
import { TablesQRPropertiesSection } from './TablesQRPropertiesSections'

export function TablesQRProperties({
  qr,
  setQR,
  replaceQR,
  beginQRChange,
  tables,
  saveState,
  saveError,
  health,
  legacyLogoRejected,
  onRetry,
  history,
}: {
  qr: QRConfig
  setQR: (q: QRConfig) => void
  replaceQR: (q: QRConfig) => void
  beginQRChange: () => void
  tables: TableItem[]
  saveState: SaveState
  saveError: string | null
  health: QRHealth
  legacyLogoRejected: boolean
  onRetry: () => void
  history: { undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean }
}) {
  const model = useTablesQRPropertiesModel({ qr, setQR, replaceQR, beginQRChange })

  return (
    <div id="qr-design-panel" role="tabpanel" className="tb-tables__props flex shrink-0 flex-col border-l bg-background" style={{ width: 'var(--props)' }}>
      <TablesQRPropertiesHeader
        saveState={saveState}
        saveError={saveError}
        health={health}
        onRetry={onRetry}
      />
      <ScrollArea className="min-h-0 flex-1">
        <TablesQRPropertiesSection qr={qr} set={model.setField} tables={tables} legacyLogoRejected={legacyLogoRejected} advanced={model.advanced} onToggleAdvanced={model.toggleAdvanced} onApplyPreset={model.applyPreset} />
      </ScrollArea>
      <TablesQRPropertiesFooter tableCount={tables.length} onReset={model.reset} onUndo={history.undo} onRedo={history.redo} canUndo={history.canUndo} canRedo={history.canRedo} />
    </div>
  )
}
