import { Resend } from 'resend'
import type {
  NotificationEmailProvider,
} from '@garsonless/application/notification-emails'

/**
 * Resend adapter for the notification e-mail channel. Missing configuration
 * surfaces as a failed provider outcome: the delivery row records the reason,
 * retries back off through the outbox and eventually dead-letter — core event
 * processing is never blocked by an unconfigured mail provider.
 */
export function createNotificationEmailProvider(): NotificationEmailProvider {
  return {
    async send(input) {
      const apiKey = process.env['RESEND_API_KEY']
      const fromEmail = process.env['RESEND_FROM_EMAIL']
      if (!apiKey || !fromEmail) {
        return { outcome: 'failed', error: 'Email provider not configured' }
      }
      try {
        const { data, error } = await new Resend(apiKey).emails.send({
          from: fromEmail,
          to: input.to,
          subject: input.subject,
          html: input.html,
        })
        if (error) return { outcome: 'failed', error: error.message }
        return { outcome: 'sent', messageId: data?.id ?? null }
      } catch (error) {
        return {
          outcome: 'failed',
          error: error instanceof Error ? error.message : 'Email delivery failed',
        }
      }
    },
  }
}
