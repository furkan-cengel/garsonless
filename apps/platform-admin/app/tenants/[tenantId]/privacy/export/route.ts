import { randomUUID } from 'node:crypto'
import { exportPlatformTenantPrivacyData } from '@garsonless/application/platform-admin-privacy'
import { createPlatformAdminPrivacyPort } from '@garsonless/db/server'
import { requirePlatformAdminActor } from '../../../../../lib/platform-admin-auth'

export async function POST(request: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const actor = await requirePlatformAdminActor()
  const { tenantId } = await params
  const form = await request.formData()
  const result = await exportPlatformTenantPrivacyData(actor, { restaurantId: tenantId, reason: String(form.get('reason') ?? ''), requestId: randomUUID() }, createPlatformAdminPrivacyPort())
  if (!result.ok) return Response.json({ error: result.error }, { status: result.error === 'Not authorized' ? 403 : 400 })
  const slug = result.value.document.tenant.slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || 'tenant'
  return new Response(JSON.stringify(result.value.document, null, 2), { headers: { 'Cache-Control': 'no-store, private', 'Content-Disposition': `attachment; filename="${slug}-kvkk-export.json"`, 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff' } })
}
