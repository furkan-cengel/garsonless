'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import Iyzipay from 'iyzipay'
import {
  deletePaymentCredentialVault,
  readIyzicoCredentialRecord,
  readPaymentCredentialMeta,
  rotatePaymentCredentialVault,
  writePaymentCredentialVault,
} from '@garsonless/db/server'
import { createDashboardServerClient } from '../supabase-server'

const SANDBOX_URL = 'https://sandbox-api.iyzipay.com'
const LIVE_URL = 'https://api.iyzipay.com'

export interface PaymentCredsMeta {
  configured: boolean
  mode: 'sandbox' | 'live'
  apiKeyLast4: string | null
  updatedAt: string | null
  protection: 'encrypted' | 'legacy-plaintext' | 'none'
  requiresRotation: boolean
}

const restaurantRequestSchema = z.object({
  restaurantId: z.string().uuid(),
  requestId: z.string().uuid(),
})

const credentialMutationSchema = restaurantRequestSchema.extend({
  currentPassword: z.string().min(1, 'Hesap şifresi gerekli').max(256, 'Hesap şifresi geçersiz'),
})

const credentialsSchema = credentialMutationSchema.extend({
  apiKey: z.string().trim().min(10, 'API Key en az 10 karakter olmalı').max(512),
  secretKey: z.string().trim().min(10, 'Secret Key en az 10 karakter olmalı').max(512),
  mode: z.enum(['sandbox', 'live']),
})

async function assertOwner(restaurantId: string): Promise<{
  userId: string | null
  email: string | null
  error: 'Not authenticated' | 'Not authorized' | null
}> {
  const supabase = await createDashboardServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { userId: null, email: null, error: 'Not authenticated' }

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .eq('owner_id', user.id)
    .is('deleted_at', null)
    .single()

  if (!restaurant) return { userId: null, email: null, error: 'Not authorized' }
  return { userId: user.id, email: user.email ?? null, error: null }
}

async function assertOwnerPassword(restaurantId: string, currentPassword: string) {
  const gate = await assertOwner(restaurantId)
  if (!gate.userId || !gate.email) return { userId: null, error: gate.error ?? 'Not authorized' }

  const supabase = await createDashboardServerClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: gate.email,
    password: currentPassword,
  })
  if (error) return { userId: null, error: 'Hesap şifresi doğrulanamadı.' }
  return { userId: gate.userId, error: null }
}

function publicCredentialStoreError(error: string): string {
  if (error === 'payment_credential_request_conflict') {
    return 'Bu kayıt isteği farklı bir içerikle daha önce kullanıldı. Sayfayı yenileyip tekrar deneyin.'
  }
  if (error === 'payment_credential_not_configured') return 'Önce API anahtarlarını kaydedin.'
  if (error === 'payment_credential_store_key_unavailable') {
    return 'Credential şifreleme anahtarı hazır değil. Referans için sistem yöneticisine başvurun.'
  }
  if (error === 'payment_credential_store_writes_disabled') {
    return 'Şifreli credential geçişi henüz etkinleştirilmedi. Sistem yöneticisine başvurun.'
  }
  return 'Ödeme credential işlemi güvenli biçimde tamamlanamadı.'
}

/** Returns only masked metadata; raw credentials never cross this boundary. */
export async function getPaymentCredentialsMeta(
  restaurantId: string,
): Promise<PaymentCredsMeta | { error: string }> {
  if (!z.string().uuid().safeParse(restaurantId).success) return { error: 'Geçersiz restoran.' }
  const gate = await assertOwner(restaurantId)
  if (!gate.userId) return { error: gate.error ?? 'Not authorized' }

  const result = await readPaymentCredentialMeta(restaurantId)
  if (result.error || !result.meta) {
    return { error: publicCredentialStoreError(result.error ?? 'payment_credential_store_unavailable') }
  }
  return result.meta
}

