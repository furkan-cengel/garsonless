# GA4 ayrıntılı kontrol ve açılış sırası

Kontrol tarihi: 10 Eylül 2026. Kullanıcı Meta yerine Analytics incelemesine öncelik verdi. Hesap ekranlarını kullanıcı yönetir; kod ve teknik kontroller asistan tarafından yapılır.

## Mevcut durum

- Çerez arayüzü ve GA4 entegrasyon kodu mevcut. Son başarılı üretim testinde ölçüm kapalıydı; ilk ziyaret, kabul, ret ve tercih geri açma çalışıyordu.
- Ölçüm kapalıyken kabul `essential` olarak saklanır. Bu seçim ileride GA4 açılması için izin sayılmaz; etkinleştirme sonrasında yeni izin gerekir. Ret korunur.
- 10 Eylül yeni değerlendirme sorusuna kullanıcı “Bilmiyorum ki” yanıtını verdi. Sağlayıcı/veri aktarımı değerlendirmesi tamamlandı sayılmadı. Bu Google hesabındaki bir aç/kapat seçeneği değildir. Google veri işleme şartlarının kabulü ayrı adımdır. Teknik bayrak değerlendirme yerine geçmez.
- Hesap ekranı ve gerçek DebugView kontrolü henüz yeniden yapılmadı. Eski rapor verisi tek başına şu an siteden veri aktığını göstermez.

## Hesap kontrolü (ölçüm kapalıyken yapılabilir)

**Son teyitler — 10 Eylül:** Kullanıcı etkinlik değiştirme listesinin de boş olduğunu bildirdi. Internal Traffic filtresi ekranında Dahili Trafik / Hariç tut / Test görüldü; başlangıçta IP kuralı yoktu. Kullanıcı tek IPv4 eşitlik kuralını oluşturduğunu teyit etti; filtre Test durumunda bırakıldı, gerçek eşleşme bekliyor. Saat dilimi Türkiye ve para birimi TRY kullanıcı tarafından doğrulandı. Genel “tamam yapalım” talebi üzerine [sağlayıcı/aktarım inceleme dosyası](ga4-provider-transfer-review.md) hazırlandı; bu talep eksik sözleşmelerin tamamlandığına ilişkin beyan sayılmadı. Gizlilik politikasında kalan iki ay ifadesi de yerelde 14 ay ve sıfırlama kapalı olacak şekilde düzeltildi. Politika değişiklikleri ve GA etkinleştirme yayımlanmadı.

**Parasal değer ve özel etkinlik kuralları — 10 Eylül:** Kullanıcı üç hedef önemli etkinliğin hiçbirinde parasal değer bulunmadığını bildirdi; varsayılan değer eklenmedi. Masabu Web özel etkinlikler ekranında “Henüz özel etkinlik oluşturulmadı” görülüyor; bu listede türetilmiş olay kuralı yok. Bu bulgu koddan çift gönderim veya ayrı etkinlik değiştirme kurallarını dışlamaz. Sonraki kontrol web akışındaki **Etkinlikleri düzenleyin** listesi; yeni kural oluşturulmayacak. Gerçek olay tekilliği DebugView testi hâlâ bekliyor.

**Sayma yöntemi tamamlandı — 10 Eylül:** trial_started için kullanıcı ekranında “Etkinlik başına bir defa” seçili görüldü. sign_up ve generate_lead için aynı kontrol istendikten sonra kullanıcı “etkinlik başına seçili hepsinde” dedi. Üç hedefin sayma yöntemi ekran/kullanıcı teyidiyle doğrulandı; değişiklik gerekmedi. Bu ayar yinelenen olay gönderimlerini tekilleştirmez; gerçek DebugView testinde olay tekilliği hâlâ doğrulanacak. Sonraki kontrol trial_started varsayılan önemli etkinlik değeri; herhangi bir parasal değer henüz doğrulanmadı veya önerilmedi.

**Önemli etkinlikler ekranı doğrulandı — 10 Eylül:** Kullanıcının Önemli etkinlikler sekmesinde generate_lead, sign_up ve trial_started yıldızlı olarak görünüyor; üç hedef olayın önemli etkinlik kaydı tamamlandı. Aynı listede close_convert_lead, qualify_lead ve purchase da var; kökenleri bu ekranla belirlenmedi, silinmedi. Tüm satırlarda “Akış verisi algılanmadı” yazıyor (son 28 günde etkin akışlar sütunu); etkinliklerin kayıtlı olması gerçek teslimat kanıtı değil. Sonraki adım trial_started satırındaki menüden sayma yöntemi ve varsa değer ayarını kontrol etmek; ayarlar henüz görülmedi veya değiştirilmedi. Olay üretme/değiştirme kuralları için çift sayım kontrolü ayrıca bekliyor.

