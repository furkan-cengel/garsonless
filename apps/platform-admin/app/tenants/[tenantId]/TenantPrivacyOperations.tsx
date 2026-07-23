import {
  PLATFORM_PRIVACY_ERASE_CONFIRMATION,
  type PlatformPrivacyOperation,
} from '@garsonless/application/platform-admin-privacy'
import { eraseTenantPrivacyData } from '../../actions'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Istanbul' }).format(new Date(value))
}

export function TenantPrivacyOperations({ failed, operations, restaurantId }: {
  failed: boolean
  operations: PlatformPrivacyOperation[]
  restaurantId: string
}) {
  return (
    <article className="panel lifecycle-panel privacy-panel">
      <div className="panel-heading billing-heading">
        <div><p className="eyebrow">KVKK operasyonu</p><h2>Müşteri verisi dışa aktarma ve silme</h2></div>
        <span className="read-only">Yalnız Süper yönetici</span>
      </div>
      <div className="guarded-operation" role="note"><strong>Silme, işletme kapsamlı anonimleştirmedir</strong><p>Fatura ve anonimleştirilmiş operasyon kayıtları korunur. Başka işletmeyle ilişkisi bulunan ortak müşteri profili silinmez; yalnız bu işletmenin bağları kaldırılır.</p></div>
      {failed ? <p className="empty-inline" role="alert">KVKK işlem geçmişi yüklenemedi; güvenlik için bütün işlemler kapatıldı.</p> : <>
        <div className="privacy-operation-grid">
          <form action={`/tenants/${encodeURIComponent(restaurantId)}/privacy/export`} className="lifecycle-form" method="post">
            <label className="reason-field"><span>Dışa aktarma gerekçesi</span><textarea maxLength={1000} minLength={10} name="reason" placeholder="Başvuru veya hukuki dayanağı en az 10 karakterle yazın…" required /><small>Gerekçeye müşteri adı, telefon veya e-posta bilgisi yazmayın.</small></label>
            <div className="lifecycle-actions"><button className="button primary" type="submit">JSON dışa aktar</button></div>
          </form>
          <form action={eraseTenantPrivacyData} className="lifecycle-form privacy-danger-form">
            <input name="restaurantId" type="hidden" value={restaurantId} />
            <label className="reason-field"><span>Silme gerekçesi</span><textarea maxLength={1000} minLength={10} name="reason" placeholder="Doğrulanmış KVKK başvurusunu ve kapsamını yazın…" required /><small>Gerekçeye müşteri adı, telefon veya e-posta bilgisi yazmayın.</small></label>
            <label className="reason-field"><span>Onay metni</span><input autoComplete="off" name="confirmation" placeholder={PLATFORM_PRIVACY_ERASE_CONFIRMATION} required /><small>Geri alınamaz kişisel veri temizliği için tam olarak “{PLATFORM_PRIVACY_ERASE_CONFIRMATION}” yazın.</small></label>
            <div className="lifecycle-actions"><button className="button danger-button" type="submit">Müşteri kişisel veri bağlarını sil</button></div>
          </form>
        </div>
        <div className="privacy-history"><h3>Son işlemler</h3>{operations.length === 0 ? <p className="empty-inline">Henüz KVKK operasyonu yok.</p> : operations.map((item) => <div className="invoice-row" key={item.id}><div><strong>{item.type === 'export' ? 'Veri dışa aktarıldı' : 'Kişisel veri bağları silindi'}</strong><small>{item.reason}</small></div><div className="invoice-right"><span className="status" data-tone={item.type === 'erase' ? 'danger' : 'success'}>{item.summary.customerCount} müşteri</span><small>{formatDate(item.completedAt)}</small></div></div>)}</div>
      </>}
    </article>
  )
}
