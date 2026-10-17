# Rehberli kurulum ve AI menü aktarımı

Masabu paneline menü, logo ve tema turları eklendi. “Kurulum rehberi” düğmesi her sayfada, yeniden başlatma bağlantısı Yardım alanında bulunur. Turlar gerçek kontrolleri vurgular; mobilde Menü işlemleri üzerinden ilgili seçeneğe ulaşır. Tur ilerlemesi kullanıcı + işletme kapsamında bu tarayıcıda saklanır. “Tur incelendi” ile gerçek kurulumun tamamlanması ayrıdır: ürün sayısı ve logo sunucudan okunur. İzin veya paket kapsamında olmayan turlar listelenmez.

## Menü aktarımı

1. Menü → AI ile yükle (mobilde Menü işlemleri) → PDF/JPG/PNG/WebP seç.
2. Dosya kalıcı kuyruğa girer. Kullanıcı pencereyi kapatabilir, başka sayfaya geçebilir veya tarayıcıyı yeniden açabilir.
3. SQL cron dakikada bir ayrı Edge worker'ı çağırır. İş `queued → reading → review` aşamalarından geçer. Arayüz süre/yüzde uydurmaz.
4. Kullanıcı kategori, ad, açıklama ve TL fiyatlarını düzenleyip taslağı kaydeder. Eksik veya belirsiz fiyat boş kalır. PDF içeriğindeki talimatlar uygulanmaz.
5. “Kontrol ettim” ve son onay ile mevcut `import_menu_rows` komutu çağrılır. Bir satır bile başarısızsa tüm yazılar geri alınır. Aynı işin yeniden onaylanması ikinci kez ürün oluşturmaz.

AI görsel, alerjen, kalori veya beslenme iddiası üretmez. Onaylanan ürünler mevcut menü içe aktarma davranışıyla müşteri menüsüne eklenir; onay metni bunu açıkça belirtir.

## Sınırlar ve veri saklama

- Dosya başına 3 MiB, PDF başına 10 sayfa, görsel başına 20 milyon piksel, aktarım başına 200 ürün.
- İşletme başına kayan 24 saatte 5, sistem genelinde 100 yeni iş. Aynı işletmede bir etkin okuma/kontrol taslağı.
- Özel `menu_import_jobs` tablosunda kaynak base64 bulunur; tarayıcının doğrudan tablo erişimi yoktur. API yalnız temizlenmiş iş görünümünü döndürür.
- Kaynak, okuma bitince veya iptal edilince silinir. SQL zamanlayıcısındaki bağımsız temizlik, worker/provider çalışmasa bile 24 saati aşan kaynakları siler. İş geçmişi 30 gün tutulur.
- İşler 3 dakikalık lease ile alınır. Worker kesilirse en fazla ikinci deneme yapılır; eski lease veya iptal sonrası sonuç uygulanmaz.
- Taslak düzenleme revision kontrolü kullanır. Başka oturumun değişikliği sessizce ezilmez.
- OpenAI Responses çağrısında `store: false` kullanılır. Bu ayar sağlayıcının tüm saklama politikalarının yerine geçmez.

## Dosyalar

- `apps/dashboard/components/onboarding/GuidedSetup.tsx`: kontrol listesi, tur konumlandırma ve panel genelindeki iş kartı.
- `MenuImportDialog.tsx` / `menu-import-client.ts`: yükleme, durum takibi, taslak düzenleme ve son onay.
- `apps/dashboard/app/api/menu-import/route.ts`: oturum/izin/paket, aynı-origin ve boyut kontrolleri.
- `packages/application/src/menu-import.ts`: dosya/ürün sözleşmesi ve sağlayıcı adaptörü.
- `packages/db/supabase/migrations/20261012140000_guided_menu_import.sql`: özel kuyruk, RPC'ler, atomik aktarım, temizlik ve cron.
- `packages/db/supabase/functions/menu-import-worker`: bağımsız worker. `_shared/menu-import.ts` kopyası test edilen adaptörle birebir tutulur.

## Ortama açma

Bu geliştirme uzak veritabanına migration uygulamaz, worker deploy etmez veya dashboard ortam değişkenlerini değiştirmez. Rehberler yerel kodla kullanılabilir; AI yükleme açıkça `MENU_IMPORT_ENABLED=true` olmadıkça başlatılmaz.

Sıra:

1. Mevcut hedef doğrulamalı migration süreciyle yeni migration'ı dev ortamına uygula.
2. `menu-import-worker` Edge Function'ını aynı hedefe deploy et. Mevcut çeviri worker'ının kullandığı `OPENAI_API_KEY` aynı Supabase projesinde bulunmalı.
3. `packages/db` içinde `node scripts/menu-import/configure-worker.mjs dev` çalıştır. Script rastgele worker sırrını Edge ve Vault'a yazar; sırrı stdout'a veya komut argümanına koymaz. Prod, açık hedef eşleşmeli `prod --confirm-prod PROJECT_REF` seçeneği gerektirir.
4. Worker erişimi, API anahtarı ve cron doğrulandıktan sonra dashboard ortamında `MENU_IMPORT_ENABLED=true` tanımla ve yeniden dağıt.
5. Dev ortamında örnek gerçek PDF/fotoğrafla okuma → kontrol → onay akışını doğrula. Ardından aynı sürümü normal yayın sürecinden geçir.

Geri alma: dashboard'da `MENU_IMPORT_ENABLED` kaldırılarak yeni işler durdurulur. Mevcut kuyruğun bitmesine izin verilir; temizlik cron'u açık bırakılır.

## Doğrulama

- Application: `node --import tsx --test src/menu-import.test.ts`
- Dashboard: `node --import tsx --test components/onboarding/guided-setup-model.test.ts`
- Worker eşliği: `node --test scripts/menu-import-worker-bundle.test.mjs` (`packages/db`)
- SQL runtime: `node scripts/menu-import-runtime.mjs` (`packages/db`). Yalnız `127.0.0.1:55440` yerel çeviri test veritabanını kullanır; migration, test verileri ve cron kaydı aynı transaction sonunda geri alınır. Uzak ortam anahtarları okunmaz.
- UI: depo kökünde `node scripts/guided-setup/browser-check.mjs`. Geçici geliştirme rotasıyla gerçek bileşenleri 1440 ve 390 px'de çalıştırır; navigasyon ve API yanıtları fixture'dır. Gerçek DB veya AI servisine yazmaz. Test sonunda geçici rota kaldırılır. Görseller `/private/tmp/masabu-guided-setup-browser` altındadır.

API biçimleri [OpenAI dosya girişleri](https://developers.openai.com/api/docs/guides/file-inputs), [görsel girişleri](https://developers.openai.com/api/docs/guides/images-vision) ve [Next.js 15 route handler belgeleri](https://nextjs.org/docs/15/app/api-reference/file-conventions/route) üzerinden kontrol edildi. Sağlayıcı modeli mevcut çeviri adaptöründeki `gpt-5.4-mini-2026-03-17` ile aynıdır.
