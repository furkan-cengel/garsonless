# Yalnız QR menü için İngilizce çeviri

## Kullanım

Güncelleme (2026-10-23): ayrı **Çeviriler** ekranı kaldırıldı; çeviri ürün panelinden yapılır.

1. Menü → bir ürün (veya kategori düzenleme penceresi) → Türkçe adın altındaki **İngilizceye çevir**. Ürünün bütün metinleri (ad, açıklama, içindekiler, varyantlar, notlar) tek istekte kuyruğa girer; dashboard worker'ı cron'u beklemeden hemen tetikler (`invoke_menu_translation_worker`), sonuç birkaç saniyede panelde taslak olarak görünür.
2. Taslak panelde düzeltilebilir. **Kaydet** önce Türkçeyi, ardından İngilizceyi yayınlar; insan incelemesi bu adımdır.
3. **Ayarlar → Diller**: işletme sahibi, görünür menünün tamamı yayınlandığında İngilizce menüyü açar/kapatır; bölüm eksik çevirileri adlarıyla listeler.

Menü yetkili ekip çevirip yayınlayabilir; dil etkinleştirme sahibine aittir. Kaynak değişince yalnız o alan Türkçeye döner; yeni AI taslağı otomatik sıraya alınır ve panelde Kaydet ile yayınlanır. Kayıtlı terim sözlüğü AI isteklerinde kullanılmaya devam eder; düzenleme arayüzü şimdilik yoktur.

[18 Eylül UX araştırması, akış kararları ve ekran görüntüleri](ux/README.md).

## Mimari karar: menüye ait dil görünümü

Türkçe katalog asıl veridir. `MenuLocaleProvider` yalnız menü bileşenlerini ve ürün seçimi pencerelerini sarar. Menü dışındaki cart/member/payment/order ekranları, işletme vitrini ve uygulamalar mevcut Türkçe bağlamda kalır. Ürün seçimi callback'leri ve sepete yazım, kimlikten Türkçe katalog kaydına döner; fiyat/ID/tercihler değiştirilmez. Sipariş/ödeme şemasına dil eklenmez.

Dil önceliği geçerli `?lang=` → menü dili çerezi → desteklenen `Accept-Language` → Türkçe. Dil kapalıysa Türkçe kullanılır. URL değişimi aynı menüde kalır; dil değiştirmek sepeti veya ürün seçeneklerini sıfırlamaz. `lang` niteliği menü yüzeyine uygulanır, bütün belgeye uygulanmaz.

`domain → application → db` sınırı korunur. Veritabanındaki açık alan listesi kategori/ürün/ingredient/modifier metinleri, ürün açıklama notları ve yayınlanmış menü tema metinlerini içerir. Tasarım değerleri, görsel URL'leri, Wi-Fi şifreleri, `surfaces.home` ve yayınlanmamış tema taslakları taranmaz. Sabit menü/alerjen etiketleri `packages/ui/src/menu/menuEnglish.ts` içindedir; AI bunları üretmez. Ortak bileşenler provider dışında Türkçe kalır.

Public projeksiyon yalnız yayınlanmış ve mevcut kaynağa eşleşen alanları döndürür. Eksik/eski alan bazında Türkçe kullanılır. Taslak/sözlük/kullanım/iş geçmişi public yanıta girmez. Public okuma güncel veritabanı projeksiyonudur; kalıcı çeviri önbelleği eklenmedi. İleride eklenecek cache anahtarı işletme+dil+yayın revision içermeli, kaynak/paket değişiminde geçersizleşmelidir.

## Veri bütünlüğü ve ücret sınırları

- İşletme kilidi, `requestId`, kaynak ve taslak sürümüyle tekrar/eşzamanlı düzenleme kontrolü.
- RLS, sunucu action yetkisi ve DB actor kontrolü birlikte uygulanır. Anonim erişim yalnız public projeksiyondur.
- Kalıcı kuyruk: en fazla 20 alan/12.000 kaynak karakterlik iş, 120 saniye lease, en fazla üç teknik deneme. Eski kaynak/human edit sonuçları atılır.
- Kota hedef İngilizce için Unicode kaynak karakteridir: Pro denemesi boyunca 100.000; Pro 200.000/ay; Business 1.000.000/ay. Takvim ayı Europe/Istanbul; devir ve otomatik ek ücret yoktur.
- Kuyruğa girişte kota ayrılır. Başarıyla kaydedilen alanlar bir kez düşer; başarısız/eski alan rezervasyonu bırakılır. Manuel düzenleme ücretsizdir. Kota dolması Türkçe katalog düzenlemesini engellemez.
- Paket kapanınca İngilizce kapanır; veri korunur. Yeniden açılışta tam güncellik kontrolü gerekir. Süresi biten deneme public okumada da kontrol edilir.
- Ayrı sağlayıcı bütçesi varsayılan aylık 20 USD'dir (UTC ayı, tüm işletmeler toplamı). Her deneme öncesi 0,10 USD rezervasyon; token kullanımı bilinen çağrılar gerçek token tarifesiyle kapatılır. Çöken/sonucu bilinmeyen denemede rezervasyon ihtiyatlı olarak harcanmış sayılır. Bu müşteri kotası veya ek faturası değildir.

