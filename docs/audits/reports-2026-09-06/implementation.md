# Raporlar — uygulama ve doğrulama

Tarih: 6 Eylül 2026. Mevcut tasarım, grafik kütüphanesi ve animasyonlar korunmuştur. Framework veya servis değişikliği yapılmamıştır.

## Uygulanan düzeltmeler

| Öncelik | Bulgu | Sonuç ve kod |
|---|---|---|
| P1 | Sekmeler arasında veri ve güncelleme zamanı karışması | `analytics-report-controller.ts`: işletme/sorgu/rapor anahtarlı en fazla 18 kayıt; bağımsız veri, dönem, hata ve güncelleme zamanı. AbortController ve istek sıra numarası eski yanıtları geçersiz kılar. Realtime bütün ilgili kayıtları eski işaretler; sekmeye dönüş ve görünür sayfada zaman aşımı yeniden yükler. |
| P1 | Satış verisine kısmi ödeme güncellemesi | Satış özeti ile ödeme dağılımı aynı yanıtla saklanır. Ödeme yenilemesi satış kaydını değiştirmez. Canlı açık sipariş sayısı satış yanıtındadır. |
| P1 | Satışı duran ürünlerin kaybolması | `analytics-product-projection.ts`: önceki ve mevcut dönem birleşimi; sıfıra düşüş −%100, mevcut ürün çeşidi sayısından hariç. |
| P1 | ABC yuvarlama hatası | Kümülatif hesap tam kuruşla yapılır; yalnız gösterim yuvarlanır. Eşit tutarlar isimle kararlı sıralanır. 1.500 eşit üründe A/B/C = 1.200/225/75. |
| P1 | Gece saatlerinin dışlanması | Yeni `20260906130000_analytics_full_day_heatmap.sql`; 00–23 saatleri, 168 hücre. SQL, grafik, klavye ve alternatif tablo aynı aralıktadır. Boş haritada sahte yoğun saat yoktur. |
| P1 — uygulamada ek bulundu | Günlük trendin saatlik satırları ezmesi | DEV'de KPI ₺1.200, trend ₺300 idi. `analytics-sales-buckets.ts` aynı günün saatlik satırlarını toplar; son build'de ikisi de ₺1.200. Parasal SQL kuralları değişmedi. |
| P2 | URL ve sayfalama tutarsızlığı | `analytics-report-navigation.ts`: yenilemede sıralama/sayfa/detay korunur; filtre değişiminde sayfa ve detay temizlenir; küçülen veri için sayfa sınırlandırılır. Geçersiz rapor isimleri satışa döner. |
| P2 | Yanıltıcı etiketler | “Tahsilat yapılan masa”, “Şu an aktif sipariş”; açıklama rozetleri nötr. Tahsil eden kimliği olmayan kayıt artık otomatik olarak İyzico diye adlandırılmaz; “Tahsil eden kaydı yok” gösterilir. |
| P2 | Tarih doğrulama farkı | Restoran saat dilimi istemciye iletilir; varsayılan özel tarih ve gelecek tarih doğrulaması bu güne göre yapılır. API gelecek tarihi `INVALID_REQUEST` ile reddeder. |
| P2 | CSV bağlamı/işlem güvenliği | Başarılı rapordan dışa aktarım; işletme adı/kimliği, kesin dönem sınırları, saat dilimi, verinin oluşturulma zamanı, filtreler ve güncellik. İşlem kilidi, görünür hata ve finally temizliği. Formül koruması korunur. |
| P2 | Mobil filtre yüksekliği | 600 px ve altında kapalı “Filtreler (n)” alanı. Dönem ve yenileme görünür. Operasyon alt raporlarının filtre kapsamları ekran ve CSV'de belirtilir. |

## Doğrulama

- **87 ilgili test geçti.** Testler içinde gerçek controller/projeksiyon/CSV davranış testleri ve mevcut kaynak sözleşmesi testleri vardır; 87 testin tamamı tarayıcı etkileşim testi değildir.
- Gecikmiş yanıt, önbellekteki sekmeye dönüş, filtre hatası ve tekrar deneme, işletme/geçmiş izolasyonu, istek sırasında invalidation, çevrimdışı toparlanma, eksik yanıt ve geçersiz rapor adı senaryoları controller testleriyle geçti.
- 1.500 eşit ürün, ABC eşikleri, önceki dönemden sıfıra düşüş, günlük saat toplama, URL korunması/sayfa sınırlandırma ve restoran/tarayıcı gün farkı regresyonları geçti. Mevcut ters aralık/366 gün testleri de geçti.
- Tam **`pnpm check:ci` geçti**. Son ek günlük trend/etiket düzeltmelerinden sonra ilgili 87 test, hedefli lint, dashboard typecheck ve dashboard production build tekrar geçti.
- 10 dashboard rota bütçesinin tamamı geçti. Analytics ilk yük: **129,2 / 143,0 kB gzip**, hazır ekran: **416,3 / 427,2 kB gzip**. Bütçeler yükseltilmedi. Ayrıntı: [bundle-budget.json](bundle-budget.json). Bunlar bundle ölçümüdür; yeni Lighthouse veya gerçek kullanıcı performans ölçümü değildir.
- Mevcut 1.500.000 byte HTTP payload sınırı ve testleri korunmuştur. Dolu DEV akışları sınırı aşmadı; üretim büyüklüğünde yeni bir yük testi yapılmadı.
- Gerçek SQL fonksiyonu PGlite üzerinde 00:00, 07:59, 22:59, 23:59 siparişlerini saydı: **168 hücre, 4 sipariş, ₺400**. [Çalıştırılabilir senaryo](heatmap-sql-reproduction.md), [sonuç](heatmap-result.json). Senaryo mevcut harici PGlite kurulumu ile çalıştırıldı; uygulamaya bağımlılık eklenmedi.

