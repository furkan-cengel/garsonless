import type { LegalDocumentType } from '@garsonless/domain/legal'
import { err, ok, type Result } from '@garsonless/domain/result'
import { createServiceClient } from './client'

type LegalAcceptanceRpc = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>

export async function recordLegalDocumentAcceptance(input: {
  userId: string
  documentType: LegalDocumentType
  documentVersion: string
  occurredAt: string
  ipHash: string | null
  userAgent: string | null
  evidenceKey?: string
  documentContext?: Record<string, unknown>
}): Promise<Result<true>> {
  const service = createServiceClient()
  const call = service.rpc.bind(service) as unknown as LegalAcceptanceRpc
  const { data, error } = await call('record_legal_document_acceptance', {
    p_user_id: input.userId,
    p_document_type: input.documentType,
    p_document_version: input.documentVersion,
    p_occurred_at: input.occurredAt,
    p_ip_hash: input.ipHash,
    p_user_agent: input.userAgent,
    p_evidence_key: input.evidenceKey ?? 'default',
    p_document_context: input.documentContext ?? {},
  })
  if (error) return err(error.message)
  return data === true ? ok(true) : err('Legal acceptance result is invalid')
}

export async function recordSignupLegalEvidence(input: {
  userId: string
  documentVersion: string
  occurredAt: string
  ipHash: string | null
  userAgent: string | null
}): Promise<Result<true>> {
  const service = createServiceClient()
  const call = service.rpc.bind(service) as unknown as LegalAcceptanceRpc
  const { data, error } = await call('record_signup_legal_evidence', {
    p_user_id: input.userId,
    p_document_version: input.documentVersion,
    p_occurred_at: input.occurredAt,
    p_ip_hash: input.ipHash,
    p_user_agent: input.userAgent,
  })
  if (error) return err(error.message)
  return data === true ? ok(true) : err('Signup legal evidence result is invalid')
}

export async function recordCustomerMembershipLegalEvidence(input: {
  userId: string
  documentVersion: string
  occurredAt: string
  ipHash: string | null
  userAgent: string | null
  restaurantId?: string | null
}): Promise<Result<true>> {
  const service = createServiceClient()
  const call = service.rpc.bind(service) as unknown as LegalAcceptanceRpc
  const { data, error } = await call('record_customer_membership_legal_evidence', {
    p_user_id: input.userId,
    p_document_version: input.documentVersion,
    p_occurred_at: input.occurredAt,
    p_ip_hash: input.ipHash,
    p_user_agent: input.userAgent,
    p_restaurant_id: input.restaurantId ?? null,
  })
  if (error) return err(error.message)
  return data === true ? ok(true) : err('Customer legal evidence result is invalid')
}
