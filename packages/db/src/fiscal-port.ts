import type { FiscalOrderInput, FiscalPaymentMethod, FiscalSection } from '@garsonless/application/fiscal'
import { readOrderLineSnapshots } from './menu-domain'
import { createServiceClient } from './service-client'

type Rpc = (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>
const rpc = () => {
  const client = createServiceClient()
  return client.rpc.bind(client) as unknown as Rpc
}

export interface FiscalSettings {
  provider: 'tokenx'
  enabled: boolean
  merchantId: string | null
  branchId: string | null
  terminalId: string | null
  sections: FiscalSection[]
  sectionOverrides: Record<string, number>
  verifiedAt: string | null
}

export interface ClaimedFiscalDocument {
  id: string
  restaurantId: string
  basketId: string
  revision: number
  attempts: number
  syncedRevision: number
  settings: { enabled: boolean; branchId: string | null; terminalId: string | null; sections: FiscalSection[]; sectionOverrides: Record<string, number> }
  session: { id: string; closed: boolean; tableLabel: string | null; areaLabel: string | null }
  orders: FiscalOrderInput[]
}

const sectionsOf = (value: unknown): FiscalSection[] => (Array.isArray(value) ? value : []).flatMap((row) => {
  const section = row as Record<string, unknown>
  return Number.isInteger(section['sectionNo']) && Number.isInteger(section['taxPercent'])
    ? [{ sectionNo: section['sectionNo'] as number, taxPercent: section['taxPercent'] as number, name: String(section['name'] ?? '') }]
    : []
})
const overridesOf = (value: unknown): Record<string, number> => Object.fromEntries(
  Object.entries((value && typeof value === 'object' ? value : {}) as Record<string, unknown>).filter(([, sectionNo]) => Number.isInteger(sectionNo)),
) as Record<string, number>

export async function readFiscalSettings(restaurantId: string): Promise<FiscalSettings | null> {
  const { data, error } = await createServiceClient().from('restaurant_fiscal_settings')
    .select('provider, enabled, merchant_id, branch_id, terminal_id, sections, section_overrides, verified_at')
    .eq('restaurant_id', restaurantId).maybeSingle()
  if (error) throw new Error(`readFiscalSettings: ${error.message}`)
  if (!data) return null
  return {
    provider: 'tokenx',
    enabled: data.enabled,
    merchantId: data.merchant_id,
    branchId: data.branch_id,
    terminalId: data.terminal_id,
    sections: sectionsOf(data.sections),
    sectionOverrides: overridesOf(data.section_overrides),
    verifiedAt: data.verified_at,
  }
}

/** Device pairing as just verified against the provider; enabling needs a verified device. */
export async function saveFiscalSettings(input: {
  restaurantId: string
  actorId: string
  enabled: boolean
  merchantId: string | null
  branchId: string | null
  terminalId: string | null
  sections: FiscalSection[]
  sectionOverrides: Record<string, number>
  verified: boolean
}): Promise<void> {
  const { error } = await createServiceClient().from('restaurant_fiscal_settings').upsert({
    restaurant_id: input.restaurantId,
    provider: 'tokenx',
    enabled: input.enabled,
    merchant_id: input.merchantId,
    branch_id: input.branchId,
    terminal_id: input.terminalId,
    sections: input.sections as unknown as never,
    section_overrides: input.sectionOverrides as unknown as never,
    ...(input.verified ? { verified_at: new Date().toISOString() } : {}),
    updated_at: new Date().toISOString(),
    updated_by: input.actorId,
  }, { onConflict: 'restaurant_id' })
  if (error) throw new Error(`saveFiscalSettings: ${error.message}`)
}

export async function claimFiscalDocuments(limit: number): Promise<ClaimedFiscalDocument[]> {
  const { data, error } = await rpc()('claim_fiscal_documents', { p_limit: limit })
  if (error) throw new Error(`claimFiscalDocuments: ${error.message}`)
  return (Array.isArray(data) ? data : []).map((row) => {
    const doc = row as Record<string, unknown>
    const settings = (doc['settings'] ?? {}) as Record<string, unknown>
    const session = (doc['session'] ?? {}) as Record<string, unknown>
    return {
      id: String(doc['id']),
      restaurantId: String(doc['restaurantId']),
      basketId: String(doc['basketId']),
      revision: Number(doc['revision']),
      attempts: Number(doc['attempts']),
      syncedRevision: Number(doc['syncedRevision']),
      settings: {
        enabled: settings['enabled'] === true,
        branchId: typeof settings['branchId'] === 'string' ? settings['branchId'] : null,
        terminalId: typeof settings['terminalId'] === 'string' ? settings['terminalId'] : null,
        sections: sectionsOf(settings['sections']),
        sectionOverrides: overridesOf(settings['sectionOverrides']),
      },
      session: {
        id: String(session['id']),
        closed: session['closed'] === true,
        tableLabel: typeof session['tableLabel'] === 'string' ? session['tableLabel'] : null,
        areaLabel: typeof session['areaLabel'] === 'string' ? session['areaLabel'] : null,
      },
      orders: (Array.isArray(doc['orders']) ? doc['orders'] : []).map((value) => {
        const order = value as Record<string, unknown>
        return {
          id: String(order['id']),
          total: Number(order['total']),
          lines: readOrderLineSnapshots(order['items']).map((line) => ({
            name: line.name, price: line.price, modifiersPriceDelta: line.modifiersPriceDelta, quantity: line.quantity, vatRate: line.vatRate,
          })),
        }
      }),
    }
  })
}

export async function finishFiscalDocument(input: {
  id: string
  revision: number
  outcome: 'synced' | 'held' | 'deleted' | 'retry' | 'failed'
  error: string | null
  orderIds: string[]
}): Promise<void> {
  const { error } = await rpc()('finish_fiscal_document', {
    p_id: input.id, p_revision: input.revision, p_outcome: input.outcome, p_error: input.error, p_order_ids: input.orderIds,
  })
  if (error) throw new Error(`finishFiscalDocument: ${error.message}`)
}

export async function readFiscalPaymentScope(basketId: string): Promise<{ documentId: string; status: string; orders: Array<{ id: string; total: number }> } | null> {
  const { data, error } = await rpc()('read_fiscal_payment_scope', { p_basket_id: basketId })
  if (error) throw new Error(`readFiscalPaymentScope: ${error.message}`)
  if (!data || typeof data !== 'object') return null
  const scope = data as Record<string, unknown>
  return {
    documentId: String(scope['documentId']),
    status: String(scope['status']),
    orders: (Array.isArray(scope['orders']) ? scope['orders'] : []).map((value) => {
      const order = value as Record<string, unknown>
      return { id: String(order['id']), total: Number(order['total']) }
    }),
  }
}

export async function applyFiscalPayment(input: {
  basketId: string
  terminalId: string | null
  receiptNo: string | null
  zNo: string | null
  payments: unknown
  allocations: Array<{ orderId: string; method: FiscalPaymentMethod }>
}): Promise<'applied' | 'duplicate' | 'not_found'> {
  const { data, error } = await rpc()('apply_fiscal_payment', {
    p_basket_id: input.basketId,
    p_terminal_id: input.terminalId,
    p_receipt_no: input.receiptNo,
    p_z_no: input.zNo,
    p_payments: input.payments,
    p_allocations: input.allocations.map((entry) => ({ order_id: entry.orderId, method: entry.method })),
  })
  if (error) throw new Error(`applyFiscalPayment: ${error.message}`)
  return data === 'applied' || data === 'duplicate' ? data : 'not_found'
}

export async function recordFiscalEvent(basketId: string, kind: 'locked' | 'unlocked' | 'cancelled' | 'voided', terminalId: string | null): Promise<void> {
  const { error } = await rpc()('record_fiscal_event', { p_basket_id: basketId, p_kind: kind, p_terminal_id: terminalId })
  if (error) throw new Error(`recordFiscalEvent: ${error.message}`)
}