## AI ve güvenilirlik

Sunucu adaptörü `gpt-5.4-mini-2026-03-17` Responses API, strict JSON Schema, `store:false` kullanır. Menü metni ve terim sözlüğü veri olarak gönderilir; müşteri/sipariş/ödeme verisi gönderilmez. Sayı/birim, eksik/tekrarlı anahtar, boş/biçimsiz yanıt, ret ve kesilme kontrolleri vardır. Kaynakta olmayan malzeme/alerjen/iddia eklenmemesi, marka ve yemek adlarının korunması istenir.

Bu kontroller anlam doğruluğunun garantisi değildir. İnsan incelemesi yayın koşuludur. Model veya prompt değişikliği değerlendirme setini yeniden çalıştırmayı gerektirir.

Kaynaklar: [model/snapshot](https://developers.openai.com/api/docs/models/gpt-5.4-mini), [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [Next.js 15 internationalization](https://nextjs.org/docs/15/app/guides/internationalization).

## Ortama kurulum

Üretim kurulumu mevcut release süreciyle yapılır. Geliştirme kurulumunun durumu aşağıdaki kayıttadır:

1. `20260918120000_menu_translation.sql`, `20260918121000_menu_translation_worker.sql` ve `20260918122000_menu_translation_worker_configuration.sql` migration'larını sırasıyla uygulayın. pg_cron, pg_net ve Supabase Vault mevcut altyapıyı kullanır.
2. Edge secrets: `OPENAI_API_KEY`, güçlü/rastgele `MENU_TRANSLATION_WORKER_SECRET`, isteğe bağlı `MENU_TRANSLATION_MONTHLY_BUDGET_USD` (varsayılan `20`). Anahtarlar `NEXT_PUBLIC_*` değişkenlerine konmaz.
3. Önce repo kökünden `node packages/db/scripts/menu-translation/sync-worker-provider.mjs` çalıştırın; ardından `menu-translation-worker` Edge Function'ını açık `--project-ref` ile deploy edin. Supabase paketi, application adaptörünün testle eşliği korunan `_shared` kopyasını içerir. JWT kontrolü config'te kapalıdır; POST isteğinde `x-translation-secret` zorunludur. Servis rolü ortamını Supabase sağlar.
4. Vault'ta `menu_translation_worker_url` = deploy edilen function HTTPS adresi ve `menu_translation_worker_secret` = aynı worker secret tanımlayın. Secret değerlerini repoya/komut geçmişine/loglara yazmayın. Eksik Vault ayarında cron iş göndermez; eksik OpenAI anahtarında worker claim etmeden 503 döner.
5. Dashboard ve menü uygulamalarını birlikte yayınlayın. Önce seçili işletmede manuel taslak/yayın ve ardından AI işini doğrulayın; kalite incelemesinden sonra sahibi İngilizceyi açsın.

Cron her dakika bir iş işler. `menu_translation_jobs` durumları ve yaşları, hata kodları, usage/reserved ve provider_spend izlenmelidir. API anahtarı veya kaynak içerik worker loglarına yazılmaz. Bütçe dolunca işler kuyrukta kalır; yayınlanmış çeviriler çalışır. Sorunda işletme İngilizceyi kapatabilir; cron durdurmak yeni üretimi durdurur ve katalog verisini değiştirmez.

## Doğrulama

Node 24, workspace bağımlılıkları ve Docker gerekir. Test DB bağlantısı sabit localhost:55440'tır; proje/canlı bağlantı değişkenleri okunmaz.

```sh
node packages/db/scripts/menu-translation/setup-local.mjs
cd packages/db
node --import tsx scripts/menu-translation/runtime.test.ts
```

Kurulum var olan test konteynerini silmez. Yeniden temiz kurulumdan önce yalnız `masabu-menu-translation-test` konteynerinin `masabu.menu-translation-test=true` etiketini kontrol ederek kaldırın. Başka veritabanı kullanılmaz.

```sh
# Repo kökünde
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test:architecture
corepack pnpm test:db
node scripts/menu-translation/browser-check.mjs
corepack pnpm --filter @garsonless/dashboard build
corepack pnpm --filter @garsonless/menu build
```

Tarayıcı harness'i gerçek menü/ürün/sepet bileşenlerini 390px ve 1440px'de yerel örneklerle çalıştırır. Yönetim action'ı kasıtlı başarısızdır: taslak kaybı/sahte başarı kontrol edilir. Yetki/kota/yayın yarışları gerçek PostgreSQL runtime testindedir. Tarayıcı testinin geçici route'u ve derleme dizini kapanışta kaldırılır; ekran görüntüleri `/private/tmp/masabu-menu-translation-browser` dizinine yazılır.

## 100 örnekli pilot değerlendirmesi

`evaluation-cases.json`: 20 kategori, 20 yemek/açıklama, 20 malzeme, 20 kritik alerjen/olumsuzluk/miktar, 20 seçenek. Tamamı sentetik örnektir. **Gerçek DEV worker ile çevirileri üretildi; %95 insan kabul hedefi henüz ölçülmüş değildir.** Anahtar yalnız Edge Secrets içinde tutuldu.

Yetkili test ortamında anahtarı güvenli environment olarak verin. Aşağıdaki komut ücretli model çağrısı yapar ve yeni bir inceleme dosyası üretir; mevcut dosyayı ezmez:

```sh
# packages/db içinden
node --import tsx scripts/menu-translation/evaluate.ts generate /tmp/menu-translation-review.json
```

Türkçe ve İngilizce bilen incelemeci her satır için `acceptable`, `criticalError`, `reviewer` ve gerekçeyi (`note`) doldurur. Kritik hata: malzeme/alerjen/alkol/domuz/negasyon/miktar anlamının değişmesi veya kaynakta olmayan iddia. Kabul edilebilir: doğru anlamı koruyan, menüde doğal okunabilen çeviri. Salt biçim farklılığı kritik hata değildir.

```sh
node --import tsx scripts/menu-translation/evaluate.ts report /tmp/menu-translation-review.json
```

Yayın hedefi: en az 100 tamamlanmış insan incelemesi, sıfır kritik hata, en az %95 kabul. Otomatik rapor bu eşikleri kontrol eder; insan değerlendirmesini üretmez. Başarısız çıktıda sözlük/prompt düzeltmesi ve yeniden ölçüm yapılır. Sonra seçili gerçek işletmelerin kendi menülerinde onaylı pilot yürütülür. Bu dış adımlar tamamlanmadan kalite/pilot tamamlandı denmemelidir.

## Yerel doğrulama kaydı — 18 Eylül 2026

- Boş PostgreSQL 17 üzerinde bütün migration zinciri başarılı.
- 20 gerçek PostgreSQL senaryosu başarılı: API actor ve doğrudan authenticated/anon RLS, kaynak/yayın yarışı, çalışanlar arası claim yarışı, kota yarışı, tekrar güvenliği, sağlayıcı kesintisi, eski manuel metnin korunması, paket/deneme kapanışı ve tema alan sınırı.
- 1.798 mimari/birim testi, 671 DB regresyon testi, 12 Next.js kural testi başarılı.
- Workspace typecheck ve lint başarılı; dashboard ve menü production build başarılı.
- 390px/1440px Playwright: İngilizce ürün detayları, uzun metinler, Türkçe sepet ve kalıcı sepet verisi, klavyeyle dil değişimi, yatay taşma/scroll, başarısız kayıtta taslak koruma başarılı. Ekran görüntüleri görsel olarak incelendi.
- Değerlendirme raporlayıcısının doldurulmamış 100 örneği reddettiği doğrulandı. İnsan kalite değerlendirmesi ve işletme pilotu henüz tamamlanmadı; üretim migration/deploy yapılmadı. DEV kurulum kaydı aşağıdadır.


## Geliştirme kurulumu — 18 Eylül 2026

Geliştirme projesi `yxsegwkzyiscrxiwdeuf` üzerinde üç migration uygulandı ve `menu-translation-worker` deploy edildi. Worker kimlik doğrulama anahtarı rastgele üretilerek Edge Secrets ve Vault'a eşlendi; gizli değer dosyaya veya çıktıya yazılmadı. Dakikalık cron aktif, yetkisiz çağrı 401. `OPENAI_API_KEY` DEV Secrets ekranına eklendi ve gerçek kuyruk/worker üzerinden üç sentetik alanla doğrulandı. İlk denemede sağlayıcı `credit_balance_exhausted` döndürdü. Kullanıcının kredi eklemesinden sonra üç örnek başarıyla çevrildi; ardından 100 sentetik çeviri üretildi. Geçici test kayıtları temizlendi. Menü, dil ayarları ve yayınlar değiştirilmedi. Üretim projesi değiştirilmedi.

API anahtarı ve kredi kurulumu tamamlandı. Sonraki adım çeviri incelemesi ve seçili işletmede pilot. Bakiye hatası tekrarlanırsa ilgili organizasyonun [Billing](https://platform.openai.com/settings/organization/billing) ekranı kontrol edilir. [OpenAI hata belgesine](https://developers.openai.com/api/docs/guides/error-codes) göre bu hata bakiye düzelmeden tekrar denenmemeli. Adaptör, bakiye/harcama/kota hatalarını geçici hız sınırından ayırır; yalnız izin verilen hata kodunu saklar. Hata mesajı veya anahtar loglanmaz.

Tekrar kurulum için `packages/db` içinden:

```sh
node scripts/menu-translation/configure-worker.mjs dev
```

Bu komut worker anahtarını yeniler, Vault ile eşler ve worker bütçesini aylık 20 USD'ye ayarlar. Yalnız worker'ın iki ayarını yükler; uygulamanın environment dosyasını Supabase'e göndermez. PROD hedefi `prod --confirm-prod svxvloeosiksqfadgkvo` gerektirir ve mevcut release akışından sonra kullanılmalıdır.

Ek doğrulamalar: 21 yerel PostgreSQL senaryosu ve worker paketinin application adaptörüyle birebir eşleşme testi geçti. Gerçek çeviri bağlantısı ve 100 örneğin üretimi başarılı; insan incelemesi bekleniyor. Bakiye/kota hata ayrımı için 14 adaptör testi, paket eşlik testi, application typecheck ve ilgili lint kontrolleri geçti. DEV kurulumunun başarıyla tamamlanması, çeviri kalitesi veya PROD yayınının tamamlandığı anlamına gelmez.

DEV üzerinde anahtarı okumadan yeniden bağlantı kontrolü (`packages/db` içinden):

```sh
node scripts/menu-translation/verify-provider.mjs smoke <DEV_RESTAURANT_ID> /tmp/menu-translation-smoke.json
```

Bu komut yalnız DEV projesini kabul eder; aktif çeviri işi varsa durur. Geçici, yayınlanmamış sentetik alanlar ve ayrı kullanım dönemi oluşturur; terminal sonuçta kendi kayıtlarını temizler. Gerçek sağlayıcı harcaması bütçe kaydında korunur. `evaluation` modu 100 sentetik örneği üretir; insan incelemesi yerine geçmez.

## Kredi sonrası gerçek sağlayıcı doğrulaması

Üç alanlık bağlantı testi başarılı (`provider-smoke.json`). Ardından 100 sentetik alan beş kuyruk işiyle üretildi (`evaluation-initial.json`). Asistan ön incelemesinde Mantı adının değiştirilmesi, orta pişmiş derecesinin medium rare olması ve et suyu içeren bir uyarıda et bilgisinin eksilmesi görüldü. Yemek adlarını koruma ve içerik kökenini eksiltmeme talimatı netleştirildi; varsayılan sözlüğe pişirme dereceleri ve et suyu eklendi. Bu yaklaşım açık talimat ve örnek kullanımına dayanır: [resmî OpenAI prompting belgesi](https://developers.openai.com/api/docs/guides/prompt-engineering).

DEV worker yeniden deploy edildi. İkinci üretimde 100 alanın tamamı beş işte, her iş tek denemede tamamlandı; üç gözlenen sorun bu çalıştırmada düzeldi. Sağlayıcı kaynağının SHA-256 özeti `evaluation-revised.json` içinde saklanır. Geçici kayıtlar temizlendi; müşteri kataloğu, yayınları ve dil ayarları değiştirilmedi. Adaptör testleri (14), paket eşlik testi, application typecheck ve ilgili lint başarılı.

İnsan incelemesi için [karşılaştırmalı tablo](evaluation-review.md) ve [doldurulacak JSON](evaluation-review.json) hazır. Bağlama duyarlı şekersiz/acısız/çift köfte terimleri ayrıca işaretlendi. Bu örnekler talimat iyileştirmesinde de kullanıldığı için bağımsız kalite sonucu değildir. İnsan kabul oranı, kritik hata eşiği ve gerçek işletme pilotu henüz tamamlanmadı. Rapor kontrolü:

```sh
# packages/db içinden, insan incelemesi tamamlandıktan sonra
node --import tsx scripts/menu-translation/evaluate.ts report ../../docs/menu-translation/2026-09-18/evaluation-review.json
```

Yerel yönetim ekranında Menü → Çeviriler → Eksik çevirileri hazırla akışı kullanılabilir. İşletme metinleri yan yana incelenip düzeltildikten sonra seçilen alanlar yayınlanır; görünür alanlar tamamlandığında sahibi İngilizceyi açabilir. API kurulumu DEV üzerinde tamamdır; PROD yayını yapılmadı.
