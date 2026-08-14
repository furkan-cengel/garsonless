# ADR-0002 — SaaS Abonelik Billing: İyzico (tek provider) + Dunning Politikası

- **Durum:** Revize edildi (2026-08-14)
- **Karar sahibi:** Ürün sahibi (Furkan)
- **Bağımlılık:** ADR-0001 (paketler), ADR-0003 (tenant lifecycle)

## Bağlam

SaaS abonelik tahsilatı, restoranların müşterilerinden aldığı sipariş
ödemelerinden (İyzico checkout + `payment_credentials`) **tamamen ayrı** bir
sistemdir. İlk kaynak tek provider olmalıdır; iki provider'ın aynı anda
"yarım" desteklenmesi kabul edilmez.

## Karar

### Provider: İyzico

- **İlk ve tek abonelik provider'ı İyzico'dur.** Gerekçe: platform TR tüzel
  kişiliği + TRY faturalama; sipariş tarafında İyzico entegrasyon deneyimi
  mevcut; Stripe TR'de yerleşik işletmeye doğrudan hizmet vermez (yabancı
  tüzel kişilik gerektirir).
- Tüm provider erişimi tek port arkasındadır:

```ts
interface SubscriptionBillingProvider {
  createCustomer(...)
  createCheckout(...)
  retrieveCheckout(...)
  verifyWebhook(...)
  retryInvoice(...)
  cancelSubscription(...)
}
```

- Stripe (veya başka provider) gelecekte yalnız bu portu implemente ederek
  eklenir; uygulama katmanı provider adı bilmez.
- Platform billing credential'ları tenant'ların `payment_credentials`
  tablosuyla **karışmaz**; ayrı, service-role-only konfigürasyondadır ve
  hiçbir zaman client'a/ekrana çıkmaz.

### Doğrulanan İyzico capability semantiği

- Hosted subscription checkout ayrı bir `checkoutUrl` üretmez; provider'ın
  döndürdüğü token ve form içeriği kontrollü dashboard yüzeyinde render edilir.
- Checkout müşteri adı/soyadı, VKN/TCKN, telefon ve fatura/teslimat adresini
  zorunlu ister. Bu değerler uydurulmaz veya restoranın serbest metin adından
  türetilmez; owner-gated billing onboarding kaydından alınır.
- Checkout sonucu callback sonrasında token ile ayrıca retrieve edilir. Lokal
  customer/subscription/plan referansları ancak bu doğrulanmış sonuçtan sonra
  provider referanslarıyla eşleştirilir.
- Otomatik ödeme retry çağrısı, doğrulanmış failure webhook'undaki
  `orderReferenceCode` ile yapılır. Çağrının kabul edilmesi ödeme başarısı
  değildir; kesin durum yine imzalı webhook ile oluşur.
- İyzico cancel API'si mevcut entegrasyonda anlık iptal semantiğindedir.
  “Dönem sonunda iptal” provider'a gönderilen hayali bir flag değildir; lokal
  scheduler/dunning orchestration tarafından vade sonunda anlık cancel'a
  çevrilir.

### Veri modeli

`billing_customers`, `subscription_invoices`, `subscription_payment_attempts`,
`billing_provider_events`, `billing_reconciliation_jobs`, `dunning_runs`.
Tümü service-role sınırında; anon/authenticated erişim yoktur. Dashboard
yalnız kendi tenant'ının fatura/durum projection'ını owner-gated okur.

### Outbound provider operasyonları

- Checkout, retry ve cancel çağrıları provider'a gitmeden önce service-role-only
  `billing_provider_operations` ledger'ında claim edilir. Anahtar yalnız bir
  kez kullanılabilir ve immutable request fingerprint'iyle bağlıdır; aynı
  anahtarın farklı payload ile tekrarı fail-closed reddedilir.
- Provider cevabı ile lokal subscription/invoice güncellemesi farklı ağ
  sınırlarında olduğu için lokal finalize hatası temiz başarı sayılmaz. Operasyon
  `requires_reconciliation` olur; otomatik redispatch edilmez ve sonraki
  reconciliation worker tarafından görünür biçimde çözülür.
- Dunning retry çağrısı da aynı outbound ledger'dan geçer. Aynı dunning run
  sabit idempotency anahtarı ve fingerprint üretir; başarılı veya belirsiz
  replay provider'a ikinci kez gönderilmez. Belirsiz retry ödeme başarısı
  sayılmadan uyarı takvimine devam eder ve owner'a zorunlu reconciliation
  bildirimi üretir.
- Crash sonrası `processing` kalan operasyonlar 15 dakika, checkout callback
  bekleyen operasyonlar 24 saat sonra otomatik redispatch edilmeden
  `requires_reconciliation` durumuna alınır. Reconciliation consumer para
  durumunu tahmin ederek düzeltmez; manual-review olayı üretir.
- Checkout callback token'ı log, URL query veya ledger idempotency anahtarına
  ham olarak yazılmaz. Lokal callback anahtarı token'ın SHA-256 özetinden
  türetilir.
- Hosted checkout callback'i kimlik eşleştirmesidir, ödeme otoritesi değildir.
  Subscription/invoice provider referansları callback retrieve/search sonucuyla
  kaydedilebilir; tenant entitlement'ı yalnız doğrulanmış imzalı payment webhook
  ve atomik payment-success RPC'siyle açılır.

### Tenant billing settings projection'ı

