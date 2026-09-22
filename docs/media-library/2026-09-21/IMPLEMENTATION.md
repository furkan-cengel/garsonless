# Dosya kütüphanesi — uygulama ve işletim

21 Eylül 2026. 22 Eylül güncellemesi: DEV ve PROD veritabanı/katalog/worker kurulumu tamamlandı. [Yayın kaydı](../../operations/release-2026-09-21.md).

## Kullanım

- Sol menüden **Dosyalar** açılır. Menü, logo, QR ve tema alanlarındaki görsel/video seçme düğmeleri aynı kütüphaneyi açar.
- **Dosyalarım**: ada göre arama, tür/kullanım filtresi, sıralama, 40 dosyalık sayfalama ve ayrıntı.
- **Yeni yükle**: sırada, gerçek aktarım yüzdesi, kontrol ediliyor, hazır ve hata durumları. Aktarım durdurulabilir; başarısız dosya yeniden denenebilir.
- Seçmek mevcut formu günceller. İşletme logosu mevcut davranışı gibi hemen kaydedilir; ürün ve tema kendi kaydet/yayınla akışını korur. Tamamlanmış yükleme form iptal edilse de kütüphanede kalır.
- Kullanımda olan dosya silinemez. Menü, kategori, işletme, tema canlı/taslak/geçmiş referansları veritabanında izlenir. Silinmiş dosyanın eski URL’si yeniden bağlanamaz.
- QR logosu, mevcut QR üretim akışına uygun küçük bir kopya olarak saklanır; kütüphane görseline canlı referans değildir. Bu ayrım alanda açıklanır.

Kotalar işletme başına Starter 250 MB, Plus 1 GB, Pro denemesi 1 GB, Pro 5 GB, Business 10 GB. Kaynak ve kalıcı türevlerin gerçek boyutları sayılır. Geçici rezervasyon ayrıca gösterilir. Aynı dosyayı yeniden seçmek ek alan tüketmez.

## Mimari

- Domain: `packages/domain/src/media-library.ts`; application: `packages/application/src/media-library.ts`; DB port: `packages/db/src/media-library-port.ts`.
- Sunucu: `apps/dashboard/lib/media-library-server.ts`; same-origin API: `/api/media-library`; yetkili orijinal indirme: `/api/media-library/download`.
- Arayüz: `MediaLibrary`, `MediaPicker`, `MediaInput`; `/dashboard/[restaurantId]/files`.
- Görseller özel kaynak + WebP görüntü/menu/logo türevleriyle saklanır. Eski görseller URL değiştirmeden kataloglanır; gerektiğinde amaç boyutları hazırlanır. Yeni SVG yüklenmez; eski SVG bağlantıları korunur.
- Public görsel URL’leri halka açıktır; kütüphane metadata’sı tenant yetkileriyle korunur. Kaynaklar private bucket’tadır.
- Tenant kilidi, rezervasyon, işlem anahtarı, hash tekilleştirme, işleme lease’i ve immutable nesne yolları kullanılır. Object Storage/DB kesintileri kalıcı temizleme işleriyle uzlaştırılır.
- `files` yetkisi yönetim/silme içindir. Menü/tema/ayar/masa yetkisi ilgili alanda seçmeye/yüklemeye yeterlidir; mevcut logo ve video paket/sahip kısıtları korunur.
- `media_operation_events` başarılı mutasyonların aktörünü/zamanını kaydeder. `audit_media_storage()` katalog ile kullanılan/ayrılmış kota arasındaki farkı döndürür; otomatik bakiye düzeltmez.

## DEV geçişi ve worker

Uygulanan migration’lar:

1. `20260921120000_media_library.sql`
2. `20260921121000_media_library_permissions.sql`
3. `20260921122000_media_library_observability.sql`

DEV’de 30 işletmedeki 84 eski nesne, toplam 35.031.387 byte, yerinde kataloglandı. Sınıflandırılmamış nesne kalmadı. Logo, galeri ve eski bölüm klasörleri dahil edildi; mevcut URL’ler değişmedi. Son `audit_media_storage()` sonucu: **0 uyuşmazlık**.

`media-library-cleanup` DEV Edge Function kuruldu. Vault gizli anahtarıyla 10 dakikada bir çağrılır. Yetkisiz çağrı 401, yetkili probe başarılı. Silme/yarım yükleme temizliği Storage API kullanır. İmzalı staging yüklemesinin geç yazımını önlemek için staging temizliği bekletilir. Başarısız fiziksel silme kotayı erken serbest bırakmaz. Worker kota mutabakatını da kontrol eder ve farkı sunucu loguna yazar.

Komutlar repo kökünden aksi belirtilmedikçe çalışır:

