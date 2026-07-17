import { err, ok, type Result } from './result'

export const SERVICE_REQUEST_TYPES = [
  'waiter',
  'clean_table',
  'change_ashtray',
  'table_service',
  'water',
  'bill',
] as const

export type ServiceRequestType = (typeof SERVICE_REQUEST_TYPES)[number]

export const SERVICE_REQUEST_LABELS: Record<ServiceRequestType, string> = {
  waiter: 'Garson çağrısı',
  clean_table: 'Masa temizliği',
  change_ashtray: 'Küllük değişimi',
  table_service: 'Servis isteği',
  water: 'Su isteği',
  bill: 'Hesap isteği',
}

export function isServiceRequestType(value: unknown): value is ServiceRequestType {
  return typeof value === 'string'
    && (SERVICE_REQUEST_TYPES as readonly string[]).includes(value)
}

export function serviceRequestLabel(value: unknown): string {
  return isServiceRequestType(value) ? SERVICE_REQUEST_LABELS[value] : SERVICE_REQUEST_LABELS.waiter
}

export type TableSessionCloseOutcome =
  | 'not_found'
  | 'unpaid'
  | 'payment_pending'
  | 'already_closed'
  | 'closed_normal'
  | 'closed_abnormal'

/** Keep the staff audit reason bounded before it reaches the transaction RPC. */
export function normalizeAbnormalCloseReason(value: unknown): Result<string | null> {
  if (value == null) return ok(null)
  if (typeof value !== 'string') return err('Invalid abnormal close reason')
  const reason = value.trim()
  if (!reason) return ok(null)
  if (reason.length > 200) return err('Abnormal close reason is too long')
  return ok(reason)
}
