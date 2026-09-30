# Analytics ve conversion tracking

30 Eylül 2026 teknik denetimi. Mevcut `ConsentAnalytics` / `trackMarketingEvent` yapısı geliştirilmiştir; ikinci bir provider, GTM, Ads etiketi veya bağımlılık eklenmemiştir. Production yayınında marketing ve dashboard aynı kaynak commit ile doğrulanmalıdır.

## Existing Analytics Setup

- GA4, doğrudan `gtag.js` ve `dataLayer` kullanıyor. `googletagmanager.com/gtag/js` yüklenmesi GTM container bulunduğu anlamına gelmez.
- Marketing ve dashboard ortak UI helper'ını kullanır; Next.js üçüncü taraf analytics paketi yoktur.
- 30 Eylül salt okunur public JS kontrolünde `masabu.co` ve `app.masabu.co/auth/signup` aynı mevcut GA4 Measurement ID'sini içeriyordu. Yeni ID üretilmedi. Bu kontrol Google'a event göndermedi; GA4/Ads yönetim paneli veya rapor teslimatı doğrulaması değildir.
- `NEXT_PUBLIC_GA4_MEASUREMENT_ID` ve production build kapısı `ANALYTICS_PRODUCTION_ENABLED` korunmuştur. Yerel env örnekleri production ortamının kanıtı değildir.
- Analitik izni verilmeden tag yüklenmez. Analitik kabul edilince yalnız `analytics_storage` açılır; `ad_storage`, `ad_user_data`, `ad_personalization` reddedilmiş kalır. Google Signals/reklam kişiselleştirmesi kapalıdır.
- Email kayıtları sunucu tarafından doğrulandıktan; Google kayıtları yeni kullanıcı ve gerekli kayıt adımları doğrulandıktan sonra tek kullanımlık receipt üzerinden `sign_up` üretir. Signup buton tıklaması farklı bir event'tir.

## Problems Found

| Öncelik | Bulgu | Sonuç |
| --- | --- | --- |
| P1 | Geçerli ID ile development/localhost gerçek Google etiketi yükleyebiliyordu. | Development varsayılanı kapalı; açık debug modu Google'a bağlanmaz. Production runtime ayrıca iki gerçek hostname ile sınırlıdır. |
| P1 | Ölçüm dışı özel dashboard rotasına geçiş, izin devam ederken GA çerezlerini siliyordu. | Rota için duraklatma ile rıza geri çekme ayrıldı; oturum çerezi özel sayfada korunur, ölçüm durur. |
| P1 | `business_created` ve açık yayınlama başarısı ölçülmüyordu. | Sunucunun başarılı ve replay olmayan mutation yanıtına bağlandı. |
| P1 | Depolama/provider istisnaları bazı başlangıç/consent yollarından dışarı çıkabiliyordu. | SSR, cookie ve provider hata sınırları eklendi. |
| P1 | `send_page_view:false`, GA4 panelindeki history enhanced measurement ayarını tek başına kapatmaz. | Kodda tek manuel page_view gönderici var; panel ayarı ayrıca doğrulanmalı. |
| P2 | Kampanya parametreleri sayfa/subdomain geçişinden sonra uygulama tarafında korunmuyordu. | Rıza kontrollü, sabit 30 dakikalık first-touch kampanya çerezi eklendi. |
| P2 | CTA konumu ve plan/dönem kırılımı eksikti. | Allowlist metadata eklendi; sayfa içindeki `<header>` navbar sayılmaz, mobil kapanmadan önce capture listener çalışır. |
| P2 | Formun hızlı tekrar submit edilmesi için senkron kilit yoktu. | In-flight ref eklendi; geçersiz form, API hatası ve honeypot conversion üretmez. |
| Sınır | İlk ürün erişilebilirliği ile ilk tema yayını aynı işlem değildir; onboarding tema revizyonu oluşturur. | İlk-ever yayın tahmin edilmez. `menu_published` yalnız başarılı açık yayın eylemidir; ilk aktivasyon veya otomatik onboarding yayını olduğu iddia edilmez. |

## Changes Made

