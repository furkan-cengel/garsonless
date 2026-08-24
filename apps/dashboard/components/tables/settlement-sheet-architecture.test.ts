import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('.', import.meta.url))
const sheetSource = readFileSync(`${directory}/SettlementSheet.tsx`, 'utf8')
const controllerSource = readFileSync(`${directory}/use-settlement-sheet.ts`, 'utf8')
const modelSource = readFileSync(`${directory}/settlement-sheet-model.ts`, 'utf8')
const splitSource = readFileSync(`${directory}/SettlementSplitStatus.tsx`, 'utf8')
const successSource = readFileSync(`${directory}/SettlementSuccessDialog.tsx`, 'utf8')
const loadSource = readFileSync(`${directory}/settlement-data-load.ts`, 'utf8')
const prefetchSource = readFileSync(`${directory}/use-transfer-orders-prefetch.ts`, 'utf8')

test('settlement sheet delegates state, commands and derived money to its controller model', () => {
  assert.match(sheetSource, /useSettlementSheet/)
  assert.match(controllerSource, /deriveSettlementProjection/)
  assert.match(controllerSource, /loadSessionSettlement/)
  assert.match(controllerSource, /settleSessionAndClose/)
  assert.match(controllerSource, /confirmCashShare/)
  assert.match(controllerSource, /releaseUnstartedCardShare/)
  assert.match(controllerSource, /reconcileCardShareAction/)
  assert.match(controllerSource, /closeTableSession/)
  assert.doesNotMatch(sheetSource, /useState|useEffect|useCallback|getSessionSettlement|settleOrder|confirmCashShare|closeTableSession/)
  assert.doesNotMatch(modelSource, /useState|useEffect|useCallback|AccessibleDialog|createClient|supabase/i)
})

test('settlement data and dialog code preload before the critical close action', () => {
  assert.match(loadSource, /getSessionSettlement/)
  assert.match(loadSource, /resultTtlMs: SETTLEMENT_CACHE_TTL_MS/)
  assert.match(loadSource, /shouldCache: .*=> !\('error' in result\)/)
  assert.match(prefetchSource, /import\('\.\/SettlementSheet'\)/)
  assert.match(prefetchSource, /prefetchSessionSettlement\(restaurantId, session\)/)
})

test('settlement sheet delegates split and success presentation without infrastructure access', () => {
  assert.match(sheetSource, /<SettlementSplitStatus/)
  assert.match(sheetSource, /<SettlementSuccessDialog/)
  assert.match(splitSource, /export function SettlementSplitStatus/)
  assert.match(successSource, /export function SettlementSuccessDialog/)
  assert.doesNotMatch(`${splitSource}\n${successSource}`, /lib\/actions|useState|useEffect|createClient|supabase/i)
})

test('split card presentation distinguishes unstarted, active and verification states', () => {
  assert.match(splitSource, /providerState === 'not_started'/)
  assert.match(splitSource, /providerState === 'checkout_active'/)
  assert.match(splitSource, /providerState === 'verification_required'/)
  assert.match(splitSource, /Payı kaldır/)
  assert.match(splitSource, /İyzico’da kontrol et/)
})

test('settlement flow composes shadcn dialog, feedback and payment controls', () => {
  assert.match(sheetSource, /from '@\/components\/ui\/dialog'/)
  assert.match(sheetSource, /from '@\/components\/ui\/progress'/)
  assert.match(sheetSource, /from '@\/components\/ui\/card'/)
  assert.match(sheetSource, /from '@\/components\/ui\/alert'/)
  assert.match(successSource, /from '@\/components\/ui\/dialog'/)
})

test('settlement content scrolls inside a bounded grid row without painting beneath the footer', () => {
  assert.match(sheetSource, /grid-rows-\[auto_minmax\(0,1fr\)_auto\]/)
  assert.match(sheetSource, /<ScrollArea className="min-h-0 overflow-hidden">/)
  assert.match(sheetSource, /<DialogFooter className="mx-0 mb-0 flex-col gap-2 p-4 sm:flex-col">/)
  assert.doesNotMatch(sheetSource, /<DialogFooter[^>]*(?:absolute|fixed|sticky)/)
})

test('settlement decomposition budgets keep the orchestration and presentation boundaries reviewable', () => {
  const sheetLines = sheetSource.split('\n').length
  const controllerLines = controllerSource.split('\n').length
  const splitLines = splitSource.split('\n').length
  const successLines = successSource.split('\n').length
  assert.ok(sheetLines <= 340, `SettlementSheet grew to ${sheetLines} lines`)
  assert.ok(controllerLines <= 240, `useSettlementSheet grew to ${controllerLines} lines`)
  assert.ok(splitLines <= 180, `SettlementSplitStatus grew to ${splitLines} lines`)
  assert.ok(successLines <= 80, `SettlementSuccessDialog grew to ${successLines} lines`)
})
