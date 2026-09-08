import { brandEmailSender, renderStandRequestEmail } from '@garsonless/domain/email-messages'
import { Resend } from 'resend'
import { err, ok, type Result } from '@garsonless/domain'
import type {
  StandRequestNotificationPort,
} from '@garsonless/application/restaurants'

export function createStandRequestNotificationPort(): StandRequestNotificationPort {
  return {
    async send(input): Promise<Result<null>> {
      const apiKey = process.env['RESEND_API_KEY']
      const toEmail = process.env['RESEND_STANDS_TO_EMAIL']
      const fromEmail = brandEmailSender(process.env['RESEND_FROM_EMAIL'])
      if (!apiKey || !toEmail || !fromEmail) return err('Email service not configured')

      try {
        const { error } = await new Resend(apiKey).emails.send({
          from: fromEmail,
          to: toEmail,
          ...renderStandRequestEmail(input),
        })
        return error ? err(error.message) : ok(null)
      } catch (error) {
        return err(error instanceof Error ? error.message : 'Email delivery failed')
      }
    },
  }
}
