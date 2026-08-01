import assert from 'node:assert/strict'
import test from 'node:test'
import {
  beginTransferUndo,
  canUndoTransfer,
  finishTransferUndo,
  transferCompleted,
} from './table-transfer-feedback-model'

test('taşıma bildirimi yalnız kendi operation id değerini geri alır', () => {
  const first = beginTransferUndo(transferCompleted('operation-a'))
  assert.deepEqual(finishTransferUndo(first, 'operation-b', { success: true }), first)
  assert.deepEqual(finishTransferUndo(first, 'operation-a', { success: true }), {
    operationId: 'operation-a', phase: 'undone', message: 'Taşıma geri alındı.',
  })
})

test('busy ve tamamlanmış geri alma ikinci çağrıyı reddeder', () => {
  const undoing = beginTransferUndo(transferCompleted('operation-a'))
  assert.equal(canUndoTransfer(undoing), false)
  assert.equal(beginTransferUndo(undoing), undoing)
  assert.equal(canUndoTransfer(finishTransferUndo(undoing, 'operation-a', { success: true })), false)
})

test('güvenli red aynı operation id üzerinde görünür ve tekrar denenebilir kalır', () => {
  const feedback = finishTransferUndo(
    beginTransferUndo(transferCompleted('operation-a')),
    'operation-a',
    { error: 'Sonraki taşıma nedeniyle geri alınamaz.' },
  )
  assert.deepEqual(feedback, {
    operationId: 'operation-a',
    phase: 'error',
    message: 'Taşıma geri alınamadı: Sonraki taşıma nedeniyle geri alınamaz.',
  })
  assert.equal(canUndoTransfer(feedback), true)
})
