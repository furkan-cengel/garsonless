import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createAccountingInvoicePort, type AccountingInvoiceJob } from '@garsonless/db/server'
import { sendInvoiceEmail } from '../../../../lib/accounting/invoice-email'
import { createParasutInvoiceProvider } from '../../../../lib/accounting/parasut-invoice-provider'
import { providerError, type ProviderStepError } from '../../../../lib/accounting/invoice-provider'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

async function processJob(job: AccountingInvoiceJob, workerId: string): Promise<'succeeded' | 'retry'> {
  const port = createAccountingInvoicePort()
  try {
    const provider = createParasutInvoiceProvider()
    const contactRef = await provider.ensureContact(job)
    let checkpoint = await port.checkpoint({
      jobId: job.id, workerId, providerContactRef: contactRef,
      providerInvoiceRef: job.providerInvoiceRef, providerTaskRef: job.providerTaskRef,
      fiscalDocumentType: job.fiscalDocumentType,
    })
    if (!checkpoint.ok) throw providerError('ACCOUNTING_CONTACT_CHECKPOINT', true)
    const type = await provider.resolveDocumentType(job)
    checkpoint = await port.checkpoint({
      jobId: job.id, workerId, providerContactRef: contactRef,
      providerInvoiceRef: job.providerInvoiceRef, providerTaskRef: job.providerTaskRef,
      fiscalDocumentType: type,
    })
    if (!checkpoint.ok) throw providerError('ACCOUNTING_TYPE_CHECKPOINT', true)
    const invoiceRef = await provider.createSalesInvoice(job, contactRef)
    checkpoint = await port.checkpoint({
      jobId: job.id, workerId, providerContactRef: contactRef,
      providerInvoiceRef: invoiceRef, providerTaskRef: job.providerTaskRef,
      fiscalDocumentType: type,
    })
    if (!checkpoint.ok) throw providerError('ACCOUNTING_INVOICE_CHECKPOINT', true)
    const taskRef = job.providerTaskRef ?? await provider.formalize(invoiceRef, type)
    checkpoint = await port.checkpoint({
      jobId: job.id, workerId, providerContactRef: contactRef,
      providerInvoiceRef: invoiceRef, providerTaskRef: taskRef, fiscalDocumentType: type,
    })
    if (!checkpoint.ok) throw providerError('ACCOUNTING_CHECKPOINT', true)
    const taskStatus = await provider.readTask(taskRef)
    if (taskStatus === 'pending') throw providerError('PARASUT_TASK_PENDING', true)
    const pdf = await provider.downloadPdf(invoiceRef)
    await sendInvoiceEmail({
      ...job, providerContactRef: contactRef, providerInvoiceRef: invoiceRef,
      providerTaskRef: taskRef, fiscalDocumentType: type,
    }, pdf)
    const completed = await port.complete({
      jobId: job.id, workerId, providerContactRef: contactRef,
      providerInvoiceRef: invoiceRef, fiscalDocumentType: type,
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
  const workerId = `accounting-${crypto.randomUUID()}`
  const port = createAccountingInvoicePort()
  const claimed = await port.claim(workerId, 5)
  if (!claimed.ok) return NextResponse.json({ error: 'Accounting queue unavailable' }, { status: 503 })
  const results = []
  for (const job of claimed.value) results.push(await processJob(job, workerId))
  return NextResponse.json({ claimed: claimed.value.length, succeeded: results.filter((value) => value === 'succeeded').length })
}
