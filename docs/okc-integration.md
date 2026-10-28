# ÖKC (yeni nesil yazarkasa) entegrasyonu

Durum: tasarım. Kod yok; ilk üretici programına başvuru bekleniyor.

## Mevzuat özeti

Kaynaklar: GİB "ÖKC Kullanan Mükelleflerin Yükümlülükleri" sunumu ve
[GMP-3 v4.0](https://ynokc.gib.gov.tr/UploadedFiles/Files/GMP3_v40_26122017.pdf) bölüm 6.1.

- Self servis, masada servis veya kapıya teslim yapan lokanta ve restoranlarda sipariş alma
  sistemi YN ÖKC ile entegre ve bağlantılı çalışmak zorunda (483 Sıra No.lu VUK Genel Tebliği,
  1/10/2018). Masabu bu "harici sistem"dir.
- Mali fişi yalnızca ÖKC üretir. Masabu'nun her çıktısı bilgi amaçlıdır ve
  "MALİ DEĞERİ YOKTUR · FİŞ YERİNE GEÇMEZ" ibaresini taşır (6.1/15).
- 6.1/17: sipariş ayrıntıları ÖKC TSM merkezlerinde 5 yıl saklanır, ödeme öncesi ÖKC'de
  "Hesap Özeti Bilgi Fişi" düzenlenirse, sipariş bilgisi ana ÖKC ve GMP-3 kablolu bağlantı
  olmadan, TSM üzerinden kablosuz gönderilebilir. Bulut tabanlı Masabu için yol budur.
- 6.1/10 ve /8: masada veya kapıda alınan ödeme EFT-POS özellikli YN ÖKC'de sonlandırılır;
  kartlı ödemede banka slibi ÖKC fişiyle bütünleşiktir.
- 6.1/7: internet gibi harici kanallardan gelen siparişler de ÖKC'ye iletilip fişe dönüşür.
- Tüm satışlarına e-Fatura/e-Arşiv düzenleyen mükellef, vergi dairesine başvurarak ÖKC
  kullanımından muaf olabilir (483 SN Tebliğ md. 6). Muafiyet re'sen değildir.

Açık hukuki soru (mali müşavir / özelge): QR menüden iyzico ile alınan masa ödemesinin
belgelendirilmesi. 6.1/10 masadaki ödemenin ÖKC'de bitmesini istiyor; sanal POS ödemesi ÖKC'ye
uğramıyor. Seçenekler: ödemeyi ÖKC'de "diğer ödeme" olarak kapatmak, e-Arşiv kesmek veya QR
ödemeyi ÖKC'li işletmelerde kapatmak.

## Üretici programları

| Marka | Yol | Başvuru |
|---|---|---|
| Token, Beko (X30TR, 300TR) | TokenX Connect Cloud: REST, webhook | [Token Appstore](https://appstore.tokeninc.com/) "Çözüm Ortağı Ol"; client-id/secret Token verir |
| Pavo | Pavo Cloud: işyeri PavoPay panelinde API anahtarı üretir, cihaz seri no + eşleşme kodu | Pavo kurumsal iletişim |
| Hugin (S1, T300…) | Cloud Link (REST v1) veya PC Link (yerel REST) | [developer.hugin.com.tr](https://developer.hugin.com.tr/) teknik destek; NDA + test cihazı |
| Profilo / Propay | Kablolu ve kablosuz entegrasyon | [Propay entegrasyon başvuru formu](https://www.propay.com.tr/entegrasyon-basvuru-formu/) |
| Ingenico (Move 5000F, IDE/IWE280, PAX A910SF) | GMP-3 / TSM; aktivasyon iKasa üzerinden | Ingenico Türkiye / iKasa |

Token belgesi herkese açık ve restorana uygun olduğu için ilk adaptör Token'dır
([geliştirici dokümanı](https://developer.tokeninc.com/token-developer-portal-1/x-platform/token-x-connect-cloud/gelistirici-dokumani-tr)):

- `POST /v1/auth/token` (Basic client-id:secret) → 24 saatlik bearer token.
- Terminal `mode 0`: sepetler listelenir, masada/kapıda ödenir. `mode 1`: kasada anlık ödeme.
- Get Fiscal Parameters → `sections[]` (`sectionNo`, `taxPercent`); her kalem bir bölüme eşlenir.
- Add Basket: `basketID` (benzersiz, tekrar → 1007), `title` (masa), `filter` (alan), `checkNumber`,
  `items[] {name, price, sectionNo, taxPercent, quantity}`. Update Basket (PUT, dizinin son hali),
  Delete Basket, Unlock Basket. Açık sepetler en fazla 3 gün tutulur.
- Webhook: `BASKET_COMPLETED` (`status` 0 ödendi, -1 vazgeçildi, 99 fiş iptali; `receiptNo`, `zNo`,
  `paymentItems[] {type, amount, …}`), `BASKET_LOCKED` / `BASKET_UNLOCKED`.
- Webhook imzası yok, yalnızca isteğe bağlı "Callback Auth". Masabu bir webhook'u, sepeti Get
  Basket Details ile Token'dan yeniden okuyarak doğrular; gövdeye güvenmez.

## Masabu mimarisi (öneri)

Sağlayıcıdan bağımsız bir `FiscalDevicePort` ve her üretici için bir adaptör; yapı e-fatura
tarafındaki `invoice-provider` / Nilvera düzenine benzer.

- **Kurulum (sahip):** Ayarlar › Yazarkasa: sağlayıcı, kimlik bilgileri (Vault'ta), şube/terminal,
  mod. Menü kategorisi → ÖKC bölümü (`sectionNo`) ve KDV eşlemesi; eşlenmemiş ürün varsa hesap
  ÖKC'ye gönderilmez.
- **Adisyon → sepet:** Masa adisyonu açıkken sepet oluşur (`basketID` = adisyon id), sipariş
  eklendikçe/iptal edildikçe güncellenir (Update Basket, son hal). Bu, 6.1/2-4'teki "adisyon
  boyunca kayıt" ilkesine en yakın davranıştır.
- **Ödeme:** Garson ÖKC'de masayı seçip kart/nakit alır. `BASKET_COMPLETED` geldiğinde adisyon
  ödendi olur; ödeme türü, fiş no ve Z no saklanır. Kısmi ödeme ve hesap bölme `paymentItems`
  ile eşlenir.
- **Kayıt:** `fiscal_documents` (restoran, adisyon, sağlayıcı, basketID, durum, receiptNo, zNo,
  ödeme kalemleri, ham olay), yalnızca service_role; tenant silme ve 5 yıllık saklama kuralları
  ayrıca belirlenir.
- **Dayanıklılık:** Gönderimler outbox worker ile tekrar denenir; webhook idempotenttir
  (basketID + status); kilitli sepet (1018) ve cihaz bulunamadı (1106) durumları Pano'da iş
  olarak görünür.
- **Online ödeme:** Hukuki soru çözülene kadar ÖKC bağlı restoranda QR ödeme kapalı tutulabilir.

## Sıradaki adımlar

1. Sahip: Token "Çözüm Ortağı Ol" başvurusu ve test cihazı (X30TR); Propay formu; Pavo, Hugin ve
   Ingenico/iKasa ile iletişim. Başvurularda: firma, yazılım adı (Masabu), bağlantı tipi bulut /
   kablosuz, sektör restoran-kafe, tahmini işletme sayısı, iletişim.
2. Sahip: mali müşavire QR ödeme sorusu.
3. Kod: `FiscalDevicePort`, kurulum ekranı ve Token adaptörü; test kimlik bilgileri gelince DEV'de
   uçtan uca deneme.
