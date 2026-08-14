import { readPlatformTenant, type PlatformTenantDetail } from '@garsonless/application/platform-admin-tenants'
import {
  readPlatformTenantServiceControl,
  type PlatformTenantServiceControl,
} from '@garsonless/application/platform-admin-tenant-operations'
import {
  readPlatformTenantBillingTimeline,
  type PlatformTenantBillingTimeline,
} from '@garsonless/application/platform-admin-billing'
import {
  readPlatformTenantFeatureOverrides,
  type PlatformTenantFeatureOverride,
} from '@garsonless/application/platform-admin-entitlements'
import {
  readPlatformTenantPrivacyOperations,
  type PlatformPrivacyOperation,
} from '@garsonless/application/platform-admin-privacy'
import {
  createPlatformAdminTenantBillingReadPort,
  createPlatformAdminEntitlementPort,
  createPlatformAdminPrivacyPort,
  createPlatformAdminTenantOperationsPort,
  createPlatformAdminTenantReadPort,
} from '@garsonless/db/server'
import { platformAdminCan, type PlatformAdminActorContext } from '@garsonless/domain/platform-admin'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PlatformShell } from '../../PlatformShell'
import { changeTenantPlan, changeTenantServiceStatus, startTenantImpersonation } from '../../actions'
import { requirePlatformAdminActor } from '../../../lib/platform-admin-auth'
import {
  billingStatusLabel,
  formatDate,
  formatMoney,
  PLAN_LABELS,
  SUBSCRIPTION_LABELS,
  subscriptionTone,
} from '../../../lib/tenant-presentation'
import { TenantBillingTimelinePanel } from './TenantBillingTimeline'
import { TenantEntitlementOverrides } from './TenantEntitlementOverrides'
import { TenantPrivacyOperations } from './TenantPrivacyOperations'

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
  const canReadBilling = platformAdminCan(actor, 'billing.manage')
  const canManageData = platformAdminCan(actor, 'data.manage')
  const [result, controlResult, billingResult, entitlementResult, privacyResult] = await Promise.all([
    readPlatformTenant(actor, tenantId, createPlatformAdminTenantReadPort()),
    readPlatformTenantServiceControl(actor, tenantId, createPlatformAdminTenantOperationsPort()),
    canReadBilling
      ? readPlatformTenantBillingTimeline(actor, tenantId, createPlatformAdminTenantBillingReadPort())
      : Promise.resolve(null),
    readPlatformTenantFeatureOverrides(actor, tenantId, createPlatformAdminEntitlementPort()),
    canManageData
      ? readPlatformTenantPrivacyOperations(actor, tenantId, createPlatformAdminPrivacyPort())
      : Promise.resolve(null),
  ])
  const operation = (await searchParams).operation ?? null
  if (result.ok && !result.value) notFound()

  return (
    <PlatformShell actor={actor}>
      {!result.ok ? (
        <section className="directory"><Link className="back-link" href="/">← İşletmelere dön</Link><section className="state-card" role="alert"><span className="state-icon">!</span><div><h2>İşletme özeti yüklenemedi</h2><p>Kimlik doğrulandı ancak güvenli işletme görünümü şu anda kullanılamıyor.</p></div></section></section>
      ) : result.value ? <TenantOverview
        actor={actor}
        billingFailed={billingResult !== null && !billingResult.ok}
        billingTimeline={billingResult?.ok ? billingResult.value : null}
        control={controlResult.ok ? controlResult.value : null}
        entitlementFailed={!entitlementResult.ok}
        entitlements={entitlementResult.ok ? entitlementResult.value : []}
        operation={operation}
        privacyFailed={privacyResult !== null && !privacyResult.ok}
        privacyOperations={privacyResult?.ok ? privacyResult.value : []}
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
  billingFailed,
  billingTimeline,
  control,
  entitlementFailed,
  entitlements,
  operation,
  privacyFailed,
  privacyOperations,
  tenant,
}: {
  actor: PlatformAdminActorContext
  billingFailed: boolean
  billingTimeline: PlatformTenantBillingTimeline | null
  control: PlatformTenantServiceControl | null
  entitlementFailed: boolean
  entitlements: PlatformTenantFeatureOverride[]
  operation: string | null
  privacyFailed: boolean
  privacyOperations: PlatformPrivacyOperation[]
  tenant: PlatformTenantDetail
}) {
  const status = tenant.subscription?.status ?? null
  const canManageLifecycle = platformAdminCan(actor, 'tenant.lifecycle.manage')
  const canManagePlan = platformAdminCan(actor, 'catalog.manage')
  const canManageEntitlements = platformAdminCan(actor, 'entitlements.override')
  const canImpersonate = platformAdminCan(actor, 'impersonation.read')
  const canManageData = platformAdminCan(actor, 'data.manage')
  const hasLiveSubscription = tenant.subscription !== null && tenant.subscription.status !== 'cancelled'
  const baseOperationNotice = operation === 'updated'
    ? 'İşletmenin servis durumu güncellendi ve denetim kaydı oluşturuldu.'
    : operation === 'unchanged'
      ? 'İstenen servis durumu zaten etkindi; denetim kaydı oluşturuldu.'
      : operation === 'forbidden'
        ? 'Bu işlem için Operasyon veya Süper yönetici yetkisi gerekir.'
        : operation === 'failed'
          ? 'Servis durumu değiştirilemedi. İşlem güvenli biçimde durduruldu.'
          : operation === 'plan-updated'
            ? 'İşletmenin paketi güncellendi ve denetim kaydı oluşturuldu.'
            : operation === 'plan-unchanged'
              ? 'İstenen paket zaten etkindi; denetim kaydı oluşturuldu.'
              : operation === 'plan-forbidden'
                ? 'Paket değişikliği yalnız Süper yönetici yetkisiyle yapılabilir.'
                : operation === 'plan-billing-managed'
                  ? 'Bu işletmenin paketi canlı abonelik tarafından yönetiliyor. Ödeme sağlayıcı doğrulaması olmadan buradan paket değiştirilemez.'
                  : operation === 'plan-failed'
                    ? 'Paket değiştirilemedi. İşlem güvenli biçimde durduruldu.'
                    : operation === 'dunning-retry-scheduled'
                      ? 'Ödeme takibi şimdi yeniden sıraya alındı; ödeme sonucu değişmedi.'
                      : operation === 'dunning-deferred'
                        ? 'Ödeme takibi belirli bir süre ertelendi ve denetim kaydı oluşturuldu.'
                        : operation === 'dunning-duplicate'
                          ? 'Bu işlem daha önce kaydedilmişti; ikinci bir değişiklik yapılmadı.'
                          : operation === 'dunning-forbidden'
                            ? 'Ödeme takibi işlemi için Finans veya Süper yönetici yetkisi gerekir.'
                            : operation === 'dunning-busy'
                              ? 'Ödeme takibi şu anda arka planda işleniyor. Çakışmayı önlemek için işlem uygulanmadı.'
                              : operation === 'dunning-not-actionable'
                                ? 'Bu fatura artık işlem yapılabilir bir ödeme takibi durumunda değil.'
                                : operation === 'dunning-failed'
                                ? 'Ödeme takibi işlemi uygulanamadı. İşlem güvenli biçimde durduruldu.'
                                : operation === 'entitlement-updated'
                                  ? 'Geçici özellik izni kaydedildi ve denetim kaydı oluşturuldu.'
                                  : operation === 'entitlement-revoked'
                                    ? 'Geçici özellik izni erken sonlandırıldı; erişim yeniden pakete göre belirlenir.'
                                    : operation === 'entitlement-duplicate'
                                      ? 'Bu özellik izni işlemi daha önce kaydedilmişti; ikinci değişiklik yapılmadı.'
                                      : operation === 'entitlement-forbidden'
                                        ? 'Geçici özellik izni için Operasyon veya Süper yönetici yetkisi gerekir.'
                                        : operation === 'entitlement-failed'
                                          ? 'Geçici özellik izni değiştirilemedi. İşlem güvenli biçimde durduruldu.'
                                          : operation === 'impersonation-ended'
                                            ? 'Salt-okunur işletme görünümü sonlandırıldı ve denetim kaydı oluşturuldu.'
                                            : operation === 'impersonation-forbidden'
                                              ? 'Bu rol salt-okunur işletme görünümü başlatamaz.'
                                              : operation === 'impersonation-invalid' || operation === 'impersonation-failed' || operation === 'impersonation-end-failed'
                                                ? 'Salt-okunur görünüm oturumu açılamadı. İşlem güvenli biçimde durduruldu.'
          : null
  const operationNotice = baseOperationNotice
    ?? (operation === 'privacy-erased'
      ? 'İşletmenin müşteri kişisel veri bağları silindi; fatura ve anonimleştirilmiş operasyon kayıtları korundu.'
      : operation === 'privacy-erase-duplicate'
        ? 'Bu silme isteği daha önce tamamlanmıştı; ikinci bir değişiklik yapılmadı.'
        : operation === 'privacy-forbidden'
          ? 'KVKK veri işlemleri yalnız Süper yönetici yetkisiyle yapılabilir.'
          : operation === 'privacy-confirmation-invalid'
            ? 'Silme onay metni eşleşmedi; hiçbir veri değiştirilmedi.'
            : operation === 'privacy-erase-failed'
              ? 'KVKK silme işlemi tamamlanamadı; işlem güvenli biçimde durduruldu.'
              : null)
  return (
    <section className="directory">
      <Link className="back-link" href="/">← İşletmelere dön</Link>
      <div className="page-heading detail-heading"><div><p className="eyebrow">İşletme özeti · /{tenant.slug}</p><h1>{tenant.name}</h1><p className="lead">Kişisel veri ve ödeme sağlayıcı ayrıntıları içermeyen, güvenli işletme sağlık ve erişim özeti.</p></div><span className="read-only">Denetimli erişim</span></div>

      {operationNotice ? <div className="operation-notice" data-tone={operation === 'failed' || operation === 'forbidden' || operation === 'plan-failed' || operation === 'plan-forbidden' || operation === 'plan-billing-managed' || operation === 'dunning-failed' || operation === 'dunning-forbidden' || operation === 'dunning-busy' || operation === 'dunning-not-actionable' || operation === 'entitlement-failed' || operation === 'entitlement-forbidden' || operation === 'impersonation-forbidden' || operation === 'impersonation-invalid' || operation === 'impersonation-failed' || operation === 'impersonation-end-failed' || operation === 'privacy-forbidden' || operation === 'privacy-confirmation-invalid' || operation === 'privacy-erase-failed' ? 'danger' : 'success'} role="status">{operationNotice}</div> : null}

      <div className="metric-grid">
        <article className="metric"><span>Plan</span><strong>{PLAN_LABELS[tenant.plan]}</strong><small>İşletmenin paketi</small></article>
        <article className="metric"><span>Abonelik</span><strong><span className="status" data-tone={subscriptionTone(status)}>{status ? SUBSCRIPTION_LABELS[status] : 'Abonelik yok'}</span></strong><small>Dönem sonu {formatDate(tenant.subscription?.currentPeriodEnd ?? null)}</small></article>
        <article className="metric"><span>Aktif sipariş</span><strong>{tenant.usage.activeOrders}</strong><small>Son sipariş {formatDate(tenant.activity.lastOrderAt)}</small></article>
        <article className="metric"><span>İnceleme</span><strong>{tenant.attention.reconciliationCount}</strong><small>Bekleyen ödeme incelemesi</small></article>
        <article className="metric"><span>Servis erişimi</span><strong><span className="status" data-tone={control?.status === 'active' ? 'success' : 'danger'}>{control ? SERVICE_STATUS_LABELS[control.status] : 'Yüklenemedi'}</span></strong><small>Yeni müşteri ve personel siparişleri</small></article>
      </div>

      <div className="detail-grid">
        <article className="panel"><div className="panel-heading"><div><p className="eyebrow">Kullanım</p><h2>Operasyon özeti</h2></div></div><dl className="definition-list"><div><dt>Masalar</dt><dd>{tenant.usage.tables}</dd></div><div><dt>Menü ürünleri</dt><dd>{tenant.usage.menuItems}</dd></div><div><dt>Aktif ekip üyeleri</dt><dd>{tenant.usage.teamMembers}</dd></div><div><dt>Açık servis talepleri</dt><dd>{tenant.usage.openServiceRequests}</dd></div><div><dt>Oluşturulma</dt><dd>{formatDate(tenant.createdAt)}</dd></div><div><dt>Son güncelleme</dt><dd>{formatDate(tenant.updatedAt)}</dd></div></dl></article>
        <article className="panel"><div className="panel-heading"><div><p className="eyebrow">Faturalar</p><h2>Son 10 kayıt</h2></div></div>{tenant.invoices.length === 0 ? <p className="empty-inline">Henüz fatura kaydı yok.</p> : <div className="invoice-list">{tenant.invoices.map((invoice) => <div className="invoice-row" key={invoice.id}><div><strong>{formatMoney(invoice.amountDueMinor, invoice.currency)}</strong><small>{formatDate(invoice.createdAt)}</small></div><div className="invoice-right"><span className="status" data-tone={invoice.status === 'paid' ? 'success' : invoice.status === 'past_due' || invoice.status === 'uncollectible' ? 'danger' : 'neutral'}>{billingStatusLabel(invoice.status)}</span><small>Ödenen {formatMoney(invoice.amountPaidMinor, invoice.currency)}</small></div></div>)}</div>}</article>
      </div>

      {canImpersonate ? (
        <article className="panel lifecycle-panel support-view-panel">
          <div className="panel-heading"><div><p className="eyebrow">Destek görünümü</p><h2>İşletmeyi salt okunur incele</h2></div><span className="read-only">En fazla 60 dk</span></div>
          <div className="guarded-operation" role="note">
            <strong>İşletme rolü veya yazma yetkisi oluşturmaz</strong>
            <p>Bu oturum yalnızca kişisel veri içermeyen güvenli operasyon özetini açar. Menü, sipariş, ayar, ekip, ödeme veya işletme verisi değiştirilemez.</p>
          </div>
          <form action={startTenantImpersonation} className="lifecycle-form">
            <input name="restaurantId" type="hidden" value={tenant.id} />
            <label className="reason-field">
              <span>Oturum süresi</span>
              <select defaultValue="30" name="durationMinutes">
                <option value="15">15 dakika</option>
                <option value="30">30 dakika</option>
                <option value="60">60 dakika</option>
              </select>
            </label>
            <label className="reason-field">
              <span>Destek gerekçesi</span>
              <textarea maxLength={1000} minLength={10} name="reason" placeholder="Destek talebi veya inceleme gerekçesini en az 10 karakterle yazın…" required />
              <small>Başlangıç, bitiş, işlemi yapan kişi, işletme ve süre değiştirilemez denetim kaydına yazılır.</small>
            </label>
            <div className="lifecycle-actions"><button className="button primary" type="submit">Salt-okunur görünümü aç</button></div>
          </form>
        </article>
      ) : null}

      <article className="panel lifecycle-panel">
        <div className="panel-heading"><div><p className="eyebrow">Operasyon kontrolü</p><h2>Yeni sipariş erişimi</h2></div></div>
        {!control ? <p className="empty-inline">Servis durumu güvenli biçimde yüklenemedi; hiçbir işlem açılamadı.</p> : !canManageLifecycle ? (
          <p className="empty-inline">Bu görünüm salt okunurdur. Servis erişimini yalnız Operasyon veya Süper yönetici değiştirebilir.</p>
        ) : (
          <form action={changeTenantServiceStatus} className="lifecycle-form">
            <input name="restaurantId" type="hidden" value={tenant.id} />
            <label className="reason-field">
              <span>İşlem gerekçesi</span>
              <textarea maxLength={1000} minLength={10} name="reason" placeholder="En az 10 karakterle operasyonel gerekçeyi yazın…" required />
              <small>Gerekçe, işlemi yapan kişi, önceki/yeni durum ve işlem numarası değiştirilemez denetim kaydına yazılır.</small>
            </label>
            <div className="lifecycle-actions">
              {control.status !== 'active' ? <button className="button primary" name="status" type="submit" value="active">Sipariş alımını aç</button> : null}
              {control.status !== 'manual_hold' ? <button className="button" name="status" type="submit" value="manual_hold">Manuel incelemeye al</button> : null}
              {control.status !== 'suspended' ? <button className="button danger-button" name="status" type="submit" value="suspended">Sipariş alımını askıya al</button> : null}
            </div>
          </form>
        )}
      </article>

      <article className="panel lifecycle-panel">
        <div className="panel-heading"><div><p className="eyebrow">Paket kontrolü</p><h2>Paket ve özellik izinleri</h2></div></div>
        {!canManagePlan ? (
          <p className="empty-inline">Paket bilgisi salt okunurdur. Paketi yalnız Süper yönetici değiştirebilir.</p>
        ) : hasLiveSubscription ? (
          <div className="guarded-operation" role="note">
            <strong>Canlı abonelik ödeme sağlayıcı tarafından yönetiliyor</strong>
            <p>{PLAN_LABELS[tenant.plan]} planını doğrudan değiştirmek ödeme ve erişim durumunu birbirinden ayırabilir. Paket değişikliği abonelik/ödeme sağlayıcı akışından tamamlanmalıdır.</p>
          </div>
        ) : (
          <form action={changeTenantPlan} className="lifecycle-form">
            <input name="restaurantId" type="hidden" value={tenant.id} />
            <label className="reason-field">
              <span>Yeni paket</span>
              <select defaultValue={tenant.plan} name="plan">
                <option value="starter">Starter</option>
                <option value="plus">Plus</option>
                <option value="pro">Pro</option>
                <option value="business">Business</option>
              </select>
              <small>Bu yol yalnızca ödeme sağlayıcı aboneliği olmayan işletmelerde elle paket düzeltmesi veya sözleşmeli tanımlama içindir.</small>
            </label>
            <label className="reason-field">
              <span>İşlem gerekçesi</span>
              <textarea maxLength={1000} minLength={10} name="reason" placeholder="En az 10 karakterle sözleşme veya düzeltme gerekçesini yazın…" required />
              <small>İşlemi yapan kişi, önceki/yeni paket, gerekçe ve işlem numarası değiştirilemez denetim kaydına yazılır.</small>
            </label>
            <div className="lifecycle-actions">
              <button className="button primary" type="submit">Paketi güncelle</button>
            </div>
          </form>
        )}
      </article>

      <TenantEntitlementOverrides canManage={canManageEntitlements} failed={entitlementFailed} overrides={entitlements} restaurantId={tenant.id} />

      {canManageData ? <TenantPrivacyOperations failed={privacyFailed} operations={privacyOperations} restaurantId={tenant.id} /> : null}

      {platformAdminCan(actor, 'billing.manage') ? (
        <TenantBillingTimelinePanel failed={billingFailed} restaurantId={tenant.id} timeline={billingTimeline} />
      ) : null}
    </section>
  )
}
