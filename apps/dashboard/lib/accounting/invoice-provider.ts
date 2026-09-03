import type { AccountingInvoiceJob } from '@garsonless/db/server'

export type FiscalDocumentType = 'e_fatura' | 'e_arsiv'

export type FormalizedDocument = {
  ref: string
  type: FiscalDocumentType
}

export type ParasutRefreshTokenLease = {
  refreshToken: string
  version: number
}

export interface ParasutRefreshTokenStore {
  claim(): Promise<ParasutRefreshTokenLease>
  rotate(lease: ParasutRefreshTokenLease, nextRefreshToken: string): Promise<void>
  release(lease: ParasutRefreshTokenLease): Promise<void>
}

export type ProviderStepError = Error & {
  code: string
  retryable: boolean
}

export interface InvoiceProvider {
  ensureContact(job: AccountingInvoiceJob): Promise<string>
  resolveDocumentType(job: AccountingInvoiceJob): Promise<FiscalDocumentType>
  createSalesInvoice(job: AccountingInvoiceJob, contactRef: string): Promise<string>
  formalize(job: AccountingInvoiceJob, invoiceRef: string, type: FiscalDocumentType): Promise<string>
  readTask(taskRef: string): Promise<'pending' | 'succeeded'>
  resolveFormalizedDocument(invoiceRef: string, expectedType: FiscalDocumentType): Promise<FormalizedDocument | null>
  downloadPdf(document: FormalizedDocument): Promise<Uint8Array>
}

export function providerError(code: string, retryable: boolean): ProviderStepError {
  return Object.assign(new Error(code), { code, retryable })
}
