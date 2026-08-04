import type { QRConfig } from './tables-builder-types'

export type QRStyleSaveResult =
  | { error: string }
  | { success: true; revision: number }
  | { conflict: true; revision: number; style: QRConfig }

export type QRStyleSaveResolution =
  | { kind: 'acknowledged'; snapshot: { revision: number; style: QRConfig } }
  | { kind: 'rollback'; snapshot: { revision: number; style: QRConfig }; message: string }
  | { kind: 'retry'; message: string }

export const QR_STYLE_CONFLICT_MESSAGE =
  'Başka bir çalışan QR stilini değiştirdi. Sunucudaki güncel sürüm yüklendi; bu sekmedeki kaydedilmemiş değişiklikler geri alındı.'

function qrStylesEqual(left: QRConfig, right: QRConfig): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function resolveQRStyleSave({
  attemptedStyle,
  expectedRevision,
  result,
}: {
  attemptedStyle: QRConfig
  expectedRevision: number
  result: QRStyleSaveResult
}): QRStyleSaveResolution {
  if ('error' in result) return { kind: 'retry', message: result.error }

  if ('success' in result) {
    if (!Number.isSafeInteger(result.revision) || result.revision <= expectedRevision) {
      return { kind: 'retry', message: 'QR stil kaydı doğrulanamadı. Lütfen tekrar deneyin.' }
    }
    return {
      kind: 'acknowledged',
      snapshot: { revision: result.revision, style: attemptedStyle },
    }
  }

  if (!Number.isSafeInteger(result.revision) || result.revision < 0) {
    return { kind: 'retry', message: 'QR stil çakışması doğrulanamadı. Sayfayı yenileyin.' }
  }
  if (qrStylesEqual(attemptedStyle, result.style)) {
    return {
      kind: 'acknowledged',
      snapshot: { revision: result.revision, style: result.style },
    }
  }
  return {
    kind: 'rollback',
    snapshot: { revision: result.revision, style: result.style },
    message: QR_STYLE_CONFLICT_MESSAGE,
  }
}
