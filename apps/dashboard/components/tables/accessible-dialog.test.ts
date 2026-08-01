import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('.', import.meta.url))
const dialogSource = readFileSync(`${directory}/AccessibleDialog.tsx`, 'utf8')
const settlementSource = readFileSync(`${directory}/SettlementSheet.tsx`, 'utf8')
const settlementUiSource = readFileSync(`${directory}/settlement-sheet-ui.tsx`, 'utf8')
const transferSource = readFileSync(`${directory}/TableTransferDialog.tsx`, 'utf8')
const rotationSource = readFileSync(`${directory}/TablesQRRotationDialog.tsx`, 'utf8')

test('shared tables dialog owns the complete modal accessibility lifecycle', () => {
  assert.match(dialogSource, /role=\{role\}/)
  assert.match(dialogSource, /role\?: 'dialog' \| 'alertdialog'/)
  assert.match(dialogSource, /aria-modal="true"/)
  assert.match(dialogSource, /aria-labelledby=\{labelledBy\}/)
  assert.match(dialogSource, /document\.body\.style\.overflow = 'hidden'/)
  assert.match(dialogSource, /makeBackgroundInert\(dialog\)/)
  assert.match(dialogSource, /sibling\.inert = true/)
  assert.match(dialogSource, /event\.key === 'Escape'/)
  assert.match(dialogSource, /event\.key !== 'Tab'/)
  assert.match(dialogSource, /event\.shiftKey/)
  assert.match(dialogSource, /previousFocus\.focus\(\)/)
  assert.match(dialogSource, /document\.addEventListener\('focusin'/)
})

test('QR rotation alertdialog uses the shared trap, inert, scroll-lock and focus-restore boundary', () => {
  assert.match(rotationSource, /<AccessibleDialog/)
  assert.match(rotationSource, /role="alertdialog"/)
  assert.match(rotationSource, /data-modal-initial-focus/)
  assert.doesNotMatch(rotationSource, /window\.addEventListener\('keydown'/)
})

test('settlement and transfer dialogs use Turkish labelled shared boundaries', () => {
  assert.match(settlementSource, /<AccessibleDialog labelledBy="settlement-dialog-title"/)
  assert.match(settlementSource, /id="settlement-dialog-title"/)
  assert.match(settlementSource, /aria-label="Pencereyi kapat"/)
  assert.match(settlementUiSource, /width: 44,[\s\S]*height: 44/)
  assert.match(transferSource, /<AccessibleDialog labelledBy="table-transfer-dialog-title"/)
  assert.match(transferSource, /id="table-transfer-dialog-title"/)
  assert.match(transferSource, /aria-label="Pencereyi kapat"/)
  assert.doesNotMatch(`${settlementSource}\n${transferSource}`, /role="dialog" aria-modal="true"/)
})
