# Masabu cihaz güvenliği ve Google giriş durumu

7 Eylül 2026. Aşağıdaki test notları geliştirme sırasındaki durumu kaydeder.

## Üretim yayın hazırlığı — 7 Eylül

Kullanıcı tüm değişikliklerin commit/push ve üretim dağıtımını onayladı. İki eklemeli migrasyon, üretim yedeği alındıktan sonra uygulandı. Google sağlayıcısı üretimde açıldı; dashboard Google callback ve etkileşimli e-posta onay adresleri izin listesine eklendi. Dashboard'un yeni üretim sürümü için cihaz güvenliği açık, IPinfo/VPN kontrolü kapalı olarak ayarlandı. Mevcut hesapların veritabanı kaydı uygulama yayını doğrulandıktan sonra yapılır.

Yerel/test betikleri dashboard paketinin `test:auth-recovery:runtime`, `test:device-security:runtime` ve `test:logout:runtime` komutlarından çalıştırılır; yalnız izole `127.0.0.1:55321` veritabanını kabul ederler. Çıkış regresyonunda oturumu silinen korunan sunucu render'ı 404 yerine giriş yönlendirmesi üretir; istemci çıkış sırasında yeni arka plan sorgusu başlatmaz.

Son dağıtım kimlikleri, canlı kontroller ve kalan doğrulama sınırları yayın çıktısında tutulur. Aşağıdaki “henüz etkin olmayan” ifadeler ilgili testin yapıldığı anı anlatır; güncel üretim durumu bu yayın notundan değerlendirilmelidir.

## Güncel kapsam kararı

VPN tespiti kullanıcının isteğiyle kapsamdan çıkarıldı. IPinfo adaptörü opsiyonel ve kapalıdır; anahtar/abonelik gerekmez. Yerel Google sağlayıcısı kullanıcının verdiği mevcut istemci bilgileriyle bağlandı; gerçek giriş Google doğrulamasından dönüp cihaz doğrulama ekranına ulaştı. Bunun üzerine kullanıcı Google girişinden sonra ek e-posta kodu istemediğini belirtti.

Yeni davranış: imzalı Google giriş bağlamı ve başarılı PKCE kod değişimi sonrasında Supabase Auth'a token açıkça doğrulatılır; kullanıcı/oturum eşleşmesi, doğrulanmış e-posta, Google kimliği ve son 10 dakika içinde OAuth giriş kanıtı aranır. Şifre, e-posta OTP veya kurtarma oturumu yalnız Google kimliği bağlı olduğu için bu yolu kullanamaz. Doğrulama kaydı Google giriş zamanından itibaren 24 saattir; 15 günlük kalıcı cihaz güveni otomatik verilmez. İlk kayıtta sözleşme kabulü ve işletme yetki kontrolleri devam eder. Sonraki süre/ağ kontrolleri mevcut politikayı kullanır; yeni Google girişi tekrar ek e-posta kodu istemeden oturumu doğrulayabilir.

Bu değişikliğin 6 yeni kanıt testi ve 5 cihaz politika testi (11/11), tüm dashboard regresyon testleri (946/946) ve lint kontrolü geçti. Değişiklik sonrasındaki gerçek Google dönüşünü tarayıcı kontrol servisine erişilemediği için yeniden doğrulama bekliyor. Önceki bölümlerdeki IPinfo kurulum bilgileri, artık opsiyonel olan adaptörün teknik geçmişidir.

## Uygulanan davranış

