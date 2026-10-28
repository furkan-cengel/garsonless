import { allocateFiscalPayment, buildFiscalBasket, type FiscalEvent, type FiscalPaymentMethod } from '@garsonless/application/fiscal'
import type { ClaimedFiscalDocument } from '@garsonless/db/server'
import { TokenxError, type createTokenxClient } from './tokenx-client'

type Client = Pick<ReturnType<typeof createTokenxClient>, 'putBasket' | 'deleteBasket'>

export type FiscalSyncResult = {
  outcome: 'synced' | 'held' | 'deleted' | 'retry' | 'failed'
  error: string | null
  orderIds: string[]
}

const HELD_REASONS = {
  unknown_vat: 'KDV oranı olmayan ürün var; menüden KDV oranını girin.',
  unmapped_vat: 'Yazarkasada bu KDV oranına ait bölüm yok',
} as const

/**
 * One document: send the bill's unpaid orders as the basket, or remove the
 * basket when the bill closed, emptied or the integration was switched off.
 */
export async function syncFiscalDocument(doc: ClaimedFiscalDocument, client: Client): Promise<FiscalSyncResult> {
  const remove = !doc.settings.enabled || doc.session.closed || doc.orders.length === 0
  try {
    if (remove) {
      // A basket never sent has nothing to delete on the device.
      if (doc.syncedRevision > 0) await client.deleteBasket(doc.basketId)
      return { outcome: 'deleted', error: null, orderIds: [] }
    }
    if (!doc.settings.branchId) return { outcome: 'failed', error: 'Yazarkasa şubesi tanımlı değil', orderIds: [] }
    const built = buildFiscalBasket(doc.orders, doc.settings.sections, doc.settings.sectionOverrides)
    if (!built.ok) {
      const reason = built.reason === 'unmapped_vat' ? `${HELD_REASONS.unmapped_vat}: %${built.rates.join(', %')}` : HELD_REASONS.unknown_vat
      return { outcome: 'held', error: reason, orderIds: [] }
    }
    await client.putBasket(doc.settings.branchId, doc.basketId, built.basket, {
      title: doc.session.tableLabel ?? 'Masa',
      filter: doc.session.areaLabel,
      checkNumber: null,
      note: null,
    })
    return { outcome: 'synced', error: null, orderIds: doc.orders.map((order) => order.id) }
  } catch (error) {
    if (error instanceof TokenxError) return { outcome: error.retryable ? 'retry' : 'failed', error: `TokenX ${error.code}`, orderIds: [] }
    return { outcome: 'retry', error: 'Beklenmeyen hata', orderIds: [] }
  }
}

/** What a device result means for Masabu; the caller does the writes. */
export function planFiscalEvent(
  event: FiscalEvent,
  scope: { status: string; orders: Array<{ id: string; total: number }> } | null,
): { kind: 'ignore' } | { kind: 'record'; event: 'locked' | 'unlocked' | 'cancelled' | 'voided' } | { kind: 'settle'; allocations: Array<{ orderId: string; method: FiscalPaymentMethod }> } {
  if (event.kind !== 'completed') return { kind: 'record', event: event.kind }
  if (!scope || scope.status === 'completed' || scope.status === 'voided') return { kind: 'ignore' }
  return { kind: 'settle', allocations: allocateFiscalPayment(scope.orders, event.payments) }
}
