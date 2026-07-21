import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { createKitchenLaunchTicket } from '@garsonless/db/server'
import { assertAccess } from '../../../../../lib/auth/access'

const paramsSchema = z.object({ restaurantId: z.string().uuid() })

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function readKitchenOrigin(): URL | null {
  try {
    const url = new URL(
      process.env['KITCHEN_URL']
        ?? process.env['NEXT_PUBLIC_KITCHEN_URL']
        ?? 'http://localhost:3002',
    )
    return url.protocol === 'https:' || (url.protocol === 'http:' && url.hostname === 'localhost')
      ? url
      : null
  } catch {
    return null
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ restaurantId: string }> },
) {
  const parsed = paramsSchema.safeParse(await params)
  if (!parsed.success) return new Response('Geçersiz restoran.', { status: 400 })
  const restaurantId = parsed.data.restaurantId

  const gate = await assertAccess(restaurantId, 'orders')
  if ('error' in gate) {
    return new Response(gate.error, { status: gate.error === 'Not authenticated' ? 401 : 403 })
  }

  const kitchenOrigin = readKitchenOrigin()
  if (!kitchenOrigin) return new Response('Mutfak uygulaması yapılandırılmamış.', { status: 503 })

  const launch = await createKitchenLaunchTicket(restaurantId)
  if (launch.kind === 'plan_required') {
    return new Response('Mutfak ekranı Pro paketiyle kullanılabilir.', { status: 403 })
  }
  if (launch.kind === 'credential_missing') {
    return new Response('Mutfak erişimi henüz oluşturulmamış.', { status: 409 })
  }
  if (launch.kind === 'unavailable') {
    return new Response('Mutfak erişimi şu anda doğrulanamadı.', { status: 503 })
  }
  const ticket = launch.ticket

  const action = new URL(`/kitchen/${restaurantId}/session`, kitchenOrigin).toString()
  const nonce = randomUUID().replaceAll('-', '')
  const html = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Mutfak açılıyor</title></head>
<body><main><p>Mutfak ekranı güvenli oturumla açılıyor…</p>
<form id="kitchen-launch" method="post" action="${escapeHtml(action)}">
<input type="hidden" name="ticket" value="${escapeHtml(ticket)}"><noscript><button type="submit">Devam et</button></noscript>
</form></main><script nonce="${nonce}">document.getElementById('kitchen-launch').submit()</script></body></html>`

  return new Response(html, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'Content-Security-Policy': `default-src 'none'; form-action ${kitchenOrigin.origin}; script-src 'nonce-${nonce}'; style-src 'none'; base-uri 'none'; frame-ancestors 'none'`,
      'Content-Type': 'text/html; charset=utf-8',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
