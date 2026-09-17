# Masabu — reçeteli stok takibi

17 Eylül 2026. Kullanıcının onayladığı plan doğrultusunda tek şube ve Pro/Business kapsamı.

## Araştırma ve ürün gerekçesi

Kullanıcı tartışmalarındaki ana sinyal sayım/veri giriş yükü ve reçete güncelliğine bağlı güven sorunudur. Bulgular nitel sinyaldir; temsilî kullanıcı araştırması veya Masabu müşteri analitiği değildir.

- [Sayım kapsamı ve sıklığı](https://www.reddit.com/r/restaurantowners/comments/1uc5cey/how_granular_do_you_get_and_how_frequently_do_you/) ve [yönetim yükü](https://www.reddit.com/r/restaurantowners/comments/1vtln00/inventory_and_administration_cost_v_benefit/): mobil/parsiyel sayım, raf sırası ve taslak.
- [Toast tüketim analizi](https://support.toasttab.com/en/article/xtraCHEF-Inventory-Analytics): teorik tüketim, fiziksel sayım ve kayıtlı fireyi ayırma.
- [Loyverse modifier davranışı](https://help.loyverse.com/help/how-set-and-apply-modifiers): ek malzemeye özel stok eşlemesi fırsatı.
- [Loyverse üretim](https://help.loyverse.com/help/how-work-production): üretim girdileri ile satılan hazırlanmış stok ayrımı.
- [Koli/adet dönüşümü](https://help.loyverse.com/help/how-order-items-by-boxes): ürüne özel birimler.
- [Simpra](https://simprasuite.com.tr/restoran-otomasyonu/stok-takip-programi/): Türkiye pazarındaki kapsam karşılaştırması.

Reddit, resmî ürün belgeleri, GitHub, Hacker News, Stack Overflow ve X tarandı. Son dört kanalda güncel doğrudan kullanıcı sorunu kanıtı zayıftı; sıklık sonucu çıkarılmadı. İç kaynak yalnız kod ve proje belgeleridir; müşteri görüşmesi, destek kaydı veya rakip ürünlerde oturum açılmış kullanılabilirlik testi yoktur.

## Kullanım

`/dashboard/[restaurantId]/inventory`: genel bakış, stoklar, reçeteler, işlemler, sayım, hareketler/raporlar. Menü ürün editöründeki “Stok ve reçete” ilgili ürünün eşlemesini açar.

1. Stok kartlarını ve açılış miktar/maliyetlerini girin; istenirse CSV şablonundan önizleyerek ekleyin.
2. Menü ürünü için takipsiz, doğrudan stok veya reçete seçin. İçerik açıklamaları otomatik reçete değildir.
3. Ekstra seçenekleri ve çıkarılabilir içerikleri mevcut seçenek kimlikleriyle eşleyin. Üretim reçetelerinde çıktıyı ve girdi miktarlarını tanımlayın.
4. Örnek reçete maliyetini inceleyin; stoklar güncelken takibi başlatın. Eski açık siparişler geriye dönük düşülmez.
5. Mal kabul, fire, dış satış, üretim ve düzeltmeleri stok etkisi önizlemesinden sonra kesinleştirin.
6. Sayımı taslak kaydedin. Hareket görmüş satırları yeniden sayın. Sahip kaydedilmiş sayımı onaylar; kaydedilmemiş değişiklik varken onay kapalıdır.

Miktar negatif olabilir; uyarı satışı engellemez. Eksik maliyet sıfır değildir. Üretim hareketleri, normal tüketim, sayım farkı ve iptal firesi ayrı görünür. Hareket belgesi kaynak sipariş ve tüm belge satırlarını gösterir. CSV dışa aktarmada formül karakterleri etkisizleştirilir. Açık ekranda ilk hareket sayfası 30 saniyede yenilenir; ağ hatasında kayıt başarılı gösterilmez.

## Teknik sınırlar

[ADR 0005](../../adr/0005-receteli-stok.md) değişmez kuralları tanımlar. Domain/application inventory sözleşmeleri, sunucu aksiyonu ve service-only RPC kullanılır. Veritabanı actor/tenant/plan kontrollerini tekrarlar. Hassas tablolar RLS ve mevcut cihaz doğrulama kontrolüne tabidir; public menüye maliyet veya reçete snapshot'ı çıkmaz.

Migration sırası:

1. `20260917150000_inventory_foundation.sql`
2. `20260917151000_inventory_commands.sql`
3. `20260917152000_inventory_orders.sql`

Transfer fonksiyonları mevcut en son uygulamalarının üzerine wrapper ile bağlanır; mali/operasyonel korumalar korunur. Eski özel fonksiyonlar yalnız service role erişimindedir. Kalıcı satır kimliği geçmiş siparişleri yeniden yazmaz.

Stok kartı ve reçete sayıları ilk sürümde tek şube için toplu okunur; hareketler 100 satırla sayfalanır, rapor toplamları veritabanında bütün defterden hesaplanır. Büyük işletmeler için liste sayfalama ayrı optimizasyondur. CSV içe aktarma tek transaction ve en fazla 500 yeni karttır. Altıncı ondalığın altına düşen özel birim dönüşümü reddedilir.

## Doğrulama

Node 24 ile:

```sh
corepack pnpm --filter @garsonless/domain test
corepack pnpm --filter @garsonless/application test
corepack pnpm --filter @garsonless/db test
corepack pnpm --filter @garsonless/dashboard test:architecture
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm --filter @garsonless/dashboard build
corepack pnpm --filter @garsonless/db test:inventory:setup
corepack pnpm --filter @garsonless/db test:inventory:runtime
node scripts/inventory/browser-check.mjs
```

`test:inventory:setup` Docker çalışırken yalnız `masabu-inventory-test` adlı geçici konteyneri oluşturur ve bütün migrationları sırayla kurar; aynı isimde konteyner varsa durur. Başka bir veritabanını sıfırlamaz. Testler bittikten sonra `docker rm -f masabu-inventory-test` ile yalnız bu konteyner kaldırılabilir.

`test:inventory:runtime` yalnız `127.0.0.1:55439` üzerindeki geçici PostgreSQL'e bağlanır; hiçbir `.env` dosyası yüklemez. Sentetik işletmeler üretir. Test konteyneri dışında çalıştırılmaz. Bağlantı parolası yalnız bu tek kullanımlık konteyner içindir, proje kimlik bilgisi değildir.

Yerel test ortamı: `public.ecr.aws/supabase/postgres:17.6.1.127`, geçici veri alanı ve localhost 55439. Supabase Auth/Storage servisleri çalıştırılmadığından yalnız migrationların ihtiyaç duyduğu servis şeması fixtureları `packages/db/scripts/inventory/test-bootstrap.sql` ile kurulur. Uygulamanın tüm migration geçmişi transaction başına uygulanır. Repo yerel yapılandırması PostgreSQL 15 belirtir; Supabase CLI ile doğrulanan paylaşılan DEV sunucusu PostgreSQL 17.6.1.121 çalıştırıyor. Üç migration bu gerçek DEV ortamına da başarıyla uygulandı. PostgreSQL 15 çalıştıran ayrı bir hedefe yayınlanacaksa o hedefte ayrıca prova yapılmalıdır.

Runtime senaryoları: tenant/rol reddi, açılış, tekrar ve farklı içerikli istek; çok oturumlu giriş yarışı; eski sipariş kapsam dışı; ekstra/çıkarma; mutfak tekrarları; hazırlık öncesi/sonrası iptal ve sınırlı iade; üretim ve çift düşmeme; sürümlü reçete; sayım/bakiye sürüm çakışması ve sıfır/boş ayrımı; aynı işlem anahtarıyla eşzamanlı tekrar; tam/kısmi/ardışık taşıma, tekrar ve geri alma; ayrışan hazırlıkta geri alma reddi; yalnız ödeme durumuyla tüketim başlamaması; immutable defter; negatif stok; RLS; paket düşürme/yeniden açma.

### Yerel kontrol sonuçları

- Dashboard kabuğundaki kaydırma ve geniş buton sorunları düzeltildi; 1440px/390px fare, klavye ve mobil pencere erişimi doğrulandı. [Görselli UI/UX incelemesi](ux-audit.md).
- Domain: 99, application: 279, DB: 671, dashboard mimari: 1008 test geçti.
- Tüm workspace tip kontrolü, repo lint ve 18 Next.js/migration sözleşme testi geçti.
- Son migrationlarla temiz PostgreSQL kurulumu ve gerçek çok oturumlu stok runtime testleri geçti. Defter toplamı bütün stok bakiyeleriyle eşleşti. [Runtime sonucu](runtime-verification.json).
- Dashboard üretim derlemesi geçti: stok route 28,4 KB, ilk yükleme 177 KB (Next.js build raporu).
- Playwright: 1440px/390px, stok ekleme, dönüşümlü giriş, sayım taslağı/onayı, CSV hatası/içe aktarma/dışa aktarma, klavye gezinmesi ve ağ hatasında taslak korunması geçti. [Senaryo sonucu](browser-verification.json), [masaüstü](qa-1440.png), [mobil](qa-390.png), [mobil ağ hatası](qa-390-network-error.png).

Tarayıcı kontrolü gerçek stok bileşenini ve gerçek SQL komutlarını sentetik verilerle çalıştırdı. Oturum açılmış dashboard kabuğu veya canlı müşteri hesabı kullanılmadı; giriş/yetki kontrolleri application/RLS testleriyle ayrıca doğrulandı. `scripts/inventory/browser-check.mjs` yalnız geliştirme modunda localhost 3024 üzerinde geçici test route'u kurar; kendi sunucusunu durdurur ve değiştirdiği bağlantı/tip yapılandırmasını `finally` içinde geri yükler. QA route'u üretim kaynaklarında bulunmaz. Bu betik çalışırken aynı dosyalarda geliştirme veya derleme yapılmamalı.

## Yayına alma ve geri dönüş

17 Eylül 2026: Kullanıcının açık izniyle üç stok migrationı önce DEV projesine (`yxsegwkzyiscrxiwdeuf`), ardından production yayın talebiyle PROD projesine (`svxvloeosiksqfadgkvo`) uygulandı. Her iki hedefte yalnız beklenen üç migration doğrulandı; uygulama sonrası bekleyen migration kalmadı. [DEV kanıtı](dev-migrations.txt), [PROD kanıtı](prod-migrations.txt).

PROD öncesinde public şema, roller ve veri yedeği alındı; SHA-256 bütünlüğü doğrulandı (`/private/tmp/masabu-inventory-prod-backup-20260917`). Bu yedek Auth/Storage kapsamını içermez. Canlıda sekiz stok tablosu, anonim erişim reddi, yetkisiz aktör reddi ve sahip/paket kontrolleri veri yazmadan doğrulandı. Altı işletme kontrol edildi; üç yetkili stok snapshot'ı başarılıydı. Otomatik takip bütün işletmelerde kapalı; stok verisi eklenmedi. [Production veritabanı kontrolü](prod-db-verification.json).

Yayın adayı için `pnpm check:ci`, beş uygulamanın üretim derlemesi ve izole PostgreSQL stok runtime testleri geçti. Uygulama dağıtımı bu kaynak commit'inin `main` push'u ile mevcut Vercel entegrasyonundan yürür; deployment sonuçları yayın sonrası ayrıca doğrulanır.

Localhost:3000 üzerinde oturum açılmış işletmenin Stok ekranı kontrol edildi: boş stok başlangıcı, manuel stok kartı formu ve CSV yükleme/şablon penceresi açılıyor. Bu kontrol stok verisi yazmadı. [Tarayıcı sonucu](dev-browser-verification.json), [ekran](dev-stock-empty.png).

- Mevcut release sürecinde hedef proje ve migration geçmişini doğrula, yedek al, üç migrationı sırayla uygula. Sonra uygulamaları dağıt.
- Tüm işletmelerde otomatik takip varsayılan kapalıdır. Pilot işletme sahibi açılış sayımı ve reçete kontrolünden sonra açar.
- İzlenecek göstergeler: `inventory_items.quantity != SUM(inventory_movements.quantity)`, eksik eşlemeler/maliyetler, negatif stok, komut hata sayısı, transaction gecikmesi ve lock wait süresi.
- Defter/bakiye farkı veya tekrarlı tüketim sıfır olmalıdır. Pilot bu koşullar sağlanmadan genişletilmez.
- Sorunda yeni takibi `inventory_settings.enabled=false` ile durdur. Defteri silme veya ters migrationla yok etme. Tüketilmiş siparişlerin iptal uzlaştırmasını çalışan bırak; geçmiş hareketleri koruyan ileri düzeltme uygula.
- Şube/depo, lot/SKT, satın alma ve POS entegrasyonunu gerçek pilot gözlemlerinden sonra ayrıca kapsamlandır.
