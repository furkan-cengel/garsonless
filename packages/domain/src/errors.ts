/**
 * Stable, user-safe failures shared by application adapters.
 *
 * `error` is deliberately suitable for a UI. Keep provider responses, SQL
 * messages and stack traces out of this module; infrastructure layers may log
 * those against the returned `referenceId` instead.
 */
export const ERROR_DEFINITIONS = {
  VALIDATION_FAILED: {
    publicCode: 'MAS-VAL-001',
    message: 'Gönderilen bilgileri kontrol edip tekrar deneyin.',
    retryable: false,
  },
  AUTH_REQUIRED: {
    publicCode: 'MAS-AUTH-001',
    message: 'Bu işlem için tekrar giriş yapmanız gerekiyor.',
    retryable: false,
  },
  ACCESS_DENIED: {
    publicCode: 'MAS-AUTH-002',
    message: 'Bu işlem için yetkiniz yok.',
    retryable: false,
  },
  PLAN_REQUIRED: {
    publicCode: 'MAS-PLAN-403',
    message: 'Bu özellik mevcut paketinizde yer almıyor. Planınızı yükselterek kullanabilirsiniz.',
    retryable: false,
  },
  RESOURCE_NOT_FOUND: {
    publicCode: 'MAS-RES-404',
    message: 'İstediğiniz kayıt artık bulunamıyor.',
    retryable: false,
  },
  CONFLICT: {
    publicCode: 'MAS-CMD-409',
    message: 'Bu işlem mevcut durumla çakışıyor. Sayfayı yenileyip tekrar deneyin.',
    retryable: true,
  },
  INVALID_STATE_TRANSITION: {
    publicCode: 'MAS-ORD-409',
    message: 'Sipariş bu aşamaya geçirilemiyor. Güncel durumu kontrol edin.',
    retryable: true,
  },
  PAYMENT_ACTION_REQUIRED: {
    publicCode: 'MAS-PAY-409',
    message: 'Bu ödeme durumu için ek işlem gerekiyor.',
    retryable: false,
  },
  RATE_LIMITED: {
    publicCode: 'MAS-RATE-429',
    message: 'Çok sık işlem yapıldı. Lütfen kısa süre sonra tekrar deneyin.',
    retryable: true,
  },
  SERVICE_UNAVAILABLE: {
    publicCode: 'MAS-SVC-503',
    message: 'İşlem şu anda tamamlanamadı. Lütfen tekrar deneyin.',
    retryable: true,
  },
  UNEXPECTED: {
    publicCode: 'MAS-UI-500',
    message: 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.',
    retryable: true,
  },
} as const

export type ErrorCode = keyof typeof ERROR_DEFINITIONS

export type ActionFailure = {
  error: string
  errorCode: ErrorCode
  publicCode: string
  retryable: boolean
  /** Server adapters attach this so support can locate the corresponding log. */
  referenceId?: string
}

export function createActionFailure(
  errorCode: ErrorCode,
  options: { message?: string; referenceId?: string } = {},
): ActionFailure {
  const definition = ERROR_DEFINITIONS[errorCode]
  return {
    error: options.message ?? definition.message,
    errorCode,
    publicCode: definition.publicCode,
    retryable: definition.retryable,
    ...(options.referenceId ? { referenceId: options.referenceId } : {}),
  }
}