## Tarayıcı kanıtları

Yerel **production build**, ayrı geçici DEV işletmesi ve sentetik veriler kullanıldı: mevcut dönemde 12 ürün/12 sipariş/₺1.200, önceki dönemde tek ürün/₺1.000, bir ₺20 kısmi iade. Gerçek ödeme sağlayıcısına tahsilat veya iade isteği gönderilmedi.

- 1440 px: satış KPI ve trend ₺1.200; 168 hücre toplam 12 sipariş. Klavyede End ile 00:00 → 23:00 odağı doğrulandı.
- Ürünler: “Satışı Duran Latte” −%100 ile listelendi; mevcut ürün çeşidi 12 kaldı. Üç sayfalı tabloda yenileme sayfa 2'yi korudu. POS filtresinde veri tek ürüne küçülünce URL'deki sayfa temizlendi ve 1/1 gösterildi.
- 768 px: ödeme ekranında ₺1.200 tahsilat, ₺20 iade ve ₺1.180 net; açıklamalarda yön oku yok.
- 320 px: filtreler başlangıçta kapalı; Enter ile açıldı, kapsam açıklamaları erişilebilir. 390 ve 1440 px DOM ölçümlerinde sayfa yatay taşması yok. 768 px ekran görsel olarak kontrol edildi.
- UI'den indirilen gerçek [CSV örneği](export-pos-products.csv): POS filtresi, tek ürün ve ₺100 tutar ekranla eşleşti; işletme, kesin dönem ve güncelleme zamanı dosyada doğrulandı.
- Build değiştirilirken sunucu bilerek durdurulduğu anda tek `Failed to fetch` konsol kaydı görüldü. Bu kesinti kontrollü ağ hata testi olarak sayılmadı.

| Önce | Sonra |
|---|---|
| [320 px operasyon](before/04-operations-mobile320.png) | [320 px kapalı filtre](after/operations-mobile320.png) |
| [Ödeme açıklama rozetleri](before/07-payments-tablet.png) | [768 px ödeme](after/payments-tablet.png) |
| — | [390 px açık filtre](after/filters-open-mobile390.png) |
| — | [Dolu ürün raporu](after/products-desktop.png) |
| — | [Satış/ısı haritası](after/sales-desktop.png) |

## Doğrulama sınırları

**Aşağıdakiler tamamlanmış kabul edilmemelidir:** gerçek %200 tarayıcı yakınlaştırması ve işletim sistemi azaltılmış hareket ayarıyla görsel tekrar; kontrollü tarayıcı ağ kesintisi/geciktirme; gerçek ödeme sağlayıcısı iade akışı; tarayıcılar arasında farklı saat dilimiyle etkileşim testi. Mevcut bilgisayar aracı Codex uygulamasını kontrol etmeyi reddetti; viewport küçültmesi gerçek yakınlaştırma testi sayılmadı. Hareket tercihine saygılı sekme kaydırma kodu eklendi, mevcut animasyonlar kaldırılmadı. Tarih ve gecikmiş yanıt sınırları bu tur deterministik testlerle doğrulandı; UI ile tüm hata varyasyonlarının doğrulandığı iddia edilmiyor.

## Yayın durumu

Yeni migration yalnız **DEV** ortamına uygulandı. Production migration, commit, push veya deploy bu tur yapılmadı. Yayında migration ile uygulama birlikte ele alınmalı; eski migration değiştirilmedi ve RPC imzası/yetkileri korundu. Önceki bölümlerdeki değişikliklere ve mevcut `docs/designs/` dosyalarına dokunulmadı.

Geçici DEV işletmesi, sentetik siparişler, iade, deneme aboneliği ve masa temizlendi; SQL kontrolünde kalan test işletmesi **0**. Tarayıcı kullanıcının önceki test işletmesine döndürüldü.
