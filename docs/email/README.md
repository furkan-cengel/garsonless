# masabu e-posta kimliği

Projede gönderim yapan **8 teknik kanal** ve bunların hesap, ekip, işletme, abonelik, fatura, operasyon ve kampanya içerikleri incelendi. `pnpm email:preview` komutu aynı üretim renderer’larıyla **46 örneklik yerel katalog** oluşturur: `test-results/email-brand/index.html`. Tarayıcıda açılır; masaüstü ve 390 px görünüm düğmeleri vardır. Katalog örnek veriler kullanır, herhangi bir gönderim yapmaz. Logo önizlemelerde gömülüdür; internet gerekmez. Katalog arayüzü kullanıcının paylaştığı `E-posta Kimliği.html` temel alınarak `preview-shell.html` dosyasına uyarlandı. Kullanıcının daha sonra paylaştığı `emais.zip` içindeki 27 HTML tasarımı ve logo `reference/` altında korunur. Üretim şablonları bu referansın 600 px düzeninden, tipografisinden ve durum renklerinden türetilir.

## Gönderim envanteri

| Kanal / kaynak | E-postalar | Alıcı / tetikleyici |
| --- | --- | --- |
| `packages/db/supabase/functions/send-email-hook/` | Kayıt doğrulama, giriş bağlantısı/kodu, şifre yenileme, e-posta değişikliği, Auth daveti, OTP, yeniden doğrulama | Supabase Auth tarafından sağlanan hesap; dashboard ve müşteri menüsü ortak hook kullanır |
| `packages/db/src/dashboard-device-security.ts` | Yeni cihaz / giriş doğrulama kodu | Oturum açan kullanıcı; 10 dakika geçerli cihaz kodu |
| `apps/dashboard/lib/actions/team.ts` | Ekip daveti ve tekrar gönderim | İşletme sahibinin davet ettiği ekip üyesi; 7 günlük davet |
| `packages/application/src/notification-emails.ts` + dashboard provider | Sipariş, masa isteği, başlangıç, abonelik, ödeme ve hesap durumu | Yetkili ekip üyeleri veya işletme sahibi; outbox, bildirim tercihleri ve zorunlu faturalama kuralları |
| `apps/dashboard/lib/accounting/invoice-email.ts` | PDF ekli abonelik faturası | Fatura profilindeki e-posta; muhasebe işi tamamlandığında |
| `apps/dashboard/lib/stand-request-notification-port.ts` | QR stand talebi | `RESEND_STANDS_TO_EMAIL` operasyon alıcısı |
| `apps/marketing/app/api/contact/route.ts` | Genel iletişim, satış, destek formu | Konuya göre yapılandırılmış ekip adresi; Reply-To form sahibidir |
| `packages/db/src/campaign-email.ts` + domain campaigns | Sade, duyuru, teklif, blok oluşturucu ve özel HTML kampanyası | İşletmenin izinli müşterileri; gönderici adı işletme, yanıt adresi işletmenin iletişim adresi |

### Bildirim olayları — tam liste

- Operasyon: `order.created`, `service_request.created`.
- Başlangıç: `onboarding.incomplete`.
- Deneme: `subscription.trial_started`, `subscription.trial_expiring_7`, `subscription.trial_expiring_3`, `subscription.trial_expiring_1`, `subscription.trial_expired`.
- Yenileme ve iptal: `invoice.upcoming`, `subscription.cancellation_scheduled`, `subscription.cancellation_withdrawn`, `subscription.cancelled`.
- Ödeme: `invoice.payment_failed`, `billing.retry_requested`, `billing.warning_3`, `billing.warning_7`, `billing.reconciliation_required`, `invoice.paid`.
- Paket ve kart: `plan.change_scheduled`, `plan.changed`, `payment_method.updated`.
- İade ve belge: `refund.requested`, `refund.succeeded`, `refund.failed`, `fiscal_document.ready`.
- Hesap durumu: `tenant.suspended`, `tenant.reactivated`.
- İlk ücretli aktivasyon: `invoice.paid` + `firstPaidActivation: true`, genel ödeme bildiriminin yerine hoş geldiniz içeriği. Fatura PDF maili ayrı gönderilir.

