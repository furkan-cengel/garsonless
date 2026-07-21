import 'server-only'

import webpush from 'web-push'
import type { DashboardPushProvider } from '@garsonless/application/push-notifications'

let configuredFingerprint: string | null = null

function required(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function configureVapid() {
  const subject = required('WEB_PUSH_SUBJECT')
  const publicKey = required('NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY')
  const privateKey = required('WEB_PUSH_VAPID_PRIVATE_KEY')
  const fingerprint = `${subject}:${publicKey}:${privateKey.slice(-8)}`
  if (configuredFingerprint === fingerprint) return
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configuredFingerprint = fingerprint
}

function providerError(cause: unknown) {
  if (cause && typeof cause === 'object') {
    const statusCode = 'statusCode' in cause && typeof cause.statusCode === 'number'
      ? cause.statusCode
      : null
    const message = 'message' in cause && typeof cause.message === 'string'
      ? cause.message
      : 'Web Push provider failed'
    return { statusCode, message: message.slice(0, 500) }
  }
  return { statusCode: null, message: 'Web Push provider failed' }
}

export function createWebPushProvider(): DashboardPushProvider {
  configureVapid()
  return {
    async send(input) {
      try {
        await webpush.sendNotification(
          {
            endpoint: input.subscription.endpoint,
            keys: { p256dh: input.subscription.p256dh, auth: input.subscription.auth },
          },
          JSON.stringify(input.payload),
          { TTL: 300, urgency: 'high', topic: input.topic, timeout: 5_000 },
        )
        return { outcome: 'sent' }
      } catch (cause) {
        const failure = providerError(cause)
        if (failure.statusCode === 404 || failure.statusCode === 410) {
          return { outcome: 'gone', error: `Provider ${failure.statusCode}: ${failure.message}` }
        }
        return {
          outcome: 'failed',
          error: `${failure.statusCode ? `Provider ${failure.statusCode}: ` : ''}${failure.message}`,
        }
      }
    },
  }
}
