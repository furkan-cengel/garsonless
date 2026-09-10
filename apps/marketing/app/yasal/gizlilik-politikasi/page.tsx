import { LegalDocument } from '../../../components/LegalDocument'
import { LegalProviderList } from '../../../components/LegalProviderList'
import { LEGAL_IDENTITY } from '../../../lib/legal-identity'
import { legalMetadata } from '../../../lib/legal-metadata'

export const metadata = legalMetadata('Gizlilik Politikası', 'masabu web sitesi ve uygulamalarının gizlilik politikası.', '/yasal/gizlilik-politikasi')

export default function PrivacyPolicyPage() {
  return <LegalDocument
    version="2026-09-10"
    canonical="/yasal/gizlilik-politikasi"
    title="Gizlilik Politikası"
    description="masabu’nun veri minimizasyonu, güvenlik, hizmet sağlayıcıları ve kullanıcı kontrollerine ilişkin yaklaşımı."
    sections={[
      { title: '1. Kapsam', content: <p>Bu politika masabu.co, app.masabu.co, menu.masabu.co ve kds.masabu.co alan adlarında sunulan masabu hizmetlerini kapsar. Restoranların kendi misafirleri için veri sorumlusu olduğu işlemler ayrıca ilgili restoranın aydınlatma yükümlülüğüne tabi olabilir.</p> },
      { title: '2. Rollerimiz', content: <><p>masabu kendi işletme hesabı, güvenlik, abonelik, faturalama, destek ve platform hesabı süreçlerinde veri sorumlusudur. Bir restoranın menü, sipariş, sadakat veya kampanya süreçlerinde işlenen misafir verilerinde ise restoran veri sorumlusu, masabu veri işleyen olabilir.</p><p>Restoran, kendi misafirlerine hangi verileri neden işlediğini açıklamak ve gerekli tercihleri sunmakla sorumludur. Bu ayrımın ayrıntıları <a href="/yasal/veri-isleme-eki">Veri İşleme Eki</a>nde yer alır.</p></> },
      { title: '3. Veri minimizasyonu', content: <p>Hesap, restoran operasyonu, ödeme, fatura ve destek için gerekli olmayan kişisel verileri talep etmemeyi; teknik kayıtlarda sırları, kart verilerini ve gereksiz ham ödeme bildirimlerini tutmamayı hedefleriz.</p> },
      { title: '4. Hesap, güvenlik ve saklama', content: <><p>Oturumlar güvenli çerezlerle yönetilir. Parolalar masabu tarafından düz metin olarak saklanmaz. Yetkilendirme, restoran üyeliği ve rol sınırları sunucu tarafında uygulanır. Güvenlik kayıtları kötüye kullanımı önlemek ve olayları incelemek için yalnız gerekli olduğu sürece tutulur.</p><p>Kayıtlar işleme amacı veya yasal saklama yükümlülüğü sona erdiğinde silinir, yok edilir ya da anonim hâle getirilir. Muhasebe ve sözleşme kayıtları, hesap kapansa da kanuni süre boyunca korunabilir.</p></> },
      { title: '5. Ödeme, fatura ve kullanıcı kontrolleri', content: <><p>Abonelik ödemeleri iyzico üzerinden yürütülür. masabu kart numarasını saklamaz. Başarılı ödeme referansları, aboneliği etkinleştirmek ve Nilvera üzerinden e-Fatura/e-Arşiv oluşturmak için kullanılır.</p><p>Kullanıcılar hesap bilgilerini düzeltebilir; uygun olduğu ölçüde veri dışa aktarma veya silme talebi oluşturabilir. Yasal saklama zorunlulukları, güvenlik ve başka kişilerin hakları bu taleplerin kapsamını sınırlayabilir.</p></> },
      { title: '6. Hizmet sağlayıcılar ve üçüncü taraf içerikleri', content: <><LegalProviderList /><p>Etkileşimli demo görüntü alanına yaklaştığında Supademo, iletişim sayfası açıldığında Google reCAPTCHA yüklenebilir. Google Analytics 4 etkinleştirildiğinde ziyaret ve kayıt/deneme adımları yalnızca açık rıza sonrasında ölçülür. Ölçüme e-posta, telefon, form içeriği, işletme adı veya doğrulama belirteçleri eklenmez. Google etiketinin çalışması sırasında bağlantı ve cihaz bilgileri sağlayıcıya ulaşabilir. Reklam ve Google Signals kapalıdır. Kullanıcı ve olay düzeyindeki verilerin saklama süresi 14 aydır; yeni kullanıcı etkinliği bu süreyi yeniden başlatmaz. Sürelerin ayrıntıları Çerez Politikası’ndadır. Google Analytics kullanıldığında bu veriler Google ve hizmet sağlayıcılarının Türkiye dışındaki sistemlerinde işlenebilir. Yurt dışına aktarımın hukuki dayanağı, analitik çerez tercihinden ayrı değerlendirilir; çerez kabulü aktarım yükümlülüklerinin yerine geçmez.</p></> },
      { title: '7. Çocuklar ve hesap yetkisi', content: <p>masabu işletmelere yönelik bir hizmettir ve çocuklara yönelik hesap sunmaz. İşletme hesabı açan veya ekip üyesi davet eden kişi, işletme adına gerekli yetkiye sahip olduğunu beyan eder.</p> },
      { title: '8. Değişiklikler ve iletişim', content: <><p>Politikanın esaslı değişiklikleri sürüm tarihi güncellenerek ve gerekli olduğunda hesap içinden bildirilir. Geçmiş kabul gerektiren sözleşmeler ayrı sürüm kayıtlarıyla saklanır.</p><p>Gizlilik soruları için <a href={`mailto:${LEGAL_IDENTITY.privacyEmail}`}>{LEGAL_IDENTITY.privacyEmail}</a> adresinden bize ulaşabilirsiniz. KVKK hak talepleri için <a href="/yasal/kvkk-basvuru-yontemleri">başvuru yöntemlerini</a> kullanın.</p></> },
    ]}
  />
}
