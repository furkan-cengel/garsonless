'use server'

import { z } from 'zod'
import { Resend } from 'resend'
import { createServiceClient } from '@garsonless/db'
import { assertAccess } from '../auth/access'

const requestStandsSchema = z.object({
  contactName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().min(7).max(20),
  tableCount: z.coerce.number().int().min(1).max(500),
  standType: z.enum(['basic', 'premium', 'custom']),
  notes: z.string().max(500).optional(),
})

export type StandType = 'basic' | 'premium' | 'custom'

const STAND_LABELS: Record<StandType, string> = {
  basic: 'Basic Stand (Acrylic)',
  premium: 'Premium Stand (Metal)',
  custom: 'Custom Branded Stand',
}

export async function requestStands(
  restaurantId: string,
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | { success: true }> {
  const restaurantIdResult = z.string().uuid().safeParse(restaurantId)
  if (!restaurantIdResult.success) return { error: 'Invalid restaurant' }

  const gate = await assertAccess(restaurantIdResult.data, 'tables')
  if ('error' in gate) return { error: gate.error }

  const parsed = requestStandsSchema.safeParse({
    contactName: formData.get('contactName'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    tableCount: formData.get('tableCount'),
    standType: formData.get('standType'),
    notes: formData.get('notes'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const service = createServiceClient()
  const { data: restaurant } = await service
    .from('restaurants')
    .select('name')
    .eq('id', restaurantIdResult.data)
    .is('deleted_at', null)
    .maybeSingle()
  if (!restaurant) return { error: 'Restaurant not found' }

  const { data: claimedAt, error: claimError } = await service.rpc('claim_qr_stand_request_slot', {
    p_restaurant_id: restaurantIdResult.data,
    p_requested_by: gate.userId,
    p_window_seconds: 600,
  })
  if (claimError) return { error: 'Talep sınırı kontrol edilemedi.' }
  if (!claimedAt) return { error: 'Yeni bir talep göndermek için 10 dakika bekleyin.' }

  const apiKey = process.env['RESEND_API_KEY']
  const toEmail = process.env['RESEND_STANDS_TO_EMAIL']
  const fromEmail = process.env['RESEND_FROM_EMAIL']

  if (!apiKey || !toEmail || !fromEmail) {
    await releaseClaim(service, restaurantIdResult.data, gate.userId, claimedAt)
    return { error: 'Email service not configured' }
  }

  const resend = new Resend(apiKey)
  const restaurantName = restaurant.name
  const { contactName, email, phone, tableCount, standType, notes } = parsed.data

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: `QR Stand Request: ${restaurantName}`,
    html: `
      <h2>New QR Stand Request</h2>
      <table style="border-collapse:collapse">
        <tr><td style="padding:4px 12px 4px 0;font-weight:600">Restaurant</td><td>${escapeHtml(restaurantName)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:600">Contact</td><td>${escapeHtml(contactName)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:600">Email</td><td>${escapeHtml(email)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:600">Phone</td><td>${escapeHtml(phone)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:600">Table count</td><td>${tableCount}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:600">Stand type</td><td>${STAND_LABELS[standType]}</td></tr>
        ${notes ? `<tr><td style="padding:4px 12px 4px 0;font-weight:600">Notes</td><td>${escapeHtml(notes)}</td></tr>` : ''}
      </table>
    `,
  })

  if (error) {
    await releaseClaim(service, restaurantIdResult.data, gate.userId, claimedAt)
    return { error: error.message }
  }
  return { success: true }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[char]!)
}

async function releaseClaim(
  service: ReturnType<typeof createServiceClient>,
  restaurantId: string,
  userId: string,
  claimedAt: string,
): Promise<void> {
  await service
    .from('qr_stand_request_limits')
    .delete()
    .eq('restaurant_id', restaurantId)
    .eq('requested_by', userId)
    .eq('last_requested_at', claimedAt)
}