## Görsel kimlik

| Öğe | Karar |
| --- | --- |
| Marka | Küçük harfle `masabu`; mevcut PNG logo, 118 × 26 px. Görsel engellendiğinde `masabu` alternatif metni |
| Ana renk | Logodaki yeşil `#2f6f4e`; marka çizgisi, düğme, kategori ve bağlantı |
| Zemin / kart | `#f4f5f3` / beyaz; ince `#e4e7e3` kenarlık, 600 px ana gövde |
| Metin | `#16211c`; ikincil metin `#4d5852` |
| Başlık | Georgia / Times New Roman; 27 px masaüstü, 23 px mobil |
| Gövde | Sistem fontu / Segoe UI / Helvetica / Arial; 15 px, rahat satır aralığı; dış font yüklemez |
| Kod | Metin olarak, tek parça; baştaki sıfırlar korunur. 34 px monospace, nötr açık zemin |
| Düzen | Gizli gelen kutusu özeti → logo → kategori → başlık → mesaj → gereken detay/kod → işlem → bağlamsal alt bilgi; dış Masabu ve site adresi footer’ı ortalı |
| Kampanya | İşletme adı önde; Masabu altyapı imzası ve pazarlama izin açıklaması altta. Kaydedilmiş özel renkler/bloklar korunur |

Tablo tabanlı yerleşim ve inline stiller temel görünümü taşır. Mobil boşluklar için media query, Outlook için sabit genişlik sarmalayıcısı ve düğme hücresi bulunur. Dış görsel yalnızca logodur. Koyu modda istemcinin otomatik renk dönüştürmesi ayrıca gerçek posta istemcilerinde kontrol edilmelidir.

## Yazı dili

- Sakin, açık ve saygılı bir “siz” dili. İşlem düğmelerinde kısa fiil: “Daveti kabul et”, “Siparişleri aç”, “Kuruluma devam et”.
- Konu satırı çoğunlukla `masabu · İşlem`; operasyon bildiriminde işletme/masa bilgisi eklenir. Fatura konu formatı mevcut teslim kayıtlarıyla uyum için korunur. İşletme kampanyasının konu satırını işletme belirler.
- Önce ne olduğu, sonra gerekiyorsa kullanıcının yapacağı işlem anlatılır.
- Süre yalnızca kaynaktan doğrulanabiliyorsa belirtilir: cihaz kodu 10 dakika, ekip daveti 7 gün. Supabase kod süresi uzaktan değişebileceği için sabit süre vaat edilmez.
- Giriş kodu yalnızca müşteri menüsü OTP, kayıt doğrulama ve yeniden doğrulama maillerinde gösterilir. Dashboard giriş bağlantısı, şifre yenileme, Auth daveti ve e-posta değişikliği maillerinde kod veya kod süresi metni bulunmaz. Dashboard kaydında kodun yanında alternatif doğrulama bağlantısı korunur. Cihaz doğrulaması kendi 10 dakikalık kodunu kullanır.
- Şifre veya kod istenmez. Güvenlik maillerinde kodu paylaşmama ve beklenmeyen istek açıklaması bulunur.
- PDF faturası, ödeme bildirimi ve mali belge hazır bildirimi ayrı amaçları korur.
- Yanıt kabul ettiği bilinmeyen gönderici için “bu e-postayı yanıtlayın” vaadi kullanılmaz. İletişim formunda mevcut Reply-To korunur.

## Uygulama ve bakım

