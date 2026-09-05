# İyzico canlı abonelik kurulumu

Bu runbook Masabu SaaS abonelik tahsilatını kapsar. Restoranların misafirlerden
aldığı sipariş ödemesi için kullanılan `IYZICO_*` değerlerinden ayrıdır.

## 1. İyzico planları

İyzico panelinde tek ürün altında altı temel ve altı desteklenen birleşik add-on
varyantı olmak üzere 12 aktif, denemesiz ve yinelenen (`RECURRING`) plan
oluşturulur. Tutarlar tahsil edilecek KDV dâhil toplamdır; aşağıdaki %20
örneği yalnız `INVOICE_VAT_RATE=20` muhasebeci tarafından onaylandıysa kullanılır.

| Plan           |        Sıklık |          Net | %20 KDV dâhil |
| -------------- | ------------: | -----------: | ------------: |
| Starter aylık  | `MONTHLY × 1` |    349,00 TL |     418,80 TL |
| Starter yıllık |  `YEARLY × 1` |  3.350,40 TL |   4.020,48 TL |
| Plus aylık     | `MONTHLY × 1` |    699,00 TL |     838,80 TL |
| Plus yıllık    |  `YEARLY × 1` |  6.710,40 TL |   8.052,48 TL |
| Pro aylık      | `MONTHLY × 1` |  1.199,00 TL |   1.438,80 TL |
| Pro yıllık     |  `YEARLY × 1` | 11.510,40 TL |  13.812,48 TL |
| Pro + İyzico Online Ödeme aylık | `MONTHLY × 1` | 1.499,00 TL | 1.798,80 TL |
| Pro + İyzico Online Ödeme yıllık | `YEARLY × 1` | 14.390,40 TL | 17.268,48 TL |
| Starter + Video Hero aylık | `MONTHLY × 1` | 388,00 TL | 465,60 TL |
| Starter + Video Hero yıllık | `YEARLY × 1` | 3.724,80 TL | 4.469,76 TL |
| Plus + Video Hero aylık | `MONTHLY × 1` | 738,00 TL | 885,60 TL |
| Plus + Video Hero yıllık | `YEARLY × 1` | 7.084,80 TL | 8.501,76 TL |

Yıllık ücret peşin çekilir ve plan yıllık yenilenir. `trialPeriodDays=0`, para
birimi `TRY`, plan durumu `ACTIVE` olmalıdır.

## 2. Dashboard production ortamı

`apps/dashboard/.env.example` içindeki `IYZICO_BILLING_*` alanları canlı API
anahtarı, secret, merchant ID ve 12 pricing-plan reference code ile doldurulur.
Canlı origin zorunludur:

```dotenv
SAAS_BILLING_ENABLED=true
IYZICO_BILLING_BASE_URL=https://api.iyzipay.com
INVOICE_VAT_RATE=20
```

Secret değerler `NEXT_PUBLIC_` öneki taşımaz, Git'e eklenmez ve restoran sipariş
ödeme anahtarlarıyla paylaşılmaz.

Anahtarlar, canlı origin ve muhasebeci onaylı KDV oranı eklendikten sonra ürün
ve 12 planı önce değişiklik yapmadan önizleyin:

```bash
corepack pnpm --filter @garsonless/dashboard billing:provision-provider
```

Katalog doğruysa iyzico'da eksik ürün/planları oluşturun. Aynı isimli mevcut
planlar çoğaltılmaz; tutar veya dönem uyuşmazsa işlem fail-closed durur:

```bash
corepack pnpm --filter @garsonless/dashboard billing:provision-provider:live
```

Komutun verdiği secret olmayan plan referanslarını `.env.production` içindeki
karşılıklarına yazın. Provider referanslarını active DB add-on kataloğuna exact
plan/add-on/interval/gross binding olarak taşıyan production senkronu ayrıca
release owner onayıyla çalıştırılmalıdır. Son aşamaya kadar
`SAAS_BILLING_ENABLED=false` bırakın.

## 3. Callback ve webhook

İyzico abonelik callback adresi:

```text
https://app.masabu.co/api/billing/iyzico/checkout/callback
```

Hosted abonelik kart güncelleme callback adresi server action tarafından tek
kullanımlık state ile oluşturulur:

```text
https://app.masabu.co/api/billing/iyzico/card-update/callback?state=<opaque-state>
```

State'in yalnız SHA-256 özeti local operation ledger'ında tutulur. İyzico'nun
hosted form token'ı ve state exact eşleşmeden `payment_method.updated` üretilmez;
kart alanları Masabu'ya gönderilmez veya saklanmaz. Provider'ın 1 TRY kart
validasyonu ve otomatik iadesi Masabu invoice/payment ledger'ına yazılmaz.

