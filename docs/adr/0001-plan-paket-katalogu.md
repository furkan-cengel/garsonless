# ADR-0001 — Plan, Paket Kataloğu ve Pro Denemesi

- **Durum:** Kabul edildi (2026-08-26)
- **Karar sahibi:** Ürün sahibi (Furkan)
- **İlgili kod:** `packages/domain/src/entitlements.ts` (canonical katalog)

## Bağlam

Masabu'nun ana müşterisi 10–50 masalı bağımsız restoranlardır. Paketler ürün
değeri üzerinden ayrışmalı; ürün, kategori, masa veya ekip sayısını yapay
kotalarla sınırlamamalıdır. Pazarlama, dashboard ve ödeme altyapısı aynı kapalı
plan ve fiyat sözlüğünü kullanır.

## Karar

### Paket seti ve fiyatlar

Canonical sıra `starter → plus → pro → business` şeklindedir. Kalıcı ücretsiz
paket yoktur. Eski geliştirme verisi `free → starter`, `enterprise → business`
olarak taşınır; bilinmeyen plan yetki kontrolünde fail-closed davranır.

| Plan | Aylık, KDV hariç | Yıllık peşin, KDV hariç | Yıllık aylık karşılığı, KDV hariç |
|---|---:|---:|---:|
| Starter | ₺349 | ₺3.350,40 | ₺279,20 |
| Plus | ₺699 | ₺6.710,40 | ₺559,20 |
| Pro | ₺1.199 | ₺11.510,40 | ₺959,20 |
| Business | Özel teklif | Özel teklif | — |

Tutarlar TRY kuruş cinsinden `PLAN_PRICES` içinde saklanır. Yıllık tutar on iki
aylık fiyatın tam `%20` indirimlisidir.

### Feature matrisi

- Starter: QR menü, zengin ürün içeriği, çekirdek tema editörü, masa dizini ve
  masa bazlı tam QR Studio. Masa QR token'ı paket değişiminde korunur.
- Plus: Starter + personel siparişi, canlı masa,
  adisyon/tahsilat, temel analitik ve ekip yetkileri.
- Pro: Plus + misafir QR siparişi, servis çağrısı, KDS, hesap bölüşmeli ödeme,
  müşteri hesabı, CRM, sadakat, kampanya, gelişmiş analitik/bildirim ve gelişmiş
  tema bölümleri. İyzico online ödeme paket özelliği değil, ayrı add-on'dır.
- Business: Pro + organizasyon, ortak ekip ve birden fazla şubeye erişim.

Feature matrisi kümülatiftir. Genel `orders` yeteneği `staff_orders` ve
`guest_ordering` olarak ayrıdır. API, webhook, SSO, white-label, merkezi rapor
ve menü/fiyat senkronu çalışır bir ürün yüzeyi oluşmadan vaat edilmez.
`qr_studio` temel masa dizini ve kalıcı masa QR'ını; `table_management` ise
canlı masa, oturum ve adisyon operasyonlarını ifade eder.

### Kotalar ve add-on'lar

Ürün, kategori, masa ve ekip kotası yoktur. `multi_location` yalnız Business
özelliğidir. İyzico Online Ödeme yalnız Pro ile self-servis satın alınabilen,
aylık ₺300 + KDV veya yıllık peşin ₺2.880 + KDV fiyatlı ayrı add-on'dır; yıllık
fiyat on iki aylık tutarın tam `%20` indirimlisidir. Business kapsamındaki
online ödeme özel teklifte belirlenir. POS/ÖKC ve özel entegrasyonlar,
profesyonel kurulum/menü aktarımı ve fiziksel QR standları da add-on olabilir.
KDS, sadakat ve QR siparişi Plus add-on'u değildir.

### Deneme ve kilit

Yeni işletme kaydı, provider müşterisi gerektirmeyen 14 günlük Pro denemesini
aynı veritabanı transaction'ında oluşturur. Fiyat kartındaki Starter/Plus/Pro
seçimi niyet olarak saklanır; deneme erişimi Pro kalır. Pro denemesi ayrı
ticari ürün olan İyzico Online Ödeme add-on'unu otomatik etkinleştirmez.

Süre sonunda durum `trial_expired` olur. Public menü ve ürün/operasyon yazma
işlemleri kapanır; veri silinmez. Owner dashboard'da hesap, faturalama ve paket
seçimini görür. Başarılı checkout aynı aboneliği yeniden etkinleştirir.

### Business

Business self-servis satılmaz. Platform superadmin tarafından gerekçeli ve
audit'li biçimde etkinleştirilir. V1 kapsamı organizasyon üyeliği, ortak ekip
erişimi ve şube değiştiricidir; konsolide rapor ve merkezi menü senkronu yoktur.

## Sonuçlar

- Server action ve API kontrolleri UI kilitlerinden bağımsızdır.
- Owner paket dışı yüzeyleri fayda, gerekli paket ve yükseltme CTA'sıyla görür;
  ekip üyelerinde önce RBAC, sonra paket kontrolü çalışır.
- Paket/fiyat değişikliği domain kataloğu, provider referansları, migrasyon ve
  pazarlama sözleşme testlerini birlikte güncellemeyi gerektirir.
