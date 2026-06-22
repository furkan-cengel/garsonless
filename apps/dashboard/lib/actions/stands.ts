'use server'

import { z } from 'zod'
import { Resend } from 'resend'

const requestStandsSchema = z.object({
  restaurantName: z.string().min(1).max(100),
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
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | { success: true }> {
  const parsed = requestStandsSchema.safeParse({
    restaurantName: formData.get('restaurantName'),
    contactName: formData.get('contactName'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    tableCount: formData.get('tableCount'),
    standType: formData.get('standType'),
    notes: formData.get('notes'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const apiKey = process.env['RESEND_API_KEY']
  const toEmail = process.env['RESEND_STANDS_TO_EMAIL']
  const fromEmail = process.env['RESEND_FROM_EMAIL']

  if (!apiKey || !toEmail || !fromEmail) return { error: 'Email service not configured' }

  const resend = new Resend(apiKey)
  const { restaurantName, contactName, email, phone, tableCount, standType, notes } = parsed.data

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: `QR Stand Request: ${restaurantName}`,
    html: `
      <h2>New QR Stand Request</h2>
      <table style="border-collapse:collapse">
        <tr><td style="padding:4px 12px 4px 0;font-weight:600">Restaurant</td><td>${restaurantName}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:600">Contact</td><td>${contactName}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:600">Email</td><td>${email}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:600">Phone</td><td>${phone}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:600">Table count</td><td>${tableCount}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:600">Stand type</td><td>${STAND_LABELS[standType]}</td></tr>
        ${notes ? `<tr><td style="padding:4px 12px 4px 0;font-weight:600">Notes</td><td>${notes}</td></tr>` : ''}
      </table>
    `,
  })

  if (error) return { error: error.message }
  return { success: true }
}
