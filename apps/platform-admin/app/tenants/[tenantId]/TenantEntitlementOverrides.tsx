import type { PlatformTenantFeatureOverride } from '@garsonless/application/platform-admin-entitlements'
import { RUNTIME_OVERRIDEABLE_FEATURES, type BillableFeature } from '@garsonless/domain/entitlements'
import { changeTenantFeatureOverride } from '../../actions'

const FEATURE_LABELS: Record<BillableFeature, string> = {
  qr_menu: 'QR menü',
  orders: 'Sipariş alma',
  table_management: 'Masa yönetimi',
  analytics_basic: 'Temel raporlar',
  theme_editor: 'Tema editörü',
  browser_notifications: 'Tarayıcı bildirimleri',
  kitchen_display: 'Mutfak ekranı',
  loyalty: 'Sadakat',
  analytics_advanced: 'Gelişmiş raporlar',
  theme_advanced_sections: 'Gelişmiş tema bölümleri',
  multi_location: 'Çoklu lokasyon',
  api_access: 'API erişimi',
  webhooks: 'Webhook',
  sso: 'SSO',
  white_label: 'White label',
}

function formatExpiry(value: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(value))
}

export function TenantEntitlementOverrides({
  canManage,
  failed,
  overrides,
  restaurantId,
}: {
  canManage: boolean
  failed: boolean
  overrides: PlatformTenantFeatureOverride[]
  restaurantId: string
}) {
  const now = Date.now()
  return (
    <article className="panel lifecycle-panel entitlement-panel">
      <div className="panel-heading billing-heading">
        <div><p className="eyebrow">Özellik erişimi</p><h2>Süreli entitlement override</h2></div>
        <span className="read-only">En fazla 30 gün</span>
      </div>

      {failed ? (
        <p className="empty-inline" role="alert">Override projection’ı güvenli biçimde yüklenemedi; yönetim işlemleri kapatıldı.</p>
      ) : (
        <>
          <div className="entitlement-list">
            {overrides.length === 0 ? <p className="empty-inline">Bu işletme için süreli istisna yok; erişimler yalnız paket kataloğundan gelir.</p> : overrides.map((override) => {
              const expired = Date.parse(override.expiresAt) <= now
              return (
                <div className="entitlement-row" key={override.feature}>
                  <div>
                    <div className="entitlement-title"><strong>{FEATURE_LABELS[override.feature]}</strong><span className="status" data-tone={expired ? 'neutral' : override.decision === 'allow' ? 'success' : 'danger'}>{expired ? 'Süresi doldu' : override.decision === 'allow' ? 'Geçici açık' : 'Geçici kapalı'}</span></div>
                    <p>{override.reason}</p>
                    <small>{formatExpiry(override.expiresAt)} tarihine kadar · son işlem {formatExpiry(override.updatedAt)}</small>
                  </div>
                  {canManage ? (
                    <form action={changeTenantFeatureOverride}>
                      <input name="restaurantId" type="hidden" value={restaurantId} />
                      <input name="action" type="hidden" value="revoke" />
                      <input name="feature" type="hidden" value={override.feature} />
                      <input name="reason" type="hidden" value={`Süreli ${FEATURE_LABELS[override.feature]} istisnası erken sonlandırıldı`} />
                      <button className="button danger-button" type="submit">Erken sonlandır</button>
                    </form>
                  ) : null}
                </div>
              )
            })}
          </div>

          {!canManage ? (
            <p className="billing-privacy-note">Bu görünüm salt okunurdur. Süreli istisnaları yalnız ops veya superadmin yönetebilir.</p>
          ) : (
            <form action={changeTenantFeatureOverride} className="lifecycle-form">
              <input name="restaurantId" type="hidden" value={restaurantId} />
              <input name="action" type="hidden" value="set" />
              <div className="entitlement-form-grid">
                <label className="reason-field"><span>Özellik</span><select name="feature" required>{RUNTIME_OVERRIDEABLE_FEATURES.map((feature) => <option key={feature} value={feature}>{FEATURE_LABELS[feature]}</option>)}</select></label>
                <label className="reason-field"><span>Karar</span><select defaultValue="allow" name="decision" required><option value="allow">Geçici olarak aç</option><option value="deny">Geçici olarak kapat</option></select></label>
                <label className="reason-field"><span>Süre</span><select defaultValue="7" name="durationDays" required><option value="1">1 gün</option><option value="3">3 gün</option><option value="7">7 gün</option><option value="14">14 gün</option><option value="30">30 gün</option></select></label>
              </div>
              <label className="reason-field">
                <span>İşlem gerekçesi</span>
                <textarea maxLength={1000} minLength={10} name="reason" placeholder="En az 10 karakterle sözleşme, destek veya güvenlik gerekçesini yazın…" required />
                <small>Plan ve ödeme durumu değişmez. Süre sonunda erişim otomatik olarak paket kataloğuna döner; erken sonlandırma ayrıca denetlenir.</small>
              </label>
              <div className="lifecycle-actions"><button className="button primary" type="submit">Süreli erişimi kaydet</button></div>
            </form>
          )}
        </>
      )}
    </article>
  )
}
