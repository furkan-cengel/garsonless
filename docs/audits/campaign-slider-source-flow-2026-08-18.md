# Campaign Slider kaynak akışı audit'i

Tarih: 2026-08-18

## Sonuç

Kaynak modu seçimi kaldırıldı. Slider artık iki bağımsız kaynağı tek ve öngörülebilir bir sırada birleştirir:

1. Süresi ve fiyat kuralı geçerli aktif kampanyalar otomatik eklenir.
2. Kupon, flash teklif, bedava ürün ve sadakat kartı yalnızca kendi `Aktif` anahtarı açıksa eklenir.

Eski `active`, `mixed` ve `manual` değerleri okunmaya devam eder; ancak artık aktif kampanyaları veya açık özel kartları gizlemez.

## Audit

1. **Kampanya kaynağı seçimi — Sorunlu**
   - `Aktif kampanyalar`, `Karma` ve `Manuel kartlar` seçenekleri içerik üretme biçimini kullanıcıya yüklüyordu.
   - Aynı kartların görünürlüğü hem kaynak modu hem de kartın `Aktif` anahtarı tarafından kontrol edildiği için iki ayrı doğruluk kaynağı oluşuyordu.

2. **Aktif kampanyaların görünürlüğü — Sorunlu**
   - Eski `manual` değeri geçerli bir aktif kampanyayı sliderdan tamamen çıkarabiliyordu.
   - Kullanıcının “yayındaki kampanya sliderda görünür” beklentisiyle çelişiyordu.

3. **Özel kartların yönetimi — İyileştirildi**
   - “Manuel kart” terminolojisi kaldırıldı; kupon, flash teklif, bedava ürün ve sadakat kartı bağımsız özel kartlar olarak ele alındı.
   - Yeni bölümlerde özel kartlar kapalı başlar. Eski manuel/karma kayıtların açık varsayılanları geriye dönük olarak korunur.

4. **Ayar paneli açıklaması — İyileştirildi**
   - Panelin başına “Kampanya akışı” açıklaması eklendi.
   - Aktif kampanyaların otomatik, özel kartların ise kendi anahtarlarıyla yönetildiği açıkça anlatıldı.

5. **Doğrulama ve hata modeli — Sağlıklı**
   - Eski `active` değerine sahip bir kayıtta sonradan açılan özel kartlar artık doğrulamayı atlamaz.
   - Aktif kampanya seçimi, özel kart zamanlaması ve ürün kuralları mevcut veri modeliyle çalışmaya devam eder.

## Kabul kanıtı

- UI Promo Slider hedefli testleri: 12/12 geçti.
- Dashboard model, registry ve doğrulama testleri: 48/48 geçti.
- UI ve Dashboard typecheck geçti.
- Hedefli ESLint geçti.
- Yerel menü doğrulamasında bir aktif kampanya ile üç açık özel kart aynı sliderda toplam dört slayt olarak projekte edildi.
