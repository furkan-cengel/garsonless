# ADR-0001 — Plan & Paket Kataloğu, Trial ve Kotalar

- **Durum:** Kabul edildi (2026-07-21)
- **Karar sahibi:** Ürün sahibi (Furkan)
- **İlgili kod:** `packages/domain/src/entitlements.ts` (canonical katalog)

## Bağlam

SaaS paketleri, feature matrisi ve kotalar koddan önce iş kararı olarak
kilitlenmelidir. Entitlement foundation (Faz 3 çekirdeği) kodda zaten
`free/starter/pro/enterprise` seti üzerine kuruludur ve 6 gerçek server gate
(tema publish, masa limiti, KDS, loyalty, advanced analytics, browser
notification) bu setle çalışır.

## Karar

### Paket seti

`free → starter → pro → enterprise`. Bu set **canonical**dır; pazarlama
metnindeki `business` yalnız `enterprise`'a normalize edilir. Bilinmeyen plan
değeri **fail-closed `free`** davranır.

### Feature matrisi (kod ile birebir)

| Feature | free | starter | pro | enterprise |
|---|---|---|---|---|
| qr_menu, orders, table_management, analytics_basic | ✅ | ✅ | ✅ | ✅ |
| theme_editor, browser_notifications | — | ✅ | ✅ | ✅ |
| kitchen_display, loyalty, analytics_advanced, theme_advanced_sections, multi_location | — | — | ✅ | ✅ |
| api_access, webhooks, sso, white_label | — | — | — | ✅ |

`api_access/webhooks/sso/white_label` katalogda tanımlıdır ancak ürün yüzeyi
henüz yoktur; ilgili epic gelmeden UI'da vaat edilmez (Settings dürüstlük
kuralı).

### Kotalar

| Limit | free | starter | pro | enterprise |
|---|---|---|---|---|
| Masa | 3 | 10 | 50 | sınırsız |
| Şube (location) | 1 | 1 | 3 | sınırsız |
| Ekip üyesi | 1 | 3 | 10 | sınırsız |

- Kota anlamı: limit **doluyken yeni kaynak oluşturulamaz**; mevcut fazla
  kaynak (downgrade sonrası) silinmez, yalnız yeni ekleme engellenir.
- Anlık-sayım kotaları (masa, ekip) atomik DB kontrolüyle uygulanır (örn.
  `create_table_with_plan_limit` RPC kalıbı).
- **Aylık sipariş / aktif QR kotası v1'de YOKTUR.** Eklenirse
  `tenant_usage_periods`/`tenant_usage_events` modeliyle ölçülür (Faz 3
  genişlemesi); sipariş akışını kesmek yerine önce soft-limit + bildirim
  uygulanır.

### Trial

- Yeni kayıt: **14 gün Pro trial**. Trial süresince Pro feature seti ve Pro
  kotaları geçerlidir.
- Trial sonunda aktif abonelik yoksa tenant **`free`'ye düşer** (suspend
  edilmez); Pro-only özellikler kilitlenir, veri korunur.
- Trial durumu abonelik state makinesinde `trial` olarak tutulur
  (bkz. ADR-0003); trial bir plan değil, bir subscription state'idir.
- Trial yalnız ilk kayıtta bir kez verilir; tekrar trial platform admin
  override'ı gerektirir (bkz. ADR-0004).

### Grandfathering & geçiş

- Entitlement enforcement'a geçişte mevcut tenant'lar o anki planlarını
  **grandfathered** olarak korur; hiçbir mevcut tenant otomatik downgrade
  edilmez.
- Yeni gate'ler önce **shadow mode** (yalnız log) ile açılır, sonra düşük
  riskli özelliklerden başlayarak enforce edilir.
- Özel izinler yalnız platform admin tarafından, gerekçeli ve süreli
  `tenant_feature_overrides` kaydıyla verilir.

## Sonuçlar

- Paket adları/kotalar UI kopyası değil platform kuralıdır; her değişiklik bu
  ADR'nin revizyonunu gerektirir.
- Fiyatlandırma (₺/ay) bu ADR'nin kapsamı dışındadır; İyzico ürün kataloğu
  kurulurken ayrı karar verilecektir (ADR-0002 bağımlılığı).
