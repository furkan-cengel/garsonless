import type { CustomerApplicationPort } from '@garsonless/application/customers'
import { err, ok } from '@garsonless/domain'
import {
  addCustomerNote,
  createCustomerSegment,
  deductCustomerPoints,
  deleteCustomerNote,
  deleteCustomerSegment,
  getCustomerSegment,
  getRestaurantCustomerDetail,
  getRestaurantCustomerTimeline,
  getRestaurantCustomerSegmentCounts,
  getRestaurantCustomers,
  grantStoreCredit,
  listCustomerNotes,
  listCustomerRewardRules,
  listOpenCustomerFeedback,
  markCustomerFeedbackHandled,
  readCustomerReviewSettings,
  saveCustomerReviewSettings,
  previewCustomerRewardRule,
  saveCustomerRewardRule,
  setCustomerBirthday,
  listCustomerSegments,
  revealCustomerContact,
  updateCustomerSegment,
  type CustomerLoyaltyScope,
} from './customers'

function failure(prefix: string, error: unknown): string {
  return error instanceof Error && error.message ? `${prefix}: ${error.message}` : prefix
}

export function createCustomerApplicationPort(configuration: { loyaltyScope?: CustomerLoyaltyScope } = {}): CustomerApplicationPort {
  return {
    async listCustomers({ restaurantId, includeContactData, ...listOptions }) {
      try {
        return ok(await getRestaurantCustomers(restaurantId, listOptions, {
          includeContactData,
          ...(Object.hasOwn(configuration, 'loyaltyScope') ? { loyaltyScope: configuration.loyaltyScope } : {}),
        }))
      } catch (error) {
        return err(failure('Müşteriler yüklenemedi', error))
      }
    },
    async countSegments({ restaurantId }) {
      try {
        return ok(await getRestaurantCustomerSegmentCounts(restaurantId, configuration))
      } catch (error) {
        return err(failure('Segment sayıları yüklenemedi', error))
      }
    },
    async listSegments({ restaurantId }) {
      try {
        return ok(await listCustomerSegments(restaurantId))
      } catch (error) {
        return err(failure('Segmentler yüklenemedi', error))
      }
    },
    async getSegment({ restaurantId, segmentId }) {
      try {
        return ok(await getCustomerSegment(restaurantId, segmentId))
      } catch (error) {
        return err(failure('Segment yüklenemedi', error))
      }
    },
    async createSegment(input) {
      try {
        return ok(await createCustomerSegment(input))
      } catch (error) {
        return err(failure('Segment kaydedilemedi', error))
      }
    },
    async updateSegment(input) {
      try {
        return ok(await updateCustomerSegment(input))
      } catch (error) {
        return err(failure('Segment güncellenemedi', error))
      }
    },
    async deleteSegment({ restaurantId, segmentId }) {
      try {
        return ok(await deleteCustomerSegment(restaurantId, segmentId))
      } catch (error) {
        return err(failure('Segment silinemedi', error))
      }
    },
    async readDetail({ restaurantId, customerId, includeContactData }) {
      try {
        return ok(await getRestaurantCustomerDetail(restaurantId, customerId, { includeContactData }))
      } catch (error) {
        return err(failure('Müşteri detayı yüklenemedi', error))
      }
    },
    async readTimeline({ restaurantId, customerId, cursor }) {
      try {
        return ok(await getRestaurantCustomerTimeline(restaurantId, customerId, cursor))
      } catch (error) {
        return err(failure('Müşteri hareketleri yüklenemedi', error))
      }
    },
    async grantStoreCredit(input) {
      try {
        const result = await grantStoreCredit(input)
        return result.ok ? ok({ granted: result.granted, replayed: result.replayed }) : err(result.error)
      } catch (error) {
        return err(failure('Puan tanımlanamadı', error))
      }
    },
    async deductPoints(input) {
      try {
        const result = await deductCustomerPoints(input)
        return result.ok ? ok({ deducted: result.deducted, replayed: result.replayed }) : err(result.error)
      } catch (error) {
        return err(failure('Puan düşülemedi', error))
      }
    },
    async listNotes({ restaurantId, customerId }) {
      try {
        return ok(await listCustomerNotes(restaurantId, customerId))
      } catch (error) {
        return err(failure('Notlar yüklenemedi', error))
      }
    },
    async addNote(input) {
      try {
        const result = await addCustomerNote(input)
        return result.ok ? ok(result.note) : err(result.error)
      } catch (error) {
        return err(failure('Not kaydedilemedi', error))
      }
    },
    async deleteNote(input) {
      try {
        return ok(await deleteCustomerNote(input))
      } catch (error) {
        return err(failure('Not silinemedi', error))
      }
    },
    async setBirthday(input) {
      try {
        return ok(await setCustomerBirthday(input))
      } catch (error) {
        return err(failure('Doğum günü kaydedilemedi', error))
      }
    },
    async listRewardRules({ restaurantId }) {
      try {
        return ok(await listCustomerRewardRules(restaurantId))
      } catch (error) {
        return err(failure('Ödül kuralları yüklenemedi', error))
      }
    },
    async saveRewardRule(input) {
      try {
        const result = await saveCustomerRewardRule(input)
        return result.ok ? ok(result.rule) : err(result.error)
      } catch (error) {
        return err(failure('Kural kaydedilemedi', error))
      }
    },
    async previewRewardRule({ restaurantId, kind, params }) {
      try {
        return ok(await previewCustomerRewardRule(restaurantId, kind, params))
      } catch (error) {
        return err(failure('Önizleme yüklenemedi', error))
      }
    },
    async readReviewSettings({ restaurantId }) {
      try {
        return ok(await readCustomerReviewSettings(restaurantId))
      } catch (error) {
        return err(failure('Yorum ayarları yüklenemedi', error))
      }
    },
    async saveReviewSettings(input) {
      try {
        return ok(await saveCustomerReviewSettings(input))
      } catch (error) {
        return err(failure('Yorum ayarları kaydedilemedi', error))
      }
    },
    async listOpenFeedback({ restaurantId, limit }) {
      try {
        return ok(await listOpenCustomerFeedback(restaurantId, limit))
      } catch (error) {
        return err(failure('Geri bildirimler yüklenemedi', error))
      }
    },
    async markFeedbackHandled(input) {
      try {
        return ok(await markCustomerFeedbackHandled(input))
      } catch (error) {
        return err(failure('Geri bildirim güncellenemedi', error))
      }
    },
    async revealContact(input) {
      try {
        return ok(await revealCustomerContact(input))
      } catch (error) {
        return err(failure('İletişim bilgisi gösterilemedi', error))
      }
    },
  }
}
