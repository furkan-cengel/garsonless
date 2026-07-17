import type { CustomerConsentPort, CustomerIdentityPort } from '@garsonless/application/customers'
import { err, ok, type EnsureCustomerResult } from '@garsonless/domain'
import { createServiceClient } from './client'
import { getConsentStatus, recordConsent } from './customers'
import { requestWelcomeBonus } from './outbox-consumer-port'

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
}): Promise<EnsureCustomerResult> {
  const supabase = createServiceClient()
  const emailPattern = input.email.replace(/[\\%_]/g, '\\$&')
  const verifiedAt = new Date().toISOString()
  const named = input.name ? { name: input.name } : {}

  const findLinked = async (): Promise<CustomerRow | null> => {
    const { data } = await supabase
      .from('customers')
      .select('id, auth_user_id, email, name')
      .eq('auth_user_id', input.authUserId)
      .maybeSingle()
    return data as CustomerRow | null
  }

  let customer = await findLinked()
  if (!customer) {
    const { data } = await supabase
      .from('customers')
      .select('id, auth_user_id, email, name')
      .ilike('email', emailPattern)
      .maybeSingle()
    customer = data as CustomerRow | null
  }

  if (customer?.auth_user_id && customer.auth_user_id !== input.authUserId) {
    return { ok: false, error: 'Bu e-posta başka bir müşteri hesabına bağlı.' }
  }

  if (customer) {
    const { data, error } = await supabase
      .from('customers')
      .update({ auth_user_id: input.authUserId, email: input.email, verified_at: verifiedAt, ...named })
      .eq('id', customer.id)
      .select('id, auth_user_id, email, name')
      .single()
    if (error || !data) return { ok: false, error: 'Müşteri hesabı bağlanamadı.' }
    customer = data as CustomerRow
  } else {
    const { data, error } = await supabase
      .from('customers')
      .upsert(
        { auth_user_id: input.authUserId, email: input.email, verified_at: verifiedAt, ...named },
        { onConflict: 'auth_user_id' },
      )
      .select('id, auth_user_id, email, name')
      .single()

    if (!error && data) {
      customer = data as CustomerRow
    } else {
      // Email OTP and OAuth may race on the normalized-email unique index.
      customer = await findLinked()
      if (!customer) {
        const { data: racedEmail } = await supabase
          .from('customers')
          .select('id, auth_user_id, email, name')
          .ilike('email', emailPattern)
          .maybeSingle()
        const raced = racedEmail as CustomerRow | null
        if (!raced || (raced.auth_user_id && raced.auth_user_id !== input.authUserId)) {
          return { ok: false, error: 'Müşteri hesabı oluşturulamadı.' }
        }
        const { data: linked, error: linkError } = await supabase
          .from('customers')
          .update({ auth_user_id: input.authUserId, email: input.email, verified_at: verifiedAt, ...named })
          .eq('id', raced.id)
          .select('id, auth_user_id, email, name')
          .single()
        if (linkError || !linked) return { ok: false, error: 'Müşteri hesabı bağlanamadı.' }
        customer = linked as CustomerRow
      }
    }
  }

  return { ok: true, customer: { id: customer.id, email: input.email, name: customer.name } }
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