İyzico panelinde **Ayarlar → Firma Ayarları → İşyeri Bildirimleri → Abonelik**
alanına şu webhook yazılır ve `X-IYZ-SIGNATURE-V3` özelliği hesapta açılır:

```text
https://app.masabu.co/api/billing/iyzico/webhook
```

Browser callback'i ödeme başarısı değildir. Callback token'ı kullanılarak
Masabu sunucusunun authenticated İyzico retrieve/search çağrısı yapılır. Yalnız
doğrulanmış `ACTIVE` provider sonucu veya V3 imzalı webhook ortak atomik payment
transition'ına girebilir. Bu transition exact invoice'ı `paid` yapmadan checkout
operation `succeeded`, tenant planı veya add-on entitlement'ı açılamaz.

Refund V2 yalnız başarılı payment attempt'e bağlanan exact `paymentId` ile
çalışır. Finance/superadmin sonucu paymentId, TRY tutarı, conversationId ve
response HMAC alanlarıyla doğrular; timeout veya kimlik drift'inde aynı para
hareketi otomatik yeniden gönderilmez. Aynı-gün cancel yalnız İstanbul takvim
gününde ve tam tutarda kullanılabilir. Refund erişimi kendiliğinden kapatmaz.
`refundHostReference` / `cancelHostReference` banka referansıdır ve global
benzersiz kabul edilmez; lookup ödeme kimliğiyle birlikte yapılır. Yalnız
Reporting API'nin exact `refundId` kanıtı global tekil muhasebe referansıdır.

Resend transactional/campaign teslimat webhook'u da aynı release öncesinde
tanımlanır:

```text
https://app.masabu.co/api/webhooks/resend
```

`RESEND_WEBHOOK_SECRET` dashboard ortamında bulunmalıdır. Route untouched body
ve Svix header'larını doğrular; bounced/complained/suppressed/failed sonuçları
notification delivery health'e raw payload veya alıcı adresi taşımadan yansır.

## 4. Fail-closed doğrulama

Canlı planları değiştirmeden, production dosyasındaki 12 referansı iyzico'dan
okuyup fiyat, para birimi, dönem, trial ve durum eşleşmesini doğrulayın:

```bash
corepack pnpm --filter @garsonless/dashboard billing:verify-provider
```

Ardından yerel production sözleşmesini doğrulayın:

```bash
corepack pnpm prod:preflight -- --env-file apps/dashboard/.env.production \
  --scope dashboard --project-ref <production-supabase-ref> \
  --capability saas-billing
```

İki komut da geçmeden `SAAS_BILLING_SALES_ENABLED=true` olan sürüm yayına
alınmaz. `SAAS_BILLING_FINANCIAL_OPS_ENABLED` ayrı bir finance-only kapıdır;
checkout satışı açılmış olsa bile iade smoke'u tamamlanmadan `true` yapılmaz.

## 5. Production migration bundle

Elle tutulan tarihli migration listesi release kaynağı değildir; yeni güvenlik
migration'larını sessizce dışarıda bırakabilir. Önce release adayından içerik
hash'li manifest üretilir, linked PROD çıktısı bu manifestle append-only olarak
doğrulanır ve aracın verdiği exact `pending` dizisi değişmeden push allow-list'i
olarak kullanılır. Production backup alınır; satış, finance ve muhasebe
kill-switch'leri kapalı tutulur:

```bash
corepack pnpm prod:migration-manifest -- \
  --output /tmp/masabu-migrations.json

corepack pnpm --filter @garsonless/db db:status -- \
  --target prod --confirm-prod <production-project-ref> \
  --evidence-output /tmp/prod-migration-list.txt

corepack pnpm prod:migration-drift -- \
  --remote-list /tmp/prod-migration-list.txt \
  --project-ref <production-project-ref> --mode pre-deploy --json

corepack pnpm db:backup -- \
  --target prod --confirm-prod <production-project-ref> \
  --backup-directory /tmp/masabu-prod-backup-<release-id>

corepack pnpm --filter @garsonless/db db:push -- \
  --target prod --confirm-prod <production-project-ref> \
  --expect-pending <verified-pending-versions-comma-separated>
```

Push sonrasında yeni `supabase migration list` kanıtı alınır ve aynı drift
komutu `--mode post-deploy` ile sıfır pending göstermeden capability açılmaz.

