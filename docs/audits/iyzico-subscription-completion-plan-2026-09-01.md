# İyzico SaaS Abonelik Sistemi — Audit ve Tamamlama Ana Planı

**Tarih:** 2026-09-01
**Durum:** Faz 1–6 DEV uygulaması tamamlandı; gerçek sandbox matrisi ve PROD aktivasyonu bloke
**Kapsam:** Masabu'nun restoranlara sattığı SaaS aboneliği. Restoran müşterilerinin sipariş ödemeleri bu planın dışında ve ayrı credential/ledger sınırında kalır.

## 1. Yönetici özeti

Proje sıfırdan başlamıyor. Plan kataloğu, KDV dahil provider tutar doğrulaması,
hosted checkout, imzalı webhook, atomik ödeme sonucu, dunning, entitlement,
fatura kuyruğu, dashboard billing ekranı ve bildirim altyapısının önemli bir
bölümü mevcut. Bu audit sonrasında Faz 1–6 DEV'e uygulanmıştır; production ve
gerçek sandbox zaman çevrimi kapıları hâlâ kapalıdır.

Canlıya çıkışı engelleyen ana bulgular:

1. Checkout payment-evidence yarışı ve unpaid-access açığı DEV'de kapatıldı;
   production migration/deploy/canary henüz yapılmadı.
2. Renewal hydration, D-3 ve gerçek invoice üzerinde dunning DEV'de tamamlandı;
   iki ardışık gerçek veya hızlandırılmış sandbox renewal çevrimi hâlâ bekliyor.
3. Same-interval upgrade/downgrade ledger'ı, paid-renewal convergence, açık
   adisyon drain'i, hosted kart güncelleme, dönem sonu iptal/undo ve SaaS
   abonelik iadesi DEV'de tamamlandı. Aylık↔yıllık dönem değişikliği politikası
   ve gerçek provider matrisi hâlâ açık.
4. İyzico Online Ödeme ve Video Hero add-on'ları canonical katalog, birleşik
   provider planı, exact DEV katalog binding'i ve paid-renewal entitlement
   lifecycle'ında birleştirildi. PROD katalog ve canlı provider ref'leri açık.
5. Add-on add/remove owner change request'i üzerinden `NEXT_PERIOD` çalışıyor;
   provider kabulü erişim açmıyor, yalnız doğrulanmış renewal payment evidence
   entitlement'ı atomik açıp kapatıyor.
6. Bildirim altyapısı ödeme, D-3, trial D-7/D-3/D-1/expiry, consent'e bağlı
   onboarding 24/72 saat, plan/add-on değişimi, kart güncelleme, iptal, iade ve
   mali belge olaylarını owner inbox/e-posta receipt hattında taşıyor. Resend
   bounce/complaint projection'ı DEV'de testli; gerçek sağlayıcı teslimatı Faz 7'de.
7. PROD'a hiçbir yeni migration uygulanmadı. Release zinciri artık
   `20260901010000`–`20260901123000` aralığını kapsıyor. Billing açılmadan önce
   backup/dry-run/deploy/canary uygulanmalı. `SAAS_BILLING_ENABLED=false`; canlı
   provider plan referansları da ayrıca doğrulanmalı.

**Sonuç:** Temel mimari iyi ve testli; fakat billing şu anda production-ready
değil. Aşağıdaki fazlar tamamlanmadan `SAAS_BILLING_ENABLED=true` yapılmamalı.

## 2. Audit kanıtları

### 2.1 Repo ve çalışma ağacı

- Canonical planlar: `starter`, `plus`, `pro`, `business`.
- Self-service provider planları: Starter/Plus/Pro × aylık/yıllık = 6 plan.
- İyzico Online Ödeme: Pro/Business üzerinde ayrı ücretli entitlement.
- 14 günlük Pro trial local oluşturuluyor; provider kartı gerektirmiyor.
- Çalışma ağacında billing ve entitlement ile ilgili henüz commitlenmemiş kullanıcı
  değişiklikleri var. Bu plan bunları silmez veya yeniden yazmaz; uygulama sırasında
  her dilim mevcut diff'e karşı ayrıca incelenir.

### 2.2 Doğrulanan test durumu

| Kanıt | Sonuç |
|---|---:|
| Domain tam test paketi | 75/75 PASS |
| Application tam test paketi | 250/250 PASS |
| DB migration/port tam test paketi | 553/553 PASS |
| Dashboard architecture tam test paketi | 810/810 PASS |
| Platform admin architecture | 18/18 PASS |
| Domain/application/DB/dashboard/platform-admin typecheck | PASS |
| DEV migration durumu | Pending yok |
| PROD migration durumu | `20260901010000`–`20260901123000` release bundle pending; uygulanmadı |
| İyzico sandbox subscription erişimi | PASS; 1 ürün görünür |
| Sandbox temel + add-on plan fiyat/dönem doğrulaması | 12/12 PASS |
| Sandbox hosted checkout initialize | Starter/aylık PASS |

Bu testler mevcut kod sözleşmelerini doğrular; aşağıdaki eksik senaryoların
uygulandığını kanıtlamaz.

### 2.3 Resmi iyzico kabiliyetleri

Güncel resmi dokümana göre:

- Subscription checkout ACTIVE veya PENDING başlayabilir. Trialsız ACTIVE
  başlangıçta plan ödemesi alınır; PENDING veya trial'lı ACTIVE durumda yalnız
  kart validasyonu yapılabilir.
- Başarısız recurring ödeme `orderReferenceCode` ile retry edilebilir; retry
  kabulü kesin ödeme başarısı değildir, yeni işlem sonucu webhook ile gelir.
- Plan upgrade API'si yalnız aynı ürün ve aynı ödeme aralığı/count içindeki
  planlar arasında çalışır; `NOW` veya `NEXT_PERIOD` destekler.
- Cancel API'si aktif aboneliği anlık iptal eder. Dönem sonu iptal lokal scheduler
  ile vade anında provider cancel'a çevrilmelidir.
- Kart güncelleme hosted checkout formu üzerinden yapılır ve provider 1 TL
  validasyon/otomatik iade uygulayabilir.
- Subscription webhook başarı ve başarısızlık olaylarını taşır; V3 imza alan
  sırası mevcut verifier ile uyumludur. İyzico yalnız sınırlı sayıda tekrar
  gönderdiği için 2xx öncesinde olayın durable inbox'a yazılması zorunludur.
- Genel refund/cancel API'leri ödeme kimliği üzerinden tam/kısmi iade sağlar;
  refund abonelik statüsünü kendiliğinden değiştiren bir ticari politika değildir.

Resmi kaynaklar:

- https://docs.iyzico.com/en/products/subscription/subscription-implementation/subscription-transactions
- https://docs.iyzico.com/en/advanced/webhook
- https://docs.iyzico.com/en/advanced/refund-and-cancel
- https://docs.iyzico.com/en/add-ons/test-cards

