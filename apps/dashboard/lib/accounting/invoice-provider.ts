import type { AccountingInvoiceJob } from '@garsonless/db/server'

export type FiscalDocumentType = 'e_fatura' | 'e_arsiv'

export type ProviderStepError = Error & {
  code: string
  retryable: boolean
}

export interface InvoiceProvider {
  ensureContact(job: AccountingInvoiceJob): Promise<string>
  resolveDocumentType(job: AccountingInvoiceJob): Promise<FiscalDocumentType>
  createSalesInvoice(job: AccountingInvoiceJob, contactRef: string): Promise<string>
  formalize(invoiceRef: string, type: FiscalDocumentType): Promise<string>
  readTask(taskRef: string): Promise<'pending' | 'succeeded'>
  downloadPdf(invoiceRef: string): Promise<Uint8Array>
}

export function providerError(code: string, retryable: boolean): ProviderStepError {
  return Object.assign(new Error(code), { code, retryable })
}
