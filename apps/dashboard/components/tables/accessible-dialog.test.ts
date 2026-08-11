import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('.', import.meta.url))
const dialogSource = readFileSync(`${directory}/AccessibleDialog.tsx`, 'utf8')
const settlementSource = readFileSync(`${directory}/SettlementSheet.tsx`, 'utf8')
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

test('QR rotation delegates trap, inert, scroll-lock and focus restore to shadcn AlertDialog', () => {
  assert.match(rotationSource, /from '@\/components\/ui\/alert-dialog'/)
  assert.match(rotationSource, /<AlertDialog open/)
  assert.match(rotationSource, /<AlertDialogContent/)
  assert.match(rotationSource, /<AlertDialogTitle>/)
  assert.match(rotationSource, /<AlertDialogDescription>/)
  assert.match(rotationSource, /<AlertDialogCancel/)
  assert.match(rotationSource, /<AlertDialogAction/)
  assert.doesNotMatch(rotationSource, /window\.addEventListener\('keydown'/)
})

test('settlement and transfer dialogs compose Turkish labelled shadcn boundaries', () => {
  assert.match(settlementSource, /from '@\/components\/ui\/dialog'/)
  assert.match(settlementSource, /<DialogTitle id="settlement-dialog-title"/)
  assert.match(settlementSource, /aria-label="Pencereyi kapat"/)
  assert.match(transferSource, /from '@\/components\/ui\/dialog'/)
  assert.match(transferSource, /<DialogTitle id="table-transfer-dialog-title"/)
  assert.match(transferSource, /aria-label="Pencereyi kapat"/)
  assert.match(`${settlementSource}\n${transferSource}`, /<DialogContent/)
  assert.match(`${settlementSource}\n${transferSource}`, /<DialogFooter/)
  assert.doesNotMatch(`${settlementSource}\n${transferSource}`, /role="dialog" aria-modal="true"/)
})
