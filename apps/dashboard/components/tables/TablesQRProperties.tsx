'use client'

import type { QRConfig, QRHealth, SaveState, TableItem } from './tables-builder-types'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { useTablesQRPropertiesModel } from './use-tables-qr-properties-model'
import {
  TablesQRPropertiesFooter,
  TablesQRPropertiesHeader,
  TablesQRPropertiesTabs,
} from './TablesQRPropertiesChrome'
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
}) {
  const model = useTablesQRPropertiesModel({ qr, setQR, replaceQR, beginQRChange, saveState })

  return (
    <div id="qr-design-panel" role="tabpanel" className="tb-tables__props flex shrink-0 flex-col border-l bg-background" style={{ width: 'var(--props)' }}>
      <TablesQRPropertiesHeader
        status={model.status}
        saveState={saveState}
        saveError={saveError}
        health={health}
        onRetry={onRetry}
      />
      <Tabs value={model.tab} onValueChange={(value) => model.setTab(value as typeof model.tab)} className="min-h-0 flex-1 gap-0">
        <TablesQRPropertiesTabs activeTab={model.tab} onChange={model.setTab} />
        <ScrollArea className="min-h-0 flex-1">
          <TabsContent value={model.tab} id="qr-properties-panel" className="m-0">
            <TablesQRPropertiesSection tab={model.tab} qr={qr} set={model.setField} tables={tables} legacyLogoRejected={legacyLogoRejected} />
          </TabsContent>
        </ScrollArea>
      </Tabs>
      <TablesQRPropertiesFooter tableCount={tables.length} onReset={model.reset} />
    </div>
  )
}