## 3. Mevcut durum değerlendirmesi

| Alan | Durum | Audit notu |
|---|---|---|
| Plan/fiyat kataloğu | Güçlü | Net fiyat + KDV + provider gross parity var. |
| Secret/tenant ödeme ayrımı | Güçlü | SaaS billing credential'ları sipariş POS credential'larından ayrı. |
| Hosted checkout güvenliği | Güçlü/eksik | Sandbox iframe, CSP, token hash var; sonuç otoritesi yeniden tasarlanmalı. |
| Webhook doğrulama | Güçlü | V3 imza, body limiti, idempotent provider event inbox var. |
| İlk ödeme | DEV tamam | Authenticated evidence exact invoice'ı paid yapmadan erişim açılmıyor. |
| Yenileme | DEV tamam/dış kanıt açık | Yeni order exact plan/tutar/dönem ile hydrate ediliyor; gerçek iki sandbox çevrimi bekliyor. |
| Dunning | DEV tamam | D-3 ve hydrated failure üzerinde retry/+3/+7/+14 idempotent. |
| Retry | DEV tamam | Provider accepted sonucu başarı sayılmıyor; kart güncelleme ve explicit retry ayrı. |
| İptal | DEV tamam | Owner default dönem-sonu request/undo/due scheduler; provider belirsizliği reconciliation. |
| Upgrade/downgrade | DEV tamam | Same-interval NEXT_PERIOD ledger, provider lineage ve paid convergence var. |
| Interval değişimi | Eksik | İyzico upgrade kısıtı için ürün politikası ve akış yok. |
| Add-on satın alma | DEV tamam | İlk checkout ve mid-cycle add/remove canonical combined-plan binding kullanıyor. |
| Add-on entitlement | DEV tamam | Yalnız exact paid invoice ile açılıyor; removal paid next-period'da uygulanıyor. |
| Video Hero add-on | DEV tamam | Starter/Plus provider planı, DB katalog, owner UI ve public theme gate aynı sözleşmede. |
| Refund | DEV tamam/dış kanıt açık | Exact paymentId, full/partial limit, provider adapter, finance UI ve accounting review testli; gerçek sandbox hareketi bekliyor. |
| Entitlement gating | Güçlü/riski var | Server-side gate yaygın; eski RPC uyumluluk fallback'i Pro'ya online ödeme grant ediyor. |
| Bildirim/e-posta | DEV tamam | Trial/onboarding/billing/refund/fiscal vocabulary, receipt, dedupe, dead-letter ve Resend outcome health testli. |
| Mali belge | DEV tamam/dış kanıt açık | Paid invoice → Paraşüt/PDF mail receipt + fiscal ready; refund accounting review var, gerçek Paraşüt/Resend uçtan uca bekliyor. |
| Reconciliation | Kısmi | Belirsizlik görünür yapılıyor; provider'dan veri çekip convergence yapan hydrator yok. |
| Operasyon ekranı | Güçlü | Owner billing/cancel/refund durumları ve finance/superadmin refund/reconciliation timeline'ı mevcut. |

## 4. Değişmez sistem kuralları

Uygulamanın tüm fazları aşağıdaki kurallara uymalı:

1. **Browser sonucu para otoritesi değildir.** Callback yalnız işlemi tetikler.
2. Ödeme otoritesi tek bir `provider payment evidence` katmanıdır. Kanıt kaynağı
   imzalı webhook veya Masabu sunucusunun authenticated iyzico retrieve/search
   cevabı olabilir; ikisi de aynı idempotent atomik transition'a girer.
3. Subscription `active`, invoice `paid`, payment attempt `succeeded`, plan/add-on
   entitlement ve outbox olayları tek transaction'da converge eder.
4. Retry/upgrade/cancel/refund çağrısı provider'a gitmeden durable outbound
   operation claim edilir. Timeout veya lokal finalize hatası “başarı” değildir.
5. Provider referansı, plan ref'i, dönem, currency ve expected gross amount
   uyuşmadan erişim açılmaz.
6. Webhook sıradan çıkabilir ve tekrar gelebilir. İlk geçerli başarı kazanır;
   sonraki failure paid invoice'ı geriye götüremez.
7. Add-on entitlement yalnız ilgili ödeme kanıtı başarılı olduktan sonra açılır;
   add-on removal yalnız planlanmış effective time'da kapanır.
8. Refund kendi finansal ledger'ına yazılır; subscription erişimini dolaylı ve
   belirsiz biçimde değiştirmez.
9. UI kilidi güvenlik sınırı değildir. Dashboard, menu API, KDS ve worker
   mutation'ları aynı DB entitlement/lifecycle context'ini kullanır.
10. Para değerleri integer TRY minor unit; provider'dan gelen serbest tutarla
    local katalog fiyatı overwrite edilmez.
11. Her müşteri iletişimi outbox + receipt + dedupe ile gönderilir; mutation
    request'i içinden doğrudan mail atılmaz.
12. Billing ve mali kayıtlar soft-delete/tenant deletion'dan korunur; PII ve
    retention ayrı politika ile yönetilir.

## 5. Hedef veri modeli

Mevcut tablolar korunur ve aşağıdaki yapılar eklenir/genellenir.

### 5.1 Provider fiyat kataloğu

`billing_provider_prices`

- `catalog_version`
- `plan`
- `billing_interval`
- `add_ons` — sıralanmış canonical array
- `net_amount_minor`, `vat_rate`, `gross_amount_minor`, `currency`
- `provider`, `provider_product_ref`, `provider_plan_ref`
- `status = draft|active|retired`
- `valid_from`, `valid_to`
- unique: provider + catalog version + plan + interval + add-on fingerprint

Amaç: env değişkenlerinin Starter/Plus/Pro ve her add-on kombinasyonuyla
patlamasını önlemek; geçmiş invoice'ın hangi katalog versiyonuyla oluştuğunu
korumak. Secret'lar env/vault'ta kalır, referans ve fiyat sözleşmesi DB'de olur.

### 5.2 Subscription change request

`subscription_change_requests`

- before/after plan, interval ve add-on snapshot
- `change_kind = upgrade|downgrade|interval_change|add_on_add|add_on_remove`
- `effective_mode = now|next_period`
- `effective_at`
- `status = requested|provider_pending|scheduled|applied|failed|cancelled|requires_reconciliation`
- provider operation, request id, actor, reason, legal acceptance ve audit refs

Bu tablo `billing_subscriptions.scheduled_plan` alanının tek başına taşıyamadığı
interval ve add-on değişikliklerini yönetir.

### 5.3 Renewal/provider order hydration

Mevcut `billing_provider_events` durable inbox olmaya devam eder. Ek olarak:

