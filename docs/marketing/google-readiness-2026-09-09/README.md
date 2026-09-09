# Google görünürlüğü ve pazarlama yayını

9 Eylül 2026 uygulama kaydı. Konumlandırma: **QR menüyle başla; sipariş, adisyon ve mutfağı aynı sistemden yönet.** İlk 90 gün Türkiye’deki kafe/restoranlar hedeflenir. Teknik uygunluk indeks veya sıralama garantisi değildir.

## Kaynak kodunda tamamlananlar

- Marketing sitemap yalnız doğrudan içerik sayfalarını içerir; üç yönlendirme çıkarıldı. Gerçek blog güncelleme tarihleri korunur, otomatik günlük tarih ve priority/changefreq yoktur.
- Ana sayfa ve fiyat başlıkları güncellendi. Ortak metadata canonical, 1200×630 OG ve Twitter görselini birlikte üretir.
- Organization/WebSite grafiği ve bağlı Article yayıncı kimliği eklendi. Görünür iç sayfa gezinme izi BreadcrumbList ile aynıdır. Doğrulanmamış sosyal kimlik, yorum/puan ve FAQ zengin sonuç verisi üretilmez.
- Dört ürün sayfası: `/qr-menu`, `/dijital-adisyon`, `/qr-siparis`, `/mutfak-ekrani`. Fiyatlar ve paket erişimleri ürün kataloğundan okunur. Ana sayfa/footer ve blog bağlantıları eklendi.
- Üç mevcut rehber geliştirildi, dört yeni rehber eklendi. Blog toplam yedi içeriktir; yeni bir CMS veya bağımlılık eklenmedi.
- Menü sitemap ve metadata sabit işletme kimliğine göre aynı indeksleme politikasını uygular. Gerçek işletmelerde yayın, silinmemiş işletme ve QR erişimi gerekir. Vitrin kapalıyken canonical `/{slug}`; açıkken vitrin ve menü ayrı adreslerdir.
- Menü giriş ekranı, masa oturumları ve önizlemeler indeks dışıdır. Robots, herkese açık sayfaların noindex bilgisinin görülmesini engellemez.
- Ortak GA4 Basic Consent Mode entegrasyonu, erişilebilir kabul/ret/tercih arayüzü, paylaşılmış tercih ve kayıt/deneme dönüşümleri hazır. Marketing ve dashboard kayıt akışı dışındaki uygulamalar ölçülmez.
- Çerez, gizlilik, KVKK ve sağlayıcı açıklamaları isteğe bağlı GA4 yapılandırmasıyla güncellendi. Analitik tercih/politika sürümü, kayıt sırasında kabul edilen sözleşme sürümünden ayrıdır.

## Üretim yapılandırması

`MENU_NOINDEX_RESTAURANT_IDS` yalnız sunucu ortamında, masabu-menu Vercel projesinde tanımlanır:

| Test işletmesi | Sabit kimlik |
| --- | --- |
| demetest | `4bc2978d-7e9a-4da7-8d00-f54884264f58` |
| odeme | `19f18c37-f2a4-44e4-8dc4-d84d8ebed80b` |
| tesr | `d234fbf3-b580-4686-bff8-ff9ac96d1d5d` |

Slug değişikliği dışlamayı kaldırmaz. Gerçek müşterilere varsayılan noindex uygulanmaz. Menü sitemap’inin boş olması, yalnız test işletmeleri uygunken beklenen sonuçtur; gerçek uygun işletme eklenene kadar Google’a menü sitemap’i gönderilmez.

GA4 kapalı başlar. Marketing/dashboard için aynı `NEXT_PUBLIC_GA4_MEASUREMENT_ID` kullanılır. Üretim kimliği ancak sağlayıcı ve aktarım değerlendirmesi tamamlandığında `ANALYTICS_DATA_TRANSFER_APPROVED=true` ile açılabilir; aksi durumda production build durur. Bu teknik kontrol hukuki değerlendirme yerine geçmez. Kimliği kaldırıp iki uygulamayı yeniden yayımlamak ölçümü kapatır.

## GA4 hesap kurulumu ve açılış kontrolü

Ayrı Masabu mülkü kullanılmalıdır; hesapta görünen başka markanın mevcut mülkü kullanılmaz.

