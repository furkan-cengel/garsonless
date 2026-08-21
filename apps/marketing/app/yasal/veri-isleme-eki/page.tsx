import { LegalDocument } from '../../../components/LegalDocument'
import { LegalProviderList } from '../../../components/LegalProviderList'
import { legalMetadata } from '../../../lib/legal-metadata'

export const metadata = legalMetadata(
  'Veri İşleme Eki',
  'Masabu müşterileri adına işlenen restoran, ekip ve misafir verilerine ilişkin B2B veri işleme koşulları.',
  '/yasal/veri-isleme-eki',
)

export default function DataProcessingAddendumPage() {
  return <LegalDocument
    title="Veri İşleme Eki"
    description="Restoranın veri sorumlusu, Masabu’nun veri işleyen olduğu işlemlerde uygulanacak güvenlik, gizlilik ve işleme esasları."
    sections={[
      {
        title: '1. Kapsam ve tarafların rolleri',
        content: <><p>Bu ek, B2B Abonelik Hizmet Sözleşmesi’nin ayrılmaz parçasıdır. Müşteri işletmenin kendi çalışanları, misafirleri ve müşterileri hakkında Masabu’ya aktardığı veya Masabu üzerinden topladığı kişisel veriler bakımından işleme amaç ve araçlarını müşteri belirliyorsa müşteri veri sorumlusu, Masabu ise müşterinin belgelenmiş talimatlarıyla hareket eden veri işleyendir.</p><p>Masabu; kendi işletme hesabı, platform güvenliği, sözleşme kabul kayıtları, faturalama, destek ve platform genelindeki müşteri hesabı işlevlerinde işleme amaçlarını kendisi belirlediği ölçüde ayrıca veri sorumlusu olabilir. Her işlemde rol, yalnız sözleşmedeki etikete değil fiilî işleme amacına göre değerlendirilir.</p></>,
      },
      {
        title: '2. İşlemenin konusu, amacı ve süresi',
        content: <p>İşleme; dijital menünün yayınlanması, sipariş ve masa operasyonunun yürütülmesi, mutfak ve tahsilat durumlarının gösterilmesi, müşteri hesabı, sadakat, izinli kampanya, raporlama, destek ve güvenlik özelliklerinin sunulmasıyla sınırlıdır. İşleme abonelik boyunca ve sona erme sonrasında silme, iade, yedekleme, uyuşmazlık veya yasal saklama için gerekli sınırlı süre boyunca devam eder.</p>,
      },
      {
        title: '3. İlgili kişiler ve veri kategorileri',
        content: <><p>İlgili kişiler; müşterinin hesap sahipleri ve ekip üyeleri, restoran misafirleri, müşteri hesabı oluşturan kişiler, sipariş verenler, sadakat programı katılımcıları ve destek talebi iletenler olabilir.</p><p>İşlenen veriler; kimlik ve iletişim bilgileri, hesap/rol bilgileri, restoran ve masa ilişkisi, sipariş ve ödeme durumu, sadakat hareketleri, kampanya tercihleri ve izin kayıtları, cihaz/oturum/güvenlik kayıtları ile müşterinin hizmete yüklediği içerikleri kapsayabilir. Özel nitelikli kişisel veri yüklenmemelidir; böyle bir işleme ihtiyaç duyulursa özellik etkinleştirilmeden önce amaç, hukuki şart ve ek güvenlik önlemleri ayrıca belirlenir.</p></>,
      },
      {
        title: '4. Müşterinin talimatları ve sorumlulukları',
        content: <p>Müşteri, verileri hukuka uygun elde etmekten; kendi aydınlatma, işleme şartı, pazarlama izni ve saklama yükümlülüklerinden; ekip yetkilerini doğru vermekten ve Masabu’ya yalnız hizmet için gerekli verileri aktarmaktan sorumludur. Masabu, hukuka aykırı olduğunu değerlendirdiği bir talimatı askıya alabilir ve müşteriyi bilgilendirir.</p>,
      },
      {
        title: '5. Masabu’nun yükümlülükleri',
        content: <ul><li>Verileri yalnız belgelenmiş talimatlar ve hizmetin sunulması amacıyla işlemek,</li><li>erişimi görev ve yetkiyle sınırlandırmak ve gizlilik yükümlülüğü uygulamak,</li><li>uygun teknik ve idari güvenlik önlemlerini sürdürmek,</li><li>kişisel veri ihlali tespit edildiğinde müşteriyi gereksiz gecikme olmaksızın bilgilendirmek,</li><li>ilgili kişi ve resmî makam taleplerinde makul ölçüde destek vermek,</li><li>hizmet sonunda yasal saklama zorunluluğu bulunmayan verileri iade, silme, yok etme veya anonimleştirme süreçlerine almak.</li></ul>,
      },
      {
        title: '6. Alt işleyenler ve yurt dışı aktarım',
        content: <><p>Masabu, hizmetin teknik olarak sunulması için aşağıdaki sağlayıcılardan ilgili işlem kullanıldığı ölçüde yararlanır. Müşteri bu sağlayıcıların hizmet amacıyla kullanılmasına genel yetki verir; esaslı değişiklikler uygun kanaldan duyurulur.</p><LegalProviderList /><p>Bir sağlayıcının veya alt işleyenin Türkiye dışında veri işlemesi hâlinde KVKK’nın 9. maddesinde öngörülen aktarım şartı ve uygun güvence tamamlanmadan aktarım canlı ortamda başlatılmaz. Gerekli standart sözleşme, bildirim ve tedarikçi değerlendirmeleri yayın öncesi uyum dosyasında saklanır.</p></>,
      },
      {
        title: '7. İlgili kişi talepleri ve denetim bilgileri',
        content: <p>Masabu’ya doğrudan ulaşan ve müşterinin veri sorumlusu olduğu bir talep, mümkün olan en kısa sürede müşteriye yönlendirilir. Masabu; işlenen veri kategorileri, güvenlik tedbirleri, alt işleyenler ve talebin sonuçlandırılması için gereken teknik çıktıları makul ölçüde sağlar. Denetim talepleri güvenlik, gizlilik ve diğer müşterilerin haklarını ihlal etmeyecek biçimde belge incelemesiyle karşılanabilir.</p>,
      },
      {
        title: '8. Sözleşme sırası ve sona erme',
        content: <p>Bu ek ile B2B Abonelik Hizmet Sözleşmesi arasında kişisel veri işleme konusunda çelişki olması hâlinde bu ek uygulanır. Abonelik sona erse de gizlilik, güvenlik, yasal saklama ve veri iade/silme yükümlülükleri nitelikleri gereği devam eder.</p>,
      },
    ]}
  />
}

