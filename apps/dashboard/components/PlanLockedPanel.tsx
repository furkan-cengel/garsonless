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
import type { Icon } from '../lib/ui'
import { I } from '../lib/ui'
import { getUserRestaurantAccess } from '../lib/auth/access'
import styles from './PlanLockedPanel.module.css'

type FeaturePresentation = {
  label: string
  icon: Icon
  benefits: readonly string[]
}

const FEATURE_PRESENTATIONS: Partial<Record<BillableFeature, FeaturePresentation>> = {
  analytics_basic: {
    label: 'Raporlar',
    icon: I.chart,
    benefits: [
      'Satış, ürün, masa ve ödeme raporları',
      'Operasyonu tek bakışta izleyen canlı pano',
      'Saatlik ve dönemsel performans kırılımları',
      'Karar vermeyi hızlandıran karşılaştırmalar',
    ],
  },
  staff_orders: {
    label: 'Siparişler',
    icon: I.clipboard,
    benefits: [
      'Personelin manuel sipariş girişi',
      'Canlı sipariş, adisyon ve tahsilat akışı',
      'Hazırlanıyor ve teslim edildi durumları',
      'Ekip genelinde tek operasyon görünümü',
    ],
  },
  table_management: {
    label: 'Canlı Masalar',
    icon: I.chair,
    benefits: [
      'Canlı masa ve hesap takibi',
      'Masa taşıma ve hesap birleştirme araçları',
      'Salon düzenini tek ekrandan yönetme',
      'Adisyon ve tahsilat operasyonu',
    ],
  },
  customer_accounts: {
    label: 'Müşteriler',
    icon: I.users,
    benefits: [
      'Müşteri hesapları ve CRM görünümü',
      'Sadakat, segment ve kampanya araçları',
      'İzinli iletişim tercihleri',
      'Müşteri davranışına göre hedefleme',
    ],
  },
  qr_menu: {
    label: 'Dijital menü',
    icon: I.qr,
    benefits: [
      'Yayınlanan sınırsız dijital menü',
      'Zengin ürün içeriği ve QR erişimi',
      'Kategori ve ürünleri anında güncelleme',
      'Tüm cihazlara uyumlu misafir deneyimi',
    ],
  },
  theme_editor: {
    label: 'Tema editörü',
    icon: I.palette,
    benefits: [
      'Logo, renk ve tipografi ayarları',
      'Kart ve navigasyon düzenleri',
      'Canlı mobil ve masaüstü önizleme',
      'Markanıza uygun menü görünümü',
    ],
  },
}

const FALLBACK_PRESENTATION: FeaturePresentation = {
  label: 'Paket özelliği',
  icon: I.sparkles,
  benefits: [
    'Bu bölümün tüm operasyon araçları',
    'İşletme verilerinizi koruyan güvenli erişim',
    'Plan etkinleştiğinde kesintisiz devam',
    'Dashboard içinden merkezi yönetim',
  ],
}

