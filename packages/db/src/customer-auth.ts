import type { User } from '@supabase/supabase-js'
import { createServiceClient } from './client'
import { recordConsent } from './customers'
import { creditWelcomeBonus } from './loyalty'

export interface EnsureCustomerOptions {
  name?: string | null
  restaurantId?: string
  consent?: boolean
  marketingConsent?: boolean
}

export type EnsureCustomerResult =
  | { ok: true; customer: { id: string; email: string; name: string | null } }
  | { ok: false; error: string }

/**
 * Link a Supabase Auth identity to the service-role-only customer domain row.
 * Auth id is the primary idempotency key; normalized email joins Email OTP and
 * OAuth identities to the same customer row.
 */
export async function ensureCustomerForAuthUser(
  authUser: User,
  opts: EnsureCustomerOptions = {},
): Promise<EnsureCustomerResult> {
  const email = authUser.email?.trim().toLowerCase()
  if (!email) return { ok: false, error: 'Kimlik sağlayıcısı e-posta adresi döndürmedi.' }

  const supabase = createServiceClient()
  const requestedName = opts.name?.trim()
    || (typeof authUser.user_metadata?.['full_name'] === 'string' ? authUser.user_metadata['full_name'].trim() : '')
    || (typeof authUser.user_metadata?.['name'] === 'string' ? authUser.user_metadata['name'].trim() : '')
    || null

  type CustomerRow = { id: string; auth_user_id: string | null; email: string | null; name: string | null }
  const emailPattern = email.replace(/[\\%_]/g, '\\$&')

  const findLinked = async (): Promise<CustomerRow | null> => {
    const { data } = await supabase
      .from('customers')
      .select('id, auth_user_id, email, name')
      .eq('auth_user_id', authUser.id)
      .maybeSingle()
    return data as CustomerRow | null
  }

  let customer = await findLinked()
  if (!customer) {
    const { data: emailRow } = await supabase
      .from('customers')
      .select('id, auth_user_id, email, name')
      .ilike('email', emailPattern)
      .maybeSingle()
    customer = emailRow as CustomerRow | null
  }

  if (customer?.auth_user_id && customer.auth_user_id !== authUser.id) {
    return { ok: false, error: 'Bu e-posta başka bir müşteri hesabına bağlı.' }
  }

  if (customer) {
    const { data, error } = await supabase
      .from('customers')
      .update({ auth_user_id: authUser.id, email, verified_at: new Date().toISOString(), ...(requestedName ? { name: requestedName } : {}) })
      .eq('id', customer.id)
      .select('id, auth_user_id, email, name')
      .single()
    if (error || !data) return { ok: false, error: 'Müşteri hesabı bağlanamadı.' }
    customer = data as CustomerRow
  } else {
    const { data, error } = await supabase
      .from('customers')
      .upsert(
        { auth_user_id: authUser.id, email, verified_at: new Date().toISOString(), ...(requestedName ? { name: requestedName } : {}) },
        { onConflict: 'auth_user_id' },
      )
      .select('id, auth_user_id, email, name')
      .single()

    if (!error && data) {
      customer = data as CustomerRow
    } else {
      // A concurrent Email/OAuth first-login can win the lower(email) unique
      // index before our auth_user_id upsert. Re-read both keys and link once.
      customer = await findLinked()
      if (!customer) {
        const { data: racedEmail } = await supabase
          .from('customers')
          .select('id, auth_user_id, email, name')
          .ilike('email', emailPattern)
          .maybeSingle()
        const raced = racedEmail as CustomerRow | null
        if (!raced || (raced.auth_user_id && raced.auth_user_id !== authUser.id)) {
          return { ok: false, error: 'Müşteri hesabı oluşturulamadı.' }
        }
        const { data: linked, error: linkError } = await supabase
          .from('customers')
          .update({ auth_user_id: authUser.id, verified_at: new Date().toISOString(), ...(requestedName ? { name: requestedName } : {}) })
          .eq('id', raced.id)
          .select('id, auth_user_id, email, name')
          .single()
        if (linkError || !linked) return { ok: false, error: 'Müşteri hesabı bağlanamadı.' }
        customer = linked as CustomerRow
      }
    }
  }

  const { error: stampError } = await supabase.auth.admin.updateUserById(authUser.id, {
    app_metadata: { ...authUser.app_metadata, user_type: 'customer' },
  })
  if (stampError) return { ok: false, error: 'Müşteri oturumu damgalanamadı.' }

  if (opts.restaurantId) {
    await creditWelcomeBonus(customer.id, opts.restaurantId)
    if (opts.consent === true) await recordConsent(customer.id, opts.restaurantId, true, 'join')
    if (opts.marketingConsent === true) await recordConsent(customer.id, opts.restaurantId, true, 'join', 'marketing')
  }

  return { ok: true, customer: { id: customer.id, email, name: customer.name } }
}
