# ADR-0002 — SaaS Abonelik Billing: İyzico (tek provider) + Dunning Politikası

- **Durum:** Kabul edildi (2026-07-21)
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

### Veri modeli

`billing_customers`, `subscription_invoices`, `subscription_payment_attempts`,
`billing_provider_events`, `billing_reconciliation_jobs`, `dunning_runs`.
Tümü service-role sınırında; anon/authenticated erişim yoktur. Dashboard
yalnız kendi tenant'ının fatura/durum projection'ını owner-gated okur.

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

### Fatura dönemi ve vade

- Faturalama dönemi **aylık**tır; vade, dönem başlangıç günüdür.
- Dönem/ücret değişikliği (upgrade/downgrade) bir sonraki dönemde etkinleşir;
  dönem ortası pro-rata v1'de yoktur (basitlik kararı — revize edilebilir).

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

## Sonuçlar

- Faz 5 implementasyonu bu ADR'deki tablo/kural setine birebir uyar.
- İyzico'nun abonelik API yüzeyi yetersiz kalırsa (ör. kayıtlı kart ile
  otomatik tekrar tahsilat kısıtları) karar şu şekilde esner: dönemsel
  "checkout linki + manuel ödeme" akışı port arkasında ilk sürüm olarak kabul
  edilir; otomatik tahsilat provider yeteneği doğrulandığında açılır. Bu
  esneme portu değiştirmez.
