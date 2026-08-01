export type TableTransferFeedback = {
  operationId: string
  phase: 'completed' | 'undoing' | 'undone' | 'error'
  message: string
}

export function transferCompleted(operationId: string): TableTransferFeedback {
  return { operationId, phase: 'completed', message: 'Taşıma tamamlandı.' }
}

export function beginTransferUndo(
  feedback: TableTransferFeedback | null,
): TableTransferFeedback | null {
  if (!feedback || (feedback.phase !== 'completed' && feedback.phase !== 'error')) return feedback
  return { ...feedback, phase: 'undoing', message: 'Taşıma geri alınıyor…' }
}

export function finishTransferUndo(
  feedback: TableTransferFeedback | null,
  operationId: string,
  result: { success: true } | { error: string },
): TableTransferFeedback | null {
  if (!feedback || feedback.operationId !== operationId) return feedback
  return 'error' in result
    ? { operationId, phase: 'error', message: `Taşıma geri alınamadı: ${result.error}` }
    : { operationId, phase: 'undone', message: 'Taşıma geri alındı.' }
}

export function canUndoTransfer(feedback: TableTransferFeedback | null): boolean {
  return feedback?.phase === 'completed' || feedback?.phase === 'error'
}