Push öncesinde billing-maintenance/outbox/accounting scheduler durdurulur.
Yeni event allowlist'i, lifecycle template'leri, refund adapter'ı, fiscal receipt
ve Resend projection'ını bilen dashboard/platform-admin/Edge worker sürümü
hazır olmalıdır. Migration sonrası bu sürüm deploy edilir; read-only smoke ve
consumer health PASS olmadan scheduler yeniden açılmaz. Eski worker yeni trial,
refund veya fiscal olayını consumer'lara yönlendiremeyeceği için bu sıra
atlanmaz. Migration-only durumda eski uygulama yeni paid-evidence ve maintenance
response sözleşmelerini parse edemez. Canary tamamlanana kadar
`SAAS_BILLING_SALES_ENABLED=false`,
`SAAS_BILLING_FINANCIAL_OPS_ENABLED=false` ve
`ACCOUNTING_DISPATCH_ENABLED=false` kalır.

DEV invariant testi gerektiğinde şu komutla tekrar çalıştırılır; script yalnız
`yxsegwkzyiscrxiwdeuf` projesini kabul eder ve izole fixture'larını temizler:

```bash
corepack pnpm --filter @garsonless/db \
  verify:subscription-checkout-payment-evidence

corepack pnpm --filter @garsonless/db \
  verify:subscription-renewal-hydration

corepack pnpm --filter @garsonless/db \
  verify:subscription-upcoming-reminders

corepack pnpm --filter @garsonless/db \
  verify:subscription-plan-change-ledger

corepack pnpm --filter @garsonless/db \
  verify:subscription-plan-change-convergence

corepack pnpm --filter @garsonless/db \
  verify:subscription-card-update

corepack pnpm --filter @garsonless/db \
  verify:subscription-add-on-lifecycle

corepack pnpm --filter @garsonless/db \
  verify:subscription-period-end-cancellation

corepack pnpm --filter @garsonless/db \
  verify:subscription-refund

corepack pnpm --filter @garsonless/db \
  verify:subscription-lifecycle-notifications
```

Renewal verifier success/failure hydration'ın yanında aynı failure invoice'ı
üzerinde +1/+3/+7/+14 dunning ve tekil suspend event replay invariantını da
doğrular. Bu deterministik DEV kanıtı, provider'ın gerçek zamanlı iki ardışık
sandbox renewal çevrimi kanıtının yerine geçmez.

Plan change verifier'ları same-interval NEXT_PERIOD schedule, child renewal
lineage rotation, retired-parent quarantine ve açık-adisyon downgrade drain'ini
doğrular. Card-update verifier initialize/callback replay, yanlış state,
lineage drift, tek outbox event ve sıfır para/entitlement yan etkisini doğrular.
Add-on verifier no-change projection, schedule-before-payment, paid activation,
webhook replay, paid removal, invoice snapshot, server entitlement ve
incompatible selection fail-closed invariantlarını doğrular. Cancellation
verifier schedule/undo/due claim/provider ambiguity ve access timing'ini;
refund verifier partial/full cap, out-of-order response ve timeout quarantine'ı;
lifecycle verifier trial/onboarding occurrence, inbox/e-posta receipt replay,
Resend bounce health, consumer-specific routing ve fiscal no-duplicate
teslimatını doğrular. Runtime'ın art arda iki temiz çalıştırması aynı semantic
occurrence için duplicate outbox/inbox/e-posta üretmemelidir.

Sandbox add-on planlarını idempotent oluşturmak, DEV kataloğunu senkronlamak ve
12 planı provider'dan tekrar read-only doğrulamak için:

```bash
corepack pnpm --filter @garsonless/dashboard billing:provision-provider:sandbox
corepack pnpm --filter @garsonless/dashboard billing:sync-addon-catalog:dev
corepack pnpm --filter @garsonless/dashboard billing:verify-provider:sandbox
```

Gerçek hosted card formu, gerçek zamanlı renewal matrisi ve disposable başarılı
sandbox paymentId üzerinde refund/cancel hareketleri ayrıca çalıştırılmadan
production billing açılmaz.

Sandbox E2E başlamadan önce `NEXT_PUBLIC_APP_URL` localhost olmayan sabit bir
HTTPS origin olmalı; aynı origin'in billing maintenance URL'si DEV outbox worker'a
tanımlanmalı ve dashboard/worker aynı `OUTBOX_WORKER_SECRET` değerini kullanmalıdır.
İyzico sandbox panelindeki subscription notification URL'si
`<sandbox-origin>/api/billing/iyzico/webhook` olmalı ve V3 signature özelliği
etkinleştirilmelidir. DNS/tunnel, ortak worker secret veya panel webhook ayarı
eksikken hosted form initialize sonucu uçtan uca ödeme/webhook kanıtı sayılmaz.
