'use server'
import { headers } from 'next/headers'
import { isIP } from 'node:net'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createAddOnPurchasePort } from '@garsonless/db/server'
import {
  startAddOnPurchase,
  reconcileAddOnPurchase,
} from '@garsonless/application/add-on-purchases'
import { addOnReturnPath } from '@garsonless/domain/add-on-purchases'
import { CANONICAL_THEME_ID } from '@garsonless/design-engine'
import { assertOwner } from '../auth/access'
import { createIyzicoAddOnProvider } from '../billing/iyzico-add-on-provider'
import { assertIyzicoSubscriptionSalesEnabled } from '../billing/iyzico-subscription-config'

const inputSchema = z
  .object({
    termsAccepted: z.literal(true),
    addOn: z.enum(['storefront_video_hero', 'iyzico_online_payments']),
    priceVersion: z.number().int().positive(),
    requestId: z.string().uuid(),
    returnContext: z
      .object({
        templateId: z.literal(CANONICAL_THEME_ID),
        sectionId: z.literal('storefront-video-hero'),
      })
      .strict()
      .nullable(),
  })
  .strict()
function failure(error: unknown): { error: string } {
  const code = error instanceof Error ? error.message : ''
  console.error('[add-on-purchase]', {
    code: /^[a-z_]+(?::[0-9]{1,8})?$/.test(code)
      ? code
      : 'add_on_purchase_unavailable',
  })
  if (code === 'add_on_checkout_initialize_rejected:5')
    return {
      error:
        'Fatura ve iletişim bilgilerinin biçimini kontrol ederek tekrar dene.',
    }
  if (code.includes('billing_profile'))
    return { error: 'Önce fatura bilgilerini doldurup kaydet.' }
  if (code.includes('price_changed'))
    return { error: 'Fiyat güncellendi. Sayfayı yenileyip yeni fiyatı incele.' }
  if (code.includes('already_owned'))
    return { error: 'Bu eklenti işletmende zaten satın alınmış.' }
  if (code.includes('plan_required'))
    return {
      error: 'Mevcut paketin bu eklentiyi satın almak için uygun değil.',
    }
  return {
    error: 'Ödeme şu anda tamamlanamadı. Durumu kontrol ederek tekrar dene.',
  }
}
export async function startAddOnPurchaseAction(
  restaurantId: string,
  input: unknown,
) {
  if (!z.string().uuid().safeParse(restaurantId).success)
    return { error: 'İşletme geçersiz.' }
  const gate = await assertOwner(restaurantId)
  if ('error' in gate)
    return { error: 'Satın alma işlemini yalnız işletme sahibi yapabilir.' }
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) return { error: 'Satın alma bilgileri geçersiz.' }
  try {
    assertIyzicoSubscriptionSalesEnabled()
    const requestHeaders = await headers()
    const ip =
      requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      '127.0.0.1'
    if (!isIP(ip)) return { error: 'Ödeme bağlantısı oluşturulamadı.' }
    const purchase = await startAddOnPurchase(
      { ...parsed.data, restaurantId, userId: gate.userId },
      createAddOnPurchasePort(),
      createIyzicoAddOnProvider(ip),
    )
    return {
      success: true as const,
      purchaseId: purchase.id,
      status: purchase.status,
      paymentPageUrl: purchase.paymentPageUrl,
    }
  } catch (error) {
    return failure(error)
  }
}
export async function checkAddOnPurchaseAction(
  restaurantId: string,
  purchaseId: string,
) {
  if (
    ![restaurantId, purchaseId].every(
      (id) => z.string().uuid().safeParse(id).success,
    )
  )
    return { error: 'İşlem geçersiz.' }
  const gate = await assertOwner(restaurantId)
  if ('error' in gate)
    return { error: 'Bu işlem için işletme sahibi yetkisi gerekir.' }
  try {
    const port = createAddOnPurchasePort()
    const stored = await port.read(purchaseId)
    if (!stored || stored.restaurantId !== restaurantId)
      return { error: 'Ödeme bulunamadı.' }
    const purchase = await reconcileAddOnPurchase(
      stored,
      port,
      createIyzicoAddOnProvider(),
    )
    revalidatePath(`/dashboard/${restaurantId}`, 'layout')
    return {
      success: true as const,
      status: purchase.status,
      returnPath: addOnReturnPath(
        restaurantId,
        purchase.addOn,
        purchase.returnContext,
      ),
      paymentPageUrl: purchase.paymentPageUrl,
    }
  } catch (error) {
    return failure(error)
  }
}
export async function readAddOnStoreAction(restaurantId: string) {
  if (!z.string().uuid().safeParse(restaurantId).success)
    return { error: 'İşletme geçersiz.' }
  const gate = await assertOwner(restaurantId)
  if ('error' in gate) return { error: 'İşletme sahibi yetkisi gerekir.' }
  try {
    return {
      success: true as const,
      store: await createAddOnPurchasePort().store(restaurantId),
    }
  } catch {
    return { error: 'Eklenti kataloğu yüklenemedi.' }
  }
}
