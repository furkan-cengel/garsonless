import type { CustomerConsentPort, CustomerIdentityPort } from '@garsonless/application/customers'
import { err, ok, type EnsureCustomerResult } from '@garsonless/domain'
import { createServiceClient } from './service-client'
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
  verifiedEmail: string | null
  name: string | null
  verifiedPhone: string | null
}): Promise<EnsureCustomerResult> {
  const supabase = createServiceClient()
  const verifiedPhone = normalizePhone(input.verifiedPhone)
  const identityArgs = {
    p_auth_user_id: input.authUserId,
    // The SQL RPC accepts null for absent verified identities; generated
    // function types cannot infer nullable PostgreSQL parameters.
    p_email: input.verifiedEmail,
    p_name: input.name ?? '',
    p_verified_phone: verifiedPhone,
  } as unknown as {
    p_auth_user_id: string
    p_email?: string
    p_name?: string
    p_verified_phone?: string
  }
  const { data, error } = await supabase.rpc(
    'claim_customer_identity_atomic_v2',
    identityArgs,
  )
  const customer = data?.[0] as Pick<CustomerRow, 'id' | 'email' | 'name'> | undefined
  if (error || !customer) {
    if (error?.code === 'GL002') {
      return {
        ok: false,
        error: 'Bu kimliklerin sadakat geçmişi otomatik birleştirilemedi.',
        code: 'IDENTITY_CONFLICT',
      }
    }
    if (error?.code === 'GL003') {
      return {
        ok: false,
        error: 'Personel veya platform hesabı müşteri hesabı olarak kullanılamaz.',
        code: 'STAFF_ACCOUNT_REJECTED',
      }
    }
    if (error?.code === '23505' || error?.code === '42501') {
      return {
        ok: false,
        error: 'Bu doğrulanmış kimlik başka bir müşteri hesabına bağlı.',
        code: 'IDENTITY_CONFLICT',
      }
    }
    return { ok: false, error: 'Müşteri hesabı bağlanamadı.', code: 'SERVICE_UNAVAILABLE' }
  }
  return { ok: true, customer: { id: customer.id, email: customer.email ?? input.verifiedEmail, name: customer.name } }
}

export function createCustomerIdentityApplicationPort(): CustomerIdentityPort {
  return {
    upsertIdentity: upsertCustomerIdentity,
    async stampCustomerRole(input) {
      if (input.appMetadata['user_type'] === 'staff') {
        return err('Personel hesabı müşteri olarak damgalanamaz.')
      }
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
