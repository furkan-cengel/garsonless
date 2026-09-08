# Nilvera e-Fatura / e-Arşiv işletim kılavuzu

Bu entegrasyon, başarılı Masabu abonelik tahsilatını Nilvera üzerinden e-Fatura
veya e-Arşiv belgesine dönüştürür. Alıcının VKN/TCKN kaydı sorgulanır, uygun belge
türü seçilir, resmi PDF indirilir ve fatura e-postasına eklenir. Nilvera kesintisi
aboneliği veya özellik aktivasyonunu geri almaz; mali belge işi dayanıklı kuyrukta
yeniden denenir.

İade ve iptal kesilmiş mali belgeyi otomatik silmez. Bu olaylar
`accounting_review_jobs` kuyruğuna alınır; iade belgesi kararı mali müşavir
onayından sonra ayrı bir süreçte uygulanır.

## Yapılandırma

Nilvera portalında test ve production için ayrı, yalnız gerekli e-Fatura/e-Arşiv
okuma-yazma izinlerine sahip API anahtarları oluşturulur. Secret değerler repoya,
loglara veya kuyruk kayıtlarına yazılmaz.

```text
ACCOUNTING_PROVIDER=nilvera
ACCOUNTING_DISPATCH_ENABLED=false
NILVERA_API_BASE_URL=https://apitest.nilvera.com
NILVERA_API_KEY=
NILVERA_SELLER_TAX_NUMBER=1234567801
NILVERA_EINVOICE_SERIES=FAV
NILVERA_EARCHIVE_SERIES=EAT
NILVERA_INTERNET_SALE_URL=https://masabu.co
INVOICE_VAT_RATE=20
INVOICE_SERVICE_NAME=Masabu abonelik hizmeti
INVOICE_FROM_EMAIL=Masabu Fatura <fatura@masabu.co>
```

Production ortamında API adresi `https://api.nilvera.com` olmalı; test anahtarı,
test vergi numarası ve test serileri production'a taşınmamalıdır. KDV oranı,
hizmet açıklaması, seri seçimi ve belge görünümü mali müşavir tarafından
onaylanmadan dispatch açılmaz.

## Sandbox doğrulaması

Canlı anahtar, şirket VKN'si ve iki seri production ortamına eklendikten sonra
belge oluşturmadan şirket/seri erişimini doğrulayın:

```bash
pnpm --filter @garsonless/dashboard accounting:verify-nilvera:live
```

Bu kontrol yalnız şirket ve seri bilgilerini okur; tahsilat, fatura veya e-posta
oluşturmaz. Komutun hedefi ile API adresi eşleşmezse istek gönderilmeden durur.
Başarılı olması dispatch'i kendiliğinden açmaz.

Şirket ve aktif seri erişimini hiçbir belge oluşturmadan doğrulayın:

```bash
pnpm --filter @garsonless/dashboard accounting:verify-nilvera:sandbox
```

e-Fatura ve e-Arşiv modellerini yalnız preview endpoint'inde doğrulayın:

```bash
pnpm --filter @garsonless/dashboard accounting:preview-nilvera:sandbox
```

Belge oluşturan smoke komutları `--apply` kapısı arkasındadır. Kuru çalıştırma
sonucunu kontrol etmeden `:apply` komutları çalıştırılmaz:

```bash
pnpm --filter @garsonless/dashboard accounting:smoke-nilvera-einvoice:sandbox
pnpm --filter @garsonless/dashboard accounting:smoke-nilvera-einvoice:sandbox:apply
pnpm --filter @garsonless/dashboard accounting:smoke-nilvera-earchive:sandbox
pnpm --filter @garsonless/dashboard accounting:smoke-nilvera-earchive:sandbox:apply
```

## Worker ve zamanlayıcı

Dashboard ortamında en az 32 karakterlik `ACCOUNTING_WORKER_SECRET` bulunur.
Supabase Vault'taki worker URL ve aynı secret aşağıdaki komutla yapılandırılır;
komut dakikalık accounting cron'unu da etkinleştirir:

```bash
ACCOUNTING_WORKER_URL=https://sandbox.masabu.co/api/internal/accounting-invoices \
pnpm --filter @garsonless/db configure:accounting-worker-vault:dev
```

Production URL'si `https://app.masabu.co/api/internal/accounting-invoices` olur.
DEV ve production worker secret'ları farklıdır. `ACCOUNTING_DISPATCH_ENABLED=false`
iken endpoint çağrılsa bile kuyruktan iş alınmaz. DEV ve production açılışları
ayrı operatör onayı gerektirir.

## Akış ve hata davranışı

1. Ödenmiş abonelik faturası tekil `subscription_invoice_id` ile kuyruğa girer.
2. İlk claim işi `nilvera` sağlayıcısına kalıcı olarak bağlar.
3. Worker alıcıyı doğrular ve e-Fatura mükellefiyetine göre belge türünü seçer.
4. İş UUID'si Nilvera belge UUID'si olarak kullanılır; conflict yanıtı aynı belgeye
   güvenli yeniden giriş olarak ele alınır.
5. Nilvera belge durumu asenkron takip edilir; `waiting` sonucu backoff kuyruğuna
   döner ve ikinci belge oluşturmaz.
6. PDF en fazla 10 MB olacak şekilde indirilir, `%PDF-` imzası doğrulanır ve
   e-postaya eklenir.
7. E-posta idempotency anahtarı mükerrer gönderimi önler. Tamamlanan iş
   `fiscal_document.ready` olayını yalnız bir kez üretir.

Worker ilk yayında her çağrıda yalnız bir iş alır. 408, 425, 429 ve 5xx yanıtları
yeniden denenebilir; kalıcı 4xx veya geçersiz mali profil fail-closed davranır.

## Kabul matrisi

- e-Fatura mükellefi VKN için e-Fatura oluşturulur ve PDF açılır.
- e-Fatura mükellefi olmayan kimlik için internet e-Arşiv oluşturulur; ödeme
  aracısı `iyzico`, ödeme tarihi gerçek `paid_at` değeridir.
- Nilvera görevi `waiting` iken aynı UUID ile ikinci belge oluşmaz.
- PDF hazır değilse e-posta gönderilmez ve iş yeniden denenir.
- E-posta ulaştıktan sonra worker tekrarı ikinci belge veya ikinci e-posta üretmez.
- Eksik adres/ilçe/şehir/vergi profili Nilvera'ya gönderilmez.
- Nilvera geçici kesintisi aboneliği geri almaz.
- e-Arşiv GİB rapor durumu ertesi gün kontrol edilir ve mali müşavir tarafından
  numaralandırma, KDV, hizmet adı ve iade politikası onaylanır.
