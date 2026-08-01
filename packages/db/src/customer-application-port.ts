import type { CustomerApplicationPort } from '@garsonless/application/customers'
import { err, ok } from '@garsonless/domain'
import {
  createCustomerSegment,
  deleteCustomerSegment,
  getCustomerSegment,
  getRestaurantCustomerDetail,
  getRestaurantCustomerTimeline,
  getRestaurantCustomerSegmentCounts,
  getRestaurantCustomers,
  grantStoreCredit,
  listCustomerSegments,
  updateCustomerSegment,
} from './customers'

function failure(prefix: string, error: unknown): string {
  return error instanceof Error && error.message ? `${prefix}: ${error.message}` : prefix
}

export function createCustomerApplicationPort(): CustomerApplicationPort {
  return {
    async listCustomers({ restaurantId, includeContactData, ...options }) {
      try {
        return ok(await getRestaurantCustomers(restaurantId, options, { includeContactData }))
      } catch (error) {
        return err(failure('Müşteriler yüklenemedi', error))
      }
    },
    async countSegments({ restaurantId }) {
      try {
        return ok(await getRestaurantCustomerSegmentCounts(restaurantId))
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
  }
}
