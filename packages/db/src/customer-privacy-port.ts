import { createServiceClient } from './service-client'

export interface CustomerPrivacyExportRecord {
  requestId: string
  status: 'completed'
  fileName: string
  data: Record<string, unknown>
}

export interface CustomerDeleteRequestRecord {
  requestId: string
  status: 'pending_review' | 'approved' | 'rejected' | 'fulfilled'
  requestedAt: string
  message: string
}

type Rpc = (name: string, args: Record<string, unknown>) => Promise<{
  data: unknown
  error: { message: string } | null
}>

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function rpc(): Rpc {
  const service = createServiceClient()
  return service.rpc.bind(service) as unknown as Rpc
}

export async function createCustomerPrivacyExport(input: {
  customerId: string
  requestId: string
}): Promise<CustomerPrivacyExportRecord> {
  const { data, error } = await rpc()('create_customer_privacy_export', {
    p_customer_id: input.customerId,
    p_request_id: input.requestId,
  })
  if (error) throw new Error('customer_privacy_export_failed')
  const row = object(data)
  const document = object(row?.['data'])
  if (!row || row['status'] !== 'completed' || typeof row['requestId'] !== 'string'
      || typeof row['fileName'] !== 'string' || !document) {
    throw new Error('customer_privacy_export_invalid')
  }
  return {
    requestId: row['requestId'],
    status: 'completed',
    fileName: row['fileName'],
    data: document,
  }
}

export async function createCustomerDeleteRequest(input: {
  customerId: string
  requestId: string
  confirmation: string
}): Promise<CustomerDeleteRequestRecord> {
  const { data, error } = await rpc()('request_customer_account_deletion', {
    p_customer_id: input.customerId,
    p_request_id: input.requestId,
    p_confirmation: input.confirmation,
  })
  if (error) throw new Error('customer_delete_request_failed')
  const row = object(data)
  if (!row || typeof row['requestId'] !== 'string' || typeof row['requestedAt'] !== 'string'
      || typeof row['message'] !== 'string'
      || !['pending_review', 'approved', 'rejected', 'fulfilled'].includes(String(row['status']))) {
    throw new Error('customer_delete_request_invalid')
  }
  return {
    requestId: row['requestId'],
    status: row['status'] as CustomerDeleteRequestRecord['status'],
    requestedAt: row['requestedAt'],
    message: row['message'],
  }
}
