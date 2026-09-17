# Masabu kayıt hunisi

## Ölçüm sözleşmesi

| Adım | GA4 koşulu | Anlamı |
| --- | --- | --- |
| 1. Site ziyareti | event_name = page_view AND page_location regex ^https://(www\.)?masabu\.co/ | İzinli pazarlama sitesi ziyareti |
| 2. Kayıt tıklaması | event_name = signup_click | Kayıt bağlantısına tıklama; hesap açıldığı anlamına gelmez |
| 3. Doğrulanmış kayıt | event_name = sign_up | Yeni hesabın doğrulama işlemi tamamlandı; method=email veya google |
| 4. Deneme başladı | event_name = trial_started | İlk işletme oluşturma işlemi başarıyla tamamlandı; tekrar oynatılmış işlem hariç |

## GA4 keşif ayarları

Ad: **Masabu — Ziyaret → Kayıt → Deneme**. Teknik: Huni keşfi. Kapalı huni; adımlar birbirini dolaylı izler (arada page_view/user_engagement olabilir). Tarih: son 28 gün; bugünkü test için bugünü de içeren aralık. Kırılım: cihaz kategorisi. Elapsed time gösterimi açık olabilir. Ham etkinlik adetlerini bölmek yerine hunideki kullanıcı ve adımlar arası tamamlama oranlarını okuyun.

Doğrudan kayıt sayfasına gelenleri ayrıca görmek için ikinci keşif: **Masabu — Kayıt sayfası → Deneme**. İlk adım page_view + page_location=https://app.masabu.co/auth/signup, ardından sign_up ve trial_started. Bu kullanıcılar kapalı pazarlama hunisinde görünmeyebilir.

sign_up ve trial_started mevcut önemli etkinliklerdir. signup_click ve page_view ana dönüşüm olarak işaretlenmez. Aynı isimleri türeten ek özel etkinlik oluşturulmaz. Bu aşamada varsayılan parasal değer atanmaz.

## Sınırlar ve kanıt

Ölçüm yalnızca analitik izni veren tarayıcılarda çalışır. Farklı cihazda e-posta doğrulaması yapıldığında ilk tarayıcıdaki kayıt işareti ve ziyaret zinciri taşınmaz; User-ID eklenmemiştir. İzin vermeyen ziyaretçilerin olayları sonradan izin verince tekrar gönderilmez. IP filtresi aktifse test trafiği rapordan çıkarılabilir. Gerçek zamanlı/DebugView görünürlüğü, keşif raporlarının anında işlenmiş olduğu anlamına gelmez.

Kullanıcı 11 Eylül'de gerçek altı haneli doğrulama ve trial_started teslimatını doğruladı. Kaynak incelemesi sign_up'ın başarılı doğrulama sonrasında tek kullanımlık sunucu imzalı işaret üzerinden üretildiğini gösteriyor. Canlı GA4 sign_up teslimatı ve keşfin kaydı ayrıca doğrulanacak.

Kaynaklar: [GA4 huni keşfi](https://support.google.com/analytics/answer/9327974?hl=en), [sign_up önerilen olayı](https://developers.google.com/analytics/devguides/collection/ga4/reference/events#sign_up).

## 11 Eylül doğrulama sonucu

- `search-and-consent.spec.ts` içindeki iki izin/alt alan testi geçti; signup_click tek gönderim, sign_up yenilemede tekrar etmeme ve reddedilen kaydı sonradan izinle tekrar göndermeme kontrolleri dahil.
- Sunucu imzalı kayıt işareti için iki test geçti: başka hesaba veya değiştirilmiş metoda ait işaret kabul edilmiyor.
- Test sırasında Google sınırı kesildi; test verileri üretim Analytics'e gönderilmedi. Uygulama kodunda değişiklik ve yeni dağıtım gerekmedi; regresyon testi genişletildi.
- GA4 keşfi henüz kaydedilmedi. Chrome genel erişilebilirlik okumasının diğer açık konuşmaları da kapsayabilmesi nedeniyle otomatik onay incelemesi UI işlemini engelledi. Kullanıcı Analytics'i ayrı pencerede açtıktan sonra yalnızca bu görev ekranında devam edilecek.

## GA4 kaydı tamamlandı

11 Eylül 2026: `Masabu — Ziyaret → Kayıt → Deneme` keşfi oluşturuldu ve Keşifler listesinde kayıtlı olduğu doğrulandı. Mülk: 553397523. Keşif: nQjz7b2jRB2sUC7Rvccl7Q.

Dört adım: page_view + page_location regex `^https://(www\.)?masabu\.co/.*`; signup_click; Etkinlik adı tam eşleşir sign_up; Etkinlik adı tam eşleşir trial_started. Kapalı huni, dolaylı takip, cihaz kategorisi kırılımı, geçen süre açık. Yeni türetilmiş etkinlik oluşturulmadı.

Tarih aralığı `Bu ay: 1 Eyl - 11 Eyl 2026` olarak uygulandı. O anda huni kullanıcı sayıları 11 → 3 → 0 → 0 idi. Kapalı huni koşullarındaki sıfırlar, tek başına bağımsız sign_up/trial_started teslimatının olmadığını kanıtlamaz; canlı sign_up teslimatı bu kontrolle doğrulanmadı.

Kitaplık'a rapor olarak kaydet diyaloğu aynı ad ve açıklamayla gönderildi. Kitaplık gezinmesi Görevler ekranına yönlendiği için kitaplık satırı ayrıca doğrulanamadı; Keşifler listesindeki kalıcı kayıt doğrulandı. Keşif paylaşılmadı.

[Keşfi aç](https://analytics.google.com/analytics/web/#/analysis/a407396147p553397523/edit/nQjz7b2jRB2sUC7Rvccl7Q)
