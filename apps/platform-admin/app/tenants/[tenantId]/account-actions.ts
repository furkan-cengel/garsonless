'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { activatePlatformTenantAccount, reconcilePlatformTenantUnban, revealPlatformTenantAccounts } from '@garsonless/application/platform-admin-tenant-accounts'
import { createPlatformAdminTenantAccountsPort } from '@garsonless/db/server'
import { requirePlatformAdminActor } from '../../../lib/platform-admin-auth'

function field(form: FormData, name: string) {
  const value = form.get(name)
  return typeof value === 'string' ? value : ''
}

export async function revealTenantAccounts(form: FormData) {
  const actor = await requirePlatformAdminActor()
  return revealPlatformTenantAccounts(actor, {
    restaurantId: field(form, 'restaurantId'), reason: field(form, 'reason'), requestId: randomUUID(),
  }, createPlatformAdminTenantAccountsPort())
}

export async function activateTenantAccount(form: FormData) {
  const actor = await requirePlatformAdminActor()
  const restaurantId = field(form, 'restaurantId')
  const result = await activatePlatformTenantAccount(actor, {
    restaurantId, targetId: field(form, 'targetId'), kind: field(form, 'kind'), reason: field(form, 'reason'),
    confirmation: field(form, 'confirmation'), requestId: randomUUID(),
  }, createPlatformAdminTenantAccountsPort())
  if (result.ok) revalidatePath(`/tenants/${encodeURIComponent(restaurantId)}`)
  return result
}

export async function reconcileTenantAccount(form: FormData) {
  const actor = await requirePlatformAdminActor()
  const restaurantId = field(form, 'restaurantId')
  const result = await reconcilePlatformTenantUnban(actor, {
    restaurantId, requestId: field(form, 'operationId'),
  }, createPlatformAdminTenantAccountsPort())
  if (result.ok) revalidatePath(`/tenants/${encodeURIComponent(restaurantId)}`)
  return result
}
