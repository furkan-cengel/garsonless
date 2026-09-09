import { LegalDocument } from '../../../components/LegalDocument'
import { LEGAL_IDENTITY } from '../../../lib/legal-identity'
import { legalMetadata } from '../../../lib/legal-metadata'

export const metadata = legalMetadata('KVKK Başvuru Yöntemleri', 'KVKK kapsamındaki ilgili kişi başvurularının iletilme yöntemleri.', '/yasal/kvkk-basvuru-yontemleri')

export default function KvkkApplicationPage() {
  return <LegalDocument
    canonical="/yasal/kvkk-basvuru-yontemleri"
    title="KVKK Başvuru Yöntemleri"
    description="6698 sayılı Kanun’un 11. maddesindeki haklarınızı kullanmak için başvurunuzda bulunması gereken bilgiler."
    sections={[
      { title: '1. Başvuru kanalları', content: <><p>Başvurunuzu “Kişisel Verilerin Korunması Kanunu Kapsamında Bilgi Talebi” açıklamasıyla yazılı olarak {LEGAL_IDENTITY.address} adresine veya masabu sisteminde daha önce kayıtlı e-posta adresinizi kullanarak <a href={`mailto:${LEGAL_IDENTITY.privacyEmail}`}>{LEGAL_IDENTITY.privacyEmail}</a> adresine iletebilirsiniz.</p><p>Güvenli elektronik imza veya mobil imza kullanıyorsanız, mevzuatın izin verdiği elektronik yöntemle de başvurabilirsiniz. {LEGAL_IDENTITY.kep ? <>KEP adresi: {LEGAL_IDENTITY.kep}.</> : <>masabu’nun kamuya açık bir KEP adresi henüz bulunmadığından KEP kanalı şu aşamada sunulmamaktadır.</>}</p></> },
      { title: '2. Zorunlu başvuru bilgileri', content: <ul><li>Ad ve soyad; yazılı başvuruda imza,</li><li>Türkiye Cumhuriyeti vatandaşları için T.C. kimlik numarası, yabancılar için uyruğu, pasaport numarası veya varsa kimlik numarası,</li><li>Tebligata esas yerleşim yeri veya işyeri adresi,</li><li>Varsa bildirime esas e-posta adresi, telefon ve faks numarası,</li><li>Talep konusu ve KVKK’nın 11. maddesi kapsamında kullanılmak istenen hak,</li><li>Varsa masabu hesabında kullanılan e-posta, ilgili işletme ve talebi destekleyen bilgi/belgeler.</li></ul> },
      { title: '3. Örnek başvuru düzeni', content: <><p>Başvurunuzu şu sırayla hazırlayabilirsiniz: başvuru sahibi bilgileri; masabu veya ilgili restoranla ilişkiniz; talebin konusu; talep edilen işlem; yanıt kanalı; tarih ve yazılı başvuruda imza.</p><p>Bu düzenin kullanılması zorunlu değildir. Ancak kimliğin doğrulanamadığı, talebin belirsiz olduğu veya zorunlu bilgilerin bulunmadığı başvurular için eksiklerin tamamlanması istenebilir.</p></> },
      { title: '4. Temsilci ve kimlik doğrulama', content: <p>Başvuru yasal temsilci veya vekil tarafından yapılıyorsa yetkiyi gösteren belge eklenmelidir. Kişisel verilerin yetkisiz kişilere açıklanmaması için ek doğrulama istenebilir. Kimlik belgesinde yalnız doğrulama için gereken alanlar açık bırakılmalı; fotoğraf ve ilgisiz bilgiler kapatılmalıdır.</p> },
      { title: '5. Yanıt süresi ve ücret', content: <p>Usulüne uygun başvurular, talebin niteliğine göre en kısa sürede ve en geç otuz gün içinde sonuçlandırılır. İşlem ayrıca maliyet gerektirmiyorsa ücretsizdir; maliyet doğması hâlinde Kişisel Verileri Koruma Kurulu tarafından belirlenen tarifedeki ücret talep edilebilir.</p> },
      { title: '6. Yanıt ve Kurula şikâyet', content: <p>Yanıt başvuruda tercih edilen yöntemle iletilir. Başvurunun reddedilmesi, verilen yanıtın yetersiz bulunması veya süresinde yanıt verilmemesi hâlinde, KVKK’da belirtilen süreler içinde Kişisel Verileri Koruma Kuruluna şikâyet hakkı kullanılabilir.</p> },
    ]}
  />
}
