# Masalar — mobil panel düzeltmeleri

Tarih: 6 Eylül 2026. Kapsam: kullanıcının paylaştığı üç mobil ekran sorunu.

## Değişiklikler

1. **Diğer panelinde Profil satırının örtülmesi:** Masalar sayfasının mobil navigasyonu `z-index: 170`, ortak dialog ve sheet katmanı ise `50` kullanıyordu. Mobil navigasyon ve yükleme iskeleti `20` katmanına alındı. Panel açıkken navigasyon artık panelin altında kalıyor. Aynı mobil stil QR Studio tarafından da kullanılıyor.
2. **Yeni sipariş alt düğmelerinin görünmemesi:** Navigasyon katmanının düzeltilmesine ek olarak mobil sipariş penceresi ekranın başlangıcına sabitlendi. Başlık ve alt eylem alanının flex içinde küçülmesi engellendi; alt alana güvenli ekran boşluğu ve dar genişlikte satır kırılması eklendi.
3. **Masa detayının yeni siparişin üzerinde kalması:** Sipariş başlatılırken masa detayının seçimi temizleniyor. Hem navigasyondan hem detay panelinden sipariş başlatma aynı geçişi kullanıyor. Seçilen masa korunuyor; tek sipariş penceresi açılıyor.

## Doğrulama

- Dashboard production build, lint ve build içindeki tip kontrolü başarılı.
- Masalar, layout ve overlay testleri: **162 geçti, 0 başarısız**. Bu sayı mevcut kaynak sözleşmesi testlerini de içerir; tamamı davranış testi değildir.
- Değişen ürün ve test dosyalarında hedefli ESLint başarılı; `git diff --check` temiz.
- Yerel production sunucusunda, mevcut test restoranıyla gerçek tarayıcı kontrolü: **320×800 ve 390×844 CSS px**.
- Diğer → Profil satırı iki genişlikte de erişilebilir. Alt kenar hit testi başka bir katman tarafından örtülmediğini doğruladı.
- Boş masa → Sipariş başlat sonrasında masa detayı kaldırıldı, yalnızca bir dialog kaldı ve seçilen masa sipariş açıklamasında korundu.
- İptal/Geri/Devam alanı görünür. Geri → masa seçimi → etkin Devam geçişi çalıştı; 320 px genişlikte etkin Devam düğmesinin alt kenarı 788 px ve hit testi başarılıydı.
- İptal sonrasında boş masa durumu korundu. Gerçek sipariş gönderilmedi.
- İzole DEV Playwright akışına 320/390 px için Profil erişimi, footer hit testi, tek dialog ve Geri/Devam regresyon kontrolleri eklendi. Test keşfi başarılı; **veritabanında tahsilat/taşıma işlemleri de yapan tam runtime paketi bu çalışmada çalıştırılmadı**.

## Kanıtlar ve sınırlar

- [Diğer / 320 px](evidence/tables-mobile-fixes-2026-09-06/more-320.jpg)
- [Diğer / 390 px](evidence/tables-mobile-fixes-2026-09-06/more-390.jpg)
- [Sipariş / 320 px, etkin Devam](evidence/tables-mobile-fixes-2026-09-06/order-320.jpg)
- [Sipariş / 390 px](evidence/tables-mobile-fixes-2026-09-06/order-390.jpg)
- [Test çıktısı](evidence/tables-mobile-fixes-2026-09-06/tests.log)
- [Production build çıktısı](evidence/tables-mobile-fixes-2026-09-06/build.log)

Test restoranında yayınlanmış ürün bulunmadığı için ürün seçimi ve son sipariş gönderimi doğrulanmadı. Mobil kontroller masaüstü tarayıcısında viewport emülasyonuyla yapıldı; fiziksel Android/iOS ve açık sanal klavye senaryosu doğrulanmadı. Ekran yakalama aracının tam tuvali görüntülere dahil olduğundan uygulama görüntünün sol üstünde yer alır.

Değişiklikler yerel çalışma ağacında; bu düzeltmeler commit/push veya production deploy edilmedi. Önceki tema ve performans değişiklikleri korundu.
