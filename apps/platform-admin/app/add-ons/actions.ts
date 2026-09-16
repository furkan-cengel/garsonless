'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { platformAdminCan } from '@garsonless/domain/platform-admin'
import {
  RESTAURANT_ADD_ONS,
  type RestaurantAddOn,
} from '@garsonless/domain/entitlements'
import { createAddOnPurchasePort } from '@garsonless/db/server'
import { requirePlatformAdminActor } from '../../lib/platform-admin-auth'
export async function updateAddOnPrice(form: FormData) {
  const actor = await requirePlatformAdminActor()
  if (!platformAdminCan(actor, 'catalog.manage')) redirect('/auth/denied')
  const addOn = String(form.get('addOn')) as RestaurantAddOn
  const raw = String(form.get('price') ?? '').replace(',', '.')
  const version = Number(form.get('version'))
  const vatRate = Number(form.get('vatRate'))
  const [whole, fraction = ''] = raw.split('.')
  const netAmountMinor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (
    !RESTAURANT_ADD_ONS.includes(addOn) ||
    !/^\d+(?:\.\d{1,2})?$/.test(raw) ||
    !Number.isSafeInteger(netAmountMinor) ||
    netAmountMinor <= 0 ||
    !Number.isInteger(version) ||
    ![0, 1, 10, 20].includes(vatRate)
  )
    redirect('/add-ons?result=invalid')
  try {
    await createAddOnPurchasePort().setPrice({
      actorUserId: actor.userId,
      addOn,
      expectedVersion: version,
      netAmountMinor,
      vatRate,
      active: form.get('active') === 'on',
    })
  } catch {
    redirect('/add-ons?result=conflict')
  }
  revalidatePath('/add-ons')
  redirect('/add-ons?result=saved')
}