- Tenant owner'ının faturalama ekranı geniş billing tablolarını doğrudan
  okuyamaz. Authenticated owner önce dashboard actor context'ine çevrilir;
  application katmanı tenant eşleşmesini doğruladıktan sonra service-role-only
  dar read-model RPC'si çağrılır.
- Client projection'ı yalnız fatura profili, abonelik dönem/durum bilgisi, son
  12 fatura ve kullanıcıya aksiyon aldıran aggregate attention alanlarını taşır.
  Provider referansları, raw/sanitized provider debug projection'ları, internal
  error metni, credential ve reconciliation ayrıntısı client'a çıkmaz.
- Hosted form içeriği uygulama DOM'una güvenilir markup gibi enjekte edilmez;
  `allow-same-origin` içermeyen sandbox iframe sınırında render edilir. Formun
  tamamlanması entitlement açmaz; payment webhook otoritesi korunur.
- Faturalama read modelinin geçici hatası bütün Ayarlar ekranını düşürmez.
  Bölüm güvenli bir public hata kodu ve retry yüzeyiyle degrade olur; diğer
  tenant ayarları kullanılabilir kalır.

### Kritik kurallar (pazarlık edilemez)

1. Webhook işleme **idempotent**tir; aynı provider event'i iki kez state
   değiştiremez. İlk başarılı event kazanır.
2. Provider event ham payload'ı PII/secret filtrelenerek saklanır
   (`billing_provider_events`), debug için yeterli, sızıntı için yetersiz.
3. Invoice/payment state değişikliği + outbox event **aynı transaction**da
   yazılır (mevcut outbox altyapısı kullanılır; ad-hoc e-posta çağrısı yasak).
4. Başarılı ödeme tenant'ı **atomik** biçimde `active` yapar.
5. Başarısız retry, dunning schedule'ını **yalnız bir kez** planlar (aynı
   fatura için çift dunning koşusu üretilemez).
6. Manuel admin müdahalesi (muafiyet, elle aktifleştirme) provider webhook
   akışından **ayrı audit** edilir (ADR-0004).
7. Reconciliation job'ı provider ile lokal state arasındaki tutarsızlığı
   periyodik tarar; fark otomatik "düzeltilmez", görünür operasyon olayı olur.

### Plan referansları, tutar doğrulaması ve dönem

- Starter/Plus/Pro için aylık ve yıllık olmak üzere altı ayrı İyzico plan
  referansı vardır. Business bu checkout'a giremez.
- Checkout girdisi `plan + interval` taşır. Aylık dönem bir ay, yıllık dönem on
  iki aydır; yıllık ücret peşin tahsil edilir.
- Domain kataloğundaki KDV dâhil kuruş tutarı ile yapılandırılan provider
  tutarı birebir uyuşmazsa checkout provider'a çağrı yapmadan fail-closed olur.
- Dönem ortası pro-rata v1'de yoktur; mevcut iptal/retention politikası korunur.

### Dunning politikası (platform politikası — kod sabiti DEĞİL)

Aşağıdaki değerler `platform ayarı` olarak saklanır ve platform admin
tarafından değiştirilebilir; varsayılanlar:

| Zaman | Davranış |
|---|---|
| Vade öncesi 3 gün | E-posta + dashboard bildirimi |
| Vade günü | E-posta + in-app bildirim |
| Başarısız ödeme +1 gün | Otomatik yeniden deneme + e-posta |
| +3. gün | E-posta; SMS yalnız açık rıza ve tenant ayarı varsa |
| +7. gün | Son uyarı (e-posta + in-app, susturulamaz) |
| +14. gün | Otomatik `suspended` (bkz. ADR-0003) |
| Ödeme başarılı (her an) | Atomik `active` + "Hizmetiniz yeniden etkinleştirildi" bildirimi |

- Dunning bildirimleri Faz 4 bildirim altyapısından (template + delivery +
  dedupe) gönderilir; aynı olay için tekrar e-posta spam'i dedupe anahtarıyla
  engellenir.
- Kritik ödeme/kesinti bildirimleri kullanıcı tercihiyle **susturulamaz**.
- Bu zorunlu olaylarda dashboard inbox veya e-posta consumer URL'si eksikse
  outbox event ACK edilmez. Consumer receipt'leri sayesinde eksik kanal
  kurulduğunda teslimat tekrar güvenle denenir.

### Worker rollout sözleşmesi

Supabase outbox worker ortamında aşağıdaki URL'ler birlikte tanımlanır:

- `OUTBOX_INBOX_CONSUMER_URL=https://<dashboard>/api/internal/inbox`
- `OUTBOX_EMAIL_CONSUMER_URL=https://<dashboard>/api/internal/notification-email`
- `BILLING_MAINTENANCE_URL=https://<dashboard>/api/internal/billing-maintenance`

Üç endpoint de dashboard ve Edge worker'da aynı `OUTBOX_WORKER_SECRET` ile
korunur. Billing maintenance çağrısı bounded batch, lease ve backoff kullanır;
imzalı provider webhook'u paid/reactivated durumunun tek otoritesi kalır.

## Sonuçlar

- Faz 5 implementasyonu bu ADR'deki tablo/kural setine birebir uyar.
- İyzico'nun abonelik API yüzeyi yetersiz kalırsa (ör. kayıtlı kart ile
  otomatik tekrar tahsilat kısıtları) karar şu şekilde esner: dönemsel
  "checkout linki + manuel ödeme" akışı port arkasında ilk sürüm olarak kabul
  edilir; otomatik tahsilat provider yeteneği doğrulandığında açılır. Bu
  esneme portu değiştirmez.
