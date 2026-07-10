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
