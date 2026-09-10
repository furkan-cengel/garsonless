# Masabu canlı yayın ve pazarlama hazırlığı — 10 Eylül 2026

Durum: **yerel yayın paketi ve sosyal medya metin taslakları hazır; üretim yayını, gerçek müşteri yolculuğu ve hesap kontrolleri işlem bekliyor.** Bu dosya güncel iş listesidir; [9 Eylül kaydı](../google-readiness-2026-09-09/README.md) geçmiş kanıtları korur.

“Tamamlandı” yalnız belirtilen kapsamı kapsar. HTTP 200, indekslenme; yerel taklit GA testi, gerçek DebugView; içerik taslağı, yayınlanmış medya anlamına gelmez.

## Durum tablosu

| İş | Durum | Son kontrol | Kanıt / sonraki adım |
| --- | --- | --- | --- |
| Son çerez sürümü | Tamamlandı — yerel | 10 Eylül | İlk ziyaret kutusu, kabul/ret, çerez temizleme, footer’dan yeniden açma; marketing sabit düğmesi kaldırıldı. Testler aşağıda. |
| Marketing + dashboard üretim derlemesi | Tamamlandı | 10 Eylül | İki production build başarılı. GA4 etkinleştirilmedi. |
| Üretim yayını | İşlem bekliyor | 10 Eylül | Kullanıcı yayın onayı gerekli. Canlı HTML’de yeni footer bağlantısı henüz yok. |
| Canlı sitemap/canonical | Tamamlandı — HTTP | 10 Eylül | [25/25 adres 200 ve doğru canonical](public-http-before-release.json); signup indeks dışı, olmayan adres 404. |
| Canlı mobil sayfalar | Tamamlandı — salt okunur | 10 Eylül | [9 hedef sayfa](public-mobile-before-release.json): 200, yatay taşma yok, GA isteği yok. Form gönderilmedi. |
| Gerçek müşteri yolculuğu | İşlem bekliyor | 10 Eylül | Kayıt → e-posta doğrulama → deneme kullanıcıyla yapılacak; sayfa erişim kontrolü bunun yerine geçmez. |
| Search Console | İşlem bekliyor | 10 Eylül | 9 Eylül sitemap 25 adres işlendi; altı URL isteği kullanıcı tarafından tamamlandı. Bugünkü indeks/canonical ve 7 günlük tıklama/gösterim bekleniyor. |
| Bing | İşlem bekliyor | 10 Eylül | Kullanıcı aktarım ve sitemap gönderimini doğruladı; işleme sonucu/tarama raporu henüz alınmadı. |
| Google İşletme Profili | İşlem bekliyor | 10 Eylül | Son kullanıcı ekranı doğrulama incelemesinde. Kategori düzeltildiği bildirildi; yeni ziyaretçi görünümü ve bilgiler doğrulanacak. |
| GA4 teknik izin akışı | Tamamlandı — yerel test | 10 Eylül | Mock isteklerle izin/ret/geri çekme ve alt alan akışı geçti; üretim açılış kapısı testi geçti. |
| GA4 değerlendirme ve gerçek DebugView | İşlem bekliyor | 10 Eylül | Kullanıcı sağlayıcı/aktarım değerlendirmesinin tamamlanmadığını bildirdi. GA4 kapalı kalır. |
| Meta Business Suite | İşlem bekliyor | 10 Eylül | FB–IG bağlantısı ve profil düzenlemeleri kullanıcı tarafından yapıldı; güncel profil, inbox ve planlayıcı erişimi kontrol edilecek. |
| LinkedIn | İşlem bekliyor | 10 Eylül | Kullanıcı açıklama/kapak düzenlemesini tamamladı; ziyaretçi görünümü ve yayın erişimi kontrol edilecek. |
| 30 günlük içerik metinleri/takvimi | Tamamlandı — taslak | 10 Eylül | [12 ana içerik, 8 hikâye seti, 4 LinkedIn metni](../social-launch-30-days.md); amaç, kapak, üretim yönergesi, gün ve UTM mevcut. |
| Bitmiş görseller/ekran kayıtları ve yayın | Eksik | 10 Eylül | Taslak incelemesinden sonra gerçek test ekranlarından üretim; hiçbir içerik gönderilmedi veya planlanmadı. |
| Mobil performans/erişilebilirlik/menu paketi | Eksik | 10 Eylül | Aşağıdaki ayrı teknik işler; eski başarısız kontroller yeşil sayılmadı, eşikler yükseltilmedi. |

## Yerel doğrulama ve yayın paketi

10 Eylül son çalışma ağacında:

