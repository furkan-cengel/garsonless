'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import Iyzipay from 'iyzipay'
import { createDashboardServerClient } from '../supabase-server'
import { mut } from '../supabase-mut'

const SANDBOX_URL = 'https://sandbox-api.iyzipay.com'
const LIVE_URL = 'https://api.iyzipay.com'

export interface PaymentCredsMeta {
  configured: boolean
  mode: 'sandbox' | 'live'
  apiKeyLast4: string | null
  updatedAt: string | null
}

const credentialsSchema = z.object({
  apiKey: z.string().trim().min(10, 'API Key en az 10 karakter olmalı'),
  secretKey: z.string().trim().min(10, 'Secret Key en az 10 karakter olmalı'),
  mode: z.enum(['sandbox', 'live']),
})

async function assertOwner(restaurantId: string) {
  const supabase = await createDashboardServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase: null, error: 'Not authenticated' as const }

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .eq('owner_id', user.id)
    .is('deleted_at', null)
    .single()

  if (!restaurant) return { supabase: null, error: 'Not authorized' as const }
  return { supabase, error: null }
}

/** Returns ONLY masked metadata — the raw secret never crosses to the client. */
export async function getPaymentCredentialsMeta(
  restaurantId: string,
): Promise<PaymentCredsMeta | { error: string }> {
  const { supabase, error } = await assertOwner(restaurantId)
  if (!supabase) return { error }

  const { data } = await supabase
    .from('payment_credentials')
    .select('api_key, mode, updated_at')
    .eq('restaurant_id', restaurantId)
    .maybeSingle()

  if (!data) return { configured: false, mode: 'sandbox', apiKeyLast4: null, updatedAt: null }

  const row = data as { api_key: string; mode: string; updated_at: string }
  return {
    configured: true,
    mode: row.mode === 'live' ? 'live' : 'sandbox',
    apiKeyLast4: row.api_key.slice(-4),
    updatedAt: row.updated_at,
  }
}

export async function savePaymentCredentials(
  restaurantId: string,
  input: { apiKey: string; secretKey: string; mode: 'sandbox' | 'live' },
): Promise<{ error: string } | { success: true }> {
  const parsed = credentialsSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Geçersiz bilgiler' }
  }

  const { supabase, error } = await assertOwner(restaurantId)
  if (!supabase) return { error }

  const { error: upsertError } = await mut(supabase, 'payment_credentials').upsert(
    {
      restaurant_id: restaurantId,
      provider: 'iyzico',
      api_key: parsed.data.apiKey,
      secret_key: parsed.data.secretKey,
      mode: parsed.data.mode,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'restaurant_id' },
  )

  if (upsertError) return { error: upsertError.message }

  revalidatePath(`/dashboard/${restaurantId}/settings`)
  return { success: true }
}

export async function deletePaymentCredentials(
  restaurantId: string,
): Promise<{ error: string } | { success: true }> {
  const { supabase, error } = await assertOwner(restaurantId)
  if (!supabase) return { error }

  const { error: deleteError } = await supabase
    .from('payment_credentials')
    .delete()
    .eq('restaurant_id', restaurantId)

  if (deleteError) return { error: deleteError.message }

  revalidatePath(`/dashboard/${restaurantId}/settings`)
  return { success: true }
}

/** Connectivity check via İyzico's /payment/test — validates keys, no charge. */
export async function testPaymentCredentials(
  restaurantId: string,
): Promise<{ ok: boolean; message: string }> {
  const { supabase, error } = await assertOwner(restaurantId)
  if (!supabase) return { ok: false, message: error }

  const { data } = await supabase
    .from('payment_credentials')
    .select('api_key, secret_key, mode')
    .eq('restaurant_id', restaurantId)
    .maybeSingle()

  if (!data) return { ok: false, message: 'Önce API anahtarlarını kaydedin' }

  const row = data as { api_key: string; secret_key: string; mode: string }
  const client = new Iyzipay({
    apiKey: row.api_key,
    secretKey: row.secret_key,
    uri: row.mode === 'live' ? LIVE_URL : SANDBOX_URL,
  })

  return new Promise((resolve) => {
    const timer = setTimeout(
      () => resolve({ ok: false, message: 'İyzico yanıt vermedi (zaman aşımı)' }),
      10_000,
    )
    client.apiTest.retrieve({}, (err, result) => {
      clearTimeout(timer)
      if (err) {
        resolve({ ok: false, message: `Bağlantı hatası: ${err.message}` })
        return
      }
      if (result.status === 'success') {
        resolve({ ok: true, message: 'Bağlantı başarılı — anahtarlar geçerli' })
      } else {
        resolve({ ok: false, message: result.errorMessage ?? 'Anahtarlar doğrulanamadı' })
      }
    })
  })
}