- event subscription'a eşleşti fakat invoice yoksa olay ACK edilebilir durable
  `needs_hydration` durumunda kalır;
- worker provider subscription/order detail araması yapar;
- exact `orderReferenceCode`, plan ref, dönem ve provider payment kimliklerini
  çözer;
- provider fiyat kataloğundan immutable invoice snapshot üretir;
- invoice ve event aynı kilit altında eşleştirilir;
- sonra mevcut success/failure atomik transition'ı çağrılır.

Hydration tahmin yapmaz. Birden fazla order, bilinmeyen plan ref'i, tutar farkı
veya dönem çakışması reconciliation + manual review üretir.

### 5.4 Card update

Kart güncelleme ayrı bir para ledger'ı açmaz; mevcut
`billing_provider_operations` içinde `card_update.initialize` operasyonudur:

- customer/subscription, provider hosted token, ayrı callback state hash'i, expiry
- `status = processing|awaiting_callback|succeeded|requires_reconciliation`
- raw callback state veya kart verisi saklanmaz
- checkout iframe/callback için initial checkout ile aynı CSP ve origin sınırı

Kart güncellendikten sonra gecikmiş invoice otomatik çekilmez; UI kullanıcıya
ayrı “ödemeyi tekrar dene” adımı gösterir. Ürün isterse başarılı card update
sonrası tek idempotent retry ayrıca planlanabilir.

### 5.5 Refund ledger

`subscription_refunds`

- subscription, invoice, payment attempt
- provider payment/transaction refs
- `amount_minor`, `reason_code`, açıklama
- `kind = same_day_cancel|refund`
- `scope = full|partial`
- `status = requested|processing|succeeded|failed|requires_reconciliation`
- provider refund ref, actor, request id ve accounting review ref

Toplam başarılı iade tutarı invoice paid tutarını geçemez. Aynı request id ile
farklı tutar/reason replay'i fail-closed olur.

## 6. Hedef state machine'ler

### 6.1 Checkout

`prepared → awaiting_customer → provider_confirmed → payment_evidence_pending → completed`

Alternatif terminal/inceleme durumları:

- `expired`
- `customer_incomplete`
- `requires_reconciliation`
- `failed`

`provider_confirmed` yalnız customer/subscription/order referanslarını bağlar.
`completed` invoice paid transition'ı tamamlandıktan sonra oluşur.

### 6.2 Subscription

Mevcut state seti korunur:

`trial → trial_expired` veya
`trial → active → past_due → grace_period → suspended → cancelled`

Ek kurallar:

- `cancel_scheduled` yeni subscription status olmak zorunda değildir;
  açık change/cancellation request projection'ı olarak tutulur.
- `manual_hold` ödeme ile otomatik açılmaz.
- `cancelled` terminal kalır; yeniden abonelik yeni provider subscription ref'i
  ve yeni local subscription generation ile yapılır.
- `past_due` ve `grace_period` boyunca mevcut özellikler açık kalır.
- `suspended/trial_expired/cancelled` yeni değer üretimini kapatır; açık
  adisyonların settlement/closure akışı devam eder.

### 6.3 Plan ve add-on değişimi

- Upgrade: sandbox kanıtı çıkana kadar güvenli default `NEXT_PERIOD`.
- Downgrade: her zaman `NEXT_PERIOD`; özellikler dönem sonuna kadar açık kalır.
- Add-on ekleme: aynı interval birleşik provider planına change request.
- Add-on çıkarma: `NEXT_PERIOD`; ödenmiş dönem sonuna kadar entitlement açık.
- Pro'dan aşağı downgrade varken Pro-only add-on removal aynı change request'in
  zorunlu parçasıdır.
- Açık table session/sipariş varsa downgrade effective time'da mevcut drain
  politikası çalışır; yeni sipariş kapanır, mevcut para akışı tamamlanır.
- Aylık↔yıllık değişim iyzico upgrade kısıtı nedeniyle ayrı sandbox spike
  sonucuna bağlıdır. Güvenli v1 fallback: dönem sonunda yeni checkout; eski
  subscription yeni ödeme güvenceye alınmadan iptal edilmez.

### 6.4 İptal

- Owner için varsayılan: dönem sonunda iptal.
- Owner dönem sonuna kadar iptal talebini geri alabilir.
- Provider cancel çağrısı effective time'da scheduler tarafından yapılır.
- Anlık iptal yalnız refund, chargeback/fraud, açık hukuki gereklilik veya
  yetkili support operasyonunda, reason + fresh auth + audit ile yapılır.
- Provider cancel başarılı olmadan lokal subscription `cancelled` yapılmaz;
  timeout `requires_reconciliation` olur.

### 6.5 Refund ve entitlement ilişkisi

- Kısmi goodwill refund: entitlement değişmez.
- Tam refund + dönem sonu iptal: access belirlenmiş effective time'a kadar sürer.
- Tam refund + anlık fesih: provider cancel ve refund iki ayrı durable operation;
  ikisi de reconcile edilir, erişim ürün sahibinin onaylı politikasına göre
  atomik/kompanzasyonlu kapatılır.
- Refund başarısı accounting credit-note/review işi ve müşteri bildirimi üretir.
- Chargeback/dispute: otomatik cancel yerine `manual_hold` + platform review.
- İade süreleri, dijital hizmet cayma şartları ve e-belge düzeltme yöntemi
  hukukçu/muhasebeci onayı olmadan kod sabitine dönüştürülmez.

## 7. Senaryo kabul matrisi