- `packages/domain/src/marketing-analytics.ts`: type-safe event sözleşmesi, runtime parametre allowlist'i, ortak CTA/form/yayın başarı kararları; tenant kimliğini içermeyen `/dashboard/theme` sanal rotası.
- `packages/ui/src/analytics-client.ts`: consent/SSR/hata izolasyonu, private-route pause, yeniden izin verme, hostname/development kapısı, yerel debug ve kampanya cookie yaşam döngüsü.
- `packages/ui/src/ConsentAnalytics.tsx`: tek delegated capture listener, doğru CTA konumu, ara yönlendirmede signup receipt'in korunması.
- `apps/marketing/components/BusinessContactForm.tsx`: native validation ve senkron in-flight koruması; yalnız doğrulanmış API başarısında conversion.
- `apps/marketing/components/PricingSection.tsx`, `PricingPageClient.tsx`: kart ve karşılaştırma tablosunda güvenilir plan/dönem metadata'sı.
- `apps/dashboard/components/onboarding/OnboardingFlow.tsx`, `onboarding-analytics.ts`: `business_created` başarı noktası; mevcut trial/menu-setup event'leri korunur.
- `apps/dashboard/components/theme/use-theme-editor-lifecycle.ts`: başarılı açık publish sonrası event; taslak, hata, conflict ve replay hariç.
- `apps/dashboard/lib/auth/signup-analytics.ts`: gerçek signup receipt akışı korunur; kontrollü yerel debug ile test edilebilir.
- İki `.env.example`, çerez politikası ve testler güncellendi. Marketing `NEXT_DIST_DIR` seçeneği debug/build çıktılarını ayırır; production varsayılanı `.next` kalır.

## Event Map

Her event'te temizlenmiş `page_location` ve yalnız origin içeren `page_referrer` bulunur. Rıza ve 30 dakikalık pencere varsa izinli kampanya etiketleri eklenir. Ad, e-posta, telefon, mesaj, işletme adı/id/slug, auth code/token gönderilmez. Serbest CTA metni okunmaz.

| Event | Trigger | Parameters | Page/Flow |
| --- | --- | --- | --- |
| `page_view` | İlk izinli görünüm ve pathname değişimi; aynı sayfadaki effect/focus tekrarı hariç | temiz URL, referrer, sayfa başlığı, kampanya | Public marketing, kayıt/onboarding, sanal theme rotası |
| `free_trial_click` | Kayıt/ücretsiz deneme CTA tıklaması | placement, location, cta_type; varsa plan_name, billing_period | Marketing masaüstü ve mobil |
| `signup_click` | Aynı kayıt CTA tıklaması; kayıt başarısı değildir | Aynı click metadata | Marketing → signup |
| `demo_request_click` | İşaretli, birinci taraf demo formu bağlantısı | placement, location, cta_type; varsa plan_name | Marketing → iletişim |
| `pricing_cta_click` | Fiyat alanı/sayfasında kayıt veya demo CTA | placement, location, cta_type, güvenilir plan_name/billing_period | Landing fiyatları ve /fiyatlar |
| `allergen_landing_cta_click` | Alerjen sayfasında kayıt/demo CTA | placement, location, cta_type | /menu-alerjen-zorunlulugu |
| `phone_click` | tel: bağlantısı | placement, location; numara yok | Marketing |
| `whatsapp_click` | İzinli WhatsApp host bağlantısı varsa | placement, location; numara/mesaj yok | Marketing; yeni WhatsApp UI eklenmedi |
| `contact_form_submit` | HTTP success + success:true + boolean leadAccepted; honeypot hariç | topic, form_type: demo/contact/support | İletişim formu |
| `generate_lead` | Kabul edilen genel/satış formu; destek hariç | topic, form_type | Mevcut lead event'i |
| `sign_up` | Yeni hesabın doğrulanmış kayıt akışındaki sunucu receipt'i | method: email/google | Dashboard auth/onboarding |
| `business_created` | Backend başarılı yeni işletme oluşturduğunda; replay hariç | varsa selected_plan | Onboarding |
| `trial_started` | Aynı başarılı yeni işletmede mevcut Pro denemesinin başlaması | plan: pro | Onboarding; mevcut event |
| `first_product_added` | İlk başarılı menu setup ve önceki ürün sayısı sıfır | method: manual/csv | Onboarding; mevcut event |
| `menu_setup_completed` | Backend menu setup tamamladı; replay/hata hariç | method: manual/csv | Onboarding; mevcut event |
| `menu_preview_click` | Tamamlama adımında menü önizleme tıklaması | placement: onboarding_complete | Onboarding; mevcut event |
| `menu_published` | Tema editöründe başarılı açık publish; status=published | publication_type: explicit_publish | Sanal /dashboard/theme |

