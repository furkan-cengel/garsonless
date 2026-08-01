import type { CustomerConsentPort, CustomerIdentityPort } from '@garsonless/application/customers'
import { err, ok, type EnsureCustomerResult } from '@garsonless/domain'
import { createServiceClient } from './client'
import { getConsentStatus, recordConsent } from './customers'
import { requestWelcomeBonus } from './outbox-consumer-port'
import { normalizePhone } from './phone'

type CustomerRow = {
  id: string
  auth_user_id: string | null
  email: string | null
  name: string | null
}

async function upsertCustomerIdentity(input: {
  authUserId: string
  email: string
  name: string | null
  verifiedPhone: string | null
}): Promise<EnsureCustomerResult> {
  const supabase = createServiceClient()
  const verifiedPhone = normalizePhone(input.verifiedPhone)
  const { data, error } = await supabase.rpc('claim_customer_identity_atomic', {
    p_auth_user_id: input.authUserId,
    p_email: input.email,
    p_name: input.name ?? '',
    ...(verifiedPhone ? { p_verified_phone: verifiedPhone } : {}),
  })
  const customer = data?.[0] as Pick<CustomerRow, 'id' | 'email' | 'name'> | undefined
  if (error || !customer) {
    if (error?.code === 'GL002') {
      return { ok: false, error: 'Bu kimliklerin sadakat geçmişi otomatik birleştirilemedi.' }
    }
    if (error?.code === '23505' || error?.code === '42501') {
      return { ok: false, error: 'Bu doğrulanmış kimlik başka bir müşteri hesabına bağlı.' }
    }
    return { ok: false, error: 'Müşteri hesabı bağlanamadı.' }
  }
  return { ok: true, customer: { id: customer.id, email: customer.email ?? input.email, name: customer.name } }
}

export function createCustomerIdentityApplicationPort(): CustomerIdentityPort {
  return {
    upsertIdentity: upsertCustomerIdentity,
    async stampCustomerRole(input) {
      const { error } = await createServiceClient().auth.admin.updateUserById(input.authUserId, {
        app_metadata: { ...input.appMetadata, user_type: 'customer' },
      })
      return error ? err(error.message) : ok(null)
    },
    async associateRestaurant(input) {
      const { error } = await createServiceClient()
        .from('customer_restaurants')
        .upsert(
          { customer_id: input.customerId, restaurant_id: input.restaurantId, source: 'auth' },
          { onConflict: 'customer_id,restaurant_id', ignoreDuplicates: true },
        )
      return error ? err(error.message) : ok(null)
    },
    async creditWelcomeBonus(input) {
      await requestWelcomeBonus(input)
    },
    async recordConsent(input) {
      const result = await recordConsent(input.customerId, input.restaurantId, input.grant, input.source, input.consentType)
      return result.ok ? ok(null) : err('İzin güncellenemedi.')
    },
  }
}

export function createCustomerConsentApplicationPort(): CustomerConsentPort {
  return {
    async recordConsent(input) {
      const result = await recordConsent(input.customerId, input.restaurantId, input.grant, input.source, input.consentType)
      return result.ok ? ok(null) : err('İzin güncellenemedi.')
    },
    async readSnapshot(input) {
      const [consentGiven, marketingConsentGiven] = await Promise.all([
        getConsentStatus(input.customerId, input.restaurantId),
        getConsentStatus(input.customerId, input.restaurantId, 'marketing'),
      ])
      return ok({ consentGiven, marketingConsentGiven })
    },
  }
}