- Marketing birim testleri: 38 geçti. Domain analitik testleri: 4 geçti.
- Ortak UI typecheck ve ilgili dosyalarda ESLint geçti.
- `node --test scripts/marketing-analytics-config.test.mjs`: 1 geçti; değerlendirme olmadan production analitiği açılmasını engelliyor.
- `pnpm exec playwright test --config=playwright.marketing-readiness.config.ts`: GA taklitli koşuda 3 geçti, yalnız GA kapalı koşuya ait 1 senaryo atlandı.
- `MARKETING_TEST_ANALYTICS_DISABLED=1 pnpm exec playwright test --config=playwright.marketing-readiness.config.ts --grep 'cookie notice opens automatically'`: kapalı durum senaryosu 1 geçti.
- Marketing ve dashboard üretim derlemeleri geçti. [Derleme ve tarayıcı çıktı özeti](verification.txt).

Tarayıcı kapsamı: ilk ziyaret, kabul/ret, yeniden yükleme, çerez temizleme, footer’dan açma, mobil/klavye erişimi, URL temizleme, yinelenmeyen olaylar ve alt alan kayıt işaretleri. Tarayıcı Google sınırını taklit eder; canlı kayıt veya Google’a test verisi göndermez. `essential` seçimi ileride GA açılması için izin sayılmaz. Yalnız geçmişi silmek, çerez korunuyorsa tercihi sıfırlamaz.

Paket önceki yayımlanmamış `05a5ccf` değişikliklerini ve son popup/tercih düzenlemelerini içerir. Marketing ve dashboard birlikte yayımlanmalıdır. Veritabanı şeması, yeni API veya yeni takip sağlayıcısı eklenmez. GA4 ID/aktarım onayı açılmaz.

Üretim sonrası tamamlanacak: dağıtım kimlikleri ve commit kaydı → yeni footer’ın canlıda görünmesi → temiz tarayıcıda popup → kabul/ret/yenileme/çerez temizleme → footer’dan yeniden açma → her durumda GA isteği olmaması → kayıt yolculuğu. Yayın sonucu bu dosyaya tarih ve kanıtla eklenmeden “canlı tamamlandı” denmez.

## Kullanıcıyla hesap kontrolleri

Her ekran için tarih, seçilen mülk/kanal, sonuç ve ekran kanıtı kaydedilir. Parola, doğrulama kodu veya özel müşteri bilgisi istenmez.

1. **Search Console:** `masabu.co` → Site Haritaları: son okuma, durum ve keşfedilen sayfa sayısı. Performans: son 7 gün tıklama/gösterim; veri oluşmadıysa “veri yok”. Ana sayfa, `/fiyatlar`, `/qr-menu`, `/dijital-adisyon`, `/qr-siparis`, `/mutfak-ekrani` için indeks durumu, Google’ın seçtiği canonical ve gerekçe. Amaç, erişilebilir sayfanın Google tarafından nasıl işlendiğini görmek. Bekleyen URL için tekrar tekrar istek gönderilmez. Manuel işlemler ve güvenlik raporları da kaydedilir; gereksiz yeni mülk açılmaz.
2. **Bing:** Masabu → Sitemaps: durum, son işleme, adres sayısı; önemli altı URL ve Site Scan/tarama bulguları. Amaç, içe aktarımın gerçekten işlendiğini doğrulamak. Yalnız “import edildi” yeterli kanıt değildir.
3. **Google İşletme:** doğrulama sonucu ve ziyaretçi görünümü; yazılım faaliyetini karşılayan kategori, telefon, saatler, adres görünürlüğü, logo/kapak, ürün açıklamaları ve site. Adres görünürlüğü gerçek müşteri kabul düzenine göre kullanıcı tarafından doğrulanır. Açıklamaya kurulum veya bölge eklenmez. Google’ın bekleyen incelemesi hata diye işaretlenmez.
4. **Meta:** Masabu FB sayfası ve `masabuco` Instagram hesabı seçili mi; ziyaretçi görünümünde marka adı, bio, site bağlantısı ve görseller; birleşik inbox ve planlayıcı açılıyor mu. Amaç, iki kanalda talep yönetimi ve yayın erişimini doğrulamak. Test için dışarı mesaj gönderilmez; gönderi yayınlanmaz.
5. **LinkedIn:** `linkedin.com/company/masabu/` → View as member: açıklama, başlık, logo, kapak ve site; yönetici görünümünde taslak hazırlama erişimi. Amaç, ziyaretçinin gördüğü marka bilgilerini tutarlı hale getirmek.

## GA4 değerlendirmesinin kapanması

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

Başlangıç değerleri: Search Console tıklama/gösterim **bekliyor**; Bing tıklama **bekliyor**; IG/FB/LinkedIn erişim ve bağlantı tıklamaları **bekliyor**; gerçek yeni deneme sayısı (test hariç) **bekliyor**. Bilinmeyenler sıfır değildir.

Başvuru kaynakları: [Google Search Console izleme yaklaşımı](https://developers.google.com/search/docs/monitor-debug/search-console-start), [Google İşletme doğrulama süreci](https://support.google.com/business/answer/7107242). Hesapta inceleme sürüyorsa güncel durum ve başvuru tarihiyle takip edilir.