| Senaryo | Beklenen sonuç |
|---|---|
| Trial oluşturma | Provider yok; Pro plan özellikleri, ücretli add-on kapalı. |
| Trial D-7/D-3/D-1 | Dedupe'lu lifecycle mail/in-app; fiyat ve CTA doğru. |
| Trial expire | Yeni mutation kapalı, veri korunur, billing erişimi açık. |
| İlk checkout başarı | Referans hydrate → invoice paid → plan/add-on atomik açılır. |
| İlk checkout failure | Plan açılmaz; güvenli hata, kart/yeniden checkout CTA. |
| Checkout abandon/expire | Access değişmez; pending projection süre sonunda temizlenir. |
| Duplicate callback/webhook | İkinci charge/state transition yok; duplicate sonucu. |
| Webhook callback'ten önce | Event durable bekler, mapping gelince aynı sonucu üretir. |
| Callback webhook'tan önce | Mapping oluşur, paid kanıtı gelene kadar access açılmaz. |
| Renewal success | Yeni order hydrate edilir, yeni invoice paid, dönem ilerler. |
| Renewal failure | Invoice past_due, dunning tek kez planlanır, access sürer. |
| Retry accepted | Paid sayılmaz; yeni webhook beklenir. |
| Retry success | Invoice paid, dunning stop, suspended ise reactivate. |
| Retry failure/out-of-order | Spam/duble run yok; paid invoice geriye gitmez. |
| Kart güncelleme | Kart verisi Masabu'ya gelmez; session audit'li; sonra retry ayrı. |
| Same-interval upgrade | Provider davranışı sandbox kanıtına göre NOW/NEXT_PERIOD; drift yok. |
| Downgrade | Dönem sonuna schedule; Pro özellikleri erken kapanmaz. |
| Interval change | Provider kısıtı aşılmaz; güvenli renewal checkout/transition. |
| Add-on ekleme | Provider payment kanıtı sonrası entitlement açılır. |
| Add-on çıkarma | Dönem sonuna kadar açık, effective time'da kapanır. |
| Pro→Plus + online payment add-on | Add-on zorunlu çıkar; online payment API server-side kapanır. |
| Dönem sonu iptal | O ana kadar erişim; provider cancel sonrası frozen retention. |
| İptal talebini geri alma | Provider cancel henüz gitmediyse request cancelled. |
| Anlık iptal | Fresh auth/reason/audit; provider/local convergence. |
| Kısmi refund | Refund ledger + mali belge; entitlement değişmez. |
| Tam refund | Onaylı cancellation policy uygulanır; double refund engellenir. |
| Provider timeout | Başarı gösterilmez; reconciliation + “tekrar denemeyin” mesajı. |
| Worker/mail arızası | Para transition'ı kalıcı; outbox retry/dead-letter görünür. |
| `manual_hold` sırasında ödeme | Invoice paid olabilir; tenant otomatik açılmaz. |

## 8. Bildirim ve mailing planı

Tüm billing/system bildirimleri owner-only ve susturulamaz olmalı. Pazarlama
onboarding/nurture mesajları ayrı consent ve unsubscribe politikasında kalmalı.

| Olay | In-app | E-posta | Zaman/CTA |
|---|---:|---:|---|
| `subscription.trial_started` | Evet | Evet | Hemen; kuruluma devam et |
| `onboarding.incomplete` | Opsiyonel | Consent'e bağlı | 24s/72s; kaldığın yerden devam |
| `subscription.trial_expiring_7/_3/_1` | Evet | Evet | Paket seç |
| `subscription.trial_expired` | Evet | Evet | Ödeme yap |
| `invoice.paid` | Evet | Evet | Fatura/plan özeti |
| `invoice.upcoming` | Evet | Evet | D-3; kart/fatura profilini kontrol et |
| `invoice.payment_failed` | Evet | Evet | Hemen; kart güncelle/tekrar dene |
| `billing.retry_requested` | Evet | Evet | Retry başlatıldı; sonuç bekleniyor |
| `billing.warning_3` | Evet | Evet | Kart güncelle |
| `billing.warning_7` | Evet | Evet | Son uyarı |
| `tenant.suspended` | Evet | Evet | Ödeme/kart güncelle |
| `tenant.reactivated` | Evet | Evet | Hizmet açıldı |
| `plan.change_scheduled` | Evet | Evet | Plan/add-on delta + effective date |
| `plan.changed` | Evet | Evet | Açılan/kapanan plan ve add-on özellikleri |
| `payment_method.updated` | Evet | Evet | Başarılı hosted update; kart detayı gösterme |
| `subscription.cancellation_scheduled` | Evet | Evet | Tarih + geri al |
| `subscription.cancellation_withdrawn` | Evet | Evet | İptal talebi geri alındı |
| `subscription.cancelled` | Evet | Evet | Retention/export/reactivate bilgisi |
| `refund.requested/succeeded/failed` | Evet | Evet | Tutar, invoice no, beklenen banka süreci |
| `fiscal_document.ready` | Evet | Evet | PDF/secure link; attachment maili tekrar gönderilmez |
| `billing.reconciliation_required` | Evet | Evet | Aynı işlemi tekrarlama, destek kodu |

Her event için:

- immutable `event_type + aggregate_id + semantic_version` dedupe key;
- template version, locale ve delivery outcome;
- subject/body snapshot değil mümkün olduğunca template + safe vars;
- VKN/TCKN, kart, provider secret/ref gibi bilgiler mailde yok;
- provider hata metni yerine allow-listed public code;
- notification dead-letter için platform admin alarmı.

## 9. Uygulama fazları

### Faz 0 — Karar ve ADR kilidi

1. ADR-0002'yi “webhook tek kanaldır” yerine “authenticated provider evidence
   tek otorite katmanıdır” şeklinde netleştir.
2. Upgrade NOW/NEXT_PERIOD davranışını sandbox bulgusuna bağla; kanıt çıkana kadar
   NEXT_PERIOD default'unu koru.
3. İptal default'u dönem sonu; refund/chargeback erişim politikalarını ürün +
   muhasebe + hukuk onayına bağla.
4. Video Hero'nun gerçekten satın alınabilir add-on olup olmayacağını ve hangi
   planlarda satılacağını katalog kararı olarak kilitle.

**Çıkış:** ADR, senaryo matrisi ve olay sözlüğü onaylı.

### Faz 1 — P0 checkout ve PROD safety

1. Checkout finalize RPC'sini ikiye ayır:
   - provider identity/order mapping;
   - payment evidence → atomic paid/active transition.
2. `restaurants.plan` ve subscription status'un invoice paid olmadan değişmesini
   engelleyen DB constraint/transition testleri ekle.
3. Add-on activation trigger'ını operation `succeeded` yerine ilgili invoice
   payment success transaction'ına taşı.
4. Checkout recovery'nin authenticated provider evidence'ını aynı payment
   transition'a sok; yalnız referans eşleştirmesiyle active gösterme.
5. PROD pending migration zincirini release bundle'a ekle; önce backup/dry-run,
   sonra deploy ve post-check.
6. Eski add-on entitlement RPC uyumluluk fallback'ini migration tamamlandıktan
   sonra kaldır; eski RPC'de Pro'ya ücretsiz online payment grant etme.

**Çıkış:** Callback/webhook yarışının her sıralaması aynı paid/entitlement
sonucunu verir; invoice open iken access açılmaz.

#### Faz 1 uygulama kaydı — 2026-09-01

- `20260901030000_subscription_checkout_payment_evidence.sql` DEV'e forward-only
  uygulandı; PROD'a uygulanmadı.
- Authenticated retrieve sonucu artık allow-listed synthetic provider event ile
  mevcut `record_subscription_payment_success_atomic` RPC'sine giriyor.
- Checkout operation `succeeded` geçişi exact invoice `paid` değilse DB trigger
  tarafından reddediliyor. Legacy `succeeded + open` satırlar otomatik paid
  yapılmıyor; `checkout-unpaid:*` reconciliation discrepancy üretiliyor.
