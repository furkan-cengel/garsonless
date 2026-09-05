import { NextResponse } from 'next/server'
import { createHash, randomBytes } from 'node:crypto'
import { settleOrder as settleOrderCommand } from '@garsonless/application/orders'
import { settleProviderShare } from '@garsonless/application/splits'
import { createIyzicoClient, retrieveCheckout } from '../../../../lib/iyzico'
import { resolveCredentialsByPaymentToken, resolveCredentialsByShareToken } from '../../../../lib/payment-credentials'
import {
  attachOrderProviderPayment,
  createSettlementPort,
  createSplitPaymentPort,
  readShareProviderCheckout,
  recordPaymentReconciliation,
} from '@garsonless/db/server'
import {
  createPaymentCallbackDocument,
  paymentCallbackSecurityHeaders,
} from '../../../../lib/payment-callback-document'
import type { PaymentCallbackMessage } from '../../../../lib/payment-callback-message'
import { readBoundedPaymentCallbackToken } from '../../../../lib/payment-callback-request'

async function recordReconciliation(input: {
  token: string
  eventType: 'order_settlement_failed' | 'share_settlement_failed' | 'order_mapping_missing'
  restaurantId?: string | null
  orderId?: string | null
  shareId?: string | null
  detail?: Record<string, unknown>
}) {
  const tokenHash = createHash('sha256').update(input.token).digest('hex')
  const recorded = await recordPaymentReconciliation({
    restaurantId: input.restaurantId,
    orderId: input.orderId,
    shareId: input.shareId,
    providerTokenHash: tokenHash,
    eventType: input.eventType,
    detail: input.detail,
  })
  if (!recorded.ok) {
    console.error(JSON.stringify({ event: 'payment.callback.reconciliation_record_failed' }))
  }
}

// İyzico browser-POSTs into the PaymentModal iframe, so this route must
// return a renderable HTML page that postMessages the result to the parent.
function callbackHtml(
  parentOrigin: URL,
  message: PaymentCallbackMessage,
  text: string,
  status = 200,
): NextResponse {
  const nonce = randomBytes(18).toString('base64url')
  const html = createPaymentCallbackDocument({ message, nonce, parentOrigin, text })
  return new NextResponse(html, {
    status,
    headers: paymentCallbackSecurityHeaders(nonce),
  })
}