- Yeni tarayıcıda e-postaya 6 haneli doğrulama kodu. Kod 10 dakika geçerli, 5 yanlış denemeden sonra kapanır. Gönderim kullanıcı başına dakikada 1, saatte 5; doğrulama 15 dakikada 15 istekle sınırlıdır.
- “Bu cihaza 15 gün güven” seçilirse süre başarılı kod doğrulamasından itibaren sabittir; gezinme/giriş süresi uzatmaz. Seçilmezse yalnız mevcut oturum için 24 saatlik doğrulama kaydı tutulur; yeni şifreli giriş tekrar kod ister.
- HttpOnly, SameSite=Lax, üretimde Secure cihaz çerezi; veritabanında yalnız HMAC özeti. Cihaz güveni kullanıcı, tarayıcı imzası ve doğrulanmış ağ bağlamıyla eşleşir.
- Yeni cihaz, süresi dolmuş güven ve ülke değişiminde ek doğrulama. Normal, ülke bilgisi bilinen mobil IP değişimi güveni bozmaz. Ağ bilgisi belirsizse değişen IP’de doğrulama istenir.
- Kod kullanıcıya, Supabase oturumuna, cihaza ve gönderim anındaki ağ bağlamına bağlıdır. Kod tüketimi, deneme sayacı ve doğrulama kaydı tek veritabanı işleminde güncellenir. Eşzamanlı iki doğrulamadan yalnız biri başarılı olur.
- Korunan dashboard sunucu istemcisi ve hizmet yetkisi kullanan işlemlerin ortak erişim kapıları kontrol edilir. Enrol edilmiş hesaplar için PostgREST ön kontrolü, RLS ve Storage nesne/kova politikaları doğrulanmamış veya süresi dolmuş oturumun doğrudan erişimini engeller. Mevcut bağımsız müşteri hesapları otomatik olarak enrol edilmez.
- E-posta kodu/bağlantısıyla tamamlanan gerçek OTP oturumu ikinci bir e-posta koduna zorlanmaz. Kullanıcının güncel tercihi doğrultusunda yeni Google OAuth girişi de ek e-posta koduna zorlanmadan mevcut cihaz oturumunu doğrular. Google’a bağlı hesabın şifreyle girişi bu istisnadan yararlanmaz.
- Güvenlik ayarlarında cihaz güvenini kaldırma bağlantısı. Şifre değiştirme/kurtarma mevcut cihaz güvenlerini iptal eder.
- Google düğmesi, ayrı PKCE callback, imzalı tarayıcı bağlamı, paket/dönem/hedef korunması, yeni hesap için sunucuda sözleşme kaydı. Mevcut e-posta callback’i korunur.

## Henüz etkin olmayan kısımlar

- Üretimde Google Auth sağlayıcısı 7 Eylül’de salt okunur kontrol edildi: kapalı. Depodaki ilgili ortam dosyalarında Google OAuth istemci ID/secret bulunmuyor. Gerçek Google hesabıyla uçtan uca giriş test edilmedi.
- IPinfo sunucu adaptörü eklendi; kullanıcı API anahtarının henüz olmadığını belirtti. Bu nedenle gerçek sağlayıcı sorgusu ve VPN geçişi testi henüz yapılmadı. Etkinleştirme ayarı varsayılan kapalıdır. Ülke kontrolü mevcut Vercel başlıkları üzerinden devam eder.
- Kullanıcı 7 Eylül’de IPinfo’ya IP adresi gönderilmesini ayrıca açıkça onayladı. Önceki otomatik onay engeli giderildi; entegrasyon kodu uygulandı. Eksik olan IPINFO_TOKEN ve buna bağlı gerçek servis doğrulamasıdır.
- Yerel ortamda coğrafi başlıklar güven kaynağı kabul edilmez. Ülke değişimi davranışı deterministik testlerle doğrulandı; gerçek Vercel uç konumlarıyla saha testi bekliyor.
- Supabase e-posta tabanlı ek doğrulama AAL2/TOTP değildir; mevcut Authenticator güvenlik akışı bağımsız kalır.

## Google yapılandırması

