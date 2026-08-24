import type { CampaignApplicationPort } from '@garsonless/application/campaigns'
import { err, ok } from '@garsonless/domain'
import {
  getCampaignById,
  listCampaigns,
  previewCampaignAudience,
  sendCampaign,
  sendCampaignTest,
} from './campaigns'
import { dispatchAggregateDomainEvents } from './outbox-consumer-port'

export function createCampaignApplicationPort(): CampaignApplicationPort {
  return {
    async list(input) {
      try {
        return ok(await listCampaigns(input.restaurantId, input.limit))
      } catch {
        return err('Kampanyalar yüklenemedi')
      }
    },
    async preview(input) {
      try {
        return ok(await previewCampaignAudience(input.restaurantId, input.channel, input.audience))
      } catch {
        return err('Alıcı sayısı hesaplanamadı')
      }
    },
    async sendTest(input) {
      try {
        const result = await sendCampaignTest(input)
        return result.ok
          ? ok(result.messageId ? { messageId: result.messageId } : {})
          : err(result.error)
      } catch {
        return err('Test SMS sonucu doğrulanamadı')
      }
    },
    async send(input) {
      try {
        const queued = await sendCampaign(input)
        if (!queued.ok) return queued
        try {
          await dispatchAggregateDomainEvents({
            aggregateId: queued.campaign.id,
            eventTypes: ['campaign.delivery_requested'],
          })
        } catch {
          return { ok: false, error: 'Kampanya kuyruğa alındı; teslimat durumu doğrulanamadı', preview: queued.preview }
        }
        try {
          const refreshed = await getCampaignById(input.restaurantId, queued.campaign.id)
          return refreshed ? { ...queued, campaign: refreshed } : queued
        } catch {
          return queued
        }
      } catch {
        return { ok: false, error: 'Kampanya kuyruğa alınamadı' }
      }
    },
  }
}
