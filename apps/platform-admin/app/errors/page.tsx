import { readPlatformErrorOverview } from '@garsonless/application/platform-admin-errors'
import { createPlatformErrorReadPort } from '@garsonless/db/server'
import {
  PLATFORM_ERROR_APPS,
  PLATFORM_ERROR_SEVERITIES,
  PLATFORM_ERROR_WINDOWS,
} from '@garsonless/domain/platform-observability'
import Link from 'next/link'
import { requirePlatformAdminActor } from '../../lib/platform-admin-auth'
import {
  ERROR_APP_LABELS,
  ERROR_SEVERITY_LABELS,
  ERROR_WINDOW_LABELS,
  parsePlatformErrorSearchParams,
  platformErrorSourceLabel,
} from '../../lib/platform-error-presentation'
import { formatDate } from '../../lib/tenant-presentation'
import { PlatformShell } from '../PlatformShell'

export const dynamic = 'force-dynamic'

export default async function PlatformErrorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const actor = await requirePlatformAdminActor()
  const filters = parsePlatformErrorSearchParams(await searchParams)
  const result = await readPlatformErrorOverview(actor, filters, createPlatformErrorReadPort())

  return (
    <PlatformShell actor={actor}>
      <section className="directory error-center">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Platform gözlemlenebilirliği</p>
            <h1>Hata merkezi</h1>
            <p className="lead">
              Tenantlar arası sorunları güvenli hata kodu ve parmak iziyle izleyin.
              Ham hata metni, payload, stack ve müşteri PII bilgileri gösterilmez.
            </p>
          </div>
          <span className="read-only">Salt okunur</span>
        </div>

        <form className="filters error-filters" method="get">
          <label>
            <span>Zaman aralığı</span>
            <select defaultValue={filters.window ?? '24h'} name="window">
              {PLATFORM_ERROR_WINDOWS.map((window) => (
                <option key={window} value={window}>{ERROR_WINDOW_LABELS[window]}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Uygulama</span>
            <select defaultValue={filters.app ?? 'all'} name="app">
              <option value="all">Tüm uygulamalar</option>
              {PLATFORM_ERROR_APPS.map((app) => (
                <option key={app} value={app}>{ERROR_APP_LABELS[app]}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Seviye</span>
            <select defaultValue={filters.severity ?? 'all'} name="severity">
              <option value="all">Tüm seviyeler</option>
              {PLATFORM_ERROR_SEVERITIES.map((severity) => (
                <option key={severity} value={severity}>{ERROR_SEVERITY_LABELS[severity]}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Sonuç sınırı</span>
            <select defaultValue={filters.limit ?? 50} name="limit">
              {[25, 50, 100].map((limit) => <option key={limit} value={limit}>{limit}</option>)}
            </select>
          </label>
          <button className="button primary filter-button" type="submit">Uygula</button>
        </form>

        {!result.ok ? (
          <section className="state-card" role="alert">
            <span className="state-icon">!</span>
            <div>
              <h2>Hata özeti yüklenemedi</h2>
              <p>Güvenli gözlem görünümü şu anda kullanılamıyor. Biraz sonra tekrar deneyin.</p>
            </div>
          </section>
        ) : (
          <>
            <div className="error-metrics" aria-label="Hata özeti">
              <article className="metric"><span>Olay</span><strong>{result.value.eventCount}</strong><small>Seçili zaman aralığında</small></article>
              <article className="metric"><span>Parmak izi</span><strong>{result.value.fingerprintCount}</strong><small>Tekilleştirilmiş sorun</small></article>
              <article className="metric" data-tone={result.value.criticalFingerprintCount ? 'danger' : 'neutral'}><span>Kritik</span><strong>{result.value.criticalFingerprintCount}</strong><small>Kritik parmak izi</small></article>
              <article className="metric"><span>Etkilenen işletme</span><strong>{result.value.affectedTenantCount}</strong><small>Tekil tenant</small></article>
            </div>

            {result.value.items.length === 0 ? (
              <section className="state-card error-empty">
                <span className="state-icon">✓</span>
                <div>
                  <h2>Bu aralıkta kayıtlı sorun yok</h2>
                  <p>Filtrelerle eşleşen güvenli hata olayı bulunamadı.</p>
                </div>
              </section>
            ) : (
              <div className="error-list">
                {result.value.items.map((item) => (
                  <article className="error-row" data-severity={item.severity} key={item.fingerprint}>
                    <span className="error-severity-mark" aria-hidden="true" />
                    <div className="error-main">
                      <div className="error-title">
                        <span className="status" data-tone={item.severity === 'warning' ? 'warning' : 'danger'}>
                          {ERROR_SEVERITY_LABELS[item.severity]}
                        </span>
                        <strong>{platformErrorSourceLabel(item.source)}</strong>
                      </div>
                      <div className="error-meta">
                        <span>{ERROR_APP_LABELS[item.app]}</span>
                        <code>{item.publicCode}</code>
                        <span title={item.fingerprint}>#{item.fingerprint.slice(0, 8)}</span>
                      </div>
                    </div>
                    <div className="error-stat"><span>Tekrar</span><strong>{item.occurrenceCount}</strong></div>
                    <div className="error-stat"><span>Tenant</span><strong>{item.affectedTenantCount}</strong></div>
                    <div className="error-time"><span>Son görülme</span><strong>{formatDate(item.lastSeenAt)}</strong><small>İlk: {formatDate(item.firstSeenAt)}</small></div>
                    <div className="error-tenant">
                      {item.sampleTenant ? (
                        <Link href={`/tenants/${item.sampleTenant.id}`}>{item.sampleTenant.name} →</Link>
                      ) : <span>Global olay</span>}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </PlatformShell>
  )
}