- `packages/domain/src/email-brand.ts`: bağımlılıksız ortak renkler, sarmalayıcı, paragraf, detay tablosu, kod, düğme ve HTML → düz metin.
- `packages/domain/src/email-messages.ts`: cihaz, ekip, PDF fatura, stand, iletişim içerikleri.
- `renderNotificationEmail`: outbox gönderimi ile katalog aynı son belgeyi üretir. Kategori bazlı veritabanı şablonları korunur ve marka sarmalayıcısına alınır; ilk ücretli aktivasyonun özel davranışı devam eder.
- Auth hook, `pnpm email:sync` ile üretilen `supabase/functions/_shared/email-brand.ts` dosyasını kullanır; böylece Edge Function dağıtımı monorepo dış dosya erişimine bağımlı olmaz. Kaynak domain modülüdür, eşitlik testi üretilmiş kopyanın güncelliğini denetler. Ortak tasarımı değiştirince `pnpm email:sync` çalıştırın.
- Tüm 8 gönderim kanalı HTML ve düz metin alternatifi taşır. Kullanıcı girdileri HTML’de escape edilir; konu satırları HTML entity’ye çevrilmez.
- Ek dosyalar, alıcı seçimi, izinler, rate limit, idempotency, outbox tekrar denemeleri, doğrulama URL’leri ve token üretimi bu tasarım değişikliğinin dışında tutulur.
- Yeni bir mail eklerken önce ortak renderer’ı kullanın, ardından kataloğa örnek ekleyin. Gerçek token, kişi veya müşteri verisi kullanmayın.

## Yayına alma sınırı

Bu çalışma yerel kod ve önizlemeleri hazırlar. Canlı ortama deploy, veritabanı değişikliği veya gerçek alıcıya test gönderimi yapmaz. Dashboard/marketing sürümüyle birlikte **`send-email-hook` Edge Function da yeniden deploy edilmelidir**; aksi halde Auth mailleri eski tasarımda kalır. Hook’un Supabase Auth ayarlarında etkinliği, mevcut gönderici domain doğrulaması ve `https://masabu.co/brand/masabu-logo-transparent-512px.png` adresinin erişimi yayın ortamında kontrol edilmelidir.

Gerçek Gmail, Outlook ve Apple Mail gönderim/teslim testleri bu yerel katalogdan ayrı bir yayın kontrolüdür. Sunucudaki kategori şablonu özelleştirmeleri ve daha önce kuyruğa alınmış kampanya HTML’leri yerel kaynak taramasından görülemez; tasarım değişikliği bunları topluca silmez veya yeniden yazmaz.

## Yerel doğrulama — 8 Eylül 2026

- Domain: 82; application: 263; ilgili DB/Auth/kampanya: 21; marketing: 35; dashboard mimari: 987 test geçti (toplam 1.388).
- Değişen TypeScript/JavaScript dosyalarında ESLint temiz. Domain, application, DB, dashboard ve marketing tip denetimleri geçti.
- 46 HTML örneği Chromium’da 320, 375 ve 600 px genişlikte tarandı; yatay taşma bulunmadı. Katalog seçimi ve mobil görünüm düğmesi çalıştı.
- Kayıt, OTP, fatura ve kampanya örnekleri için ekran görüntüleri `test-results/email-brand/` altında; kayıt, OTP, fatura ve katalog görselleri ayrıca gözle incelendi.
- Bu sonuçlar gerçek e-posta istemcisi teslim testi veya tam monorepo production build sonucu değildir.

### İçerik düzeltmesi doğrulaması

Kod/bağlantı ayrımı ve düz metin alternatiflerini kapsayan 24 DB/Auth/kampanya testi ile 82 domain testi geçti. İlgili tip ve lint denetimleri temiz. Katalog, eksik dış dosyalara ihtiyaç duymadan 46 yerel şablonu açar.

## ZIP tasarımlarının uygulanması

27 kaynak mailden ortak 600 px gövde, 118 px logo, sağ üst bağlam, 27/23 px serif başlık, 15 px metin, detay kartları, tutar tablosu ve numaralı başlangıç adımları aktarıldı. Yeşil `#2f6f4e`, dikkat `#b7791f`, kritik `#b42318` çizgileri olay durumuna göre seçilir. Aynı dil 46 mevcut önizlemeyi kapsar.

Kaynakta örnek amaçlı yazılmış tutarlar, kişiler, IP/cihaz bilgileri, vergi numaraları, kart son haneleri ve tarihler üretime kopyalanmaz. Olayta gerçek tutar/plan/tarih/belge türü varsa gösterilir. PDF maili muhasebe işindeki gerçek toplamı ve dönemi kullanır; olmayan veriler için satır uydurulmaz. Sipariş olayı ürün kalemi taşımadığından mailde gerçek masa ve sipariş toplamı gösterilir.