export async function POST(req: Request): Promise<NextResponse> {
  const parentOrigin = new URL(req.url)
  const respond = (
    message: PaymentCallbackMessage,
    text: string,
    status = 200,
  ) => callbackHtml(parentOrigin, message, text, status)
  const callbackRequest = await readBoundedPaymentCallbackToken(req)
  if (!callbackRequest.ok) {
    return respond(
      { type: 'PAYMENT_FAILED', reason: callbackRequest.error },
      'Ödeme doğrulanamadı.',
      callbackRequest.status,
    )
  }
  const token = callbackRequest.token

  try {
    // SHARE branch first: if this token is in payment_share_tokens it's a split
    // share payment → settle THAT share (not the whole order). The existing
    // single-order path below is reached only for non-share tokens, unchanged.
    const shareResolved = await resolveCredentialsByShareToken(token)
    if (shareResolved.shareId) {
      const { credentials: sCred, shareId, restaurantId: sRest } = shareResolved
      if (!sCred || !sRest) {
        return respond({ type: 'PAYMENT_FAILED', reason: 'Ödeme yapılandırması bulunamadı' }, 'Ödeme yapılandırması bulunamadı.', 503)
      }
      const sClient = createIyzicoClient(sCred)
      const shareCheckout = await readShareProviderCheckout({ shareId, restaurantId: sRest })
      if (shareCheckout.error || !shareCheckout.share) {
        return respond({ type: 'PAYMENT_FAILED', reason: 'Ödeme payı doğrulanamadı' }, 'Ödeme payı doğrulanamadı.', 503)
      }
      const {
        paymentStatus: sStatus,
        basketId: sBasketId,
        paidPrice: sPaidPrice,
        currency: sCurrency,
      } = await retrieveCheckout(sClient, token, sCred.secretKey)
      if (sStatus === 'SUCCESS') {
        const amountMatches = Math.round(sPaidPrice * 100) === Math.round(shareCheckout.share.amount * 100)
        if (sBasketId !== shareId || sCurrency !== 'TRY' || !amountMatches) {
          await recordReconciliation({
            token,
            eventType: 'share_settlement_failed',
            restaurantId: sRest,
            shareId,
            detail: { stage: 'provider_result_mismatch' },
          })
          return respond(
            { type: 'PAYMENT_FAILED', reason: 'Ödeme sonucu pay ile güvenle eşleştirilemedi.' },
            'Ödeme sonucu güvenle eşleştirilemedi. Lütfen tekrar ödeme yapmayın ve işletmeye bildirin.',
            503,
          )
        }
        // Card is real payment → settle the share (method already 'iyzico',
        // settled_by null = system). The repository stamps covered orders
        // paid+'split' if this crossed full coverage, but it does NOT close
        // the table. Idempotent on a re-fired callback.
        const settlement = await settleProviderShare(
          { actor: 'payment-provider', restaurantId: sRest, provider: 'iyzico' },
          { shareId, restaurantId: sRest },
          createSplitPaymentPort(),
        )
        if (!settlement.ok) {
          console.warn(JSON.stringify({ event: 'payment.callback.share_settle_failed' }))
          await recordReconciliation({ token, eventType: 'share_settlement_failed', restaurantId: sRest, shareId, detail: { error: settlement.error } })
          return respond(
            { type: 'PAYMENT_FAILED', reason: 'Ödeme alındı; ancak sipariş kaydı güncellenemedi. Destek ekibi bilgilendirildi.' },
            'Ödeme alındı; ancak hesabınız güncellenemedi. Lütfen tekrar ödeme yapmayın ve işletmeye bildirin.',
            503,
          )
        }
        return respond({ type: 'SHARE_PAYMENT_SUCCESS', shareId }, 'Payınız ödendi, teşekkürler…')
      }
      return respond({ type: 'PAYMENT_FAILED', reason: 'Ödeme tamamlanamadı' }, 'Ödeme tamamlanamadı.')
    }

    // Resolve token → order → restaurant → credentials entirely server-side;
    // nothing in the callback payload is trusted beyond the token itself.
    const { credentials, orderId, restaurantId } = await resolveCredentialsByPaymentToken(token)
    if (!credentials) {
      return respond(
        { type: 'PAYMENT_FAILED', reason: 'Ödeme yapılandırması bulunamadı' },
        'Ödeme yapılandırması bulunamadı.',
        503,
      )
    }

    const client = createIyzicoClient(credentials)
    const { paymentStatus, basketId, paymentId, paidPrice, currency } = await retrieveCheckout(client, token, credentials.secretKey)

    if (paymentStatus === 'SUCCESS' && basketId) {
      // Mark paid using the token-resolved order + restaurant (trusted), NOT the
      // İyzico-echoed basketId. Scoped to restaurantId (GAP #3 defense-in-depth).
      // method='iyzico' (online); settled_by stays null (system, not staff).
      if (!orderId || !restaurantId) {
        console.warn(JSON.stringify({ event: 'payment.callback.order_mapping_missing' }))
        await recordReconciliation({ token, eventType: 'order_mapping_missing', restaurantId, orderId, detail: { basketId } })
        return respond(
          { type: 'PAYMENT_FAILED', reason: 'Ödeme alındı; ancak sipariş eşleştirilemedi. Destek ekibi bilgilendirildi.' },
          'Ödeme alındı; ancak siparişiniz eşleştirilemedi. Lütfen tekrar ödeme yapmayın ve işletmeye bildirin.',
          503,
        )
      }
      if (basketId !== orderId) {
        console.warn(JSON.stringify({ event: 'payment.callback.basket_mismatch' }))
        await recordReconciliation({
          token,
          eventType: 'order_settlement_failed',
          restaurantId,
          orderId,
          detail: { stage: 'provider_basket_mismatch' },
        })
        return respond(
          { type: 'PAYMENT_FAILED', reason: 'Ödeme sonucu siparişle güvenle eşleştirilemedi.' },
          'Ödeme sonucu siparişle güvenle eşleştirilemedi. Lütfen tekrar ödeme yapmayın ve işletmeye bildirin.',
          503,
        )
      }
      const mappingError = await attachOrderProviderPayment({
        orderId,
        restaurantId,
        token,
        providerPaymentId: paymentId,
        paidPrice,
        currency,
      })
      if (mappingError) {
        console.warn(JSON.stringify({ event: 'payment.callback.provider_mapping_failed' }))
        await recordReconciliation({ token, eventType: 'order_settlement_failed', restaurantId, orderId, detail: { stage: 'provider_mapping', error: mappingError } })
        return respond(
          { type: 'PAYMENT_FAILED', reason: 'Ödeme alındı; ancak sağlayıcı kaydı güvenle eşleştirilemedi. Destek ekibi bilgilendirildi.' },
          'Ödeme alındı; ancak siparişiniz güncellenemedi. Lütfen tekrar ödeme yapmayın ve işletmeye bildirin.',
          503,
        )
      }
      const settlement = await settleOrderCommand(
        { actor: 'payment-provider', restaurantId, provider: 'iyzico' },
        { orderId, restaurantId, method: 'iyzico' },
        createSettlementPort(),
      )
      if (!settlement.ok) {
        console.warn(JSON.stringify({ event: 'payment.callback.mark_paid_failed' }))
        await recordReconciliation({ token, eventType: 'order_settlement_failed', restaurantId, orderId, detail: { error: settlement.error } })
        return respond(
          { type: 'PAYMENT_FAILED', reason: 'Ödeme alındı; ancak sipariş kaydı güncellenemedi. Destek ekibi bilgilendirildi.' },
          'Ödeme alındı; ancak siparişiniz güncellenemedi. Lütfen tekrar ödeme yapmayın ve işletmeye bildirin.',
          503,
        )
      }
      return respond(
        { type: 'PAYMENT_SUCCESS', orderId },
        'Ödeme tamamlandı, yönlendiriliyorsunuz…',
      )
    }

    return respond(
      { type: 'PAYMENT_FAILED', reason: 'Ödeme tamamlanamadı' },
      'Ödeme tamamlanamadı.',
    )
  } catch {
    return respond(
      { type: 'PAYMENT_FAILED', reason: 'Ödeme sonucu güvenli biçimde işlenemedi.' },
      'Ödeme işlenirken bir hata oluştu.',
      500,
    )
  }
}
