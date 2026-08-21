import { LegalDocument } from '../../../components/LegalDocument'
import { LegalProviderList } from '../../../components/LegalProviderList'
import { LEGAL_IDENTITY } from '../../../lib/legal-identity'
import { legalMetadata } from '../../../lib/legal-metadata'

export const metadata = legalMetadata('Gizlilik Politikası', 'Masabu web sitesi ve uygulamalarının gizlilik politikası.', '/yasal/gizlilik-politikasi')

export default function PrivacyPolicyPage() {
  return <LegalDocument
    title="Gizlilik Politikası"
    description="Masabu’nun veri minimizasyonu, güvenlik, hizmet sağlayıcıları ve kullanıcı kontrollerine ilişkin yaklaşımı."
    sections={[
      { title: '1. Kapsam', content: <p>Bu politika masabu.co, app.masabu.co, menu.masabu.co ve kds.masabu.co alan adlarında sunulan Masabu hizmetlerini kapsar. Restoranların kendi misafirleri için veri sorumlusu olduğu işlemler ayrıca ilgili restoranın aydınlatma yükümlülüğüne tabi olabilir.</p> },
      { title: '2. Rollerimiz', content: <><p>Masabu kendi işletme hesabı, güvenlik, abonelik, faturalama, destek ve platform hesabı süreçlerinde veri sorumlusudur. Bir restoranın menü, sipariş, sadakat veya kampanya süreçlerinde işlenen misafir verilerinde ise restoran veri sorumlusu, Masabu veri işleyen olabilir.</p><p>Restoran, kendi misafirlerine hangi verileri neden işlediğini açıklamak ve gerekli tercihleri sunmakla sorumludur. Bu ayrımın ayrıntıları <a href="/yasal/veri-isleme-eki">Veri İşleme Eki</a>nde yer alır.</p></> },
      { title: '3. Veri minimizasyonu', content: <p>Hesap, restoran operasyonu, ödeme, fatura ve destek için gerekli olmayan kişisel verileri talep etmemeyi; teknik kayıtlarda sırları, kart verilerini ve gereksiz ham ödeme bildirimlerini tutmamayı hedefleriz.</p> },
      { title: '4. Hesap, güvenlik ve saklama', content: <><p>Oturumlar güvenli çerezlerle yönetilir. Parolalar Masabu tarafından düz metin olarak saklanmaz. Yetkilendirme, restoran üyeliği ve rol sınırları sunucu tarafında uygulanır. Güvenlik kayıtları kötüye kullanımı önlemek ve olayları incelemek için yalnız gerekli olduğu sürece tutulur.</p><p>Kayıtlar işleme amacı veya yasal saklama yükümlülüğü sona erdiğinde silinir, yok edilir ya da anonim hâle getirilir. Muhasebe ve sözleşme kayıtları, hesap kapansa da kanuni süre boyunca korunabilir.</p></> },
      { title: '5. Ödeme, fatura ve kullanıcı kontrolleri', content: <><p>Abonelik ödemeleri iyzico üzerinden yürütülür. Masabu kart numarasını saklamaz. Başarılı ödeme referansları, aboneliği etkinleştirmek ve Paraşüt üzerinden e-Fatura/e-Arşiv oluşturmak için kullanılır.</p><p>Kullanıcılar hesap bilgilerini düzeltebilir; uygun olduğu ölçüde veri dışa aktarma veya silme talebi oluşturabilir. Yasal saklama zorunlulukları, güvenlik ve başka kişilerin hakları bu taleplerin kapsamını sınırlayabilir.</p></> },
      { title: '6. Hizmet sağlayıcılar ve üçüncü taraf içerikleri', content: <><LegalProviderList /><p>Etkileşimli demo görüntü alanına yaklaştığında Supademo, iletişim sayfası açıldığında Google reCAPTCHA yüklenebilir. Masabu ilk yayında reklam veya davranışsal analiz teknolojisi kullanmaz. Böyle bir teknoloji eklenmeden önce politika ve gerekli tercih mekanizması güncellenir.</p></> },
      { title: '7. Çocuklar ve hesap yetkisi', content: <p>Masabu işletmelere yönelik bir hizmettir ve çocuklara yönelik hesap sunmaz. İşletme hesabı açan veya ekip üyesi davet eden kişi, işletme adına gerekli yetkiye sahip olduğunu beyan eder.</p> },
      { title: '8. Değişiklikler ve iletişim', content: <><p>Politikanın esaslı değişiklikleri sürüm tarihi güncellenerek ve gerekli olduğunda hesap içinden bildirilir. Geçmiş kabul gerektiren sözleşmeler ayrı sürüm kayıtlarıyla saklanır.</p><p>Gizlilik soruları için <a href={`mailto:${LEGAL_IDENTITY.privacyEmail}`}>{LEGAL_IDENTITY.privacyEmail}</a> adresinden bize ulaşabilirsiniz. KVKK hak talepleri için <a href="/yasal/kvkk-basvuru-yontemleri">başvuru yöntemlerini</a> kullanın.</p></> },
    ]}
  />
}
