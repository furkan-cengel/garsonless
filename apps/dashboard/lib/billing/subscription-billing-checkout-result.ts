export const BILLING_CHECKOUT_RESULT_MESSAGE = 'masabu:billing-checkout-result' as const

export type BillingCheckoutResultOutcome = 'succeeded' | 'incomplete' | 'pending' | 'failed' | 'expired'
export type BillingCheckoutPublicCode = 'MAS-VAL-001' | 'MAS-PAY-409' | 'MAS-SVC-503'

export type BillingCheckoutResultMessage = {
  type: typeof BILLING_CHECKOUT_RESULT_MESSAGE
  outcome: BillingCheckoutResultOutcome
  code?: BillingCheckoutPublicCode
}

const PUBLIC_CODES = new Set<BillingCheckoutPublicCode>([
  'MAS-VAL-001',
  'MAS-PAY-409',
  'MAS-SVC-503',
])

export function isBillingCheckoutResultMessage(value: unknown): value is BillingCheckoutResultMessage {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  if (candidate['type'] !== BILLING_CHECKOUT_RESULT_MESSAGE
    || !['succeeded', 'incomplete', 'pending', 'failed', 'expired'].includes(String(candidate['outcome']))) return false
  return candidate['code'] === undefined || PUBLIC_CODES.has(candidate['code'] as BillingCheckoutPublicCode)
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

const RESULT_COPY: Record<BillingCheckoutResultOutcome, { title: string; description: string }> = {
  succeeded: {
    title: 'Abonelik doğrulandı',
    description: 'Planınız etkinleştirildi. Fatura teyidi arka planda tamamlanıyor.',
  },
  pending: {
    title: 'Ödeme sonucu kontrol ediliyor',
    description: 'Lütfen yeniden ödeme yapmayın. Sonuç güvenli biçimde kontrol ediliyor.',
  },
  incomplete: {
    title: 'Ödeme tamamlanmadı',
    description: 'İyzico formundaki uyarıyı kontrol edip aynı ödeme formunda yeniden deneyin.',
  },
  failed: {
    title: 'Ödeme doğrulanamadı',
    description: 'Kartınızdan yeniden tahsilat başlatmadan önce faturalama ekranına dönün.',
  },
  expired: {
    title: 'Ödeme oturumu sona erdi',
    description: 'Yeni ve güvenli bir ödeme oturumu başlatmak için faturalama ekranına dönün.',
  },
}

export function billingCheckoutResultCsp(nonce: string): string {
  if (!nonce.trim()) throw new Error('Invalid billing checkout result nonce')
  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    `style-src 'nonce-${nonce}'`,
    "img-src 'none'",
    "connect-src 'none'",
    "font-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'self'",
  ].join('; ')
}

export function createBillingCheckoutResultDocument(input: {
  dashboardOrigin: URL
  returnUrl: URL
  nonce: string
  outcome: BillingCheckoutResultOutcome
  code?: BillingCheckoutPublicCode
}): string {
  const { dashboardOrigin, returnUrl, nonce, outcome, code } = input
  if (dashboardOrigin.origin !== returnUrl.origin || !nonce.trim()) {
    throw new Error('Invalid billing checkout result document input')
  }
  const message: BillingCheckoutResultMessage = {
    type: BILLING_CHECKOUT_RESULT_MESSAGE,
    outcome,
    ...(code ? { code } : {}),
  }
  const serializedMessage = JSON.stringify(message).replaceAll('<', '\\u003c')
  const serializedOrigin = JSON.stringify(dashboardOrigin.origin).replaceAll('<', '\\u003c')
  const safeNonce = escapeHtml(nonce)
  const safeReturnUrl = escapeHtml(returnUrl.toString())
  const copy = RESULT_COPY[outcome]
  const csp = billingCheckoutResultCsp(safeNonce)

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <title>${escapeHtml(copy.title)}</title>
  <style nonce="${safeNonce}">
    html, body { min-height: 100%; margin: 0; background: #fff; color: #171717; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { display: grid; place-items: center; padding: 24px; box-sizing: border-box; text-align: center; }
    main { max-width: 420px; }
    h1 { margin: 0 0 8px; font-size: 18px; }
    p { margin: 0 0 18px; color: #737373; font-size: 14px; line-height: 1.55; }
    a { display: inline-flex; min-height: 36px; align-items: center; justify-content: center; border: 1px solid #d4d4d4; border-radius: 8px; padding: 0 14px; color: #171717; text-decoration: none; font-size: 14px; font-weight: 600; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(copy.title)}</h1>
    <p>${escapeHtml(copy.description)}</p>
    <a href="${safeReturnUrl}" target="_top" rel="noreferrer">Faturalamaya dön</a>
  </main>
  <script nonce="${safeNonce}">window.parent.postMessage(${serializedMessage}, ${serializedOrigin});</script>
</body>
</html>`
}
