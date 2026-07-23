import { readPlatformImpersonationSession } from '@garsonless/application/platform-admin-impersonation'
import { readPlatformTenant } from '@garsonless/application/platform-admin-tenants'
import {
  createPlatformAdminImpersonationPort,
  createPlatformAdminTenantReadPort,
} from '@garsonless/db/server'
import Link from 'next/link'
import { PlatformShell } from '../../../../PlatformShell'
import { endTenantImpersonation } from '../../../../actions'
import { requirePlatformAdminActor } from '../../../../../lib/platform-admin-auth'
import { formatDate, platformRoleLabel, PLAN_LABELS } from '../../../../../lib/tenant-presentation'

export const dynamic = 'force-dynamic'

export default async function ReadOnlyTenantView({
  params,
}: {
  params: Promise<{ tenantId: string; sessionId: string }>
}) {
  const actor = await requirePlatformAdminActor()
  const { tenantId, sessionId } = await params
  const sessionResult = await readPlatformImpersonationSession(
    actor,
    sessionId,
    createPlatformAdminImpersonationPort(),
  )
  const session = sessionResult.ok ? sessionResult.value : null
  const isActive = session?.status === 'active' && session.restaurantId === tenantId
  const tenantResult = isActive
    ? await readPlatformTenant(actor, tenantId, createPlatformAdminTenantReadPort())
    : null
  const tenant = tenantResult?.ok ? tenantResult.value : null

  return (
    <PlatformShell actor={actor}>
      <section className="directory support-view-shell">
        <Link className="back-link" href={`/tenants/${encodeURIComponent(tenantId)}`}>← İşletme detayına dön</Link>
        {!isActive || !tenant ? (
          <section className="state-card" role="alert">
            <span className="state-icon">!</span>
            <div>
              <h2>Salt-okunur oturum kullanılamıyor</h2>
              <p>Oturum sona ermiş, süresi dolmuş, başka bir işletmeye ait veya güvenli işletme özeti yüklenememiş olabilir.</p>
            </div>
          </section>
        ) : (
          <>
            <div className="support-view-banner" role="status">
              <div><span className="support-view-lock" aria-hidden="true">◉</span><div><strong>Salt-okunur destek görünümü</strong><p>Bu işletmenin üyesi değilsiniz. Bu ekrandan hiçbir veri değiştirilemez.</p></div></div>
              <div className="support-view-expiry"><span>Sona erme</span><strong>{formatDate(session.expiresAt)}</strong></div>
            </div>

            <div className="page-heading detail-heading">
              <div><p className="eyebrow">İşletme perspektifi · /{tenant.slug}</p><h1>{tenant.name}</h1><p className="lead">Destek incelemesi için kişisel veri içermeyen, sınırlı ve denetimli operasyon özeti.</p></div>
              <span className="read-only">Yazma kapalı</span>
            </div>

            <div className="metric-grid support-view-metrics">
              <article className="metric"><span>Paket</span><strong>{PLAN_LABELS[tenant.plan]}</strong><small>İşletmenin paketi</small></article>
              <article className="metric"><span>Aktif sipariş</span><strong>{tenant.usage.activeOrders}</strong><small>Son sipariş {formatDate(tenant.activity.lastOrderAt)}</small></article>
              <article className="metric"><span>Masalar</span><strong>{tenant.usage.tables}</strong><small>Operasyonel masa sayısı</small></article>
              <article className="metric"><span>Menü ürünleri</span><strong>{tenant.usage.menuItems}</strong><small>Güvenli toplam</small></article>
              <article className="metric"><span>Açık talepler</span><strong>{tenant.usage.openServiceRequests}</strong><small>Servis çağrıları</small></article>
            </div>

            <div className="detail-grid">
              <article className="panel">
                <div className="panel-heading"><div><p className="eyebrow">Oturum kapsamı</p><h2>Denetim bilgisi</h2></div></div>
                <dl className="definition-list"><div><dt>Başlangıç</dt><dd>{formatDate(session.startedAt)}</dd></div><div><dt>Bitiş</dt><dd>{formatDate(session.expiresAt)}</dd></div><div><dt>Rol</dt><dd>{platformRoleLabel(session.actorRole)}</dd></div><div><dt>Gerekçe</dt><dd>{session.reason}</dd></div></dl>
              </article>
              <article className="panel">
                <div className="panel-heading"><div><p className="eyebrow">Güvenlik</p><h2>Bu görünümde kapalı</h2></div></div>
                <ul className="support-view-denials"><li>Sipariş ve ödeme durumunu değiştirme</li><li>Menü, masa, ekip ve tema düzenleme</li><li>Kişisel veri veya ödeme sağlayıcı bilgilerini görüntüleme</li><li>İşletme rolü ya da üyeliği edinme</li></ul>
              </article>
            </div>

            <article className="panel lifecycle-panel">
              <div className="panel-heading"><div><p className="eyebrow">Oturum kontrolü</p><h2>İncelemeyi erken bitir</h2></div></div>
              <form action={endTenantImpersonation} className="lifecycle-form">
                <input name="restaurantId" type="hidden" value={tenantId} />
                <input name="sessionId" type="hidden" value={sessionId} />
                <label className="reason-field"><span>Kapanış gerekçesi</span><textarea maxLength={1000} minLength={10} name="reason" placeholder="İnceleme sonucunu en az 10 karakterle yazın…" required /></label>
                <div className="lifecycle-actions"><button className="button danger-button" type="submit">Oturumu sonlandır</button></div>
              </form>
            </article>
          </>
        )}
      </section>
    </PlatformShell>
  )
}
