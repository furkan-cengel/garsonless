import type { PaymentCallbackMessage } from './payment-callback-message'

const CALLBACK_NONCE = /^[A-Za-z0-9_-]{16,128}$/

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function assertCallbackNonce(nonce: string): void {
  if (!CALLBACK_NONCE.test(nonce)) throw new Error('Invalid payment callback nonce')
}

function exactWebOrigin(parentOrigin: URL): string {
  if (!['http:', 'https:'].includes(parentOrigin.protocol)
    || parentOrigin.username
    || parentOrigin.password) {
    throw new Error('Invalid payment callback parent origin')
  }
  return parentOrigin.origin
}

export function paymentCallbackCsp(nonce: string): string {
  assertCallbackNonce(nonce)
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

export function paymentCallbackSecurityHeaders(nonce: string): Record<string, string> {
  return {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': paymentCallbackCsp(nonce),
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
  }
}

export function createPaymentCallbackDocument(input: {
  message: PaymentCallbackMessage
  nonce: string
  parentOrigin: URL
  text: string
}): string {
  assertCallbackNonce(input.nonce)
  const parentOrigin = exactWebOrigin(input.parentOrigin)
  const payload = JSON.stringify(input.message).replaceAll('<', '\\u003c')
  const serializedOrigin = JSON.stringify(parentOrigin).replaceAll('<', '\\u003c')
  const safeNonce = escapeHtml(input.nonce)

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ödeme sonucu</title>
  <style nonce="${safeNonce}">
    html, body { min-height: 100%; margin: 0; background: #fff; color: #444; font-family: system-ui, sans-serif; }
    body { display: flex; align-items: center; justify-content: center; box-sizing: border-box; padding: 0 16px; font-size: 14px; text-align: center; }
  </style>
</head>
<body>
  <p>${escapeHtml(input.text)}</p>
  <script nonce="${safeNonce}">try{window.parent.postMessage(${payload},${serializedOrigin})}catch{}</script>
</body>
</html>`
}
