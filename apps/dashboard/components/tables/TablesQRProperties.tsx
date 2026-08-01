'use client'

import type { QRConfig, QRHealth, SaveState, TableItem } from './tables-builder-types'
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
    <div id="qr-design-panel" role="tabpanel" className="tb-tables__props" style={{
      width: 'var(--props)', flexShrink: 0,
      borderLeft: '1px solid var(--border)', background: 'var(--surface)',
      display: 'flex', flexDirection: 'column',
    }}>
      <TablesQRPropertiesHeader
        status={model.status}
        saveState={saveState}
        saveError={saveError}
        health={health}
        onRetry={onRetry}
      />
      <TablesQRPropertiesTabs tab={model.tab} onChange={model.setTab} />
      <div
        id="qr-properties-panel"
        role="tabpanel"
        aria-labelledby={`qr-properties-tab-${model.tab}`}
        style={{ flex: 1, overflowY: 'auto' }}
      >
        <TablesQRPropertiesSection tab={model.tab} qr={qr} set={model.setField} tables={tables} legacyLogoRejected={legacyLogoRejected} />
      </div>
      <TablesQRPropertiesFooter tableCount={tables.length} onReset={model.reset} />
    </div>
  )
}
