export const LEGAL_DOCUMENT_VERSION = '2026-08-16' as const

export const LEGAL_DOCUMENT_TYPES = [
  'b2b_terms',
  'privacy_notice_presented',
  'checkout_summary_accepted',
] as const

export type LegalDocumentType = typeof LEGAL_DOCUMENT_TYPES[number]
