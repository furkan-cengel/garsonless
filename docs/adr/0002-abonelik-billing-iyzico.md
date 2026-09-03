# ADR-0002 — SaaS Abonelik Billing: İyzico (tek provider) + Dunning Politikası

- **Durum:** Revize edildi (2026-09-01)
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
  retrieveRenewalOrder(...)
  verifyWebhook(...)
  retryInvoice(...)
  upgradeSubscription(...)
  initializeSubscriptionCardUpdate(...)
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
- Ödeme otoritesi tek bir `provider payment evidence` katmanıdır. Bu katmana
  yalnız iki doğrulanmış kanal girebilir: V3 imzalı İyzico webhook'u veya Masabu
  sunucusunun kendi abonelik credential'larıyla yaptığı authenticated
  retrieve/search. İki kanal da aynı idempotent, first-success-wins atomik
  payment-success transition'ını çağırır.
- Browser callback'i tek başına ödeme kanıtı değildir. Callback yalnız opaque
  token'ı server-side recovery'ye taşır; provider sorgusu `ACTIVE`, beklenen plan
  referansı, order/subscription/customer referansları ve dönem doğrulamasını
  geçmeden local invoice `paid` olmaz ve entitlement açılmaz.
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
- Hosted checkout callback'i ödeme otoritesi değildir. Callback sonrasında
  authenticated retrieve başarılıysa referans eşleştirmesi, payment evidence
  event'i, paid invoice, payment attempt, subscription/plan projection ve outbox
  aynı transaction'da yazılır. Herhangi bir adım başarısızsa access açılmaz.
- Mapping oluşmadan önce gelen imzalı webhook durable inbox ve reconciliation'da
  kalır. Authenticated retrieve aynı order/subscription'ı doğruladığında bu event
  ortak paid transition sonucuna yakınsar; ters sırada gelen webhook ise paid
  invoice üzerinde idempotent duplicate olur.

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
  CSP ile oluşturulan `srcDoc` ve yalnız gerekli izinleri taşıyan same-origin
  sandbox iframe sınırında render edilir. Mesajlar exact iframe source, dashboard
  origin ve oturum nonce'ı ile doğrulanır. Checkout formunun tamamlanması tek
  başına entitlement açmaz; payment-evidence otoritesi korunur.
- Faturalama read modelinin geçici hatası bütün Ayarlar ekranını düşürmez.
  Bölüm güvenli bir public hata kodu ve retry yüzeyiyle degrade olur; diğer
  tenant ayarları kullanılabilir kalır.

### Kritik kurallar (pazarlık edilemez)

1. Provider payment evidence işleme **idempotent**tir; aynı webhook veya
   authenticated retrieve replay'i iki kez state değiştiremez. İlk başarılı
   kanıt kazanır.
2. Provider event ham payload'ı PII/secret filtrelenerek saklanır
   (`billing_provider_events`), debug için yeterli, sızıntı için yetersiz.
3. Invoice/payment state değişikliği + outbox event **aynı transaction**da
   yazılır (mevcut outbox altyapısı kullanılır; ad-hoc e-posta çağrısı yasak).
4. Başarılı ödeme tenant'ı **atomik** biçimde `active` yapar.
5. Başarısız retry, dunning schedule'ını **yalnız bir kez** planlar (aynı
   fatura için çift dunning koşusu üretilemez).
6. Manuel admin müdahalesi (muafiyet, elle aktifleştirme) provider evidence
   akışından **ayrı audit** edilir (ADR-0004).
7. Reconciliation job'ı provider ile lokal state arasındaki tutarsızlığı
   periyodik tarar; fark otomatik "düzeltilmez", görünür operasyon olayı olur.

### Plan referansları, tutar doğrulaması ve dönem

- Starter/Plus/Pro için aylık ve yıllık olmak üzere altı ayrı İyzico plan
  referansı vardır. Business bu checkout'a giremez.
- Checkout girdisi `plan + interval` taşır. Aylık dönem bir ay, yıllık dönem on
  iki aydır; yıllık ücret peşin tahsil edilir.
- Domain kataloğundaki KDV hariç kuruş tutarı, muhasebeci onaylı KDV oranı ve yapılandırılan provider genel toplamı
  tutarı birebir uyuşmazsa checkout provider'a çağrı yapmadan fail-closed olur.
- Dönem ortası pro-rata v1'de yoktur; mevcut iptal/retention politikası korunur.

### Plan değişikliği ve kart güncelleme

- Same-interval upgrade/downgrade provider'da `NEXT_PERIOD` ile başlatılır.
  Provider parent/target plan ve child subscription referansları durable change
  request ledger'ına exact bağlanmadan lokal pending projection oluşmaz.
- Plan yalnız child renewal payment evidence başarıyla işlendiğinde uygulanır.
  Provider lineage aynı transaction'da current/retired döner; retired parent
  olayı money state oluşturamaz ve reconciliation'a gider.
