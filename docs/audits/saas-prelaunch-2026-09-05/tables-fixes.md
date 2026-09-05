# Masalar audit düzeltmeleri — 5 Eylül 2026

Audit bulguları için kod ve migration hazırlandı. Yerel uygulama son production build ile 3005 portunda çalışıyor. Kullanıcının mevcut diğer değişiklikleri korundu.

| Bulgu | Uygulanan değişiklik | Doğrulama |
|---|---|---|
| T01 Tahsilat atomikliği | Kapatma reddedildiğinde ödeme yazımları PostgreSQL alt işlemiyle geri alınıyor; kapalı adisyona yazım engellendi; NULL giriş/yöntem reddediliyor. Server action’ın ayrı ödeme komutları kullanan fallback’i kaldırıldı. | Gerçek migration ve gerçek kapatma fonksiyonu izole PGlite PostgreSQL’de çalıştırıldı: unpaid, payment_pending, closed_normal, already_closed ve başka adisyonun siparişi senaryoları geçti. |
| T02 Hata sonrası kilitlenme | Beş tahsilat mutation’ı ortak try/catch/finally ve tek aktif işlem korumasından geçiyor. Belirsiz sonuçta güncel adisyon okunuyor, eski yöntem seçimleri temizleniyor, pencere kapatılabiliyor. Pay güncellemesi artık adisyonu yerel listeden erken kaldırmıyor. | Reddedilen Promise sonrası toparlanma ve çift aktivasyon davranış testleri geçti. |
| T03 Taşıma tekrar kimliği | Açık taşıma akışında aynı kaynak/adisyon/hedef/mod/ürün/adet niyeti aynı requestId’yi kullanıyor; başarılı sonuçta kimlikler temizleniyor. Aynı anda ikinci gönderim engellendi. | Commit sonrası yanıt kaybını taklit eden testte aynı operationId döndü, adet yalnız bir kez arttı. Gerçek bağlantı keserek transfer yapılmadı. |
| T04 Seçim kaybı | Seçim sıfırlama gerçek masa/adisyon değişimine ayrıldı. Arka plan yenilemesinde mevcut detay ve geçerli seçili siparişler korunuyor; kaldırılan siparişler seçimden çıkarılıyor. | Tarayıcıda 131 saniye boyunca UI işlemi yapılmadan seçim korundu. Runtime suite’e iki güvenlik yenilemesi boyunca seçim testi eklendi. |
| T05 Durum ve süre | Pano ve Masalar ortak attention-state kuralını kullanıyor; restoranın saat dilimine göre gün başlangıcı hesaplanıyor. Önceki günden açık/tahsil edildi filtreleri ve açıklamaları eklendi. Süre hem detayda hem tahsilatta gün/sa/dk gösteriliyor. | Durum, gün sınırı, filtre/sayım ve uzun süre testleri geçti; mobil masa adları ve durumlar gözlendi. |
| T06 Boş sonuç | Mobil boş kartta çalışan Filtreleri temizle; hiç masa yoksa mevcut masa ekleme formunu açan İlk masayı ekle eylemi. | Canlı arama → boş sonuç → tek eylemle iki masaya dönüş doğrulandı. Hiç masa olmayan fixture’da oluşturma yapılmadı. |
| T07 Erişilebilir gerekçe | Kalıcı FieldLabel/Input ilişkisi eklendi; anormal kapatma modunda normal tahsilat onayı gizlendi. | Erişilebilirlik ağacı alanı Kapatma gerekçesi olarak okuyor; boş gerekçede onay pasif. |
| T08 Salon planı toparlanması | İlk yükleme hatasında açık yeniden yükleme eylemi; başarılı okuma snapshot/revision ve hata durumunu birlikte yeniliyor. | TypeScript, lint, mevcut yerleşim/model testleri geçti; canlı ilk-istek hatası enjekte edilmedi. |
| T09 CI | Her PR için sır gerektirmeyen regression job; dahili PR’lar için mevcut linked DEV runtime job; fork/Dependabot PR’larına DEV sırları verilmez. PostgreSQL rollback testi PR işine eklendi. | Workflow kaynak değişikliği hazır. GitHub’da çalıştırılmadı; branch protection ayarı değiştirilmedi. |
| T10 Mobil okunurluk | Masa adı iki satır, sabit kısa masa kodu, QR indirme eylemi ayrı tam genişlik satırında. | Doğal mobil tarayıcıda ve son production build’de ekran görüntüleri alındı. |

QR Studio kontrolünde bulunan ek Base UI uyarısı da giderildi: bağlantı olarak render edilen Button’a nativeButton=false verildi. Yeniden yüklemede uyarı görülmedi.

**Doğrulama sonuçları**