1. Masabu’ya ait Google Cloud projesinde Web Application OAuth istemcisi gerekir. Gereken kullanıcı verisi standart kimlik/e-posta profilidir; Gmail/Drive erişimi istenmez.
2. Google Authorized redirect URI: ilgili Supabase projesinin `https://<project-ref>.supabase.co/auth/v1/callback` adresi.
3. Client ID ve Client Secret, Supabase Authentication → Providers → Google altında güvenli biçimde girilip sağlayıcı açılır. Secret sohbete veya git deposuna yazılmamalıdır.
4. Supabase redirect allowlist’e dashboard’un `/auth/google/callback` adresi eklenir. Test için kullanılan `http://localhost:3002/auth/google/callback` ve `http://127.0.0.1:3002/auth/google/callback` ayrı adreslerdir; tarayıcıdaki origin PKCE boyunca korunur. Üretimde yalnız gerçek dashboard origin’i kullanılmalıdır.
5. `NEXT_PUBLIC_APP_URL` gerçek uygulama origin’i olmalıdır. Kod, üretimde yalnız bu origin’den başlatılan işlemi kabul eder. Localhost/127.0.0.1 eşdeğerliği yalnız geliştirmede ve aynı port/protokolde geçerlidir.
6. Önce test Google hesabıyla yeni kayıt, mevcut hesap, iptal, süresi dolmuş callback, yıllık paket ve sözleşme kabulü doğrulanır; ardından ayrı üretim açılışı yapılır.

## Güvenlik özelliğinin açılması ve geri dönüşü

`DASHBOARD_DEVICE_SECURITY_ENABLED=true` yalnız izole 3002 test sürecinde ayarlandı. Varsayılan kapalıdır. Üretim aktivasyonu bu çalışma kapsamında yapılmadı.

Migrasyon: `packages/db/supabase/migrations/20260907160000_dashboard_device_security.sql`.

Dağıtım sırasında uygulama bayrağı ile veritabanındaki hesap kaydı birlikte ele alınmalıdır. Mevcut B2B hesaplar için `packages/db/scripts/enroll-dashboard-device-security.sql` kontrollü olarak uygulanmalıdır; aksi halde uygulamayı henüz tekrar ziyaret etmemiş hesaplarda yeni REST kontrolü başlamaz. Yeni dashboard girişleri sunucuda otomatik enrol edilir.

**Yalnız uygulama bayrağını kapatmak veritabanı korumasını kaldırmaz.** Geri dönüşte etkin hesap kaydı ve yeni RLS/ön kontrol düzeni de planlı biçimde geri alınmalıdır. Mevcut başka PostgREST ön kontrolü varsa migrasyon onu sessizce ezmez; birleştirme gerektirerek durur. Aynı Supabase hesabını başka uygulamalarda da kullanan B2B kullanıcılar için bu oturum kısıtının etkisi test edilmelidir.

Süresi geçmiş kod/oturum/cihaz kayıtları için üretim veri saklama ve temizlik işi ayrıca belirlenmelidir. Yeni RLS tablolarına `dashboard_session_is_verified()` kısıtı da eklenmelidir; REST ön kontrolü globaldir, Realtime/Storage ayrıca kendi RLS kurallarını kullanır.

## Kaynaklar

