import { readPlatformTenant, type PlatformTenantDetail } from '@garsonless/application/platform-admin-tenants'
import {
  readPlatformTenantServiceControl,
  type PlatformTenantServiceControl,
} from '@garsonless/application/platform-admin-tenant-operations'
import {
  createPlatformAdminTenantOperationsPort,
  createPlatformAdminTenantReadPort,
} from '@garsonless/db/server'
import { platformAdminCan, type PlatformAdminActorContext } from '@garsonless/domain/platform-admin'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PlatformShell } from '../../PlatformShell'
import { changeTenantServiceStatus } from '../../actions'
import { requirePlatformAdminActor } from '../../../lib/platform-admin-auth'
import {
  formatDate,
  formatMoney,
  PLAN_LABELS,
  SUBSCRIPTION_LABELS,
  subscriptionTone,
} from '../../../lib/tenant-presentation'

export const dynamic = 'force-dynamic'

export default async function TenantDetail({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>
  searchParams: Promise<{ operation?: string }>
}) {
  const actor = await requirePlatformAdminActor()
  const { tenantId } = await params
  const [result, controlResult] = await Promise.all([
    readPlatformTenant(actor, tenantId, createPlatformAdminTenantReadPort()),
    readPlatformTenantServiceControl(actor, tenantId, createPlatformAdminTenantOperationsPort()),
  ])
  const operation = (await searchParams).operation ?? null
  if (result.ok && !result.value) notFound()

  return (
    <PlatformShell actor={actor}>
      {!result.ok ? (
        <section className="directory"><Link className="back-link" href="/">← İşletmelere dön</Link><section className="state-card" role="alert"><span className="state-icon">!</span><div><h2>İşletme özeti yüklenemedi</h2><p>Kimlik doğrulandı ancak güvenli tenant görünümü şu anda kullanılamıyor.</p></div></section></section>
      ) : result.value ? <TenantOverview
        actor={actor}
        control={controlResult.ok ? controlResult.value : null}
        operation={operation}
        tenant={result.value}
      /> : null}
    </PlatformShell>
  )
}

const SERVICE_STATUS_LABELS = {
  active: 'Sipariş alımı açık',
  suspended: 'Sipariş alımı askıda',
  manual_hold: 'Manuel incelemede',
} as const

