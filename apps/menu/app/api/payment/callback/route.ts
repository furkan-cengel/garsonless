import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { createIyzicoClient, retrieveCheckout } from '../../../../lib/iyzico'
import { resolveCredentialsByPaymentToken, resolveCredentialsByShareToken } from '../../../../lib/payment-credentials'
import { createServiceClient, markOrderPaidDB, settleShareDB } from '@garsonless/db'

async function recordReconciliation(input: {
  token: string
  eventType: 'order_settlement_failed' | 'share_settlement_failed' | 'order_mapping_missing'
  restaurantId?: string | null
  orderId?: string | null
  shareId?: string | null
  detail?: Record<string, unknown>
}) {
  const tokenHash = createHash('sha256').update(input.token).digest('hex')
  const client = createServiceClient()
  const table = client.from.bind(client) as unknown as (name: string) => {
    insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>
  }
  const { error } = await table('payment_reconciliation_events').insert({
    restaurant_id: input.restaurantId ?? null,
    order_id: input.orderId ?? null,
    share_id: input.shareId ?? null,
    provider_token_hash: tokenHash,
    event_type: input.eventType,
    detail: (input.detail ?? {}) as never,
  })
  if (error) console.warn(JSON.stringify({ event: 'payment.callback.reconciliation_record_failed', error: error.message }))
}

