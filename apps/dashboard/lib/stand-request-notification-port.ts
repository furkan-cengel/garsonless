import { Resend } from 'resend'
import { err, ok, type Result } from '@garsonless/domain'
import type {
  StandRequestNotificationPort,
  StandType,
} from '@garsonless/application/restaurants'

const STAND_LABELS: Record<StandType, string> = {
  basic: 'Basic Stand (Acrylic)',
  premium: 'Premium Stand (Metal)',
  custom: 'Custom Branded Stand',
}

export function createStandRequestNotificationPort(): StandRequestNotificationPort {
  return {
    async send(input): Promise<Result<null>> {
      const apiKey = process.env['RESEND_API_KEY']
      const toEmail = process.env['RESEND_STANDS_TO_EMAIL']
      const fromEmail = process.env['RESEND_FROM_EMAIL']?.replace(/^masabu(?=\s*<)/i, 'masabu')
      if (!apiKey || !toEmail || !fromEmail) return err('Email service not configured')

      try {
        const { error } = await new Resend(apiKey).emails.send({
          from: fromEmail,
          to: toEmail,
          subject: `QR Stand Request: ${input.restaurantName}`,
          html: `
            <h2>New QR Stand Request</h2>
            <table style="border-collapse:collapse">
              <tr><td style="padding:4px 12px 4px 0;font-weight:600">Restaurant</td><td>${escapeHtml(input.restaurantName)}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;font-weight:600">Contact</td><td>${escapeHtml(input.contactName)}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;font-weight:600">Email</td><td>${escapeHtml(input.email)}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;font-weight:600">Phone</td><td>${escapeHtml(input.phone)}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;font-weight:600">Table count</td><td>${input.tableCount}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;font-weight:600">Stand type</td><td>${STAND_LABELS[input.standType]}</td></tr>
              ${input.notes ? `<tr><td style="padding:4px 12px 4px 0;font-weight:600">Notes</td><td>${escapeHtml(input.notes)}</td></tr>` : ''}
            </table>
          `,
        })
        return error ? err(error.message) : ok(null)
      } catch (error) {
        return err(error instanceof Error ? error.message : 'Email delivery failed')
      }
    },
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[char]!)
}
