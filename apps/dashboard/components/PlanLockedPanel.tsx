import Link from 'next/link'
import { readSubscriptionBillingSettings } from '@garsonless/application/billing'
import { createSubscriptionBillingSettingsReadPort } from '@garsonless/db/server'
import {
  getFeatureEntitlement,
  normalizeRestaurantPlan,
  PLAN_DEFINITIONS,
  SELF_SERVE_PLANS,
  type BillableFeature,
  type SelfServePlan,
} from '@garsonless/domain/entitlements'
import type { BillingPlanPrices } from '../lib/billing/subscription-billing-request'
import { I } from '../lib/ui'
import { getUserRestaurantAccess } from '../lib/auth/access'
import styles from './PlanLockedPanel.module.css'
import PlanLockCard from './plan-lock/PlanLockCard'
import { getPlanLockPresentation } from './plan-lock/presentation'
import { FEATURE_LABELS, additionalFeatures, selectablePlans } from './plan-lock/plan-selection'

function formatMoney(amountMinor: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100)
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul',
  }).format(new Date(value))
}

function planUnlocksFeature(plan: SelfServePlan, feature: BillableFeature): boolean {
  return getFeatureEntitlement(plan, feature).allowed
}

export default async function PlanLockedPanel({ restaurantId, currentPlan: currentPlanInput, feature, isOwner, planPrices, returnHref, returnLabel = 'Menüye dön' }: {
  restaurantId: string
  currentPlan: unknown
  feature: BillableFeature
  isOwner: boolean
  planPrices: BillingPlanPrices
  returnHref?: string
  returnLabel?: string
}) {
  const entitlement = getFeatureEntitlement(currentPlanInput, feature)
  const currentPlan = normalizeRestaurantPlan(currentPlanInput)
  const presentation = getPlanLockPresentation(feature)
  const required = entitlement.requiredPlan
  const requiredLabel = required ? PLAN_DEFINITIONS[required].label : 'uygun plan'
  const plans = selectablePlans(currentPlan, feature, entitlement.allowed)
  const recommendedPlan = plans[0] ?? null
  const checkoutConfigured = plans.length > 0 && planPrices.checkoutAvailable
  const access = isOwner ? await getUserRestaurantAccess(restaurantId) : null
  const billingResult = access?.isOwner
    ? await readSubscriptionBillingSettings({
      actor: 'dashboard-member', restaurantId, userId: access.userId,
      permissions: ['settings'], isOwner: true,
    }, restaurantId, createSubscriptionBillingSettingsReadPort())
    : null
  const subscription = billingResult?.ok ? billingResult.value.subscription : null
  const scheduledPlan = subscription?.scheduledPlan
  const scheduledUnlockPlan = scheduledPlan && SELF_SERVE_PLANS.includes(scheduledPlan as SelfServePlan)
    && planUnlocksFeature(scheduledPlan as SelfServePlan, feature)
    ? scheduledPlan as SelfServePlan
    : null
  const scheduledEffectiveAt = scheduledUnlockPlan ? subscription?.currentPeriodEnd ?? null : null
  const existingSubscriptionChangesAtPeriodEnd = subscription?.status === 'active'
    && currentPlan !== 'business'
  const title = scheduledUnlockPlan
    ? `${presentation.label} dönem sonunda açılacak`
    : subscription?.status === 'refund_cancel_pending'
    ? 'Aboneliğiniz iptal ediliyor'
    : entitlement.allowed
    ? 'Erişiminiz geçici olarak kilitli'
    : `${presentation.label} ${requiredLabel} ve üzeri paketlere dahil`
  const description = scheduledUnlockPlan
    ? `${PLAN_DEFINITIONS[scheduledUnlockPlan].label} geçişiniz planlandı. Yeni paket yalnızca bir sonraki dönem ödemesi başarıyla alındıktan sonra etkinleşir.`
    : subscription?.status === 'refund_cancel_pending'
    ? 'İadeniz tamamlandı ve ücretli özellikler güvenli biçimde kapatıldı. İyzico abonelik iptali doğrulanırken verileriniz korunur; faturalama ve hesap araçlarına erişmeye devam edebilirsiniz.'
    : entitlement.allowed
    ? 'Deneme veya abonelik süreniz sona ermiş olabilir. Verileriniz korunuyor; yeniden etkinleştirdiğinizde kaldığınız yerden devam edersiniz.'
    : `Bu bölüm ${requiredLabel} veya üzeri paketlerde kullanılabilir. Planınızı yükselttiğinizde mevcut verileriniz değişmeden erişiminiz açılır.`
  const safeReturnHref = returnHref ?? `/dashboard/${restaurantId}/menu`

  return (
    <main className={styles.root} data-plan-locked-panel>
      <PlanLockCard title={title} description={description}
        benefits={presentation.benefits}
        returnHref={safeReturnHref} returnLabel={returnLabel}>
          {isOwner ? scheduledUnlockPlan ? (
            <div className={styles.businessSupport}>
              <div className={styles.purchaseHeader}>
                <div>
                  <strong>{PLAN_DEFINITIONS[scheduledUnlockPlan].label} geçişi planlandı</strong>
                  <span>Mevcut paketiniz dönem sonuna kadar korunur.</span>
                </div>
              </div>
              <div className={styles.ownerSupport}>
                <span aria-hidden="true"><I.clock size={20} /></span>
                <strong>{scheduledEffectiveAt ? `${formatDate(scheduledEffectiveAt)} tarihinde yenilenecek` : 'Sonraki başarılı yenilemede uygulanacak'}</strong>
                <p>Yenileme ödemesi başarılı olduğunda {presentation.label.toLocaleLowerCase('tr-TR')} erişiminiz otomatik açılır. Şimdi tekrar ödeme başlatmanız gerekmez.</p>
              </div>
              <Link className={styles.compareLink} href={`/dashboard/${restaurantId}/settings?section=billing`}>
                Planlamayı görüntüle
              </Link>
            </div>
          ) : subscription?.status === 'refund_cancel_pending' ? (
            <Link className={styles.primaryAction} href={`/dashboard/${restaurantId}/settings?section=billing`}>Faturalamayı görüntüle</Link>
          ) : plans.length > 0 ? (
            <form className={styles.purchaseForm} action={`/dashboard/${restaurantId}/settings`} method="get">
              <input type="hidden" name="section" value="billing" />
              <fieldset className={styles.planChoices}>
                <legend>Paketinizi seçin</legend>
                <div className={styles.planOptions}>
                  {plans.map((plan) => <label className={styles.planOption} key={plan}>
                    <input type="radio" name="plan" value={plan} defaultChecked={plan === recommendedPlan} />
                    <strong>{PLAN_DEFINITIONS[plan].label}</strong>
                    <span className={styles.monthlyPrice}>{formatMoney(planPrices[plan].monthly)} / ay</span>
                    <span className={styles.annualPrice}>{formatMoney(Math.round(planPrices[plan].annual / 12))} / ay</span>
                  </label>)}
                </div>
              </fieldset>
              {plans.map((plan) => {
                const additions = additionalFeatures(currentPlan, plan)
                const features = PLAN_DEFINITIONS[plan].features
                return <div className={styles.planDetails} data-plan-option={plan} key={plan}>
                  <p>{PLAN_DEFINITIONS[plan].description}</p>
                  <details>
                    <summary>{additions.length > 0 ? `Mevcut paketinize ek ${additions.length} özellik` : `${PLAN_DEFINITIONS[plan].label} paketinin kapsamı`}</summary>
                    <ul>{features.map((item) => <li key={item}>
                      <span>{FEATURE_LABELS[item]}</span>
                      {additions.includes(item) && <span className={styles.newFeature}>Yeni</span>}
                    </li>)}</ul>
                  </details>
                </div>
              })}
              <div className={styles.periodRow}>
                <div className={styles.intervalSwitch} role="group" aria-label="Fatura dönemi">
                  <label><input type="radio" name="interval" value="monthly" defaultChecked /><span>Aylık</span></label>
                  <label><input type="radio" name="interval" value="annual" /><span>Yıllık</span></label>
                </div>
                {plans.map((plan) => {
                  const monthly = planPrices[plan].monthly
                  const saving = monthly > 0 ? Math.round((1 - planPrices[plan].annual / (monthly * 12)) * 100) : 0
                  return <span key={plan} className={styles.savingNote} data-plan-option={plan}>{saving > 0 ? `Yıllık ödemede %${saving} indirim` : 'Yıllık ödeme seçeneği'}</span>
                })}
              </div>
              <button className={styles.primaryAction} type="submit" disabled={!checkoutConfigured}>
                {checkoutConfigured ? plans.map((plan) => <span key={plan} data-plan-option={plan}>
                  {PLAN_DEFINITIONS[plan].label} ile devam et
                </span>) : 'Ödeme yapılandırılıyor'}
              </button>
              {plans.map((plan) => <p key={plan} className={styles.billingCaption} data-plan-option={plan}>
                <span className={styles.monthlyPrice}>Aylık {formatMoney(planPrices[plan].monthly)} + KDV.</span>
                <span className={styles.annualPrice}>Yıllık {formatMoney(planPrices[plan].annual)} + KDV, tek ödeme.</span>
              </p>)}
              <p className={styles.activationNote}>{existingSubscriptionChangesAtPeriodEnd ? 'Paket değişikliği başarılı dönem sonu yenilemesinde uygulanır.' : 'Ödeme onayıyla etkinleşir.'}</p>
              <Link className={styles.compareLink} href={`/dashboard/${restaurantId}/settings?section=billing`}>
                Tüm paketleri karşılaştır
              </Link>
            </form>
          ) : (
            <div className={styles.businessSupport}>
              <div className={styles.purchaseHeader}>
                <div><strong>Plan erişimini yönetin</strong><span>Business kapsamı satış desteklidir.</span></div>
              </div>
              <div className={styles.ownerSupport}>
                <span aria-hidden="true"><I.crown size={20} /></span>
                <strong>Business planı için destek</strong>
                <p>Mevcut planınızı yeniden etkinleştirmek veya kapsamını değiştirmek için faturalama alanından destek sürecini başlatın.</p>
              </div>
              <Link className={styles.primaryAction} href={`/dashboard/${restaurantId}/settings?section=billing`}>
                Faturalamaya git<I.arrow size={17} />
              </Link>
            </div>
          ) : (
            <div className={styles.memberMessage}>
              <span className={styles.memberIcon} aria-hidden="true"><I.shield size={23} /></span>
              <span className={styles.memberKicker}>İşletme sahibi işlemi</span>
              <h2>Yükseltme yetkiniz bulunmuyor</h2>
              <p>Plan ve ödeme bilgilerini yalnız işletme sahibi değiştirebilir. Bu özelliği kullanmak için işletme sahibinizden {requiredLabel} veya üzeri pakete geçmesini isteyin.</p>
              <div><I.lock size={14} />Verileriniz bu sırada korunmaya devam eder.</div>
            </div>
          )}
      </PlanLockCard>
    </main>
  )
}
