# Masabu canlı yayın ve pazarlama hazırlığı — 10 Eylül 2026

Durum: **9ccb481 marketing ve dashboard üretim yayını tamamlandı; canlı çerez kontrolleri geçti. Gerçek müşteri yolculuğu ve hesap kontrolleri işlem bekliyor.** Bu dosya güncel iş listesidir; [9 Eylül kaydı](../google-readiness-2026-09-09/README.md) geçmiş kanıtları korur.

“Tamamlandı” yalnız belirtilen kapsamı kapsar. HTTP 200, indekslenme; yerel taklit GA testi, gerçek DebugView; içerik taslağı, yayınlanmış medya anlamına gelmez.

## Durum tablosu

| İş | Durum | Son kontrol | Kanıt / sonraki adım |
| --- | --- | --- | --- |
| Son çerez sürümü | Tamamlandı — canlı | 10 Eylül 10:01 TRT | [Masaüstü ve mobil canlı test](live-consent-after-release.json) geçti; marketing sabit düğmesi yok, footer çalışıyor. |
| Marketing + dashboard üretim derlemesi | Tamamlandı | 10 Eylül | İki production build başarılı. GA4 etkinleştirilmedi. |
| Üretim yayını | Tamamlandı — marketing/dashboard | 10 Eylül | Kullanıcının açık onayıyla main push; [dağıtım kaydı](deployments-after-release.json). Yeni footer canlı HTML’de mevcut. |
| Canlı sitemap/canonical | Tamamlandı — yayın sonrası HTTP | 10 Eylül | [25/25 adres 200 ve doğru canonical](public-http-after-release.json); signup indeks dışı, olmayan adres 404. |
| Canlı mobil sayfalar | Tamamlandı — salt okunur | 10 Eylül | [9 hedef sayfa](public-mobile-before-release.json): 200, yatay taşma yok, GA isteği yok. Form gönderilmedi. |
| Gerçek müşteri yolculuğu | İşlem bekliyor | 10 Eylül | Kayıt → e-posta doğrulama → deneme kullanıcıyla yapılacak; sayfa erişim kontrolü bunun yerine geçmez. |
| Search Console sitemap | Tamamlandı | 10 Eylül | Kullanıcının bu oturumda paylaştığı Site Haritaları ekranı: `https://masabu.co/sitemap.xml`, Başarılı, 25 keşfedilen sayfa, 0 video; gönderim ve son okuma 9 Eylül 2026. |
| Search Console indeks raporu | İşlem bekliyor — Google veri işliyor | 10 Eylül | Kullanıcının Sayfa sayısı ekranında “Veri işleniyor, lütfen birkaç gün içinde tekrar kontrol edin” görünüyor. İndekslenen/dışlanan sayfa sayıları ve nedenler henüz raporlanmadı; sıfır veya hata diye kaydedilmedi. Altı önemli URL tek tek denetlendi: tamamı indeksli ve Google canonical seçimi beyan edilen adresle eşleşiyor. Toplu indeks raporu hâlâ veri işliyor; önceki talepler tekrarlanmadı. |
| Search Console ana sayfa URL denetimi | Tamamlandı — indeks ve canonical | 10 Eylül | Kullanıcı ekranları: `https://masabu.co/` indekslendi, HTTPS başarılı. Son tarama 10 Eylül 2026 03:05:03 (ekranda gösterilen saat); Googlebot akıllı telefon; tarama ve indeks izni Evet, sayfa getirme Başarılı. Beyan edilen canonical `https://masabu.co/`, Google seçimi İncelenen URL: eşleşiyor. Yeni indeksleme isteği gönderilmedi. |
| Search Console fiyat URL denetimi | Tamamlandı — indeks ve canonical | 10 Eylül | Kullanıcı ekranı: `https://masabu.co/fiyatlar` dizine eklendi; sitemap `https://masabu.co/sitemap.xml`. Son tarama 9 Eylül 2026 13:15:52 (ekranda gösterilen saat), Googlebot akıllı telefon. Tarama/indeks izni Evet, sayfa getirme Başarılı. Beyan edilen canonical incelenen URL ile aynı; Google seçimi İncelenen URL. Yönlendiren sayfa algılanmadı; yeni indeksleme isteği gönderilmedi. |
| Search Console QR menü URL denetimi | Tamamlandı — indeks ve canonical | 10 Eylül | Kullanıcı ekranı: `https://masabu.co/qr-menu` dizine eklendi. Son tarama 9 Eylül 2026 13:17:53 (ekrandaki saat), Googlebot akıllı telefon. Tarama/indeks izni Evet, sayfa getirme Başarılı. Beyan edilen canonical aynı URL, Google seçimi İncelenen URL. Sitemap alanında Geçici işleme hatası; ayrı rapor başarılı olduğundan raporlama notu olarak takipte. Yönlendiren sayfa algılanmadı. Yeni indeksleme isteği gönderilmedi. |
| Search Console dijital adisyon URL denetimi | Tamamlandı — indeks ve canonical | 10 Eylül | Kullanıcı ekranı: `https://masabu.co/dijital-adisyon` dizine eklendi; sitemap `https://masabu.co/sitemap.xml`. Son tarama 9 Eylül 2026 13:17:53 (ekrandaki saat), Googlebot akıllı telefon. Tarama/indeks izni Evet, sayfa getirme Başarılı. Beyan edilen canonical aynı URL; Google seçimi İncelenen URL. Yönlendiren sayfa algılanmadı. Yeni indeksleme isteği gönderilmedi. |
| Search Console QR sipariş URL denetimi | Tamamlandı — indeks ve canonical | 10 Eylül | Kullanıcı ekranı: `https://masabu.co/qr-siparis` dizine eklendi; sitemap `https://masabu.co/sitemap.xml`. Son tarama 9 Eylül 2026 13:19:53 (ekrandaki saat), Googlebot akıllı telefon. Tarama/indeks izni Evet, sayfa getirme Başarılı. Beyan edilen canonical aynı URL; Google seçimi İncelenen URL. Yönlendiren sayfa algılanmadı. Yeni indeksleme isteği gönderilmedi. |
| Search Console mutfak ekranı URL denetimi | Tamamlandı — indeks ve canonical | 10 Eylül | Kullanıcı ekranı: `https://masabu.co/mutfak-ekrani` dizine eklendi. Son tarama 9 Eylül 2026 13:19:54 (ekrandaki saat), Googlebot akıllı telefon. Tarama/indeks izni Evet, sayfa getirme Başarılı. Beyan edilen canonical aynı URL; Google seçimi İncelenen URL. Sitemap alanında Geçici işleme hatası; yönlendiren sayfa algılanmadı. Geçici raporlama notu takipte; yeni indeksleme isteği gönderilmedi. |
| Search Console performans başlangıcı | Tamamlandı — toplam değerler | 10 Eylül | Kullanıcı ekranı: son 7 gün, Web; 1 tıklama, 1 gösterim, %100 TO, ortalama konum 4; son güncelleme 11 saat önce. Kullanıcı tıklamanın kendisine ait olabileceğini belirtti; kimliği doğrulanmadı. Kullanıcının devam ekranındaki tek sorgu `masabu`: 1 tıklama, 1 gösterim (marka adı araması). Kullanıcının Sayfa sayısı sekmesindeki tek adres `https://masabu.co/`: 1 tıklama, 1 gösterim. Performans başlangıç kaydı toplam, sorgu ve sayfa kırılımıyla tamamlandı; altı önemli URL’nin indeks/canonical kontrolü ayrıca tamamlandı. |
| Bing sitemap | Tamamlandı — işleme sonucu | 10 Eylül | Kullanıcının Sitemaps ekranı: `https://masabu.co/sitemap.xml`, Success; 1 bilinen sitemap, 25 keşfedilen URL, 0 hata, 0 uyarı. Son gönderim ve son tarama 9 Eylül 2026. Yeniden gönderim yapılmadı. |
| Bing ana sayfa URL denetimi | Tamamlandı — indeks durumu; uyarı incelemede | 10 Eylül | Kullanıcının ana sayfa denetimi devam ekranı: Indexed successfully / URL can appear on Bing. 1 SEO/GEO notice: Alt attribute for images is missing, 18 instances. OpenGraph bulundu. Uyarının görsel listesi henüz açılmadı; giderildi sayılmadı. |
| Bing indeks/tarama ve performans | İşlem bekliyor | 10 Eylül | Sitemap işleme sonucu doğrulandı; URL Inspection, tarama bulguları ve Search Performance başlangıç değerleri bekleniyor. 25 keşfedilen URL, 25 indekslenmiş URL olarak kaydedilmedi. |
| Google İşletme Profili | İşlem bekliyor | 10 Eylül | Kategori Yazılım Şirketi olarak ekranla, ofis harita işareti kullanıcı teyidiyle doğrulandı. Arama kartındaki eski kategori ifadesi takipte; bağımsız ziyaretçi görünümü/doğrulama sonucu ve kalan profil bilgileri kontrol bekliyor. |
| GA4 teknik izin akışı | Tamamlandı — yerel test | 10 Eylül | Mock isteklerle izin/ret/geri çekme ve alt alan akışı geçti; üretim açılış kapısı testi geçti. |
| GA4 değerlendirme ve gerçek DebugView | İşlem bekliyor | 10 Eylül | Kullanıcı sağlayıcı/aktarım değerlendirmesinin tamamlanmadığını bildirdi. GA4 kapalı kalır. |
| Meta Business Suite | İşlem bekliyor | 10 Eylül | FB–IG bağlantısı ve profil düzenlemeleri kullanıcı tarafından yapıldı; güncel profil, inbox ve planlayıcı erişimi kontrol edilecek. |
| LinkedIn | İşlem bekliyor | 10 Eylül | Kullanıcı açıklama/kapak düzenlemesini tamamladı; ziyaretçi görünümü ve yayın erişimi kontrol edilecek. |
| 30 günlük içerik metinleri/takvimi | Tamamlandı — taslak | 10 Eylül | [12 ana içerik, 8 hikâye seti, 4 LinkedIn metni](../social-launch-30-days.md); amaç, kapak, üretim yönergesi, gün ve UTM mevcut. |
| Bitmiş görseller/ekran kayıtları ve yayın | Eksik | 10 Eylül | Taslak incelemesinden sonra gerçek test ekranlarından üretim; hiçbir içerik gönderilmedi veya planlanmadı. |
| Mobil performans/erişilebilirlik/menu paketi | Eksik | 10 Eylül | Aşağıdaki ayrı teknik işler; eski başarısız kontroller yeşil sayılmadı, eşikler yükseltilmedi. |