- Dashboard: **870/870 test geçti**; bunun içinde Masalar **133/133**. Toplanarak ayrı test sayısı gibi sunulmamalı.
- Ortak uygulama katmanı: **261/261**; veritabanı paket testleri: **637/637**.
- Hedefli ESLint, dashboard ve DB TypeScript kontrolleri geçti.
- Son dashboard production build’i geçti; Masalar ve dashboard kritik rota bundle bütçeleri geçti.
- İzole PostgreSQL’de 5 kontrol geçti. Test altyapısı yalnız geçici /tmp kurulumunda; ürün bağımlılıklarına PGlite eklenmedi. CI’da sürümü 0.5.8’e sabitlendi.
- Ekran kanıtları kaydedildikten sonra yeniden açılıp incelendi. İlk etkileşim kanıtları dev build, `*-production.png` dosyaları son production build’den.

**Yayın için kalan adım**

[/Users/furkancengelm3/dev/gersonless/packages/db/supabase/migrations/20260905090000_tables_settlement_rollback.sql](/Users/furkancengelm3/dev/gersonless/packages/db/supabase/migrations/20260905090000_tables_settlement_rollback.sql) bağlı DEV/production veritabanına uygulanmadı. T01’in o ortamlarda etkinleşmesi için bu migration’ın olağan yayın sürecinde uygulanması gerekir. Ardından linked DEV finansal/runtime suite çalıştırılmalı. Bu turda gerçek tahsilat, transfer, QR yenileme veya ortak veritabanı değişikliği yapılmadı.

**Bilinçli sınırlar**

- Adisyon detayının 45 saniyelik güvenlik okumaları korundu. Özet alanları aynıyken ürün/sipariş durumu değişebileceği için yalnız özet eşitliğine bakarak okumaları kesmek doğru olmaz. Seçim kaybı ve yeniden yüklerken içeriğin kaldırılması giderildi; sorgu sayısında sayısal performans kazancı iddia edilmiyor.
- Taşıma requestId belleği açık diyalog akışı kapsamındadır; sayfa tamamen yenilendiğinde devam eden işlem için kalıcı bir istemci işlem günlüğü eklenmedi. Sonucu belirsiz işlemi kapatıp yeni akışa başlamadan önce güncel masa/geçmiş kontrol edilmelidir.
- Özel AccessibleDialog’ın Base UI’a toplu taşınması yapılmadı; doğrulanmış gerekçe alanı sorunu düzeltildi. Tam klavye/ekran okuyucu, %200 zoom ve 320/390/768/1440 görsel matrisi bu düzeltme turunda tamamlanmadı.
- Finansal testsiz canlı yayın yapılmış sayılmamalı: PGlite testi gerçek SQL’i sadeleştirilmiş izole şemada çalıştırır; bağlı ortamın RLS, trigger ve eşzamanlı sağlayıcı davranışları için mevcut linked DEV testleri ayrıca gereklidir.

**Kanıtlar**

- [Seçim önce](/Users/furkancengelm3/dev/gersonless/docs/audits/saas-prelaunch-2026-09-05/evidence/tables-fixes/selection-before.png), [131 saniye sonra](/Users/furkancengelm3/dev/gersonless/docs/audits/saas-prelaunch-2026-09-05/evidence/tables-fixes/selection-after-refresh.png), [zaman kaydı](/Users/furkancengelm3/dev/gersonless/docs/audits/saas-prelaunch-2026-09-05/evidence/tables-fixes/selection-timing.json)
- [Boş sonuç](/Users/furkancengelm3/dev/gersonless/docs/audits/saas-prelaunch-2026-09-05/evidence/tables-fixes/empty-filter.png), [gerekçe etiketi](/Users/furkancengelm3/dev/gersonless/docs/audits/saas-prelaunch-2026-09-05/evidence/tables-fixes/abnormal-reason.png)
- [Son Masalar](/Users/furkancengelm3/dev/gersonless/docs/audits/saas-prelaunch-2026-09-05/evidence/tables-fixes/tables-production.png), [son QR indirme](/Users/furkancengelm3/dev/gersonless/docs/audits/saas-prelaunch-2026-09-05/evidence/tables-fixes/qr-download-production.png)
- [Testler](/Users/furkancengelm3/dev/gersonless/docs/audits/saas-prelaunch-2026-09-05/evidence/tables-fixes/tests.log), [DB testleri](/Users/furkancengelm3/dev/gersonless/docs/audits/saas-prelaunch-2026-09-05/evidence/tables-fixes/db-tests.log), [SQL](/Users/furkancengelm3/dev/gersonless/docs/audits/saas-prelaunch-2026-09-05/evidence/tables-fixes/sql.log), [build](/Users/furkancengelm3/dev/gersonless/docs/audits/saas-prelaunch-2026-09-05/evidence/tables-fixes/build.log), [bundle](/Users/furkancengelm3/dev/gersonless/docs/audits/saas-prelaunch-2026-09-05/evidence/tables-fixes/bundle.log)
