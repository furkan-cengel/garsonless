# Paraşüt e-Fatura / e-Arşiv işletim kılavuzu

Bu entegrasyon, başarılı Masabu abonelik tahsilatını Paraşüt satış faturasına
dönüştürür; alıcının VKN/TCKN e-Fatura gelen kutusunu sorgular, uygun biçimde
e-Fatura veya e-Arşiv oluşturur, resmi belge PDF'ini indirir ve fatura e-postasına
ekler. Ödeme ve özellik aktivasyonu Paraşüt kesintisinden etkilenmez; mali belge
işi dayanıklı kuyrukta yeniden denenir.

İade ve iptal, kesilmiş mali belgeyi otomatik silmez. Mevcut sürüm bu olayları
`accounting_review_jobs` kuyruğuna alır; iade faturası / gider pusulası kararı
mali müşavir onayından sonra ayrı bir aşamada otomatikleştirilmelidir.

## Paraşüt hazırlığı

1. Paraşüt destekten API V4 için `CLIENT_ID`, `CLIENT_SECRET` ve kayıtlı
   `REDIRECT_URI` alınır.
2. Masabu abonelik hizmeti Paraşüt'te tek bir ürün olarak oluşturulur ve ürün ID'si
   `PARASUT_PRODUCT_ID` yapılır.
3. Şirket ID'si `PARASUT_COMPANY_ID` olarak kaydedilir.
4. KDV oranı ve `INVOICE_SERVICE_NAME` mali müşavir tarafından onaylanır.
5. Yetkilendirme adresi açılır:

   ```text
   https://api.parasut.com/oauth/authorize?client_id=CLIENT_ID&redirect_uri=REDIRECT_URI&response_type=code
   ```

6. Dönen tek kullanımlık code, geçici `PARASUT_AUTHORIZATION_CODE` secret'ına
   yazılır. Code veya token hiçbir zaman repoya eklenmez.

## DEV yetkilendirme ve doğrulama

`.env.local` Supabase DEV bilgilerini, `.env.sandbox` aşağıdaki Paraşüt ve belge
ayarlarını taşır:

```text
PARASUT_CLIENT_ID=
PARASUT_CLIENT_SECRET=
PARASUT_COMPANY_ID=
PARASUT_PRODUCT_ID=
PARASUT_REDIRECT_URI=urn:ietf:wg:oauth:2.0:oob
PARASUT_AUTHORIZATION_CODE=
PARASUT_API_BASE_URL=https://api.parasut.com
PARASUT_INTERNET_SALE_URL=https://sandbox.masabu.co
INVOICE_VAT_RATE=20
INVOICE_SERVICE_NAME=Masabu abonelik hizmeti
INVOICE_FROM_EMAIL=Masabu Fatura <fatura@masabu.co>
```

Yetkilendirme code'u bir kez değiştirip refresh token'ı DEV Vault'a yazın:

```bash
pnpm --filter @garsonless/dashboard accounting:configure-parasut:dev
```

Başarılı olduktan sonra `PARASUT_AUTHORIZATION_CODE` kaldırılır. Ürün ve şirket
erişimini hiçbir mali kayıt oluşturmadan doğrulayın:

```bash
pnpm --filter @garsonless/dashboard accounting:verify-parasut:dev
```

Paraşüt her access-token yenilemesinde refresh token'ı da değiştirir. Worker yeni
refresh token'ı tek lease altında Supabase Vault'a yazar; uygulama ortamında
kalıcı `PARASUT_REFRESH_TOKEN` tutmak gerekmez. Bu değişken yalnız önceden alınmış
bir token için tek seferlik geriye uyumlu bootstrap seçeneğidir.

## Dağıtım ve zamanlayıcı

Dashboard ortamında en az 32 karakterlik `ACCOUNTING_WORKER_SECRET` ve ilgili
Paraşüt/Resend değerleri bulunmalıdır. Supabase tarafındaki URL ve aynı secret şu
komutla Vault'a alınır; komut dakikalık cron'u da oluşturur:

```bash
ACCOUNTING_WORKER_URL=https://sandbox.masabu.co/api/internal/accounting-invoices \
pnpm --filter @garsonless/db configure:accounting-worker-vault:dev
```

Production için URL `https://app.masabu.co/api/internal/accounting-invoices`
olur. DEV ve production secret'ları farklıdır. `localhost` Supabase `pg_net`
tarafından erişilebilir olmadığı için yerel testte endpoint elle çağrılır; cron
yalnız erişilebilir HTTPS alan adı yapılandırıldıktan sonra açılır.

`ACCOUNTING_DISPATCH_ENABLED` varsayılan olarak `false` tutulur. Bu durumda cron
endpoint'e ulaşsa bile kuyruktan iş alınmaz. DEV kabul matrisinde bekleyen işlerin
sayısı ve ilk kesilecek test faturası onaylandıktan sonra yalnız ilgili dashboard
ortamında `true` yapılır. Production açılışı ayrıca onaylanır.

## Akış ve hata davranışı

1. Ödenmiş abonelik faturası tekil `subscription_invoice_id` ile kuyruğa girer.
2. Fatura profili eksikse iş `needs_profile` olur; eksiksiz adres kaydedilince
   yeniden kuyruğa alınır.
3. Worker müşteri, e-belge türü ve satış faturası kimliklerini ayrı checkpoint'ler.
4. Resmileştirme asenkron Paraşüt işi olarak takip edilir; süresi geçen task ID
   yerine satış faturasının `active_e_document` ilişkisi uzlaştırılır.
5. Geçici PDF URL'si müşteriye gönderilmez. PDF en fazla 10 MB olacak şekilde
   worker tarafından indirilir, `%PDF-` imzası doğrulanır ve e-postaya eklenir.
6. E-posta idempotency anahtarı aynı işin tekrarında mükerrer gönderimi engeller.
7. Tamamlanan iş `fiscal_document.ready` outbox olayını yalnız bir kez üretir.

Worker her cron çağrısında yalnız bir iş alır. Böylece yeni bir belgenin en kötü
durum çağrı sayısı Paraşüt'ün şirket başına 10 istek / 10 saniye sınırında kalır;
429 ve 5xx sonuçları backoff kuyruğuna döner.

## DEV kabul testi

- Bireysel/TCKN örneğinde e-Arşiv oluşmalı; internet satışı platformu `iyzico`
  ve ödeme tarihi gerçek `paid_at` günü olmalıdır.
- e-Fatura mükellefi VKN örneğinde e-Fatura oluşmalıdır.
- Paraşüt task `pending/running` iken ikinci satış faturası oluşmamalıdır.
- PDF 204 dönerse iş yeniden denenmeli, e-posta gönderilmemelidir.
- Fatura e-postası ulaştıktan sonra aynı worker tekrarında ikinci e-posta ve ikinci
  mali belge oluşmamalıdır.
- Eksik ilçe/adres/şehir profili Paraşüt'e gönderilmemeli; profil tamamlanınca iş
  kendiliğinden `pending` olmalıdır.
- Paraşüt 429/5xx kesintisinde abonelik aktif kalmalı ve iş retry durumuna dönmelidir.

Production'a geçmeden önce Paraşüt test şirketinde bu matris ve mali müşavir
tarafından belge görünümü, numaralandırma, KDV, hizmet adı ve iade belgesi politikası
onaylanır.
