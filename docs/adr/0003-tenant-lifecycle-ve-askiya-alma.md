# ADR-0003 — Tenant Lifecycle, Askıya Alma Davranışı ve Veri Saklama

- **Durum:** Revize edildi (2026-08-14)
- **Karar sahibi:** Ürün sahibi (Furkan)
- **Bağımlılık:** ADR-0001 (trial/paketler), ADR-0002 (dunning)

## Bağlam

Ödeme durumu tenant'ın tüm yüzeylerini (public menü, sipariş, KDS, dashboard)
etkiler. "Askıdaki tenant ne görür/ne yapabilir" sorusu güvenlik ve para
dürüstlüğü açısından koddan önce kilitlenmelidir.

## Karar

### Abonelik state makinesi

`trial → trial_expired` veya `trial → active → past_due → grace_period →
suspended → cancelled` + platform admin'e özel `manual_hold`.

- `trial`: Provider müşterisi gerektirmeyen 14 gün Pro yetenekleri (ADR-0001).
- `trial_expired`: Ödeme yapılmadan deneme süresi dolmuştur. Tenant kilitlidir;
  menü ve veriler korunur, owner faturalama/paket seçimine devam eder.
- `past_due`: vade geçti, retry/dunning sürüyor; **tam erişim** devam eder,
  belirgin billing uyarıları görünür.
- `grace_period`: son uyarı penceresi; tam erişim + susturulamaz uyarılar.
- `suspended`: dunning'in +14. günü otomatik veya admin kararıyla.
- `cancelled`: tenant'ın kendi iptali veya kalıcı kapatma.
- `manual_hold`: yalnız platform admin; dolandırıcılık/anlaşmazlık gibi
  durumlar için, dunning zamanlayıcısından bağımsız.
- State geçişleri `tenant_lifecycle_events` tablosuna aktör + gerekçe +
  request ID ile yazılır; başarılı ödeme **atomik** `active` dönüşü yapar.

### `suspended` davranış matrisi

| Yüzey | Davranış |
|---|---|
| Public menü (QR) | Sipariş kapalı; "Hizmet geçici olarak duraklatıldı" ekranı. Veri sızdırmaz, tenant'ı utandıran ödeme detayı göstermez. |
| Yeni QR siparişi | Reddedilir (server-side `requireTenantActive`; UI'a güvenilmez). |
| Kitchen (KDS) | Yeni iş kabul etmez; mevcut açık siparişler görünür kalır. |
| Dashboard | `trial_expired` için yalnız hesap/faturalama ve paket seçimi; dunning suspend için mevcut retention politikası. |
| Açık siparişler | Veri kaybetmeden kapatılabilir: suspend anındaki açık adisyonlar için tahsilat/kapatma akışı ÇALIŞIR (para dürüstlüğü > ceza). Yalnız YENİ sipariş engellenir. |
| Realtime/outbox | Consumer'lar çalışmaya devam eder; veri bütünlüğü bozulmaz. |

### Reaktivasyon

Ödeme geldiğinde: `active`'e atomik dönüş → erişimler açılır → "Hizmetiniz
yeniden etkinleştirildi" bildirimi (Faz 4 altyapısından). Manuel adım
gerektirmez.

### Veri saklama / iptal sonrası retention

Aşağıdakiler ayarlanabilir platform politikasıdır; varsayılanlar:

- `cancelled` sonrası **90 gün dondurulmuş saklama**: veri silinmez, tenant
  yeniden abone olursa kaldığı yerden devam eder; bu sürede veri export
  talebi karşılanır.
- 90 gün sonunda: müşteri PII'ı (telefon/e-posta/isim) anonimleştirilir;
  operasyonel kayıtlar (sipariş toplamları, raporlar) anonim olarak kalabilir.
- Fatura/muhasebe kayıtları (subscription_invoices ve provider event'leri)
  TR mevzuatı (VUK) gereği **10 yıl** saklanır; retention silmesinden muaftır.
- KVKK veri silme talebi geldiğinde 90 günlük pencere beklenmez; kontrollü
  silme operasyonu platform admin ekranından, gerekçeli ve audit'li yürütülür
  (ADR-0004).

## Sonuçlar

- `requireTenantActive(context)` tüm sipariş-yazan public yüzeylerde server
  tarafında zorunludur; Faz 7 regresyon turu suspend matrisini uçtan uca test
  eder.
- Suspend bir "kill switch" değildir: veri ve açık para akışları korunur,
  yalnız yeni değer üretimi durur.