- Downgrade effective olduğunda açık adisyon varsa yeni değer üretimi kapanır;
  mevcut settlement/closure korunur ve daha düşük entitlement drain sonrasında
  tek kez uygulanır. Aylık↔yıllık değişim v1'de fail-closed kalır.
- Subscription kart güncelleme yalnız İyzico hosted formudur. Masabu kart alanı
  almaz; provider'ın 1 TRY validasyon/otomatik iade hareketini kendi invoice veya
  payment-attempt ledger'ına yazmaz.
- Card-update initialize idempotent provider operation'dır. Callback exact hosted
  token ile ayrı, yalnız hash'i saklanan opaque state'i birlikte doğrular.
  Başarı tek `payment_method.updated` outbox olayı üretir; lineage drift false
  success yerine reconciliation üretir.
- Başarılı kart güncelleme gecikmiş faturayı otomatik retry etmez. Owner ayrı
  idempotent “Tekrar dene” aksiyonunu kullanır ve provider retry kabulü yine
  payment başarısı sayılmaz.

### Dönem sonu iptal ve SaaS refund

- Owner iptalinin varsayılanı dönem sonudur. Talep vade anına kadar geri
  alınabilir; provider cancel yalnız leased worker due claim'inden sonra gider.
- Refund yalnız başarılı payment attempt'e authenticated provider order
  evidence'ından bağlanan exact `paymentId` ile yapılır. Provider invoice/order
  referansı tek başına refund otoritesi değildir.
- Full/partial refund ayrı, immutable finansal ledger ve provider operation
  üzerinden yürür. Requested/processing/succeeded/reconciliation rezervasyonları
  birlikte paid invoice tutarını aşamaz; aynı request farklı intent ile replay
  edilirse fail-closed olur.
- İyzico Refund V2 başarısı paymentId, TRY tutarı, conversationId ve dokümante
  response HMAC sırasıyla doğrulanır. Timeout, transport hatası veya identity/
  signature drift'i başarı sayılmaz ve otomatik redispatch yapılmadan
  reconciliation'a alınır.
- Banka kaynaklı `refundHostReference` / `cancelHostReference` değerleri global
  benzersiz değildir; provider payment kimliği bağlamında aranır. Reporting
  API'den doğrulanan exact `refundId` ise ayrı namespace'te tekil tutulur.
- Aynı-gün cancel İstanbul takvim gününde yalnız tam tutara izin verir. Refund
  subscription/plan/add-on entitlement'ını dolaylı değiştirmez; erişim değişimi
  ayrı cancellation policy ve durable operation gerektirir.
- Başarılı refund accounting review üretir. Owner yalnız güvenli tutar/durum
  projection'ını, finance/superadmin ise AAL2 + audited platform action'ı görür.

### Trial, onboarding ve mali belge iletişimi

- Trial başlangıcı transaction trigger'ı; D-7/D-3/D-1 ve expiry bounded,
  skip-locked scheduler ile üretilir. Her milestone subscription + trial end +
  semantic version anahtarıyla tek occurrence'tır.
- Trial ve tüm ödeme/iptal/iade/fiscal olayları owner-only zorunlu billing
  kanalıdır. Tamamlanmamış onboarding `lifecycle` kategorisidir: in-app açık,
  e-posta açık rıza/opt-in olmadan kapalıdır.
- Mali belge attachment e-postasının Resend message id'si accounting completion
  öncesinde delivery ledger'ına yazılır. Ardından üretilen
  `fiscal_document.ready` aynı dedupe anahtarını kullanır ve ikinci e-posta atmaz.
- İmzalı Resend webhook sonucu sent/delivered/delayed/bounced/complained/
  suppressed/failed olarak project edilir. Raw webhook ve alıcı PII'sı provider
  event tablosuna kopyalanmaz; bounce/complaint notification health'e girer.
- Delivery health worker routing sözleşmesini birebir izler. Trial, onboarding,
  billing ve fiscal olayları inbox/e-posta için sayılır; yalnız order/service
  request olayları web-push health'ine girer. Böylece route edilmeyen lifecycle
  olayları web-push kanalında kalıcı false-positive pending üretmez.

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
paid/reactivated durumu yalnız doğrulanmış provider payment evidence katmanından
çıkar.

## Sonuçlar

- Faz 1–6 DEV implementasyonu bu ADR'deki tablo/kural setine uyar. Gerçek
  sandbox matrisi ve production rollout ayrı kabul kapıları olarak açık kalır.
- İyzico'nun abonelik API yüzeyi yetersiz kalırsa (ör. kayıtlı kart ile
  otomatik tekrar tahsilat kısıtları) karar şu şekilde esner: dönemsel
  "checkout linki + manuel ödeme" akışı port arkasında ilk sürüm olarak kabul
  edilir; otomatik tahsilat provider yeteneği doğrulandığında açılır. Bu
  esneme portu değiştirmez.
