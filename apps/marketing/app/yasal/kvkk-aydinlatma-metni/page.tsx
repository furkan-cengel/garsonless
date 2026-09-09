import { ANALYTICS_CONSENT_VERSION } from '@garsonless/domain/marketing-analytics'
import { LegalDocument } from '../../../components/LegalDocument'
import { LegalProviderList } from '../../../components/LegalProviderList'
import { LEGAL_IDENTITY } from '../../../lib/legal-identity'
import { legalMetadata } from '../../../lib/legal-metadata'

export const metadata = legalMetadata(
  'KVKK Aydınlatma Metni',
  'masabu tarafından işlenen kişisel verilere ilişkin aydınlatma metni.',
  '/yasal/kvkk-aydinlatma-metni',
)

export default function KvkkNoticePage() {
  return <LegalDocument
    version={ANALYTICS_CONSENT_VERSION}
    canonical="/yasal/kvkk-aydinlatma-metni"
    title="KVKK Aydınlatma Metni"
    description="masabu web sitesi, hesap oluşturma, abonelik ve destek süreçlerinde işlenen kişisel verilere ilişkin bilgilendirme."
    sections={[
      { title: 'İsteğe bağlı ziyaret ve dönüşüm analitiği', content: <p>Google Analytics 4 etkinleştirildiğinde ziyaret, sayfa ve kayıt/deneme olayları açık rızaya dayanarak ölçülür. Tarayıcı/oturum tanımlayıcıları, cihaz ve bağlantı bilgileri işlenebilir. E-posta, telefon, form metni ve doğrulama bilgileri olaylara eklenmez. Rıza Çerez tercihleri üzerinden geri alınabilir; analitik ve aktarım bilgileri Gizlilik ve Çerez Politikalarında açıklanır.</p> },
      {
        title: '1. Veri sorumlusu',
        content: <p>6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”) kapsamında veri sorumlusu, {LEGAL_IDENTITY.publicName}dır. İletişim adresi {LEGAL_IDENTITY.address}; KVKK başvuru e-postası <a href={`mailto:${LEGAL_IDENTITY.privacyEmail}`}>{LEGAL_IDENTITY.privacyEmail}</a> adresidir.</p>,
      },
      {
        title: '2. Kapsam ve veri sorumluluğu rolleri',
        content: <><p>Bu metin; masabu web sitesini ziyaret edenleri, iletişim formunu kullananları, işletme hesabı sahiplerini ve ekip üyelerini, faturalama yetkililerini ve masabu platformunda hesap açan misafirleri kapsar.</p><p>masabu; işletme hesabı, güvenlik, abonelik, faturalama, destek ve platform hesabı işlemlerinde veri sorumlusudur. Restoranın kendi misafirlerinden topladığı menü, sipariş, sadakat, kampanya ve hizmet verilerinde ise amaç ve araçları restoran belirler; masabu, restoranın talimatları doğrultusunda veri işleyen olarak hareket edebilir. Bu durumda restoranın kendi aydınlatma yükümlülüğü ayrıca devam eder.</p></>,
      },
      {
        title: '3. İşlenen kişisel veri kategorileri',
        content: <ul><li><strong>Kimlik ve iletişim:</strong> ad, soyad, e-posta, telefon ve işletmedeki görev.</li><li><strong>İşletme ve hesap:</strong> restoran, şube, ekip üyeliği, rol, kullanıcı ve oturum bilgileri.</li><li><strong>Fatura ve işlem:</strong> ticari unvan veya ad-soyad, VKN/TCKN türü, vergi dairesi, fatura adresi, plan, dönem, tutar ve ödeme referansı.</li><li><strong>Hizmet ve operasyon:</strong> müşteri hesabı, sipariş, masa, sadakat ve tercih kayıtları; bu veriler işleme rolüne göre ilgili restoran adına tutulabilir.</li><li><strong>Talep ve iletişim:</strong> destek/iletişim yazışmaları, konu, mesaj ve talebin sonuçlandırılmasına ilişkin kayıtlar.</li><li><strong>Teknik ve güvenlik:</strong> cihaz, tarayıcı, oturum, hata, erişim, kötüye kullanım önleme ve güvenli istek kayıtları. Yasal kabul kaydında ham IP adresi yerine tek yönlü özet kullanılabilir.</li></ul>,
      },
      {
        title: '4. İşleme amaçları ve hukuki sebepler',
        content: <><p>Veriler; hesap ve restoran kurulumunun yapılması, kimlik doğrulama, yetkilendirme, deneme ve aboneliğin yürütülmesi, menü ve operasyon hizmetlerinin sunulması, ödeme ve fatura süreçleri, destek talepleri, bilgi güvenliği, hata/kötüye kullanım önleme, yasal kabulün ispatı ve hukuki yükümlülüklerin yerine getirilmesi amaçlarıyla işlenir.</p><p>Bu işlemler KVKK’nın 5. maddesindeki sözleşmenin kurulması veya ifası, veri sorumlusunun hukuki yükümlülüğü, bir hakkın tesisi, kullanılması veya korunması ve temel haklara zarar vermemek kaydıyla meşru menfaat sebeplerine dayanır. Açık rıza gerektiren isteğe bağlı bir işlem sunulursa aydınlatmadan ayrı, belirli ve geri alınabilir bir tercih olarak alınır.</p></>,
      },
      {
        title: '5. Kişisel verilerin toplanma yöntemi',
        content: <p>Veriler; web ve uygulama formları, hesap/restoran kurulum ekranları, destek kanalları, kullanıcının gerçekleştirdiği menü ve operasyon işlemleri, ödeme/fatura sağlayıcılarından gelen doğrulanmış bildirimler ve hizmetin güvenli çalışması sırasında oluşan teknik kayıtlar üzerinden otomatik veya kısmen otomatik yöntemlerle toplanır.</p>,
      },
      {
        title: '6. Alıcı grupları ve hizmet sağlayıcılar',
        content: <><p>Veriler, amacın gerektirdiği ölçüyle sınırlı olarak yetkili masabu personeli, hizmet alınan veri işleyenler, ödeme ve fatura kuruluşları, hukuken yetkili kamu kurumları ve uyuşmazlık hâlinde danışmanlarla paylaşılabilir. Kart numarası masabu sistemlerinde saklanmaz.</p><LegalProviderList /><p>Sağlayıcıların güncel işleme bölgeleri ve alt işleyenleri ayrıca doğrulanır. Yurt dışına aktarım gerektiren bir akış, KVKK’nın 9. maddesindeki uygun güvenceler ve gerekli bildirimler tamamlanmadan canlı kullanıma açılmaz.</p></>,
      },
      {
        title: '7. Saklama ve imha',
        content: <p>Veriler; ilgili hizmetin sunulması, uyuşmazlıkların yönetilmesi ve yasal yükümlülükler için gerekli süre boyunca saklanır. Hesap kapatma, sözleşmenin sona ermesi veya işleme amacının ortadan kalkması hâlinde; vergi, muhasebe, sözleşme ve güvenlik kayıtları için zorunlu süreler saklı kalmak üzere silinir, yok edilir veya anonim hâle getirilir. Yedeklerde kalan kayıtlar, olağan yedek döngüsü içinde erişime kapalı biçimde tasfiye edilir.</p>,
      },
      {
        title: '8. Veri güvenliği',
        content: <p>Rol ve restoran üyeliği kontrolleri sunucu tarafında uygulanır; erişimler ihtiyaçla sınırlandırılır, hizmet iletişimi şifreli kanallardan yürütülür ve güvenlik olayları kayıt altına alınır. Hiçbir internet hizmeti mutlak güvenlik garanti edemese de riskle orantılı teknik ve idari tedbirler düzenli olarak gözden geçirilir.</p>,
      },
      {
        title: '9. İlgili kişi hakları',
        content: <><p>KVKK’nın 11. maddesi kapsamında verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, amacına uygun kullanılıp kullanılmadığını öğrenme, yurt içinde veya yurt dışında aktarılan tarafları bilme, düzeltme, silme veya yok etme talep etme, bu işlemlerin aktarılan taraflara bildirilmesini isteme, münhasıran otomatik analiz sonucuna itiraz etme ve kanuna aykırı işleme nedeniyle zararın giderilmesini talep etme haklarına sahipsiniz.</p><p>Başvuru ayrıntıları için <a href="/yasal/kvkk-basvuru-yontemleri">KVKK Başvuru Yöntemleri</a> sayfasını inceleyebilirsiniz.</p></>,
      },
    ]}
  />
}