- Add-on activation operation status trigger'ından çıkarıldı; deferred paid
  invoice trigger'ına taşındı. `manual_hold` ödeme kaydını kabul eder ancak
  add-on veya tenant access açmaz.
- Eski entitlement projection'ında Pro plana ücretsiz online-payment fallback'i
  kaldırıldı; version eksikse fail-closed.
- DEV runtime sonucu: early-webhook → retrieve, retrieve replay, tek paid
  invoice/attempt, subscription/restaurant/add-on activation ve reconciliation
  resolution PASS; fixture cleanup zero-orphan PASS.
- Otomatik test sonucu: application `225/225`, DB `503/503`, dashboard billing
  `45/45`; application/DB/dashboard typecheck PASS.
- Production release bundle artık sırasıyla `20260901010000`,
  `20260901020000`, `20260901030000` migration'larını içerir. Backup, exact
  pending-list dry-run, app deploy ve canary tamamlanmadan
  `SAAS_BILLING_ENABLED=true` yapılmayacaktır.

### Faz 2 — Renewal hydration ve gerçek dunning

1. Provider order detail/search adapter'ını ekle.
2. Eksik renewal invoice için hydration job/state ekle.
3. Provider price catalog snapshot'ından idempotent invoice üret.
4. Success/failure event'i hydrate edilmiş invoice'a uygula.
5. `current_period_start/end` yalnız başarılı dönem kanıtıyla ilerlesin.
6. D-3 upcoming reminder'ı subscription period end üzerinden schedule et.
7. Failure → +1 retry → +3 → +7 → +14 akışını gerçek renewal invoice ile test et.

**Çıkış:** İki ardışık gerçek sandbox renewal dönemi veya hızlandırılmış provider
planı ile success/failure/recovery kanıtı.

#### Faz 2 uygulama kaydı — 2026-09-01

- `20260901040000_subscription_renewal_invoice_hydration.sql` DEV'e uygulandı;
  PROD'a uygulanmadı.
- Subscription üzerinde provider plan reference pinlendi. Eski kayıtlarda
  yalnız başarılı checkout ledger kanıtından backfill yapılıyor; kanıtsız kayıt
  otomatik hydration'a alınmıyor.
- `provider_invoice_mapping_missing` reconciliation işleri ayrı leased hydration
  claim'iyle alınıyor. Worker exact customer/subscription/order referansını
  authenticated İyzico search ile okuyor; provider planı local configte plan,
  interval, add-on ve gross tutara çevrilmeden DB transition çağrılmıyor.
- Success ve failure renewal eventleri idempotent local invoice oluşturduktan
  sonra mevcut atomik payment RPC'lerine giriyor. Yalnız success subscription
  dönemini ilerletiyor; failure aynı dönemi koruyup tek dunning run başlatıyor.
- DEV runtime sonucu: eksik success invoice hydration + paid period advance,
  failure hydration + past_due/dunning, changed webhook replay rejection ve
  zero-orphan cleanup PASS.
- `20260901050000_subscription_upcoming_invoice_reminders.sql` DEV'e uygulandı;
  PROD'a uygulanmadı. Scheduler platform `pre_due_reminder_days` politikasını
  kullanıyor; yalnız aktif, provider'a bağlı, dönem sonunda iptal edilmeyecek
  abonelikleri pencere içinde seçiyor ve ödeme/invoice/access durumuna dokunmuyor.
- `invoice.upcoming` outbox olayı subscription + period-end + semantic-version
  anahtarıyla idempotent. In-app/e-posta delivery dedupe'u da period-end'i
  içerdiğinden aynı dönem replay'i spam üretmiyor, sonraki dönem bildirimi ise
  engellenmiyor. Olay owner-only, susturulamaz billing bildirimi olarak worker'ın
  fail-loud zorunlu consumer akışına bağlandı.
- DEV reminder runtime sonucu: ilk D-3 tick `1`, aynı tick replay `0`, tek outbox
  olayı, sıfır invoice/state mutation ve zero-orphan cleanup PASS.
- Renewal hydration runtime'ı aynı webhook'tan hydrate edilen `past_due`
  invoice üzerinde `retry → warning_3 → warning_7 → suspend` (+1/+3/+7/+14)
  zincirini tamamladı. Her mandatory event bir kez üretildi; lease replay'i ikinci
  suspend olayı yaratmadı ve fixture cleanup PASS.
- Test sonucu bu dilim sonunda application `229/229`, DB `511/511`, dashboard
  billing `47/47`; application/DB/dashboard typecheck PASS.
- Gerçek iki ardışık sandbox renewal dönemi henüz tamamlanmadı; D-3 scheduler
  kanıtı tamamlandı fakat Faz 2 production çıkış kriteri açık kalır.

### Faz 3 — Plan change ve kart güncelleme

1. `subscription_change_requests` ve outbound operation tiplerini ekle.
2. Provider `upgradeSubscription`, `getSubscription`, `searchSubscriptions`,
   `initializeCardUpdate` portlarını implemente et.
3. Owner UI: plan karşılaştırma, effective date, fiyat/özellik farkı, fresh auth
   gereken aksiyonlar ve pending state.
4. Same-interval upgrade/downgrade ve interval change fallback'ini uygula.
5. Kart güncelleme iframe/callback/recovery + ardından explicit retry CTA.
6. Scheduled downgrade için mevcut open-session drain testlerini billing change
   request'e bağla.

**Çıkış:** plan × interval değişim matrisi sandbox ve DB runtime testlerinde PASS.

#### Faz 3 uygulama kaydı — 2026-09-01

- `20260901060000_subscription_plan_change_ledger.sql`,
  `20260901061000_subscription_plan_change_ledger_hardening.sql`,
  `20260901070000_subscription_plan_change_renewal_convergence.sql` ve
  `20260901080000_subscription_card_update_hosted_flow.sql` migration'ları
  DEV'e forward-only uygulandı; PROD'a uygulanmadı.
- Same-interval plan değişikliği owner-gated ve durable
  `subscription_change_requests` + provider operation ledger'ından geçiyor.
  İyzico `NEXT_PERIOD` child subscription referansı mevcut parent ile exact
  eşleşmeden local schedule finalize edilmiyor. Aylık↔yıllık değişim ayrı
  checkout politikası netleşene kadar fail-closed.
- Upgrade/downgrade yalnız child renewal payment evidence başarılı olduğunda
  uygulanıyor. Provider lineage atomik current/retired dönüyor; retired parent
  webhook'u money state hydrate edemiyor. Downgrade sırasında açık adisyon varsa
  yeni ingress kapanıyor, mevcut settlement/closure sürüyor ve plan drain sonrası
  tek kez uygulanıyor.
- Owner billing UI aynı dönem plan/add-on karşılaştırması, effective-date
  açıklaması, pending projection ve downgrade drain uyarısını gösteriyor.
