import { NextResponse } from 'next/server'
import { z } from 'zod'
import { cancelUnstartedSplitShare } from '@garsonless/application/splits'
import { resolvePublicTableContext } from '@garsonless/application/tables'
import { createPublicTableQueryPort, createSplitPaymentPort } from '@garsonless/db/server'

const schema = z.object({
  shareId: z.string().uuid(),
  tableToken: z.string().uuid(),
})

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Geçersiz istek.' }, { status: 400 })

  const tableResult = await resolvePublicTableContext(parsed.data.tableToken, createPublicTableQueryPort())
  if (!tableResult.ok) return NextResponse.json({ success: false, error: 'Masa bağlantısı doğrulanamadı.' }, { status: 503 })
  const table = tableResult.value
  if (!table) return NextResponse.json({ success: false, error: 'Masa bağlantısı geçersiz veya yenilenmiş.' }, { status: 404 })

  const result = await cancelUnstartedSplitShare(
    { actor: 'table-guest', restaurantId: table.restaurantId, tableId: table.tableId, tableToken: parsed.data.tableToken },
    { restaurantId: table.restaurantId, shareId: parsed.data.shareId },
    createSplitPaymentPort(),
  )
  if (!result.ok) return NextResponse.json({ success: false, error: 'Kart payı bırakılamadı.' }, { status: 503 })
  if (result.value === 'provider_pending') {
    return NextResponse.json({ success: false, error: 'Ödeme sağlayıcıda işleme alınmış; sonucu bekleyin.' }, { status: 409 })
  }
  return NextResponse.json({ success: true, data: { outcome: result.value } })
}