`location`: hero, navbar, pricing, footer, allergen_page, content. `placement`: eski raporlarla uyum için header/footer/content. `billing_period`: monthly/yearly; Business için dönem uydurulmaz.

Bir fiyat CTA'sı farklı anlamdaki `signup_click`, `free_trial_click`, `pricing_cta_click` event'lerinin her birini bir kez üretir. Bunlar aynı conversion olarak toplanmamalıdır. `contact_form_submit` ve mevcut `generate_lead` de aynı lead'i iki kez optimize etmek için kullanılmamalıdır.

## Funnel

`page_view → signup_click/free_trial_click → sign_up → business_created → menu_setup_completed → menu_published (açık yayın eylemi)`

`page_view → demo_request_click → contact_form_submit (form_type=demo)`

İlk menü aktivasyonu için mevcut `menu_setup_completed` kullanılabilir. `menu_published` işleme göre sayılır: daha sonraki ayrı bir başarılı yayın yeni bir event'tir; tekrar gönderilen aynı backend request (replayed) değildir. Kalıcı ilk-ever yayın kanıtı bulunmadığı için `menu_updated` tahminen eklenmedi. GA4 funnel kullanıcı bazında incelenmeli, `menu_published` acquisition Primary yapılmamalı. Reddedilen rıza, ad blocker, sayfanın erken kapanması ve başka cihazda doğrulama gibi client-side ölçüm sınırları vardır; event teslimatı exactly-once veya tüm kullanıcıları kapsama garantisi değildir.

## Google Ads Readiness

| Alan | Durum |
| --- | --- |
| GA4 ready | **Yes — kod ve mevcut aynı stream yapılandırması.** Yeni kodun production teslimatı/DebugView kontrolü ayrıca gerekir. |
| GTM ready | **No — kurulu değil; bu doğrudan GA4 mimarisinde gerekli değil.** İkinci bir GA4 tag'i eklemeyin. |
| Google Ads ready | **Requires configuration.** GA4 import hedeflenir; Ads ID/label, reklam izni veya hesap bağlantısı uydurulmadı. |
| Cross-domain/subdomain ready | **Yes — masabu.co ↔ app.masabu.co kodu ve aynı stream.** Cookie domain ortak; GA paneli ve deploy sonrası oturum sürekliliği tekrar doğrulanmalı. Başka kayıtlı domain'ler otomatik kapsamda değildir. |
| UTM attribution ready | **Yes — analytics consent sonrası 5 allowlist UTM, sabit 30 dakikalık first-touch.** gclid saklanmaz; Ads click attribution için tam hazır değildir. |
| Consent handling | **Consent controlled.** Basic mode yaklaşımı; reklam izinleri denied. Teknik durumdur, hukuki uygunluk garantisi değildir. |

UTM etiketleri 64 karakterle ve harf/rakam/alt çizgi/tire biçimiyle sınırlıdır; e-posta, uzun telefon benzeri sayılar ve serbest metin reddedilir. Kampanya isimlerine kişi adı gibi bilgiler hiç konulmamalıdır; bir slug'ın anlamsal olarak kişisel bilgi içerip içermediği koddan kesin tespit edilemez. Çerez yalnız izinden sonra yazılır, süre uzatılmaz, ret/geri çekmede silinir. Rıza verilmeden kaybolan parametreler geriye dönük toplanmaz. gclid, reklam kimliği olduğu ve mevcut model ad_storage'ı reddettiği için storage/URL aktarımına eklenmedi.

## Manual Actions Required From Me

