import { LegalDocument } from '../../../components/LegalDocument'
import { LEGAL_IDENTITY } from '../../../lib/legal-identity'
import { legalMetadata } from '../../../lib/legal-metadata'

export const metadata = legalMetadata('İptal, İade ve Dijital Teslimat', 'Masabu abonelik aktivasyonu, iptal ve iade politikası.', '/yasal/iptal-iade-ve-dijital-teslimat')

export default function CancellationPolicyPage() {
  return <LegalDocument
    title="İptal, İade ve Dijital Teslimat"
    description="Ücretli Masabu aboneliğinin ne zaman aktive edildiği, nasıl iptal edildiği ve iade taleplerinin nasıl incelendiği."
    sections={[
      { title: '1. Deneme ve dijital teslimat', content: <><p>14 günlük Pro denemesi ücretsizdir ve kart gerektirmez. Deneme süresinde ödeme alınmaz; ücretli plan seçilmezse süre sonunda yayın ve ücretli işlemler kilitlenebilir.</p><p>Hizmet fiziksel teslimat içermez. Ücretli abonelik, başarılı ödeme bildiriminin alınması ve ilgili plan yetkilerinin müşteri hesabında etkinleştirilmesiyle teslim edilir. Aktivasyon normal koşullarda ödeme sonrasında otomatik gerçekleşir.</p></> },
      { title: '2. Abonelik iptali', content: <p>Starter, Plus ve Pro müşterileri aboneliği dashboard üzerinden veya <a href={`mailto:${LEGAL_IDENTITY.supportEmail}`}>{LEGAL_IDENTITY.supportEmail}</a> adresine yazarak iptal edebilir. İptal talebi mevcut ürün akışında aboneliği ve ücretli yüzeylere erişimi derhâl durdurur; tekrar etkinleştirme veya yeni satın alma yapılmadıkça yeni dönem tahsilatı alınmaz.</p> },
      { title: '3. İade talepleri', content: <p>Hatalı veya mükerrer tahsilat, ödeme alındığı hâlde hizmetin etkinleştirilmemesi ya da sağlayıcıdan kaynaklanan esaslı teslim sorunu için iade talebi oluşturulabilir. Talep; ödeme referansı, işletme adı ve hesap e-postasıyla destek kanalına iletilmelidir.</p> },
      { title: '4. Kullanılmış dönemler', content: <p>Taahhütsüz abonelik, kullanılmaya başlanmış mevcut dönemin kalan kısmı için otomatik oransal iade anlamına gelmez. Yıllık plan on iki aylık hizmet için peşin fiyatlandırılır. Sağlayıcıdan kaynaklanan ve hizmetin esaslı biçimde teslimini engelleyen doğrulanabilir sorunlar somut olay bazında incelenir.</p> },
      { title: '5. İadenin gerçekleştirilmesi', content: <p>Onaylanan iadeler ödeme kuruluşunun süreçleriyle aynı ödeme aracına gönderilir. Banka veya kart kuruluşunun yansıtma süresi Masabu’nun kontrolü dışında olabilir. Mali belge iptal/iade işlemleri yürürlükteki muhasebe kurallarına göre ayrıca yürütülür.</p> },
      { title: '6. Veri erişimi ve silme', content: <p>Abonelik iptal edildiğinde ücretli özelliklere erişim kapanır. Veriler iptal anında otomatik olarak silinmez. Müşteri, hesabı erişilebilirken uygun dışa aktarma araçlarını kullanmalı veya destekten yardım istemelidir. Silme talepleri; vergi, muhasebe, sözleşme, güvenlik ve uyuşmazlık kayıtları için zorunlu süreler saklı kalmak üzere Gizlilik Politikası ile KVKK Aydınlatma Metnine göre yürütülür.</p> },
      { title: '7. Business planı', content: <p>Business paketi satış destekli ve özel fiyatlıdır. Aktivasyon, iptal, dönem ve iade koşulları teklif veya ek sözleşmede farklı belirlenmişse özel olarak kabul edilen bu koşullar uygulanır.</p> },
    ]}
  />
}