- Kart güncelleme İyzico'nun subscription-scoped hosted form endpoint'ini
  kullanıyor. Provider'ın 1 TRY validasyon/otomatik iade süreci Masabu para
  ledger'ına girmez. Owner action deterministic idempotency, hosted token ve
  ayrı SHA-256 callback-state binding ile çalışır; Masabu kart alanı almaz.
- Hosted callback başarıyı yalnız exact initialized token + state ile tamamlar,
  abonelik lineage drift'inde false success yerine reconciliation üretir.
  Başarılı replay tek `payment_method.updated` outbox olayı üretir; invoice,
  payment attempt, plan veya entitlement oluşturmaz. Kart update gecikmiş
  faturayı otomatik retry etmez; UI'daki “Tekrar dene” aksiyonu ayrıdır.
- DEV runtime kanıtı: plan schedule replay, provider lineage rotation, retired
  parent quarantine, paid upgrade, open-adisyon downgrade drain ve replay PASS.
  Kart update initialize replay, yanlış state, exact success replay, no-card/no-
  money invariantı ve lineage-drift reconciliation PASS; tüm fixture'lar silindi.
- Faz 2 regresyonu `20260901080000` sonrasında tekrar koştu: renewal hydration,
  D-3 replay `1 → 0`, dunning +1/+3/+7/+14, plan ledger ve convergence PASS.
- Faz 3 kapanış test sonucu: domain `74/74`, application `234/234`, DB `527/527`,
  dashboard architecture `807/807`; application/DB/dashboard typecheck PASS.
- Gerçek İyzico sandbox hosted kart gönderimi ve plan × interval provider matrisi
  Faz 7 kanıt paketinde hâlâ zorunludur.

### Faz 4 — Genellenmiş add-on lifecycle

1. Hardcoded add-on check constraint/RPC/UI yapılarını canonical katalog tabanlı
   modele geçir.
2. Online payment birleşik provider planlarını provisioning'e ekle ve sandbox'ta
   oluştur/doğrula.
3. Mid-cycle add/remove işlemlerini change request üzerinden yönet.
4. Plan bağımlılıklarını (`availableOn`) DB transition'da tekrar doğrula.
5. Online payment dashboard/menu API server gates ve webhook'larını add-on
   deactivation anında fail-closed test et.
6. Video Hero satılacaksa fiyat kataloğu/provider kombinasyonları ve entitlement
   activation aynı modelle eklenir; satılmayacaksa domain katalogdan çıkarılır.

**Çıkış:** plan+add-on kombinasyonları provider/local/feature parity testinde PASS.

#### 2026-09-01 Faz 4 DEV uygulama kaydı

- Domain `availableOn`, fiyat ve feature grant kataloğu checkout, plan change,
  provider adapter, provisioning ve UI tarafından ortak kullanılıyor. Bilinmeyen,
  duplicate veya planla uyumsuz seçimler application ve DB'de fail-closed.
- İyzico sandbox'ta 6 temel + 6 birleşik add-on planı idempotent provision edildi;
  ikinci provisioning yeni plan üretmedi. Ayrı read-only verifier fiyat, TRY,
  cadence, trial ve status sözleşmesini `12/12 PASS` doğruladı.
- DEV `subscription_add_on_catalog` altı exact plan/add-on/interval/ref/gross
  binding'iyle senkronlandı; tekrar çalıştırma `0 writes` verdi.
- `20260901090000_subscription_add_on_lifecycle.sql` canonical DB uyumluluğu,
  generic checkout/change/hydration ve paid application trigger'larını;
  `20260901091000_subscription_add_on_projection_hardening.sql` boş scheduled
  seçimde owner projection'ın SQL `NULL` olmasını engelleyen guard'ı ekledi.
- Owner UI Starter/Plus için Video Hero, Pro için İyzico Online Ödeme ilk checkout
  ve dönem sonu add/remove akışını gösteriyor. Aktif/planlanmış eklenti ve invoice
  snapshot'ları add-on adlarıyla görünür; in-app/e-posta metni plan + eklenti
  değişikliklerini kapsayan abonelik dili kullanıyor.
- Dashboard online payment aksiyonları ile menu payment/split API'leri
  `online_payments`; theme editor, public menu, table menu ve preview yüzeyleri
  `theme_video_hero` server entitlement'ına bağlı. Eski/stale projection erişim
  vermiyor.
- İzole DEV runtime: planlama öncesi özellik kapalı; add schedule erişim açmıyor;
  child renewal paid evidence Video Hero'yu tek kez açıyor; webhook replay yeni
  invoice/outbox üretmiyor; removal ödenmiş dönem boyunca erişimi koruyor ve
  sonraki paid renewal'da özelliği kapatıyor; uyumsuz Pro + Video Hero reddediliyor;
  fixture cleanup PASS.
- Faz 4 regresyon sonucu: domain `75/75`, application `234/234`, DB `533/533`,
  dashboard architecture `808/808`; dashboard/DB typecheck PASS. Workspace tam
  typecheck ayrıca aşağıdaki kapanış kapısında çalıştırılır.

### Faz 5 — İptal, refund ve accounting

1. Dönem sonu cancellation request + scheduler + undo akışı.
2. Anlık cancellation'ı ayrı yetkili operasyon olarak koru.
3. Provider payment/transaction kimliklerini renewal hydration'da sakla.
4. Full/partial refund operation ledger ve idempotent provider adapter.
5. Refund toplam limiti, paid-before-refund ve out-of-order response testleri.
6. Paraşüt için credit note/accounting review işini kesinleştir; PDF/mail
   teslimatını refund sonucu ile bağla.
7. Platform admin refund/reconciliation görünümü; tenant owner salt-okunur durum.

**Çıkış:** same-day cancel, partial refund, full refund ve provider timeout
senaryoları sandbox + accounting test-double ile PASS.

#### 2026-09-01 Faz 5 DEV uygulama kaydı

- `20260901100000_subscription_period_end_cancellation.sql` owner'ın varsayılan
  dönem-sonu iptal talebini, due scheduler lease'ini ve provider çağrısından
  önce geri alma akışını ekledi. D-3 yenileme bildirimi iptal planlandığında
  bastırılıyor; provider sonucu belirsizse erişim false-success ile kapanmıyor,
  reconciliation'a alınıyor.
- Checkout ve renewal authenticated order evidence'ından başarılı
  `paymentId` saklanıyor. Başarılı ödeme bu kimlik olmadan fail-closed; invoice,
  payment attempt ve provider payment kimliği refund öncesi exact eşleşiyor.
