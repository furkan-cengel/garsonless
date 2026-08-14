import Link from 'next/link'
import {
  getFeatureEntitlement,
  PLAN_DEFINITIONS,
  type BillableFeature,
} from '@garsonless/domain/entitlements'

const BENEFITS: Partial<Record<BillableFeature, string[]>> = {
  analytics_basic: ['Satış, ürün, masa ve ödeme raporları', 'Operasyonunuzu tek bakışta izleyen pano'],
  staff_orders: ['Personelin manuel sipariş girişi', 'Canlı sipariş akışı, adisyon ve tahsilat'],
  table_management: ['Masa bazlı QR kodları', 'Canlı masalar ve hesap takibi'],
  customer_accounts: ['Müşteri hesapları ve CRM', 'Sadakat, segment ve kampanya araçları'],
  qr_menu: ['Yayınlanan sınırsız dijital menü', 'Zengin ürün içeriği ve QR erişimi'],
  theme_editor: ['Logo, renk ve tipografi', 'Kart ve navigasyon düzenleri'],
}

export default function PlanLockedPanel({ restaurantId, currentPlan, feature, isOwner }: {
  restaurantId: string
  currentPlan: unknown
  feature: BillableFeature
  isOwner: boolean
}) {
  const entitlement = getFeatureEntitlement(currentPlan, feature)
  const required = entitlement.requiredPlan
  const currentPlanAlreadyIncludesFeature = entitlement.allowed
  const requiredLabel = required ? PLAN_DEFINITIONS[required].label : 'uygun'
  const title = currentPlanAlreadyIncludesFeature
    ? 'Erişiminiz geçici olarak kilitli'
    : `${requiredLabel} paketinde açılır`
  const description = currentPlanAlreadyIncludesFeature
    ? 'Deneme veya abonelik süreniz sona ermiş olabilir. Verileriniz korunuyor; yeniden etkinleştirdiğinizde kaldığınız yerden devam edersiniz.'
    : `Bu bölüm ${requiredLabel} veya üzeri paketlerde kullanılabilir. Mevcut verileriniz ve diğer bölümleriniz etkilenmez.`

  return (
    <main style={{ minHeight: 'calc(100vh - 80px)', display: 'grid', placeItems: 'center', padding: 32, background: 'var(--bg)' }}>
      <section aria-labelledby="plan-lock-title" style={{ width: 'min(620px, 100%)', padding: '36px 34px', border: '1px solid var(--border)', borderRadius: 18, background: 'var(--surface)', boxShadow: 'var(--shadow-2)', textAlign: 'center' }}>
        <span aria-hidden="true" style={{ width: 48, height: 48, margin: '0 auto 18px', borderRadius: 14, display: 'grid', placeItems: 'center', background: 'var(--surface-3)', fontSize: 22 }}>🔒</span>
        <div style={{ color: 'var(--text-3)', fontSize: 11, fontWeight: 750, letterSpacing: '.08em', textTransform: 'uppercase' }}>Paket özelliği</div>
        <h1 id="plan-lock-title" style={{ margin: '9px 0 0', fontSize: 27, letterSpacing: '-.025em' }}>{title}</h1>
        <p style={{ margin: '12px auto 0', maxWidth: 500, color: 'var(--text-2)', fontSize: 14, lineHeight: 1.6 }}>{description}</p>
        <ul style={{ width: 'fit-content', maxWidth: '100%', margin: '22px auto 0', padding: 0, display: 'grid', gap: 8, listStyle: 'none', textAlign: 'left' }}>
          {(BENEFITS[feature] ?? ['Bu bölümün tüm araçları', 'Server-side güvenli erişim']).map((benefit) => (
            <li key={benefit} style={{ display: 'flex', gap: 8, color: 'var(--text-2)', fontSize: 13 }}><span style={{ color: 'var(--positive)' }}>✓</span>{benefit}</li>
          ))}
        </ul>
        {isOwner ? (
          <Link href={`/dashboard/${restaurantId}/settings?section=billing`} style={{ display: 'inline-flex', marginTop: 26, padding: '12px 20px', borderRadius: 999, background: 'var(--action)', color: 'var(--on-action)', textDecoration: 'none', fontSize: 13.5, fontWeight: 700 }}>
            Paketleri incele
          </Link>
        ) : (
          <p style={{ margin: '24px 0 0', color: 'var(--text-3)', fontSize: 12.5 }}>Yükseltme için işletme sahibiyle iletişime geçin.</p>
        )}
      </section>
    </main>
  )
}