## Yerel doğrulama ve yayın paketi

### Google İşletme Profili kullanıcı ekranı — 10 Eylül

**Ziyaretçi görünümü güncellemesi işlem bekliyor — 10 Eylül:** Gizli sekmede işletme kartı ve Yazılım Şirketi kategorisi kontrolü istendikten sonra kullanıcı “yok henüz güncellenmemiş” dedi. Güncel bilgilerin ziyaretçi görünümüne yansıdığı doğrulanmadı. Kullanıcı kartın hiç görünmemesi ile eski kategori göstermesini ayırmadığından bu iki durumdan biri kesin olarak yazılmadı. Yönetici ekranındaki doğru bilgiler yeniden değiştirilmedi; kapak son görülen durumda beklemede. Google tarafındaki bekleme Meta kontrollerini durdurmuyor.

**Hizmet açıklamaları tamamlandı — 10 Eylül:** QR Menü, QR Sipariş, Dijital Adisyon ve Mutfak Ekranı için 300 karakter sınırı içindeki açıklamalar kullanıcıya verildi; son açıklamadan sonra kullanıcı “Tamamdur” diyerek adımı tamamladığını bildirdi. Kanıt kullanıcı beyanıdır; dört hizmetin yayın/onay durumu ve ziyaretçi görünümü ayrıca doğrulanmadı. QR Menü düzenleme ekranı görüldü, fiyat alanı “Fiyat yok” bırakılması önerildi. Açıklamalara kurulum veya bölge eklenmedi; sipariş/adisyon/mutfak özellikleri paket kapsamına bağlandı. Sonraki kontrol oturum kapalı ziyaretçi görünümünde profil, kategori ve hizmetler; kapak son görülen durumda beklemede.