```sh
# packages/db içinde, yalnız DEV
node --env-file=../../apps/dashboard/.env.local scripts/media-library/backfill.mjs
node --env-file=../../apps/dashboard/.env.local scripts/media-library/backfill.mjs --apply --confirm-dev
node scripts/media-library/configure-worker.mjs dev

# PROD: önce salt okunur envanter; sonra aynı hedefe açık apply
node --env-file=../../apps/dashboard/.env.production scripts/media-library/backfill.mjs --target prod --confirm-prod svxvloeosiksqfadgkvo
node --env-file=../../apps/dashboard/.env.production scripts/media-library/backfill.mjs --target prod --confirm-prod svxvloeosiksqfadgkvo --apply

# Repo kökünde; headless localhost + API fixture
node scripts/media-library/browser-check.mjs

# Repo kökünde; DEV'de bu teste özel işletme ve gerçek Storage
# Sadece oluşturduğu kayıt/nesneleri sonunda temizler.
node scripts/media-library/storage-check.mjs

# packages/db içinde; yalnız izole yerel PostgreSQL 55440
node --import tsx scripts/media-library/runtime.test.ts
```

## Doğrulama

- Domain: 106 test; application: 295 test; dashboard: 1.008 test geçti.
- Gerçek PostgreSQL: işletme/ekip sınırı, RLS ve RPC erişimi, tekrar güvenliği, hash tekilleştirme, kota yarışı, referanslı silme, stale URL, eski görsel türevi hata/temizlik/tekrar, expiry ve mutabakat kontrolleri geçti.
- DEV’de geçici işletmeyle gerçek imzalı yükleme, Sharp dönüşümü, logo boyutu, özel kaynak, aynı dosyanın tekilleştirilmesi ve fiziksel silme sonrası kota iadesi geçti. Test işletmesi/dosyaları temizlendi.
- 390px / 1440px: liste/seçici, klavye Escape, hata sonrası seçim ve formun korunması, upload, sıradaki yüklemeyi durdurma, yeniden adlandırma, referanslı silmenin engellenmesi, boş dosyanın silinmesi ve yatay taşma kontrolü geçti. Tarayıcı testleri fixture API kullanır; gerçek Storage ayrı testle doğrulandı.
- Repo lint, tüm workspace paketlerinin typecheck’i ve dashboard üretim build geçti. Ekran kanıtları geçici `/tmp/masabu-media-library-qa` dizinindedir.

## Galeri kullanım iyileştirmesi

Dosyalar sayfasında görsellerin üzerinden kaydırma artık sayfanın ana kaydırma alanını kullanır; açılır dosya seçici kendi sınırlı kaydırma alanını korur. Küçük kartlar (varsayılan), büyük kartlar ve liste görünümü eklendi; seçim tarayıcıda hatırlanır. Görsel önizlemeleri sabit oranlıdır. Tür, sıralama ve kullanım filtreleri shadcn Select; görünüm seçici ToggleGroup; dosyalar Item/ItemGroup; depolama özeti Card bileşenlerini kullanır.

390px ve 1440px tarayıcı kontrollerinde görsel üzerinden kaydırma, kart boyutları, liste, görünümün yenileme sonrası korunması ve üç filtrenin kullanımı doğrulandı. Mevcut yükleme, seçici, hata sonrası seçim/form koruması, yeniden adlandırma ve silme kontrolleri de geçti. Bu değişiklik için dashboard typecheck ve ilgili dosyaların lint kontrolü geçti.

## Yayın sınırı

Üretimde migration/backfill/worker kurulumu 22 Eylül’de tamamlandı. Altı aktif işletmenin kataloğu açıldı; bir eski dosya (33.676 byte) içe alındı. Sınıflandırılmamış dosya ve kota mutabakat farkı yok. Backfill komutu PROD için açık hedef ve eşleşen proje onayı ister; ortam/hedef uyuşmazlığını ve sınıflandırılmamış dosya varken yazımı reddeder. Mevcut dosyalar taşınmaz; yalnız katalog ve referans kayıtları oluşturulur. Gerçek işletmelerde kullanıcı pilotu ayrıca izlenir.

Bu sürümde klasörler, global dosya değiştirme, çöp kutusu, özel belge/CSV, ek depolama satışı ve gelişmiş görsel editörü yoktur. Ayrı bir kota bypass/feature-flag paneli uygulanmadı; DEV’de kurulup doğrulanan akış kademeli PROD pilotunun hazırlığıdır. Günlük fiziksel Storage envanterini karşılaştıran bağımsız görev yerine kalıcı temizlik kuyruğu ve 10 dakikalık katalog/kota mutabakatı vardır; nesne seviyesindeki kontrol geçiş ve entegrasyon testiyle yapılmıştır.