export async function savePaymentCredentials(
  restaurantId: string,
  input: {
    apiKey: string
    secretKey: string
    mode: 'sandbox' | 'live'
    requestId: string
    currentPassword: string
  },
): Promise<{ error: string } | { success: true; meta: PaymentCredsMeta; idempotent: boolean }> {
  const parsed = credentialsSchema.safeParse({ restaurantId, ...input })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Geçersiz bilgiler' }
  }

  const gate = await assertOwnerPassword(parsed.data.restaurantId, parsed.data.currentPassword)
  if (!gate.userId) return { error: gate.error ?? 'Not authorized' }

  const result = await writePaymentCredentialVault({
    restaurantId: parsed.data.restaurantId,
    actorUserId: gate.userId,
    requestId: parsed.data.requestId,
    operation: 'save',
    apiKey: parsed.data.apiKey,
    secretKey: parsed.data.secretKey,
    mode: parsed.data.mode,
  })
  if (result.error || !result.meta) {
    return { error: publicCredentialStoreError(result.error ?? 'payment_credential_store_unavailable') }
  }

  revalidatePath(`/dashboard/${parsed.data.restaurantId}/settings`)
  return { success: true, meta: result.meta, idempotent: result.idempotent }
}

export async function rotatePaymentCredentialsEncryption(
  restaurantId: string,
  input: { requestId: string; currentPassword: string },
): Promise<{ error: string } | { success: true; meta: PaymentCredsMeta; idempotent: boolean }> {
  const parsed = credentialMutationSchema.safeParse({ restaurantId, ...input })
  if (!parsed.success) return { error: 'Geçersiz credential yenileme isteği.' }
  const gate = await assertOwnerPassword(parsed.data.restaurantId, parsed.data.currentPassword)
  if (!gate.userId) return { error: gate.error ?? 'Not authorized' }

  const result = await rotatePaymentCredentialVault({
    restaurantId: parsed.data.restaurantId,
    actorUserId: gate.userId,
    requestId: parsed.data.requestId,
  })
  if (result.error || !result.meta) {
    return { error: publicCredentialStoreError(result.error ?? 'payment_credential_store_unavailable') }
  }
  revalidatePath(`/dashboard/${parsed.data.restaurantId}/settings`)
  return { success: true, meta: result.meta, idempotent: result.idempotent }
}

export async function deletePaymentCredentials(
  restaurantId: string,
  input: { requestId: string; currentPassword: string },
): Promise<{ error: string } | { success: true; idempotent: boolean }> {
  const parsed = credentialMutationSchema.safeParse({ restaurantId, ...input })
  if (!parsed.success) return { error: 'Geçersiz credential silme isteği.' }
  const gate = await assertOwnerPassword(parsed.data.restaurantId, parsed.data.currentPassword)
  if (!gate.userId) return { error: gate.error ?? 'Not authorized' }

  const result = await deletePaymentCredentialVault({
    restaurantId: parsed.data.restaurantId,
    actorUserId: gate.userId,
    requestId: parsed.data.requestId,
  })
  if (result.error) return { error: publicCredentialStoreError(result.error) }

  revalidatePath(`/dashboard/${parsed.data.restaurantId}/settings`)
  return { success: true, idempotent: result.idempotent }
}

/** Connectivity check via İyzico's non-charging API test endpoint. */
export async function testPaymentCredentials(
  restaurantId: string,
): Promise<{ ok: boolean; message: string }> {
  if (!z.string().uuid().safeParse(restaurantId).success) {
    return { ok: false, message: 'Geçersiz restoran.' }
  }
  const gate = await assertOwner(restaurantId)
  if (!gate.userId) return { ok: false, message: gate.error ?? 'Not authorized' }

  const credential = await readIyzicoCredentialRecord(restaurantId)
  if (credential.error) {
    return { ok: false, message: publicCredentialStoreError(credential.error) }
  }
  if (!credential.record) return { ok: false, message: 'Önce API anahtarlarını kaydedin' }

  try {
    const client = new Iyzipay({
      apiKey: credential.record.apiKey,
      secretKey: credential.record.secretKey,
      uri: credential.record.mode === 'live' ? LIVE_URL : SANDBOX_URL,
    })

    return await new Promise((resolve) => {
      const timer = setTimeout(
        () => resolve({ ok: false, message: 'İyzico yanıt vermedi (zaman aşımı)' }),
        10_000,
      )
      client.apiTest.retrieve({}, (error, result) => {
        clearTimeout(timer)
        if (error) {
          resolve({ ok: false, message: 'İyzico bağlantısı kurulamadı.' })
          return
        }
        if (result.status === 'success') {
          resolve({ ok: true, message: 'Bağlantı başarılı — anahtarlar geçerli' })
        } else {
          resolve({ ok: false, message: 'Anahtarlar doğrulanamadı.' })
        }
      })
    })
  } catch {
    return { ok: false, message: 'İyzico bağlantısı güvenli biçimde başlatılamadı.' }
  }
}
