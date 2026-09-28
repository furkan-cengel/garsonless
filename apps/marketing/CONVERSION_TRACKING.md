# Marketing conversion ölçümü

Mevcut `ConsentAnalytics` ve `trackMarketingEvent` altyapısı kullanılır. Yeni dependency, GTM container veya üretim tracking ID eklenmedi.

## Etkinleştirme

- Marketing ve dashboard için aynı gerçek `NEXT_PUBLIC_GA4_MEASUREMENT_ID` değerini tanımlayın ve yeniden build alın. Boş/geçersiz ID ile Google etiketi yüklenmez.
- Mevcut analytics yayın kontrolü için `ANALYTICS_PRODUCTION_ENABLED` yapılandırmasını doğrulayın. Ziyaretçinin açık analitik izni olmadan event gönderilmez; reklam depolaması ve kişiselleştirme açılmaz.
- `NEXT_PUBLIC_DASHBOARD_URL` gerçek dashboard origin'ini göstermelidir. Mevcut yerel geliştirme varsayılanı `http://localhost:3000` korunmuştur.
- Mevcut formun çalışması için reCAPTCHA, Resend ve veritabanı/rate-limit ortam ayarları gerekir. Bunlar yeni bir form ya da servisle değiştirilmedi.

## Event sözleşmesi

| Event | Tetikleyici | Parametre |
| --- | --- | --- |
| `signup_click` | `/auth/signup` bağlantısına tıklama (mevcut event korunur) | `placement` |
| `free_trial_click` | Aynı deneme/kayıt bağlantısına tıklama | `placement` |
| `demo_request_click` | `data-conversion-event="demo_request_click"` olan bağlantı | `placement` |
| `pricing_cta_click` | Fiyat sayfasındaki veya `data-conversion-context="pricing"` işaretli deneme/demo bağlantısı | `placement` |
| `allergen_landing_cta_click` | Alerjen sayfasındaki deneme/demo bağlantısı | `placement` |
| `contact_form_submit` | API'nin kabul ettiği gerçek form gönderimi; hata ve honeypot hariç | `topic` |
| `generate_lead` | Kabul edilen genel/satış talebi (mevcut event korunur) | `topic` |
| `phone_click` | Varsa `tel:` bağlantısı | `placement` |
| `whatsapp_click` | Varsa `wa.me`, `api.whatsapp.com`, `web.whatsapp.com` bağlantısı | `placement` |

`placement`: `header`, `footer`, `content`. `topic`: `general`, `sales`, `support` (`generate_lead` destek taleplerini içermez). Sayfa konumu yalnız izinli path'i taşır; query, fragment, e-posta, telefon ve form içeriği analytics'e gönderilmez.

Tek tıklama farklı analiz kırılımları için birden fazla farklı event üretir. Örneğin fiyat kartı `signup_click`, `free_trial_click`, `pricing_cta_click` üretir. Bunları aynı Google Ads hedefinin birden fazla birincil dönüşümü olarak toplamayın. Tıklama event'leri tamamlanmış kayıt değildir; mevcut `sign_up`/`trial_started` ve kabul edilen `generate_lead` ayrı sonuçlardır. GA4/Ads panelindeki event eşleme ve birincil hedef seçimi hesap sahibinin yapılandırmasıdır.

## Demo ve gerçek müşteri verisi

Demo bağlantıları `/iletisim?subject=business#satis-formu` adresine gider; mevcut satış konusu seçilir ve formun mevcut alanları kullanılır. Ayrı booking servisi gerekmez. Gerçek booking URL'si tercih edilirse bu bağlantıları ve ölçüm kapsamını birlikte güncelleyin.

`components/SocialProof.tsx` içindeki `customerProofs` boş olduğunda bölüm hiç render edilmez. Yalnız yayımlama izni alınmış işletme adı, logo, yorum, modüller ve bağlamı açıklanan gerçek metriği ekleyin. Yerel logo dosyaları `public/` altında kullanılabilir.

Kurulum mesajı mevcut fiyat kataloğuyla tutarlıdır: profesyonel kurulum/menü aktarımı ek hizmettir. Ücretsiz görüşme, ücretsiz profesyonel menü aktarımı vaadi değildir.

## Doğrulama

- `corepack pnpm --filter @garsonless/marketing test`
- `corepack pnpm exec playwright test --config=playwright.marketing-conversion.config.ts`
- `corepack pnpm lint`
- `corepack pnpm typecheck`
- `corepack pnpm --filter @garsonless/marketing build`

Mobil hero önce animasyonu, ardından slogan, açıklama ve CTA grubunu gösterir. Animasyon yüksekliği `svh` ile ekrana uyarlanır; 320×568 ile 430×932 arasındaki yedi dikey mobil boyutta güven metni dahil tüm hero ilk ekrana sığar (çerez bildirimi kapatıldıktan sonra). CTA dokunma alanları en az 48 px korunur. Kısa ekranlarda ödeme kartı yatay düzen kullanır. Pazarlama yüzeyindeki kısa bildirim, ayrıntılı tercihler paneline erişimi ve eşit kabul/ret seçeneklerini korur.

Playwright testindeki `G-MASABUTEST` yalnız test sunucusuna verilir. Google, reCAPTCHA ve demo sağlayıcısı testte taklit edilir; form gönderimleri yerel tarayıcı sınırında karşılanır ve gerçek talep oluşturulmaz.