**Saklama ayarı tamamlandı — 10 Eylül:** Olay ve kullanıcı sürelerinin 14 ay yapılması, yeni etkinlikte sıfırlamanın kapalı tutulması yönergesinden sonra kullanıcı “Tamam hallettim” dedi. Kanıt kullanıcı beyanı; yeni ekran paylaşılmadı. Çerez politikası kaynak metni 14 ay ve sıfırlama kapalı bilgisiyle güncellendi; değişiklik yereldedir, henüz yayımlanmadı. GA4 kapalı kalıyor. Sonraki adım önemli etkinliklerin kontrolü.

Güncel karar ve kanıt — 10 Eylül: Kullanıcının iş geliştirme için şehir/cihaz analizini koruma isteği üzerine önceki ayrıntılı konum/cihaz verisini kapatma önerisi geri alındı; açık tutulacak (son anahtar durumu yeniden görülmedi). Kullanıcı reklam kişiselleştirmesinde ülkeleri daha önce kaldırdığını bildirdi; güncel bölge listesi ekranı paylaşılmadı.

Veri saklama ekranı olay verileri **2 ay**, kullanıcı verileri **2 ay**, yeni kullanıcı etkinliğinde sıfırlama **kapalı** gösteriyor. Daha uzun dönem kampanya/funnel incelemesi için olay ve kullanıcı verilerinin **14 ay**, sıfırlamanın **kapalı** tutulması önerildi; değişiklik henüz kullanıcı tarafından teyit edilmedi. [Google açıklaması](https://support.google.com/analytics/answer/7667196?hl=en_EN): saklama ayarları standart toplulaştırılmış raporları etkilemez; keşif ve dönüşüm hunisi raporlarını etkiler. Uzun süre ayrıntılı verinin daha uzun tutulması demektir; temel veri toplamayı açmaz. **Açılış öncesi tutarlılık işi:** 14 ay seçilirse apps/marketing/app/yasal/cerez-politikasi/page.tsx içindeki iki ay ifadesi ve ilgili açılış kayıtları yeni kararla uyumlandırılmalı. Politika bu kontrolde değiştirilmedi; GA4 kapalı kalıyor. Aşağıdaki eski iki ay maddesi önceki başlangıç planıdır.

10 Eylül Veri toplama ekranları: Google sinyalleri ve kullanıcı tarafından sağlanan veri toplama “Aç” düğmeleriyle kapalı olarak doğrulandı. User-ID alanı bilgilendirme metnidir; mevcut olay kodunda user_id gönderilmiyor. **Ayrıntılı konum ve cihaz verilerinin toplanması açık** (mavi anahtar). İlk kampanyanın kayıt/deneme ölçümü kapsamı için kapatılması önerildi; bu bir hukuki zorunluluk iddiası değildir. Kapatılması şehir, cihaz marka/modeli, ekran çözünürlüğü gibi ayrıntıları kaldırır ([Google rehberi](https://support.google.com/analytics/answer/12002752?hl=en)); kullanıcı değişikliği henüz teyit etmedi. Reklam kişiselleştirme gelişmiş ayarları ve Kullanıcı Verilerini Toplama Onayı satırları kapalı panel halinde, içerikleri görülmedi; onaylandıkları veya kapalı oldukları varsayılmadı. Sonraki adım reklam kişiselleştirme panelini açıp mevcut durumu görmek. Site GA ölçümü kapalı kalıyor.

10 Eylül kullanıcı ekranıyla doğrulananlar: Masabu Web, https://masabu.co, akış kimliği 15746955685, ölçüm kimliği G-VZ36SR80SB. Üst uyarı “Web sitenizde veri toplama etkin değil”; canlı tarayıcı kontrolündeki GA kapalı durumuyla tutarlı. Geliştirilmiş ölçüm anahtarı kapalı görünüyor; Sayfa görüntülemeleri etiketi tek başına veri geldiğinin kanıtı değildir. Veri çıkarma satırında e-posta etkin, URL sorgu parametresi anahtarları etkin değil. Bu ekran Google Signals veya veri saklama süresini göstermiyor. Sonraki adım Veri toplama ekranı; üretim ayarı değiştirilmedi.

1. Masabu mülkü → Yönetici → Veri akışları → Masabu Web. Önceki kayıt: https://masabu.co ve G-VZ36SR80SB. Güncel ekranla karşılaştır; başka mülk/ikinci akış oluşturma.
2. Mülk saat dilimi Europe/Istanbul, para birimi TRY. Veri toplama uyarısı ve son veri zamanı ekran kanıtıyla kaydedilir.
3. Gelişmiş ölçüm tamamen kapalı, Google Signals kapalı, kullanıcı tarafından sağlanan veriler ve reklam kişiselleştirmesi kapalı. Otomatik form/sayfa ölçümü manuel olaylarla çakışmayacak.
4. Kullanıcı/olay verileri saklama **14 ay**, yeni etkinlikte süre sıfırlama **kapalı**: 10 Eylül kullanıcı teyidiyle tamamlandı. İsteğe bağlı hesap veri paylaşımı ayrıca kontrol edilecek. Önceki iki ay planı güncellendi.
5. `generate_lead`, `sign_up`, `trial_started` önemli etkinlik olarak kontrol edilir. Aynı adlı olayları ayrıca türeten kurallar varsa çift sayım açısından incelenir. `page_view` ve `signup_click` ana dönüşüm yapılmaz.
6. Search Console bağlantısı mevcut mülk/akışla eşleşir. Yeni Ads, Pixel, BigQuery veya GTM eklenmez.

## Hazır olaylar ve anlamları

| Olay | Kaynaktaki tetikleyici | Kabul testi |
| --- | --- | --- |
| page_view | İzinli, kapsam içi sayfa | İlk görünüm ve gerçek gezinmede birer olay; otomatik ölçümle çiftlenmemeli |
| signup_click | Marketing kayıt bağlantısı | header/footer/content konumu doğru |
| generate_lead | Sunucu kabulü; general/sales iletişim talebi | Hata/destek formu hariç, başarılı talepte bir olay |
| sign_up | Yeni kaydın doğrulanması ve tek kullanımlık kayıt işareti | Tekrar giriş/kaydı yenileme yeni kayıt sayılmaz |
| trial_started | İlk başarılı onboarding; replay hariç | Pro deneme başlangıcı bir olay |

Kaynaklar: packages/ui/src/ConsentAnalytics.tsx, packages/ui/src/analytics-client.ts, packages/domain/src/marketing-analytics.ts, apps/marketing/components/BusinessContactForm.tsx, apps/dashboard/lib/auth/signup-analytics.ts, apps/dashboard/components/onboarding/OnboardingFlow.tsx. Bu tablo kod incelemesidir; gerçek GA olay teslimatı kanıtı değildir.

## Etkinleştirme ve gerçek test (değerlendirme sonucu sonrasında)

1. Değerlendiren kişi, tarih, karar/koşullar ve belge referansı işletme tarafından netleştirilir. Koşullar gerektiriyorsa politika/arayüz kapsamı güncellenir.
2. Aynı doğrulanmış NEXT_PUBLIC_GA4_MEASUREMENT_ID marketing ve dashboard üretiminde kullanılır. ANALYTICS_DATA_TRANSFER_APPROVED yalnız olumlu değerlendirme kaydıyla açılır. İki uygulama derlenip yayınlanır; bu incelemede değerler değiştirilmedi.
3. Temiz tarayıcıda izin öncesi ve ret sonrasında GA ağı/çerezi sıfır; kabulde etiket yüklenir. Footer üzerinden geri çekmede veri akışı durur ve GA çerezleri temizlenir. Eski essential kaydı yeni analitik izni istemeli.
4. Yalnız test cihazında debug etkinleştirilir. Gerçek DebugView ve Realtime ile yukarıdaki olayların adı, parametreleri ve tekilliği kullanıcı ekranında doğrulanır. Mock testler bunun yerine geçmez.
5. Kayıt → kullanıcı tarafından e-posta doğrulama → deneme başlangıcı kontrollü test hesabıyla denenir. Gerçek müşteri verisi kullanılmaz. Test işletmesi raporlardan ayrılır; test iletişim talebi ayrıca tanımlanır.
6. masabu.co → app.masabu.co oturum ve kanal devamlılığı, UTM source/medium/campaign değerleri kontrol edilir. Sorgu/fragment, e-posta, telefon ve form içeriği GA yükünde bulunmamalı. Kapsam dışındaki işletme operasyon sayfaları ölçülmemeli.
7. Başlangıç verileri ve test istisnaları kaydedilir. Ana sonuç trial_started; kayıt ve nitelikli talep yardımcı sonuçlardır. İzin vermeyen kullanıcıların geçmiş davranışları geriye dönük gönderilmez; bilinmeyen kanal katkısı tahmin edilmez.

Resmî teknik kaynaklar: [Consent mode](https://developers.google.com/tag-platform/security/concepts/consent-mode?hl=en), [DebugView](https://support.google.com/analytics/answer/7201382?hl=en), [Veri toplamayı doğrulama](https://support.google.com/analytics/answer/9333790).