- `20260901110000_subscription_refund_ledger.sql` full/partial ve aynı-gün tam
  iptal ledger'ını ekledi. Toplam requested/processing/succeeded/reconciliation
  rezervasyonu paid tutarı aşamıyor; aynı request farklı niyetle replay edilirse
  reddediliyor; definitive failure limiti bırakırken timeout rezervasyonu
  karantinada tutuyor ve yeniden provider dispatch yapmıyor.
- Finance/superadmin aksiyonu AAL2 + `billing.manage` ile korunuyor ve request id
  sunucuda üretiliyor. İyzico Refund V2 sonucu paymentId/tutar/TRY/conversationId
  ve HMAC imzası exact doğrulanıyor. Same-day cancel yalnız İstanbul takvim
  gününde tam tutara izin veriyor. Refund entitlement veya subscription state'i
  değiştirmiyor.
- Başarılı refund `accounting_review_jobs(refund_reported)` ve owner-only
  `refund.requested/succeeded/failed` olaylarını atomik üretiyor. Owner güvenli
  refund geçmişini görür; provider kimliği ve internal reason sızdırılmaz.
- DEV runtime: partial request/replay/completion, definitive rejection sonrası
  yeniden kullanılabilir limit, late success reddi, timeout quarantine/no-
  redispatch, same-day full-only ve zero-orphan cleanup PASS. Gerçek İyzico
  sandbox para hareketi Faz 7 kanıt paketinde açık kalır.

### Faz 6 — Mailing ve lifecycle iletişimi

1. Olay sözlüğünü genişlet; outbox allowlist/consumer/template/testlerini birlikte
   güncelle.
2. Trial ve onboarding scheduler'larını transactional dedupe ile ekle.
3. Change/add-on/card/cancel/refund/fiscal document şablonlarını ekle.
4. Resend delivery webhook ve bounce/complaint görünürlüğünü billing health'e bağla.
5. Zorunlu billing mail consumer yoksa event ACK edilmemesi davranışını koru.

**Çıkış:** her olay için in-app/e-mail recipient, dedupe, retry ve dead-letter testi.

#### 2026-09-01 Faz 6 DEV uygulama kaydı

- `20260901120000_subscription_lifecycle_notifications.sql`, tenant-scoped
  doğrulama için `20260901121000`, inbox kategori uyumu için `20260901122000`
  ve consumer-specific health routing için `20260901123000` DEV'e uygulandı;
  PROD'a uygulanmadı.
- Trial başlangıcı transaction trigger'ıyla, D-7/D-3/D-1 ve expiry olayları
  bounded/skip-locked maintenance scheduler'ıyla üretiliyor. Expiry yalnız
  `trial → trial_expired` ve canonical baseline projection yapıyor; invoice veya
  payment evidence oluşturmuyor.
- Tamamlanmamış onboarding 24/72 saat occurrence'ları `lifecycle` kategorisinde
  owner-only in-app gönderiliyor. E-posta varsayılan kapalı ve kullanıcı opt-in
  tercihi olmadan gönderilmiyor; billing/system zorunlu kanal kuralı değişmedi.
- Trial, iptal, plan/add-on, kart, dunning, refund ve fiscal document olayları
  aynı template/receipt/dedupe/dead-letter consumer sözleşmesinde. Mali belge
  attachment e-postasının Resend message id'si accounting tamamlanmadan durable
  delivery satırına yazılıyor; `fiscal_document.ready` fan-out'u aynı dedupe
  anahtarını gördüğü için ikinci e-posta göndermiyor.
- İmzalı `/api/webhooks/resend` route'u campaign ve transactional notification
  delivery'lerini birlikte project ediyor. Bounce/complaint/suppressed/failed
  sonucu raw payload saklamadan delivery health'e yansıyor; webhook replay tek
  provider-event satırında kalıyor. Health RPC'si her olayı yalnız worker'ın
  gerçekten route ettiği consumer için sayıyor; lifecycle/billing olayları
  web-push kanalında sahte pending/dead-letter üretmiyor.
- DEV runtime: onboarding 24/72, trial D-7/D-3/D-1/expiry, owner inbox/e-posta
  receipt replay, onboarding consent, Resend bounce health ve fiscal no-duplicate
  senaryoları art arda iki tam çalıştırmada PASS; fixture cleanup PASS. Generic
  consumer testleri provider retry bütçesi ve dead-letter terminal receipt
  davranışını doğruluyor.

### Faz 7 — Sandbox tam matrisi

1. Sabit HTTPS sandbox callback/webhook origin'i kur; localhost webhook olarak
   kullanılmaz.
2. Temel 6 plan + desteklenen birleşik add-on planlarını provision/verify et.
3. Resmi success ve error-generator kartlarıyla testleri çalıştır.
4. Callback/webhook sırası, duplicate, delayed webhook, timeout ve local finalize
   failure'ı fault injection ile doğrula.
5. Initial success/failure, renewal success/failure, retry, card update,
   upgrade/downgrade, add-on add/remove, cancel, refund senaryolarını çalıştır.
6. Her test için provider refs, local state, lifecycle event, outbox receipt,
   mail delivery ve entitlement sonucunu PII'sız evidence artifact'ına yaz.
7. Test subscription/customer'larını cleanup scriptiyle iptal et; cleanup sonucu
   ayrıca PASS olmalı.

**Çıkış:** aşağıdaki production readiness checklist'in tamamı yeşil.

#### 2026-09-01 Faz 7 preflight kaydı

- Sandbox subscription capability erişimi read-only tekrar doğrulandı: provider
  hesabında bir subscription ürünü görünür ve API erişimi PASS.
- Altı temel plan ile altı canonical birleşik add-on planı provider'dan tekrar
  okundu; 12/12 reference, TRY brüt tutar, interval/count ve trial sözleşmesi
  PASS. Hiçbir canlı credential veya PROD endpoint kullanılmadı.
- Güncel resmi test kartı ve V3 subscription webhook sözleşmesi yeniden kontrol
  edildi. Success ve hata kartları yalnız sandbox'ta kullanılacak; webhook'ta
  `merchantId + secretKey + eventType + subscriptionReferenceCode +
  orderReferenceCode + customerReferenceCode` sırası korunacak.
- Public E2E preflight şu an **BLOCKED**: `sandbox.masabu.co` DNS'te çözülmüyor,
  katmanlı local/sandbox env `http://localhost:3004` origin'ini taşıyor ve named
  Cloudflare tunnel credential/config'i bulunmuyor. Dashboard ile DEV Edge worker
  arasında paylaşılacak `OUTBOX_WORKER_SECRET`, public
  `BILLING_MAINTENANCE_URL` ve Resend webhook secret'ı da local preflight'ta yok.
- Bu nedenle bugün test kartı girilmedi, gerçek sandbox subscription/paymentId
  oluşturulmadı ve provider refund/cancel hareketi gönderilmedi. Public origin
  kurulup İyzico panelindeki subscription notification URL'sinde V3 signature
  etkinleştirilmeden callback/webhook kanıtı varmış gibi işaretlenmeyecek.