1. Değişiklikleri hem marketing hem dashboard'a birlikte yayınlayın. Mevcut `NEXT_PUBLIC_GA4_MEASUREMENT_ID` aynı kalmalı; `ANALYTICS_PRODUCTION_ENABLED=true` production build kapısını doğrulayın. `NEXT_PUBLIC_ANALYTICS_DEBUG` production'da etkin değildir; false bırakın. Yeni GTM/Ads env gerekmiyor.
2. GA4 web stream Enhanced Measurement ayarını doğrulayın. Manuel page_view ile browser history otomatik page_view'u beraber çalıştırmayın. Otomatik form/outbound/search ölçümlerini bu özel sözleşmenin dışında ikinci conversion kaynağı yapmayın. [Google page_view açıklaması](https://developers.google.com/analytics/devguides/collection/ga4/views).
3. GA4 ile Google Ads hesabını bağlayın ve doğru key event'leri import edin. Kayıt kampanyasında `sign_up` veya `business_created` arasından hedefe uygun bir Primary seçin; demo kampanyasında `contact_form_submit` için yalnız form_type=demo/contact kırılımını kullanın (support hariç). Click event'leri Secondary; aynı lead'in iki event'ini veya bütün funnel adımlarını aynı hedefte Primary olarak toplamayın. [Google Ads import açıklaması](https://support.google.com/google-ads/answer/2375435?hl=en).
4. GA4'te location, cta_type, plan_name, billing_period, selected_plan, form_type, publication_type için gereken event-scoped custom dimension'ları açın. Standart kampanya parametreleri için paralel isimler yaratmayın.
5. Aynı cihaz/tarayıcıda masabu.co → app.masabu.co geçişinde client/session sürekliliğini, self-referral oluşmadığını ve iki uygulamada consent geri çekmeyi doğrulayın. Aynı root domain cookie paylaşımı temel mekanizmadır; başka root domain eklenirse GA4 cross-domain/linker yönetimi ayrıca gerekir. [Google cross-domain açıklaması](https://support.google.com/analytics/answer/10071811?hl=en).
6. Ads auto-tagging/gclid ve reklam izinleri ayrı yapılandırma kararıdır. Mevcut analytics kabulünü reklam izni gibi kullanmayın. [Google consent açıklaması](https://developers.google.com/tag-platform/security/concepts/consent-mode).
7. Yayın sonrası kendi test hesabınızla Realtime/DebugView ve Google Ads conversion diagnostics üzerinden teslimatı doğrulayın. Yerel debug Google'a gönderilmediğinden GA DebugView'da görünmez. Search Console bu analytics değişikliği için yeni bir teknik ön koşul değildir; organik performans yönetimi ayrı kalır.

## Development debug

Marketing veya dashboard yerel `.env.local` içinde yalnız `NEXT_PUBLIC_ANALYTICS_DEBUG=true` verin ve dev sunucusunu yeniden başlatın. Consent yine gereklidir. Tarayıcı console'unda `[masabu analytics]` altında yalnız temizlenmiş JSON event'leri görünür; ayrıca `masabu:analytics-debug` CustomEvent yayınlanır. Debug modu gtag script'i, dataLayer event kuyruğu veya Google ağı kullanmaz. ID gerekli değildir. Production build'de debug kapalıdır ve localhost production build de gerçek analytics göndermez.

## Validation

- Analytics sözleşmesi, provider hata sınırları, consent, signup receipt, onboarding ve yayın başarı/replay koşulları Node testleriyle kontrol edilir; gerçek müşteri kaydı veya mesaj gönderilmez.
- Tarayıcı conversion/readiness testleri aynı yerel debug transportuna güncellendi. Gerçek provider yükleme davranışı sahte DOM/gtag ile unit test edilir; test ID'si üretime eklenmez.
- Canlı veri üzerinde yeni hesap, işletme, menü yayını veya iletişim mesajı oluşturulmadı. GA4/Ads panelinde test dönüşümü teslimatı bu çalışmada doğrulanmadı.
- `check:ci` geçti: repo genelinde lint, typecheck, domain/application/UI/dashboard/mutfak/menu ve DB mimari testleri, release/runtime ve bundle kontrolleri.
- Hedeflenen analytics testleri: 25/25; marketing bileşen/sözleşme testleri: 48/48 geçti.
- Marketing ve dashboard production build'leri geçti. Dashboard build'inde mevcut webpack büyük-cache-string performans uyarıları görüldü; build hatası yok.
- CUA yerel tarayıcı kontrolü: izin sonrası tek page_view, hero signup/deneme, dahili /fiyatlar geçişi, fiyat kartı/dönem, demo, alerjen, 390 px mobil menü click'leri, geçersiz formda sıfır conversion ve izin geri çekme doğrulandı. Debug sırasında Google etiketi sayısı sıfırdı; fiyat sayfası çalışma zamanı error log'u boştu.
- Playwright conversion/readiness dosyaları güncellendi; bu oturumda Playwright suite çalıştırılmadı. Yukarıdaki CUA kontrolleri ve Node sözleşme testleri çalıştırıldı. Backend başarılı form/signup/business/publish koşulları unit/contract test düzeyinde doğrulandı; yeni gerçek hesap veya satış talebi oluşturulmadı.

Komutlar: `corepack pnpm check:ci`, `corepack pnpm --filter @garsonless/marketing test`, `corepack pnpm --filter @garsonless/marketing build`, `corepack pnpm --filter @garsonless/dashboard build`.
