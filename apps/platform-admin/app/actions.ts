'use server'

import { randomUUID } from 'node:crypto'
import { setPlatformTenantServiceStatus } from '@garsonless/application/platform-admin-tenant-operations'
import { createPlatformAdminTenantOperationsPort } from '@garsonless/db/server'
import { isTenantServiceStatus } from '@garsonless/domain/platform-admin'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requirePlatformAdminActor } from '../lib/platform-admin-auth'
import { createPlatformAdminServerClient } from '../lib/supabase-server'

export async function signOut() {
  const supabase = await createPlatformAdminServerClient()
  await supabase.auth.signOut()
  redirect('/auth/login')
}

export async function changeTenantServiceStatus(formData: FormData) {
  const actor = await requirePlatformAdminActor()
  const restaurantId = String(formData.get('restaurantId') ?? '')
  const status = String(formData.get('status') ?? '')
  const reason = String(formData.get('reason') ?? '')
  if (!isTenantServiceStatus(status)) redirect('/')

  const result = await setPlatformTenantServiceStatus(actor, {
    restaurantId,
    status,
    reason,
    requestId: randomUUID(),
  }, createPlatformAdminTenantOperationsPort())

  if (!result.ok) {
    const code = result.error === 'Not authorized' ? 'forbidden' : 'failed'
    redirect(`/tenants/${encodeURIComponent(restaurantId)}?operation=${code}`)
  }
  revalidatePath('/')
  revalidatePath(`/tenants/${restaurantId}`)
  redirect(`/tenants/${encodeURIComponent(restaurantId)}?operation=${result.value.changed ? 'updated' : 'unchanged'}`)
}