1. Mülk: Masabu; ülke Türkiye, saat dilimi Europe/Istanbul, para birimi TRY.
2. Tek web akışı: https://masabu.co. Aynı G- kimliği marketing/dashboard’a; otomatik çerez alanı `masabu.co` olur.
3. **Enhanced measurement tamamen kapalı:** manuel page_view ile geçmiş değişimi çakışmamalı; otomatik form ölçümü açılmamalı. Google Signals, reklam kişiselleştirmesi ve kullanıcı tarafından sağlanan veriler kapalı.
4. Olay verisi saklama süresi iki ay. Hesap veri paylaşım tercihleri minimum; Ads/BigQuery bağlantısı açılmaz.
5. `generate_lead`, `sign_up`, `trial_started` önemli etkinlik olarak işaretlenir. Sayfa adresi sorgu/fragment içermemeli; yönlendiren yalnız origin olmalı.
6. Sağlayıcı/uluslararası aktarım koşulları işletme tarafından tamamlandıktan sonra üretim env değerleri eklenir ve iki uygulama yayımlanır.
7. İzinli test tarayıcısında Tag Assistant/DebugView doğrulanır. Testte gerçek müşterinin kişisel verisi kullanılmaz. İzin vermeyen ziyaretçinin davranışı sonradan gönderilmez.

| Olay | Yetkili başarı noktası |
| --- | --- |
| page_view | İzinli ilk sayfa + gerçek istemci gezinmesi, aynı URL tek kez |
| signup_click | Kayıt bağlantısı, placement: header/footer/content |
| generate_lead | İletişim sunucusu başarıyla kabul ettikten sonra; destek/honeypot/hata hariç |
| sign_up | Sunucuda doğrulanmış yeni kayıt; hesaba bağlı imzalı işaret bir kez tüketilir |
| trial_started | Onboarding ilk oluşturma başarısı; `replayed` yanıt hariç, Pro denemesi |

Kayıt/deneme işlemi ölçüm hatasından etkilenmez. Tarayıcı testleri provider sınırını taklit eder; GA DebugView doğrulaması değildir. Google oturum devamlılığı gerçek GA mülkü açıldıktan sonra ayrıca doğrulanacaktır. Kullanıcının son talimatı gereği hesap ve tarayıcı adımlarını kullanıcı yapar; ajan adım adım yönlendirir.

## Search Console ve Bing

- Kullanıcı `masabu.co` Domain mülkünü işletmenin Google hesabında ekledi; erişim doğrulandı. Başlangıç ekranı veri işleniyor diyor; henüz performans veya indeks kapsamı ölçümü yok.
- `https://masabu.co/sitemap.xml` kullanıcı tarafından gönderildi. İlk “Getirilemedi” görünümü ardından 9 Eylül 2026 ekranında **başarıyla işlendi, 25 keşfedilen sayfa** doğrulandı. Sitemap adımı tamam; indekslenme sonucu değildir.
- `https://masabu.co/` ve `https://menu.masabu.co/` URL-prefix mülkleri aynı hesapta eklenir; Domain doğrulaması alt mülkleri destekler.
- Ana sayfa, fiyat ve dört ürün URL’si URL Inspection’dan denetlenir. Canlı test, Google canonical seçimi ve indeks isteği ayrı işlemlerdir; kota veya bekleyen işlem başarı diye işaretlenmez.
- Güvenlik sorunları ve manuel işlemler raporları kontrol edilir; veri oluşunca dışlanan URL nedenleri incelenir.
- Bing Webmaster Tools’a Search Console içe aktarımı yapılır; yalnız Masabu mülkü seçilir. Hesap/doğrulama ekranında kullanıcının oturumu gerekir.

## Profil çalışması

[Profil paketi](profile-kit.md) kısa/uzun ve İngilizce açıklamalar, kanal uyarlamaları, logo ve dört gerçek ürün medyası ile gönderilmemiş yorum talebini içerir. Kullanıcı mevcut sosyal bağlantıları daha sonra paylaşarak profilleri birlikte tamamlayacağını belirtti. Sosyal sahiplik, fiilî yakın çevre hizmet ilçeleri ve platform başvuruları beklemededir. Çalışma saatleri kullanıcı tarafından hafta içi 09:00–18:00 olarak verildi.

## Kontroller

- `pnpm lint`, `pnpm typecheck`
- `pnpm test:architecture`, `pnpm test:db`, `pnpm test:next-conventions`
- `pnpm --filter @garsonless/marketing test`
- `pnpm --filter @garsonless/marketing --filter @garsonless/menu --filter @garsonless/dashboard build`
- `pnpm exec playwright test --config playwright.marketing-readiness.config.ts`

Tarayıcı testi Google isteklerini taklit eder ve gerçek üretime kayıt yazmaz. Alt alan testinde üretim görünümlü origin’ler tamamen yerel sunuculara yönlendirilir. `test-results/marketing-readiness` mobil ekranları ve başarısızlık trace’lerini saklar. Yerel test sunucusu ölçüm kimliği `G-MASABUTEST` olup gerçek üretimde kullanılmaz.

## 90 günlük takip