function formatMoney(amountMinor: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
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

function selectablePlans(
  currentPlan: ReturnType<typeof normalizeRestaurantPlan>,
  feature: BillableFeature,
  currentPlanAlreadyIncludesFeature: boolean,
): SelfServePlan[] {
  if (currentPlan === 'business') return []
  const currentIndex = SELF_SERVE_PLANS.indexOf(currentPlan as SelfServePlan)
  const firstUnlockingIndex = SELF_SERVE_PLANS.findIndex((plan) => planUnlocksFeature(plan, feature))
  const minimumIndex = currentPlanAlreadyIncludesFeature
    ? Math.max(0, currentIndex)
    : Math.max(0, firstUnlockingIndex)
  return SELF_SERVE_PLANS.filter((plan, index) => index >= minimumIndex && planUnlocksFeature(plan, feature))
}

function PlanPreview() {
  return (
    <div className={styles.preview} aria-hidden="true">
      <div className={styles.previewHeader}><span /><span /></div>
      <div className={styles.previewStats}>
        {[42, 68, 54, 76].map((width) => (
          <div key={width} className={styles.previewStat}>
            <span /><strong style={{ width: `${width}%` }} /><i />
          </div>
        ))}
      </div>
      <div className={styles.previewGrid}>
        <div className={styles.previewChart}>
          <span />
          <div>
            {[38, 57, 48, 72, 64, 82, 70, 92, 78, 61].map((height) => (
              <i key={height} style={{ height: `${height}%` }} />
            ))}
          </div>
        </div>
        <div className={styles.previewList}>
          <span />
          {[72, 88, 63, 81, 55].map((width) => <i key={width} style={{ width: `${width}%` }} />)}
        </div>
      </div>
    </div>
  )
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
  const presentation = FEATURE_PRESENTATIONS[feature] ?? FALLBACK_PRESENTATION
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
  const FeatureIcon = presentation.icon
  const title = scheduledUnlockPlan
    ? `${presentation.label} dönem sonunda açılacak`
    : subscription?.status === 'refund_cancel_pending'
    ? 'Aboneliğiniz iptal ediliyor'
    : entitlement.allowed
    ? 'Erişiminiz geçici olarak kilitli'
    : `${presentation.label} ${requiredLabel} ile açılır`
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
      <PlanPreview />
      <div className={styles.scrim} aria-hidden="true" />
      <section className={styles.card} aria-labelledby="plan-lock-title">
        <div className={styles.valuePanel}>
          <Link className={styles.returnLink} href={safeReturnHref}>
            <I.chevLeft size={15} />
            {returnLabel}
          </Link>

          <div className={styles.iconWrap} aria-hidden="true">
            <span className={styles.iconHalo} />
            <span className={styles.iconTile}><I.lock size={25} /></span>
          </div>

          <div className={styles.eyebrowRow}>
            <span className={styles.featureBadge}><FeatureIcon size={13} />{presentation.label}</span>
            <span className={styles.planEyebrow}>{requiredLabel.toLocaleUpperCase('tr-TR')} ÖZELLİĞİ</span>
          </div>

          <h1 id="plan-lock-title" className={styles.title}>{title}</h1>
          <p className={styles.description}>{description}</p>

          <ul className={styles.benefitList}>
            {presentation.benefits.map((benefit) => (
              <li key={benefit}>
                <span aria-hidden="true"><I.check size={13} /></span>
                {benefit}
              </li>
            ))}
          </ul>

          <div className={styles.assurances} aria-label="Abonelik güvenceleri">
            <span><I.zap size={14} />{scheduledUnlockPlan || existingSubscriptionChangesAtPeriodEnd ? 'Dönem sonunda etkinleşir' : 'Ödeme onayıyla etkinleşir'}</span>
            <span><I.shield size={14} />Verileriniz korunur</span>
            <span><I.clock size={14} />İstediğiniz an iptal</span>
          </div>
        </div>

        <aside className={styles.purchasePanel} aria-label="Plan yükseltme">
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
          ) : plans.length > 0 ? (
            <form className={styles.purchaseForm} action={`/dashboard/${restaurantId}/settings`} method="get">
              <input type="hidden" name="section" value="billing" />
              <div className={styles.purchaseHeader}>
                <div>
                  <strong>Yükseltin ve kilidi açın</strong>
                  <span>Ödeme Dashboard içinde tamamlanır.</span>
                </div>
                <div className={styles.intervalSwitch} role="group" aria-label="Fatura dönemi">
                  <label>
                    <input type="radio" name="interval" value="monthly" />
                    <span>Aylık</span>
                  </label>
                  <label>
                    <input type="radio" name="interval" value="annual" defaultChecked />
                    <span>Yıllık</span>
                  </label>
                </div>
              </div>

              <div className={styles.savingNote}><I.sparkles size={13} />Yıllık ödemede katalog indirimi uygulanır</div>

              <div className={styles.planList} role="radiogroup" aria-label="Hedef paket">
                {plans.map((plan) => {
                  const monthlyPrice = planPrices[plan].monthly
                  const annualPrice = planPrices[plan].annual
                  const annualMonthlyPrice = Math.round(annualPrice / 12)
                  return (
                    <label key={plan} className={styles.planOption}>
                      <input type="radio" name="plan" value={plan} defaultChecked={plan === recommendedPlan} />
                      <span className={styles.radioMark} aria-hidden="true" />
                      <span className={styles.planCopy}>
                        <span className={styles.planName}>
                          {PLAN_DEFINITIONS[plan].label}
                          {plan === recommendedPlan && <small><I.crown size={11} />Önerilen</small>}
                        </span>
                        <span>{PLAN_DEFINITIONS[plan].description}</span>
                      </span>
                      <span className={styles.planPrice}>
                        <span className={styles.monthlyPrice}>
                          <strong>{formatMoney(monthlyPrice)}</strong>
                          <small>/ay + KDV</small>
                        </span>
                        <span className={styles.annualPrice}>
                          <strong>{formatMoney(annualMonthlyPrice)}</strong>
                          <small>/ay + KDV</small>
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>

              <div className={styles.unlockNote}><I.check size={13} />{presentation.label} seçilen paketle açılır.</div>

              <button className={styles.primaryAction} type="submit" disabled={!checkoutConfigured}>
                {checkoutConfigured ? 'Seçili paketle devam et' : 'Ödeme yapılandırılıyor'}
                {checkoutConfigured && <I.arrow size={17} />}
              </button>
              <p className={styles.billingCaption}>Seçilen dönem, net tutar ve KDV ödeme öncesinde yeniden gösterilir.</p>
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
        </aside>
      </section>
    </main>
  )
}
