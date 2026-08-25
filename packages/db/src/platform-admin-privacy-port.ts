import type {
  PlatformPrivacyOperation,
  PlatformTenantPrivacyExport,
  PlatformTenantPrivacyPort,
} from '@garsonless/application/platform-admin-privacy'
import {
  isPlatformPrivacyOperationStatus,
  isPlatformPrivacyOperationType,
  isPrivacyOperationSummary,
} from '@garsonless/domain/platform-privacy'
import { err, ok } from '@garsonless/domain/result'
import { createServiceClient } from './service-client'

type RpcName =
  | 'read_platform_admin_tenant_privacy_operations'
  | 'export_platform_admin_tenant_privacy_data'
  | 'erase_platform_admin_tenant_privacy_data'
type RpcResult = { data: unknown; error: { message: string } | null }
export type PlatformPrivacyRpc = (name: RpcName, args: Record<string, unknown>) => PromiseLike<RpcResult>
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid object')
  return value as Record<string, unknown>
}
function timestamp(value: unknown): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new Error('invalid timestamp')
  return value
}
function nullableString(value: unknown): string | null {
  if (value === null) return null
  if (typeof value !== 'string') throw new Error('invalid nullable string')
  return value
}
function operation(value: unknown): PlatformPrivacyOperation {
  const row = object(value)
  if (
    typeof row.id !== 'string' || !UUID.test(row.id)
    || typeof row.restaurantId !== 'string' || !UUID.test(row.restaurantId)
    || !isPlatformPrivacyOperationType(row.type)
    || !isPlatformPrivacyOperationStatus(row.status)
    || typeof row.reason !== 'string' || row.reason.trim().length < 10
    || !isPrivacyOperationSummary(row.summary)
    || typeof row.requestedBy !== 'string' || !UUID.test(row.requestedBy)
    || typeof row.requestId !== 'string' || !UUID.test(row.requestId)
  ) throw new Error('invalid operation')
  return {
    id: row.id,
    restaurantId: row.restaurantId,
    type: row.type,
    status: row.status,
    reason: row.reason,
    summary: row.summary,
    requestedBy: row.requestedBy,
    requestId: row.requestId,
    createdAt: timestamp(row.createdAt),
    completedAt: timestamp(row.completedAt),
  }
}
function document(value: unknown): PlatformTenantPrivacyExport {
  const row = object(value)
  const tenant = object(row.tenant)
  if (
    row.schemaVersion !== 1 || !Array.isArray(row.customers)
    || typeof tenant.id !== 'string' || !UUID.test(tenant.id)
    || typeof tenant.name !== 'string' || typeof tenant.slug !== 'string'
  ) throw new Error('invalid export')
  return {
    schemaVersion: 1,
    generatedAt: timestamp(row.generatedAt),
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, createdAt: timestamp(tenant.createdAt) },
    customers: row.customers.map((value) => {
      const customer = object(value)
      if (
        typeof customer.id !== 'string' || !UUID.test(customer.id)
        || !Array.isArray(customer.consents) || !Array.isArray(customer.orders)
        || !Array.isArray(customer.loyalty) || !Array.isArray(customer.paymentShares)
        || !Array.isArray(customer.campaignRecipients)
      ) throw new Error('invalid export customer')
      return {
        id: customer.id,
        name: nullableString(customer.name),
        email: nullableString(customer.email),
        phone: nullableString(customer.phone),
        verifiedAt: customer.verifiedAt === null ? null : timestamp(customer.verifiedAt),
        consents: customer.consents,
        orders: customer.orders,
        loyalty: customer.loyalty,
        paymentShares: customer.paymentShares,
        campaignRecipients: customer.campaignRecipients,
      }
    }),
  }
}
function serviceRpc(): PlatformPrivacyRpc {
  const service = createServiceClient()
  return service.rpc.bind(service) as unknown as PlatformPrivacyRpc
}

export function createPlatformAdminPrivacyPort(rpc: PlatformPrivacyRpc = serviceRpc()): PlatformTenantPrivacyPort {
  return {
    async readOperations(input) {
      try {
        const { data, error } = await rpc('read_platform_admin_tenant_privacy_operations', { p_restaurant_id: input.restaurantId, p_actor_user_id: input.actorUserId, p_actor_role: input.actorRole })
        if (error || !Array.isArray(data)) return err('platform_privacy_read_failed')
        return ok(data.map(operation))
      } catch { return err('platform_privacy_read_failed') }
    },
    async exportData(input) {
      try {
        const { data, error } = await rpc('export_platform_admin_tenant_privacy_data', { p_restaurant_id: input.restaurantId, p_actor_user_id: input.actorUserId, p_actor_role: input.actorRole, p_reason: input.reason, p_request_id: input.requestId })
        if (error) return err('platform_privacy_export_failed')
        const row = object(data)
        if (typeof row.duplicate !== 'boolean') throw new Error('invalid duplicate')
        return ok({ operation: operation(row.operation), document: document(row.document), duplicate: row.duplicate })
      } catch { return err('platform_privacy_export_failed') }
    },
    async eraseData(input) {
      try {
        const { data, error } = await rpc('erase_platform_admin_tenant_privacy_data', { p_restaurant_id: input.restaurantId, p_actor_user_id: input.actorUserId, p_actor_role: input.actorRole, p_reason: input.reason, p_request_id: input.requestId })
        if (error) return err('platform_privacy_erase_failed')
        const row = object(data)
        if (typeof row.duplicate !== 'boolean') throw new Error('invalid duplicate')
        return ok({ operation: operation(row.operation), duplicate: row.duplicate })
      } catch { return err('platform_privacy_erase_failed') }
    },
  }
}
