import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import {
  createAccountingInvoicePort,
  type AccountingInvoiceJob,
  type ActiveAccountingProviderName,
} from '@garsonless/db/server'
import { sendInvoiceEmail } from '../../../../lib/accounting/invoice-email'
import { createNilveraInvoiceProvider, readNilveraConfig } from '../../../../lib/accounting/nilvera-invoice-provider'
import { providerError, type InvoiceProvider, type ProviderStepError } from '../../../../lib/accounting/invoice-provider'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorized(request: Request): boolean {
  const configured = process.env['ACCOUNTING_WORKER_SECRET']?.trim()
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!configured || !supplied) return false
  const left = Buffer.from(configured)
  const right = Buffer.from(supplied)
  return left.length === right.length && timingSafeEqual(left, right)
}

function stepError(value: unknown): ProviderStepError {
  if (value instanceof Error && typeof (value as Partial<ProviderStepError>).code === 'string'
    && typeof (value as Partial<ProviderStepError>).retryable === 'boolean') return value as ProviderStepError
  return providerError('ACCOUNTING_WORKER_UNKNOWN', true)
}

async function processJob(
  job: AccountingInvoiceJob,
  workerId: string,
  provider: InvoiceProvider,
): Promise<'succeeded' | 'retry'> {
  const port = createAccountingInvoicePort()
  try {
    const contactRef = await provider.ensureContact(job)
    let checkpoint = await port.checkpoint({
      jobId: job.id, workerId, providerContactRef: contactRef,
      providerInvoiceRef: job.providerInvoiceRef, providerTaskRef: job.providerTaskRef,
      providerDocumentRef: job.providerDocumentRef,
      fiscalDocumentType: job.fiscalDocumentType,
    })
    if (!checkpoint.ok) throw providerError('ACCOUNTING_CONTACT_CHECKPOINT', true)
    const type = await provider.resolveDocumentType(job)
    checkpoint = await port.checkpoint({
      jobId: job.id, workerId, providerContactRef: contactRef,
      providerInvoiceRef: job.providerInvoiceRef, providerTaskRef: job.providerTaskRef,
      providerDocumentRef: job.providerDocumentRef,
      fiscalDocumentType: type,
    })
    if (!checkpoint.ok) throw providerError('ACCOUNTING_TYPE_CHECKPOINT', true)
    const invoiceRef = await provider.createSalesInvoice(job, contactRef, type)
    checkpoint = await port.checkpoint({
      jobId: job.id, workerId, providerContactRef: contactRef,
      providerInvoiceRef: invoiceRef, providerTaskRef: job.providerTaskRef,
      providerDocumentRef: job.providerDocumentRef,
      fiscalDocumentType: type,
    })
    if (!checkpoint.ok) throw providerError('ACCOUNTING_INVOICE_CHECKPOINT', true)
    let document = job.providerDocumentRef ? { ref: job.providerDocumentRef, type } : null
    if (!document) document = await provider.resolveFormalizedDocument(invoiceRef, type)
    let taskRef = job.providerTaskRef
    if (!document && !taskRef) {
      taskRef = await provider.formalize(job, invoiceRef, type)
      checkpoint = await port.checkpoint({
        jobId: job.id, workerId, providerContactRef: contactRef,
        providerInvoiceRef: invoiceRef, providerTaskRef: taskRef,
        providerDocumentRef: job.providerDocumentRef, fiscalDocumentType: type,
      })
      if (!checkpoint.ok) throw providerError('ACCOUNTING_CHECKPOINT', true)
    }
    if (!document) {
      if (!taskRef) throw providerError('ACCOUNTING_TASK_IDENTITY_MISSING', true)
      const taskStatus = await provider.readTask(taskRef)
      if (taskStatus === 'pending') throw providerError('ACCOUNTING_TASK_PENDING', true)
      document = await provider.resolveFormalizedDocument(invoiceRef, type)
    }
    if (!document) throw providerError('ACCOUNTING_DOCUMENT_PENDING', true)
    checkpoint = await port.checkpoint({
      jobId: job.id, workerId, providerContactRef: contactRef,
      providerInvoiceRef: invoiceRef, providerTaskRef: taskRef,
      providerDocumentRef: document.ref, fiscalDocumentType: document.type,
    })
    if (!checkpoint.ok) throw providerError('ACCOUNTING_DOCUMENT_CHECKPOINT', true)
    const pdf = await provider.downloadPdf(document)
    const emailMessageId = await sendInvoiceEmail({
      ...job, providerContactRef: contactRef, providerInvoiceRef: invoiceRef,
      providerTaskRef: taskRef, providerDocumentRef: document.ref,
      fiscalDocumentType: document.type,
    }, pdf)
    const recordedEmail = await port.recordEmailDelivery({
      jobId: job.id, providerMessageId: emailMessageId,
    })
    if (!recordedEmail.ok) throw providerError('ACCOUNTING_EMAIL_RECEIPT', true)
    const completed = await port.complete({
      jobId: job.id, workerId, providerContactRef: contactRef,
      providerInvoiceRef: invoiceRef, providerDocumentRef: document.ref,
      fiscalDocumentType: document.type,
    })
    if (!completed.ok) throw providerError('ACCOUNTING_COMPLETE', true)
    return 'succeeded'
  } catch (cause) {
    const failure = stepError(cause)
    await port.fail({
      jobId: job.id, workerId, errorCode: failure.code.slice(0, 100), retryable: failure.retryable,
    })
    return 'retry'
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (process.env['ACCOUNTING_DISPATCH_ENABLED'] !== 'true') {
    return NextResponse.json({ error: 'Accounting dispatch disabled' }, { status: 503 })
  }
  const workerId = `accounting-${crypto.randomUUID()}`
  let provider: InvoiceProvider
  const providerName: ActiveAccountingProviderName = 'nilvera'
  try {
    if (process.env['ACCOUNTING_PROVIDER']?.trim() !== providerName) {
      throw providerError('ACCOUNTING_PROVIDER_UNSUPPORTED', false)
    }
    provider = createNilveraInvoiceProvider(readNilveraConfig())
  } catch {
    return NextResponse.json({ error: 'Accounting provider unavailable' }, { status: 503 })
  }
  const port = createAccountingInvoicePort()
  // Keep the first release deliberately serial. This bounds
  // retries and duplicate risk while the fiscal-document flow is monitored.
  const claimed = await port.claim(workerId, providerName, 1)
  if (!claimed.ok) return NextResponse.json({ error: 'Accounting queue unavailable' }, { status: 503 })
  const results = []
  for (const job of claimed.value) results.push(await processJob(job, workerId, provider))
  return NextResponse.json({ claimed: claimed.value.length, succeeded: results.filter((value) => value === 'succeeded').length })
}