İş amacı farkları korunur: `device` mevcut giriş doğrulama kodudur; tamamlanmış giriş bildirimi değildir. `contact` ve `stand-request` operasyon alıcısına gider; müşteri teyidi veya SLA/kargo vaadi eklenmez. `welcome` ücretli aktivasyondur; deneme başladı veya menü yayında iddiası eklenmez. İptal ve askıya alma mesajları gerçek uygulama davranışını kullanır. Auth süreleri ve roller kaynak örneklerinden alınmaz.

Footer ortalıdır; adres `apps/marketing/lib/legal-identity.ts` içindeki mevcut işletme kimliğiyle eşleşir. Kaynaktaki `#` bağlantıları taşınmaz: destek ve gizlilik mevcut site rotalarını, operasyon bildirim ayarları ilgili işletmenin dashboard rotasını kullanır.

Son görsel kontrol: 46 örnek 320, 390 ve 760 px genişlikte açıldı; yatay taşma, bozuk logo veya footer hizası sorunu yok. OTP referansı ve uygulama aynı 760 px görüntüde yan yana incelendi. Üretime dağıtım ve gerçek alıcılara gönderim yapılmadı.

## Gönderen kimliği ve konu düzeni — 8 Eylül 2026

- Bildirimlerin varsayılan konusu olayla başlar, işletme adı sonda kalır: `Pro deneme süreniz sona erdi — Hey`. Böylece işletme adı bir selamlama gibi okunmaz ve çoklu işletme bağlamı korunur. Veritabanında özel konu tanımlanmışsa özel şablon korunur.
- `brandEmailSender`, yalnız adres içeren veya adresi görünen ad olarak yineleyen gönderici ayarını `masabu <adres>` biçimine getirir. Posta kutusu ve bilinçli tanımlanmış farklı görünen ad korunur. Geçersiz veya satır sonu içeren ayarlar gönderime sokulmaz.
- Bu düzen bildirim, cihaz kodu, ekip daveti, PDF fatura, stand talebi ve iletişim kanallarında kullanılır. Auth hook zaten markalı gönderici taşır; işletmelerin kampanya gönderici adları kendi kurallarını korur.
- Görsel şablondaki logo ile alıcının mail uygulamasındaki gönderen avatarı ayrı alanlardır. Google OAuth marka doğrulaması e-posta avatarını yapılandırmaz.
- Gmail'de BIMI için uygun SVG, VMC/CMC sertifikası ve uygulanan DMARC politikası gerekir. Outlook'ta BIMI alıcı gösterimi desteklenmez; tüm istemcilerde logo gösterimi vaat edilmez.
- İzlenen destek adresine Reply-To ve SPF/DKIM/DMARC teslim doğrulaması sonraki kurulum adımlarıdır. Bu değişiklik posta kutusu, DNS veya sertifika oluşturmaz. İlk DNS kontrolünün izin incelemesi zaman aşımına uğradı; sonraki salt okunur kontrol başarılı oldu. `_dmarc.masabu.co` üzerinde `p=quarantine`, `send.masabu.co` üzerinde SPF kaydı var; `default._bimi.masabu.co` üzerinde TXT kaydı yok. Bunlar gerçek mesajın SPF/DKIM/DMARC doğrulamasından geçtiğini tek başına kanıtlamaz.

Kaynaklar: [Resend görünen gönderen adı](https://resend.com/docs/api-reference/emails/send-email), [Google BIMI kurulumu](https://knowledge.workspace.google.com/admin/security/set-up-bimi), [BIMI istemci desteği](https://bimigroup.org/bimi-infographic/).

Doğrulama: 85 domain testi, 25 bildirim e-postası testi ve 16 Auth/kampanya testi geçti. Geniş application çalışmasında 263 test geçti, bir dosya bekleyen promise nedeniyle iptal oldu; o dosyanın 2 testi ayrı yeniden çalıştırmada geçti. Dashboard, marketing ve DB tip kontrolleri, değişen dosyaların lint kontrolü başarılı. 46 yerel önizleme yeniden üretildi; gerçek mail gönderilmedi.
