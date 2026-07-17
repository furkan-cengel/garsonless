import type { LoyaltyQueryPort } from '@garsonless/application/loyalty'
import { computeOrderDiscount, getMemberBalances, type DiscountResult } from './loyalty'

export function createLoyaltyQueryPort(): LoyaltyQueryPort<DiscountResult> {
  return {
    readMemberBalances({ customerId, restaurantId }) {
      return getMemberBalances(customerId, restaurantId)
    },
    previewDiscount(input) {
      return computeOrderDiscount(input)
    },
  }
}
