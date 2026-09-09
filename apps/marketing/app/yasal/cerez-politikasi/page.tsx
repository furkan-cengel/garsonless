import { ANALYTICS_CONSENT_VERSION } from '@garsonless/domain/marketing-analytics'
import { LegalDocument } from '../../../components/LegalDocument'
import { legalMetadata } from '../../../lib/legal-metadata'

export const metadata = legalMetadata('Çerez Politikası', 'masabu çerez ve yerel depolama politikası.', '/yasal/cerez-politikasi')

export default function CookiePolicyPage() {
  return <LegalDocument
    version={ANALYTICS_CONSENT_VERSION}
    canonical="/yasal/cerez-politikasi"
    title="Çerez Politikası"
    description="Zorunlu oturum teknolojileri ve etkileşimli üçüncü taraf içerikleri hakkında bilgi."
    sections={[
      { title: '1. Çerez ve benzeri teknolojiler nedir?', content: <p>Çerezler tarayıcıda saklanan küçük kayıtlardır. Yerel ve oturum depolaması gibi benzeri teknolojiler de oturumun sürdürülmesi, kullanıcının tercihlerinin hatırlanması veya bir özelliğin güvenli çalışması için kullanılabilir. Bu teknolojilerin kullanımı, siteyi ziyaret etmiş olmanız nedeniyle açık rıza verdiğiniz anlamına gelmez.</p> },
      { title: '2. Birinci taraf zorunlu kayıtlar', content: <><p>masabu; hesabınıza güvenli giriş yapılması, oturumun korunması, CSRF/kötüye kullanımın önlenmesi ve talep ettiğiniz temel işlevlerin çalışması için zorunlu çerez veya depolama kayıtları kullanabilir.</p><p>Arayüz tercihleri, favoriler, taslaklar ve bölüm içi gezinme durumu cihazınızda yerel olarak tutulabilir. Oturum kayıtları tarayıcı kapatıldığında veya oturum sona erdiğinde; kalıcı tercihler ise kullanıcı silene, tercih değişene veya teknik süresi dolana kadar saklanabilir.</p></> },
      { title: '3. Etkileşimli demolar', content: <p>Supademo iframe’i, etkileşimli demo bölümü görüntü alanına yaklaştığında otomatik olarak yüklenir. Bu sırada Supademo alan adına bağlantı kurulur; IP adresi, cihaz/tarayıcı ve demo kullanımı için gerekli teknik veriler işlenebilir ve sağlayıcı kendi çerez veya benzeri teknolojilerini kullanabilir. Demo alanına ilerlememek bu bağlantının kurulmasını önleyebilir.</p> },
      { title: '4. Form güvenliği', content: <p>İletişim formunda spam ve otomatik kötüye kullanımı önlemek için Google reCAPTCHA kullanılır. İletişim sayfası açıldığında Google alan adlarına teknik bağlantı kurulabilir; cihaz, ağ ve etkileşim bilgileri doğrulama amacıyla işlenebilir. Mesaj içeriği doğrulama için Google’a gönderilmez.</p> },
      { title: '5. Analitik ve reklam', content: <p>Google Analytics 4 etkinleştirildiğinde yalnızca analitik tercihiniz “Kabul et” ise yüklenir. Amaç, masabu.co ziyaretleri ile app.masabu.co kayıt ve deneme adımlarının performansını ölçmektir; hukuki dayanak açık rızadır. Reddetme hâlinde GA4 yüklenmez ve Google Analytics’e ölçüm verisi gönderilmez. Reklam, yeniden hedefleme ve Google Signals kullanılmaz. Restoran misafir menüleri bu pazarlama ölçümüne dahil değildir.</p> },
      { title: '6. Analitik kayıtları ve süreler', content: <><p>masabu_analytics_consent, kabul veya ret tercihinizi ve sürümünü 180 gün saklayan birinci taraf tercih çerezidir. masabu.co ve app.masabu.co arasında paylaşılır. _ga ve _ga_* kayıtları Google Analytics sağlayıcısının birinci taraf analitik çerezleridir; tarayıcı ve oturum ayrımında kullanılır, süreleri 180 gündür ve kullanım sırasında yenilenebilir.</p><p>Yalnızca analitiğe izin veren yeni kayıtlarda masabu_signup_pending en fazla 24 saat, masabu_signup_receipt en fazla 60 saniye tutulur. Bunlar kayıt başarısını bir kez ölçmek için kullanılan birinci taraf kayıtlardır; Google’a hesap kimliği gönderilmez. Üretim ölçümü açılmadan önce GA4 olay verisi saklama süresi iki ay olarak yapılandırılır. Tarayıcı çerezini silmek, daha önce sağlayıcıya iletilmiş kayıtları kendiliğinden silmez.</p></> },
      { title: '7. Tercih ve tarayıcı kontrolleri', content: <p>Analitik etkin olduğunda sayfalardaki “Çerez tercihleri” düğmesiyle tercihinizi değiştirebilir veya rızanızı geri çekebilirsiniz. Geri çekme yeni ölçümü durdurur ve erişilebilen GA çerezlerini temizler. Tarayıcınızdan çerezleri görüntüleyebilir, silebilir veya engelleyebilirsiniz. Zorunlu oturum ve güvenlik kayıtlarının engellenmesi dashboard, hesap ve korunan form özelliklerinin çalışmamasına neden olabilir. Üçüncü taraf kayıtları için ilgili sağlayıcının tercih araçları da kullanılabilir.</p> },
    ]}
  />
}
