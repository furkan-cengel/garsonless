import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('.', import.meta.url))
const shell = readFileSync(`${directory}/TablesBuilderShell.tsx`, 'utf8')
const operationsShell = readFileSync(`${directory}/TablesOperationsShell.tsx`, 'utf8')
const frame = readFileSync(`${directory}/TablesShellFrame.tsx`, 'utf8')
const mobileStyles = readFileSync(`${directory}/tables-builder-mobile-styles.ts`, 'utf8')
const navigationRow = readFileSync(`${directory}/TablesNavigationTableRow.tsx`, 'utf8')
const responsiveNavigation = readFileSync(`${directory}/TablesResponsiveNavigation.tsx`, 'utf8')
const transfer = readFileSync(`${directory}/TableTransferDialog.tsx`, 'utf8')

test('mobile tables operations enforce reachable 44px controls without a nested page scroller', () => {
  assert.match(frame, /TABLES_MOBILE_STYLES/)
  assert.match(operationsShell, /tb-tables--operations/)
  assert.match(frame, /\.tb-tables__section-tab \{ min-height: 44px/)
  assert.match(mobileStyles, /\.tb-tables__nav button,[\s\S]*min-height: 44px !important/)
  assert.match(mobileStyles, /\.tb-tables__workspace \{[\s\S]*overflow: visible !important/)
  assert.match(frame, /\.tb-tables__nav-desktop-content \{ display: none; \}/)
  assert.match(frame, /\.tb-tables__nav-mobile-actions \{ display: grid;/)
  assert.match(frame, /\.tb-mobile-navigation__panel\.is-list \{ height: 86dvh;/)
  assert.match(frame, /\.tb-mobile-navigation__panel \.tb-tables__search \{ height: 44px !important;/)
  assert.match(mobileStyles, /\.tb-tables__filters select,[\s\S]*min-height: 44px !important/)
  assert.match(mobileStyles, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/)
  assert.match(mobileStyles, /@media \(max-width: 760px\)[\s\S]*\.tb-tables__rail \{[\s\S]*position: fixed !important/)
  assert.match(mobileStyles, /padding-bottom: calc\(58px \+ env\(safe-area-inset-bottom\)\)/)
  assert.match(frame, /@media \(max-width: 360px\)[\s\S]*grid-template-columns: minmax\(0, 1fr\)/)
  // Each row keeps one direct action next to the menu; the panel's 44px rule covers both.
  assert.match(navigationRow, /className=\{`tb-row__quick\$\{quick\.tone\}`\}/)
  assert.match(frame, /\.tb-mobile-navigation__panel button \{ min-height: 44px; \}/)
  assert.match(responsiveNavigation, /labelledBy="tables-mobile-navigation-title"/)
  assert.match(responsiveNavigation, /renderList\(closePanel\)/)
  assert.match(responsiveNavigation, /activeFilterCount/)
})

test('mobile QR uses task surfaces, compact table selection and reachable actions', () => {
  assert.match(shell, /tb-tables--qr/)
  assert.match(shell, /className="tb-qr-taskbar"/)
  assert.match(shell, /data-qr-task=\{qrTask\}/)
  assert.match(mobileStyles, /\.tb-qr-mobile-selector \{[\s\S]*display: flex/)
  assert.match(mobileStyles, /data-qr-task='preview'[\s\S]*data-qr-task='design'/)
  assert.match(mobileStyles, /\.tb-tables__canvas-toolbar-actions \{[\s\S]*flex-wrap: nowrap;[\s\S]*overflow-x: auto/)
  assert.match(mobileStyles, /\.tb-tables__canvas-toolbar button \{[\s\S]*min-height: 44px !important/)
  assert.match(mobileStyles, /scroll-padding-inline: 12px/)
  assert.match(readFileSync(`${directory}/TablesQRPropertiesChrome.tsx`, 'utf8'), /scrollIntoView\(\{ block: 'nearest', inline: 'nearest' \}\)/)
})

test('transfer keeps one shadcn scroll owner with a fixed dialog footer', () => {
  assert.match(transfer, /className="tb-transfer-dialog-panel/)
  assert.match(transfer, /className="tb-transfer-dialog-scroll/)
  assert.match(transfer, /className="tb-transfer-dialog-submit/)
  assert.match(transfer, /<ScrollArea/)
  assert.match(transfer, /<DialogFooter/)
  assert.doesNotMatch(transfer, /position:'sticky',bottom:0/)
})