// İyzico browser-POSTs into the PaymentModal iframe, so this route must
// return a renderable HTML page that postMessages the result to the parent.
function callbackHtml(
  message:
    | { type: 'PAYMENT_SUCCESS'; orderId: string }
    | { type: 'SHARE_PAYMENT_SUCCESS'; shareId: string }
    | { type: 'PAYMENT_FAILED'; reason: string },
  text: string,
  status = 200,
): NextResponse {
  const payload = JSON.stringify(message).replace(/</g, '\\u003c')
  const html = [
    '<!doctype html><html lang="tr"><head><meta charset="utf-8"></head>',
    '<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;color:#444;font-size:14px;text-align:center;padding:0 16px">',
    `<p>${text}</p>`,
    `<script>try{window.parent.postMessage(${payload},'*')}catch(e){}</script>`,
    '</body></html>',
  ].join('')
  return new NextResponse(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

export async function POST(req: Request): Promise<NextResponse> {
  let token: string | undefined

  const contentType = req.headers.get('content-type') ?? ''
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await req.text()
    const params = new URLSearchParams(text)
    token = params.get('token') ?? undefined
  } else {
    try {
      const body = (await req.json()) as Record<string, unknown>
      token = typeof body['token'] === 'string' ? body['token'] : undefined
    } catch {
      // ignore
    }
  }

  if (!token) {
    return callbackHtml(
      { type: 'PAYMENT_FAILED', reason: 'Ödeme doğrulanamadı (token eksik)' },
      'Ödeme doğrulanamadı.',
      400,
    )
  }

  try {
    // SHARE branch first: if this token is in payment_share_tokens it's a split
    // share payment → settle THAT share (not the whole order). The existing
    // single-order path below is reached only for non-share tokens, unchanged.
    const shareResolved = await resolveCredentialsByShareToken(token)
    if (shareResolved.shareId) {
      const { credentials: sCred, shareId, restaurantId: sRest } = shareResolved
      if (!sCred || !sRest) {
        return callbackHtml({ type: 'PAYMENT_FAILED', reason: 'Ödeme yapılandırması bulunamadı' }, 'Ödeme yapılandırması bulunamadı.', 503)
      }
      const sClient = createIyzicoClient(sCred)
      const { paymentStatus: sStatus } = await retrieveCheckout(sClient, token)
      if (sStatus === 'SUCCESS') {
        // Card is real payment → settle the share (method already 'iyzico',
        // settled_by null = system). settleShareDB stamps covered orders
        // paid+'split' if this crossed full coverage, but it does NOT close
        // the table. Idempotent on a re-fired callback.
        const { error } = await settleShareDB(shareId, sRest)
        if (error) {
          console.warn(JSON.stringify({ event: 'payment.callback.share_settle_failed', shareId, error }))
          await recordReconciliation({ token, eventType: 'share_settlement_failed', restaurantId: sRest, shareId, detail: { error } })
          return callbackHtml(
            { type: 'PAYMENT_FAILED', reason: 'Ödeme alındı; ancak sipariş kaydı güncellenemedi. Destek ekibi bilgilendirildi.' },
            'Ödeme alındı; ancak hesabınız güncellenemedi. Lütfen tekrar ödeme yapmayın ve işletmeye bildirin.',
            503,
          )
        }
        return callbackHtml({ type: 'SHARE_PAYMENT_SUCCESS', shareId }, 'Payınız ödendi, teşekkürler…')
      }
      return callbackHtml({ type: 'PAYMENT_FAILED', reason: 'Ödeme tamamlanamadı' }, 'Ödeme tamamlanamadı.')
    }

    // Resolve token → order → restaurant → credentials entirely server-side;
    // nothing in the callback payload is trusted beyond the token itself.
    const { credentials, orderId, restaurantId } = await resolveCredentialsByPaymentToken(token)
    if (!credentials) {
      return callbackHtml(
        { type: 'PAYMENT_FAILED', reason: 'Ödeme yapılandırması bulunamadı' },
        'Ödeme yapılandırması bulunamadı.',
        503,
      )
    }

    const client = createIyzicoClient(credentials)
    const { paymentStatus, basketId } = await retrieveCheckout(client, token)

    if (paymentStatus === 'SUCCESS' && basketId) {
      if (orderId && orderId !== basketId) {
        console.warn(
          JSON.stringify({ event: 'payment.callback.basket_mismatch', orderId, basketId }),
        )
      }
      // Mark paid using the token-resolved order + restaurant (trusted), NOT the
      // İyzico-echoed basketId. Scoped to restaurantId (GAP #3 defense-in-depth).
      // method='iyzico' (online); settled_by stays null (system, not staff).
      if (!orderId || !restaurantId) {
        console.warn(JSON.stringify({ event: 'payment.callback.order_mapping_missing', orderId, restaurantId, basketId }))
        await recordReconciliation({ token, eventType: 'order_mapping_missing', restaurantId, orderId, detail: { basketId } })
        return callbackHtml(
          { type: 'PAYMENT_FAILED', reason: 'Ödeme alındı; ancak sipariş eşleştirilemedi. Destek ekibi bilgilendirildi.' },
          'Ödeme alındı; ancak siparişiniz eşleştirilemedi. Lütfen tekrar ödeme yapmayın ve işletmeye bildirin.',
          503,
        )
      }
      const { error } = await markOrderPaidDB(orderId, restaurantId, 'iyzico')
      if (error) {
        console.warn(JSON.stringify({ event: 'payment.callback.mark_paid_failed', orderId, error }))
        await recordReconciliation({ token, eventType: 'order_settlement_failed', restaurantId, orderId, detail: { error } })
        return callbackHtml(
          { type: 'PAYMENT_FAILED', reason: 'Ödeme alındı; ancak sipariş kaydı güncellenemedi. Destek ekibi bilgilendirildi.' },
          'Ödeme alındı; ancak siparişiniz güncellenemedi. Lütfen tekrar ödeme yapmayın ve işletmeye bildirin.',
          503,
        )
      }
      return callbackHtml(
        { type: 'PAYMENT_SUCCESS', orderId },
        'Ödeme tamamlandı, yönlendiriliyorsunuz…',
      )
    }

    return callbackHtml(
      { type: 'PAYMENT_FAILED', reason: 'Ödeme tamamlanamadı' },
      'Ödeme tamamlanamadı.',
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Callback processing failed'
    return callbackHtml(
      { type: 'PAYMENT_FAILED', reason: msg },
      'Ödeme işlenirken bir hata oluştu.',
      500,
    )
  }
}