Public origin açıldıktan sonraki sıra: dashboard'u sandbox env ile o origin'de
çalıştır, dört public endpoint'i fail-closed probe et, İyzico panel webhook'unu
V3 ile doğrula, success/error-generator checkout'ları çalıştır ve ardından
renewal/change/card/cancel/refund matrisini PII'sız kanıt kayıtlarıyla tamamla.

### Faz 8 — Production rollout

1. PROD migration dry-run + exact allow-list + backup.
2. İyzico canlı subscription ürünü/planları read-only verify; add-on planları dahil.
3. Webhook V3 özelliği ve URL'si; worker/Resend/Accounting secrets health check.
4. `SAAS_BILLING_ENABLED=false` ile deploy, migration ve read-only smoke.
5. İç tenant canary; tek plan/aylık checkout, gerçek düşük riskli ödeme ve mali
   belge doğrulaması.
6. 24 saat reconciliation/outbox/webhook/notification gözlemi.
7. Kademeli owner görünürlüğü; kill switch provider çağrısını kapatır fakat
   webhook/reconciliation consumer'larını kapatmaz.

**Çıkış:** rollout owner sign-off; rollback yalnız yeni checkout'u kapatır,
mevcut abonelik olaylarını işlemeye devam eder.

## 10. Test katmanları ve zorunlu kapılar

### Unit/contract

- status transition ve first-success-wins;
- provider response parser ve plan/ref/period parity;
- price catalog ve add-on combination fingerprint;
- change/refund idempotency conflict;
- notification content, recipient ve dedupe;
- checkout/card-update iframe CSP ve token redaction.

### DB runtime

- cross-tenant referans reddi;
- invoice + payment attempt + subscription + restaurant plan + add-on + outbox
  atomikliği;
- webhook-before-mapping ve mapping-before-webhook;
- renewal invoice hydration replay;
- scheduled change lease/skip-locked;
- downgrade drain ve açık settlement korunması;
- refund toplamı ve eşzamanlı refund race;
- RLS: anon/authenticated tüm billing ledger'larından 42501.

### HTTP/security

- media type/body size/signature/timestamp;
- raw token, raw webhook ve provider hata metni loglarda yok;
- callback açık redirect üretmez;
- owner/fresh-auth/RBAC/CSRF sınırları;
- webhook 2xx yalnız durable persistence sonrası.

### E2E/sandbox

- desktop/mobile billing UI;
- hosted checkout ve card update;
- feature açılma/kapanma: dashboard nav, server action, menu API, KDS;
- email/in-app içerik ve deep link;
- cancellation undo, refund status, invoice PDF.

## 11. Gözlemleme ve alarm seti

- webhook signature reject rate ve 5xx;
- en eski `billing_provider_events` received/failed yaşı;
- `needs_hydration` sayısı/yaşı;
- awaiting callback ve recovery lease yaşı;
- requires_reconciliation/discrepancy sayısı;
- provider operation timeout oranı;
- due dunning run gecikmesi;
- subscription period end geçmiş ama renewal invoice yok;
- provider/local plan veya status drift;
- invoice paid fakat entitlement kapalı / invoice unpaid fakat entitlement açık;
- notification delivery failed/dead;
- accounting invoice/refund review failed/age;
- refund processing age ve refundable amount mismatch.

Her alarm tenant PII taşımayan support reference id üretir. Platform admin
timeline'da provider raw payload değil allow-listed snapshot görünür.

## 12. Production readiness checklist

- [ ] Faz 0 ADR ve ticari politikalar onaylı.
- [ ] Callback unpaid access açmıyor. (Kod + DEV PASS; PROD rollout/canary bekliyor.)
- [ ] Renewal hydration success/failure çalışıyor. (Kod + DEV PASS; gerçek iki sandbox dönemi bekliyor.)
- [x] D-3 `invoice.upcoming` idempotent ve owner-only in-app/e-posta hattına bağlı. (Kod + DEV PASS.)
- [x] Dunning hydrate edilmiş renewal invoice ile +1/+3/+7/+14 DEV runtime testli. (Gerçek sandbox zaman çevrimi ayrıca bekliyor.)
- [x] Same-interval upgrade/downgrade paid-renewal convergence ve drain DEV testli.
- [ ] Aylık↔yıllık interval change sandbox politikası ve matrisi testli.
- [ ] Kart update + retry ayrı ve idempotent. (Kod/DB runtime PASS; gerçek hosted sandbox gönderimi bekliyor.)
- [x] Add-on provider katalog/provision/entitlement parity testli. (Sandbox 12/12 + DEV runtime PASS; PROD canlı ref/canary bekliyor.)
- [x] Dönem sonu iptal + undo çalışıyor. (Kod + DEV scheduler/reconciliation runtime PASS.)
- [x] Full/partial refund + accounting sonucu testli. (Kod + DEV/test-double PASS; gerçek sandbox para hareketi Faz 7'de.)
- [x] Billing mailing matrisi receipt/dead-letter ile testli. (Trial/onboarding/refund/fiscal + Resend outcome DEV PASS.)
- [ ] PROD pending migration yok.
- [ ] Canlı provider plan ref/tutar/dönem parity PASS.
- [ ] Webhook V3 ve public HTTPS endpoint PASS.
- [ ] Outbox, billing maintenance, email ve accounting worker health PASS.
- [ ] Reconciliation dashboard ve runbook hazır.
- [ ] Canary ödeme, entitlement, e-belge ve mail uçtan uca PASS.
- [ ] Rollback/kill-switch provası PASS.

## 13. Sıradaki uygulanacak dilim

Faz 1–6 kodu ve deterministik DEV runtime kapıları tamamlandı. Sıradaki dilim
Faz 7 gerçek İyzico sandbox kanıt matrisidir:

1. sabit public HTTPS callback/webhook origin'i ve V3 webhook teslimini doğrula;
2. iki ardışık gerçek veya hızlandırılmış renewal dönemini success/failure/
   retry/recovery ile çalıştır;
3. hosted card update ve same-interval upgrade/downgrade/add-on add/remove
   akışlarını gerçek provider child subscription lineage'ıyla kanıtla;
4. disposable başarılı sandbox paymentId üzerinde partial/full refund ve
   same-day cancel çalıştır; provider timeout'u fault injection ile quarantine et;
5. her senaryoda local money state, entitlement, outbox/inbox/e-posta receipt,
   accounting sonucu ve cleanup durumunu PII'sız evidence artifact'ına yaz.

PROD aktivasyonu ve production migration'ları, bu matris ile readiness
checklist'i tamamlanana kadar bloke kalır. `SAAS_BILLING_ENABLED=false` korunur.
