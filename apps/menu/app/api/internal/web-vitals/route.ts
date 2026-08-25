import { NextResponse } from 'next/server'
import { z } from 'zod'

const payloadSchema = z.object({
  schemaVersion: z.literal(1),
  name: z.enum(['LCP', 'INP', 'CLS', 'TTFB']),
  value: z.number().finite().nonnegative().max(3_600_000),
  delta: z.number().finite().min(-3_600_000).max(3_600_000),
  rating: z.enum(['good', 'needs-improvement', 'poor']),
  navigationType: z.enum(['navigate', 'reload', 'back-forward', 'back-forward-cache', 'prerender', 'restore']),
  routeFamily: z.enum(['menu/home', 'menu/catalog', 'menu/table', 'menu/system']),
}).strict()

export async function POST(request: Request) {
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') {
    return NextResponse.json({ error: 'Unsupported media type' }, { status: 415 })
  }
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const length = Number(request.headers.get('content-length') ?? '0')
  if (!Number.isSafeInteger(length) || length <= 0 || length > 2_048) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }
  const parsed = payloadSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid metric' }, { status: 400 })
  console.info('[menu-web-vital]', parsed.data)
  return new NextResponse(null, { status: 202 })
}
