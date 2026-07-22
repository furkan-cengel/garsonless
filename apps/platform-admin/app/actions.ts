'use server'

import { randomUUID } from 'node:crypto'
import { setPlatformTenantPlan } from '@garsonless/application/platform-admin-tenant-plans'
import { setPlatformTenantServiceStatus } from '@garsonless/application/platform-admin-tenant-operations'
import {
  createPlatformAdminTenantOperationsPort,
  createPlatformAdminTenantPlanManagementPort,
} from '@garsonless/db/server'
import { RESTAURANT_PLANS, type RestaurantPlan } from '@garsonless/domain/entitlements'
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

export async function changeTenantPlan(formData: FormData) {
  const actor = await requirePlatformAdminActor()
  const restaurantId = String(formData.get('restaurantId') ?? '')
  const plan = String(formData.get('plan') ?? '')
  const reason = String(formData.get('reason') ?? '')
  if (!RESTAURANT_PLANS.includes(plan as RestaurantPlan)) redirect('/')

  const result = await setPlatformTenantPlan(actor, {
    restaurantId,
    plan: plan as RestaurantPlan,
    reason,
    requestId: randomUUID(),
  }, createPlatformAdminTenantPlanManagementPort())

  if (!result.ok) {
    const code = result.error === 'Not authorized'
      ? 'plan-forbidden'
      : result.error === 'Tenant plan is managed by an active billing subscription'
        ? 'plan-billing-managed'
        : 'plan-failed'
    redirect(`/tenants/${encodeURIComponent(restaurantId)}?operation=${code}`)
  }
  revalidatePath('/')
  revalidatePath(`/tenants/${restaurantId}`)
  redirect(`/tenants/${encodeURIComponent(restaurantId)}?operation=${result.value.changed ? 'plan-updated' : 'plan-unchanged'}`)
}
