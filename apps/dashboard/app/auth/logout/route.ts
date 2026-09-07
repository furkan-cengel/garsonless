import { NextResponse, type NextRequest } from 'next/server'
import { signOut } from '../../../lib/actions/auth'
import { allowedAuthOrigin } from '../../../lib/auth/action-origin'

const failure = 'Çıkış yapılamadı. Bağlantını kontrol edip tekrar dene.'

// Cookie mutations in a Server Action re-render the protected page before its
// client can navigate away. A JSON route ends the session without returning RSC.
export async function POST(request: NextRequest) {
  const reply = (body: object, status = 200) => NextResponse.json(body, {
    status, headers: { 'Cache-Control': 'private, no-store' },
  })
  if (!allowedAuthOrigin(
    request.headers.get('origin'), process.env['NEXT_PUBLIC_APP_URL'],
    process.env['NODE_ENV'] === 'production',
  )) return reply({ error: 'Bu çıkış isteği doğrulanamadı. Sayfayı yenileyip tekrar dene.' }, 403)

  let body: unknown
  try { body = await request.json() } catch { return reply({ error: failure }, 400) }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return reply({ error: failure }, 400)
  try {
    const result = await signOut('endpoint' in body ? body.endpoint : null)
    return reply(result, 'error' in result ? 503 : 200)
  } catch {
    return reply({ error: failure }, 503)
  }
}
