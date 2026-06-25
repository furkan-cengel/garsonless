import { NextResponse } from 'next/server'
import { createIyzicoClient, retrieveCheckout } from '../../../../lib/iyzico'
import { resolveCredentialsByPaymentToken } from '../../../../lib/payment-credentials'
import { markOrderPaidDB } from '@garsonless/db'

// İyzico browser-POSTs into the PaymentModal iframe, so this route must
// return a renderable HTML page that postMessages the result to the parent.
function callbackHtml(
  message: { type: 'PAYMENT_SUCCESS'; orderId: string } | { type: 'PAYMENT_FAILED'; reason: string },
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
      if (orderId && restaurantId) {
        const { error } = await markOrderPaidDB(orderId, restaurantId, 'iyzico')
        if (error) {
          console.warn(JSON.stringify({ event: 'payment.callback.mark_paid_failed', orderId, error }))
        }
      }
      return callbackHtml(
        { type: 'PAYMENT_SUCCESS', orderId: orderId ?? basketId },
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
