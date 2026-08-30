# İyzico canlı abonelik kurulumu

Bu runbook Masabu SaaS abonelik tahsilatını kapsar. Restoranların misafirlerden
aldığı sipariş ödemesi için kullanılan `IYZICO_*` değerlerinden ayrıdır.

## 1. İyzico planları

İyzico panelinde tek ürün altında altı aktif, denemesiz ve yinelenen (`RECURRING`)
plan oluşturulur. Tutarlar tahsil edilecek KDV dâhil toplamdır; aşağıdaki %20
örneği yalnız `INVOICE_VAT_RATE=20` muhasebeci tarafından onaylandıysa kullanılır.

| Plan           |        Sıklık |          Net | %20 KDV dâhil |
| -------------- | ------------: | -----------: | ------------: |
| Starter aylık  | `MONTHLY × 1` |    349,00 TL |     418,80 TL |
| Starter yıllık |  `YEARLY × 1` |  3.350,40 TL |   4.020,48 TL |
| Plus aylık     | `MONTHLY × 1` |    699,00 TL |     838,80 TL |
| Plus yıllık    |  `YEARLY × 1` |  6.710,40 TL |   8.052,48 TL |
| Pro aylık      | `MONTHLY × 1` |  1.199,00 TL |   1.438,80 TL |
| Pro yıllık     |  `YEARLY × 1` | 11.510,40 TL |  13.812,48 TL |

Yıllık ücret peşin çekilir ve plan yıllık yenilenir. `trialPeriodDays=0`, para
birimi `TRY`, plan durumu `ACTIVE` olmalıdır.

## 2. Dashboard production ortamı

`apps/dashboard/.env.example` içindeki `IYZICO_BILLING_*` alanları canlı API
anahtarı, secret, merchant ID ve altı pricing-plan reference code ile doldurulur.
Canlı origin zorunludur:

```dotenv
SAAS_BILLING_ENABLED=true
IYZICO_BILLING_BASE_URL=https://api.iyzipay.com
INVOICE_VAT_RATE=20
```

Secret değerler `NEXT_PUBLIC_` öneki taşımaz, Git'e eklenmez ve restoran sipariş
ödeme anahtarlarıyla paylaşılmaz.

Anahtarlar, canlı origin ve muhasebeci onaylı KDV oranı eklendikten sonra ürün
ve altı planı önce değişiklik yapmadan önizleyin:

```bash
corepack pnpm --filter @garsonless/dashboard billing:provision-provider
```

Katalog doğruysa iyzico'da eksik ürün/planları oluşturun. Aynı isimli mevcut
planlar çoğaltılmaz; tutar veya dönem uyuşmazsa işlem fail-closed durur:

```bash
corepack pnpm --filter @garsonless/dashboard billing:provision-provider -- --apply
```

Komutun verdiği secret olmayan plan referanslarını `.env.production` içindeki
karşılıklarına yazın. Son aşamaya kadar `SAAS_BILLING_ENABLED=false` bırakın.

## 3. Callback ve webhook

İyzico abonelik callback adresi:

```text
https://app.masabu.co/api/billing/iyzico/checkout/callback
```

İyzico panelinde **Ayarlar → Firma Ayarları → İşyeri Bildirimleri → Abonelik**
alanına şu webhook yazılır ve `X-IYZ-SIGNATURE-V3` özelliği hesapta açılır:

```text
https://app.masabu.co/api/billing/iyzico/webhook
```

## 4. Fail-closed doğrulama

Canlı planları değiştirmeden, production dosyasındaki altı referansı iyzico'dan
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

İki komut da geçmeden `SAAS_BILLING_ENABLED=true` olan sürüm yayına alınmaz.