**Hizmet açıklamaları için alan düzeltmesi — 10 Eylül:** Kullanıcı boş Ürün ekle formunu paylaştı; ürün yayınlanmadı. [Google ürün düzenleyici rehberi](https://support.google.com/business/answer/9124203?hl=en) bu alanı fiziksel ürün satan yerel mağazalar için tanımlıyor ve hizmetler için hizmet düzenleyiciye yönlendiriyor. Masabu'nun yazılım hizmetlerini tanıtmak üzere önceki Ürünleri düzenle yönlendirmesi düzeltildi: kullanıcı **Hizmetleri düzenle** bölümünden devam edecek. [Hizmet rehberi](https://support.google.com/business/answer/9455399?hl=en) özel hizmet adları ve açıklamalarının eklenmesini destekliyor. QR menü, QR sipariş, dijital adisyon ve mutfak ekranı açıklamaları henüz hesaba eklenmedi.

**Logo ve kapak yükleme ekranı — 10 Eylül:** Kullanıcının Fotoğraflar ve videolar ekranında kare Masabu simgesi “Logoyu değiştir”, hazırlanan kapak “Kapağı değiştir” kartında görünüyor. İki yükleme ekran kanıtıyla doğrulandı. Kapakta açıkça **BEKLEMEDE** etiketi var; kapak yayını işlem bekliyor. Logoda bu görüntüde bekleme etiketi görünmüyor; bağımsız ziyaretçi görünümü yine doğrulanmadı. Kapak başlığı yönetim kartının kare önizlemesinde yanlardan kesiliyor; tam görselin veya ziyaretçi görünümünün aynı kırpmayı kullandığı varsayılmadı. Onay sonrasında görüntüleme kontrolü yapılacak. Sonraki hesap adımı ürün/hizmet açıklamalarını kontrol etmek.

**Kapak dosyası hazır — 10 Eylül:** Kullanıcının talebiyle built-in image_gen kullanılarak mevcut Masabu wordmark referanslı yeni kapak üretildi: [PNG](../../../assets/brand/social/masabu-google-cover-v1.png), [üretim komutu](../../../assets/brand/social/masabu-google-cover-v1-prompt.md). Krem/yeşil tasarımda “QR menüyle başla.”, “Sipariş, adisyon ve mutfağı aynı sistemden yönet.” ve masabu.co kullanıldı. Metin ve görüntü kontrol edildi. Dosya hazırlanması tamamlandı; kullanıcı yüklemesi ve Google görsel onayı işlem bekliyor.

**Logo yükleme tamamlandı — 10 Eylül:** Kare Masabu logosu yönlendirmesinden sonra kullanıcı “ekledim” dedi. Yükleme kullanıcı beyanıyla doğrulandı; Google'ın görsel onayı ve ziyaretçi görünümü henüz kontrol edilmedi. Kapak görseli eksik olarak devam ediyor.

**Logo/kapak: eksik — 10 Eylül:** Kullanıcı Fotoğraflar kontrolünde yüklenmediğini bildirdi. Mevcut kare marka simgesi `assets/brand/masabu-m-favicon-512x512.png`; yükleme kullanıcı tarafından yapılacak. Görsellerin yüklendiği veya onaylandığı henüz doğrulanmadı.

**İletişim kontrolü tamamlandı — 10 Eylül:** Telefon 0850 840 3965 ve web sitesi https://masabu.co/ kontrolü istendikten sonra kullanıcı “tamam sıkıntı yok” yanıtıyla bilgileri doğruladı. Kanıt kullanıcı beyanıdır; telefon araması yapılmadı. Sonraki kontrol profil logo/kapak görselleri; bağımsız ziyaretçi görünümü ve arama kartındaki kategori farkı hâlâ takipte.

**Çalışma saatleri kontrolü tamamlandı — 10 Eylül:** Kullanıcı “çalışma saatlerinde de sıkıntı yok” diyerek mevcut saatleri doğruladı. Kanıt kullanıcı beyanıdır; haftalık saatlerin ayrıntısı paylaşılmadığından gün/saat değerleri rapora eklenmedi. Sonraki kontrol İletişim sekmesindeki telefon ve web sitesi bağlantısı.

**Konum kontrolü tamamlandı — 10 Eylül:** Kullanıcı Konum sekmesini paylaştı ve kırmızı işaretin ofisin bulunduğu binayı gösterip göstermediği sorusuna “doğru” yanıtını verdi. Kanıt: kullanıcı ekranı ve açık teyidi. Harita işareti değiştirilmedi. Önceki Tuzla yorumu yakındaki hastane etiketinden çıkarılmıştı; kesin coğrafi tespit değildi ve konum hatası şüphesi kullanıcı teyidiyle kapatıldı. Sonraki kontrol haftalık çalışma saatleri.

Sonraki kullanıcı ekranı: İşletme bilgileri → Hakkında altında işletme adı masabu, kategori **Yazılım Şirketi**. Görünen alanda bekleyen değişiklik uyarısı yok. Kategori kayıt kontrolü tamamlandı; önceki arama kartındaki kategori farkının nedeni veya ne zaman güncelleneceği kesinleştirilmedi. Görünen açıklama QR menü, sipariş, dijital adisyon ve mutfak yönetimini anlatıyor; özellikleri seçilen pakete bağlıyor, görünen bölümde kurulum/bölge ifadeleri yok. Açıklamanın sonu ekran dışında. Sonraki kullanıcı adımı **Konum** sekmesinden kayıtlı adres ve harita işaretini incelemek.

Kanıt: Kullanıcının Google'da işletmeniz yönetici paneli ve masabu bilgi kartı ekran görüntüsü. Önceki doğrulama inceleme uyarısı bu görüntüde yok; bu tek başına doğrulamanın tamamlandığı veya profilin herkese açık olduğunun kanıtı sayılmadı. Kartta “İstanbul'da bir alışveriş merkezi” yazıyor; kullanıcı daha önce kategori düzeltmesini bildirmişti, değişikliğin kaydedilme/onay durumu henüz görülmedi. Adres Maltepe, harita işareti ise Tuzla Devlet Hastanesi çevresinde görünüyor; gerçek konum ve işaret düzenleme ekranında kontrol bekliyor. Telefon 0850 840 3965, bugünkü kapanış 18:00, web sitesi düğmesi görünür; haftalık saatler ve düğmenin hedefi bu ekranda doğrulanmadı. Sonraki adım Profili düzenle üzerinden mevcut işletme kategorisini ve varsa bekleyen değişikliği görmek.

10 Eylül son çalışma ağacında:

- Marketing birim testleri: 38 geçti. Domain analitik testleri: 4 geçti.
- Ortak UI typecheck ve ilgili dosyalarda ESLint geçti.
- `node --test scripts/marketing-analytics-config.test.mjs`: 1 geçti; değerlendirme olmadan production analitiği açılmasını engelliyor.
- `pnpm exec playwright test --config=playwright.marketing-readiness.config.ts`: GA taklitli koşuda 3 geçti, yalnız GA kapalı koşuya ait 1 senaryo atlandı.
- `MARKETING_TEST_ANALYTICS_DISABLED=1 pnpm exec playwright test --config=playwright.marketing-readiness.config.ts --grep 'cookie notice opens automatically'`: kapalı durum senaryosu 1 geçti.
- Marketing ve dashboard üretim derlemeleri geçti. [Derleme ve tarayıcı çıktı özeti](verification.txt).

Tarayıcı kapsamı: ilk ziyaret, kabul/ret, yeniden yükleme, çerez temizleme, footer’dan açma, mobil/klavye erişimi, URL temizleme, yinelenmeyen olaylar ve alt alan kayıt işaretleri. Tarayıcı Google sınırını taklit eder; canlı kayıt veya Google’a test verisi göndermez. `essential` seçimi ileride GA açılması için izin sayılmaz. Yalnız geçmişi silmek, çerez korunuyorsa tercihi sıfırlamaz.

Paket önceki yayımlanmamış `05a5ccf` değişikliklerini ve son popup/tercih düzenlemelerini içerir. Marketing ve dashboard birlikte yayımlanmalıdır. Veritabanı şeması, yeni API veya yeni takip sağlayıcısı eklenmez. GA4 ID/aktarım onayı açılmaz.

10 Eylül 2026 kullanıcı yayın onayı sonrasında `9ccb481a628ebaa2d053391ef0d90ccff56cf2ba` main dalına gönderildi. Bağlı altı Vercel dağıtımının tamamı başarılı: marketing, dashboard, menu, kitchen, sandbox ve platform-admin. [Canlı çerez kanıtı](live-consent-after-release.json): masaüstü ve iPhone 13 koşuları geçti; ilk popup, kabul/ret, yenileme, gezinme, çerez temizleme, footer açma, klavye odağı ve alt alan tercih paylaşımı doğrulandı. GA isteği ve GA çerezi sayısı sıfır; GA kapalı kaldı. [Mobil görünüm](live-cookie-mobile.png), [masaüstü görünüm](live-cookie-desktop.png). Gerçek kayıt/e-posta doğrulama/deneme bu testte yapılmadı ve hâlâ bekliyor.

## Kullanıcıyla hesap kontrolleri

Her ekran için tarih, seçilen mülk/kanal, sonuç ve ekran kanıtı kaydedilir. Parola, doğrulama kodu veya özel müşteri bilgisi istenmez.

1. **Search Console:** `masabu.co` → Site Haritaları: son okuma, durum ve keşfedilen sayfa sayısı. Performans: son 7 gün tıklama/gösterim; veri oluşmadıysa “veri yok”. Ana sayfa, `/fiyatlar`, `/qr-menu`, `/dijital-adisyon`, `/qr-siparis`, `/mutfak-ekrani` için indeks durumu, Google’ın seçtiği canonical ve gerekçe. Amaç, erişilebilir sayfanın Google tarafından nasıl işlendiğini görmek. Bekleyen URL için tekrar tekrar istek gönderilmez. Manuel işlemler ve güvenlik raporları da kaydedilir; gereksiz yeni mülk açılmaz.
2. **Bing:** Masabu → Sitemaps: durum, son işleme, adres sayısı; önemli altı URL ve Site Scan/tarama bulguları. Amaç, içe aktarımın gerçekten işlendiğini doğrulamak. Yalnız “import edildi” yeterli kanıt değildir.
3. **Google İşletme:** doğrulama sonucu ve ziyaretçi görünümü; yazılım faaliyetini karşılayan kategori, telefon, saatler, adres görünürlüğü, logo/kapak, ürün açıklamaları ve site. Adres görünürlüğü gerçek müşteri kabul düzenine göre kullanıcı tarafından doğrulanır. Açıklamaya kurulum veya bölge eklenmez. Google’ın bekleyen incelemesi hata diye işaretlenmez.
4. **Meta:** Masabu FB sayfası ve `masabuco` Instagram hesabı seçili mi; ziyaretçi görünümünde marka adı, bio, site bağlantısı ve görseller; birleşik inbox ve planlayıcı açılıyor mu. Amaç, iki kanalda talep yönetimi ve yayın erişimini doğrulamak. Test için dışarı mesaj gönderilmez; gönderi yayınlanmaz.
5. **LinkedIn:** `linkedin.com/company/masabu/` → View as member: açıklama, başlık, logo, kapak ve site; yönetici görünümünde taslak hazırlama erişimi. Amaç, ziyaretçinin gördüğü marka bilgilerini tutarlı hale getirmek.

## GA4 değerlendirmesinin kapanması

### Analytics öncelikli yeniden kontrol — 10 Eylül

Kullanıcı Meta kontrolünü erteleyip Analytics'in aktif olup olmadığının ayrıntılı incelenmesini istedi. Sağlayıcı/aktarım değerlendirmesi sorusuna “Bilmiyorum ki” yanıtı verdi; tamamlandı olarak işaretlenmedi. [Ayrıntılı hesap ve açılış listesi](ga4-activation-checklist.md) hazırlandı.

[Canlı yeniden kontrol](ga4-live-status-recheck.json): 10 Eylül 11:30 UTC başlayan izole tarayıcı testinde masabu.co ana sayfa ve app.masabu.co/auth/signup için seçim öncesi, kabul sonrası, yenileme ve ret durumları incelendi. Her aşamada GA yükleme girişimi 0, GA çerezi 0 ve GA script öğesi 0. Kabul essential, ret denied olarak saklandı; arayüz analitik/reklamın kapalı olduğunu belirtiyor. Bu kanıtla mevcut iki yüzeyde ölçüm kapalı olarak doğrulandı. Gerçek GA teslimatı/DebugView testi değildir.

İlk dış bağlantıları engellemeyen test, kabul seçiminin değerlendirme tamamlanmadan Google'a veri gönderebilmesi gerekçesiyle otomatik onay incelemesince çalıştırılmadan reddedildi. Güvenli alternatifte tüm masabu.co/app.masabu.co dışı ağ istekleri gönderilmeden engellendi, service worker kapatıldı; bu test onaylanıp tamamlandı. Google'a veri gönderilmedi, hesap/form işlemi yapılmadı, üretim ayarı değiştirilmedi.

**İşletmenin değerlendirme sonucu bekleniyor.** Google’daki Veri İşleme Şartları kabulü tek başına bu işi tamamlamaz. Bu liste karar için teknik bilgileri toplar; hukuki uygunluk sonucu üretmez.

| Değerlendirme girdisi | Mevcut teknik durum / gereken kayıt |
| --- | --- |
| Amaç ve kapsam | Marketing ziyaretleri ve kayıt/deneme adımları; uygulama içi müşteri operasyonu ölçülmez. |
| Olay/veri kapsamı | `page_view`, `signup_click`, `generate_lead`, `sign_up`, `trial_started`; izinli UTM alanları. Sayfa sorgu/fragment’i ve kişisel form değerleri gönderilmez. Tarayıcı bağlantısının sağlayıcıya taşıdığı teknik veri ayrıca değerlendirilir. |
| Sağlayıcı/sözleşme | Google Analytics; geçerli sözleşme tarafı, koşullar sürümü, işleme yerleri/alt işleyenler ve aktarım yöntemi işletmenin değerlendirmesinde belgelenecek. |
| Hesap kontrolleri | Enhanced measurement, Signals, reklam kişiselleştirme, user-provided data kapalı; kullanıcı beyanına göre iki ay saklama, reset kapalı. Güncel ekranla teyit edilecek. |
| Karar | Değerlendiren kişi, tarih, sonuç, uygulanacak koşullar ve belge referansı eksik. Kullanıcı tamamlandığını bildirmeden env açılmaz. |

Olumlu sonuç sonrası ayrı uygulama: aynı üretim ID’si iki uygulamada yapılandırılır → izin öncesi/ret sonrası hiç GA isteği olmaması → izinli olayların gerçek DebugView’de bir kez görünmesi → yenileme/geri gezinme/alt alan devamlılığı → geri çekme ve GA çerez temizliği. Test hesabı trafiği gerçek müşteri sonuçlarından ayrılır. Bu adım beklerken içerik üretimi devam eder.

## Kontrollü müşteri yolculuğu

Kullanıcıya ait özel test e-postası kullanılır; adres ve doğrulama bağlantısı rapora açık yazılmaz. Herhangi bir müşteriye ileti gönderilmez.

1. Temiz mobil tarayıcıda site → ürün → fiyat → demo → kayıt bağlantılarını kullan. Hedef sayfa, görünür hata ve yatay taşma kaydedilir.
2. Kontrollü test kaydı oluştur; e-posta doğrulamasını kullanıcı tamamlar. Tekrar tıklama/yenileme sonucunda çoğaltılmış kayıt olmamalı.
3. Onboarding tamamlanır; mevcut işletme kaydında Pro deneme başlangıç/bitişi görülür. Kart istenmemesi, panel erişimi ve hata olmaması kaydedilir.
4. Test işletmesi kimliği dahili kayda alınır; pazarlama raporu hazırlanırken mevcut kayıtlardan çıkarılır. Yeni takip tablosu eklenmez. Menü yayınlanacaksa mevcut `MENU_NOINDEX_RESTAURANT_IDS` dışlaması önce uygulanır.
5. Tarih, ortam, başarılı adımlar, varsa hata ve test işletmesi referansı kaydedilir. GA kapalıyken kanala ait dönüşüm uydurulmaz.

Bu uçtan uca test **henüz yapılmadı**; yerel simülasyon veya signup sayfasının 200 dönmesi yerine geçmez.

## Ayrı teknik işler

| Kimlik | İş ve kanıt | Yapılacak iş / kapanış ölçütü |
| --- | --- | --- |
| TECH-01 | Mobil LCP: 9 Eylül tek laboratuvar koşusunda ana sayfa 3,25 sn, fiyat 2,75 sn, QR menü 2,61 sn | Aynı cihaz/ağ koşullarında LCP öğesi, font ve kritik yük sırası incelenecek. İlgili sayfalarda 2,5 sn hedefi doğrulanacak; tek koşu saha garantisi sayılmaz. Mevcut eşik korunur. |
| TECH-02 | Aynı raporda renk kontrastı; fiyat sayfasında başlık sırası | Hatalı öğeler kaydedilip renkler ve semantik başlıklar düzeltilecek; aynı denetimler hatasız, mobil görünüm okunur olacak. Test atlanmaz. |
| TECH-03 | `/menu` hazır paket 357950 B > 357651 B; değişiklik öncesi CI’da da başarısız | Gereksiz başlangıç ithalatları bulunup daraltılacak; mevcut bundle testi özgün eşiğiyle geçecek. Onboarding kontrolünün geçmesi bu işi kapatmaz. |

Kaynak: [önceki Lighthouse/CI kaydı](../google-readiness-2026-09-09/README.md). Bu işler yayın paketinden ayrı takip edilir; düzeltmeleri henüz yapılmadı. Tüm CI’ın yeşil olduğu iddia edilmez.

## Ölçüm ve organik yayın

[30 günlük proje](../social-launch-30-days.md) içerik ve UTM kaynağıdır. Gün 1 ilk onaylı yayındır. İlk hafta başlangıç, 7/14/21/28. gün haftalık değerlendirme, 30. gün karşılaştırma yapılır. GA kapalıysa platform bağlantı tıklamaları ve mevcut kayıt/deneme sayıları ayrı gösterilir; bilinmeyen kanal katkısı boş kalır. Takipçi sayısı ana sonuç yerine kullanılmaz.

Başlangıç değerleri: Search Console son 7 gün Web **1 tıklama / 1 gösterim** (10 Eylül kullanıcı ekranı; olası kullanıcı testi, doğrulanmış müşteri kazanımı değil); Bing tıklama **bekliyor**; IG/FB/LinkedIn erişim ve bağlantı tıklamaları **bekliyor**; gerçek yeni deneme sayısı (test hariç) **bekliyor**. Bilinmeyenler sıfır değildir.

Başvuru kaynakları: [Google Search Console izleme yaklaşımı](https://developers.google.com/search/docs/monitor-debug/search-console-start), [Google İşletme doğrulama süreci](https://support.google.com/business/answer/7107242). Hesapta inceleme sürüyorsa güncel durum ve başvuru tarihiyle takip edilir.

## Yayın sonrası CI kaydı

- [Architecture CI](https://github.com/furkan-cengel/garsonless/actions/runs/34447450391): geçti.
- [Dashboard Visual Gate](https://github.com/furkan-cengel/garsonless/actions/runs/34447450349): başarısız; görsel matristen önce üretim route budget adımında `/menu ready 357966 B > 357651 B`. TECH-03 açık; eşik değiştirilmedi. Önceki 357950 B ölçümüyle aynı kalıcı sınır sorunu, bu koşuda 16 B daha büyük.
- [Tables Runtime Gate](https://github.com/furkan-cengel/garsonless/actions/runs/34447450342): regresyon testleri geçti; linked DEV kapısı `/menu ready 357855 B > 357651 B` bütçesinde kaldı (TECH-03).
- [Public Quality Gate](https://github.com/furkan-cengel/garsonless/actions/runs/34447450332): desktop Lighthouse geçti; mobile Lighthouse LCP/performance/CLS bütçeleri ve soğuk tarayıcı ürün etkileşim/LCP bütçesi başarısız. Bu CI koşusundaki LCP örnekleri 3558/4024 ms, düşük performans 0,69 ve yüksek CLS 0,247. Bunlar 9 Eylül canlı marketing ölçümleriyle aynı ortam değildir; doğrudan değişim yüzdesi çıkarılmaz. TECH-01 kapsamına mobil CLS ve soğuk önbellek etkileşimi de eklendi. Eşikler değiştirilmedi.
- Dört workflow’un tamamlanmış son durumları [CI durum dosyasında](ci-after-release.json) kayıtlıdır. Tam CI yeşil değildir.

Bu bölüm ve yayın sonrası JSON/PNG dosyaları üretim commit’inden sonra elde edilen yerel kanıtlardır; uygulama kodunu değiştirmez.

### Search Console ana sayfa bulma bilgisi — 10 Eylül

Kullanıcının ayrıntı ekranında Site Haritaları alanında “Geçici işleme hatası”, yönlendiren sayfada “Hiç yönlendiren sayfa algılanmadı” yazıyor. Ayrı sitemap raporu Başarılı / 25 sayfa ve URL indeks durumu başarılı. [Google açıklaması](https://support.google.com/webmasters/answer/9012289?hl=tr): geçici işleme hatası, raporlama sisteminin sitemap verisini alırken yaşadığı geçici sorundur; yeniden URL denetimi çözebilir. Site kodu hatası veya başarısız sitemap gönderimi olarak sınıflandırılmadı. Sonraki kontrolde yeniden bakılacak; sitemap silinmedi/yeniden gönderilmedi.

### Altı önemli URL kontrolünün kapanışı — 10 Eylül

Kullanıcının URL Denetimi ekranlarıyla ana sayfa, fiyat, QR menü, dijital adisyon, QR sipariş ve mutfak ekranı için indeks durumu, tarama izinleri/getirme sonucu ve Google canonical seçimi doğrulandı: 6/6 başarılı. Bu sonuç sitemap içindeki 25 sayfanın tamamının indekslendiği anlamına gelmez. Toplu indeks raporu veri işliyor; ana sayfa/QR menü/mutfak ekranındaki geçici sitemap raporlama notları sonraki kontrolde tekrar değerlendirilecek. Bing sitemap işleme sonucu sonraki kullanıcı ekranıyla doğrulandı; Bing URL indeks/tarama kontrolleri sıradadır.

### Bing alternatif metin uyarısı — 10 Eylül

Canlı ana sayfanın sunucudan dönen HTML görselleri incelendi: alt özniteliği olmayan img görülmedi; boş alt değerleri mevcut. Kaynak kodunda ProblemSolutionSection problem ağı aria-hidden=true; çözüm adımlarındaki görsellerin yanında açıklayıcı metin var. TrialSection QR/parçacık animasyonu aria-hidden=true olan dekoratif bölümde. Marka, kahvaltı ve ödeme görsellerinde açıklayıcı alt var. [W3C dekoratif görsel rehberi](https://www.w3.org/WAI/tutorials/images/decorative/) bu bağlamlarda boş alt kullanımını destekliyor. Bing’in eski taranmış sürümü/görsel listesi görülmeden 18 örneğin bunlarla birebir aynı olduğu ileri sürülmedi. Notice ayrıntı listesi kullanıcıdan bekleniyor. Kod değiştirilmedi; gerçek eksik ile kasıtlı boş alt ayrımı sonrası karar verilecek.

### Bing tarafından gösterilen yanıt parçası — 10 Eylül

Kullanıcının paylaştığı 7165 baytlık metin HTTP başlıklarını ve HTML head bölümünü içeriyor; `<body` başlangıcında kesiliyor, hiçbir img etiketi veya 18 uyarı örneğinin listesi yok. Yanıt Date başlığı `Mon, 07 Sep 2026 05:04:38 GMT`, başlık `masabu — Kafenizi 2 dakikada akıllandırın`. Bu tarih HTTP yanıtının başlığıdır; Bing son tarama tarihi olduğu ileri sürülmedi. Paylaşım, 10 Eylül yayınının son HTML sürümünü doğrulamıyor. Uyarının eski sürümden kaynaklanmış olması mümkün; örnek görseller görülmeden giderildi/yanlış pozitif kararı verilmedi. Kullanıcıdan SEO/GEO Notice ayrıntılarındaki görsel örnekleri bekleniyor.

Kullanıcının sonraki paylaşımı Bing uyarısının genel “What is the issue about? / How to fix?” açıklamasıdır; 18 görselin URL/HTML örneklerini içermiyor. Aynı ayrıntı tekrar istenmek yerine güncel sürümü kontrol etmek üzere URL Inspection → Live URL adımına geçildi. [Bing resmi açıklaması](https://www.bing.com/webmasters/help/url-inspection-55a30305): Live URL, Bingbot’un sayfayı indirirken gördüğü canlı yanıtı gösterir. Canlı sonuç henüz alınmadı; notice açık inceleme olarak kalır.

### Bing performans ve fiyat sayfası kontrolü — 10 Eylül

- **Search Performance: işlem bekliyor.** Kullanıcının aktardığı ekran: “Please check back in 48 hours while we prepare the data for your site”. Tıklama/gösterim başlangıç değerleri henüz bilinmiyor; sıfır yazılmadı. 12 Eylül veya sonrasında yeniden kontrol edilecek; otomatik hatırlatıcı kurulmadı.
- **Fiyat sayfası indeks kontrolü: tamamlandı.** `https://masabu.co/fiyatlar` denetimi istendikten sonra kullanıcı “Indexed successfully / URL can appear on Bing” sonucunu aktardı. Kanıt: 10 Eylül konuşmasındaki kullanıcı aktarımı. Canonical ve tarama ayrıntıları bu aktarımda yok; doğrulanmış sayılmadı.
- **QR menü: eksik / inceleme sürüyor.** Kullanıcı ekranında Bing Index “URL cannot appear on Bing”; keşif 9 Eylül, son tarama “Yesterday at 22:48”, crawl allowed Yes, fetch Successful, indexing allowed No, canonical `--`. Bu sonuç salt veri hazırlama beklemesi olarak sınıflandırılmadı.
- [10 Eylül canlı HTTP kontrolü](bing-qr-menu-live-check.json): normal ve Bingbot user-agent isteklerinde HTTP 200, robots/bingbot/googlebot meta direktifi yok, X-Robots-Tag yok, canonical `https://masabu.co/qr-menu`. User-agent kontrolü gerçek Bingbot IP erişiminin kanıtı değildir. Kaynak robots.ts tüm yolları açıyor. Güncel yanıtta indekslemeyi kapatan etiket/başlık bulunmadı; Bing kaydıyla farkın nedeni henüz kesin değil. Sonraki adım aynı adres için kullanıcı tarafından Live URL kontrolü; kod değişikliği veya indeksleme talebi yapılmadı.
- **QR menü Live URL: tamamlandı; indeksleme işlem bekliyor.** Kullanıcının 10 Eylül saat 11:39 test ekranı “URL can be indexed by Bing” gösteriyor; kalite kontrolleri ve Bing indekslemesi sonrasında sonuçlarda görünebileceği belirtiliyor. Önceki Bing Index kaydındaki izin engeli canlı testte görünmüyor; nedeninin ne olduğu kesinleşmedi. 1 SEO/GEO notice: alt özniteliği eksik olduğu bildirilen 1 örnek; 2 markup türü (türlerin ayrıntısı gösterilmedi). Bu uyarı canlı testte indekslenebilirlik sonucunu engellemiyor. Tek seferlik Request indexing kullanıcıya sonraki adım olarak önerildi; talebin gönderildiği henüz doğrulanmadı. Bu ekran indekslendiğinin kanıtı değildir.
- **Talep bildirimi — 10 Eylül:** Kullanıcı QR menü/dijital adisyon adımları sırasında “tamam bunu da requestledim”, ardından “Indexing requested.” mesajlarını iletti. Talep alındığı bildirildi; mesajlarda URL görünmediğinden iki adresin her biri için ayrı gönderim kanıtı veya indeks başarısı sayılmadı. Dijital adisyonun Bing Index/Live URL sonucu henüz paylaşılmadı.
- **QR sipariş: işlem bekliyor / neden incelemesi açık.** `https://masabu.co/qr-siparis` denetimi yönlendirmesinden sonra kullanıcının 10 Eylül ekranı “Discovered but not crawled / URL cannot appear on Bing” gösteriyor; keşif 9 Eylül 2026. Ekran indekslemeyi engelleyen sorunlardan genel olarak söz ediyor ancak belirli hata, HTTP sonucu veya robots direktifi sunmuyor. Salt bekleme veya kesin kod hatası olarak yorumlanmadı. Sonraki adım aynı URL için Live URL testi; bu sayfa adına indeksleme talebi henüz doğrulanmadı.
- **QR sipariş ve mutfak ekranı kullanıcı adımları — 10 Eylül:** QR sipariş Live URL / uygun ise tek talep yönergesinden sonra kullanıcı “bu d tamam”; mutfak ekranı URL Inspection / gerekirse Live URL ve tek talep yönergesinden sonra “tamamdır” dedi. Yönergelerin tamamlandığı kullanıcı beyanıyla kayıtlı. Ayrıntılı sonuç ekranları paylaşılmadığından canlı test sonucu, talep sayısı ve indeks başarısı ayrı ayrı doğrulanmış sayılmadı. Bu adreslerin indeks sonuçları sonraki kontrolde bekliyor.
- **Bing takip durumu:** Sitemap başarılı (25 URL), ana sayfa ve fiyat indeksli. Talep gönderilen ürün sayfalarının indeks sonuçları, Search Performance verileri ve alt metin notice takibi açık; Bing denetiminin bütünü tamamlanmadı. Performans için 12 Eylül veya sonrası yeniden kontrol planlı, otomatik hatırlatıcı yok.

### Bing paylaşılan HTML gövdesi incelemesi — 10 Eylül

Kullanıcının ikinci metin dosyası HTML gövdesini içeriyor. [Ayrıştırma kanıtı](bing-pasted-image-audit.json): 98 img, alt özniteliği eksik 0, açıklamalı alt 4, boş alt 94. Boş alt görsellerinin 77 adedi aria-hidden üst öğe altında; kalan 17 adet çözüm akışı görselinin yanında aynı adımı anlatan liste metni var. Bu HTML ve önceki güncel kod kontrolünde düzeltilecek eksik alt özniteliği saptanmadı; dekoratif/tekrarlı açıklama kullanımına gereksiz metin eklenmedi. Bing tarafından işaretlenen 18 örnek ayrı olarak eşleştirilmedi ve güncel Live URL uyarısının kalktığı ileri sürülmedi. Teknik inceleme kaydedildi; Bing notice sonraki taramada takipte, diğer hesap kontrollerini engellemiyor.
