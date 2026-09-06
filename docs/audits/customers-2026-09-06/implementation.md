# Müşteriler düzeltmeleri · 6 Eylül 2026

Auditin C01–C11 bulguları uygulandı. C12'nin bileşen ayırma ve SSR kısmı uygulandı; SQL toplama optimizasyonu ile önce/sonra performans ölçümü ayrı değerlendirme olarak kaldı. Tasarım, animasyonlar, framework ve veri tabanı şeması değiştirilmedi. Bu çalışma commit/push/deploy içermez.

## Uygulanan değişiklikler

| Bulgu | Son davranış | Doğrulama |
|---|---|---|
| C01 | Kampanya penceresinde sınırlandırılmış kaydırma; mobil form ve önizleme birbirini örtmüyor, alt düğmelere ulaşılabiliyor. | Production build ile 320/390/768/1440 CSS px; DOM ölçümü, klavye ve ekran görüntüleri. |
| C02 | Segment ve kampanya taslakları ortak dashboard korumasına kayıtlı. Escape/X/Kapat/İptal aynı çıkış kontrolünden geçiyor; bölüm/işletme navigasyonu ve beforeunload mevcut korumayı kullanıyor. | İki modalda Escape → Düzenlemeye dön sonrası değerler korundu. Ortak taslak kayıt defteri davranış testleri geçti. |
| C03 | Segment oluşturma/güncelleme/silmede tek istek kilidi, catch/finally ve taslağı koruyan hata. Silme penceresi yalnız başarıda kapanıyor. Kayıt sırasında kontroller kilitli. | Yerel sunucu durdurularak kayıt isteği reddedildi; taslak ve kullanılabilir düğmeler korundu. Sunucu açıldıktan sonra aynı taslak kaydedildi. Oluşturma, güncelleme ve silme DEV UI üzerinden tamamlandı. |
| C04 | Alıcı önizlemesi hedef kimliğiyle eşleşmeden gönderim/onay açılamıyor. Hedef değişiminde önceki sayılar temizleniyor; geç gelen alıcı/günlük sonuçları ayıklanıyor. Gönderim ve şablon yazımı sırasında düzenleme kilitli. | Hedef A/B, bekleyen/boş önizleme için davranış testleri; gerçek kampanya gönderilmedi. |
| C05 | Detay SSR okumasından önce listeyle aynı customer_accounts plan kontrolü var. | Geçici Pro işletmede detay açıldı; yalnız fixture Starter'a alınınca aynı doğrudan URL Pro kilidi gösterdi. |
| C06 | Liste kimlik, detay müşteri/özet ve tenant aktivite sorgu hataları açık hata oluyor; yanlış sıfır veya 404'e dönüşmüyor. | Ağ katmanı sahteleriyle identity, summary, customer ve activity hata enjeksiyonu. |
| C07 | İzin, kural karşılaştırması ve sayısal alanların isimleri var; Fark etmez ve Ömür boyu puan etiketleri kullanılıyor. Geçersiz sayılar kaydı engelliyor ve hata alanla bağlantılı. | 320 px erişilebilirlik ağacı; negatif değer → aria-invalid, Kaydet disabled; taslak değeri korundu. |
| C08 | Global müşteri toplamı destek özetinden geliyor. Arama sonucunun sayısı KPI/toplam/yüzde paydasını değiştirmiyor. | Global/segment toplamları ayrı test edildi; 6 kayıtlı UI'da filtre değişiminde üst toplam 6 kaldı. |
| C09 | Sınır dışı sayfa ilk sayfaya döndürülüyor; gerçek toplam ve filtre korunuyor. UI dönen sayfayla URL'yi eşliyor. | Birim testte 6 kayıt, page=2 → page=1,total=6; DEV ve tarayıcıda geçerli sayfaya dönüş. |
| C10 | Arama metni veya Yeni müşteriler filtresi açıkken yanlış kapsamla segment kaydı engelleniyor, nedeni ekranda açıklanıyor. | Saf kural testleri ve Yeni müşteriler → Filtreyi kaydet disabled tarayıcı kontrolü. |
| C11 | expectedUpdatedAt, tenant ve segment kimliği aynı atomik güncellemede karşılaştırılıyor. Eski sürüm conflict oluyor; taslak korunuyor. | Gerçek DEV veritabanında aynı başlangıç sürümünden iki yazma: ilki başarılı, ikincisi reddedildi. UI güncellemesi de başarılı. |
| C12 | Kampanya modülü ayrı ve isteğe bağlı yükleniyor; yüklenirken yerel dialog durumu var. İlk müşteri listesinde ssr:false kaldırıldı. | Production build ve dolu liste/kampanya işlev kontrolleri. LCP kazancı iddia edilmiyor. |

