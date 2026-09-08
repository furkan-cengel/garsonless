import 'server-only'
import { renderInvoiceEmail } from '@garsonless/domain/email-messages'
import { Resend } from 'resend'
import type { AccountingInvoiceJob } from '@garsonless/db/server'
import { providerError } from './invoice-provider'

export async function sendInvoiceEmail(job: AccountingInvoiceJob, pdf: Uint8Array): Promise<string> {
  const apiKey = process.env['RESEND_API_KEY']?.trim()
  const from = process.env['INVOICE_FROM_EMAIL']?.trim()?.replace(/^masabu(?=\s*<)/i, 'masabu') || process.env['RESEND_FROM_EMAIL']?.trim()?.replace(/^masabu(?=\s*<)/i, 'masabu')
  if (!apiKey || !from) throw providerError('INVOICE_EMAIL_CONFIG', false)
  const { data, error } = await new Resend(apiKey).emails.send({
    from, to: job.profile.email,
    ...renderInvoiceEmail({ name: job.profile.name, plan: job.profile.plan, reference: job.subscriptionInvoiceId, amountMinor: job.amountMinor, periodStart: job.profile.periodStart, periodEnd: job.profile.periodEnd, ...(job.fiscalDocumentType ? { documentType: job.fiscalDocumentType } : {}) }),
    attachments: [{ filename: `masabu-fatura-${job.subscriptionInvoiceId}.pdf`, content: Buffer.from(pdf) }],
  }, { idempotencyKey: `masabu-invoice-email-${job.id}` })
  if (error) throw providerError('INVOICE_EMAIL_TEMPORARY', true)
  if (!data?.id) throw providerError('INVOICE_EMAIL_IDENTITY_MISSING', true)
  return data.id
}
