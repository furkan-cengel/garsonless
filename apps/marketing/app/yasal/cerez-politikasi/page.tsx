import { LegalDocument } from '../../../components/LegalDocument'
import { legalMetadata } from '../../../lib/legal-metadata'

export const metadata = legalMetadata('Çerez Politikası', 'masabu çerez ve yerel depolama politikası.', '/yasal/cerez-politikasi')

export default function CookiePolicyPage() {
  return <LegalDocument
    title="Çerez Politikası"
    description="Zorunlu oturum teknolojileri ve etkileşimli üçüncü taraf içerikleri hakkında bilgi."
    sections={[
      { title: '1. Çerez ve benzeri teknolojiler nedir?', content: <p>Çerezler tarayıcıda saklanan küçük kayıtlardır. Yerel ve oturum depolaması gibi benzeri teknolojiler de oturumun sürdürülmesi, kullanıcının tercihlerinin hatırlanması veya bir özelliğin güvenli çalışması için kullanılabilir. Bu teknolojilerin kullanımı, siteyi ziyaret etmiş olmanız nedeniyle açık rıza verdiğiniz anlamına gelmez.</p> },
      { title: '2. Birinci taraf zorunlu kayıtlar', content: <><p>masabu; hesabınıza güvenli giriş yapılması, oturumun korunması, CSRF/kötüye kullanımın önlenmesi ve talep ettiğiniz temel işlevlerin çalışması için zorunlu çerez veya depolama kayıtları kullanabilir.</p><p>Arayüz tercihleri, favoriler, taslaklar ve bölüm içi gezinme durumu cihazınızda yerel olarak tutulabilir. Oturum kayıtları tarayıcı kapatıldığında veya oturum sona erdiğinde; kalıcı tercihler ise kullanıcı silene, tercih değişene veya teknik süresi dolana kadar saklanabilir.</p></> },
      { title: '3. Etkileşimli demolar', content: <p>Supademo iframe’i, etkileşimli demo bölümü görüntü alanına yaklaştığında otomatik olarak yüklenir. Bu sırada Supademo alan adına bağlantı kurulur; IP adresi, cihaz/tarayıcı ve demo kullanımı için gerekli teknik veriler işlenebilir ve sağlayıcı kendi çerez veya benzeri teknolojilerini kullanabilir. Demo alanına ilerlememek bu bağlantının kurulmasını önleyebilir.</p> },
      { title: '4. Form güvenliği', content: <p>İletişim formunda spam ve otomatik kötüye kullanımı önlemek için Google reCAPTCHA kullanılır. İletişim sayfası açıldığında Google alan adlarına teknik bağlantı kurulabilir; cihaz, ağ ve etkileşim bilgileri doğrulama amacıyla işlenebilir. Mesaj içeriği doğrulama için Google’a gönderilmez.</p> },
      { title: '5. Analitik ve reklam', content: <p>masabu ilk yayında zorunlu olmayan analitik, yeniden hedefleme veya reklam çerezi kullanmaz. Böyle bir teknoloji eklenirse sağlayıcı, amaç, hukuki dayanak, süre ve reddetme seçeneği bu metne eklenir; gereken hâllerde kullanıcı tercihi alınmadan çalıştırılmaz.</p> },
      { title: '6. Tercih ve tarayıcı kontrolleri', content: <p>Tarayıcınızdan çerezleri görüntüleyebilir, silebilir veya engelleyebilirsiniz. Zorunlu oturum ve güvenlik kayıtlarının engellenmesi dashboard, hesap ve korunan form özelliklerinin çalışmamasına neden olabilir. Üçüncü taraf kayıtları için ilgili sağlayıcının tercih araçları da kullanılabilir.</p> },
    ]}
  />
}