Boş listenin ilk müşteri edinme açıklaması da düzeltildi. Liste istekleri debounce beklerken eski yanıtların yerleşmesi cleanup sırasında engelleniyor. Menü taslak koruması ortak sağlayıcıya taşındı; mevcut menü API'si ve davranış testleri korundu.

## Test sonuçları

- İlgili müşteri/kampanya, domain/application, DB ve taslak testleri: **87 geçti, 0 başarısız** (`implementation-tests.txt`). Kaynak metni eşleyen testler davranış kanıtı sayılmadı.
- `pnpm check:ci`: başarılı; dead-code, lint, tüm workspace typecheck, mimari/domain/DB, yayın hazırlığı ve bundle sözleşmesi kontrollerini kapsıyor (`implementation-check-ci.txt`). Son küçük UI değişikliklerinden sonra ilgili testler/lint ve tüm workspace typecheck tekrar çalıştırıldı.
- Dashboard production build: başarılı; Next.js **15.5.25**. Son build çıktısı `implementation-build.txt`.
- DEV runtime: segment oluştur/güncelle/sil, eski sürüm reddi, sınır dışı sayfa, bağımsız toplam, maskeli müşteri detayı, yalnız geçici müşteriye 25 test puanı ve tenant dışı erişim reddi geçti (`implementation-runtime.txt`).
- Eski runtime betiği ilk denemede taşınmış service-client importu, ardından güncel abonelik gerektirmeyen eski fixture nedeniyle başarısızdı. Import ve geçici deneme aboneliği fixture'ı güncellendi; son tam çalışma başarılıdır.
- Runtime fixture ve görsel test fixture'ı temizlendi; restoran/müşteri/segment/abonelik kalan kayıt sayısı 0 (`implementation-cleanup.json`). Gerçek müşteri verileri ve mevcut işletme planları değiştirilmedi. E-posta gönderilmedi.

## Kanıtlar ve sınırlar

Ekranlar `after/` altında. Screenshot API clip alanı sağlayıcının boş tuvalini dışarıda bırakır; ekran içeriği değiştirilmedi. CSS viewport boyutları DOM'dan ölçüldü.

- [320 px kampanya alt işlemleri](after/campaign-footer-320.png)
- [390 px kampanya alt işlemleri](after/campaign-footer-390.png)
- [768 px kampanya](after/campaign-768.png)
- [1440 px kampanya](after/campaign-1440.png)
- [Kampanya taslağını koruma](after/campaign-draft-390.png)
- [Segment değer doğrulaması](after/segment-validation-320.png)
- [Bağlantı hatasında segment taslağı](after/segment-network-recovery.png)
- [Doğrudan detay bağlantısında plan kapısı](after/direct-detail-plan-gate-390.png)

Tam ekran okuyucu taraması, gerçek %200 tarayıcı yakınlaştırması, azaltılmış hareketin cihaz karşılaştırması, silme isteğinde ayrı ağ kesintisi ve gerçek e-posta sağlayıcı teslimatı bu uygulamada çalıştırılmadı. Gönderim testleri bilerek gerçek alıcıya mesaj göndermeden yapıldı. İki yazarlı çakışma testi gerçek veritabanında aynı eski sürümle ardışık komutlarla yapıldı; iki ayrı tarayıcı oturumu kullanılmadı.

C12 için SQL EXPLAIN, production cold/warm Lighthouse ve gerçek kullanıcı performansı ölçülmedi. Global toplamın doğruluğu için mevcut özet okumasına bir global sayım eklendi; toplam ve dört segment hâlâ beş bağımsız RPC çağrısıdır. Bunları tek SQL özetine taşıma kararı sorgu planı ve üretim yükü ölçümleriyle alınmalı. Bileşen ayrımı ve SSR düzenlemesi ölçülmüş bir LCP iyileşmesi olarak sunulmuyor.
