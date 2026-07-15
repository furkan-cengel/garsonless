import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRequest, SERVICE_REQUEST_TYPES } from '@garsonless/db'
import { resolveActiveTableQrToken } from '@garsonless/db/server'

const schema = z.object({
  tableToken: z.string().uuid(),
  requestType: z.enum(SERVICE_REQUEST_TYPES),
})

type ApiResponse = { ok: true; throttled: boolean } | { ok: false; error: string }

export async function POST(req: Request): Promise<NextResponse<ApiResponse>> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 },
    )
  }

  const table = await resolveActiveTableQrToken(parsed.data.tableToken)
  if (!table) return NextResponse.json({ ok: false, error: 'Masa bağlantısı geçersiz veya yenilenmiş.' }, { status: 404 })
  const result = await createServiceRequest({
    restaurantId: table.restaurantId,
    tableId: table.tableId,
    requestType: parsed.data.requestType,
  })

  if (!result.ok) {
    const status = result.error === 'Table not found for this restaurant' ? 400 : 500
    return NextResponse.json(result, { status })
  }
  return NextResponse.json(result)
}
