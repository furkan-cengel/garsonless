import { notFound, redirect } from 'next/navigation'
import { getRestaurantById } from '../../../../lib/queries/restaurants'
import { firstPermittedPath, type Section } from '../../../../lib/auth/access'
import { getDashboardAuthenticatedUser, getDashboardFeatureContext } from '../../../../lib/queries/context'
import { readDashboardSettings } from '@garsonless/application/settings'
import { readSubscriptionBillingSettings } from '@garsonless/application/billing'
import {
  canRestaurantUseFeature,
  createDashboardSettingsReadModelPort,
  createSubscriptionBillingSettingsReadPort,
} from '@garsonless/db/server'
import SettingsForm from '../../../../components/settings/SettingsForm'
import { resolveSettingsSection } from '../../../../components/settings/settings-sections'
import { readBillingPlanPrices } from '../../../../lib/billing/subscription-billing-request'
import BillingSection from '../../../../components/settings/BillingSection'
import PlanLockedPanel from '../../../../components/PlanLockedPanel'

interface Props {
  params: Promise<{ restaurantId: string }>
  searchParams: Promise<{ section?: string; checkout?: string }>
}

export default async function SettingsPage({ params, searchParams }: Props) {
  const { restaurantId } = await params
  const query = await searchParams
  const [restaurant, user, actor] = await Promise.all([
    getRestaurantById(restaurantId),
    getDashboardAuthenticatedUser(),
    getDashboardFeatureContext(restaurantId),
  ])
  if (!restaurant || !actor) notFound()
  if (!actor.isOwner && !actor.permissions.includes('settings')) {
    redirect(firstPermittedPath(restaurantId, {
      isOwner: false,
      isMember: true,
      permissions: [...actor.permissions] as Section[],
    }))
  }
  const productAccess = await canRestaurantUseFeature({
    restaurantId,
    plan: restaurant.plan,
    feature: 'qr_menu',
  })
  if (!productAccess) {
    if (!actor.isOwner) {
      return <PlanLockedPanel restaurantId={restaurantId} currentPlan={restaurant.plan} feature="qr_menu" isOwner={false} />
    }
    const billing = await readSubscriptionBillingSettings(
      actor,
      restaurantId,
      createSubscriptionBillingSettingsReadPort(),
    )
    return (
      <main style={{ padding: 24, maxWidth: 1040, margin: '0 auto' }}>
        <div style={{ marginBottom: 18, padding: 16, borderRadius: 12, background: 'var(--warning-bg)', color: 'var(--warning)', fontSize: 13, lineHeight: 1.55 }}>
          <strong>Ürün erişiminiz kilitli.</strong> Verileriniz korunuyor. Bir paket seçerek menü yayınını ve operasyon araçlarını yeniden açabilirsiniz.
        </div>
        <BillingSection
          restaurantId={restaurantId}
          restaurantPlan={restaurant.plan}
          billing={billing.ok ? billing.value : null}
          loadError={billing.ok ? null : billing.error}
          planPrices={readBillingPlanPrices()}
          checkoutState={query.checkout === 'success' ? 'success' : null}
        />
      </main>
    )
  }
  const initialSection = resolveSettingsSection(query.section, actor.isOwner === true)
  if (query.section && query.section !== initialSection) {
    const canonicalQuery = new URLSearchParams()
    canonicalQuery.set('section', initialSection)
    if (query.checkout === 'success' && initialSection === 'billing') canonicalQuery.set('checkout', 'success')
    redirect(`/dashboard/${restaurantId}/settings?${canonicalQuery.toString()}`)
  }
  const [settings, billing, loyaltyAccess, kitchenDisplayAccess, browserNotificationsAccess] = await Promise.all([
    readDashboardSettings(actor, restaurantId, createDashboardSettingsReadModelPort()),
    actor.isOwner
      ? readSubscriptionBillingSettings(actor, restaurantId, createSubscriptionBillingSettingsReadPort())
      : Promise.resolve(null),
    canRestaurantUseFeature({ restaurantId, plan: restaurant.plan, feature: 'loyalty' }),
    canRestaurantUseFeature({ restaurantId, plan: restaurant.plan, feature: 'kitchen_display' }),
    canRestaurantUseFeature({ restaurantId, plan: restaurant.plan, feature: 'browser_notifications' }),
  ])
  if (!settings.ok) throw new Error(settings.error)

  return (
    <SettingsForm
      restaurant={restaurant}
      user={user}
      hasKitchenAccess={settings.value.hasKitchenAccess}
      kitchenStations={settings.value.kitchenStations}
      securityEvents={settings.value.securityEvents}
      renderedAt={new Date().toISOString()}
      isOwner={actor.isOwner === true}
      teamMembers={settings.value.teamMembers}
      teamAuditEvents={settings.value.teamAuditEvents}
      billing={billing?.ok ? billing.value : null}
      billingLoadError={billing && !billing.ok ? billing.error : null}
      billingPlanPrices={readBillingPlanPrices()}
      initialSection={initialSection}
      billingCheckoutState={query.checkout === 'success' ? 'success' : null}
      featureAccess={{
        loyalty: loyaltyAccess,
        kitchenDisplay: kitchenDisplayAccess,
        browserNotifications: browserNotificationsAccess,
      }}
    />
  )
}