| Dönem | Yapılacak değerlendirme |
| --- | --- |
| İlk 14 gün | Search Console indeks/gösterim/tıklama başlangıç değerleri; GA4 ancak etkinleştirilirse izinli kayıt ve denemeler; yoksa “veri yok” kaydı |
| Her hafta | Marka/marka dışı sorgular, açılış sayfaları, nitelikli iletişim talepleri, kayıtlar, başlayan denemeler; ödeme dönüşümleri mevcut abonelik kaydından |
| 30. gün | İndeks engelleri, canonical seçimi, başlıklar ve ürün sayfalarının sorgu uyumu |
| 60. gün | Trafik alan içeriklerin kayıt/deneme katkısı; gerçek kullanıcı sorularına göre içerik geliştirme |
| 90. gün | Kanalların nitelikli müşteri katkısı; gelecek içerik ve dağıtım önceliği |

Alan verisi hedefleri LCP ≤2,5 sn, INP ≤200 ms, CLS ≤0,1. Laboratuvar sonucu alan performansı veya INP ölçümü olarak sunulmaz. Yeterli trafik oluşmadan sayısal büyüme taahhüdü verilmez.

## Teknik kaynaklar

- [Google sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Next.js 15 metadata birleşimi](https://nextjs.org/docs/15/app/api-reference/functions/generate-metadata)
- [Google kuruluş verisi](https://developers.google.com/search/docs/appearance/structured-data/organization)
- [Google site adı](https://developers.google.com/search/docs/appearance/site-names)
- [Google onay modeli](https://developers.google.com/tag-platform/security/concepts/consent-mode)
- [GA4 yapılandırması](https://developers.google.com/analytics/devguides/collection/ga4/reference/config)
- [GA4 önerilen olaylar](https://developers.google.com/analytics/devguides/collection/ga4/reference/events)
- [KVKK çerez kararı](https://www.kvkk.gov.tr/Icerik/7595/2022-1358)
- [KVKK yurt dışı aktarımı](https://www.kvkk.gov.tr/Icerik/2053/Yurtdisina-Aktarim)

## 9 Eylül yayın doğrulaması

Marketing, menü ve dashboard production yayınları tamamlandı. Üç yayın referansı `deployments.json` içinde kayıtlıdır. `live-marketing-verification.json` 25 URL’nin tamamında 200, doğru canonical, Open Graph ve Twitter görselini doğrular. `live-menu-verification.json` üç test işletmesinin her iki menü yolunda noindex ve sitemap dışında olduğunu, önizlemenin noindex başlığıyla yetkisiz erişimi reddettiğini gösterir. Menü sitemap’i şimdilik boş olduğu için Search Console’a gönderilmedi. `live-redirects.json` HTTP ve www için yol/UTM koruyan 308 ile bulunmayan sayfada 404 kaydını içerir.

Son doğrulamalar: lint, monorepo typecheck, mimari testler, 659 DB testi, 12 Next convention testi, 995 dashboard testi, 38 marketing testi; üç ilgili production build; üç browser senaryosu ve üretim analitiği açılış kapısı testi geçti. Browser testleri imzalı kayıt işaretinin de ret sırasında temizlendiğini doğrular. Canlı mali işlem veya gerçek kayıt oluşturulmadı.

Mobil Lighthouse tek koşu: ana sayfa performans 92 / SEO 100, fiyat 96 / SEO 100, QR menü 97 / SEO 100. LCP sırasıyla 3,25 / 2,75 / 2,61 saniye; CLS 0,002 / 0 / 0. Bu sonuçlarda LCP 2,5 saniye hedefi henüz sağlanmıyor; eski yerel ölçümle kontrollü karşılaştırma olmadığından gerileme yok garantisi verilmez. Mevcut tasarımdaki renk kontrastı ve fiyat başlık sırası bulguları `mobile-lighthouse.json` içinde kaydedildi. Alan INP verisi henüz yok.

GA4 mülk/akış kurulumu, Enhanced measurement ayarı, veri aktarımı değerlendirmesi ve DebugView doğrulaması bekliyor; üretim ölçümü kapalı. Search Console ana sayfa canlı testi, kullanıcının 9 Eylül 2026 13:11 ekranında “URL, Google tarafından kullanılabilir” ve “Sayfa dizine eklenebilir” sonucuyla geçti. Kullanıcı fiyat ve dört ürün sayfasında indeksleme isteği adımlarını tamamladığını bildirdi. Manuel işlemler ve Güvenlik sorunları raporlarında kullanıcı tarafından “Sorun algılanmadı” doğrulandı. Alt mülkler ve Bing aktarımı henüz tamamlanmadı. İsteklerin gönderilmesi indekslenme garantisi değildir. Profil başvuruları kullanıcıyla ilerleyecek.
