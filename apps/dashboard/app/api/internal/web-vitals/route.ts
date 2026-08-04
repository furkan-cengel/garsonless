import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDashboardAuthenticatedUser } from '../../../../lib/auth/current-user'

const payloadSchema = z.object({
  schemaVersion: z.literal(1),
  name: z.enum(['LCP', 'INP', 'CLS', 'TTFB']),
  value: z.number().finite().nonnegative().max(3_600_000),
  delta: z.number().finite().min(-3_600_000).max(3_600_000),
  rating: z.enum(['good', 'needs-improvement', 'poor']),
  navigationType: z.enum(['navigate', 'reload', 'back-forward', 'back-forward-cache', 'prerender', 'restore']),
  routeFamily: z.enum([
    'dashboard/home',
    'dashboard/analytics',
    'dashboard/customers',
    'dashboard/menu',
    'dashboard/onboarding',
    'dashboard/orders',
    'dashboard/pano',
    'dashboard/settings',
    'dashboard/tables',
    'dashboard/theme',
    'dashboard/other',
  ]),
}).strict()

export async function POST(request: Request) {
  const user = await getDashboardAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (contentLength > 2_048) return NextResponse.json({ error: 'Payload too large' }, { status: 413 })

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid metric' }, { status: 400 })

  console.info('[dashboard-web-vital]', parsed.data)
  return new NextResponse(null, { status: 202 })
}
