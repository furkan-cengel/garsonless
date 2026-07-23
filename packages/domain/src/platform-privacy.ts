export const PLATFORM_PRIVACY_OPERATION_TYPES = ['export', 'erase'] as const
export type PlatformPrivacyOperationType = typeof PLATFORM_PRIVACY_OPERATION_TYPES[number]

export const PLATFORM_PRIVACY_OPERATION_STATUSES = ['completed'] as const
export type PlatformPrivacyOperationStatus = typeof PLATFORM_PRIVACY_OPERATION_STATUSES[number]

export type PlatformPrivacyOperationSummary = {
  customerCount: number
  consentCount: number
  orderLinkCount: number
  loyaltyRowCount: number
  campaignRecipientCount: number
  paymentShareLinkCount: number
  anonymizedGlobalCustomerCount: number
}

export function isPlatformPrivacyOperationType(value: unknown): value is PlatformPrivacyOperationType {
  return PLATFORM_PRIVACY_OPERATION_TYPES.includes(value as PlatformPrivacyOperationType)
}

export function isPlatformPrivacyOperationStatus(value: unknown): value is PlatformPrivacyOperationStatus {
  return PLATFORM_PRIVACY_OPERATION_STATUSES.includes(value as PlatformPrivacyOperationStatus)
}

export function isPrivacyOperationSummary(value: unknown): value is PlatformPrivacyOperationSummary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const row = value as Record<string, unknown>
  return [
    'customerCount',
    'consentCount',
    'orderLinkCount',
    'loyaltyRowCount',
    'campaignRecipientCount',
    'paymentShareLinkCount',
    'anonymizedGlobalCustomerCount',
  ].every((key) => Number.isInteger(row[key]) && Number(row[key]) >= 0)
}
