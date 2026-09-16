import { err, ok, type Result } from '@garsonless/domain/result'
import { createServiceClient } from './service-client'

export type AccountingProfileSnapshot = {
  legalName: string
  name: string
  surname: string
  identityNumber: string
  taxOffice: string
  email: string
  billingAddress: Record<string, unknown>
  paidAt: string
} & ({ kind: 'add_on'; addOn: 'iyzico_online_payments' | 'storefront_video_hero'; netAmountMinor: number; vatRate: number } | {
  kind?: 'subscription'
  periodStart: string
  periodEnd: string
  plan: 'starter' | 'plus' | 'pro'
  addOns: Array<'iyzico_online_payments' | 'storefront_video_hero'>
  billingInterval: 'monthly' | 'annual'
})

export type AccountingProviderName = 'parasut' | 'nilvera'
export type ActiveAccountingProviderName = 'nilvera'

export type AccountingInvoiceJob = {
  id: string
  restaurantId: string
  subscriptionInvoiceId: string | null
  addOnPurchaseId?: string | null
  amountMinor: number
  currency: 'TRY'
  profile: AccountingProfileSnapshot
  attempts: number
  providerName: AccountingProviderName
  providerContactRef: string | null
  providerInvoiceRef: string | null
  providerTaskRef: string | null
  providerDocumentRef: string | null
  fiscalDocumentType: 'e_fatura' | 'e_arsiv' | null
}

type Rpc = (name: string, args: Record<string, unknown>) => Promise<{
  data: unknown
  error: { message: string } | null
}>

