import { LegalDocument } from '../../../components/LegalDocument'
import { LEGAL_IDENTITY } from '../../../lib/legal-identity'
import { legalMetadata } from '../../../lib/legal-metadata'

export const metadata = legalMetadata('Elektronik Abonelik ve Sipariş Özeti', 'Masabu B2B abonelik checkout’unda gösterilen sipariş ve sözleşme özeti.', '/yasal/mesafeli-hizmet-sozlesmesi')

export default function DistanceContractPage() {
  return <LegalDocument
    title="Elektronik Abonelik ve Sipariş Özeti"
    description="B2B ücretli abonelik checkout’unda müşteri, plan, dönem ve ödeme bilgileriyle oluşturulan sözleşme özeti."
    sections={[
      { title: '1. Sağlayıcı', content: <p>{LEGAL_IDENTITY.publicName}<br />{LEGAL_IDENTITY.address}<br />VKN {LEGAL_IDENTITY.taxNumber}<br /><a href={`mailto:${LEGAL_IDENTITY.generalEmail}`}>{LEGAL_IDENTITY.generalEmail}</a></p> },
      { title: '2. Ticari işlem niteliği', content: <p>Masabu işletmelere ticari veya mesleki amaçla sunulur. Bu sayfa tüketiciye yönelik mesafeli satış ön bilgilendirme formu değildir; uzaktan kurulan B2B abonelikte müşteriye gösterilecek fiyat, kapsam ve kabul kaydının örneğidir. Emredici mevzuattan doğan haklar saklıdır.</p> },
      { title: '3. Müşteri ve sipariş özeti', content: <p>Bağlayıcı özette müşterinin ticari unvanı veya ad-soyadı, VKN/TCKN türü, vergi dairesi, fatura adresi ve e-posta adresi; seçilen Starter/Plus/Pro planı, aylık/yıllık dönem, KDV hariç liste fiyatı, KDV oranı ve tutarı, KDV dâhil ödenecek genel toplam, yenileme düzeni ve sözleşme zamanı yer alır. Business paketi self-servis satın alınmaz; kapsam ve fiyat satış görüşmesinde belirlenir.</p> },
      { title: '4. Kuruluş ve dijital teslim', content: <p>Sözleşme, müşterinin sipariş özetini ve güncel B2B Abonelik Hizmet Sözleşmesini elektronik ortamda onaylamasıyla kurulur. Dijital hizmet, ödeme kuruluşunun başarılı işlem bildirimi sonrasında plan yetkilerinin Masabu hesabında etkinleştirilmesiyle teslim edilir.</p> },
      { title: '5. Ödeme ve fatura', content: <p>Ödeme iyzico tarafından güvenli biçimde işlenir. Masabu kart numarasını saklamaz. Doğrulanmış ödeme referansı abonelik ve fatura kaydıyla eşleştirilir; müşterinin fatura profiline göre e-Fatura veya e-Arşiv süreci başlatılır.</p> },
      { title: '6. İptal ve iade özeti', content: <p>Starter, Plus ve Pro taahhütsüzdür. İptal mevcut ürün akışında ücretli erişimi derhâl durdurur ve yeni yenileme tahsilatını engeller. Kullanılmış dönemin kalan kısmı için otomatik oransal iade yapılmaz; mükerrer/hatalı tahsilat ve teslim edilmeyen hizmet talepleri <a href="/yasal/iptal-iade-ve-dijital-teslimat">İptal, İade ve Dijital Teslimat Politikası</a>na göre incelenir.</p> },
      { title: '7. Elektronik kabul kaydı', content: <p>Sözleşme türü ve sürümü, kullanıcı, plan, dönem, net fiyat, KDV oran/tutarı, ödenecek genel toplam, kabul zamanı, tarayıcı bilgisi ve güvenli istek özeti elektronik ortamda kayıt altına alınır. Müşteri güncel yasal metinlere masabu.co/yasal adresinden erişebilir.</p> },
      { title: '8. Uygulanacak belgeler', content: <p>Bu özet; <a href="/yasal/abonelik-hizmet-sozlesmesi">B2B Abonelik Hizmet Sözleşmesi</a>, <a href="/yasal/gizlilik-politikasi">Gizlilik Politikası</a> ve satın alma anında gösterilen paket/fiyat bilgileriyle birlikte uygulanır. Çelişki hâlinde emredici hukuk ve özel olarak kabul edilen ticari koşullar önceliklidir.</p> },
    ]}
  />
}