Google PKCE ve sağlayıcı kurulumu: [Supabase Google Auth](https://supabase.com/docs/guides/auth/social-login/auth-google). Risk sinyalleri ve coğrafi bağlam: [OWASP MFA Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html). Çerez yazımı: [Next.js 15 cookies](https://nextjs.org/docs/15/app/api-reference/functions/cookies).

## Tamamlanan doğrulamalar

- Dashboard test takımı: **932/932**; veritabanı paket testleri: **654/654**. Bu toplamlar mimari/yapısal testleri de içerir; aşağıdaki gerçek akış kontrollerinin yerine sayılmamıştır.
- Dashboard üretim derlemesi, TypeScript kontrolü ve değişen güvenlik/Google dosyalarının lint kontrolü başarılı.
- İzole Supabase + Mailpit üzerinde gerçek sunucu işlemleri: kod gönderimi, görünür tekrar gönderim sınırı, yanlış kod, aynı kodla eşzamanlı iki istekten yalnız birinin başarılı olması, doğrudan REST erişiminin doğrulamadan önce reddedilip sonra açılması.
- Aynı tarayıcıda yeni şifreli girişte geçerli 15 günlük güvenin korunması; cihaz çerezi olmayan tarayıcıda tekrar kod; süresi dolmuş güvenin reddi; gerçek e-posta OTP oturumunun ikinci koda zorlanmadan 24 saatlik oturum kanıtı oluşturması.
- Gerçek SQL işlemleri: kullanıcı/oturum/cihaz/tarayıcı/ülke/IP bağlamının değiştirilmesi, beş yanlış deneme, süresi dolmuş veya gönderilmemiş kod, tekrar kullanım ve hizmet yetkisi olmayan istemciden güven kaydı ekleme reddedildi.
- Gerçek şifre kurtarma sunucu işlemi: yanlış amaç, değişmiş oturum, süre aşımı ve tekrar kullanılan izin reddedildi; yeni şifreyle giriş başarılı. Kullanıcının seçtiği en az 6 karakter, büyük harf, rakam ve özel karakter kuralı korundu.
- Tarayıcıda 390 piksel cihaz doğrulama görünümü, kod alanına odak, tek kullanımlık kod otomatik doldurma niteliği, güven kutusunun varsayılan boş olması ve Google için sözleşme hatası kontrol edildi. Test sonunda görünüm boyutu sıfırlandı.

Test e-postaları yalnız yerel Mailpit kutusuna gönderildi. Gerçek Google sağlayıcısı ve Vercel ülke/VPN geçişi uçtan uca doğrulanmış kabul edilmez. Yerel önizleme: `http://127.0.0.1:3002/auth/signup?plan=pro&interval=yearly`.

## IPinfo bağlantısı — 7 Eylül ek çalışması

- Sunucu ortamında `DASHBOARD_IPINFO_ENABLED=true` ve `IPINFO_TOKEN` gerekir. Cihaz güvenliği için mevcut `DASHBOARD_DEVICE_SECURITY_ENABLED` bayrağı ve veritabanı geçiş koşulları da geçerlidir. Gerçek ortam dosyaları ve üretim ayarları bu aşamada değiştirilmedi.
- Uç nokta sabittir: `https://api.ipinfo.io/lookup/{ip}`. `is_anonymous` ve `is_hosting` alanlarını sağlayan Core/Plus erişimi gerekir. Lite yanıtı güvenli ağ sayılmaz. API anahtarı yalnız Authorization başlığında tutulur; NEXT_PUBLIC değişkenine, URL parametresine veya loga yazılmaz.
- Yalnız Vercel’in üzerine yazdığı istemci IP başlığı kullanılır. Kullanıcının kendi forwarded/ülke/VPN başlıkları güven kaynağı değildir. Geçersiz, yerel ve özel IP adresleri dış servise gönderilmez. IPinfo’ya e-posta, hesap kimliği, cihaz çerezi veya oturum gönderilmez.
- Anonim ağ (VPN/proxy/Tor/relay) veya veri merkezi IP’sine geçişte yeniden e-posta kodu gerekir. Kullanıcı aynı ağı doğruladıktan sonra tekrar kod döngüsü oluşmaz. Tespit, IPinfo’nun IP sınıflandırmasına bağlıdır; her VPN ürününün her bağlantısını yakalama garantisi değildir.
- Sorgu 1,5 saniyede zaman aşımına uğrar; yönlendirmeler izlenmez. Eksik/geçersiz yanıt, bağlantı hatası veya kota sorunu güvenli ağ sayılmaz. Değişen IP için kod istenir; aynı doğrulanmış IP’de erişim sürer.
- Başarılı risk sonucu sunucu sürecinin belleğinde en fazla 5 dakika tutulur (1000 kayıt sınırı); anahtar ham IP/token yerine özetidir. Aynı IP’nin eşzamanlı sorguları paylaşılır. Hatalı sorgu 5 saniye, 401/403/429 yanıtları genel olarak 60 saniye bekletilir. Önbellek süreçler arasında ortak değildir; üretim kotası buna göre izlenmelidir.
- 8 yeni IPinfo/bağlantı davranış testi + 5 mevcut cihaz politika testi: **13/13 başarılı**. Sahte HTTP yanıtlarıyla gerçek adaptör ve karar fonksiyonu birlikte çalıştırıldı. Son regresyon takımı **940/940**, lint ve TypeScript kontrolü başarılı. Canlı sağlayıcı testi API anahtarı gelince yapılacak.

Kaynaklar: [IPinfo Lookup/Plus yanıt sözleşmesi](https://ipinfo.io/developers/plus-api), [IPinfo yetkilendirme](https://ipinfo.io/developers).
