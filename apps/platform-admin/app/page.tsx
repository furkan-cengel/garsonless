import { listPlatformTenants } from '@garsonless/application/platform-admin-tenants'
import { createPlatformAdminTenantReadPort } from '@garsonless/db/server'
import { SUBSCRIPTION_STATUSES } from '@garsonless/domain/billing'
import { RESTAURANT_PLANS } from '@garsonless/domain/entitlements'
import Link from 'next/link'
import { requirePlatformAdminActor } from '../lib/platform-admin-auth'
import {
  formatDate,
  formatMoney,
  parseTenantSearchParams,
  PLAN_LABELS,
  queryHref,
  SUBSCRIPTION_LABELS,
  subscriptionTone,
} from '../lib/tenant-presentation'
import { PlatformShell } from './PlatformShell'

export const dynamic = 'force-dynamic'

export default async function PlatformHome({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const actor = await requirePlatformAdminActor()
  const filters = parseTenantSearchParams(await searchParams)
  const result = await listPlatformTenants(actor, filters, createPlatformAdminTenantReadPort())

  return (
    <PlatformShell actor={actor}>
      <section className="directory">
        <div className="page-heading">
          <div><p className="eyebrow">İşletme operasyonları</p><h1>İşletmeler</h1><p className="lead">masabu’daki işletmelerin abonelik ve operasyon sağlığını güvenli bir özetten inceleyin.</p></div>
          <span className="read-only">Salt okunur</span>
        </div>

        <form className="filters" method="get">
          <label className="search-field"><span>İşletme ara</span><input defaultValue={filters.search ?? ''} name="q" placeholder="İsim veya kısa ad" /></label>
          <label><span>Plan</span><select defaultValue={filters.plan ?? ''} name="plan"><option value="">Tüm planlar</option>{RESTAURANT_PLANS.map((plan) => <option key={plan} value={plan}>{PLAN_LABELS[plan]}</option>)}</select></label>
          <label><span>Abonelik</span><select defaultValue={filters.subscriptionStatus ?? ''} name="status"><option value="">Tüm durumlar</option><option value="none">Abonelik yok</option>{SUBSCRIPTION_STATUSES.map((status) => <option key={status} value={status}>{SUBSCRIPTION_LABELS[status]}</option>)}</select></label>
          <label><span>Kayıt durumu</span><select defaultValue={filters.lifecycle ?? 'active'} name="lifecycle"><option value="active">Aktif işletmeler</option><option value="deleted">Silinmiş işletmeler</option><option value="all">Tümü</option></select></label>
          <input name="pageSize" type="hidden" value={filters.pageSize ?? 25} />
          <button className="button primary filter-button" type="submit">Filtrele</button>
        </form>

        {!result.ok ? (
          <section className="state-card" role="alert"><span className="state-icon">!</span><div><h2>İşletme dizini yüklenemedi</h2><p>Güvenli veri görünümü şu anda kullanılamıyor. Biraz sonra tekrar deneyin.</p></div></section>
        ) : result.value.items.length === 0 ? (
          <section className="state-card"><span className="state-icon">0</span><div><h2>Eşleşen işletme yok</h2><p>Arama veya filtreleri değiştirerek tekrar deneyin.</p></div></section>
        ) : (
          <>
            <div className="directory-summary"><strong>{result.value.totalCount}</strong> işletme bulundu <span>· Sayfa {result.value.page}</span></div>
            <div className="tenant-list">
              {result.value.items.map((tenant) => {
                const status = tenant.subscription?.status ?? null
                return (
                  <Link className="tenant-row" href={`/tenants/${tenant.id}`} key={tenant.id}>
                    <div className="tenant-identity"><span className="tenant-avatar">{tenant.name.slice(0, 1).toLocaleUpperCase('tr-TR')}</span><div><h2>{tenant.name}</h2><p>/{tenant.slug} · {tenant.timezone}</p></div></div>
                    <div className="tenant-cell"><span className="cell-label">Plan</span><strong>{PLAN_LABELS[tenant.plan]}</strong></div>
                    <div className="tenant-cell"><span className="cell-label">Abonelik</span><span className="status" data-tone={subscriptionTone(status)}>{status ? SUBSCRIPTION_LABELS[status] : 'Abonelik yok'}</span></div>
                    <div className="tenant-cell"><span className="cell-label">Kullanım</span><strong>{tenant.usage.tables} masa · {tenant.usage.menuItems} ürün</strong><small>{tenant.usage.activeOrders} aktif sipariş</small></div>
                    <div className="tenant-cell"><span className="cell-label">Son fatura</span><strong>{tenant.latestInvoice ? formatMoney(tenant.latestInvoice.amountDueMinor) : '-'}</strong><small>{tenant.latestInvoice ? formatDate(tenant.latestInvoice.createdAt) : 'Fatura yok'}</small></div>
                    <div className="attention-cell">{tenant.attention.reconciliationCount > 0 && <span className="attention">{tenant.attention.reconciliationCount} inceleme</span>}<span aria-hidden="true">→</span></div>
                  </Link>
                )
              })}
            </div>
            <nav aria-label="Sayfalar" className="pagination">
              {result.value.page > 1 ? <Link className="button" href={queryHref(filters, result.value.page - 1)}>← Önceki</Link> : <span />}
              {result.value.page * result.value.pageSize < result.value.totalCount && <Link className="button" href={queryHref(filters, result.value.page + 1)}>Sonraki →</Link>}
            </nav>
          </>
        )}
      </section>
    </PlatformShell>
  )
}