function TenantOverview({
  actor,
  control,
  operation,
  tenant,
}: {
  actor: PlatformAdminActorContext
  control: PlatformTenantServiceControl | null
  operation: string | null
  tenant: PlatformTenantDetail
}) {
  const status = tenant.subscription?.status ?? null
  const canManageLifecycle = platformAdminCan(actor, 'tenant.lifecycle.manage')
  const operationNotice = operation === 'updated'
    ? 'İşletmenin servis durumu güncellendi ve denetim kaydı oluşturuldu.'
    : operation === 'unchanged'
      ? 'İstenen servis durumu zaten etkindi; denetim kaydı oluşturuldu.'
      : operation === 'forbidden'
        ? 'Bu işlem için ops veya superadmin yetkisi gerekir.'
        : operation === 'failed'
          ? 'Servis durumu değiştirilemedi. İşlem güvenli biçimde durduruldu.'
          : null
  return (
    <section className="directory">
      <Link className="back-link" href="/">← İşletmelere dön</Link>
      <div className="page-heading detail-heading"><div><p className="eyebrow">İşletme özeti · /{tenant.slug}</p><h1>{tenant.name}</h1><p className="lead">PII ve provider ayrıntıları içermeyen platform sağlık ve erişim görünümü.</p></div><span className="read-only">Denetimli erişim</span></div>

      {operationNotice ? <div className="operation-notice" data-tone={operation === 'failed' || operation === 'forbidden' ? 'danger' : 'success'} role="status">{operationNotice}</div> : null}

      <div className="metric-grid">
        <article className="metric"><span>Plan</span><strong>{PLAN_LABELS[tenant.plan]}</strong><small>Tenant projection</small></article>
        <article className="metric"><span>Abonelik</span><strong><span className="status" data-tone={subscriptionTone(status)}>{status ? SUBSCRIPTION_LABELS[status] : 'Abonelik yok'}</span></strong><small>Dönem sonu {formatDate(tenant.subscription?.currentPeriodEnd ?? null)}</small></article>
        <article className="metric"><span>Aktif sipariş</span><strong>{tenant.usage.activeOrders}</strong><small>Son sipariş {formatDate(tenant.activity.lastOrderAt)}</small></article>
        <article className="metric"><span>İnceleme</span><strong>{tenant.attention.reconciliationCount}</strong><small>Billing reconciliation</small></article>
        <article className="metric"><span>Servis erişimi</span><strong><span className="status" data-tone={control?.status === 'active' ? 'success' : 'danger'}>{control ? SERVICE_STATUS_LABELS[control.status] : 'Yüklenemedi'}</span></strong><small>Yeni müşteri ve personel siparişleri</small></article>
      </div>

      <div className="detail-grid">
        <article className="panel"><div className="panel-heading"><div><p className="eyebrow">Kullanım</p><h2>Operasyon özeti</h2></div></div><dl className="definition-list"><div><dt>Masalar</dt><dd>{tenant.usage.tables}</dd></div><div><dt>Menü ürünleri</dt><dd>{tenant.usage.menuItems}</dd></div><div><dt>Aktif ekip üyeleri</dt><dd>{tenant.usage.teamMembers}</dd></div><div><dt>Açık servis talepleri</dt><dd>{tenant.usage.openServiceRequests}</dd></div><div><dt>Oluşturulma</dt><dd>{formatDate(tenant.createdAt)}</dd></div><div><dt>Son güncelleme</dt><dd>{formatDate(tenant.updatedAt)}</dd></div></dl></article>
        <article className="panel"><div className="panel-heading"><div><p className="eyebrow">Faturalar</p><h2>Son 10 kayıt</h2></div></div>{tenant.invoices.length === 0 ? <p className="empty-inline">Henüz fatura kaydı yok.</p> : <div className="invoice-list">{tenant.invoices.map((invoice) => <div className="invoice-row" key={invoice.id}><div><strong>{formatMoney(invoice.amountDueMinor, invoice.currency)}</strong><small>{formatDate(invoice.createdAt)}</small></div><div className="invoice-right"><span className="status" data-tone={invoice.status === 'paid' ? 'success' : invoice.status === 'past_due' || invoice.status === 'uncollectible' ? 'danger' : 'neutral'}>{invoice.status}</span><small>Ödenen {formatMoney(invoice.amountPaidMinor, invoice.currency)}</small></div></div>)}</div>}</article>
      </div>

      <article className="panel lifecycle-panel">
        <div className="panel-heading"><div><p className="eyebrow">Operasyon kontrolü</p><h2>Yeni sipariş erişimi</h2></div></div>
        {!control ? <p className="empty-inline">Servis durumu güvenli biçimde yüklenemedi; hiçbir işlem açılamadı.</p> : !canManageLifecycle ? (
          <p className="empty-inline">Bu görünüm salt okunurdur. Servis erişimini yalnız ops veya superadmin değiştirebilir.</p>
        ) : (
          <form action={changeTenantServiceStatus} className="lifecycle-form">
            <input name="restaurantId" type="hidden" value={tenant.id} />
            <label className="reason-field">
              <span>İşlem gerekçesi</span>
              <textarea maxLength={1000} minLength={10} name="reason" placeholder="En az 10 karakterle operasyonel gerekçeyi yazın…" required />
              <small>Gerekçe, aktör, önceki/yeni durum ve request ID append-only denetim kaydına yazılır.</small>
            </label>
            <div className="lifecycle-actions">
              {control.status !== 'active' ? <button className="button primary" name="status" type="submit" value="active">Sipariş alımını aç</button> : null}
              {control.status !== 'manual_hold' ? <button className="button" name="status" type="submit" value="manual_hold">Manuel incelemeye al</button> : null}
              {control.status !== 'suspended' ? <button className="button danger-button" name="status" type="submit" value="suspended">Sipariş alımını askıya al</button> : null}
            </div>
          </form>
        )}
      </article>
    </section>
  )
}