function serviceRpc(): Rpc {
  const service = createServiceClient()
  return service.rpc.bind(service) as unknown as Rpc
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function nullableText(value: unknown): string | null | undefined {
  return value === null ? null : text(value) ?? undefined
}

function parseProfile(value: unknown): AccountingProfileSnapshot | null {
  const row = object(value)
  const legalName = text(row?.legalName)
  const name = text(row?.name)
  const surname = text(row?.surname)
  const identityNumber = text(row?.identityNumber)
  const taxOffice = text(row?.taxOffice)
  const email = text(row?.email)
  const billingAddress = object(row?.billingAddress)
  if (row?.kind === 'add_on') {
    if (!legalName || !name || !surname || !identityNumber || !taxOffice || !email || !billingAddress
      || !text(row.paidAt) || !Number.isFinite(Date.parse(String(row.paidAt)))
      || !['iyzico_online_payments','storefront_video_hero'].includes(String(row.addOn))
      || !Number.isSafeInteger(row.netAmountMinor) || (row.netAmountMinor as number) <= 0 || !Number.isInteger(row.vatRate) || ![0,1,10,20].includes(row.vatRate as number)) return null
    return { legalName,name,surname,identityNumber,taxOffice,email,billingAddress,paidAt:String(row.paidAt),kind:'add_on',addOn:row.addOn as 'storefront_video_hero' | 'iyzico_online_payments',netAmountMinor:row.netAmountMinor as number,vatRate:row.vatRate as number }
  }
  const periodStart = text(row?.periodStart)
  const periodEnd = text(row?.periodEnd)
  const paidAt = text(row?.paidAt)
  const plan = row?.plan
  const addOns = row?.addOns
  const billingInterval = row?.billingInterval
  if (!row || !legalName || !name || !surname || !identityNumber || !taxOffice || !email
    || !billingAddress || !periodStart || !periodEnd || !paidAt
    || !Number.isFinite(Date.parse(periodStart)) || !Number.isFinite(Date.parse(periodEnd))
    || !Number.isFinite(Date.parse(paidAt))
    || !['starter', 'plus', 'pro'].includes(plan as string)
    || !Array.isArray(addOns) || addOns.length > 1
    || !addOns.every((addOn) => ['iyzico_online_payments', 'storefront_video_hero'].includes(addOn as string))
    || !['monthly', 'annual'].includes(billingInterval as string)) return null
  return {
    legalName, name, surname, identityNumber, taxOffice, email, billingAddress,
    periodStart, periodEnd, paidAt, plan: plan as Extract<AccountingProfileSnapshot, { plan: string }>['plan'],
    addOns: addOns as Extract<AccountingProfileSnapshot, { plan: string }>['addOns'],
    billingInterval: billingInterval as Extract<AccountingProfileSnapshot, { plan: string }>['billingInterval'],
  }
}

function parseJob(value: unknown): AccountingInvoiceJob | null {
  const row = object(value)
  const id = text(row?.id)
  const restaurantId = text(row?.restaurantId)
  const subscriptionInvoiceId = text(row?.subscriptionInvoiceId)
  const addOnPurchaseId = text(row?.addOnPurchaseId)
  const profile = parseProfile(row?.profile)
  const providerName = row?.providerName
  const providerContactRef = nullableText(row?.providerContactRef ?? null)
  const providerInvoiceRef = nullableText(row?.providerInvoiceRef ?? null)
  const providerTaskRef = nullableText(row?.providerTaskRef ?? null)
  const providerDocumentRef = nullableText(row?.providerDocumentRef ?? null)
  const fiscalDocumentType = row?.fiscalDocumentType
  if (!row || !id || !restaurantId || Boolean(subscriptionInvoiceId) === Boolean(addOnPurchaseId) || !profile
    || (profile.kind === 'add_on') !== Boolean(addOnPurchaseId)
    || !Number.isSafeInteger(row.amountMinor) || (row.amountMinor as number) < 0
    || row.currency !== 'TRY' || !Number.isInteger(row.attempts) || (row.attempts as number) < 1
    || !['parasut', 'nilvera'].includes(providerName as string)
    || providerContactRef === undefined || providerInvoiceRef === undefined
    || providerTaskRef === undefined || providerDocumentRef === undefined
    || !(fiscalDocumentType === null || ['e_fatura', 'e_arsiv'].includes(fiscalDocumentType as string))) return null
  return {
    id, restaurantId, subscriptionInvoiceId, addOnPurchaseId, profile,
    amountMinor: row.amountMinor as number, currency: 'TRY', attempts: row.attempts as number,
    providerName: providerName as AccountingProviderName,
    providerContactRef, providerInvoiceRef, providerTaskRef, providerDocumentRef,
    fiscalDocumentType: fiscalDocumentType as AccountingInvoiceJob['fiscalDocumentType'],
  }
}

export function createAccountingInvoicePort(rpc: Rpc = serviceRpc()) {
  return {
    async claim(
      workerId: string,
      providerName: ActiveAccountingProviderName,
      limit = 5,
    ): Promise<Result<AccountingInvoiceJob[]>> {
      if (!workerId.trim() || workerId.length > 100 || providerName !== 'nilvera'
        || !Number.isInteger(limit) || limit < 1 || limit > 20) {
        return err('Accounting claim input is invalid')
      }
      const { data, error } = await rpc('claim_accounting_invoice_jobs', {
        p_worker_id: workerId, p_provider_name: providerName, p_limit: limit,
      })
      if (error) return err('Accounting jobs are unavailable')
      if (!Array.isArray(data)) return err('Accounting job projection is invalid')
      const parsed = data.map(parseJob)
      return parsed.every((job): job is AccountingInvoiceJob => (
        job !== null && job.providerName === providerName
      ))
        ? ok(parsed) : err('Accounting job projection is invalid')
    },
    async complete(input: {
      jobId: string
      workerId: string
      providerContactRef: string
      providerInvoiceRef: string
      providerDocumentRef: string
      fiscalDocumentType: 'e_fatura' | 'e_arsiv'
    }): Promise<Result<true>> {
      const { data, error } = await rpc('complete_accounting_invoice_job', {
        p_job_id: input.jobId, p_worker_id: input.workerId,
        p_provider_contact_ref: input.providerContactRef,
        p_provider_invoice_ref: input.providerInvoiceRef,
        p_provider_document_ref: input.providerDocumentRef,
        p_fiscal_document_type: input.fiscalDocumentType,
      })
      return error ? err('Accounting completion failed')
        : data === true ? ok(true) : err('Accounting completion was not claimed')
    },
    async recordEmailDelivery(input: {
      jobId: string
      providerMessageId: string
    }): Promise<Result<true>> {
      const { data, error } = await rpc('record_accounting_invoice_email_delivery', {
        p_job_id: input.jobId,
        p_provider_message_id: input.providerMessageId,
      })
      return error ? err('Accounting email receipt failed')
        : data === true ? ok(true) : err('Accounting email receipt was not claimed')
    },
    async checkpoint(input: {
      jobId: string
      workerId: string
      providerContactRef: string | null
      providerInvoiceRef: string | null
      providerTaskRef: string | null
      providerDocumentRef: string | null
      fiscalDocumentType: 'e_fatura' | 'e_arsiv' | null
    }): Promise<Result<true>> {
      const { data, error } = await rpc('checkpoint_accounting_invoice_job', {
        p_job_id: input.jobId, p_worker_id: input.workerId,
        p_provider_contact_ref: input.providerContactRef,
        p_provider_invoice_ref: input.providerInvoiceRef,
        p_provider_task_ref: input.providerTaskRef,
        p_provider_document_ref: input.providerDocumentRef,
        p_fiscal_document_type: input.fiscalDocumentType,
      })
      return error ? err('Accounting checkpoint failed')
        : data === true ? ok(true) : err('Accounting checkpoint was not claimed')
    },
    async fail(input: {
      jobId: string
      workerId: string
      errorCode: string
      retryable: boolean
    }): Promise<Result<true>> {
      const { data, error } = await rpc('fail_accounting_invoice_job', {
        p_job_id: input.jobId, p_worker_id: input.workerId,
        p_error_code: input.errorCode, p_retryable: input.retryable,
      })
      return error ? err('Accounting failure update failed')
        : data === true ? ok(true) : err('Accounting failure was not claimed')
    },
  }
}
