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

function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export function createCampaignApplicationPort(): CampaignApplicationPort {
  return {
    async list(input) {
      try {
        return ok(await listCampaigns(input.restaurantId, input.limit))
      } catch (error) {
        return err(message(error, 'Kampanyalar yüklenemedi'))
      }
    },
    async preview(input) {
      try {
        return ok(await previewCampaignAudience(input.restaurantId, input.audience))
      } catch (error) {
        return err(message(error, 'Alıcı sayısı hesaplanamadı'))
      }
    },
    async sendTest(input) {
      const result = await sendCampaignTest(input)
      return result.ok
        ? ok(result.messageId ? { messageId: result.messageId } : {})
        : err(result.error)
    },
    async send(input) {
      const queued = await sendCampaign(input)
      if (!queued.ok) return queued
      await dispatchAggregateDomainEvents({
        aggregateId: queued.campaign.id,
        eventTypes: ['campaign.delivery_requested'],
      })
      try {
        const refreshed = await getCampaignById(input.restaurantId, queued.campaign.id)
        return refreshed ? { ...queued, campaign: refreshed } : queued
      } catch {
        return queued
      }
    },
  }
}
