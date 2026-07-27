import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('.', import.meta.url))
const shellSource = readFileSync(`${directory}/TablesBuilderShell.tsx`, 'utf8')
const propertiesSource = readFileSync(`${directory}/TablesQRProperties.tsx`, 'utf8')
const navigationSource = readFileSync(`${directory}/TablesNavigation.tsx`, 'utf8')
const managementSource = readFileSync(`${directory}/use-table-management.ts`, 'utf8')
const canvasSource = readFileSync(`${directory}/TablesQRCanvas.tsx`, 'utf8')
const rendererSource = readFileSync(`${directory}/tables-qr-renderer.ts`, 'utf8')
const chromeSource = readFileSync(`${directory}/TablesBuilderChrome.tsx`, 'utf8')
const rotationSource = readFileSync(`${directory}/use-table-qr-token-rotation.ts`, 'utf8')
const rotationDialogSource = readFileSync(`${directory}/TablesQRRotationDialog.tsx`, 'utf8')

test('tables builder shell delegates the QR Studio properties panel', () => {
  assert.match(shellSource, /import \{ TablesQRProperties \}/)
  assert.match(shellSource, /<TablesQRProperties/)
  assert.doesNotMatch(shellSource, /function QRProps|function ShapeTab|function ColorTab|function LogoTab/)
  assert.doesNotMatch(shellSource, /QRProps shared primitives/)
})

test('QR properties stays a callback-driven UI boundary', () => {
  assert.match(propertiesSource, /export function TablesQRProperties/)
  assert.match(propertiesSource, /setQR: \(q: QRConfig\) => void/)
  assert.doesNotMatch(propertiesSource, /lib\/actions|createClient|useTablesLiveState|useQRStyleEditor/)
  assert.doesNotMatch(propertiesSource, /restaurantId|supabase|channel\(/i)
})

test('tables navigation delegates CRUD commands to its feature hook', () => {
  assert.match(shellSource, /import \{ TablesNavigation \}/)
  assert.match(shellSource, /<TablesNavigation/)
  assert.doesNotMatch(shellSource, /createTable|renameTable|deleteTable|function TablesNav/)
  assert.match(navigationSource, /useTableManagement/)
  assert.doesNotMatch(navigationSource, /lib\/actions|createTable|renameTable|deleteTable/)
  assert.match(managementSource, /createTable, deleteTable, renameTable/)
  assert.match(managementSource, /filterTables|renameTableInList|removeTableFromList/)
})

test('tables builder delegates QR canvas and browser export rendering', () => {
  assert.match(shellSource, /import \{ TablesQRCanvas \}/)
  assert.match(shellSource, /<TablesQRCanvas/)
  assert.doesNotMatch(shellSource, /function QRCanvas|downloadTableCard|renderTableCardSVG|printTableCards/)
  assert.match(canvasSource, /export function TablesQRCanvas/)
  assert.match(canvasSource, /downloadTableCard|printTableCards|loadQRCodeStyling/)
  assert.doesNotMatch(canvasSource, /lib\/actions|createClient|supabase|restaurantId|useTablesLiveState/i)
  assert.match(rendererSource, /export async function validateRenderedQR/)
  assert.match(rendererSource, /export function buildQRCodeStylingOptions/)
  assert.match(canvasSource, /buildQRCodeStylingOptions/)
  assert.doesNotMatch(`${canvasSource}\n${rendererSource}`, /as any/)
  assert.doesNotMatch(rendererSource, /lib\/actions|createClient|supabase|restaurantId|useTablesLiveState/i)
})

test('tables builder delegates its topbar, statusbar and preview chrome', () => {
  assert.match(shellSource, /import \{ TablesMobilePreview, TablesStatusBar, TablesTopBar \}/)
  assert.match(shellSource, /<TablesTopBar/)
  assert.match(shellSource, /<TablesStatusBar/)
  assert.match(shellSource, /<TablesMobilePreview/)
  assert.doesNotMatch(shellSource, /function TablesTopBar|function TablesStatusBar|function TablesMobilePreview|const PRESETS/)
  assert.match(chromeSource, /export function TablesTopBar/)
  assert.match(chromeSource, /export function TablesStatusBar/)
  assert.match(chromeSource, /export function TablesMobilePreview/)
  assert.doesNotMatch(chromeSource, /lib\/actions|createClient|supabase|restaurantId|useTablesLiveState|useQRStyleEditor/i)
})

test('QR token rotation command stays behind its controller and dialog boundary', () => {
  assert.match(shellSource, /useTableQrTokenRotation/)
  assert.match(shellSource, /<TablesQRRotationDialog/)
  assert.doesNotMatch(shellSource, /rotateTableQrToken|window\.confirm|handleRotateToken/)
  assert.match(rotationSource, /rotateTableQrToken/)
  assert.match(rotationSource, /replaceTableQrToken/)
  assert.match(rotationSource, /if \(!target \|\| rotating\) return/)
  assert.doesNotMatch(rotationSource, /createClient|supabase|useTablesLiveState|useQRStyleEditor/i)
  assert.match(rotationDialogSource, /role="alertdialog"/)
  assert.doesNotMatch(rotationDialogSource, /lib\/actions|createClient|supabase|restaurantId|rotateTableQrToken/i)
})

test('tables builder shell stays below its decomposition budget', () => {
  const lineCount = shellSource.split('\n').length
  assert.ok(lineCount <= 350, `TablesBuilderShell grew to ${lineCount} lines`)
})
