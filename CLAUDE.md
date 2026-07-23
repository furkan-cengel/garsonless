# Masabu — Project Intelligence (formerly Garsonless)

## Product Vision

SaaS QR menu platform. Restaurants create fully customizable digital menus
with ordering, kitchen display, AI waiter, and payment capabilities.
Comparable to Shopify in customization depth.

## Architecture

- Monorepo: Turborepo
- Apps:
  - `apps/dashboard` — Next.js 15, restaurant admin panel + theme builder
  - `apps/menu` — Next.js 15, customer-facing QR menu (served at menu.masabu.co/{slug})
  - `apps/kitchen` — Next.js 15, KDS (Kitchen Display System)
- Packages:
  - `packages/ui` — Shared component library (shadcn base + custom)
  - `packages/design-engine` — Token system, theme resolver, CSS variable generator
  - `packages/domain` — Browser-safe pure policies, value vocabularies and typed results
  - `packages/application` — Actor/tenant-aware command and query orchestration ports
  - `packages/db` — Supabase client, types, migrations
  - `packages/ai` — Anthropic SDK wrapper, AI waiter prompts
  - `packages/qr` — QR generation with logo overlay

## Tech Stack

- Framework: Next.js 15 App Router
- Database: Supabase (Postgres + Realtime + Auth)
- Styling: Tailwind v4 + CSS custom properties (design tokens)
- AI: Anthropic Claude (claude-sonnet-4) via Anthropic API
- Payments: İyzico (TR) + Stripe
- State: Zustand (client), TanStack Query (server)
- Drag & Drop: dnd-kit + Framer Motion
- QR: qrcode + sharp
- Print: ESC/POS via node-thermal-printer

## Design Engine — CRITICAL

The design engine is the core differentiator. Every UI decision routes through it.

- Tokens stored in DB as JSON per restaurant
- CSS variables generated server-side, injected as <style> tag
- Component-level overrides stored separately
- Never hardcode colors, fonts, or spacing in components — always use CSS vars

## DB Schema Conventions

- snake_case columns
- Every table has: id (uuid), created_at, updated_at
- Soft deletes: deleted_at nullable
- RLS enabled on all tables

## Code Conventions

- TypeScript strict mode
- Zod for all validation
- Server Actions for mutations
- All API routes in `app/api/` with typed responses
- Error handling: never throw raw errors, always return typed Result<T, E>

## Agent Workflow

1. Always read relevant files before editing
2. Plan → get approval → implement
3. One migration per logical change
4. After each feature: update types, run type-check, summarize what changed

## Current Sprint

### Kritik pending items

- ⚠️ **`20260711020000_customer_restaurant_associations.sql` yalnız DEV'e uygulandı** — PROD deploy aşamasında uygulanacak PROD-at-deploy migration setine EKLENMELİ (yeni `customer_restaurants` tablosu + orders/loyalty ledger/consents backfill'i; insert'ler `on conflict do nothing` ile idempotent, PROD verisi üzerinde de çalışır).
- ⚠️ **`20260718010000_dashboard_query_observations.sql` yalnız DEV'e uygulandı** — PROD deploy aşamasında uygulanacak PROD-at-deploy migration setine EKLENMELİ (yalnız service-role erişimli anomaly/slow-query gözlem tablosu + tenant/zaman ve failure/degraded index'leri).
- ⚠️ **`20260718020000_dashboard_query_observation_operations.sql` yalnız DEV'e uygulandı** — PROD deploy aşamasında uygulanacak PROD-at-deploy migration setine EKLENMELİ (15 dakikalık aggregate health rollup, service-role-only prune RPC'si ve 30 günlük günlük retention cron'u).
- ⚠️ **Dashboard Insights Health workflow'u push sonrasında repo secret'larıyla aktive edilmeli** — `DEV_SUPABASE_URL` ve `DEV_SUPABASE_SERVICE_ROLE_KEY` zorunlu; `DASHBOARD_INSIGHTS_ALERT_WEBHOOK_URL` opsiyonel HTTPS alarm kanalıdır. Secret değerleri loglanmaz ve webhook payload'u tenant/ham hata taşımaz.
- ⚠️ **`20260721010000_dashboard_push_subscriptions.sql` yalnız linked DEV'e uygulandı** — dashboard Web Push teslimatı için subscription/delivery tablolarını ve own-user + tenant RLS politikalarını ekler. PROD deploy setine ancak push endpoint/worker environment'ları birlikte hazırlandığında eklenmelidir.
- ⚠️ **`20260721020000_menu_items_anon_allergen_note_grant.sql` yalnız DEV'e uygulandı** — PROD-at-deploy migration setine EKLENMELİ (`allergen_note` + `cross_contact_note` kolonlarını anon SELECT allowlist'ine ekler; bu grant olmadan public menü sorgusu 42501 alır ve menü boş görünür).
- ⚠️ **`20260721030000_notification_inbox.sql` yalnız DEV'e uygulandı** — PROD-at-deploy migration setine EKLENMELİ (per-user `notification_inbox` + `notification_preferences`; own-user RLS, service-role-only yazma, anon revoke). Deploy'da Edge worker secret'ına `OUTBOX_INBOX_CONSUMER_URL` da eklenmelidir.
- ⚠️ **`20260721040000_notification_email_channel.sql` yalnız DEV'e uygulandı** — PROD-at-deploy migration setine EKLENMELİ (`notification_templates` + `notification_deliveries`, her ikisi service-role-only). Deploy'da Edge secret'a `OUTBOX_EMAIL_CONSUMER_URL`, dashboard env'e `RESEND_API_KEY`/`RESEND_FROM_EMAIL` gerekir.
- ⚠️ **`20260721050000_notification_inbox_realtime.sql` yalnız DEV'e uygulandı** — PROD-at-deploy setine EKLENMELİ (`notification_inbox` supabase_realtime publication'a eklenir; zil rozetinin canlı düşmesi buna bağlı).
- ⚠️ **SaaS billing `20260722010000`–`20260722080000` migration'ları yalnız linked DEV'e uygulandı; PROD'a uygulanmadı.** PROD-at-deploy setine sekiz migration birlikte ve sıralı eklenmeli. Edge rollout'ta `BILLING_MAINTENANCE_URL`, `OUTBOX_INBOX_CONSUMER_URL` ve `OUTBOX_EMAIL_CONSUMER_URL`; gerçek İyzico için ayrı `IYZICO_BILLING_*` anahtar/plan/fiyat env'leri zorunludur.
- ⚠️ **`20260722160000_platform_billing_dunning_interventions.sql` yalnız linked DEV'e uygulandı; PROD'a uygulanmadı.** PROD-at-deploy setine platform-admin migration'larıyla sıralı eklenmeli. Bu RPC ödeme sonucu üretmez; yalnız finance/superadmin için denetimli `retry_now` veya 1–30 günlük `defer` zamanlaması sağlar.

### Faz 4 dilim 1 rozet revizyonu — zil = okunmamış inbox + realtime auth fix 🚧 (2026-07-21, UI göz teyidi bekliyor)

**Kullanıcı gözle testte fark etti:** dilim-1'de zil rozeti "bugünkü bekleyen sipariş
+ kritik(billing/system) unread" gösteriyordu; "Geçmiş"teki okunmamış bildirimler
okununca rozet düşmüyordu (kafa karıştırıcı). Klasik bildirim davranışına revize edildi.

- **`notificationCount = inboxUnread`** — zil artık per-user `notification_inbox`
  okunmamış sayısıdır (tüm kategoriler). Açıp okuyunca / "Tümünü okundu say" ile
  düşer. Sol nav Siparişler ikonu badge'i (`ordersBadge` = kapanmamış operasyonel sipariş)
  operasyonel canlı iş sayacı olarak **AYRI** kaldı; zil ile artık karışmıyor.
  `newOrderCount`/`pendingReqCount` zilden çıkarıldı (`pendingReqCount` tamamen
  silindi; waiter toast korundu). [RestaurantShell.tsx](apps/dashboard/components/layout/RestaurantShell.tsx)
- **KRİTİK realtime tuzağı (teşhis-temelli fix):** `notification_inbox` anon'a
  tamamen kapalı. Realtime `postgres_changes` RLS'e uyduğu için socket'e
  **authenticated JWT verilmezse event'ler sessizce düşer** —
  `supabase.realtime.setAuth(session.access_token)` subscribe'dan ÖNCE çağrılır.
  (Anon-okunabilir `orders`/`service_requests` bunu gerektirmediğinden diğer
  badge'ler auth'suz çalışıyordu; bu yüzden zil güncellenmiyordu.) + 45s
  güvenlik-ağı interval + orders INSERT'te 4s gecikmeli inbox refresh (Edge
  fallback'i. Orders INSERT sonrası yalnız aynı aggregate için inbox self-heal
  çalışır; toplu/geçmiş backfill yapılmaz.
- `20260721050000_notification_inbox_realtime.sql` DEV'e uygulandı (publication'a
  `notification_inbox` eklendi, idempotent). ⚠️ **PROD-at-deploy.**
- **Dev/self-heal davranışı:** Edge worker localhost'ta yoksa dashboard'un
  authenticated `orders` INSERT kanalı yalnız canlı gördüğü siparişin aggregate
  id'si için receipt'siz `order.created` event'ini idempotent olarak inbox'a
  dispatch eder. Geçmiş event'ler topluca backfill edilmez. Prod'da birincil yol
  yine `OUTBOX_INBOX_CONSUMER_URL` worker fan-out'udur; shell onarımı güvenlik
  ağı olarak kalır.
- **✅ Realtime taşıma kanıtlandı (2026-07-21):** gerçek authenticated owner
  session'ı + `setAuth(JWT)` ile RLS-scope kanal `SUBSCRIBED`; gerçek
  `consumeDashboardInbox` yazımının `INSERT` event'i ve mark-read işleminin
  `UPDATE` event'i yenilemesiz ulaştı. Runtime matrisi 9/9, cleanup
  inbox/prefs/outbox = 0/0/0. Bu kontrol kalıcı olarak
  `verify:dashboard-inbox` scriptine eklendi.
- **✅ Sipariş rozeti kök neden + düzeltme (2026-07-22):** global anon order
  SELECT'i `20260714030000_remove_global_anon_order_reads.sql` ile emekliye
  ayrıldığı halde `RestaurantShell` orders Realtime kanalı anon socket ile
  subscribe oluyordu; RLS event'i sessizce düşürdüğü için board 5 iken rail
  badge 4'te kalabiliyordu. Kanal artık subscribe'dan önce
  `await realtime.setAuth(session.access_token)` çağırıyor. Gerçek DEV
  matrisi aynı authenticated socket'te inbox INSERT/UPDATE ile **orders INSERT**
  event'ini yenilemesiz aldı; socket kopukken kaçan event için orders sayacına
  45s güvenlik-ağı refresh'i eklendi. Matris 9/9 ve cleanup 0/0/0.
- **✅ Gece yarısı taşıma semantiği (2026-07-22):** operasyonel açık sipariş
  günlük rapor değildir. `pending`, `pending_approval`, `sent_to_kitchen`,
  `preparing`, legacy `paid` ve `ready` satırları oluşturulma gününden bağımsız
  board + rail sayacında kalır; yalnız `served/cancelled` satırları restoran
  gününde `updated_at` ile sınırlandırılır. Böylece 23:59'da açılan iş 00:00'da
  sessizce kaybolmaz. Canonical `OPEN_ORDER_STATUSES` domain sabiti shell,
  SSR read-model ve reconnect reconciliation tarafından ortak kullanılır.
  MAF read-only sorgusunda gerçek açık iş sayısı **7** bulundu: 1 pending
  approval + 5 sent-to-kitchen + 1 preparing; sonuncusu 9 Temmuz'dan kalmış
  çözülmemiş bir operasyonel satırdır ve kod artık bunu gizlemez.
- **MAF gözlemi (2026-07-22, read-only):** son sipariş `39b0eb40…` için
  `dashboard-inbox` receipt'i ve iki yetkili alıcı satırı mevcut. Owner'ın
  önceki satırları 21:06'da okunmuş, yeni satır unread olduğu için zilin DB
  değeri **1**; burada beklenen 2 değil. Asıl stale değer rail badge'iydi.
- **⏳ AÇIK — yalnız UI göz teyidi:** bu Codex oturumunda Browser backend'i
  bulunmadığı için gerçek zil pikselinin F5'te sunucu sayısını göstermesi,
  event sonrası artması ve panelde okunduğunda düşmesi tarayıcıda tıklanarak
  gözle teyit edilemedi. Veri, RLS, consumer ve Realtime taşıma zinciri gerçek
  DEV'de kanıtlıdır; 45s interval ayrıca düşük gecikmeli fallback sağlar.
  2026-07-22 tekrarında ilk runtime Realtime INSERT denemesi 15s timeout aldı,
  cleanup 0/0/0 tamamlandı; hemen sonraki bağımsız tekrar **9/9** geçti. Bu
  Realtime'ın tek başına durable queue olmadığını ve 45s reconciliation
  fallback'inin gerekli olduğunu canlı olarak da gösterir.

### Faz 4 dilim 2 — E-posta bildirim kanalı (templates + deliveries + Resend) ✅ (2026-07-21)

- Domain tercih modeli kanal-bazlı genelleştirildi: `readNotificationChannelPrefs(raw, 'inapp'|'email')`.
  In-app fail-open (varsayılan açık), **e-posta mutable kategoriler için opt-in**
  (varsayılan KAPALI — kimse sürpriz e-posta almaz); billing/system her kanalda
  susturulamaz. Dilim-1 in-app API'ları compat wrapper olarak korundu. Domain 43/43.
- `20260721040000_notification_email_channel.sql` linked DEV'e uygulandı:
  `notification_templates` (kategori×kanal platform override'ı, servis-role-only)
  + `notification_deliveries` (alıcı başına teslim satırı; `unique(recipient,
  dedupe_key, channel)` = "aynı olaya 5 e-posta" imkânsız; PII adres snapshot'ı
  → anon+authenticated tam revoke, gerçek session'la 42501 kanıtlı).
  ⚠️ **PROD-at-deploy setine eklenmeli.**
- `@garsonless/application/notification-emails` consumer'ı: receipt-first,
  per-recipient durum makinesi (`sent`/`dead` terminal, `failed` → attempts+1
  retry, **5 denemede dead-letter** ve event receipt ile tamamlanır; transient
  hata receipt YAZMADAN err döner → outbox kendi backoff'uyla yeniden dener).
  Template çözümü DB override → kod varsayılanı; `{{var}}` render HTML-escape'li.
  Application 98/98 (10 yeni test: escape, opt-in/mute, retry, dead-letter cap,
  duplicate, override).
- Edge worker'a dördüncü bağımsız fan-out (`OUTBOX_EMAIL_CONSUMER_URL`,
  yapılandırılmamışsa `emailUnconfigured` metriği); dashboard
  `/api/internal/notification-email` route'u + Resend adapter'ı
  (`RESEND_API_KEY`/`RESEND_FROM_EMAIL`; eksik config = failed outcome →
  delivery kaydına düşer, core akış bloke olmaz).
- Settings → Bildirimler'e **"E-posta bildirimleri (kişisel)"** bloğu: signed-in
  kullanıcının kendi `notification_preferences` satırına yazan iki opt-in toggle
  (yeni sipariş / masa isteği), toggle'da anında kayıt + hata rollback'i. Server
  action merge'i diğer kanalların stored tercihine dokunmaz.
- Verify: domain **43/43**, application **98/98**, workspace typecheck **10/10**,
  lint **0 error**, dashboard production build temiz. Gerçek DEV runtime matrisi
  (`pnpm --filter @garsonless/db verify:notification-email`, test-double
  provider — gerçek e-posta gönderilmedi) **7/7**: varsayılan muted+receipt,
  opt-in→tek gönderim+delivery satırı+provider id, replay duplicate, transient
  hata→receipt'siz failed(1)→retry sent(2), 5-deneme dead-letter, DB template
  override, anon+authenticated 42501. Cleanup **0 orphan**.
- Rollout: Edge secret'a `OUTBOX_EMAIL_CONSUMER_URL=https://<dashboard>/api/internal/notification-email`
  + dashboard'da `RESEND_API_KEY`/`RESEND_FROM_EMAIL`.
- Sıradaki dilim: Faz 5 — billing veri modeli + İyzico SubscriptionBillingProvider
  portu (ADR-0002); dunning bildirimleri bu e-posta kanalına `billing` kategorisiyle
  bağlanacak (susturulamaz, şablonlu, delivery-takipli).

### Faz 4 dilim 1 — Kalıcı bildirim inbox'ı + per-user tercih temeli ✅ (2026-07-21)

- Yeni `@garsonless/domain/notifications` sözlüğü: kategori (`order`/`service_request`/`billing`/`system`),
  severity, kanal, deterministik dedupe key ve **susturulamazlık kuralı**
  (billing/system + her kategoride critical severity tercihle kapatılamaz;
  bozuk tercih JSONB'si fail-open teslim eder). Domain testleri 6/6.
- `20260721030000_notification_inbox.sql` linked DEV'e uygulandı:
  `notification_inbox` (per-user satır, `unique(recipient, dedupe_key)` ile
  replay-safe, own-user RLS select, yazılar yalnız service-role, anon revoke)
  + `notification_preferences` (restaurant×user, prefs JSONB). ⚠️ **PROD-at-deploy
  setine eklenmeli.**
- `@garsonless/application/notifications` receipt-first `dashboard-inbox`
  consumer'ı: outbox `order.created`/`service_request.created` event'ini owner +
  section-yetkili aktif üyelere fan-out eder; tercihle susturulan alıcı `muted`
  sayılır, insert hatasında receipt YAZILMAZ (retry-safe). Application testleri 6/6.
- Edge outbox worker'a üçüncü bağımsız fan-out eklendi (`OUTBOX_INBOX_CONSUMER_URL`,
  yapılandırılmamışsa `inboxUnconfigured` metriği ile görünür, core akışı bloke etmez).
  Dashboard `/api/internal/inbox` route'u `OUTBOX_WORKER_SECRET` ile korunur.
- Dashboard: `getInboxFeed`/`getUnreadInboxCount`/`markInboxRead` action'ları
  (auth user'a scoped service-role okuma; RLS savunma katmanı). NotificationsPanel
  canlı aksiyon feed'inin altında kalıcı **Geçmiş** bölümü, per-item okunmamış
  noktası, tıklamada link_path navigasyonu + okundu işaretleme, "Tümünü okundu
  say". Üst bar rozeti canlı sayaca yalnız **billing/system** kalıcı unread'ini
  ekler (order/service_request canlıda zaten sayılıyor → çift sayım yok; Faz 5
  dunning bildirimleri rozette otomatik görünecek).
- Verify: domain **40/40**, application **88/88**, workspace typecheck **10/10**,
  lint **0 error** (marketing'de mevcut 2 `img` warning), dashboard production
  build temiz. Gerçek DEV runtime matrisi (`pnpm --filter @garsonless/db
  verify:dashboard-inbox`) **8/8**: içerik+dedupe, replay duplicate, muted
  tercih + receipt, kategori filtreli unread, yabancı-user mark-read no-op,
  anon 42501, gerçek session RLS (sahibi 1 / yabancı authenticated 0), panel
  projection; cleanup inbox/prefs/outbox orphan **0**.
- Rollout notu: Edge worker secret'larına `OUTBOX_INBOX_CONSUMER_URL=
  https://<dashboard>/api/internal/inbox` eklenmeli (push kanalıyla aynı kalıp).
- Sıradaki dilim: e-posta kanalı (`notification_templates` + `notification_deliveries`
  + Resend adapter + retry/dead-letter) ve tercih yönetimi UI'ı; ardından Faz 5
  billing veri modeli.

### Master roadmap Faz 0 — SaaS ürün kuralları ADR'leri ✅ (2026-07-21)

- Production master roadmap'i (Faz 0–9) benimsenmiştir; sıradaki büyük iş Faz 5
  (SaaS billing + dunning), ön şartı olan Faz 0 ADR'leri `docs/adr/` altında
  kilitlendi: [0001 plan/paket+trial+kota](docs/adr/0001-plan-paket-katalogu.md),
  [0002 İyzico billing+dunning](docs/adr/0002-abonelik-billing-iyzico.md),
  [0003 tenant lifecycle+suspend+retention](docs/adr/0003-tenant-lifecycle-ve-askiya-alma.md),
  [0004 platform admin erişimi](docs/adr/0004-platform-admin-ve-destek-erisimi.md).
- Kilitli kararlar (ürün sahibi onayıyla): paketler **free/starter/pro/enterprise**
  (kod canonical), abonelik provider'ı **İyzico** (tek provider, port arkasında),
  **14 gün Pro trial** → ödeme yoksa free'ye düşüş (suspend değil), dunning
  **+14. günde otomatik suspend** (değerler ayarlanabilir platform politikası),
  `cancelled` sonrası **90 gün** dondurulmuş saklama + fatura kayıtları 10 yıl,
  platform admin **ayrı app** (`apps/platform-admin`) + ayrı aktör modeli +
  zorunlu MFA + süreli read-only impersonation.
- Roadmap durum haritası (2026-07-21): Faz 1 Pano ✅, Faz 2 hata çekirdeği ✅
  (eksik: error_events/fingerprint read model + QR'a özel 404), Faz 3 foundation ✅
  (eksik: subscriptions/usage tabloları + trial state + override + shadow mode),
  Faz 4 Web Push ✅ (eksik: preferences/templates/inbox/deliveries genel modeli +
  e-posta kanalı + dedupe), Faz 5/6 başlamadı. Önerilen sıradaki dilim: Faz 4'ün
  genel bildirim modeli VEYA doğrudan Faz 5 veri modeli (ADR-0002).

### Public menü boş görünme düzeltmesi — anon kolon grant + hata dürüstlüğü ✅ (2026-07-21)

- Kök neden: public menü sorgusu ([apps/menu/lib/queries.ts](apps/menu/lib/queries.ts)) `allergen_note`/`cross_contact_note` seçiyordu ama `20260704010000` anon kolon allowlist'i bu iki kolonu (sonradan `20260713010000` ile eklendiler) içermiyordu → PostgREST tüm select'i **42501** ile reddediyor, `getMenuItems` da error'ı yutup boş liste döndürüyordu. Tema önizleme ve masa QR sayfaları aynı sorguyu kullandığı için ikisinde birden ürünler kayboluyordu.
- `20260721020000_menu_items_anon_allergen_note_grant.sql` iki güvenli public disclosure text kolonunu anon grant'e ekledi; hassas kolonlar (`cost`, makrolar, settlement alanları) grant dışı kaldı ve gerçek anon probe ile **42501** olarak doğrulandı.
- `getMenuItems`/`getMenuCategories` artık Supabase error'ını yutmaz: `assertNoMenuQueryError` yapılandırılmış `[menu-public-query]` server logu yazar ve fırlatır → menü error boundary'sine düşer, "ürün yok" yalanı biter.
- Verify: gerçek anon REST probe **200 + ürünler** (öncesi 42501), hassas kolon probe **42501**; `localhost:3011/test-cafe-b` ve `?preview=1` SSR HTML'inde ürün adları render oldu; menu typecheck/lint temiz, DB suite **128/128**. Production build bu dilimde koşulmadı (canlı dev serverlar `.next` paylaştığı için); sıradaki build kapısında doğal olarak doğrulanır.

### SaaS bildirimleri — dayanıklı Web Push teslimatı ✅ kod + DEV veri/route / ⏳ gerçek cihaz (2026-07-21)

- Dashboard cihaz aboneliği artık tarayıcı izninden ibaret değildir: Web Push
  endpoint'i sunucuya own-user + restaurant bağlamında kaydolur, logout sırasında
  emekliye ayrılır ve permission/plan hataları kullanıcıya dürüst durum olarak
  gösterilir. Starter ve üstü plan kapısı server action'da yeniden denetlenir.
- `order.created` ve `service_request.created` outbox event'leri ayrı
  `dashboard-push` consumer'ında işlenir. Yetkili alıcılar event'in bölümüne göre
  (`orders`/`tables`) tekrar filtrelenir; preference kapalıysa veya eligible cihaz
  yoksa deterministik no-op receipt yazılır.
- Teslimat event+subscription bazında idempotenttir. Başarılı ve 404/410 gone
  endpoint'ler tamamlanır, gone endpoint devre dışı bırakılır; transient provider
  hataları receipt yazmadan retry'a bırakılır. Provider topic ve service-worker
  notification tag'i aynı event kimliğini kullanarak UI tekrarını sınırlar.
- Outbox worker yeni internal push consumer'ını bağımsız çağırır; URL henüz
  configure edilmemişse core event consumer'ı bloke edilmez ve durum
  `pushUnconfigured` metriğinde görünür kalır. Rollout sırası: migration → dashboard
  VAPID/private endpoint env → worker `OUTBOX_PUSH_CONSUMER_URL` → kanal aktivasyonu.
- Migration linked DEV'e uygulandı ve tipler gerçek şemadan yeniden üretildi. Test
  Cafe B throwaway runtime matrisi: owner görünür **1**, aynı endpoint retry sonrası
  satır **1**, unrelated kullanıcı **0**, anon/cross-tenant/delivery diagnostics
  engelli, delivery replay unique violation **23505**, cleanup **0 subscription / 0
  outbox orphan**.
- Gerçek internal route + Web Push provider transient testi: yanlış worker secret
  **401**; iki teslimat denemesi **503/503**; delivery `failed` ve attempts **2**;
  consumer receipt **0**, endpoint enabled ve failure_count **2** kaldı. Böylece
  transient hatanın ack edilmediği ve sonraki worker turuna bırakıldığı doğrulandı;
  cleanup yine **0/0**.
- Verify: application **82/82**, DB **128/128**, dashboard architecture **161/161**;
  workspace typecheck **10/10**, ilgili lint'ler temiz ve dashboard production build
  başarılı. Bu çalışma ortamında kullanılabilir browser backend olmadığı için gerçek
  cihaz `subscribe → provider sent → OS notification → click-through` kanıtı manuel
  browser gate olarak kalır; 410/gone ve sent dalları application contract testlerinde
  kapsanır.

### Modüler monolith — DB explicit type surface ✅ (2026-07-20)

- `@garsonless/db` belirsiz kök entrypoint'i kaldırıldı. Ortak database
  tipleri artık yalnız `@garsonless/db/types` üzerinden tüketilir; runtime
  kabiliyetleri hâlâ yalnız `server` veya `browser` alt yollarındadır.
- Dashboard, menu, kitchen ve UI içindeki **48** type import yeni entrypoint'e
  taşındı. DB public-boundary testi hem kök export'un geri gelmesini hem de
  uygulama kaynaklarında eski kök import'un yeniden kullanılmasını engeller.
- Bu dilim yalnız dependency yönünü ve bundling güvenliğini iyileştirir;
  migration, veri yazısı veya HTTP davranış değişikliği içermez.

### Modüler monolith — Application root-barrel retirement ✅ (2026-07-20)

- `@garsonless/application` kök entrypoint'i kaldırıldı. Private package'ın
  uygulama tüketicileri zaten yalnız feature-alt yollarını kullanıyordu;
  belirsiz wildcard public surface artık yoktur.
- Yeni public-boundary testi, kök export'un veya `from '@garsonless/application'`
  import'unun dashboard/menu/kitchen/DB katmanına yeniden girmesini engeller.
- Sıradaki dilim: büyük UI feature shell'lerini command/query modellerine
  ayırmayı sürdürmektir.

### Modüler monolith — Dashboard feature read contracts & projection discipline ✅ (2026-07-20)

- Dashboard feature okumaları artık ortak ve isimlendirilmiş bir operation
  sözlüğü kullanır: `restaurant.portfolio`, `menu.management`, `tables.list`,
  `settings.snapshot` vb. Tenant ve section politikası application katmanında
  tek noktadan değerlendirilir; DB adapter'a ham endpoint niyeti sızmaz.
- Feature read portlarının input sözleşmesi operation adını açıkça taşır. Bu,
  yeni bir ekranın yanlış veya isimsiz bir repository erişimi eklemesini
  contract/architecture testlerinde görünür kılar.
- DB adapter'daki feature sorgularından geniş `select('*')` kullanımları
  kaldırıldı; restoran, menu, istasyon ve masa için dar ve versioned projection
  sözleşmeleri tanımlandı. `tables.qr_code_url` dead kolonu masa projection'ına
  özellikle dahil değildir.
- Bu dilim migration ve tenant veri yazısı içermez. Sıradaki dilim: legacy
  compatibility/unused export retirement'i ve büyük UI feature shell'lerinin
  aynı command/query sınırlarına kademeli ayrıştırılmasıdır.

### Modüler monolith — Dashboard direct-read retirement ✅ (2026-07-20)

- Dashboard SSR/query envanteri tamamlandı. Feature query modüllerinde kalan son
  app-level tablo okuması (`restaurants.timezone`) mevcut restaurant read portuna
  taşındı; `insights-shared` artık doğrudan Supabase client/`.from()` çağırmaz.
- Dashboard app içindeki kalan `createDashboardServerClient` tüketimleri yalnız
  Supabase Auth adapter sınırındadır: authenticated user çözümü, OAuth session
  exchange ve invite identity eşleşmesi. Bunlar domain/read repository erişimi
  değildir ve bu retirement diliminin dışında bilinçli olarak korunur.
- Architecture test query feature ağacında service-role, authenticated-table
  query ve RPC çağrılarının tekrar eklenmesini engeller.
- Sıradaki dilim: read-model sözleşmelerini feature bazında standardize etmek
  (dar projections, operation vocabularies, runtime/contract matrix) ve sonra
  legacy compatibility/unused export temizliğine geçmek.

### Modüler monolith — Settings & Customers SSR query boundary ✅ (2026-07-20)

- Settings SSR snapshot'ı direct authenticated/service-role sorgulardan çıkarıldı.
  `readDashboardSettings` application handler'ı tenant + `settings` section
  yetkisini denetler; yalnız owner context'inde istasyon/ekip projection'ını
  ister. Güvenlik geçmişi service-role adapter'ında doğrulanmış `userId` ile
  dar olarak scope'lanır.
- Customers liste/detay SSR sayfaları, elle oluşturulmuş dar actor nesnesi
  yerine ortak `getDashboardFeatureContext` adapter'ını kullanır. Böylece
  Settings, Customers ve önceki feature sayfaları aynı trusted context
  çözümleme yolundadır.
- Test Cafe B yalnız-okunur runtime: Settings için kitchen credential **var**,
  **0** istasyon, **1** ekip üyesi ve **20** güvenlik olayı; Customers için
  **2** toplam müşteri / ilk sayfada **1** kayıt döndü. Migration ve tenant
  verisi yazılmadı.
- Sıradaki dilim: kalan dashboard direct-query call-site'larını feature bazında
  inventory çıkarıp application/DB query sınırına taşımak.

### Modüler monolith — Dashboard SSR feature query ports ✅ (2026-07-20)

- Restaurant portföyü, menu management, theme-editor referansları ve tables
  SSR okumaları app içi doğrudan Supabase sorgusundan çıkarıldı. Her akış artık
  `dashboard query adapter → @garsonless/application read handler →
@garsonless/db/server read-model port` zincirini kullanır.
- Dashboard adapter'ı authenticated user ile açık owner/aktif membership
  bilgisinden trusted context üretir. Application handler restaurant eşitliğini
  ve ilgili section yetkisini yeniden denetler; DB adapter yalnız dar
  projection/repository sorumluluğu taşır.
- Test Cafe B yalnız-okunur runtime turunda yeni portlar restaurant, portfolio,
  menu (**4 kategori / 6 ürün / 0 istasyon**), theme (**4 / 6**) ve tables
  (**3**) sonuçlarını başarıyla döndürdü. Tenant verisi veya migration
  yazılmadı.
- Sıradaki dilim: settings ve customers SSR okumalarını aynı actor-aware query
  sınırına taşımak; ardından kalan dashboard direct-query call-site'larını
  feature bazında emekliye ayırmak.

### Modüler monolith — Deploy health alarm & query facade retirement ✅ (2026-07-20)

- Dashboard query health entrypoint'i `.github/workflows/dashboard-insights-health.yml`
  ile her **15 dakikada** ve manuel tetiklenebilir bir operasyonal alarma bağlandı.
  Warning/critical health job'u non-zero yapar; health RPC erişilemezse ayrı
  `unavailable` sonucu ve exit code üretir. Böylece GitHub Actions job sonucu
  webhook olmasa da alarm kanalıdır.
- Opsiyonel webhook adapter'ı yalnız HTTPS URL kabul eder, 5 saniyede timeout
  olur ve yalnız aggregate alert vocabulariesini gönderir. Payload tenant ID,
  restoran adı veya ham DB error içermez; environment + status + eşiklerden
  deterministik fingerprint üretir. Webhook başarısızlığı scheduler'da ayrı exit
  code ile görünür kalır.
- İlk runtime turu health script'inin CommonJS altında top-level `await` yüzünden
  başlayamadığını yakaladı. Entry `async main()` sınırına alındı; gerçek linked
  DEV tekrarında **exit 0**, status **healthy**, operation **0**, alert **0**
  döndü.
- Dashboard `lib/queries.ts` compatibility barrel'ı tamamen silindi. Restaurant
  access, menu management, theme editor refs ve tables okumaları sırasıyla
  `queries/restaurants.ts`, `queries/menu-management.ts`,
  `queries/theme-editor.ts` ve `queries/tables.ts` feature girişlerine taşındı.
  Pano/Analytics type tüketicileri de doğrudan kendi feature modüllerine geçti;
  eski genel barrel importu sıfırlandı.
- Kullanılmayan legacy `getCategoriesForRestaurant` ve `getItemsForRestaurant`
  helper'ları barrel ile birlikte emekliye ayrıldı. Architecture fitness testi
  barrel'ın geri gelmesini, genel import kullanımını ve yeni feature dosyalarının
  satır bütçelerini engeller.
- Bu dilimde migration veya tenant veri yazısı yoktur. Workflow'un gerçek
  schedule/webhook teslimi kod pushlandıktan ve repo secret'ları tanımlandıktan
  sonra aktive olur.
- Sıradaki dilim: restaurant/menu/theme/tables SSR feature okumalarını actor
  context + application query portlarına almak; app katmanındaki doğrudan
  Supabase sorgu sorumluluğunu DB adapter'larına taşımak.

### Modüler monolith — Dashboard query health rollup & retention ✅ (2026-07-19)

- Ham dashboard query observation'ları için service-role-only aggregate health
  RPC'si eklendi. Varsayılan pencere **15 dakika**, izin verilen en geniş
  lookback **7 gün**; sonuç tenant kimliği veya ham hata metni taşımadan yalnız
  operation bazlı sayı, p95 süre ve zaman aralığı döndürür.
- Alarm policy saf ve typed bir projection'dır: warning eşikleri failure **1**,
  degraded **3**, p95 **1.500 ms**; critical eşikleri sırasıyla **5**, **10** ve
  **3.000 ms**. Bilinmeyen operation'lar yok sayılır; monitor script'i warning
  veya critical durumda non-zero exit ile deploy/cron entegrasyonuna hazırdır.
- `prune_dashboard_query_observations()` yalnız service-role'a açıktır ve **30
  günden eski** observation'ları siler. Migration pg_cron job'unu idempotent
  biçimde her gün **03:17 UTC** için kurar; anon/authenticated execute yetkileri
  açıkça kaldırılmıştır.
- `20260718020000_dashboard_query_observation_operations.sql` linked DEV
  geçmişinde mevcut; CLI 2.109.1 `db push` sonucu remote'un güncel olduğunu
  doğruladı. Migration PROD-at-deploy setine eklenmelidir.
- Gerçek Test Cafe B runtime matrisi health sonucunu **warning** üretti:
  `order-volume` p95 **1.800 ms** ve `table-refs` failure **1** için iki beklenen
  alarm oluştu. 31 günlük tek fixture prune edildi; anon health ve prune RPC
  çağrıları reddedildi; cleanup sonrasında orphan observation sayısı **0**.
- Verify: domain **28/28**, application **56/56**, dashboard architecture/model
  **136/136**, DB **117/117**; toplam **337/337** test geçti. Workspace
  typecheck **10/10**, lint **0 error** (marketing'deki mevcut 2 `img` warning)
  ve marketing/dashboard/menu/kitchen production build'leri temiz geçti.
- Sıradaki dilim: health monitor entrypoint'ini deploy alarm kanalına bağlamak
  ve compatibility facade'daki kalan genel read call-site'larını feature query
  portlarına taşımak.

### Modüler monolith — Dashboard query persistent telemetry & DEV runtime ✅ (2026-07-18)

- Dashboard insights observer deploy ortamında kalıcı bir sink'e bağlandı.
  Varsayılan adapter yalnız `degraded`, `failure` veya **1.000 ms ve üzeri**
  sorguları `dashboard_query_observations` tablosuna yazar; hızlı başarılı
  sorgular tabloyu ve logları şişirmez.
- Kalıcı sink service-role sınırında kalır. Tablo RLS ile anon/authenticated
  rollere kapalıdır; tenant/zaman ve anomaly/zaman index'leri operasyonel
  incelemeyi destekler. Insert veya structured-log sink hatası read sonucunu
  değiştirmez ve kullanıcı isteğine geri sızmaz.
- Observer çıkış portu sync veya async implementasyon kabul eder. Read-model
  adapter'ı gözlemi await ederken telemetry hatalarını fail-safe yutar; testte
  collector veya clock inject edilebilir.
- `20260718010000_dashboard_query_observations.sql` DEV'e uygulanıp linked
  generated tipler yenilendi. Migration PROD-at-deploy setine eklenmelidir.
- Gerçek Test Cafe B runtime matrisi beş projection'ı doğruladı: order volume
  **25**, collected orders **16**, table refs **3**, table-performance'da **3
  masa / 16 sipariş / 18 kapalı session / 1 açık masa**, Pano'da **3 masa / 1
  açık session / 0 source error**. Beş query de `success` gözlendi.
- Gerçek sink denemesinde işaretli failure satırı service-role ile yazıldı,
  anon read reddedildi ve test sonunda satır silindi; orphan sayısı **0**.
- Verify: domain **28/28**, application **56/56**, dashboard architecture/model
  **136/136**, DB **112/112**; toplam **332/332** test geçti. Workspace
  typecheck **10/10**, lint **0 error** (marketing'deki mevcut 2 `img` warning)
  ve marketing/dashboard/menu/kitchen production build'leri temiz geçti.
- Sıradaki dilim: observation retention/health rollup ve deploy ortamı alarm
  eşiklerini tanımlamak; ardından compatibility facade'daki kalan genel read
  call-site'larını feature query portlarına taşımak.

### Modüler monolith — Dashboard read-model contracts & observability ✅ (2026-07-18)

- Dashboard insights adapter'ının Supabase projection'ları
  `dashboard-read-model-contract.ts` içinde tek, dar ve pinli sözleşmeye
  taşındı. Order volume, tahsilat, masa performansı ve Pano operasyon
  kaynaklarının seçtiği kolonlar contract testi olmadan genişletilemez; wildcard
  projection yasaktır.
- Application katmanına typed `DashboardInsightsOperation`,
  `DashboardInsightsQueryOutcome` ve `DashboardInsightsQueryObserver` çıkış
  portu eklendi. Her aggregate read `durationMs`, tenant, operation ve
  `success`/`degraded`/`failure` sonucunu üretir.
- Pano operasyon read'i alt kaynaklardan bir kısmı başarısız olduğunda mevcut
  partial UI davranışını korur ve gözlemde `degraded` olur. Result hataları ile
  beklenmeyen exception'lar `failure` olarak raporlanır; telemetry observer
  hatası hiçbir zaman read sonucunu veya exception semantiğini değiştirmez.
- Default structured observer yalnız başarısız, degraded veya **1.000 ms ve
  üzeri** yavaş sorguları server loguna `[dashboard-insights-query]` etiketiyle
  yazar. Normal hızlı sorgular log gürültüsü üretmez; observer ve clock testte
  inject edilebilir.
- DB contract paketi dar projection kullanımı, latency ölçümü, partial failure,
  Result/exception korunumu, telemetry fail-safety ve slow-query eşiği için 6
  yeni test taşır. Dashboard fitness testi de contract + observability
  bağlantısının adapter sınırında kaldığını doğrular.
- Verify: domain **28/28**, application **56/56**, dashboard architecture/model
  **136/136**, DB **110/110**; toplam **330/330** test geçti. Workspace
  typecheck **10/10**, lint **0 error** (marketing'deki mevcut 2 `img` warning)
  ve marketing/dashboard/menu/kitchen production build'leri temiz geçti.
  Migration veya tenant veri yazısı yok.
- Sıradaki dilim: telemetry event'lerini deploy ortamındaki kalıcı metric/log
  sink'ine bağlamak ve kritik read-model'lar için gerçek DEV projection/runtime
  contract matrisi eklemek.

### Modüler monolith — Dashboard query feature decomposition ✅ (2026-07-18)

- `apps/dashboard/lib/queries.ts` içindeki Pano ve Analytics implementasyonları
  fiziksel feature modüllerine ayrıldı. Ortak facade **1.449 satırdan 221
  satıra** indi; mevcut tüketiciler için dar compatibility re-export'lar
  korunurken Pano/Analytics page ve action'ları doğrudan feature girişlerini
  kullanır.
- Yeni sınırlar: `queries/analytics.ts` (357 satır),
  `queries/analytics-operations.ts` (344), `queries/pano.ts` (436) ve
  `queries/insights-shared.ts` (151). Actor/tenant çözümü, timezone penceresi,
  typed read-model portları ve ortak fold yardımcıları shared modülün tek
  sorumluluğudur.
- Analytics operasyonel/owner-only raporları ayrı modülde tutulur. Feature
  modülleri parent facade'a geri import yapamaz; app action/page call-site'ları
  da compatibility facade yerine doğrudan ilgili feature modülünü kullanır.
- Architecture fitness testi facade ve her feature dosyası için satır bütçesi,
  parent-facade import yasağı, doğrudan service-role/geniş tablo sorgusu yasağı
  ve application → DB read-model zincirini denetler.
- Verify: domain **28/28**, application **56/56**, dashboard architecture/model
  **135/135**, DB **104/104**; toplam **323/323** test geçti. Workspace
  typecheck **10/10**, lint **0 error** (marketing'deki mevcut 2 `img` warning)
  ve marketing/dashboard/menu/kitchen production build'leri temiz geçti.
  Migration veya tenant veri yazısı yok.
- Sıradaki dilim: read-model repository/RPC contract testlerini ve query
  latency/partial-failure gözlemlenebilirliğini güçlendirmek; veri projeksiyonu
  veya semantik drift'ini UI'dan önce yakalamak.

### Modüler monolith — Dashboard insights read-model boundary ✅ (2026-07-18)

- Pano ve Analytics'in sipariş, tahsilat, masa performansı ve operasyonel
  snapshot okumaları typed `DashboardInsightsReadModelPort` sınırına taşındı.
  Orders board'un mevcut portuyla birlikte üç yoğun dashboard ekranı artık
  application query + DB adapter yolunu kullanır.
- Application katmanı tenant ile `pano`/`analytics` section yetkisini port
  çağrısından önce doğrular. Pano ödeme provider durumu yalnız trusted owner
  context'inde açılır; caller'ın `includePaymentStatus` isteği tek başına
  yeterli değildir.
- Dashboard `lib/queries.ts` artık `orders`, `table_sessions` veya
  `payment_credentials` tablolarını doğrudan sorgulamaz; service-role client ve
  PostgREST tahsilat filtresi app katmanından çıkarıldı. DB adapter dar
  projection'lar kullanır ve tahsilat filtresini domain'deki tek
  `COLLECTED_ORDER_SPEC` sözleşmesinden üretir.
- Aktivite akışı DB'den yalnız son 7 iptal edilmemiş kaydı alır. Masa durum
  sorgusu metrik gerekmeyen çağrıda tarihsel session opening'leri çekmez. Pano
  gelir zaman serisi `paidAt` üzerinden hesaplandığı için Analytics ile aynı
  tahsilat zaman semantiğini kullanır.
- Architecture fitness testi app katmanında geniş tablo/service-role/filter
  kullanımının geri gelmesini engeller ve application + DB port zincirini
  doğrular.
- Verify: domain **28/28**, application **56/56**, dashboard architecture/model
  **134/134**, DB **104/104**; toplam **322/322** test geçti. Workspace
  typecheck **10/10**, lint **0 error** (marketing'deki mevcut 2 `img` warning)
  ve marketing/dashboard/menu/kitchen production build'leri temiz geçti.
  Migration veya tenant veri yazısı yok.
- Sıradaki dilim: fiziksel modül ayrımıyla `apps/dashboard/lib/queries.ts`
  içindeki Pano/Analytics query adapter'larını feature dosyalarına bölmek;
  compatibility re-export ve mimari bütçe testleriyle büyük ortak query
  modülünün yeniden büyümesini önlemek.

### Modüler monolith — Architecture CI gate ✅ (2026-07-18)

- Root kalite kapısı `check:ci` altında lint, workspace typecheck, domain,
  application, dashboard architecture/model ve DB testlerini zorunlu çalıştırır.
  `check` bu hızlı kapıyı production build ve smoke testinden önce çağırır;
  dolayısıyla yerel ve CI sözleşmesi aynı komut zincirini kullanır.
- Dashboard için analytics/menu/tables/theme mimari testlerini tek girişte
  çalıştıran `test:architecture` script'i eklendi. Test runner'ları
  `node --import tsx --test` kullanır; bu, `tsx --test` CLI'ının kısıtlı CI
  ortamlarında açabildiği IPC socket bağımlılığını ortadan kaldırır.
- `.github/workflows/architecture-ci.yml` PR'larda ve `main` push'larında
  frozen-lockfile install + `pnpm check:ci` çalıştırır. Workflow read-only
  permission, Node 24, pnpm cache, 20 dakikalık timeout ve aynı ref için eski
  koşuyu iptal eden concurrency policy taşır.
- Verify: domain **27/27**, application **54/54**, dashboard architecture/model
  **133/133**, DB **104/104**; toplam **318/318** test geçti. Workspace
  typecheck **10/10**, lint **0 error** (marketing'deki mevcut 2 `img` warning)
  ve marketing/dashboard/menu/kitchen production build'leri temiz geçti.
  Migration veya tenant veri yazısı yok.
- Push sonrasında GitHub branch protection/ruleset içinde
  **Architecture gate** status check'inin required yapılması ayrıca gerekir;
  workflow dosyasının varlığı tek başına merge'i zorunlu olarak engellemez.
- Sıradaki dilim: dashboard Pano/Analytics/Orders read modellerini domain bazlı
  query modüllerine ayırmak ve tahsilat gibi ortak semantiği tek specification
  sınırına taşımak.

### Modüler monolith — DB compatibility wrapper retirement ✅ (2026-07-17)

- Service-request vocabulary ve menu nutrition/review/numeric policy'leri artık
  `@garsonless/db/browser` üzerinden yeniden export edilmez. Dashboard/menu/ui
  call-site'ları doğrudan `@garsonless/domain/tables` ve
  `@garsonless/domain/menu` kullanır; eski `service-request-types.ts` ve
  `menu-nutrition.ts` facade'ları ile yinelenen DB testleri silindi.
- `packages/db/src/loyalty.ts` saf domain kurallarını ve order projection
  helper'larını yeniden export etmez; yalnız service-role persistence ve
  orchestration fonksiyonlarını taşır. Customer/campaign persistence
  modüllerindeki salt domain re-export'ları da kaldırıldı.
- Sıfır tüketimli `ensureCustomerForAuthUser` compatibility facade'u silindi.
  Ham `createServiceClient` artık `@garsonless/db/server` public yüzeyinde yok;
  yalnız DB implementasyonlarının package-private altyapısıdır. App doğrudan
  service-role client kullanım sayısı **0** kalır.
- `@garsonless/db/browser` wildcard yerine explicit allowlist export eder.
  ESLint ham service client ve emekli domain-policy importlarını reddeder. Yeni
  fitness suite root'un type-only, browser'ın explicit/browser-safe ve
  server'ın port-only kalmasını; silinen facade'ların geri gelmemesini doğrular.
- Verify: domain **27/27**, DB **104/104** (fitness **4/4** dahil), workspace
  typecheck **10/10**, lint **0 error** (marketing'deki mevcut 2 `img` warning),
  dört production build ve güncel marka/KDS session sözleşmesiyle Playwright
  smoke **4/4** temiz. Runtime export probe: browser client/order projection ve
  server table port fonksiyon; raw service client yok; emekli browser export'u
  yok. Migration veya DEV veri yazısı yok.
- Sıradaki dilim: kalan büyük client orchestrator tail'lerini ölçüp en yüksek
  coupling'e sahip parçayı feature-state/view/command-hook sınırına ayırmak;
  ardından fitness testlerini CI `check` kapısına sabitlemek.

### Modüler monolith — App-level service-role retirement ✅ (2026-07-17)

- Dashboard app katmanındaki son üç `createServiceClient()` kullanımı
  kaldırıldı. `updateSettings` ve `saveNotificationSettings`
  `patchRestaurantSettings` application command'i ile
  `createRestaurantSettingsPort()` DB adapter'ına; fiziksel stand akışı
  `requestQrStands` command'i, `createStandRequestPort()` persistence adapter'ı
  ve ayrı Resend notification adapter'ına taşındı. `apps/**` altında doğrudan
  service-role client oluşturma sayısı artık **0**.
- Dashboard actor context'i owner yetkisini açık `isOwner` alanıyla taşır.
  Application command tenant + `settings` iznini tekrar doğrular; non-owner
  generic settings patch'i yalnız `store/contact/hours/tax/languages/
notifications/orders` allowlist'ine açıktır. Owner-only veya gelecekte
  eklenecek bilinmeyen key'ler member için fail-closed kalır.
- Yeni `patch_restaurant_settings_atomic` RPC'si yalnız gönderilen top-level
  JSON key'lerini DB içinde tek update ile birleştirir. Böylece eşzamanlı
  settings/notification/theme/QR/loyalty yazıları eski read→merge→write
  penceresinde birbirini ezmez. RPC yalnız service-role'a açıktır.
- Stand request command'i gerçek restoran adını DB portundan çözer, throttle
  actor'ını context `userId`'den türetir, 10 dakikalık claim'i provider
  çağrısından önce alır ve email/provider hatasında aynı claim'i koşullu olarak
  bırakır. HTML escaping ve Resend env/provider ayrıntıları application veya
  action katmanına sızmaz.
- Gerçek DEV throwaway matrisi: iki paralel settings patch'i ve mevcut marker
  birlikte korundu; ilk stand talebi **1 provider call**, replay throttle;
  sentetik delivery failure sonrası claim sayısı **0**; anon settings RPC
  **42501**; cleanup restaurant/claim **0**. Gerçek mail gönderilmedi, provider
  test double ile yalnız orchestration ve persistence doğrulandı.
- `20260717030000_atomic_restaurant_settings_patch.sql` DEV'e uygulandı ve
  generated type'lar yenilendi. **PROD-at-deploy migration setine eklenmeli.**
  Verify: application **54/54**, DB **109/109**, workspace typecheck temiz,
  lint **0 error** (marketing'de mevcut 2 `img` warning), dashboard production
  build temiz.
- Sıradaki dilim: DB modülleri içindeki eski compatibility wrapper/export
  yüzeylerini ölçerek kaldırmak; ardından kalan büyük client orchestrator tail
  parçalama ve architecture fitness/CI gate'leri.

### Modüler monolith — Tables/Kitchen compatibility retirement ✅ (2026-07-17)

- Dashboard masa CRUD, QR token listeleme/rotasyon ve QR stil kaydı artık
  `@garsonless/application/tables` command'leri ile `DashboardTablePort`
  üzerinden çalışır. Application katmanı tenant + `tables` iznini port
  çağrısından önce doğrular; rotation audit aktörü yalnız güvenilir dashboard
  context'inden türetilir ve sabit menu origin/restaurant slug kuralı UI
  girdisine bırakılamaz.
- Menu table page ile table-state, service-request, order, order-status,
  payment ve split route'ları ham token helper'ı çağırmaz. Opaque QR token,
  session ve order bağını dar `PublicTableQueryPort` çözer. Özellikle
  `/api/orders/status` içindeki son doğrudan service-role order sorgusu
  kaldırıldı.
- Raw table CRUD/QR helper'ları `@garsonless/db/server` public API'sinden
  çıkarıldı; yalnız DB adapter implementasyonu içinde kaldı. KDS board/read ve
  transition akışları zaten typed application port sınırında olduğu için HTTP
  sözleşmesi veya DB migration değişmedi.
- Gerçek DEV throwaway matrisi: create/list/rename/style save başarılı; açık
  session'da delete `open_session`, kapanıştan sonra `deleted`; token-scoped
  state **1 order** ve status `sent_to_kitchen`; rotation sonrası eski token
  `null`, yeni token geçerli; soft-delete sonrası token `null`; dört anonim
  raw RPC replay'i **42501**. Cleanup restaurant/table/session/order/token
  sayaçlarının tamamı **0**.
- Temiz local KDS exchange **303**, board **200**, delta insert görünme **2298
  ms**, terminal tombstone kaldırma **1813 ms**, console error **0**; cleanup
  restaurant/order/table/credential/launch için **0**. İlk browser koşusundaki
  stale Next dev süreci temiz restart ile ayrıştırıldı; backend projection
  matrisi ayrıca snapshot/delta/tombstone ve anon **42501** ile geçti.
- Verify: application **50/50**, DB **109/109**, workspace typecheck temiz,
  lint **0 error** (marketing'de mevcut 2 `img` warning), dashboard + menu +
  kitchen production build temiz. Migration yok.
- Sıradaki dilim: app katmanında kalan ham service-role kaçışlarını
  (`restaurant` ve fiziksel stand action'ları) typed application portlarına
  taşımak; ardından DB içi compatibility wrapper retirement ve kalan büyük
  client orchestrator parçalama.

### Modüler monolith — KDS narrow projection + delta reconciliation ✅ (2026-07-17)

- KDS'nin her 2 saniyede `orders.select('*')` yapan tam tablo okuması kaldırıldı.
  Service-role-only `read_kitchen_order_projection` RPC'si yalnız dokuz alanı
  döndürür: `id`, `status`, `table_id`, `items`, `customer_tier`, `paid_at`,
  `created_at`, `updated_at`, `active`. Müşteri, ödeme, request ve settlement
  alanları projection'a çıkmaz.
- Snapshot cursor'ı uygulama saatiyle değil PostgreSQL `clock_timestamp()` ile
  alınır. KDS 2 saniyelik çakışmasız delta poll yapar; terminal/silinen
  siparişler `active=false` tombstone ile karttan düşer. Her 60 saniyede ve
  pencere focus/visibility dönüşünde tam snapshot uzlaşması kaçırılmış deltayı
  onarır.
- Kitchen browser-safe anon Supabase client'ı, public Supabase env ihtiyacı ve
  doğrudan SDK bağımlılıkları kaldırıldı. Tarayıcı yalnız HttpOnly kitchen
  session'ıyla server action'a ulaşır; RPC anon/authenticated rollere kapalıdır.
  Bu dilim Supabase push stream açmadan dar projection üzerinde yakın-gerçek
  zamanlı delta consumer sağlar; gerçek push/SSE transport ayrı bir altyapı
  kararıdır.
- Gerçek DEV projection matrisi: snapshot **1 order / 9 alan / 0 hassas alan**;
  update+insert deltası **2 satır**, terminal tombstone ve yeni insert doğru;
  merge sonrası yalnız aktif sipariş; reconciliation **1 aktif sipariş**; anon
  RPC **42501**. Gerçek local browser exchange **303**, board **200**, insert
  görünme **1305 ms**, tombstone kaldırma **1815 ms**, console error **0**.
  İki throwaway testin restaurant/order/table/credential/launch cleanup
  sayaçlarının tamamı **0**.
- `20260717020000_kitchen_order_projection.sql` DEV'e uygulandı ve generated
  type'lar yenilendi. **PROD-at-deploy migration setine eklenmeli.** Verify:
  application **47/47**, DB **109/109**, workspace typecheck temiz, lint **0
  error** (marketing'de mevcut 2 `img` warning), dashboard+kitchen production
  build temiz.
- Sıradaki dilim: legacy table/kitchen compatibility kullanımını ölçmek ve
  güvenle retirement yapmak. Push tabanlı KDS transport gerekirse ayrı backlog
  fazıdır; mevcut doğruluk polling'e değil periyodik snapshot uzlaşmasına da
  dayanır.

### Modüler monolith — Single-use KDS launch receipt ✅ (2026-07-17)

- 45 saniyelik KDS launch artifact'ı artık yalnız imzalı/kısa ömürlü değil,
  tek kullanımlıktır. Sunucuda raw ticket yerine SHA-256 hash'i
  `kitchen_session_launches` receipt tablosuna yazılır.
- Exchange `consume_kitchen_launch_ticket` security-definer RPC'siyle receipt'i
  atomik olarak tüketir. Aynı ticket replay'i reddedilir; iki paralel exchange
  yarışında yalnız bir request session kazanır. Tablo ve RPC yalnız
  `service_role` erişimine açıktır.
- Legacy `?token=` temizleme middleware'e alındı; Next dev redirect payload'ı
  dahil token yansıması yoktur. Temiz URL ve session-cookie akışı korunur.
- Gerçek DEV: ilk exchange başarılı, replay **false**, paralel kazanan **1**,
  anon read/RPC **42501**, raw credential exposure **false**; rotation eski
  session ve ticket'ı reddetti, cleanup restaurant/credential/receipt **0**.
  Local HTTP: legacy redirect **307** (reflection false), cross-tenant **401**,
  exchange **303**, replay **401**, HttpOnly+SameSite=Lax cookie ve board **200**.
- `20260717010000_single_use_kitchen_launch_tickets.sql` DEV'e uygulandı ve
  generated type'lar yenilendi. **PROD-at-deploy migration setine eklenmeli.**
  Verify: DB **109/109**, workspace typecheck temiz, lint **0 error**
  (marketing'de mevcut 2 `img` warning), dashboard+kitchen production build
  temiz.
- Dar projection/delta consumer dilimi yukarıdaki 2026-07-17 fazında
  tamamlandı. Sıradaki iş legacy table/kitchen compatibility ölçümü ve
  retirement.

### Modüler monolith — KDS secure session exchange ✅ (2026-07-16)

- Kalıcı `kitchen_credentials.token` dashboard SSR/read-model, client prop,
  query string ve server action argümanlarından çıkarıldı. Orders/settings UI
  yalnız `hasKitchenAccess` boolean'ı görür; seed artık token'ı
  `restaurants.settings` içine veya konsol URL'sine yazmaz.
- Yetkili dashboard `GET /api/kitchen/launch/:restaurantId` çağrısı 45 saniyelik
  tenant+purpose-bound imzalı launch artifact üretip KDS'ye POST eder. Kitchen
  exchange route'u 8 saatlik restaurant-path-scoped `HttpOnly`, `SameSite=Lax`
  cookie kurar ve temiz URL'ye 303 döner. Page ve action'lar cookie session'ını
  güncel credential ile doğrular; rotation eski ticket ve session'ı anında
  iptal eder. Legacy `?token=` temiz URL'ye redirect edilir ve HTML'e yansımaz.
- Gerçek DEV: launch→exchange başarılı, credential artifact içinde yok;
  cross-tenant replay false; launch-as-session false; rotation sonrası eski
  session false/eski ticket false/yeni session true; cleanup restaurant ve
  credential **0**. Local HTTP: legacy query auth false/reflection false,
  cross-tenant exchange **401**, exchange **303**, cookie HttpOnly+SameSite=Lax,
  authenticated clean KDS **200**.
- Verify: DB **108/108**, application **44/44**, workspace typecheck temiz,
  lint **0 error** (marketing'de mevcut 2 `img` warning), dashboard+kitchen
  production build temiz. Migration yok.
- Sonraki single-use receipt sertleştirmesi yukarıdaki 2026-07-17 diliminde
  tamamlandı.

### Modüler monolith — Atomic Tables & Kitchen boundaries ✅ (2026-07-16)

- Anormal masa kapatma ile token'sız declared split intent temizliği
  `close_table_session_atomic` içinde tek transaction oldu. Provider token'ı
  bağlanmış veya aktif checkout lease'i olan pay varken kapanış
  `payment_pending` ile fail-closed reddedilir; session açık ve pay declared
  kalır. Önceki adaptörün provider-bound payı kapanıştan sonra yanlışlıkla
  `void` edebilen toplu helper'ı kaldırıldı.
- `create_table_service_request_atomic` aktif masa doğrulama, açık-session
  association ve replay-safe insert'i transaction içine aldı. Kitchen yazısı
  `transition_kitchen_order_atomic` ile order row lock altında tenant, station,
  multi-station final inspection ve status transition policy'sini tekrar
  doğrular; application preflight ile yazı arasındaki authority yarışı kapandı.
- DEV runtime: üç RPC anon **42501**; paralel servis çağrısı **1 satır + 1
  throttle**; provider-bound close **payment_pending**, session açık/share
  declared; provider bırakıldıktan sonra abnormal close + share void + **1
  table_session.closed outbox**; yanlış station **42501**; paralel ready retry
  ikisi de idempotent ve persisted status `ready`. Cleanup restaurant/session/
  order/share/request/outbox **0**.
- `20260716100000_atomic_table_close_service_request_and_kitchen_transition.sql`
  DEV'e uygulandı, generated type'lar yenilendi. **PROD-at-deploy migration
  setine eklenmeli.** Verify: application **44/44**, workspace typecheck temiz,
  lint **0 error** (marketing'de mevcut 2 `img` warning); dashboard/menu/kitchen
  production build temiz.
- Sıradaki güvenlik dilimi: KDS bearer token'ını query string/client prop/server
  action argümanından çıkarıp kısa ömürlü httpOnly kitchen session exchange'ine
  taşımak; sonra table/kitchen read-model ve legacy helper retirement ölçümü.

### Modüler monolith — DB compatibility barrel retirement ✅ (2026-07-16)

- Root `@garsonless/db` entrypoint'i artık yalnız type export eder. Runtime
  yetenekleri açıkça `@garsonless/db/server`, `@garsonless/db/browser` veya
  `@garsonless/domain/*` sınırından alınır.
- App runtime call-site'ları explicit alt yollara taşındı; eski
  `@garsonless/db/order-client` package export'u kaldırıldı. Service-role
  repository/RPC adapter'ları yalnız server entrypoint'inde kaldı.
- ESLint runtime root importunu error ile engeller, yalnız `import type`
  kullanımına izin verir. Böylece belirsiz barrel üzerinden infrastructure
  erişimi ve yanlışlıkla server kodunun client bundle'a çekilmesi önlenir.
- Verify: workspace typecheck temiz; lint **0 error** (marketing'de mevcut 2
  `img` warning); domain **24/24**, application **30/30**, db **106/106**;
  dashboard, menu ve kitchen production build temiz. Migration yok.

### Modüler monolith — Dashboard order lifecycle strangler ✅ (2026-07-16)

- Dashboard order status ve cancel action'ları raw `updateOrderStatusDB` /
  `cancelOrderDB` çağırmaz; `transitionDashboardOrder` ve
  `cancelDashboardOrder` application command'lerinden geçer.
- Command tenant + `orders` iznini porttan önce doğrular. Cancellation actor
  kimliği trusted context'ten türetilir; online/split iade yasağı, nakit/POS
  gerekçe zorunluluğu, normalization ve retry kararı
  `@garsonless/domain/orders` sahibidir.
- `createDashboardOrderLifecyclePort()` package-private atomik DB
  primitive'lerine delegasyon yapar. Settle/cancel yarış koruması değişmedi;
  raw lifecycle primitive'leri ve artık portlarla değiştirilmiş kullanılmayan
  CRM/loyalty/campaign helper'ları public `@garsonless/db/server` yüzeyinden
  kaldırıldı.
- DEV throwaway runtime: cross-tenant transition `Not authorized`; geçerli
  transition `sent_to_kitchen`; paid-cash gerekçesiz iptal ret, gerekçeli iptal
  actor+reason audit ile başarılı, retry no-op; İyzico-paid iptal ret ve status
  `served` kaldı. Cleanup `restaurantOrphans=0`, `orderOrphans=0`.
- Verify: domain **27/27**, application **33/33**, db **106/106**; workspace
  typecheck temiz; lint **0 error** (marketing'de mevcut 2 `img` warning);
  dashboard, menu ve kitchen production build temiz. Migration yok.

### Modüler monolith — Order create / checkout / split-payment strangler ✅ (2026-07-16)

- Dashboard create action'ı `createDashboardOrder`; tek order checkout
  `prepareOrderCheckout`; split beyan/checkout `declareSplitShare` ve
  `prepareSplitCheckout` application command'lerinden geçer. Action/route'lar
  raw service-role order/share sorgusu veya insert/update yapmaz.
- Cash share yalnız tables yetkili dashboard actor'ıyla
  `confirmDashboardCashShare`; online share yalnız İyzico provider context'iyle
  `settleProviderShare` üzerinden kapanır. Actor audit'i request'ten alınmaz.
- Duplicate item refs tekilleştirilir; beyan ve checkout persisted adisyon
  bakiyesine clamp edilir. Credential/token mapping `payment-provider-port`,
  share persistence `createSplitPaymentPort()` arkasındadır. Raw
  `createShareDB`/`settleShareDB` public server export'undan kaldırıldı.
- DEV throwaway runtime: cross-tenant create ret; server-derived ₺80 ve ₺40;
  online finalize+retry; cash/provider authority kontrastı; iki order'da
  `payment_method=split`; order/share token mapping geçti. Cleanup
  `restaurants=0, orders=0, shares=0`.
- Verify: domain **27/27**, application **39/39**, db **106/106**. Migration yok.

### Modüler monolith — Atomic split checkout & settlement ✅ (2026-07-16)

- `reserve_split_checkout` masa oturumunu kilitleyerek settled tutar + aktif
  provider rezervasyonlarını tek snapshot'ta hesaplar. Paralel checkout'lar aynı
  bakiyeyi iki kez ayıramaz; pre-token retry aynı rezervasyonu döndürür.
- `attach_split_checkout_token` rezervasyon/token mapping'ini tenant-scoped RPC
  ile bağlar. Token mapping başarısızsa menu route ödeme sayfasını fail-closed
  reddeder ve bağlanmamış rezervasyonu bırakır. Token bağlandıktan sonra gerçek
  callback ihtimali nedeniyle release yasaktır.
- `settle_payment_share_atomic` share settlement, kesin tutar, order
  `paid_at+split` finalizasyonu ve mevcut trigger üzerinden `order.settled`
  outbox yazımını tek DB transaction'ında tamamlar. Nakit başka provider
  rezervasyonunu tüketemez; callback retry idempotenttir. Eski iki-adımlı
  `settleShareDB` silindi.
- DEV migration'ları: `20260716070000_atomic_split_checkout_and_settlement.sql`
  ve tam ödeme sonrası token'sız stale beyanları atomik `void` eden
  `20260716080000_void_stale_split_intents.sql` uygulandı; generated type'lar
  yenilendi. **İkisi de PROD-at-deploy migration setine eklenmeli.** Anon dört
  RPC'ye kapalıdır.
- Gerçek DEV throwaway yarış matrisi: iki paralel ₺80 checkout → **₺80+₺20**,
  toplam **₺100**; release/reuse geçti, token-bound release ret; paralel settle
  tek finalizasyon + **1 `order.settled` outbox**, retry idempotent; provider'a
  ayrılmış ₺30'u nakit settle ret; iki stale niyet `void`; cross-tenant ret;
  anon RPC **42501**. Cleanup
  `restaurants=0, orders=0, shares=0, outbox=0`.
- Verify: application **40/40**, db **106/106**; workspace typecheck temiz;
  lint **0 error** (marketing'de mevcut 2 `img` warning); dashboard, menu ve
  kitchen production build temiz.

### Modüler monolith strangler — Menu ✅ (2026-07-15)

- Saf alerjen/diyet/nutrition/review kuralları `@garsonless/domain/menu` sahibidir; DB eski export'ları compatibility için delegasyon yapar.
- Kategori + ürün CRUD, kategori sırası ve bulk availability `@garsonless/application/menu` command'lerinden geçer. Tenant ve `menu` permission kontrolü infrastructure çağrısından önce yapılır.
- Supabase sahiplik/pozisyon/RPC ayrıntıları `createMenuCommandPort()` ile `@garsonless/db/server` içindedir. `apps/dashboard/lib/actions/menu.ts` doğrudan `.from()`/`mut()` çağırmaz.
- `20260715030000_menu_command_service_role.sql` DEV'e uygulandı: üç atomik menu RPC'si application adapter'ın service-role çağrısını kabul eder; anon execute hâlâ `42501`, authenticated eski `has_restaurant_section` kontrolünü korur. **PROD-at-deploy migration setine eklenmeli.**
- DEV throwaway runtime: create category/item, partial nutrition update, allergen `contains/traces` dedupe, review actor/timestamp, availability, reorder, delete, cross-tenant ret ve anon RPC `42501` geçti; cleanup `restaurantOrphans=0`. Test Cafe B yalnız owner fixture okumak için kullanıldı, maf-lounge'a dokunulmadı.
- Sıradaki strangler: customer identity/consent + campaigns → theme; ardından MenuManager/ThemeEditor büyük client shell parçalama ve legacy compatibility retirement.

### Modüler monolith strangler — Loyalty read boundary ✅ (2026-07-15)

- Tier, scope, puan/damga kazanım hesabı, `comp` kazanım yasağı ve indirim sırası (`free item → üye % → puan`) artık browser-safe `@garsonless/domain/loyalty` sahibidir. `packages/db/src/loyalty.ts` eski importları kırmamak için compatibility re-export tutar; saf kural kopyası taşımaz.
- Supabase Auth ile doğrulanan müşteri `customer-member` context'ine çevrilir. Menu SSR, `/api/loyalty/balances` ve `/api/loyalty/preview-discount` yalnız `@garsonless/application/loyalty` query'lerini çağırır; service-role uygulama call-site'ından `createLoyaltyQueryPort()` ile `@garsonless/db/server` içine çekildi.
- Guest preview application katmanında puan/damga/catalog redemption taleplerini sıfırlar; member context başka restaurant için replay edilirse repository çalışmadan reddedilir. Dashboard loyalty tier save doğrulaması doğrudan domain policy'sini kullanır.
- Ledger yazma, settlement earning/refund, welcome/visit bonusları ve eski phone-OTP retirement bu ilk loyalty diliminde davranış korunması için DB persistence modülünde kaldı; sonraki write-strangler/retirement işi olarak açık.
- DEV throwaway runtime: 500 spendable/lifetime puan + 4 damga → Gümüş; ₺100 sepette ₺10 üye + ₺10 puan indirimi → ₺80; guest aynı sepette ₺100 ve 0 redemption; cross-tenant replay reddedildi. Auth user + customer + restaurant temizlendi, `restaurantOrphans=0`, `customerOrphans=0`. Yeni migration gerekmedi.
- Verify: domain 15/15, application 16/16, db 106/106; domain/application/db/menu/dashboard typecheck + lint temiz; menu ve dashboard production build geçti.

### Modüler monolith strangler — Customer CRM boundary ✅ (2026-07-15)

- PII maskeleme, CRM read-model tipleri ve segment sanitizasyonu `@garsonless/domain/customers` sahibidir; DB eski export'ları compatibility için delegasyon yapar.
- Customers SSR liste/detayı, segment sayıları + CRUD ve manuel puan kredisi `@garsonless/application/customers` üzerinden `createCustomerApplicationPort()` / `@garsonless/db/server` sınırına taşındı. Dashboard customer call-site'ları doğrudan service-role CRM fonksiyonu çağırmaz.
- Tenant ve `customers` permission kontrolü porttan önce yapılır; segment creator ve kredi granter kimlikleri actor context'ten türetilir. Cross-tenant replay port çalışmadan reddedilir.
- DEV throwaway runtime: maskeli liste/detay, segment create→update→delete, 25 puan kredi, built-in counts ve cross-tenant ret geçti. Temizlik `restaurantOrphans=0`, `customerOrphans=0`, `segmentOrphans=0`; yeni migration gerekmedi.
- Customer auth linking, consent persistence ve campaigns audience hâlâ mevcut DB compatibility yolundadır; bir sonraki customer write/identity diliminde application portuna alınacak.
- Verify: domain 18/18, application 19/19, db 106/106; domain/application/db/dashboard/menu typecheck + lint temiz; dashboard ve menu production build geçti.

### Modüler monolith strangler — Customer identity, consent & campaigns ✅ (2026-07-16)

- First-login orchestration artık `@garsonless/application/customers` içindeki `ensureCustomerIdentity` sahibidir. Email normalizasyonu + provider name çözümü domain'dedir; Supabase `User` tipi application/domain sınırına girmez. Email dedupe/race linkleme, `app_metadata.user_type=customer`, restaurant association, welcome bonus ve consent persistence `createCustomerIdentityApplicationPort()` ile `@garsonless/db/server` arkasındadır.
- Yan etki sırası korunur: customer link → JWT metadata damgası → restaurant association → idempotent welcome bonus → yalnız açıkça `true` olan consent'ler. Bonus ve consent login'i kırmayan best-effort davranışını korur; gerekli link/stamp/association adımları fail-closed kalır.
- Member consent route'u `updateCustomerConsent` command'ini kullanır; doğrulanmış `customer-member` context'i başka tenant replay'ini port çalışmadan reddeder. Grant ve revoke yazımları CRM'nin `customer_restaurants` association'ını idempotent güncel tutar.
- Campaign audience sözleşmesi ve metin/audience sanitizasyonu `@garsonless/domain/campaigns` sahibidir. Customers SSR ve campaign actions `@garsonless/application/campaigns` + `createCampaignApplicationPort()` kullanır; audit `createdBy` request gövdesinden değil actor context'inden türetilir. Mevcut senkron SMS provider davranışı korunmuştur; campaign outbox/async delivery ayrı write-side dilimidir.
- DEV throwaway runtime: identity retry aynı customer id ve 1 satır; metadata `customer`; association 1; welcome bonus **1×15**; first-login consent yalnız `contact_data`; marketing grant sonrası audience **1 candidate / 1 eligible**; mock campaign **1 sent / 0 failed**; cross-tenant ret. Cleanup: restaurant/customer/campaign/consent/association orphan sayaçları **0**. Test Cafe B yalnız owner fixture okuması için kullanıldı, maf-lounge'a dokunulmadı.
- Verify: domain **21/21**, application **23/23**, db **106/106**; db/menu/dashboard typecheck, workspace lint (0 error; marketing'de mevcut 2 `img` warning), menu + dashboard production build temiz. Yeni migration gerekmedi.
- Açık retirement: legacy phone OTP route/session export'ları ve public DB compatibility barrel'i. Açık write-side: campaign provider gönderimini outbox consumer'a taşıma; loyalty settlement/visit/refund event consumer sınırı.

### Modüler monolith strangler — Theme ✅ (2026-07-16)

- Template doğrulama, token sanitizasyonu ve active/saved/preview çözümü kanonik browser-safe `@garsonless/design-engine/theme-policy` sahibidir. CSS'e taşınan renk/font değerleri doğrulanır, unknown alanlar atılır, sayı/collection sınırları uygulanır; editör SSR, menu layout, ana menu ve masa menu aynı resolver'ı kullanır.
- Tema read/publish akışları `@garsonless/application/themes` üzerinden `createThemeApplicationPort()` / `@garsonless/db/server` sınırına taşındı. Tenant + `theme` izni porttan önce kontrol edilir; `updated_by` request'ten değil actor context'ten türetilir.
- Template picker artık yalnız editor/preview rotasını açar; seçim tek başına canlı template'i değiştirmez. **Yayınla**, `theme_configs.tokens` + `updated_by` ile `restaurants.settings.active_template_id` değerini `publish_theme_config_atomic` RPC'sinde tek transaction'da yazar ve ilgisiz settings anahtarlarını korur.
- `20260716010000_publish_theme_config_atomic.sql` DEV'e uygulandı, tipler üretildi. **PROD-at-deploy migration setine eklenmeli.** RPC public/anon/authenticated rollerine kapalı, yalnız service role'a açıktır.
- DEV throwaway runtime: obsidian publish, settings marker koruma, CSS-shaped bg/font sanitizasyonu, publisher audit, retry'da **1 config**, ortak public read, cross-tenant ret, missing-restaurant rollback **0 orphan**, anon RPC `42501`; cleanup restaurant/theme config **0/0**. Test Cafe B yalnız owner fixture okuması için kullanıldı, maf-lounge'a dokunulmadı.
- Verify: application **27/27**, db **106/106**; workspace typecheck tüm paketlerde temiz; lint **0 error** (marketing'de mevcut 2 `img` warning); dashboard + menu production build geçti.
- Sıradaki dilimler: loyalty/campaign write-side outbox consumer'ları; `ThemeEditorClient`/`MenuManager` feature-state/view/command-hook parçalama; compatibility/session/OTP retirement.

### Modüler monolith strangler — Loyalty & campaign write-side outbox ✅ (2026-07-16)

- Typed domain event sözlüğü `@garsonless/domain/events`, receipt-first consumer orkestrasyonu `@garsonless/application/outbox` sahibidir. Settlement/served loyalty earn, cancellation refund, normal table-close visit ve welcome bonus call-site'ları artık doğrudan ledger yazmaz; ilgili outbox event'ini `loyalty-ledger` consumer'ına dispatch eder. `comp` ödeme event olarak teslim edilse bile domain policy gereği **0 earn** üretir.
- Campaign send artık recipient snapshot + campaign + `campaign.delivery_requested` event'ini `queue_campaign_delivery_atomic` RPC'sinde atomik yazar. `campaign-sms` consumer recipient'ları claim/complete/finalize RPC'leriyle işler; receipt redelivery'yi no-op yapar. Provider çağrısı ortasında crash olan `processing` recipient otomatik yeniden gönderilmez; çift SMS yerine görünür failed/unknown sonucu korunur.
- Dashboard'daki `/api/internal/outbox` Node consumer route'u `OUTBOX_WORKER_SECRET` ile korunur. Edge worker `OUTBOX_CONSUMER_URL` tanımsızken durable event'i ACK'lemek yerine `defer_domain_outbox` ile lease'i bırakır, claim attempt'ini geri alır ve bir saat erteler. DEV worker bu güvenli sürümle deploy edildi. PROD'da dashboard secret + Edge secret aynı olmalı ve `OUTBOX_CONSUMER_URL=https://<dashboard>/api/internal/outbox` kurulmalıdır.
- DEV'e uygulanan ve **PROD-at-deploy setine eklenmesi gereken** migration'lar: `20260716020000_loyalty_campaign_outbox_consumers.sql`, `20260716030000_welcome_bonus_idempotency.sql`, `20260716040000_outbox_enqueue_service_role.sql`, `20260716050000_defer_unconfigured_outbox_consumer.sql`.
- Gerçek DEV throwaway runtime: paid settlement **100 puan + 2 damga**, retry no-op; comp **0 earn**; normal close **1 ziyaret**; welcome retry **1×15**; cancel **1×20 refund**; campaign **1 sent / 1 provider attempt / 1 terminal event**, redelivery no-op; cross-tenant campaign RPC **42501**; 5 durable receipt. Safe rollout testi: `attempts=0`, `processed_at=null`, `locked_by=null`, future `available_at`, URL-not-configured hata kaydı. Cleanup restaurant/customer/campaign/ledger/outbox sayaçları **0**; Test Cafe B yalnız owner fixture okumasında kullanıldı, maf-lounge'a dokunulmadı.
- Verify: domain **24/24**, application **30/30**, db **106/106**; workspace typecheck temiz; lint **0 error** (marketing'de mevcut 2 `img` warning); marketing/dashboard/menu/kitchen production build temiz.
- Sıradaki dilim: büyük client shell'leri (`MenuManager`, `ThemeEditorClient`, `TablesBuilderShell`) feature-state/view/command-hook parçalarına ayırmak; ardından compatibility/session/OTP retirement.

### Büyük client shell ayrıştırma — MenuManager dilimi ✅ (2026-07-16)

- `MenuManager` CSV içe aktarma state'i, dosya/başlık/satır doğrulaması, kategori+ürün command orkestrasyonu, progress, hata raporu ve şablon indirme davranışı `use-menu-csv-import.ts` feature hook'una taşındı. Ana shell artık CSV server action çağrıları veya parse kuralı taşımıyor.
- CSV başlangıç ve önizleme yüzeyleri `MenuCsvImportOverlays.tsx` presentational bileşenlerindedir. Kategori/sub-kategori seçimi, global arama görünürlüğü, panel kategorisi ve nav highlight türetimleri saf `deriveMenuManagerView` projection'ında tekleştirildi; 3 unit test parent+child fold, sub-category daraltma ve cross-category aramayı kilitliyor.
- Ana `MenuManager.tsx` davranış değişmeden **2.840 → 2.328 satıra** indi. CSV import onayı runtime testte özellikle verilmedi; Test Cafe B owner session ile ekran **200**, başlangıç modalı görünür, geçerli dosya **1 hazır**, onay enabled, iptal kapanışı doğru ve browser console/page error **0**. Tenant verisine yazılmadı; maf-lounge'a dokunulmadı.
- Verify: yeni view-model testleri **3/3**, dashboard typecheck, lint ve production build temiz. Migration yok. Sıradaki client-shell dilimi `ThemeEditorClient`; sonrasında `TablesBuilderShell`, kalan MenuManager edit/category workspace parçaları ve compatibility/session/OTP retirement.

### Büyük client shell ayrıştırma — ThemeEditorClient preview dilimi ✅ (2026-07-16)

- Tema preview iframe'inin origin sınırı, `PREVIEW_READY → FULL_THEME_UPDATE → THEME_APPLIED` handshake'i, request korelasyonu, 5 saniyelik degraded fallback ve güvenli reload davranışı `use-theme-preview-bridge.ts` feature hook'una taşındı. Ana editor shell artık window message listener'ı, timeout veya iframe request ref'i taşımıyor.
- Iframe loading/ready yüzeyi `ThemePreviewSurface.tsx`, editor üst barı `ThemeEditorTopbar.tsx` salt-props view bileşenleridir. Undo/redo, dirty state ve publish command sahipliği ana orchestrator'da kaldı; route, postMessage sözleşmesi ve tema alanları değişmedi.
- Ana `ThemeEditorClient.tsx` mevcut dirty çalışmaları koruyarak **4.980 → 4.710 satıra** indi. Origin guard testleri **2/2**, dashboard typecheck/lint/build temiz.
- Test Cafe B owner session salt-okunur runtime: editor **200**, iframe handshake **ready**, mobil/masaüstü geçişi doğru, Header range değişikliği dirty state'i **1 değişiklik** yaptı ve preview `ready` kaldı; **0 write/publish request**, browser console/page error **0**. Test için açılan 3005/3013 süreçleri kapatıldı, tenant verisine yazılmadı.
- Sıradaki client-shell dilimi `TablesBuilderShell`; ardından kalan `ThemeEditorClient` property/page-flow panelleri, MenuManager edit/category workspace parçaları ve compatibility/session/OTP retirement.

### Büyük client shell ayrıştırma — TablesBuilderShell QR stil dilimi ✅ (2026-07-16)

- QR stilinin normalize/default/URL/kontrast kuralları ile 60-snapshot history, slider coalescing, undo/redo ve redo-cut davranışı `tables-builder-model.ts` saf modülüne taşındı. Masa DB→view projection'ı ve açık-session fold'u da aynı browser-safe model sınırında; `TablesBuilderShell` artık bu kuralları tekrar etmiyor.
- History, 650 ms autosave, latest-pending-save kuyruğu, unload guard ve QR okunabilirlik yaşam döngüsünün tek sahibi `use-qr-style-editor.ts` feature hook'udur. Okunabilirlik uyarısı `QRHealthDialog.tsx` salt-props view bileşenine ayrıldı; masa/session/realtime/payment akışları bu dilimde değiştirilmedi.
- Ana `TablesBuilderShell.tsx` **2.982 → 2.639 satıra** indi. Saf model matrisi **5/5**: custom-domain kilidi + enum fallback, revocable-token URL/UTM encoding, undo sonrası redo-cut, slider'ın tek undo adımı olması, 60 history cap + gradient'in en zayıf kontrastı.
- Test Cafe B owner-session runtime: route **200**, QR Studio mount, preset autosave ve undo autosave DB'de doğrulandı, redo yeniden erişilebilir, QR sağlık sonucu **4.8:1 / geçerli**, browser console error **0**. Test sonunda `settings.qr_style` snapshot'ı birebir geri yüklendi; orders/session verisine ve maf-lounge'a dokunulmadı.
- Verify: dashboard typecheck, lint ve production build temiz. Migration yok. Sonraki canlı-state dilimi aşağıda tamamlandı.

### Büyük client shell ayrıştırma — TablesBuilderShell canlı state dilimi ✅ (2026-07-16)

- Açık adisyon aggregate yükleme, stale-response sequence guard, `table_sessions`/`orders`/`payment_shares` realtime invalidation debounce'u, pending service-request yükleme/resolve ve settlement-or-direct-close kararı `use-tables-live-state.ts` feature hook'una taşındı. Shell artık Supabase browser client, channel veya bu server action'ları doğrudan taşımıyor.
- `applySessionsToTables`, `requestsByTable`, `removePendingRequest` ve para koruması `sessionRequiresSettlement` saf model kurallarıdır. Özellikle unpaid veya split-cash onayı bekleyen session'ın doğrudan kapanamaması hook ile UI arasında tekrar edilmez.
- Ana `TablesBuilderShell.tsx` bu dilimde **2.639 → 2.520 satıra**, iki Tables dilimi toplamında **2.982 → 2.520 satıra** indi. Model matrisi **8/8**: önceki 5 QR kuralı + authoritative active/idle fold + pending-request group/remove + settlement guard.
- Test Cafe B owner-session salt-okunur runtime: route **200**; DB **3 masa / 1 açık session / 0 pending request**, UI aynı; `tables-sessions:*` ve `tables-service-requests:*` topic'leri tek WebSocket'te, toplam **4 postgres_changes subscription** kurulu; browser console error **0**. Restaurant settings/tables/sessions/service_requests snapshot'ı değişmedi; maf-lounge'a dokunulmadı.
- Verify: dashboard typecheck, lint ve production build temiz. Migration yok. Sıradaki client-shell dilimi `ThemeEditorClient` property/page-flow panelleri; ardından MenuManager edit/category workspace ve compatibility/session/OTP retirement.

### Büyük client shell ayrıştırma — TablesBuilderShell QR Studio view dilimi ✅ (2026-07-17)

- Sağ QR Stüdyosu panelinin accordion/field/slider/segmented/color/toggle
  primitive'leri; şekil, renk, logo, çerçeve ve veri sekmeleri; logo küçültme
  doğrulaması ve save-state görünümü `TablesQRProperties.tsx` callback-driven UI
  sınırına taşındı.
- Yeni view `QRConfig`, `TableItem`, `SaveState` ve typed callback'ler dışında
  feature bağımlılığı taşımaz; server action, Supabase, realtime ve editor hook'u
  import etmez. QR history/autosave `use-qr-style-editor`, canlı masa/session
  akışı `use-tables-live-state`, root koordinasyonu `TablesBuilderShell` sahibi
  olmaya devam eder.
- `TablesBuilderShell.tsx` bu dilimde **2.520 → 1.956 satıra**, üç Tables
  dilimi toplamında **2.982 → 1.956 satıra** indi. Kaynak-seviye fitness testi
  panel delegasyonunu, callback-only view sınırını ve 2.000 satır shell bütçesini
  korur. Persistence, QR token, export, masa CRUD ve session davranışı değişmedi;
  migration yok.

### Büyük client shell ayrıştırma — TablesBuilderShell masa yönetimi dilimi ✅ (2026-07-17)

- Sol masa navigasyonu, arama, canlı session/servis isteği görünümü ve add/rename/delete etkileşimleri `TablesNavigation.tsx` feature view sınırına taşındı. View server action çağırmaz; yalnız yerel view sözleşmeleri, callback'ler ve `useTableManagement` controller'ı ile çalışır.
- Masa CRUD server action orkestrasyonu ve pending/error form state'i `use-table-management.ts` sahibidir. Arama, rename projection'ı ve aktif masa silindikten sonraki seçim `tables-builder-model.ts` içindeki browser-safe saf kurallara ayrıldı; Türkçe arama ve slug eşleşmesi deterministik test edilir.
- `TablesBuilderShell.tsx` bu dilimde **1.956 → 1.429 satıra**, dört Tables dilimi toplamında **2.982 → 1.429 satıra** indi. Kaynak-seviye fitness testi shell delegasyonunu, view/action ayrımını ve **1.450 satır** bütçesini korur. Tables matrisi **14/14** temizdir; masa CRUD persistence sözleşmesi, QR token, session/settlement ve realtime davranışı değişmedi, migration yok.

### Büyük client shell ayrıştırma — TablesBuilderShell QR canvas/export dilimi ✅ (2026-07-17)

- Tek/ızgara/baskı QR çalışma yüzeyi, lazy görünür kart render'ı, kopyalama, export progress/error state'i ve indirme menüsü `TablesQRCanvas.tsx` salt feature view sınırına taşındı. QR instance ref'i artık view'in iç detayıdır; root shell yalnız QR config, seçili masa, health ve token-rotation callback'i verir.
- QR styling lazy-loader'ı, SVG kart üretimi, kamera-benzeri `jsQR` okunabilirlik testi, PNG/JPG/SVG indirme ve A4 yazdırma adaptörleri `tables-qr-renderer.ts` teknik sınırındadır. View ve renderer server action, Supabase, tenant context veya realtime bağımlılığı taşımaz. Export dosya adı Türkçe `İ/ı` karakterlerinde okunur ve güvenli normalize edilir; SVG metni escape testiyle korunur.
- `TablesBuilderShell.tsx` bu dilimde **1.429 → 754 satıra**, beş Tables dilimi toplamında **2.982 → 754 satıra** indi. Fitness bütçesi **800 satıra** sıkılaştırıldı; Tables matrisi **18/18** temizdir. URL/token, okunabilirlik eşikleri, export formatları, persistence ve tenant verisi değişmedi; migration yok.

### Büyük client shell ayrıştırma — TablesBuilderShell chrome view dilimi ✅ (2026-07-17)

- Hazır stil/preset topbar'ı, save/undo/redo/bildirim/önizleme görünümü, otomatik-kayıt statusbar'ı ve telefon önizleme overlay'i `TablesBuilderChrome.tsx` view sınırına taşındı. Root shell yalnız editor, realtime, masa yönetimi, canvas, properties ve chrome feature'larını koordine eder.
- Chrome görünümü server action, Supabase, realtime veya feature hook'u import etmez. Yalnız topbar'ın mevcut bildirim sayacı ve panel açma davranışı için dashboard `useShell` context'ini okur; token rotasyonu ve settlement komutları root shell'de kalır.
- `TablesBuilderShell.tsx` bu dilimde **754 → 306 satıra**, altı Tables dilimi toplamında **2.982 → 306 satıra** indi. Fitness bütçesi **350 satıra** sıkılaştırıldı; Tables matrisi chrome delegasyonu ve infrastructure izolasyonunu da korur. UI davranışı, persistence, token/session akışları ve tenant verisi değişmedi; migration yok.

### Büyük client shell ayrıştırma — QR token rotation controller dilimi ✅ (2026-07-17)

- QR credential rotasyonunun onay/hedef/pending/error yaşam döngüsü ve `rotateTableQrToken` server-action orkestrasyonu `use-table-qr-token-rotation.ts` controller sınırına taşındı. Başarılı sonuç yalnız hedef masaya `replaceTableQrToken` saf projection'ı ile uygulanır; aynı anda ikinci komut çalıştırılmaz.
- Native `window.confirm` kaldırıldı. `TablesQRRotationDialog.tsx` eski QR'ın hemen geçersiz kalacağını ve baskıların yenilenmesi gerektiğini açıkça anlatan erişilebilir `alertdialog` view'udur; action/infrastructure bağımlılığı taşımaz, action hatasını dialog içinde tutar ve yeniden denemeye izin verir.
- Root shell token action'ını doğrudan import etmez; controller ve dialog'u koordine eder ve **317 satırla** 350 satırlık bütçenin altında kalır. Tables matrisi saf token projection'ı, controller/action sahipliği, double-submit guard'ı ve view izolasyonunu da kapsar. Server-side tenant gate'i, atomik credential rotasyonu, URL formatı ve migration durumu değişmedi.

### Büyük client shell ayrıştırma — ThemeEditorClient property/page-flow dilimi ✅ (2026-07-16)

- Sayfa akışının stored/legacy normalize kuralı, stale/duplicate blok temizliği, alt-kategori kapsamı, parent+child grup taşıma, bölüm ekleme/silme ve klavye hedef çözümü `theme-page-flow-model.ts` browser-safe saf modülüne taşındı. UI artık bu kuralları kendi event handler'larında tekrar etmiyor.
- Sağ özellik panelinin tab sınıflandırması, geçerli-tab fallback'i ve Cards/Nav/Header/Cart/Announcement koşullu alan görünürlüğü `theme-editor-properties-model.ts` projection sınırındadır. Panel header/tab/scroll/footer kabuğu ve erişilebilir tab semantics'i `ThemePropertiesFrame.tsx` salt-props view bileşenine ayrıldı.
- Ana `ThemeEditorClient.tsx` bu dilimde **4.710 → 4.430 satıra**, preview + property/page-flow dilimleri toplamında **4.980 → 4.430 satıra** indi. Saf model matrisi **13/13**: akış sanitize/legacy/category-scope/reorder/keyboard ile property tab/fallback ve conditional visibility kapıları.
- Test Cafe B owner-session salt-okunur runtime: route **200**, **5** akış öğesi, Kategori Menüsü klavye ile yer değiştirdi, sağ panel `Navigasyon / Tasarım / Düzen / İçerik` olarak açıldı, preview **ready**, dirty göstergesi **1**, browser console/page error **0**. `theme_configs` snapshot digest'i test öncesi/sonrası birebir aynı; publish/write yapılmadı ve geçici 3005 süreci kapatıldı.
- Verify: dashboard typecheck, lint ve production build temiz. Migration yok. Sıradaki client-shell dilimi `MenuManager` edit/category workspace; ardından kalan Theme property renderer alt bileşenleri ve compatibility/session/OTP retirement.

### Büyük client shell ayrıştırma — MenuManager edit/category workspace dilimi ✅ (2026-07-16)

- Kategori rail'i; arama sırasında parent görünürlüğü, aktif üst kategori, özet sayıları, add/edit/sub-category/delete yaşam döngüsü ve lazy DnD bağlantısıyla birlikte `MenuCategoryWorkspace.tsx` feature sınırına taşındı. Recursive kategori silme kapsamı `collectCategoryTreeIds` ile bütün descendant'ları kapsıyor; tek seviyeli eski toplama kaldırıldı.
- Ürün editor dirty karşılaştırması `menu-item-editor-model.ts` saf snapshot kuralına alındı. Inherited VAT/station backing değerleri yalancı dirty üretmiyor; nutrition, images ve modifier gibi nested alanlar deterministik karşılaştırılıyor. Header/scroll/footer/overlay kabuğu `MenuItemEditorFrame.tsx`, ortak onay yüzeyi `MenuConfirmDialog.tsx` salt-props view bileşenleridir.
- Ana `MenuManager.tsx` bu dilimde **2.328 → 1.921 satıra**, CSV + edit/category dilimleri toplamında **2.840 → 1.921 satıra** indi. Saf model matrisi **10/10**: category parent-search fold, recursive delete, reorder merge; editor clean/inherited/custom/nested dirty; mevcut menu view-model seçim/arama kuralları.
- Test Cafe B owner-session salt-okunur runtime: route **200**, 3 ürün kartı; panel `aside` sınırı açıldı, yerel açıklama değişikliği dirty oldu, ikinci ürüne geçişte koruma dialog'u açıldı ve “Düzenlemeye dön” aynı ürünü korudu. `matcha` araması parent `Kahve`yi görünür tuttu. Browser console/page error **0**, mutation request **0**; **6 kategori / 8 ürün** DB digest'i önce/sonra aynı (`1e7a583ed3bd17b7`).
- Verify: dashboard typecheck, lint ve production build temiz. Migration yok. Sıradaki client-shell dilimi kalan Theme property renderer alt bileşenleri; ardından compatibility/session/OTP retirement.

### Büyük client shell ayrıştırma — MenuManager command controller dilimi ✅ (2026-07-17)

- Kategori ağacı silme/sıralama, ürün hızlı fiyat-yayın güncellemesi ve bulk availability optimistic/rollback orkestrasyonu `use-menu-manager-commands.ts` controller sınırına taşındı. `MenuManager` bu dört server action'ı doğrudan import etmez; yalnız controller callback'lerini kategori ve ürün workspace'lerine bağlar.
- Recursive kategori+ürün kaldırma/aktif-kategori fallback'i ile hedef ürün/seçili editor patch'i `menu-manager-command-model.ts` browser-safe saf projection'larıdır. Hızlı ürün update'i functional state yazar; eşzamanlı başka kart değişikliği stale snapshot ile ezilmez. Server hata rollback'i ve kullanıcı mesajları korunur.
- `MenuManager.tsx` **1.921 → 1.852 satıra** indi ve yeni **1.875 satır** fitness bütçesiyle kilitlendi. Saf command-model matrisi recursive delete, aktif kategori koruma ve hedef ürün identity paylaşımını kapsar. HTTP/application port sözleşmesi, tenant gate'i, DB verisi ve migration durumu değişmedi.

### Büyük client shell ayrıştırma — MenuManager option editor view dilimi ✅ (2026-07-17)

- Varyant/modifier grup ve seçenek editörü; fiyat/kalori farkı, varsayılan seçenek ve çoklu alerjen dropdown yaşam döngüsüyle birlikte `MenuModifierGroupEditor.tsx` salt-props view sınırına taşındı. Bileşen yalnız typed grup dizisi + `onChange` alır; tenant kimliği, server action veya Supabase erişimi taşımaz.
- `MenuManager` modifier state'ini ürün dirty snapshot'ına ve mevcut kayıt action'ına bağlamaya devam eder, ancak alerjen sözlüğü ve seçenek düzenleme markup'ını sahiplenmez. Ürün persistence/validation, HTTP ve application port sözleşmeleri değişmedi.
- `MenuManager.tsx` **1.852 → 1.481 satıra**, tüm MenuManager dilimlerinde **2.840 → 1.481 satıra** indi. Kaynak-seviye fitness testi delegasyonu, view infrastructure izolasyonunu, listbox semantiğini ve sıkılaştırılan **1.500 satır** bütçesini korur. Migration ve tenant verisi değişikliği yok.

### Büyük client shell ayrıştırma — MenuManager item editor feature dilimi ✅ (2026-07-17)

- Ürün düzenleyicinin ad/açıklama, fiyat/KDV/istasyon, nutrition, görsel ve modifier state'i; dirty snapshot + `beforeunload` koruması, browser storage upload ve ürün save/delete orkestrasyonuyla birlikte `MenuItemEditPanel.tsx` feature sınırına taşındı.
- Ana `MenuManager` ürün action'larını, storage client'ını, nutrition/modifier editörlerini veya dirty equality kuralını import etmez. Yalnız seçili ürünü panele verir; `onSaved`, `onDeleted` ve `onDirtyChange` callback'leriyle liste/seçim ve çıkış korumasını uzlaştırır. Feature panel service-role veya `@garsonless/db/server` erişimi taşımaz.
- `MenuManager.tsx` **1.481 → 886 satıra**, tüm MenuManager dilimlerinde **2.840 → 886 satıra** indi. Menu fitness matrisi **18/18**; feature delegasyonu ve sıkılaştırılan **900 satır** orchestrator bütçesi kilitlidir. Persistence/validation/HTTP sözleşmesi, migration ve tenant verisi değişmedi.

### Büyük client shell ayrıştırma — MenuManager product workspace dilimi ✅ (2026-07-17)

- Ürün grid/list görünümü, aktif/pasif filtreleri, alt-kategori tabları, toplu seçim yaşam döngüsü, hızlı fiyat/yayın callback'leri ve kart/list/empty yüzeyleri `MenuItemsWorkspace.tsx` feature sınırına taşındı.
- Workspace yalnız typed ürün/category projection'ları ve callback'ler alır; server action, Supabase veya restaurant kimliği taşımaz. Ana `MenuManager` hesaplanmış görünür ürünleri, seçili ürünü ve command controller'ın quick/bulk callback'lerini bağlar; kart markup'ı veya yerel filtre/seçim state'i taşımaz.
- `MenuManager.tsx` **886 → 447 satıra**, tüm MenuManager dilimlerinde **2.840 → 447 satıra** indi. Menu fitness matrisi **19/19**; workspace infrastructure izolasyonu ve sıkılaştırılan **450 satır** orchestrator bütçesi kilitlidir. Persistence/validation/HTTP sözleşmesi, migration ve tenant verisi değişmedi.

### Büyük client shell ayrıştırma — MenuManager shell state/chrome dilimi ✅ (2026-07-17)

- Mounted yaşam döngüsü, arama ve `Cmd/Ctrl+K` odağı, kategori/alt-kategori/ürün seçimi, dirty editörden korumalı çıkış, toast ve yeni-ürün drawer state'i `use-menu-manager-shell-state.ts` controller sınırına taşındı. Liste projection uzlaştırmaları action adlarından ayrışan `addCategory`, `updateCategory`, `saveItem`, `removeItem` ve `createItem` callback'leriyle yapılır.
- Topbar, skeleton, empty state ve toast yüzeyleri `MenuManagerChrome.tsx` salt-props view bileşenlerine ayrıldı. Bu view'lar tenant kimliği, server action veya Supabase erişimi taşımaz; ana shell yalnız command/controller, CSV ve feature callback'lerini bağlar.
- `MenuManager.tsx` **447 → 226 satıra**, tüm MenuManager dilimlerinde **2.840 → 226 satıra** indi. Menu fitness matrisi **21/21**; shell-state ve chrome infrastructure izolasyonu ile sıkılaştırılan **240 satır** orchestrator bütçesi kilitlidir. Persistence/validation/HTTP sözleşmesi, migration ve tenant verisi değişmedi.

### Büyük client shell ayrıştırma — ThemeEditorClient property renderer dilimi ✅ (2026-07-16)

- Header, Kartlar, Navigasyon, Düzen, Tema, Sepet ve Duyuru sağ-panel renderer'ları ile ortak alan/renk/range/toggle/select kontrolleri `ThemePropertyPanels.tsx` salt-props UI sınırına taşındı. Ana shell artık yedi panelin görsel hiyerarşisini veya kontrol markup'ını taşımıyor.
- Renk kontrastı, soft-color türetimi, güvenli control id üretimi ve header/footer sepet erişiminin karşılıklı dışlama kuralı `theme-property-renderer-model.ts` saf modelindedir. Geçersiz renk kontrastı fail-closed davranır; tiled seçimler gerçek `aria-pressed` semantiği taşır.
- Ana `ThemeEditorClient.tsx` bu dilimde **4.430 → 3.631 satıra**, üç Theme dilimi toplamında **4.980 → 3.631 satıra** indi. Theme model matrisi **20/20**: yeni renderer kuralları 5/5, property projection 5/5, page-flow 8/8 ve preview bridge 2/2.
- Test Cafe B owner-session salt-okunur runtime: route **200**, yedi renderer panelinin tamamı mount oldu; Sepet `İkon + Rozet` seçimi `aria-pressed=true` olurken `Floating Pill=false` kaldı, dirty göstergesi **1**, erişilebilirlik bölümü görünür ve preview **ready**. Mutation request **0**, browser console/page error **0**; theme snapshot digest'i önce/sonra aynı (`3b06e94672a3822a`).
- Verify: dashboard typecheck, lint ve production build temiz. Migration yok. Sıradaki client-shell dilimi Theme section-settings renderer kontrolleri; ardından compatibility/session/OTP retirement.

### Büyük client shell ayrıştırma — Theme property control boundary ✅ (2026-07-20)

- Header, Kartlar, Navigasyon, Düzen, Tema, Sepet ve Duyuru panellerinin ortak renk/range/toggle/select/accordion markup'ı `ThemePropertyControls.tsx` bileşenine ayrıldı. `ThemePropertyPanels.tsx` artık yalnız panel kompozisyonu, grup görünürlüğü ve panel-özel not/invariant bağlama sorumluluğunu taşır.
- `ThemeEditorPropertiesWorkspace` range kontrol CSS'ini tek kez yükler; visual davranış ve control id sözleşmesi değişmez. Mimari test, panelin ortak kontrol implementasyonlarını geri almamasını ve control boundary'nin tenant/action/Supabase erişimi taşımamasını kilitler.

### Büyük client shell ayrıştırma — Pano overview boundary ✅ (2026-07-20)

- Pano'nun KPI karşılaştırmaları, karşılama metni, izinli hızlı aksiyonları ve
  gerçek sinyallerden türetilen bağlantı durumu `pano-view-model.ts` saf
  projection modeline taşındı. Ödeme yapılandırması yalnız owner'a görünür;
  realtime ve son sipariş durumu uydurulmadan aynı modelden türetilir.
- KPI, en çok satanlar, yoğun saatler, hızlı işlemler, sistem sağlığı ve ortak
  kart iskeleti `PanoOverviewWidgets.tsx` sunum sınırına alındı. Bu sınır action,
  Supabase ve restoran kimliği taşımaz; ana shell yalnız gerçek zamanlı abonelik,
  snapshot yenileme, yeni sipariş/floor-plan yaşam döngüsü ve command akışını
  orkestre eder.
- `PanoClient.tsx` **1.076 → 760 satıra** indi. Yeni model/architecture matrisi
  KPI karşılaştırması, izin filtresi, gerçek health sinyalleri, tenant-agnostic
  widget kuralı ve **780 satır** shell bütçesini kilitler. Verify: dashboard
  architecture **147/147**, typecheck, lint ve production build temiz. Migration
  veya tenant veri yazısı yok.

### Büyük client shell ayrıştırma — Pano tahsilat grafiği controller/view dilimi ✅ (2026-07-20)

- Tahsilat grafiğinin `Bugün / 7 gün / 30 gün` seçimi, server refresh'i,
  hata/retry durumu ve stale-response sıralaması `use-pano-sales-chart.ts`
  controller'ına taşındı. Başlangıçtaki saatlik SSR verisi `pano-chart-model.ts`
  ile browser-safe olarak projekte edilir; client shell artık chart action'ını veya
  transition state'ini doğrudan taşımaz.
- SVG, klavye ile odaklanabilir veri çubukları, tooltip, `aria-pressed` aralık
  seçimi ve legend yüzeyi `PanoSalesChart.tsx` sunum sınırındadır. Model, view
  ve controller fitness testleri action/Supabase sızıntısını ve davranışsal
  chart özetini korur.
- `PanoClient.tsx` **760 → 570 satıra** indi (başlangıç shell'i **1.076**
  satırdı). Dashboard architecture matrisi **150/150**, typecheck, lint ve
  production build temiz; migration veya tenant veri yazısı yok.

### Büyük client shell ayrıştırma — Pano canlı akış/controller dilimi ✅ (2026-07-20)

- Pano snapshot yenilemesi, 250 ms debounce, tek restaurant-scoped realtime
  channel, canlı feed patch'i, masa durumları ve bağlantı liveness'i
  `use-pano-live-state.ts` controller'ının sorumluluğuna taşındı. Root shell
  artık browser Supabase client'ı veya Pano snapshot/table server action'larını
  doğrudan import etmez.
- Canlı akışın durum/tooltip/boş-state görünümü `PanoActivityFeed.tsx` salt
  view sınırında. `pending_approval → sent_to_kitchen` komutu,
  action hata yüzeyi ve aynı sipariş için çift-submit guard'ı
  `use-pano-order-approval.ts` controller'ında; view tenant kimliği veya action
  erişimi taşımaz.
- `PanoClient.tsx` **570 → 294 satıra** indi (başlangıç shell'i **1.076**
  satırdı). Dashboard architecture matrisi **151/151**, typecheck, lint ve
  production build temiz; migration veya tenant veri yazısı yok.

### Büyük client shell ayrıştırma — ThemeEditorClient section settings dilimi ✅ (2026-07-16)

- Özel bölüm alanlarının text/textarea/color/range/select/toggle, ürün-kategori hedefi ve galeri yükleme yüzeyleri `ThemeSectionSettings.tsx` feature sınırına taşındı. Galeri kutuları artık gerçek erişilebilir butonlar; yükle/değiştir/kaldır aksiyonları ayrı adlandırıldı, tiled seçimler `aria-pressed` ve range değerleri ilişkili `output` kullanıyor.
- Hedef türüne göre alan görünürlüğü, promo-slide default/kapı kuralları, combo kart+ikon sayısı, deterministik control id/etiket ve ürünlerin kategori bazlı gruplaması `theme-section-settings-model.ts` saf projection'ındadır. Bozuk sayısal stored değerler sınırlı fallback ile fail-closed davranır.
- Ana `ThemeEditorClient.tsx` bu dilimde **3.631 → 3.011 satıra**, dört Theme dilimi toplamında **4.980 → 3.011 satıra** indi. Genişletilmiş Theme model matrisi **25/25** geçti.
- Test Cafe B owner-session salt-okunur runtime: Hero Banner yerel olarak eklendi; category/link hedef kapıları sırasıyla **1/1** render edildi ve kategori alanı link seçiminde **0** oldu. Düzen sekmesinde **3 range + 3 output**, Tasarım'da **5 renk kontrolü**; Foto Galerisi'nde **6 erişilebilir upload butonu** doğrulandı. Preview **ready**, dirty göstergesi **1**, mutation request ve browser hatası **0**; theme digest önce/sonra aynı (`3b06e94672a3822a`).
- Verify: dashboard typecheck, lint ve production build temiz. Migration yok. Sıradaki mimari dilim compatibility/session/OTP ve kalan eski public barrel/service-role import retirement'ı.

### Compatibility/session/OTP retirement ✅ (2026-07-16)

- Legacy telefon OTP request/verify/logout route'ları, dev-code echo yolu ve `packages/db/src/session.ts` içindeki `gl_member` JWT/cookie sistemi kaldırıldı. Customer identity yalnız Supabase Auth email OTP/OAuth + `customers.auth_user_id` linkiyle çözülür.
- Menu boot instrumentation ve `CUSTOMER_SESSION_SECRET`/SMS env zorunluluğu kaldırıldı. SMS provider kampanya gönderimleri için korunur; `SmsPurpose` artık yalnız `campaign|test`, config guard auth secret'ı bilmez.
- `createServiceClient` root `@garsonless/db` barrel'ından çıkarıldı; bütün app call-site'ları `@garsonless/db/server` sınırına taşındı. ESLint eski named importu error ile engeller. Geniş root compatibility barrel'ının diğer export'ları sonraki ölçümlü retirement diliminde kalır.
- `20260716060000_retire_phone_otp.sql` DEV'e uygulandı ve generated type'lar yenilendi. Gerçek DB sorgusu `public.otp_codes` için `PGRST205`; migration **PROD-at-deploy setine eklenmeli**.
- Runtime: menu production build `CUSTOMER_SESSION_SECRET` unset iken ayağa kalktı; üç eski loyalty route **404**, guest whoami **authenticated:false**, sahte `gl_member` yine false; `sutlacgullac@gmail.com` Supabase session'ı whoami **authenticated:true** ve Test Cafe B balances **200/ok** döndürdü.
- Verify: db **106/106**, tüm workspace typecheck temiz, lint **0 error** (marketing'de mevcut 2 `img` warning), dashboard + menu production build temiz.

### Settings honesty hardening — in progress

- Settings screens must not show live-looking controls without a backend. API keys/webhooks, subscription billing and translation pipeline are disabled/read-only until their real epics exist. `restaurants.settings` is public-menu readable, so secret-like values such as legacy `api_key` are removed by migration and must not be stored there again.
- **Migration `20260707010000_remove_settings_api_key.sql` (`update restaurants set settings = settings - 'api_key' where settings ? 'api_key'`) — applied to DEV 2026-07-07 (`supabase db push`; local==remote through `20260707010000`; earlier session created it but couldn't push, no access token).** ⚠️ **PROD-at-deploy: MUST also run on prod** (`svxvloeosiksqfadgkvo` / garsonlessprod) — it's a data-cleanup UPDATE, per-project. Real DEV post-push query proof: **0 of 2 restaurant rows retain `settings->'api_key'`** (maf-lounge kept its other 10 settings keys, only `api_key` stripped; Test Cafe B had none). **Running PROD-at-deploy migration set now: `20260626`, `20260627`, `20260628`, `20260629`, `20260702`, `20260704000000` (tz), `20260704020000` (split), `20260707000000` (split keeps-table-open), `20260707010000` (settings api_key strip).**

### KDV/VAT receipt support — P1 ✅ (2026-07-08)

**Scope:** additive, receipt-first KDV decomposition. Menu prices remain **VAT-inclusive**; `orders.total`, İyzico/split charge amounts, collected-ciro, comp exclusion, `payment_method`/`paid_at`/`settled_by` semantics are unchanged.

**Migration:** `20260708000000_menu_item_vat_rates.sql` — `menu_categories.vat_rate numeric(5,2) not null default 10 check 0..100`, `menu_items.vat_rate numeric(5,2) null check 0..100`. Applied to DEV 2026-07-08 via `supabase db push`; types regenerated from linked DEV. ⚠️ **PROD-at-deploy:** apply this migration with the existing pending prod migration set.

**Implementation:** order creation resolves KDV server-side in the existing shared `resolveOrderLines` path (`item.vat_rate ?? category.vat_rate`) so both customer menu orders and dashboard manual orders share one resolver; client-supplied `vat_rate` is ignored. `orders.items` line snapshots now carry `vatRate` + `vatIncluded: true`; old snapshots read as `vatRate: null` and never get a fabricated historical rate. Shared `computeVatBreakdown` is the only KDV math source (per-line rounding, grouped by rate, unknown historical gross kept separate). `ReceiptModal` renders Turkish receipt breakdown (`Ara toplam KDV hariç`, `KDV %X`, `TOPLAM`) plus real `settings.tax` company/address metadata if present; old orders show "KDV dökümü mevcut değil."

**Verify:** db unit tests **87/87** (incl. KDV grouping + old snapshot unknown); workspace typecheck **8/8**; lint **0/0**. Test Cafe B real-auth runtime (throwaway→cleanup, maf untouched): mixed rates `%1/%10/%20` produced snapshot rates `[1,10,20]`, order total stayed **₺331**, receipt rendered grouped KDV (`₺1/₺10/₺20`, net ₺300), old no-rate order rendered honest missing-KDV state, collected-ciro remained **₺331**, comp order stayed excluded (**₺331** with comp), split-pay clamp charged the same gross **₺331**, and payment fields were unchanged before settlement. Marker cleanup proof: 0 throwaway categories/items/tables/orders remain. P2 completed below: dashboard Settings/menu UI can edit category defaults + item overrides and decorative tax controls were removed.

### KDV/VAT rate editing UI — P2 ✅ (2026-07-08)

**Scope:** category/product KDV rate management without changing customer prices. Category nav edit mode now persists `menu_categories.vat_rate` with `%1/%10/%20` presets plus custom numeric entry. Product edit panel now has `Kategori oranını kullan` (`menu_items.vat_rate = null`) vs `Özel oran` (explicit override) and shows the effective rate; save writes through the existing menu actions and keeps P1's server-side resolver authoritative.

**Settings cleanup:** Settings → Vergi no longer shows decorative tax type/rate/included/withholding controls. It keeps real company fields (`company`, `taxNumber`, `office`, `tcVkn`, `address`) and a read-only policy note: prices are KDV-inclusive and receipt KDV is decomposed from menu category/product rates; no e-fatura promise.

**Verify:** workspace typecheck **8/8**, lint **0/0**, dashboard production build ✓, menu production build ✓. Test Cafe B DEV resolver proof (throwaway category/item/orders → cleanup): initial category `%1` + item override `null` produced an old order snapshot `{ total: 100, vatRate: 1, vatIncluded: true }`; after category `%10` + item override `%20`, a new order snapshot froze `{ total: 100, vatRate: 20, vatIncluded: true }` while the old order still read `%1`. Customer menu HTML smoke at `localhost:3013/test-cafe-b` returned 200 and rendered the same visible price samples (`₺50,00`, `₺65,00`, `₺40,00`, `₺90,00`, `₺75,00`, `₺70,00`) with no KDV copy leaked into the public menu. Anon REST decision: `menu_categories.vat_rate` is public/non-sensitive (200), raw `menu_items` remains 42501 (same stricter table access as cost probe). Orphans: 0 KDV_P2 categories/items; successful throwaway orders deleted by ID.

### İstasyonlu mutfak ekranı + görev sınırı ✅ (2026-07-09)

**Migration:** `20260708010000_kitchen_stations.sql` DEV'e push edildi; local/remote migration listesi eşit ve PostgREST `kitchen_stations` sorgusu 200. Restoran bazlı özelleştirilebilir istasyonlar, kategori varsayılanı + ürün override'ı ve sipariş-anı immutable istasyon snapshot'ı kullanılıyor. ⚠️ **PROD-at-deploy:** migration PROD'a ayrıca uygulanmalı.

**KDS sınırı:** istasyon sekmeleri yalnız o istasyonun kalemlerini gösterir; diğer istasyonun ürün adı/adedi kartta sızmaz. Kullanıcıya görünen **Tüm İstasyonlar** ekranı tüm kalemleri ve atanmış istasyon özetini görür (iç teknik kimlik `expo`). Ayrı "Atanmamış" sekmesi/etiketi yoktur; eski veya eksik atamalı satırlar veri kaybı olmadan yalnız Tüm İstasyonlar'da görünür. Kitchen token action'ı server-side yalnız `preparing` ve `ready` hedeflerini kabul eder; `served`/`cancelled` mutfaktan kapatılmıştır. Çok istasyonlu sipariş yalnız Tüm İstasyonlar ekranından `ready` olabilir; istasyon kartında dürüstçe "Son kontrol tamamlar" yazar. `ready` kartında mutfak işlemi biter ve "Garson teslim edecek" görünür. `Servis edildi` yalnız authenticated dashboard/garson akışındadır ve realtime UPDATE kartı KDS'den kaldırır.

**UX + verify:** tüm kart tıklaması kaldırıldı; açık `Hazırlamaya başla` / `Hazır olarak işaretle` butonları, canlı saat, responsive kolonlar, işlem hatası ve dürüst boş durum eklendi. Test Cafe B geçici karışık sipariş gerçek-browser testinde Bar yalnız kahveyi, Mutfak yalnız hamburgeri gördü; `ÇIKAR: Soğan` görünür kaldı; istasyon karma siparişi bitiremedi, Tüm İstasyonlar `ready` yaptı; DB sonucu `ready_at` dolu, `served_at=null`, mutfakta servis butonu yok. Throwaway sipariş/istasyon temizlendi. Kalıcı Test Cafe B yapılandırması: Kahveler/İçecekler/Kokteyller/Fresh İçecekler/Matchalar → Bar; Kahvaltı/Tatlılar/Ekstralar → Mutfak. Eski sipariş snapshot'ları dürüstçe `Atanmamış` kalır.

### QR menü sipariş bannerı + hızlı masa istekleri ✅ (2026-07-09)

**Migration:** `20260709000000_service_request_types.sql` DEV'e push edildi; `service_requests.request_type` sabit ve check-constrained (`waiter|clean_table|change_ashtray|table_service|water|bill`), eski kayıtlar `waiter`. Throttle artık masa+istek türü bazında çalışır; farklı gerçek istekler birbirini yutmaz. ⚠️ **PROD-at-deploy:** migration PROD'a ayrıca uygulanmalı.

**Müşteri UI:** eski sağ-alt yuvarlak sipariş durumu FAB'ı içerik akışında referans geometriye yakın kompakt durum banner'ına dönüştürüldü (gerçek 4 aşama, sahte ETA yok, mevcut tema token'ları + ortak Lucide ikonları). Boşalan sağ-alt aksiyon Garson/Hızlı İstekler panelidir: Garsonu çağır, masa temizliği, küllük, servis, su ve hesap; emoji/amatör özel SVG yok. Her istek gerçek `/api/service-request` hattından tipli kaydolur ve müşteriye başarı/hata sonucu gösterilir.

**Dashboard:** realtime toast, Bildirimler paneli ve Masalar satırı `request_type` etiketini gösterir; aynı masanın birden çok farklı bekleyen isteği ayrı ayrı tamamlanabilir. Test Cafe B Masa 1 gerçek mobil browser testinde banner 358×66 akış bileşeni olarak render oldu, beş hızlı isteğin tamamı Lucide SVG kullandı ve "Su istiyorum" DB'ye `request_type='water'` olarak yazıldı; throwaway sipariş/istek temizlendi.

### Sprint 24 — Payments close the table (Payment epic) 🚧

**P1 — per-order payment method + race-safe auto-close ✅ (merged before this session). Migration: `20260625000000_payment_method_settle.sql`.** Added `orders.payment_method` (`iyzico|cash|pos|comp`, check-constrained) + `orders.settled_by uuid → auth.users`, both DELIBERATELY excluded from the anon column grant (settlement data never reaches the public menu via REST/realtime — same discipline as `customer_tier`). Backfilled existing paid orders with an `order_payment_tokens` row → `'iyzico'`; token-less paid orders left null (legacy-collected, NOT comp). `markOrderPaidDB(orderId, restaurantId, method, settledBy?)` now stamps `paid_at + payment_method + settled_by` under a `paid_at IS NULL` guard (first settlement wins, retries no-op) and fires the new `close_session_if_fully_paid(session)` RPC — a single atomic `closed_at IS NULL`-guarded UPDATE that closes the adisyon iff every non-cancelled order is paid (comp counts as paid). Two concurrent final payments → exactly one wins the close. Collected-ciro is ONE predicate (`isCollectedOrder`/`collectedOrdersFilter` in dashboard `queries.ts`): `paid_at set AND status<>'cancelled' AND payment_method IS DISTINCT FROM 'comp'` (keeps legacy null-method paid, drops only comp). `shouldEarnOnSettlement` blocks loyalty earning for comp. İyzico callback stamps `'iyzico'` (settled_by null = system).

**P2 — manual settlement (cash/pos/comp) + no-silent-drop close + per-order method ✅ (verified + committed `f8d5976`). Migration: `20260625010000_session_close_reason.sql` (db-pushed to DEV; local==remote).**

**The new primitive — `settleOrder` (`apps/dashboard/lib/actions/settlement.ts`):** `settleOrder(orderId, restaurantId, method)` — Zod `method ∈ {cash,pos,comp}` (an errorMap REJECTS `'iyzico'` — callback-only). Gated by `assertAccess('tables')` (owner OR member with the section; the returned `userId` becomes `settled_by`). Delegates to P1 `markOrderPaidDB`, inheriting its restaurant-scoping (cross-tenant orderId → "not found") + `paid_at IS NULL` no-op guard (re-settling an İyzico order never overwrites the method) + auto-close. The product's FIRST manual "mark paid".

**No silent money-drop (`closeTableSession` rewritten):** the old path stamped `closed_at` and silently abandoned `unpaidTotal`. Now: fully-paid → NORMAL close (`close_reason` null, +1 visit); unpaid + NO reason → REJECTED (forces a settlement decision); unpaid + reason → ABNORMAL close (`close_reason` recorded, orders STAY unpaid, NO visit credited). New nullable `table_sessions.close_reason` is the abnormal record/flag (non-null ⇒ abnormal; one column, no drift). **NO path closes unpaid money without an explicit recorded decision.**

**Close-flow UX (`SettlementSheet.tsx`, wired into `TablesBuilderShell`):** closing an adisyon with `unpaidTotal>0` opens a sheet ("Kalan: ₺X — nasıl tahsil edildi?") listing each non-cancelled order with `[Nakit][Fiziksel POS][İkram]` buttons + a bulk "Tümünü Nakit/POS" shortcut (the common single-method case; İkram per-order only). Settling the last unpaid order auto-closes the session (P1) → the sheet closes. A de-emphasized "Ödenmeden kapat (anormal)" sits behind a confirm + required reason prompt. Already-fully-paid → closes directly (no sheet). `getSessionSettlement` feeds the sheet (per-order state; settled_by email resolved for owners only).

**Split bill (per-ORDER grain) + badges:** the staff SettlementSheet IS the per-order "split by order" (clean 1:1) — a 2-order session settled one Nakit one POS stamps both and auto-closes on the last. The customer-facing `apps/menu` `SplitBillModal` was deliberately NOT given staff settlement buttons: `settleOrder` is `assertAccess('tables')`-gated and unreachable from the anon menu (letting a customer stamp cash/comp = fraud), and per-person partial settlement WITHIN one order is the explicitly flagged non-P2 stretch. Shared `lib/payment-method.ts` (`paymentMethodBadge`) renders the method on the orders board + sheet (İkram = distinct dashed violet `₺0`, not money-green); imported from the client-safe `@garsonless/db/order-client` subpath (added `PaymentMethod` there).

**P1+P2 gates — DONE on the new toolchain machine (2026-06-26):** `db push` to DEV (P2's `close_reason` migration applied; P1 was already remote; local==remote), `types:gen` regenerated against the real schema (FIXED a drift: the committed `types.gen.ts` was missing `payment_method`/`settled_by`/`close_reason` + the `close_session_if_fully_paid` RPC), typecheck **8/8**, lint **0/0**, db unit **59/59** (incl. comp/settle tests). **Test Cafe B real-auth runtime matrix 42/42** (snapshot→restore; maf-lounge read-only; throwaway members+orders): İyzico last-unpaid close + visits, comp paid+method+0-loyalty+excluded-from-ciro+İkram-reportable, IS DISTINCT FROM keeps legacy null in ciro, race-safe close (5 concurrent → 1), re-settle no-op (method stays iyzico), no-silent-drop reject, abnormal close records `close_reason`, split-bill per-order method, member-without-'tables' rejected + cross-tenant blocked (gate + scoped-write). Committed `f8d5976` on `fix/pano-real-data`.

**P3 — payment report rewrite + comp report + pg_cron safety-net sweep ✅ (verified, this session). Migration: `20260626000000_payment_safety_net_sweep.sql` (db-pushed to DEV; ⚠️ MUST ALSO be applied to PROD at deploy — pg_cron + the schedule are per-project).**

**`getPaymentBreakdown` REWRITE (real method, drops the Sprint 19c inference):** STOPS inferring İyzico-vs-Manuel from `order_payment_tokens` presence (token join deleted) — now reads the REAL `orders.payment_method`. Returns a `PaymentReport`: `collected[]` = 3-way `iyzico|cash|pos` + a `unknown` bucket ("Bilinmiyor (eski)" = legacy null-method paid, KEPT in the tahsilat base), each with `pct` over `collectedTotal`; `comp` = `{amount,count}` reported SEPARATELY (İkram), **never in the collected % base** (it's ₺0 collected). Paid + non-cancelled in range; comp split out in TS.

**Comp report (new metric):** "İkram edilen" = `paid_at not null AND status<>'cancelled' AND payment_method='comp'` → `sum(total)` for the range, surfaced as its OWN KPI + a violet dashed İkram line in the Analytics payment report (`CompLine`), NEVER inside tahsilat. UI drops the old "Manuel tahsilat (inferred)" / "Online token varlığına göre" wording → "Nakit · Fiziksel POS · İyzico" + real method labels (P2 comp badge palette).

**Safety-net sweep (`sweep_fully_paid_idle_sessions(p_idle_minutes int default 30)`, scheduled `*/10 * * * *`):** closes ONLY fully-paid (no unpaid non-cancelled order) idle (newest live order older than the threshold) sessions — a guarded `closed_at IS NULL` + re-checked fully-paid UPDATE (race-safe, mirrors `close_session_if_fully_paid`) tagged SYSTEM `close_reason='auto'`, then credits visits idempotently. **NEVER settles money; a session with ANY unpaid non-cancelled order is LEFT OPEN** (the deep 8h lazy close + manual settle own those). `'auto'` is a system tag distinct from a staff walkout reason → the future abnormal/walkout report is `closed_at is not null AND close_reason is not null AND close_reason <> 'auto'` (nothing reads `close_reason` yet). SECURITY DEFINER + locked search_path; execute revoked from anon/authenticated. **Runtime bug caught + fixed by the gate:** the visit `INSERT … ON CONFLICT (session_id,customer_id,type)` failed ("no unique/exclusion constraint matching") because the idempotency index is PARTIAL (`where session_id is not null`) — the ON CONFLICT must repeat that predicate; fixed + re-applied (migration repair→reverted + re-push, all statements idempotent) + re-verified.

**P3 verify (Test Cafe B real data; maf-lounge read-only; snapshot→restore; 25/25):** breakdown reads real method — cash ₺150/2, pos ₺80/1, iyzico ₺120/1, legacy-null ₺40/1 → collectedTotal ₺390 (5 orders, unpaid ₺999 excluded), comp ₺70/1 SEPARATE + never in the % base; İkram metric sums comp for the range. Sweep: a fully-paid idle session AND a ~15625-min forgotten paid session → REAPED (closed + `close_reason='auto'` + visit credited); an unpaid idle session → LEFT OPEN (order still unpaid); a recently-active paid session → not swept; re-run idempotent (no double-credit). SAFETY: the global sweep was pre-flighted read-only (candidate set ⊆ throwaway sessions) before the real call → zero maf/other-tenant collateral. typecheck 8/8, lint 0/0, db unit 59/59.

**Payment KEEPS the table open (decouple bill-paid from table-freed) ✅ (2026-06-27, branch `fix/payment-keeps-table-open`). Migration: `20260627000000_sweep_threshold_3h.sql`.** DECISION: app/İyzico payment settles the BILL but must NOT empty the table — a paid customer keeps sitting and can order more on the same session; the table is freed ONLY by an explicit staff "Kapat". The "paid but seated" state already existed end-to-end (`getTableStatuses` derives `'paid'` for an OPEN session with all orders served+paid; FloorPlan renders green **"ödendi · kapatılabilir"**) — the only coupling was `markOrderPaidDB`'s auto-close. **Changes:** (1) **removed the auto-close block from `markOrderPaidDB`** (no more `close_session_if_fully_paid` + `creditVisitsForSession` on full payment; it now stamps `paid_at/payment_method/settled_by` ONLY + the existence/not-found guard + loyalty earn) — İyzico callback & `settleOrder` both stop freeing. (2) **`SettlementSheet` frees explicitly:** opened from the staff "Kapat" intent, after the last order is settled it now calls `closeTableSession` (fully-paid → NORMAL close + credits the visit) instead of relying on the removed auto-close — **auto-free-after-settle** UX (no extra button). `closeTableSession` is `assertAccess('tables')`-gated (owner OR member-with-tables), consistent with `settleOrder` + the owner-gated `getOpenTableSessions` that opens the sheet. (3) **Visit crediting moved from pay-time to free-time** (explicit close or the sweep); idempotent on `unique(session_id,customer_id,type)` → exactly one, no loss. (4) **Sweep idle threshold 30m → 180m (3h):** with every paid table now staying open, 30m would reap a lingering paid customer; 3h ≈ "table genuinely vacated". The sweep is the BACKSTOP for forgotten paid tables, not the primary free path. (5) **`close_session_if_fully_paid` RPC is now DEAD in app code** (only in `types.gen`); kept in the DB (not deleted this task). Reporting (ciro / İkram / comp) is keyed on `orders.paid_at`+`payment_method`, independent of `closed_at` → unaffected. **Fix B (same branch):** İkram surfaced on the Analytics **Sales overview** as an "İkram edilen ₺X · tahsilat dışı" caption under the collected mini-donut (reuses `getPaymentBreakdown`'s `comp`; still EXCLUDED from collected ciro) — previously only on the Ödemeler sub-tab. **Verify (Test Cafe B real auth, maf read-only, snapshot→restore; 29/29):** İyzico/cash settle → session stays OPEN, derives `'paid'`, **0 visit at pay-time**, ciro includes it, a 2nd order attaches to the same session; explicit close → `closed_at` set + **visit credited exactly once** (idempotent); sweep@180 → 1h paid table NOT reaped, 4h reaped (closed + `close_reason='auto'` + visit), no-arg default now 180; comp excluded from collected ciro + İkram sum correct; no-silent-drop + abnormal-close (P2) intact. typecheck 8/8, lint 0/0, db unit 59/59.

### Dashboard performance pass — first-load + SSR payload reduction ✅ (2026-06-26)

**Goal:** speed up the dashboard panel without product behavior changes. Dirty tree treated as the performance change set after P3; no destructive or production-facing DB commands were rerun.

**SSR/query reductions:** Pano now uses `getPanoSnapshot(restaurantId,isOwner)` to collapse dashboard home data into targeted lightweight queries (30-day order rows, today item fold, tables, open sessions, owner-only payment mode) instead of many broad queries. Orders page selects only board fields (`id, restaurant_id, table_id, status, items, total, customer_tier, paid_at, payment_method, created_at`). Analytics initial SSR loads sales + payments only; product/table reports are fetched lazily per active tab through `fetchAnalyticsReportData(report)`. Theme editor SSR uses `getThemeEditorMenuRefs` (`id/name/parent_id/category_id` only) instead of full category/item rows.

**Client bundle splits:** CSV import (`papaparse`) loads only when a CSV file is selected. QR rendering/export (`qr-code-styling`) loads only when QR canvas/grid/download needs it. Menu category DnD moved to `MenuCategoryDndList` and lazy-loads `@dnd-kit`; the sidebar keeps a static fallback so categories render immediately. Theme editor route imports `ThemeEditorClientLoader`, dynamically loading the heavy editor while keeping the route shell tiny. The initial `ssr:false` loader variant caused an internal-server-error risk in dev; removed it while preserving the chunk split. Dashboard `framer-motion` usage was removed from order/service toasts and replaced with CSS animations; dashboard dependency entry was removed (other apps/packages still use it).

**Realtime/layout cleanup:** `RestaurantShell` now derives order/new badges from one `select('status')` query over active statuses instead of two separate count queries.

**Measured production build impact:** `/dashboard/[restaurantId]/theme/[templateId]/edit` `27.3 kB / 230 kB` → `4.42 kB / 108 kB`; `/menu` baseline `20.6 kB / 242 kB` → `13.8 kB / 219 kB`; `/tables` baseline `30.7 kB / 233 kB` → `16.9 kB / 219 kB`; `/orders` first load baseline `242 kB` → `204 kB`. Dashboard shared first-load JS remains ~103 kB.

**Verification:** `corepack pnpm --filter @garsonless/dashboard typecheck`, `lint`, and `build` all pass after the final loader fix. Restarted local dashboard dev server on `localhost:3000`; `/dashboard` returns 307 to `/auth/login`, `/auth/login` returns 200.

### Pano masa durumu — canlı ve etkileşimli plan ✅ (2026-06-27)

**Reference implementation:** `Dashboard.html` + `dashboard-page.jsx` + `dashboard-overlays.jsx` masa deneyimi mevcut dashboard tasarım sistemine uyarlandı. Pano masa kartları artık hover özeti ve tıklamayla gerçek adisyon detayını açıyor; detay sipariş kalemlerini lazy server action ile okuyor, seçili masaya doğrudan ürün ekleyebiliyor ve kapatma niyetini mevcut güvenli `SettlementSheet` akışına iletiyor. Ödendi/aktif/yeni/geciken durumları yalnızca gerçek açık oturum ve sipariş verisinden türetiliyor; referanstaki sahte elle durum/ödeme değiştirme davranışı taşınmadı.

**Canlılık + plan:** Pano `orders` ve `table_sessions` realtime değişikliklerinde yetki kontrollü `fetchPanoTableStatuses` ile masa snapshot'ını yeniliyor. FloorPlan referanstaki İç salon/Teras tuvaline, sürükle-bırak yerleşime, restoran bazlı local layout kaydına, bölge/koltuk editörüne ve gerçek Fullscreen API kontrolüne kavuştu. Masa ekleme/silme gerçek `/tables` yönetimine yönleniyor. Dashboard'dan oluşturulan masa siparişleri artık service-role-only `open_or_get_table_session` RPC'siyle gerçek `table_session_id` alıyor; böylece Pano ve adisyonda görünmeme açığı kapandı.

**Verify:** dashboard typecheck + lint + production build geçti. Test Cafe B gerçek owner runtime: Masa 1 canlı ₺50/geciken görünümü, gerçek Filtre Kahve adisyon satırı, ürün ekle/hesabı kapat aksiyonları, 3 masalı plan, düzenleme modu ve kontroller doğrulandı; hiçbir tahsilat/kapatma write'ı tetiklenmedi. Desktop ve iPhone 390×844'te yatay taşma yok.

**Canlı akış hızlı onay (2026-06-28):** `pending_approval` satırları hover/keyboard focus sırasında saat etiketini gerçek **Onayla** aksiyonuyla değiştiriyor; touch cihazlarda aksiyon doğrudan görünür. Aksiyon mevcut owner/member-gated `updateOrderStatus(...,'sent_to_kitchen')` yolunu kullanıyor, bekleme ve hata durumlarını satır içinde gösteriyor. Pano orders realtime handler'ı artık INSERT yanında UPDATE durumlarını da feed'e yansıtıyor. Test Cafe B gerçek owner runtime: hover opacity `0→1`, UI `Onay bekliyor→Mutfağa gönderildi`, DB `pending_approval→sent_to_kitchen`; test sonunda sipariş eski `pending_approval` durumuna geri yüklendi. Dashboard typecheck/lint/build geçti.

### Müşteri ödeme UX — gerçek İyzico + masada tahsilat ✅ (2026-06-28)

**Reference adaptation:** `Müşteri Ödeme.html` ödeme sheet hiyerarşisi gerçek menu akışına uyarlandı: toplam kartı, yöntem seçimi, İyzico için ödeyen kişi bilgileri, güvenli checkout iframe'i ve callback doğrulamasından sonra gerçek sonuç fişi. Mock'taki kayıtlı kart/Visa son hanesi, bahşiş, puan, rating ve e-makbuz eklenmedi; bunların backend modeli yok. Kart seçeneği yalnız gerçek İyzico initialize/callback yolunu kullanıyor. Masa QR'ında ikinci yöntem olan **Masada öde**, gerçek `service_requests` garson çağrısını gönderiyor ve siparişi unpaid bırakıyor; masa dışı siparişte görünmüyor.

**State correctness:** kart ödemesi başlatılırken sipariş artık callback öncesinde `paid=true` yapılmıyor. Sipariş oluşturulur oluşturulmaz unpaid olarak takip state'ine alınıyor; ödeme penceresi kapatılsa bile kaybolmuyor. Yalnız trusted same-origin `PAYMENT_SUCCESS` mesajından sonra meta paid oluyor. İyzico buyer payload'ına gerçek telefon (`gsmNumber`) eklendi. Development callback origin'i gelen hosttan üretildiği için localhost Cloudflare tunnel sandbox callback'i erişilebilir; production canonical `NEXT_PUBLIC_MENU_URL` kullanmaya devam ediyor. `PaymentModal` dinamik chunk'a ayrıldı; menu first-load **281 kB → 269 kB**.

**Verify:** menu typecheck + lint + production build geçti. Test Cafe B iPhone 390×844 runtime (orders/payment/service-request API'leri intercept edilerek DB ve sağlayıcı write'ı olmadan): kart ve masada ödeme sheet'leri, alanlar ve responsive yerleşim doğrulandı; yatay taşma yok. Callback öncesi `paid=false`, doğrulanmış success sonrası `paid=true`; masada tahsilat sonrası `paid=false` + takip görünümü. Başarı fişinde sahte Visa/bahşiş/puan/e-makbuz metni yok.

### Menü gıda bilgisi + güvenli varyant/sipariş snapshot'ı ✅ (2026-06-28)

**Migration (DEV'e uygulandı 2026-06-28):** `20260628000000_menu_food_information.sql` ürünlere yapılandırılmış `ingredients`, temel porsiyon `energy_kcal`, olası çapraz temas alerjenleri, alkol/domuz kaynaklı bileşen bayrakları ve işletme gözden-geçirme audit alanlarını ekler. DEV PostgREST schema-cache probe'u yeni kolonlarla 200 döndü; migration listesi local/remote eşleşiyor. Mevcut ürünler yayında kalır; eksik/gözden geçirilmemiş ürünler dashboard'da `Bilgi eksik` olarak görünür. Resmî takvim kılavuzdan doğrulandı: ulusal zincir `01.07.2026`, il içinde 3+ şube `31.12.2026`, diğer işletmeler bileşen `31.12.2026`, enerji `31.12.2027` (2028 değil). Bakanlığın 14 alerjeni sabit kod listesi olarak kullanılır.

**Ürün ve varyant modeli:** dashboard ürün panelinde sıralanabilir bileşenler, işletme tarafından işaretlenen çıkarılabilir içerikler, kcal, bileşen-alerjen eşlemesi, çapraz temas ve özel içerik bilgileri bulunur. Varyantlar canonical `single|multiple|quantity + required + min/max` gruplarıdır; seçeneklerde fiyat/kcal farkı, varsayılan ve ek alerjenler tutulur. Eski `required|optional` JSON'ları browser-safe normalizer ile okunur. CSV şablonu gıda bilgisi sütunlarıyla genişletildi.

**Sipariş güven sınırı:** menu ve dashboard istemcileri yalnız `itemId + quantity + selected option ids + removed ingredient ids` yollar. `resolveOrderLines` ürünün restorana aitliğini/uygunluğunu, min-max kurallarını ve çıkarılabilirliği service-role DB verisine karşı doğrular; istemcinin isim/fiyat/modifier delta alanları geçiş uyumluluğu için kabul edilse de tamamen yok sayılır. Sunucu insan-okunur immutable order snapshot'ı (`modifiers`, `removedIngredients`, kcal, alerjenler ve gerçek fiyatlar) üretir. Dashboard/mutfak/Pano eski `qty|quantity` satırlarını da okuyabilen ortak normalizer kullanır; mutfakta `ÇIKAR:` ve `ALERJEN:` yüksek görünürlüktedir. Zustand sepet v2 migration eski sepetleri korur.

**Ürün paneli UX iyileştirmesi (2026-06-28):** sağ editördeki native çoklu seçimler, seçilen değerleri çıkarılabilir etiketlerle gösteren modern alerjen dropdown'larıyla değiştirildi. Bileşen ve varyant alanları dar panelde yatay kaydırma gerektirmeyen kart düzenine alındı; işletme bileşen, grup ve seçenek adlarını serbestçe oluşturur, hazır seçenek atanmaz. Sabit 14 alerjen yalnız resmî sınıflandırma sözlüğüdür ve başlangıçta hiçbir değer seçili değildir. Playwright ölçümünde panel masaüstü ve mobilde `scrollWidth === clientWidth` verdi; dashboard typecheck ve workspace lint temiz.

**CSV içe aktarma UX + doğrulama (2026-06-28):** `İçe aktar` artık şablon indirme ve sürükle-bırak destekli bir başlangıç ekranı açar; `.csv`, 5 MB ve 1.000 satır sınırları yüklemeden önce doğrulanır. Önizleme dosya/satır numarasıyla mevcut ürün tekrarını, dosya içi tekrarı, bilinmeyen resmî alerjeni, içerik listesinde bulunmayan çıkarılabilir değeri ve geçersiz fiyat/kaloriyi açıkça gösterir; sorunlu satırlar yazılmaz. Eksik içerik/kalori yalnız uyarıdır ve ürünün mevcut `Bilgi eksik` politikasını korur. Server action hataları kalan satırları kilitlemez; başarılı/başarısız sayısı sonuç mesajında ayrılır. Test Cafe B Playwright read-only senaryosunda başlangıç ve önizleme ekranları, tekrar/alerjen/içerik hataları ve 390 px mobil düzen doğrulandı (`scrollWidth === clientWidth`, konsol hatası yok); gerçek import onayı verilmedi. Dashboard typecheck ve workspace lint temiz.

**Verify:** workspace typecheck, lint 0/0, DB unit **67/67**, production build (marketing/kitchen/menu/dashboard), API route smoke **4/4** geçti. Public desktop+mobile Chromium visual smoke **8/8** geçti; Playwright 1.61 güncellemesi nedeniyle Chromium v1228 yerel cache'e yeniden kuruldu. DEV migration sonrası yeni kolonlar PostgREST üzerinden doğrulandı. Tam Test Cafe B ürün-düzenleme→sipariş→mutfak write senaryosu henüz çalıştırılmadı; PROD deploy sırası migration → app olmalıdır.

### Dashboard ortak navigasyon + erişilebilir tooltip ✅ (2026-06-28)

Masalar tam ekran aracındaki beş öğeli yerel rail kaldırıldı; ekran artık `RestaurantShell` bağlamından kullanıcı/yetki durumunu alıp ortak `IconRail` bileşenini kullanıyor. Böylece Pano, Müşteriler ve Raporlar dahil izin verilen tüm bölümler Menü ve Masalar ekranlarında aynı sırada kalır; profil, yardım, sipariş rozeti ve navigasyon koruması da tek kaynaktan çalışır. Tüm rail ikonlarında mouse hover ve keyboard focus ile açılan, görünen bölüm adı tooltip'i bulunur. Test Cafe B owner Playwright senaryosunda Menü ve Masalar için **8/8** öğe, Masalar üzerinde `Raporlar` tooltip'i ve sıfır runtime/console hatası doğrulandı; dashboard typecheck, workspace lint ve `git diff --check` geçti.

**Tek tema akışı (2026-06-28):** ürün kararına göre kullanıcıya şablon kütüphanesi sunulmaz. `/theme`, restoranın doğrulanmış `active_template_id` değerini kullanarak doğrudan `/theme/{id}/edit` düzenleyicisine yönlenir; eski `ThemeLibraryClient` kaldırıldı ve editör üst çubuğundaki `Şablonlar` tetikleyicisi silindi. Mevcut tema ayarları ve yayınlama yolu değişmedi. Test Cafe B runtime doğrulamasında Tema ikonu doğrudan `/theme/default/edit` açtı; `Şablonlar` düğmesi/dialog sayısı **0/0**, konsol hatası **0**; dashboard typecheck ve workspace lint temiz.

### Dashboard UX geçişi + auth/tema düzeltmeleri ✅ (2026-06-30 → 07-01)

Bir dizi para-bitişik ve UX işi; hepsi **gerçek veriye uyarlandı** (referans mock'lardaki sahte metrikler alınmadı), her biri Test Cafe B gerçek-auth runtime + snapshot→restore + throwaway-cleanup ile doğrulandı, hepsi commit + FF-merge + push. NOT: eşzamanlı bir tema-preview WIP (ThemeEditorClient/MenuPageClient/ThemeContext) tüm bu iş boyunca çalışma ağacında dirty kaldı; explicit-path commit'lerle hiç dokunulmadı.

**Auth — menüde dolaşırken kendiliğinden Pano'ya sıçrama düzeltildi (`077cf8b`, `fix/auth-cookie-propagation`).** Teşhis (Playwright): giriş­li kullanıcı bir an `/auth/login`'e düşünce iki 307 ile `→ /dashboard → /dashboard/{id}` (Pano) sıçrıyordu. Kök neden: `middleware.ts` redirect yanıtlarını `NextResponse.redirect()` ile sıfırdan kuruyor ve `getUser()`'ın token-yenileme sırasında `supabaseResponse`'a yazdığı cookie'leri **kopyalamıyordu** → rotasyona uğrayan refresh token düşüyor → sonraki istek geçersiz token'la gidiyor → `getUser()` null → login'e, sonra tazelenince `/auth/login → /dashboard → Pano`. Fix: `redirectTo()` yardımcısı her redirect'e `supabaseResponse.cookies`'i kopyalıyor (belgelenmiş Supabase SSR tuzağı). Silme gibi Server Action'lar cookie'ye dokunup yarışı tetikliyordu.

**Masalar & QR — kalıcılık + masa CRUD + topbar butonları + mobil önizleme (`19738e9`, `292cf41`, `7867949`).** Audit'te QR stüdyosunun hiç persist etmediği + "kaydedildi/senkron" göstergelerinin sahte olduğu + ölü butonlar bulundu. (1) **QR stili artık `restaurants.settings.qr_style`'a autosave** — `saveQRStyle` mevcut settings'i MERGE ediyor (loyalty/notifications/payment korunuyor, doğrulandı), `assertAccess('tables')`-gated, Zod-validated; kök component'te `qr` bir **undo/redo history stack**'inden türetiliyor (setQR push, undo/redo pointer, 60 cap), 650ms debounce + **mount-guard** (boş restoranda default'u yazmaz) + stale-response guard; save-state göstergeleri gerçek. `page.tsx` `initialQRStyle` yüklüyor, client `normalizeQRStyle` ile alan-bazlı doğruluyor. (2) **Masa yeniden adlandır + soft-delete** (`renameTable`/`deleteTable`): owner/tables-gated, restaurant-scoped, `.select('id')` 0-satır kontrolü (cross-tenant → "not found"), delete'te **açık-adisyon guard'ı** (`.limit(1)`, UI + server). `mut` helper'ına `EqChain.select()` eklendi. (3) **Logo** client'ta ≤256px PNG'ye downscale + server 256KB cap (logo `settings`'te, her SSR'da okunuyor). (4) Sahte kaldırıldı: "1 sorun" statusbar, ölü "Tümünü PDF" butonu; gerçek yapıldı: "Masa ara", boş-durum, "Otomatik yayında", "..." **tüm preset'ler popover'ı** (Gece/Gün batımı/Nane dahil), **undo/redo** gerçek, **Kopyala → "Kopyalandı"** geri bildirimi, `.tb-hover` hover göstergesi. (5) **Önizle → Shopify tarzı telefon-mockup modalı** (dynamic island/bezel + menü iframe, gerçek tema; ham sekme değil); **"İndir PNG" taşması** düzeldi (`btnPrimary`/`btnGhost` `whiteSpace:nowrap` + `flexShrink:0`). Codex P0 seti + üstüne hardening.

**Menü — ilk yükleme tema flash'ı (mor→yeşil) düzeltildi (`8c0ec4f`, `apps/menu/lib/resolve-theme.ts`).** Kök neden: SSR **layout** (`<style>` enjekte eden) ile **page** (client `initialTheme`) temayı FARKLI çözüyordu — layout token'da `bg` yoksa `DEFAULT_THEME`'e (accent `#a13b7a` mor) düşüyor, page ise `TEMPLATES[active_template_id]`'ye (default şablon accent `#2e7d52` yeşil). Restoran kayıtlı teması yoksa SSR mor, hydration yeşil → ~1sn flash. Fix: tek paylaşılan `resolveMenuTheme` — hem layout hem page aynı active-template tabanı + aynı token-merge kuralı → SSR `<style>` = client `initialTheme`, flash yok. (Eşzamanlı oturumun editör-iframe handshake fix'iyle tamamlayıcı; canlı menüyü o çözmüyordu.)

**Tema editörü iframe handshake (`fix/theme-editor-iframe-handshake`).** Önizleme iframe'i başlangıçta gizli + tema-renkli loader ile açılır; menüdeki TEK `ThemeProvider` bootstrap `PREVIEW_READY` mesajını yollar, editör benzersiz request ID ile `FULL_THEME_UPDATE` gönderir, menü fontlar ve CSS değişkenleri uygulandıktan sonra eşleşen `THEME_APPLIED` ACK'i döndürür ve ancak o zaman iframe görünür. `MenuPageClient` içindeki ikinci bağımsız ready sinyali kaldırıldı. ACK/iframe hiç gelmezse 5 saniyelik dış fallback iframe'i `degraded` durumda görünür yapar ve araç çubuğunda **Sınırlı önizleme** uyarısı gösterir; kalıcı görünmez ekran yoktur. Request-ID'siz canlı tema güncellemeleri bekleyen handshake ID'sini artık silemez. Gerçek Chromium matrisi: localhost 3000→3011 cross-origin ACK, reload, geçici logo upload→reload→remove, takılan font load (3sn iç timeout + ACK), ACK engelleme ve tamamen başarısız iframe; normalde yalnız `preparing/opacity 0 → ready/opacity 1`, iki arızada ~5sn sonra `degraded/opacity 1`; runtime hata yok, test logosu `null` durumuna geri yüklendi. Workspace typecheck 8/8, lint 0/0, dashboard+menu production build geçti.

**Siparişler — gerçek Geçmiş modalı + yazdırılabilir fiş + aciliyet sayaçları (`c810315`).** (1) Ölü "Geçmiş siparişler" butonu artık gerçek: `getOrderHistory` (owner/'orders'-gated, son 30 gün served/cancelled, RLS-scoped), gün-gruplu, Tümü/Tamamlanan/İptal sekmeleri, arama, ödeme rozetleri (İkram dahil), iptaller üstü çizili, satır başına Fiş. (2) **Fiş modalı** — restoran adı + gerçek kalemler + gerçek (server-authoritative) toplam + ödeme yöntemi; **uydurma VKN/adres/KDV YOK** (veri modelinde yok). Detay panelinde served/paid → "Fiş yazdır". (3) Kart geçen-süre pill'i artık **ok/warn/late** aciliyet renkli (aşamaya göre eşikler; sipariş-başına SLA yok). Sahte alınmadı: istasyon yük barları (veri yok), "Gelen sipariş demo", SLA hedefleri, sahte arşiv damgaları. **Scope B (yapılmadı, migration ister):** `started_at/ready_at/served_at` durum-geçiş damgaları (gerçek saatli timeline + gerçek ort. hazırlık süresi) + iptal sebebi kalıcılığı.

**Masa Kapatma — settlement sheet yeniden tasarımı: stage-then-commit (`6ea268f`).** Referans "Masa Kapatma" tasarımı güncel main'deki gerçek `SettlementSheet`'e uygulandı (**stale, hiç merge edilmemiş `feat/masa-kapatma-redesign` branch'ini geçersiz kılar**). Eski akış her butonda anında settle ediyordu; yeni akış: her ödenmemiş siparişe önce yöntem **staging** (Nakit/Fiziksel POS/İkram), canlı özet+ilerleme+döküm, tek "Masayı kapat · ₺X tahsil" tüm `settleOrder`'ları (sıralı) işleyip `closeTableSession` ile masayı serbest bırakıyor (normal kapanış + 1 ziyaret), animasyonlu başarı ekranı. **Para güvenliği korundu:** zaten ödenmiş (İyzico dahil) siparişler kilitli + staging dışı; İkram=comp=₺0 (kesikli mor); "Ödeme almadan kapat" **hâlâ sebep zorunlu** (satır-içi input) → anormal kapanış parayı ödenmemiş bırakır, ziyaret yazmaz; yalnız cash/pos/comp. `getSessionSettlement` artık kart başına `itemsSummary` döndürüyor. Primary CTA `--positive` (sheet Pano/FloorPlan'da da render olduğu için `--accent`'e bağlanmadı). Money matrix: karışık cash/pos/İkram → doğru yöntemler + normal kapanış; anormal → sebep kaydı + sipariş ödenmemiş; collateral yok (gerçek oturumlar el değmedi).

**Navigasyon yükleme geri bildirimi (`e436ae2`).** Bir bölüme (özellikle yavaş service-role PII sorgulu Müşteriler'e) tıklayınca Next prefetch'li client-geçişte eski sayfayı ekranda tutuyor, tek geri bildirim 3px üst çubuktu → "hiçbir şey olmuyor" hissi. (`loading.tsx` + `force-dynamic` client-nav'da iskeleti göstermeye yetmedi — Next eski sayfayı tutuyor.) Çözüm: **`NavigationPendingOverlay`** — client-nav >300ms sürerse içeriği soluklaştırıp ortada "Yükleniyor…" spinner gösteriyor; paylaşılan `navigation-start` olayına bağlı (tüm bölümlerde), rota değişince kaybolur, 300ms gecikme hızlı/prefetch'li navlarda flaş yapmaz, non-blocking. Ayrıca **customers/loading.tsx + `DashboardRouteSkeleton kind="customers"`** (hard nav / yenileme için sayfa iskeleti).

**Çok-kiracılılık teyidi (kod değişikliği yok):** yapılan hiçbir şey Test Cafe B'ye özel değil — Test Cafe B yalnız doğrulama restoranı; ürün kodunda restoran ID'si hardcode yok, her özellik `restaurantId` ile parametrize, RLS + owner-scoped izolasyon → yeni kaydolan her restoranda otomatik çalışır.

**Verify (hepsi):** dashboard typecheck 8/8, lint 0/0; Test Cafe B gerçek-auth runtime (throwaway veri oluştur→doğrula→temizle, gerçek/maf verisi korundu); kritik akışlarda ekran görüntüsü ile görsel teyit. **Dev not:** `.next` stale-chunk ("1 Issue" / vendor-chunk / "Cannot read properties of undefined") tekrar ederse `rm -rf apps/dashboard/.next` + dev restart çözüyor.

### Wave-1 Analytics — Phase A Operasyon ✅ (2026-07-01)

Mevcut `AnalyticsClient` ve lazy `fetchAnalyticsReportData` akışına beş ortak tarih aralığını kullanan **Operasyon** sekmesi eklendi. Üç service-role sorgunun tamamı önce `assertAccess(restaurantId, 'analytics')` ile kapılıdır ve tenant filtresi taşır. **İptal raporu** tüm non-deleted siparişleri oran paydası yapar; iptal adedi, kaybedilen sipariş tutarı, oran, önceki dönem deltaları, trend ve iptal anındaki ürün snapshot'larını gösterir. İptaller tahsil edilen ciroya eklenmez. **Anormal kapatma** yalnız `close_reason IS NOT NULL AND <> 'auto'` oturumlarını alır; masada kalan tutar yalnız unpaid + non-cancelled + non-deleted siparişlerin toplamıdır. `closed_by` verisi olmadığı için kapatan kişi dürüstçe `—`, gerekçe ham metindir. **Personel tahsilatı** `settled_by × payment_method` üzerinden Nakit/POS/diğer tahsilat/İkram dağılımını verir; owner auth e-postası + `Sahip`, üye e-postası + izin bölümleri, null `settled_by` için `İyzico (otomatik)`, çözülemeyen kullanıcı için `Bilinmeyen kullanıcı` gösterilir. Yüksek nakit bayrağı yalnız `cash / (cash + pos) >= %80`; metrik “tahsil ettiği sipariş” anlamındadır, siparişi alan kişi iddia edilmez. İkram adedi/tutarı ayrı tutulur ve tahsilata girmez.

**Phase A gerçek-auth verify:** Test Cafe B snapshot→throwaway→restore koşusunda seçili 7G aralığı iptal **5 / ₺2.381**, anormal kapatma **1 / ₺333** verdi; raw gerekçe ve `—` kapatan doğrulandı. Dört kimlik çözümlemesi (owner/member/system/unknown), üyenin `tables, analytics` izinleri, yüksek-nakit üye ve POS-ağırlıklı owner ayrımı geçti. Analytics izni olmayan üye Masalar'a yönlendirildi; Test Cafe B owner maf-lounge analytics okuyamadı; maf snapshot değişmedi. Veri olmayan throwaway restoranda üç boş durum gösterildi. Cleanup sonrası Test Cafe B başlangıç snapshot'ına döndü ve 0 orphan kaldı. Workspace typecheck **8/8**, lint **0/0**.

**Referans UI uyarlaması (2026-07-01):** sonradan paylaşılan `analytics-ops-loyalty.jsx`, `analytics-page.jsx`, `analytics-reports.jsx` ve `Analytics.html` içindeki Operasyon dili mevcut gerçek-veri ekranına taşındı: numaralı üç bölüm, kıyas ipuçlu KPI'lar, yatay iptal pay çubukları, aralığa göre 7/4/3/4 kovaya sıkışan gerçek trend ve nakit/POS/online dağılım çubuklu tahsilat tablosu. Mock değerler, sahte roller/avatarlar, kapatan kişi ve yapılandırılmış gerekçe kategorileri alınmadı. Test Cafe B gerçek-auth matrisi ve beş aralık tekrar geçti; workspace typecheck 8/8, lint 0/0.

**Wave-2/backlog (bilerek yapılmadı):** `table_sessions.closed_by` (anormal kapatmayı yapan kişi); yapılandırılmış kapatma kategorileri; gerçek personel rol/vardiya/clock modeli; order-taker ve durum-zaman damgaları (`sent_to_kitchen_at/ready_at/served_at`); güvenilir çalışma saatleri paydalı doluluk yüzdesi; müşteri retention/cohort; sipariş-anı maliyet snapshot'lı ürün marjı; İyzico provider hesaplaşma takvimi/başarı oranı.

### Raporlar Wave-1 — Operasyon + Sadakat + Masa devri ✅ (2026-07-01 → 07-02)

**Disiplin:** referans mock'un 9 sekmesinden yalnız verisi OLAN 5 rapor yapıldı; karşılığı olmayan her öğe uydurulmak yerine DÜŞÜRÜLDÜ. Tüm raporlar paylaşılan range picker'a (Bugün/7G/30G/Çeyrek/Yıl) `getRangeWindow` ile uyar; UI mevcut `AnalyticsClient` kabuğuna (Card/KPISmall/RangePicker, inline-style) entegre — paralel implementasyon yok.

**Phase A — Operasyon sekmesi (`c87dc49`+`1881eeb` Codex, plan Claude; 3 sorgu `lib/queries.ts`):** (1) **İptal raporu** — `getCancellationReport`: status='cancelled' sayı/₺ kayıp/oran (iptal ÷ tüm sipariş), iptal edilen ürünler (`foldOrderItems`), dönem içi trend, önceki döneme delta (`pctChange` null→"Yeni", sahte +100% yok). İptaller İptal raporunu besler ama collected ciro dışı kalmaya devam eder (Sprint-19 semantiği bozulmadı). (2) **Anormal kapatma/kaçak** — `getAbnormalCloseReport`: `close_reason NOT NULL AND <> 'auto'` oturumlar; ₺ = o oturumlardaki ÖDENMEMİŞ non-cancelled siparişlerin toplamı; satır = masa · zaman · HAM serbest-metin gerekçe · tutar. **Kapatan = "—"** (`table_sessions.closed_by` YOK — uydurulmadı); mock'un yapısal kategorileri ("adisyon silindi" vb.) mevcut değil → düşürüldü. (3) **Personel tahsilat** — `getStaffSettlementReport`: `settled_by` × `payment_method` kırılımı (nakit/POS/online-eski/İkram ayrı, İkram collected dışı), sayaç dürüstçe **"tahsil ettiği sipariş"** (kim ALDI bilinmiyor); **yüksek nakit** bayrağı `cash/(cash+pos) ≥ 0.8`. İsim çözümü: owner→"Sahip"+e-posta, üye→e-posta+"Üye·bölümler", `settled_by null`→"İyzico (otomatik)" sistem satırı, çözülemeyen id→"Bilinmeyen kullanıcı". Rol unvanı YOK (rol modeli yok — yalnız Sahip/Üye).

**Güvenlik sertleştirmesi (`1aa38c8`):** Phase A `assertAccess('analytics')` ile çıkmıştı → 'analytics' izinli HERHANGİ bir üye sahibin+meslektaşlarının e-postalarını, kişi başı nakit toplamlarını ve şüphe bayrağını okuyabiliyordu. **Operasyon sekmesi artık OWNER-ONLY**: 3 sorgu içeride `isOwnerViewer` (getUserRestaurantAccess→isOwner) ile gate'li (her çağrı yolu kapsanır), sekme non-owner'dan gizli (`isOwner` prop). E-posta kimlik olarak kaldı — owner-only sınırda PII sızmaz; display-name alanı yok, uydurmak no-fabrication kuralını bozar. **GAP#4 dersi gereği GERÇEK-JWT doğrulandı:** owner oturumunda operasyon server-action POST'u yakalanıp üye cookie'leriyle REPLAY edildi — analytics'li üye: sekme gizli + endpoint boş (marker/e-posta yok); analytics'siz üye: /analytics redirect + endpoint boş; **cross-tenant replay (maf id): veri yok**; owner replay kontrolü veri döndürdü (teknik çalışıyor). 10/10.

**Phase B:** (4) **Masa devri** — `getTablesReportData` artık range parametreli + `table_sessions` katıldı: **devir** = range'de KAPANAN oturum sayısı, **ort. oturum süresi** = mean(closed−opened) (kapananlardan), açık oturum devire SAYILMAZ + "şu an dolu" noktası. **Doluluk % kasten YOK**: gerçek payda için işletme açılış saatleri gerekir, `settings.hours` güvenilir dolu değil → payda uydurulmadı (sekme açıklaması "Devir & tahsilat" yapıldı). Mock'un "Doluluk × Ciro korelasyonu" düşürüldü. (5) **Sadakat sekmesi** — `getLoyaltyReport` (`loyalty_transactions` agregaları, PII yok → normal analytics gate): kazandırılan/kullanılan puan + kullanım oranı, damga, ziyaret, hoş geldin (reason='welcome'), iadeler (direction='refund'), kullanımlar HAM reason bazında; **İkram ₺ = `getPaymentBreakdown().comp`** (action katmanında merge — Ödemeler ile aynı rakam garanti).

**Verify (Test Cafe B gerçek-auth; baseline+seed dinamik beklentiler; throwaway oturum/ledger/müşteri/comp-order → temizlendi; maf read-only):** Operasyon 10/10 (4 isim çözümü gerçek auth-user'larla, yüksek-nakit tam 1 kez, ham gerekçe, "—", 7G/30G range); Masalar — devir KPI baseline(12)+2=14, Masa 2 "1 devir · 30dk" (tam seed), Masa 1 seed'le harmanlanmış gerçek ortalama, açık oturum sayılmadı + yeşil nokta, 10 günlük oturum 7G'de yok/30G'de var (12→13); Sadakat — 150/40/%26,7/ziyaret 1/İkram ₺110 (baseline 40+seed 70, Ödemeler'le aynı)/damga 3-3-0/hoş geldin 1·50/iade 10/"2 işlem · 40 puan · 3 damga"; 30G 3685=3035+650. typecheck 8/8, lint 0/0. NOT: KPI etiketleri CSS uppercase (Türkçe İ) — testte regex'ler case-insensitive yazılmalı.

**Chrome temizliği + gerçek CSV export ✅ (2026-07-02):** Analytics'in ölü/sahte chrome'u kaldırıldı — "Kaydedilmiş" (3 hardcoded sahte rapor), "Özel rapor", "Karşılaştır" tamamen silindi (disabled/"yakında" stub da bırakılmadı). **"Dışa aktar" GERÇEK oldu:** aktif sekmenin yüklü verisinden client-side CSV (backend yok) — virgül + UTF-8 BOM (menü şablonuyla aynı konvansiyon; Türkçe karakterler Excel'de doğru), ham sayılar (₺/% başlıkta), çok-bölümlü raporlarda bölüm-başlığı satırları, dosya adı `{rapor-slug}-{range}.csv` (örn. `operasyon-raporu-7gun.csv`). Sekme başına içerik: Satışlar = bugün-KPI'ları (dürüst "bugün · düne kıyasla" etiketi) + tahsilat trendi + top ürünler + ödeme dağılımı; Ürünler = ABC tablosu (Sınıf + Değişim, null→"Yeni"); Masalar = tahsilat/devir/ort. oturum(dk)/şu an dolu; Ödemeler = yöntem + Toplam + İkram ayrı satır; Operasyon = iptal KPI+ürünleri, anormal satırlar (**Kapatan="—"** CSV'de de), personel kırılımı (Sahip/Üye(bölümler)/Sistem, Yüksek nakit Evet/Hayır); Sadakat = tüm metrikler + ham-sebep kullanımları. Buton yalnız sekme verisi yüklenene dek disabled (loading, ölü değil); Operasyon export'u owner-gating'i miras alır (sekme non-owner'a gizli + sorgular boş). Verify 9/9: sahteler yok, 6 sekme CSV'si BOM+Türkçe+doğru dosya adıyla indi, marker iptal satırı (`__QA_CSV_MARKER,1,45`) + owner e-postası operasyon CSV'sinde, range değişince `-30gun.csv`. **Analytics'te artık işlevsiz kontrol YOK — ekran tamamen dürüst.**

**Wave-2 backlog (verisi YOK → yapılmadı, unutulmasın):** Ekip sekmesi (rol/vardiya modeli yok) · müşteri retention/cohort · ürün marj×hacim (`menu_items.cost` anlık, sipariş anında snapshot'lanmıyor) · Ödemeler "hesaplaşma takvimi/başarı oranı" (İyzico provider-side) · `closed_by` migration'ı (anormal kapatmada "kapatan"ı açar) · sipariş durum-geçiş zaman damgaları (`sent_to_kitchen_at/ready_at/served_at` → mutfak hazırlık-süresi raporu; Orders scope-B ile aynı migration) · doluluk % (settings.hours güvenilir olursa).

### Siparişler panosu olgunlaştırma — P1+P2+P3 ✅ (2026-07-02→03). Migration: `20260702000000_orders_cancel_and_stage_timestamps.sql` (DEV'e push'lu; ⚠️ PROD-at-deploy listesi 6: 20260626, 20260627, 20260628, 20260629, 20260702 — not: 20260629 dosyası unmerged menu-redesign branch'indeydi, migration-drift onarımı için main'e kopyalandı).

**P1 (`9b290d2`) — para dürüstlüğü + kalite:** (1) Pano **Tahsilat chip'i comp'u sayıyordu** — TEK collected predicate client-safe evine taşındı: `isCollectedOrderRow` @ `@garsonless/db/order-client` (server barrel'dan re-export; `lib/queries.ts` alias'lar, PostgREST ikizi `collectedOrdersFilter` cross-link'li). Chip predicate'i kullanır + comp varken ayrı "İkram (tahsilat dışı)" chip'i. **Byte-identical kanıt: pano ₺60,00 == Ödemeler(Bugün) ₺60,00.** (2) Realtime **DELETE** kartı canlı düşürür (PK-only payload → filtresiz dinleme; state'te yalnız kendi restoranın siparişleri), **soft-delete** UPDATE-handler'da düşer. (3) **Optimistic rollback**: advance/cancel/drag hem typed `{error}` hem fırlatılan exception'da (ağ/500 → "Sunucuya ulaşılamadı") geri alınır + geçici hata banner'ı. (4) Silinmiş-masa etiketi çözülür (Pano feed disiplini). (5) SW push Türkçe ("Yeni sipariş!", sw.js fallback dahil).

**P2 migration:** orders += `cancel_reason text`, `cancelled_by uuid→auth.users`, `sent_to_kitchen_at/ready_at/served_at timestamptz`. **Damgalama DB TRIGGER** (BEFORE UPDATE OF status WHEN distinct + BEFORE INSERT ikizi — dashboard manuel siparişleri doğrudan sent_to_kitchen doğar): `coalesce(old, now())` → idempotent, her yazıcı kalıtır (payment-epic yarış-güvenliği dersi). **Backfill YOK** (geçmişe aşama tarihi uydurulmaz). **Anon'a 5 yeni kolon KAPALI** (column-grant otomatik dışlar; gerçek anon probe 5×42501, kontrol kolonu açık). Trigger matrisi 8/8: her aşama BİR kez damgalanır, re-flip coalesce'la üzerine yazmaz, status-dışı UPDATE dokunmaz, INSERT-as-sent damgalar.

**P2 — TEK iptal yolu (`cancelOrderDB`):** `updateOrderStatusDB` artık `'cancelled'` REDDEDER ("Use cancelOrderDB") — dashboard `cancelOrder` action'ı + kitchen action'ı tek yola indi. Kurallar ATOMİK WHERE'de: **İyzico-paid → BLOKE** (typed "İyzico panelinden" hatası; UI'da İptal butonu yerine bilgi notu; refund API entegrasyonu backlog), **cash/pos-paid → sebep ZORUNLU** (action ≥3 karakter; modal butonu sebepsiz disabled; server-replay ile sebepsiz istek REDDEDİLDİ kanıtlı), **unpaid → davranış aynı** (loyalty refund idempotent aynen — ledger diff: -40 redeem → +40 refund_cancel, damga -3 → +3). `cancelled_by` = işlemi yapan staff (settled_by kalıbı); kitchen token kimliksiz → null; iptal gerekçesi detay panelinde görünür. Re-cancel idempotent no-op; cross-tenant → not found. **Yarış testi GERÇEK bir boşluk yakaladı: `markOrderPaidDB` iptal edilmiş siparişe damga basabiliyordu (cancelled+paid = ciro dışı görünmez para) → settle'a simetrik atomik `neq(status,'cancelled')` guard + 0-satır teşhisi ("Order is cancelled — settlement refused") eklendi. 10× eşzamanlı settle∥cancel: iki sıralama da görüldü, kaybeden hep typed error, sıfır cancelled+paid.** db unit 67/67.

**P2 — aşama-bazlı yaşlanma:** kart pill'i + Gecikme artık **aşamada geçen süre** (prep→`sent_to_kitchen_at`, ready→`ready_at`; pre-migration null → `created_at` fallback — kanıt: aynı 30dk'lık iki sipariş, damgasızı "30 DK", 8dk-damgalı "8 DK"). KPI **"Ort. süre"→"Ort. hazırlık"** = mean(ready−sent), örneklem yokken dürüstçe "—" (kanıt: "—" → 10 dk). Detay **StatusTimeline gerçek saatler** (null → boş; Invalid Date yok). **Gecikme eşiği ayarlanabilir:** `settings.orders.late_threshold_min` (5–120 clamp, default 20; `lib/orders-prefs.ts`) — Settings→Bildirimler'e sayısal alan (kaydet 55 → DB 55 round-trip kanıtlı); input'un native max'ı aralık dışını submit'te bloklar, **okuma-tarafı clamp asıl güvenlik ağı** (DB'ye doğrudan 999 → etkin 120 → 130dk sipariş Geciken, kanıtlı). NOT: `types:gen` DEV şemasını (food-info-2 kolonları dahil) yansıtınca main'deki eski `ItemForm` literal'i kırıldı → unmerged branch'teki doğrulanmış literal düzeltmesi alındı. **Test tuzağı:** kart pill'leri de CSS uppercase ("30 DK") — runtime assert'lerde regex case-insensitive olmalı.

**P3 — matris + settle-from-board + hero + truncation:** (1) **Transition matrisi TEK kaynak** `ORDER_STATUS_TRANSITIONS`/`canTransitionOrderStatus` (enums.ts, her iki barrel'dan export): hedef→izinli-kaynaklar; dashboard yolları + kitchen hop'ları (pending|pending_approval|sent|paid→preparing dahil) + `ready→sent_to_kitchen` mis-tap düzeltmesi + self-transition idempotent no-op; `served`/`cancelled` terminal (çıkış yok); `paid`/`cancelled`'a giriş yok. **Server ATOMİK** (`.in('status', allowedFrom)` WHERE'de; 0-satır → "Illegal status transition: X → Y" teşhisi) — doğrudan-çağrı 9/9 (legal zincir + kitchen zinciri + 6 illegal red) + **gerçek-JWT action-replay** (pending→served → RED + DB değişmedi). Client: drag guard aynı fonksiyonu optimistic'ten ÖNCE çağırır + banner; terminal kartlar `useSortable({disabled})`. ⚠️ **dnd-kit drag'i Playwright'ta aktive edilemedi** (5 teknik: pointer headless/headed, keyboard, 2× native PointerEvent dispatch — bilinen otomasyon sınırı; DnD katmanının mount olduğu DOM-probe ile doğrulandı) → client guard kanıtı: paylaşılan-fonksiyon 9/9 + kod-yolu + derinlemesine savunma (server reddi + P1 rollback'i illegal optimistic'i zaten geri alır); elle 10 sn'lik drag kontrolü önerilir. (2) **Settle-from-board**: detay panelinde ödenmemiş+adisyonlu siparişe "Masayı tahsil et (adisyon)" → AYNI `SettlementSheet` (dynamic import, zIndex 130; `getOpenTableSessions` ile session çözümü; paralel implementasyon değil). **Kanıt: iki özdeş adisyon, biri Tables biri Orders yolundan Nakit'le kapatıldı → DB özdeş** (cash, settled_by=owner, paid, session normal kapanış, close_reason null). (3) **Boş-durum hero** yalnız bugün 0 siparişte ("Bugün henüz sipariş yok" + QR yönlendirmesi); sipariş varken filtre boş eşleşirse hero DEĞİL kolon "Sipariş yok" (kanıtlı). (4) **Truncation**: SSR limiti 300→500 + `initialTruncated` banner'ı ("en eski siparişler gösterilmiyor — Geçmiş'ten ulaşın") — **gerçek 501 sipariş seed'iyle** kanıtlı; realtime yeni sipariş banner varken de üstte belirdi. (5) **KDS gerçek-token testi**: kitchen dev + gerçek token ile pending→preparing→ready→served UI'dan tıklanarak yürüdü + trigger damgaları (matris kitchen'ı kırmadı). **Test tuzakları:** SettlementSheet tek-siparişli adisyonda hızlı-doldur satırı render etmez → 'Nakit' seçicisi `.last()` olmalı; KDS kartına art arda hızlı tıklama `loading` guard'ına takılır → durum-poll'lu ilerleme.

### Analytics grafik redesign — shared primitive katmanı + tiered interaktivite 🚧 (2026-07-04)

Tüm analytics grafikleri el-yazması ham SVG/div idi (kütüphane yok); **garble bug'ın kök nedeni JS tooltip çakışması DEĞİL** — üst üste binen **her zaman-açık statik SVG `<text>` etiketleri** (line chart'ın peak-box'ı axis tick'lerine, scatter'ın 14 sabit ürün-adı etiketi kümelenince birbirine giriyordu) + küçük sayılarda dejenere yuvarlama ("₺0K ₺0K", "%0 %0"). Düzeltme = statik etiketleri SİL, tek hover-tooltip'e taşı.

**P1 (`feat/analytics-charts-p1`) — primitive katmanı + iki garbled chart:** **recharts 2.15.4** eklendi (React 19 peer temiz; en sade peer seti — react-is gerekmez). `components/analytics/chart-primitives/`: `format.ts` (magnitude-adaptive `moneyTick` → "₺250/₺1B", tek-ondalık `percent` → dejenere yuvarlama biter; TEK kaynak = anti-drift), `axis.ts` (tick/grid/margin presetleri), `ChartTooltip.tsx` (TEK presentational `TooltipCard` + recharts `<Tooltip content>` adaptörü — hem recharts hem non-recharts heatmap kullanır, dual-render yok), `FloatingTooltip.tsx` (P2 heatmap için follow-cursor, `position:fixed` → Card overflow'unu aşar, portal yok), `ChartFrame.tsx` (ResponsiveContainer + dürüst empty-state passthrough). **Tokenlar** globals.css'e: `--chart-series-*/-abc-*/-cat-*/-grid/-axis-text` (hardcoded literaller — PAYMENT_COLORS, ABC tonları, #ffd089 — mevcut semantik sete map'lendi; recharts `fill="var(--chart-*)"` SVG'de çözülüyor, doğrulandı). **Line chart (FULL tier)** = `ComposedChart` (Area+Line current + dashed prev) + crosshair + TEK tooltip + `<Brush>` (yalnız Çeyrek/Yıl); peak-box SİLİNDİ → değeri tooltip'te. **Scatter (HOVER tier)** = `ScatterChart`+`Cell` (ABC renk) + ZAxis (bubble=revenue) + tooltip; 14 sabit etiket SİLİNDİ → ad/adet/pay/tutar/sınıf yalnız hover'da. İkisi de `next/dynamic ssr:false` (KPI/tablolar önce boyanır, ResponsiveContainer 0-width SSR sorunu yok; recharts ayrı chunk — analytics First Load 125kB, recharts değil). Card `overflow:visible` override'ıyla tooltip kenarda kırpılmıyor.

**Verify (Test Cafe B gerçek-auth; 6 ürün + peak-günlü seed → temizlendi):** typecheck 8/8, lint 0/0, prod build ✓. Runtime: line hover → TEK tooltip "1 Çar · Bu dönem ₺280 · Önceki dönem ₺0" (crosshair + adaptive axis, garble YOK); scatter at-rest → sabit etiket YOK, hover → TEK tooltip gerçek datum (Espresso · Adet 18 · %38 · ₺990 · A); Brush 7G/30G'de YOK, Çeyrek/Yıl'da VAR; kenar-hover tooltip viewport içinde (x=1239 w=160, clip yok); bubble'lar yeşil (var() çözüldü). **Donut/heatmap/diğerleri P1'de DOKUNULMADI** (scope temiz). **Test tuzağı:** range değişince "Rapor yükleniyor…" → brush/DOM assert'leri `waitForFunction(!includes('Rapor yükleniyor'))` ile beklemeli; `.recharts-scatter-symbol` getComputedStyle wrapper `<g>`'yi seçip yanlış rgb(0,0,0) döndürür — görsel/screenshot asıl kanıt.

**P2 (`feat/analytics-charts-p2`) — kalan HOVER tier (3 grafik, P1 primitiflerini yeniden kullanır):** **Ödeme dağılımı donut** = recharts `PieChart`+`Pie` (innerRadius donut) + `Cell`(--chart-cat-\*) + `activeShape` hover arc pop-out + legend row hover-dim; **yalnız `.collected` besleniyor** — İkram pie'da SLICE değil, tooltip'te datum değil (İkram context satırı ayrı, altta). **Saat×Gün heatmap** = CSS grid KALDI (recharts'ta heatmap yok) + hücre hover'da `FloatingTooltip` (`position:fixed` Card'ı aşar) "Gün · HH:00 · Sipariş N". **İptal-trend bar** = recharts `BarChart`; compaction caller'da kalır. Donut+bar `next/dynamic ssr:false`; heatmap normal import. `PAYMENT_COLORS` da tokenlendi (PaymentRows/MINIMAL kullanıyor). **Verify (comp+cancel+heatmap-cell seed → temizlendi):** typecheck 8/8, lint 0/0, build ✓ (analytics 126kB). **A (donut comp exclusion — para-kritik):** merkez collected ₺460 (comp ₺70 HARİÇ; sızsa 530), İkram AYRI, 4 arc = collected (comp arc yok), ring hover "Fiziksel POS · ₺205 · %43,6 · Adet 3" — İkram sızmıyor. **B:** heatmap "Sipariş 4" (DB birebir). **C:** bar "İptal 2" + KPI regresyonsuz. **D:** tek renderer (≤1 wrapper/chart). **Test tuzağı:** sayfada ≥2 recharts → `.recharts-tooltip-wrapper.first()` yanlış chart'ın boş wrapper'ını alır (chart'a scope'la); pie sector bbox merkezi donut DELİĞİNE düşer (ring yarıçapında hover'la). NOT: line total (₺360) vs donut (₺600) farkı P2 DEĞİL → pre-existing `getSalesOverTime` UTC-bucket tuhaflığı (ayrı iş). **P3:** Tables/Payments/Staff yatay bar + Sadakat listeleri → MINIMAL row-highlight.

### Restoran-yerel-gün (timezone) sistemik düzeltmesi ✅ (2026-07-04) — Migration `20260704000000_restaurant_timezone.sql` (DEV'e push'lu; ⚠️ PROD-at-deploy listesi 7: 20260626/27/28/29/0702/**0704**)

**Kök sorun (audit'ten):** `getSalesOverTime` daily branch satırları TRUE UTC tarihiyle (`toISOString().slice(0,10)`) ama çıktı bucket'larını LOCAL-gece-yarısından türetilen UTC tarihiyle key'liyordu → UTC+3 dev makinesinde bugün'ün cirosu düşüyor (line ₺360 vs donut ₺600). Geniş resim: ~7 query "bugün"ü bağımsızca `new Date(); setHours(0,0,0,0)` ile (server-local, restaurant-local DEĞİL) hesaplıyor; restoran timezone ayarı YOK. `isCollectedOrderRow` merkezileştirmesinin zaman-analoğu.

**P1 (`feat/restaurant-timezone-p1`) — TEMEL, sıfır davranış değişikliği:** (1) **Migration**: `restaurants.timezone text NOT NULL DEFAULT 'Europe/Istanbul'` (kolon; DB-default mevcut satırları atomik doldurur, app-side fallback dağınıklığı yok). ANON: restaurants row-policy + menü `select('*')` → timezone anon-okunur olur, **kabul edilebilir** (sır değil). Türkiye 2016'dan beri DST yok (sabit +3). (2) **Pure modül** `packages/db/src/restaurant-time.ts` (client-safe, native Intl, sıfır bağımlılık; iki barrel'dan export): `startOfRestaurantDay`, `startOfDayNDaysAgo` (takvim-günü ile geriler, ±24h DEĞİL → DST-doğru), `rangeWindow` (getRangeWindow'un tz-aware hâli), `restaurantDayKey` (bucketCounts localDateKey'inin tz-parametreli genellemesi = getSalesOverTime bug'ının tam çözümü), `restaurantHour`, `restaurantWeekday` (0=Pzt..6=Paz), `normalizeTimeZone` (garbage→Istanbul). Dönen Date'ler UTC instant; key/hour/weekday tz-yerel. Tek-geçiş offset yalnız gece-yarısı için (her zaman tekil). (3) **`getRestaurantTimezone`** = react `cache` (request-scoped) + fallback; queries.ts'e eklendi ama **hiçbir query tüketmiyor** (P2). (4) Unit suite `restaurant-time.test.ts` (10 test).

**Verify:** typecheck 8/8, lint 0/0, db suite **77/77** (67+10). **A (TZ-bağımsızlık):** aynı ABSOLUTE UTC-instant/key assertion'ları `TZ=UTC`/`TZ=Asia/Kolkata`/`TZ=Europe/Istanbul` altında **üçünde de 10/10 aynı** → modül `tz` parametresini okuyor, makine TZ'sini değil. **B (DST):** Berlin spring 23h / fall 25h; mutlak gece-yarıları doğru; takvim-günü iterasyonu driftsiz; "getSalesOverTime'ı bozan invariant" (instant'ın günkey'i == local-midnight'ının günkey'i) tüm zone/DST'lerde tutuyor. **C (backfill gerçek sorgu):** maf-lounge + test-cafe-b ikisi de `Europe/Istanbul`. **D:** request-scoped cache + garbage-fallback. **E (sıfır davranış):** queries.ts diff yalnız import+helper (date-query'ler el değmemiş); analytics+pano render smoke ✓. pg_cron sweep yaş-bazlı → TZ-agnostik, DEĞİŞMEZ. **Test tuzağı:** yeni dep/types-gen sonrası `.next` stale-chunk 500 → `rm -rf .next`+restart. **P2 (`feat/restaurant-timezone-p2`) — sweep, tüm date query'leri modüle bağlandı:** `getRangeWindow` silindi → `rangeWindowFor(restaurantId, range)` async wrapper (getRestaurantTimezone cache + pure `rangeWindow`); **8 tüketici** (getTopItems/PaymentBreakdown/ProductReportData/TablesReportData/Cancellation/AbnormalClose/StaffSettlement/Loyalty) migrate edildi. "Bugün"/bucket fonksiyonları: getDashboardKPIs (`startOfRestaurantDay`+`startOfDayNDaysAgo`), getHourlySales (`restaurantHour`), getActivityFeed, **getSalesOverTime her iki branch** (satır key'i + çıktı bucket key'i artık TEK basis = `restaurantDayKey`/`restaurantHour` → bugün orphan olmuyor, akut bug KAPANDI), getHeatmapData (`restaurantWeekday`+`restaurantHour`), getPanoSnapshot (today+hourly+heatmap). **bucketCounts** artık `tz` param alıp `restaurantDayKey`/`restaurantHour` kullanıyor (kendi localDateKey'i silindi — TEK kaynak). Kapsam-dışı ama aynı sınıf olan **orders/page.tsx SSR "today"** da restaurant-local yapıldı (board kafe-günü). **Kalan client-side gün-sınırları (browser-TZ, kozmetik → follow-up):** RestaurantShell sipariş-sayaç badge'i, HistoryModal gün-gruplaması, PanoClient gündüz/gece teması + "Şu an HH:00" — tz client'a threadlenmeli (ayrı küçük iş, veri-kritik değil).

**Verify (Test Cafe B explicit Istanbul; bugün collected+comp+cancel seed → temizlendi):** typecheck 8/8, lint 0/0. **A (HEADLINE — akut bug):** Satışlar line total == Ödemeler donut total == ₺560 (önceden line ₺360'tı, bugün düşüyordu) → **line=donut, kapandı**. **B (regresyon yok, restaurant-local altında):** getDashboardKPIs "Tahsil edilen" bugün=₺280; getPanoSnapshot CİRO=₺215 (parse); orders board bugünün siparişini gösteriyor; cancellation trend (bucketCounts→restaurantDayKey) + staff/abnormal/loyalty render. Dev'de (UTC+3==Istanbul) getSalesOverTime DIŞINDA her şey birebir aynı. **C:** bucketCounts artık getSalesOverTime ile aynı restaurantDayKey/restaurantHour'u kullanıyor (iki değil tek doğru impl). **D:** grep = 0 `getRangeWindow` çağrısı (yalnız yorum). **E (N+1 yok):** getRestaurantTimezone react-cache → 9 alt-sorgulu rapor TEK tz lookup (getRestaurantById kalıbı). **Prod etkisi:** UTC prod'da tüm gün-sınırı UTC→Istanbul +3h kayar (doğru; 00:00-03:00 Istanbul siparişleri artık doğru güne). pg_cron sweep yaş-bazlı → değişmedi. **Test tuzağı:** pano greeting saate bağlı ("İyi günler" vs "Günaydın") + CİRO KPI ondalıksız ("₺215") → assert'ler greeting-agnostik + numeric-parse olmalı.

### Müşteriler CRM dürüstlük turu ✅ (2026-07-11) — Migration `20260711020000_customer_restaurant_associations.sql` (DEV'e push'lu; ⚠️ PROD-at-deploy listesine EKLENMELİ — bkz. Kritik pending items)

**5 faz tamamlandı, hepsi push'landı:** `02931be` auth-link gösterimi (Bağlı hesap / Bağlantısız kayıt, e-posta, consent maskeleme) · `f65fc0d` tarih/etiket dürüstleştirme ("Üye" → "Müşteri kaydı", "Katılım" → "İlk aktivite") · `b6005f1` global segment sayıları (chip sayıları görünür sayfa/arama sonucundan değil, listeyle aynı kanonik RPC predicate'lerinden — `getRestaurantCustomerSegmentCounts`) · `97eafe7` **customer_restaurants association + cross-tenant izolasyon**.

**Association gerekçesi:** `customers.auth_user_id` GLOBAL platform kimliğidir — aktivitesiz auth-linked müşteriyi doğrudan CRM adaylarına almak cross-tenant PII açığı olurdu (bir restoranın müşterisi başka restoranın CRM'inde görünürdü). Yeni `customer_restaurants`: PK `(customer_id, restaurant_id)`, `source in ('auth','activity','consent')`, `linked_at`; RLS açık + anon/authenticated REVOKE (service-role-only; gerçek anon probe **42501**). Backfill orders + loyalty ledger + consents'ten. `ensureCustomerForAuthUser` association'ı idempotent upsert eder; `get_restaurant_customers` aday CTE'si (pg_get_functiondef üzerinde guard'lı fragment-replace migration'ı) ve detay/grant gate'i (`hasActivityAtVenue`) association'ı tek başına kabul eder.

**Runtime izolasyon kanıtı (DEV, throwaway auth user + gerçek `ensureCustomerForAuthUser` yolu → tam temizlik; maf-lounge READ-ONLY; 32/32):** aktivitesiz auth-linked müşteri Test Cafe B listesinde göründü (authLinked=true, spend/visits/points/lifetime 0, lastSeen/firstSeen null, consent'siz → e-posta maskeli; total 2→3); **maf-lounge'da GÖRÜNMEDİ** (arama 0 hit, liste 3→3, `getRestaurantCustomerDetail(maf, id)` UUID-probe → null, segment sayıları değişmedi); B detayı association'la açıldı ve ₺0 / 0 ziyaret / son görülme — / boş timeline gösterdi; throwaway varken bile B segment sayıları değişmedi (aktivitesiz müşteri hiçbir built-in segmente girmez — 'new' first_seen ister) + mevcut müşteri araması ve pageSize=1 pagination regresyonsuz; temizlik sonrası **SIFIR orphan** (customers/customer_restaurants/orders/ledger/consents/auth user) ve iki tenant'ın liste+segment baseline'ları **deep-equal** geri döndü. Dürüstlük notu: gerçek yol Test Cafe B welcome bonus'u yüzünden 1 `points:welcome` satırı bastı — "association var, aktivite yok" senaryosu throwaway'in KENDİ ledger satırı silinerek kuruldu. Kapılar: db typecheck ✓, db unit **105/105**, dashboard typecheck/lint ✓, dashboard production build ✓, `git diff --check` temiz. **Test tuzağı:** scratchpad'den tsx script'i `.mts` uzantısı ister (top-level await, CJS inference); node PATH'te değil → `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"`.

### 🔖 HANDOFF NOTU (2026-07-10, oturum sonu — başka model devralacak)

**Git durumu:** main = `91c8270` (push DURUMU: `94ad043` docs-audit + `91c8270` P2-F1 henüz PUSH'LANMAMIŞ olabilir — `git status`/`git log origin/main..main` ile kontrol et). Working tree temiz. Dev server'lar: dashboard 3000, kitchen 3002, marketing 3003, menu 3011 (menu F1 middleware'iyle restart'lı).

**Bu oturumda biten ve CLAUDE.md'de HENÜZ kayıtlı olmayan işler (kronolojik):**

1. **SMS auth P1.1+P1.3 (`1236769`):** `assertSmsConfig()` (packages/db/src/sms.ts) — prod'da mock/unset SMS_PROVIDER → boot THROW (apps/menu/instrumentation.ts register()'dan; getSmsProvider'da defense-in-depth ikizi); `CUSTOMER_SESSION_SECRET` + provider-cred varlığı da boot'ta zorunlu. `requestOtp` yeniden sıralandı: generate → rate-check → SEND → yalnız başarıda insert; provider hatası typed `sms_failed` → route 503 (429/400'den ayrı), rate budget YANMAZ (3 ölü-provider denemesi → 0 satır → hemen ardından gerçek istek throttle'sız, kanıtlı). 11 unit test (sms.test.ts). **P1.2 (gerçek Netgsm) HÂLÂ BEKLEMEDE: kullanıcıdan NETGSM_USERCODE/PASSWORD + onaylı MSGHEADER gerekli.** ⚠️ P3-retirement tuzağı: `CUSTOMER_SESSION_SECRET` emekli edilirken sms.ts:134'teki kontrol de güncellenmeli yoksa prod boot ölür.

2. **Code-review düzeltmeleri (bc253e2 içinde):** (a) Fiş KDV dökümü artık İNDİRİMLİ bazdan — `computeVatBreakdown(lines, chargedTotal?)` indirimi oran kovalarına orantısal dağıtır, kalıntı en büyük kovaya, Σ==TOPLAM kuruş-kesin (5 DISCOUNT testi); ReceiptModal "Satır toplamı/İndirim" satırları basar. (b) `updateSettings` non-owner yazımı DENYlist→ALLOWLIST (`store/contact/hours/tax/languages/notifications/orders`) — 'settings'-üyesi themeSettings/pageBlocks yazamaz.

3. **Masabu rebrand (790d5de + 0aa026c, merged+pushed):** TÜM user-facing copy garsonless→masabu (başlıklar, fiş, SMS şablonu "Masabu doğrulama kodunuz", üye kodu GRS-→MSB-, KVKK linki masabu.co/legal#kvkk [gerçek route: marketing /legal hash-tab], marketing e-postaları @masabu.co, domain hint'leri menu.masabu.co, MENU_BASE fallback, .env.production.example, HelpModal "Masabu'yu tanı"). **OUT-OF-SCOPE (bilerek dokunulmadı):** @garsonless/\* paket adları (109 dosya), GarsonlessTheme tipi, JWT iss/aud (garsonless-menu/-customer), gl_member, localStorage key'leri (garsonless-cart/-active-order/-floor), keyframe/postMessage protokolleri, test-owner-b@garsonless.dev fixture'ı, Supabase proje etiketleri. **Logo asset'leri:** assets/brand/ → 4 app public/'ına favicon seti + site.webmanifest (metadata.icons ile), dashboard+marketing public/brand/ wordmark SVG'leri; tüm "m-kutusu+metin" lockup'ları gerçek wordmark <img>; **VisualPanel (auth hero) KOYU zemin → white-background varyantı yuvarlak plaka** (screenshot'la yakalandı); A4/fiş vektör SVG (baskı-keskin); marketing og-image.png 1200×630 + openGraph/metadataBase. Logo QR-mozaik "masabu." (siyah mürekkep + yeşil "bu.") → açık zeminde transparent, koyuda white-bg varyantı.

4. **Supabase Auth CANLI durumu (DEV yxsegwkzyiscrxiwdeuf):** (a) **Google provider AKTİF + gerçek OAuth smoke-test geçti** — fixture: `sutlacgullac@gmail.com` = auth.users `1b8c18d3-72c2-499f-a23b-f9918a014dc0`, providers=[google]; customers satırı YOK (F2 linking testinin hazır fixture'ı). (b) **customer_access_token_hook Auth ayarlarında KAYITLI ve CANLI** (P1 entry'sindeki "kayıtlı değil" notu ARTIK ESKİ): gerçek staff girişi (test-owner-b şifreyle) → JWT `user_type=staff`; fixture'a taze issuance → `user_type=customer`; sub/email/role/aud/iss bozulmadı. (c) **send-email-hook edge function (`259d244`) deploy'lu v1 ACTIVE** — standardwebhooks imza (v1,whsec\_ prefix soyulur), TR konu/şablonlar (Masabu, 6-haneli kod büyük, "10 dakika" notu), Resend'e noreply@masabu.co; 401 imza/400 eksik/500 resend-hata/200 ok; `--no-verify-jwt` deploy + **config.toml [functions.send-email-hook] verify_jwt=false (KRİTİK: Auth hook POST'u JWT taşımaz; true olursa tüm auth e-postaları ölür)**. **Secrets SET'Lİ:** SEND_EMAIL_HOOK_SECRET + RESEND_API_KEY (supabase secrets list'te). **E2E KANITLI:** gerçek `signInWithOtp` → hook 200 → Resend kabul (masabu.co domain doğrulaması çalışıyor). Hook secret'sızken 500 "Hook not configured" (fail-safe). ⚠️ Hook PROJE-GENELİ: staff magic-link/reset mailleri de artık Resend'den — staff mail regresyonu P2/P3 matrisinde test edilmeli. ⚠️ Şablon "10 dakika" diyor ama Supabase email-OTP expiry default 1 SAAT — **AÇIK SORU: dashboard'dan 600sn'ye çekilecek Mİ (kullanıcı karar vermedi)**, yoksa şablon metni düzeltilmeli.

5. **P2 audit (`94ad043`):** `docs/p2-customer-auth-audit.md` — 6 verifyCustomerSession çağrısının dosya:satır haritası (HİÇBİRİ phone claim'i okumaz), gl_member set/read/clear, otp_codes yalnız loyalty.ts'de (temiz DROP edilebilir), menu'de middleware YOKTU + @supabase/ssr kurulu-boştaydı, customers 2 satır (auth_user_id/email null), RLS/realtime'ın customer kimliğine SIFIR bağımlılığı, kritik implicit bağ: /api/orders→customer_id→sadakat (sessiz-guest regresyonu ana test).

6. **P2 PLANI (onaylı, 3 faz):** F1 altyapı ✅ / F2 login UI + ensureCustomerForAuthUser / F3 6-site swap (3a düşük-risk 4'lü → 3b /api/orders İZOLE kendi runtime testiyle → 3c split/create + logout). Kilit kararlar: dual-read YOK (swap anında gl_member ölür; eski cookie = yalnız 2 test müşterisi); **eski verify-otp'nin YAN İŞLERİ (creditWelcomeBonus + recordConsent + ad) ensureCustomerForAuthUser'a TAŞINMALI yoksa yeni üyeler bonussuz/consent'siz doğar**; OTPScreen 6-kutu component'i aynen yeniden kullanılır; retirement P3 ayrı iş.

7. **P2 F1 ✅ (`91c8270`):** `apps/menu/lib/supabase-server.ts` (createMenuServerClient — YALNIZ kimlik kaynağı, veri anon/service-role'da), `lib/supabase-browser.ts` (createMenuAuthBrowserClient — anon realtime client'tan AYRI), `middleware.ts` (getUser refresh + supabaseResponse cookie-race disiplini, redirect YOK, matcher \_next/statik/brand hariç), `/api/auth/whoami` (salt-okuma probe + F2/F3 test çapası). **Verify:** fixture için gerçek session (admin generateLink magiclink→verifyOtp deseni — interaktif Google'sız gerçek issuance) + @supabase/ssr kendi serileştirmesiyle cookie → whoami 200 {email,userId}; **expires_at geçmişe çekilmiş session → hâlâ 200 + 3 ROTASYONLU auth-token Set-Cookie** (refresh propagation kanıtı); cookie'siz → authenticated:false; SSR 200×2 + 3 anon realtime kanal SUBSCRIBED + 0 konsol hatası; typecheck 8/8, lint 0/0, menu build ✓ (ƒ Middleware 89 kB). **Test tuzağı:** @supabase/ssr session cookie'si CHUNK'LANIR (sb-…-auth-token.0/.1) — doctoring/okuma için parçalar birleştirilip 'base64-' prefix'i soyulmalı; tek parça bazlı JSON.parse sessizce başarısız olur.

**SIRADAKİ İŞ — P2 F2 (onay bekliyor):** MemberSheet JoinScreen → AuthScreen (ad + email → signInWithOtp + Google butonu + gizli Apple + KVKK checkbox'ları default işaretsiz + "Şimdilik geç"); OTPScreen onVerify → supabase.auth.verifyOtp({email,token,type:'email'}); `apps/menu/app/auth/callback/route.ts` (OAuth exchangeCodeForSession); `POST /api/auth/ensure-customer`; `ensureCustomerForAuthUser` (packages/db, service-role): customers upsert onConflict auth_user_id + lower(email) dedupe + app_metadata.user_type='customer' damgası (admin.updateUserById, idempotent) + welcome bonus + consent taşıma. Sonra F3 (getCustomerSession() react-cache helper + kademeli swap). **Verify fixture'ları hazır:** Google kullanıcısı linklenmemiş; Test Cafe B owner şifresi apps/menu/.env.local TEST_OWNER_B_PASSWORD.

### Müşteri kimliği → Supabase Auth — P1 saf-kod temeli ✅ (2026-07-10) — Migration `20260710000000_customer_auth_link.sql` (DEV'e push'lu; ⚠️ PROD-at-deploy listesine eklendi)

**SMS-epic P1.1/P1.3 disipliniyle bölündü: dış-prereq'siz kısım şimdi; Google OAuth client + Resend masabu.co doğrulaması + provider enable + Send Email Hook + P2 client SONRA.** (1) **Şema:** `customers.auth_user_id uuid UNIQUE → auth.users ON DELETE SET NULL` (nullable; auth user silinse loyalty/order geçmişi yaşar), `phone` NOT NULL kaldırıldı (UNIQUE durur — Email/Google müşterisinin telefonu yok), `email text` + partial `UNIQUE(lower(email)) WHERE NOT NULL` (email↔Google aynı-adres dedupe). 6 FK'lı domain anchor `customers.id` DEĞİŞMEDİ. (2) **`is_staff_user(p_user_id)`** — Team&Roles helper'larının explicit-uid varyantı (hook `supabase_auth_admin` olarak BAŞKA kullanıcı için koşar; `auth.uid()` okuyamaz): herhangi restoran owner'ı VEYA aktif üye. (3) **`customer_access_token_hook(event)`** — `user_type` claim'i: `app_metadata.user_type` damgası ÖNCELİKLİ (kanıtlı: staff uid + customer damgası → customer), yoksa `is_staff_user` türetmesi, bilinmeyen → 'customer' güvenli varsayılan; diğer claim'ler korunur (`jsonb_set` yalnız ekler). SECURITY DEFINER + pinned search_path; execute yalnız `supabase_auth_admin` + `service_role` (doğrulama aracı), anon/authenticated REVOKE (gerçek anon rpc → 42501 kanıtlı). (4) **RLS DEĞİŞMEDİ:** customers/otp_codes/consents sıfır anon/authenticated policy (anon probe 3/3 boş). **Verify (gerçek DEV):** mevcut 2 müşteri satırı birebir (phone durur, auth_user_id/email null — veri kaybı 0); hook matrisi 5/5 (gerçek owner→staff, random→customer, damga-önceliği, claim korunumu, çift revoke); maf-lounge dokunulmadı; typecheck 8/8, lint 0/0, db 105/105; types.gen auth_user_id/email içeriyor. **⚠️ Hook Auth ayarlarında KAYITLI DEĞİL (bilerek)** — dashboard toggle'ı, Email/Google provider'ları yapılandırılınca elle açılacak MANUEL adım. Sonraki: dış prereq'ler (Google client id/secret, Resend masabu.co) → provider enable + Send Email Hook → P2 (menu @supabase/ssr + UI + 6 call-site swap + first-login linking).

### Menü ürün redesign — P1 dashboard stabilizasyonu ✅ (2026-07-05, `feat/menu-product-redesign`)

Stale 4-commit ürün/nutrition branch'i güncel `main` üzerine gerçek rebase edildi (**24 commit gerideydi; 4/4 uygulandı, 0 conflict**). Linked DEV (`yxsegwkzyiscrxiwdeuf`, Garsonless QR) üzerinden `types:gen` yeniden çalıştırıldı; üretilen `types.gen.ts` mevcut dosyayla birebir aynıydı. P1 yalnız dashboard create/edit katmanını stabilize eder; müşteri menüsünde kcal/alerjen/diyet gösterimi **P2'ye bırakıldı**, protein/karbonhidrat/yağ/cost anon'a yeniden açılmadı.

**P1 davranışları:** maliyet-marj hesabı ortak ve testli `calculateMarginPercent` helper'ına taşındı. Diyet iddiaları server action'da doğrulanır: vegan ürün vejetaryen olarak normalize edilir; helal + alkol/domuz çelişkisi kaydı bloklar. İçerik sırası gerçek JSON sırasıdır; yukarı/aşağı butonları native keyboard erişilebilir ve sıralama DB'ye kalıcı yazılır. Nutrition alanındaki her değişiklik "gözden geçirildi" bayrağını düşürür. `createItem`/`updateItem` artık `.select('*')` ile DB'nin gerçek `menu_items` satırını döndürür; drawer/panel/quick updates fabricated `created_at`, `updated_at`, `position` veya audit alanı üretmez. Eski `ItemForm` repo çapında sıfır referans doğrulandıktan sonra kaldırıldı.

**P1 verify (Test Cafe B real auth; snapshot→restore; maf-lounge write yok):** 3-adımlı drawer ile cost ₺80, 420 kcal, 18/42/20 makro ve iki içerikli throwaway ürün oluşturuldu; Enter ile Domates yukarı taşındı ve DB'de `[Domates, Soğan]` sırası/amount değerleri korundu. Action'dan dönen gerçek `id/created_at/position` panelde DEV satırıyla birebir; düzenlemede gerçek `updated_at` birebir. Mevcut üründe helal+alkol kaydı server mesajıyla reddedildi ve DB `updated_at` değişmedi. Cost ₺70 güncellemesi, içerik sırası ve review kullanıcısı kalıcılaştı. Anon `cost,protein_g,carb_g,fat_g` probe → **42501**; owner aynı alanları okuyabildi. Cleanup: ürün sayısı **6→6**, orphan **0**, mevcut ürünün tüm iş alanları restore edildi (`updated_at` restore UPDATE trigger'ıyla doğal olarak ilerledi). Browser page error **0**. Workspace typecheck **8/8**, lint **0/0**, DB unit **80/80**, dashboard production build geçti.

**P2 — müşteri menüsü gösterimi ✅ (2026-07-05):** public `getMenuItems` explicit select listesine yalnız `contains_allergens`, `may_contain_allergens`, alkol/domuz ve `is_vegan/is_vegetarian/is_halal` beyanları eklendi; `cost/protein_g/carb_g/fat_g` query'de **yoktur**. Kartta porsiyon kcal, açık diyet rozetleri ve isimleri sıkıştırmayan tek “Alerjen bilgisi var” bildirimi görünür. Detayda diyet rozetleri başlık altında, içerik miktarları adların yanında; **“Alerjenler · ürün içerir”**, **“Olası çapraz temas”** ve kırmızı **“Önemli içerik uyarısı”** ayrı başlık/renk/konteynerlerle gösterilir. Çıkarılan içerik alerjensizlik vaat etmez.

**P2 filtreleri + verify:** Default ve Spain temaları aynı multi-select Vegan/Vejetaryen/Helal chip slotunu kullanır; eşleşme AND ve yalnız açık `=== true` beyanıdır (eksik/false uygun sayılmaz), alerjensiz filtresi yoktur. Filtre sonrası ürünsüz kategoriler gizlenir; sıfır eşleşmede “Seçili filtrelere uyan ürün yok.” görünür. Test Cafe B snapshot→restore matrisinde Default/Spain × desktop 1280×900/mobile 390×844 **4/4**: kart kcal/rozet/tek alerjen bildirimi, helal=false ürünün dışlanması, yalnız explicit helal=true eşleşmesi, Vegan+Helal sıfır sonucu, kategori gizleme, yatay taşma **0**, page error **0**. Default detayda `Ekmek · 120 g`, kesin Gluten/Süt ile trace Susam ayrı; Spain detayda alkol+domuz uyarısı belirgin. Üç ürünün tüm iş alanları restore edildi; maf-lounge write yok. Gerçek anon REST: izinli P2 alanları okunur, hassas dört alan restore sonrasında da **42501**. Workspace typecheck **8/8**, lint **0/0**, menu production build geçti.

**P3 — test ve tam runtime doğrulaması ✅ (2026-07-05):** ortak nutrition helper'ları ondalık/metin normalizasyonu, contains/trace karşılıklı dışlama, içerik sıralama ve review invalidation davranışlarını tek yerde toplar; dashboard drawer/panel ile server action aynı kuralları kullanır. DB unit suite **85/85**: legacy ingredient JSON + amount, bozuk/virgüllü sayı, sınırlar, margin (boş/0/normal/negatif), diyet çelişkileri, ürün+içerik+modifier alerjen birleşimi, çıkarma tercihinin alerjen garantisi vermemesi ve sipariş snapshot değişmezliği kapsanır.

**P3 gerçek runtime (Test Cafe B real auth; snapshot→restore):** 3-adımlı drawer'da geri dönüş state'i korundu, bozuk sayı bloklandı, virgüllü sayı güvenle normalize edildi, tek create action/tek DB satırı oluştu ve cancel **0 write** bıraktı. Gerçek action payload'larıyla vegan fakat vejetaryen değil ve helal+alkol çelişkileri reddedildi; conflict write **0**, nutrition güncellemesi review'i düşürdü. Cost ₺50 / fiyat ₺100 → margin **%50** owner tarafında okundu. Default mobile + Spain desktop kart/modal/filtreleri ve yatay taşma **0** doğrulandı. Gerçek müşteri siparişinde ürün Yumurta + içerik Yer fıstığı/Gluten + modifier Süt snapshot birleşimi korundu; `ÇIKAR: Soğan` seçilmesine rağmen Yer fıstığı uyarısı kaldı. Menü alerjenleri siparişten sonra değiştirilince geçmiş sipariş snapshot'ı değişmedi; aynı snapshot dashboard sipariş detayı ve mutfak kartında görüntülendi. Anon hassas kolon probe **42501**, owner cost read başarılı. Cleanup: ürün orphan **0**, sipariş orphan **0**, maf-lounge fingerprint değişmedi. Final gates: typecheck **8/8**, lint **0/0**, DB **85/85**, dashboard+menu production build, smoke **4/4**.

### Müşteri hesap bölüşme (split payment) 🚧 (2026-07-04) — Migration `20260704020000_split_payment.sql` (DEV'e push'lu; ⚠️ PROD-at-deploy: split migration'ı listeye eklendi. NOT: eşzamanlı `20260704010000_menu_items_anon_column_grant` (714f385) ile timestamp çakıştı → split `020000`'e yeniden adlandırıldı; CLI first-push başarısız migration'ı schema_migrations'a kaydetti → `migration repair --status reverted` + rename ile çözüldü).

**Yeni özellik:** müşteriler kendi paylarını uygulama içinden öderler — kart = İyzico (gerçek, self-settle), nakit = yalnız BEYAN ("₺X nakit ödeyeceğim", asla paid_at set etmez); garson fiziksel parayı onaylar (bugünkü settleOrder ile aynı yetki modeli). Bölüşme session-seviyesinde (bir masanın tüm turları). P1 kararı: session YA tek-ödeyen YA split (karışım yok).

**P1 (`feat/split-payment-p1`) — şema + çekirdek model + finalize (UI yok):** (1) **`payment_shares`** (session-seviyesi: amount, method[iyzico|cash], status[declared|settled|void], customer_id, label, assigned_items jsonb, settled_by, settled_at). `declared`=SAYILMAZ; `settled`=sayılır (kart callback VEYA garson nakit onayı). **`payment_share_tokens`** = `order_payment_tokens`'ın birebir aynası (service-role-only side table, realtime'da DEĞİL). `orders.payment_method` check += `'split'`. (2) **Atomik `finalize_split_if_covered(session_id)` RPC**: `Σ settled ≥ session total` olunca tüm non-cancelled order'ları paid+'split' damgalar; **20260707000000 P0 fix sonrası masayı KAPATMAZ**. `session-row FOR UPDATE` lock eşzamanlı finalize'ları serileştirir (son commit tüm settled toplamı görür → under-count yok), paid_at-null guard'ı double'ı engeller — close_session_if_fully_paid disiplini. Service-role-only. (3) **RLS gün-1**: payment_shares anon SELECT yalnız MÜŞTERİ-GÜVENLİ kolonlar (settled_by/settled_at/customer_id grant DIŞI — orders column-grant deseni); staff read policy (owner/member); TÜM yazmalar service-role server-action (customer asla settled'a çeviremez = **RLS-zorlamalı nakit yetkisi**). tokens = RLS-zero-policy service-role-only. (4) **Primitifler** `packages/db/src/split.ts`: createShareDB, settleShareDB (declared→settled + finalize, idempotent), voidShareDB, voidDeclaredSharesForSession. (5) **`confirmCashShare`** dashboard action (assertAccess 'tables', settled_by=staff). (6) **closeTableSession** anormal kapanışta declared payları VOID eder (settled dokunulmaz, silent-drop yok — mevcut close_reason yolu, paralel mekanizma yok). **Ciro:** 'split' = collected (isCollectedOrderRow zaten paid+non-comp'u dahil ediyor, DEĞİŞİKLİK GEREKMEDİ); comp ayrı.

**Verify (Test Cafe B gerçek-auth + gerçek anon client; throwaway session/order/share → temizlendi, 0 orphan, maf dokunulmadı):** typecheck 8/8, lint 0/0, db suite 85/85. **A (yarış):** 10× eşzamanlı card settle → 10/10 paid+split finalize, çift-sayım yok (collected=300 sabit); ilk P1 run'ında bu ayrıca masayı kapatıyordu, 20260707000000 ile düzeltilip masa-açık invariant'ına geri getirildi. **B (nakit yetkisi RLS):** anon `status=settled` UPDATE → 42501 reddedildi, pay declared kaldı. **C (eşik):** declared-only→finalize false/açık; kısmi ₺100<₺200→açık; ₺200≥₺200→tüm order paid+split, **masa açık**. **D (anormal):** declared VOID + settled dokunulmadı + order ödenmemiş kaldı. **E (ciro/comp):** split=collected, comp=hariç, cash=collected. **F (anon):** güvenli kolonlar okunur, settled_by 42501 gizli, token tablosu anon-okunmaz (order_payment_tokens ile birebir: RLS-zero → 0 satır, sızma yok). **G (idempotency):** re-settle → pay tek settled, paid timestamp değişmedi, hata yok. **Test tuzağı:** RLS-zero-policy anon'a HATA değil BOŞ döndürür (0 satır) — token güvenliği için "0 rows + sızma yok" assert et, "error !== null" değil.

**P2 (`feat/split-payment-p2`) — İyzico per-share + gerçek müşteri SplitBillModal (UI yok değil, gerçek):** (1) **`/api/split/create`** (customer-gated: slug↔restaurant anti-spoof + AÇIK session): item-split → sunucu tutarı sipariş kalemlerinden TÜRETİR (client tutarına güvenmez), free-split → tutar (session total'a cap'li). method iyzico|cash. (2) **`/api/split/pay`** (İyzico init): share'in tutarını DB'den okur ve **kalan uncovered'a CLAMP eder** (charge = min(share.amount, total−Σsettled)); kapalı hesap → 409. Yanıtta clamp'lenmiş `amount` döner. (3) **Callback share-branch**: `resolveCredentialsByShareToken` ile token önce `payment_share_tokens`'ta aranır → share ise `settleShareDB` (P1) → SHARE_PAYMENT_SUCCESS; değilse mevcut order-branch (DOKUNULMADI). (4) **`attachPaymentTokenToShare`** = attachPaymentTokenToOrder aynası. (5) **SplitBillModal yeniden yazıldı** (eski salt-hesap-makinesi → gerçek): session siparişlerini + share'leri anon çeker, item(checkbox)/free split, "Nakit ödeyeceğim" (declared) / "Kartla öde" (İyzico iframe), canlı realtime (payment_shares session-filtreli), kalan/ödenen/nakit-beyanı + over/under uyarısı. MenuPageClient tableSessionId ile bağlar.

**Verify P2 (Test Cafe B gerçek-auth + gerçek anon + gerçek İyzico sandbox init; throwaway → temiz, 0 orphan, maf dokunulmadı):** typecheck 8/8, lint 0/0, menu build ✓. Route matrix A–H 9/9: **A clamp** ₺120 pay isteği → gerçek sandbox token KALAN ₺50'ye clamp (overcharge yok) + kapalı→409; **B** share pay token `payment_share_tokens`'a yazıldı (order tablosuna DEĞİL) → callback share-branch'e gider; **C** item-split sunucu-türetilmiş ₺120 + free ₺50 + slug-spoof 400; **D** nakit beyan → declared/cash (paid değil); **H** tek-ödeyen `/api/payment` DEĞİŞMEDİ → order_payment_tokens; **F** anon güvenli kolonlar + settled_by 42501. Realtime E/F: **iki telefon (anon subscriber) da INSERT+UPDATE'i CANLI gördü**, realtime payload GÜVENLİ kolonlar (settled_by/settled_at YOK — column grant realtime'da da geçerli). **Kısmen otomatize edilmedi (dürüst not):** gerçek İyzico sandbox KART FORMUNU tarayıcıda doldurup callback→settle zincirini tek akışta sürmedim — parçaları kanıtlı (init gerçek token üretiyor, callback share-branch doğru yönlendiriyor, settle=P1-kanıtlı settleShareDB); elle sandbox-kart testi veya P3'te eklenebilir. **Test tuzağı:** realtime subscribe propagation ~2s sürebilir → 2 subscriber testinde INSERT'ten önce ≥2.5s warm-up bekle. **P3:** staff UI (SettlementSheet split durumu + nakit "Onayla" aksiyonu) + raporlama (Ödemeler 'split' bucket, abnormal split-remainder) + refund/cancel-of-covered blok. Per-share loyalty ERTELENDİ (double-earn önleme).

**P0 invariant fix (`20260707000000_split_payment_keep_table_open.sql`) — split payment masayı kapatmaz:** İlk split finalize RPC'si tam kapsamada `table_sessions.closed_at` yazdığı için 20260627'de kapattığımız "ödeme masayı boşaltır" coupling'i split ödeme için geri açıyordu. Yeni RPC aynı transaction/lock disipliniyle yalnız non-cancelled unpaid order'ları `paid_at + payment_method='split'` damgalar; `closed_at` yazmaz. Masa `paid/kapatılabilir` kalır, visit yalnız `closeTableSession` veya 180dk fully-paid idle sweep ile yazılır. P3 staff UI/reporting bu invariant üzerine kurulmalı.

**P3 (`feat/split-payment-p3`) — staff görünürlüğü + nakit onayı + raporlama/cancel guard ✅ (2026-07-07):** SettlementSheet artık `payment_shares` ledger'ını staff tarafında gösterir: ödenen pay, kart bekleyen pay, **nakit beyanı/onay bekleyen pay** ve kalan tutar ayrı satırlardır. Session split'e girdiyse per-order Nakit/POS/İkram seçicileri kapatılır (P1 kararı: session ya tek-ödeyen ya split, karışım yok); staff yalnız `confirmCashShare` ile fiziksel alınan nakit payı onaylar. Onay `assertAccess('tables')` + `settleShareDB` üzerinden gider, `settled_by` staff audit'i yazar, finalize yalnız order'ları `paid_at + split` damgalar ve masayı açık bırakır. Tables listesinde açık adisyon satırı `₺X nakit onayı` badge'i gösterir ve Kapat sheet'e götürür. `PaymentMethod` type + badge sistemi `split`'i tanır; Ödemeler raporu `Hesap bölüşme` bucket'ını collected base içinde ayrı gösterir, İkram yine tahsilat dışıdır. Split-paid order cancel'i hem dashboard action pre-read'de hem `cancelOrderDB` atomic WHERE guard'ında bloklandı; pay iadesi/covered-line adjustment ayrı future refund path olarak kaldı.

**P3 verify (Test Cafe B gerçek DEV data; throwaway → temiz, maf-lounge read-only):** typecheck **8/8**, lint **0/0**, DB unit **85/85**, dashboard production build ✓. Gerçek DB probe: declared cash share staff-visible → cash confirm primitive settled yaptı; `finalize_split_if_covered` true; order `paid_at != null + payment_method='split'`; session **closed_at null** kaldı; split-paid cancel guard 0 row etkiledi ve order cancelled olmadı; payment report için split bucket row'u gerçek order'da görüldü; maf-lounge fingerprint değişmedi; cleanup shares/orders/sessions/tables **0**. Not: browser üzerinden staff sheet click-flow görsel testi yapılmadı; server/action/DB invariantları ve dashboard build ile UI entegrasyonu doğrulandı.

### Sprint 23 — Settings stubs → real surfaces 🚧

**23b — Security section real (login/activity log + password change) ✅ (2026-06-22). Migration: `20260622000000_security_events.sql` (db push, `types:gen`, local/remote match through `20260622000000`).**

**Problem closed:** the Settings → Güvenlik section was a full stub — a fake "Authenticator · Aktif" 2FA card, non-functional session-timeout/IP-restriction/new-device checkboxes, and a hardcoded "Denetim günlüğü" with invented names/IPs (`Ayşe … 85.110.4.21`). Nothing was real.

**Source decision (option a):** an explicit `security_events` table we control, written on real events — portable, not dependent on Supabase's `auth.audit_log_entries` internals. Per-USER scope (`user_id` → `auth.users`, `restaurant_id` nullable for future team events), `event_type check ('login','password_change')`, `ip`, `user_agent`, `created_at`. **RLS:** `for select to authenticated using (user_id = auth.uid())` — each user reads ONLY their own; deliberately **NO anon policy and NO authenticated write policy** → all inserts go through the service role (a user can never forge/tamper with their own audit trail). `gen_random_uuid()`.

**Capture (best-effort, never blocks auth):** new `packages/db/src/security.ts` → `recordSecurityEvent(...)` (service-role insert, try/catch-swallow) + `getSecurityEvents`. `recordSecurityEvent('login')` fires in the `signIn` action (password login) AND the `/auth/callback` route (magic-link/OAuth) with IP/UA from request headers. New `apps/dashboard/lib/request-meta.ts` → pure `parseForwardedIp(x-forwarded-for, x-real-ip)` (first hop of the forwarded chain) + `readRequestMeta()`. Password change → new `changePassword` action: **re-authenticates with the current password** (Supabase `updateUser` doesn't require the old one), `updateUser({ password })`, then records a `password_change` event.

**UI (`AdvancedSections.tsx` `SecuritySection`, fully rewritten):** real **Şifre** form (current/new/confirm → `changePassword` → `router.refresh()` re-fetches the SSR log). Real **Hesap etkinliği** list from `security_events` — event label + relative time + `deviceSummary(ua)` (browser·OS) + IP, newest-first, empty state, **the signed-in user's own events only**. 2FA card kept but **clearly disabled with a "Yakında" tag** (no fake toggle); the unbacked session/IP/new-device stubs were deleted. **Read path is RLS-enforced:** `settings/page.tsx` selects `security_events` via the authenticated client (no manual `user_id` filter — RLS scopes it) and threads `securityEvents` + `userEmail` through `SettingsForm` → `SecuritySection`.

**23b verify:** typecheck **9/9**, lint **0/0**. Runtime gate on Test Cafe B (real owner login; throwaway 2nd user for isolation; password changed then restored; all B test rows + the throwaway user cleaned up; maf-lounge untouched) **18/18**: `recordSecurityEvent` persisted a login row with the parsed IP `203.0.113.7` (from a 3-hop `x-forwarded-for`) + exact UA; **RLS** — B (authed) sees only B's rows and not the 2nd user's, the 2nd user sees only its own, anon (no session) sees 0; real **password change** (reauth → updateUser) made the new password work + the old fail + wrote a `password_change` event, then the original password was restored.

**23a — Notifications section real (4 channel toggles) ✅ (2026-06-22). NO migration** — `settings.notifications` JSONB. Real toggles for the 4 implemented channels (new-order sound/desktop-push/in-app-toast + service-request alert), Zod-validated owner-gated `saveNotificationSettings`, gating wired into `useNotificationSW`/`OrderToast`/`RestaurantShell`. Email/SMS/quiet-hours stubs omitted (no backing channel). Verified typecheck 9/9, lint 0/0, Test Cafe B persist round-trip.

### Sprint 22 — Automated smoke gates 🚧

**22a — Playwright HTTP smoke + root check script ✅ (2026-06-21). NO migration.**

**Problem closed:** after lint/typecheck/build were clean, there was still no single command that proved the critical apps boot and the safest public/private routes respond. Runtime route regressions could slip through if TypeScript and production build passed.

**Tooling:** added `@playwright/test`, root `playwright.config.ts`, and `tests/smoke/routes.spec.ts`. The first smoke gate uses Playwright's API/request layer only — no browser binary or screenshot dependency yet. Web servers are managed by Playwright for dashboard (`3005`), menu (`3011`), kitchen (`3002`), and marketing (`3003`), with `SMOKE_*_URL` and `SMOKE_MENU_SLUG` overrides for local/CI environments. Default fixture slug is `maf-lounge`.

**Smoke coverage:** dashboard private `/dashboard` must 307 to `/auth/login`, dashboard `/auth/login` must render, marketing home must render, menu `/{slug}?preview=1` must render, and kitchen `/kitchen/{restaurantId}` without token must fail closed with the token-required page instead of crashing. This catches app boot, middleware/auth redirect, Supabase-backed public menu SSR, and kitchen fail-closed behavior.

**Scripts:** root `smoke` runs `playwright test`; root `test:db` runs the db unit suite through `@garsonless/db`; root `check` now chains `lint → typecheck → test:db → build → smoke`. `@garsonless/db` gained a local `test` script (`tsx --test src/*.test.ts`). During implementation, `pnpm install` was run after adding Playwright to repair pnpm's app symlink tree so Next dev/build resolved correctly.

**22a verify:** root `corepack pnpm check` passes end-to-end: `lint` **0/0**, `typecheck` **9/9**, db unit suite **56/56**, production `build` passes marketing/kitchen/menu/dashboard, and Playwright smoke passes **4/4**. In Codex's sandbox, DB tests need unsandboxed execution because `tsx` opens an IPC pipe, and smoke needs unsandboxed execution because Next dev servers bind local ports; normal local terminal usage does not need special handling. No DB migration/type regeneration needed.

**22b — browser visual smoke + responsive regression gate ✅ (2026-06-21). NO migration.**

**Problem closed:** route/API smoke proved apps booted, but it could not catch visual regressions like page-level horizontal overflow, blank screenshots, broken loading hierarchy, or mobile-only layout collapse. The first run caught two real issues: dashboard auth login still carried the 480px desktop visual panel on mobile, and marketing home kept the desktop nav/hero composition on an iPhone viewport.

**Visual tooling:** added `playwright.visual.config.ts` plus `tests/visual/*`. The visual suite runs Chromium desktop (`1440x950`) and iPhone 15 mobile viewports against dashboard (`3005`), menu (`3011`), kitchen (`3002`), and marketing (`3003`). Public coverage verifies dashboard login, marketing home, menu `maf-lounge?preview=1`, and kitchen token-required fail-closed. Authenticated dashboard visual smoke exists for menu manager, customers, loyalty settings, and theme editor, but is opt-in via `DASHBOARD_VISUAL_RESTAURANT_ID` + `DASHBOARD_VISUAL_STORAGE_STATE` so CI/local runs do not need a real owner session.

**Health assertions:** `assertVisualHealth` checks visible text, visible element count, page-level horizontal overflow, and nonblank screenshots; failures include the first overflowing DOM offenders. Screenshots attach to Playwright output for review. The kitchen fail-closed page uses a lower `minVisibleCount` because it is intentionally sparse. Visual smoke defaults now use `localhost` URLs instead of `127.0.0.1`, avoiding Next dev cross-origin warnings for `_next/*` assets.

**Responsive fixes found by the gate:** `VisualPanel` is hidden under `900px` and auth main/top-link spacing is mobile-safe. Marketing nav now collapses links/actions into a compact CTA on mobile, and the hero switches from the desktop two-column composition to a bounded stacked visual using explicit mobile classes for the dashboard mock, phone mock, and QR badge. `html/body` now clip horizontal overflow in the marketing app, while the visual test still asserts `documentElement.scrollWidth` stays within the viewport budget.

**Scripts:** root `visual:smoke` runs `playwright test --config=playwright.visual.config.ts`; root `check:visual` chains the full `check` gate and then `visual:smoke`. `.gitignore` now excludes Playwright `test-results` and `playwright-report` artifacts.

**22b verify:** `corepack pnpm lint` passes **0/0**; `corepack pnpm typecheck` passes **9/9**; standalone `corepack pnpm visual:smoke` passes **8 public tests**, with **8 authenticated dashboard tests skipped** by missing opt-in env. Full `corepack pnpm check:visual` passes end-to-end: lint **0/0**, typecheck **9/9**, db unit suite **56/56**, production build for marketing/kitchen/menu/dashboard, API smoke **4/4**, and visual smoke **8 passed / 8 skipped**. Browser install required `corepack pnpm exec playwright install chromium` once on this machine.

**22c — authenticated dashboard visual gate ✅ (2026-06-21). NO migration.**

**Problem closed:** 22b had authenticated dashboard screenshot specs, but they required a manually prepared `DASHBOARD_VISUAL_STORAGE_STATE` + `DASHBOARD_VISUAL_RESTAURANT_ID`. That made the most important admin screens easy to skip forever. The suite now has an automatic login/setup path.

**Setup flow:** added `tests/visual/dashboard-auth.setup.ts`. When `DASHBOARD_VISUAL_EMAIL` + `DASHBOARD_VISUAL_PASSWORD` are set, Playwright logs into `/auth/login`, follows `/dashboard` to the owner’s first restaurant dashboard, writes `test-results/visual-auth/dashboard-storage-state.json`, and writes `test-results/visual-auth/dashboard-metadata.json` containing the resolved `restaurantId`. `dashboard-authenticated.spec.ts` reads that metadata at runtime, so setup-created state works in the same Playwright run. Explicit manual mode still works with `DASHBOARD_VISUAL_STORAGE_STATE` + `DASHBOARD_VISUAL_RESTAURANT_ID`.

**Project split:** `playwright.visual.config.ts` now separates `dashboard-auth-setup`, `public-desktop`, `public-mobile`, `dashboard-desktop`, and `dashboard-mobile`. Public tests always run. Authenticated dashboard tests skip unless credentials or explicit storage env are provided. When credentials are provided, dashboard desktop/mobile projects depend on the setup project. Root scripts added: `visual:auth:setup` and `visual:auth`.

**22c runtime verify:** default `corepack pnpm visual:smoke` (no auth env) passes **8 public tests** and skips **9** expected auth/setup tests. Test Cafe B authenticated run using the seeded test owner passes **9/9**: setup login/storage-state generation plus menu manager, customers, loyalty settings, and theme editor on both desktop and iPhone 15 mobile. `corepack pnpm lint` passes **0/0** and `corepack pnpm typecheck` passes **9/9** after the change.

**22d — operational dashboard visual coverage ✅ (2026-06-21). NO migration.**

**Coverage expanded:** authenticated visual smoke now includes the three remaining core operational dashboard surfaces: **Pano** (`/dashboard/{restaurantId}`), **Orders** (`/orders`), and **Tables/QR builder** (`/tables`). The authenticated set now covers Pano, Menu Manager, Orders Board, Customers, Tables Builder, Loyalty Settings, and Theme Editor on both desktop and iPhone 15 mobile.

**Regressions caught/fixed by the gate:** Pano emitted a React console error from `PeakHours` because the `days.map()` fragment had no key and reused hour keys across rows; fixed with keyed `Fragment` + day-scoped hour keys. Tables/QR builder created **880px** page-level horizontal overflow on iPhone 15 because its standalone desktop shell (topbar presets, rail, table nav, QR canvas, properties panel, status bar) tried to render as one horizontal workspace. Fixed with responsive `tb-tables__*` classes: mobile hides the duplicate rail/status/preset topbar, stacks nav/canvas/properties vertically, wraps the canvas toolbar, and bounds QR frames to the viewport.

**22d runtime verify:** Test Cafe B authenticated visual run now passes **15/15**: setup login plus seven dashboard surfaces on desktop and mobile. `corepack pnpm lint` passes **0/0** and `corepack pnpm typecheck` passes **9/9** after the fixes. Full default `corepack pnpm check:visual` also passes: lint/typecheck/db unit **56/56**, production build for marketing/kitchen/menu/dashboard, API smoke **4/4**, visual smoke **8 passed / 15 expected skipped** without auth env.

### Sprint 21 — Quality gates + lint debt visibility 🚧

**21a — real ESLint quality gate ✅ (2026-06-20). NO migration.**

**Problem closed:** repo-level `lint` was only a deterministic type gate after 20d, while Next's old `next lint` path could still fall into interactive setup prompts. The project now has a real non-interactive ESLint gate that covers the monorepo without reintroducing Turbo's local package-manager binary issue.

**Config + scripts:** added root flat config `eslint.config.mjs` with ESLint JS recommended, `typescript-eslint` recommended, Next core-web-vitals rules, React Hooks rules, browser/node/service-worker globals, generated output ignores, and a narrow Lucide deep-import triple-slash exception. Root/app/package `lint` scripts now run `eslint .`; package-level lint is available for `ui`, `db`, `design-engine`, `ai`, and `qr`.

**Code fixes:** fixed the real lint errors exposed by the new gate: expression-only ternary in `ModifierGroupBuilder`, iframe self-assignment in `ThemeEditorClient`, stale Netgsm `eslint-disable`, and unnecessary initialized assignment in SMS parsing. The Lucide ambient module reference was intentionally kept because downstream `@garsonless/ui` typecheck requires it for deep icon imports.

**21a verify:** root `corepack pnpm lint` passes with **0 errors / 39 warnings**. Root `corepack pnpm typecheck` passes across **9/9** workspace packages. Root `corepack pnpm build` passes across marketing, kitchen, menu, and dashboard; the earlier Next "plugin not detected" build warning was removed by globally registering the Next plugin in the flat config. Remaining warnings became explicit Sprint 21b backlog: unused vars, selected `<img>` → `next/image`, custom font placement, and React Hook dependency review. No DB migration/type regeneration needed.

**21b — lint warning burn-down + clean build output ✅ (2026-06-20). NO migration.**

**Problem closed:** the new ESLint gate was real but still noisy: **39 warnings** meant CI/dev output could hide the next real regression. Build output also had a Next workspace-root warning from `apps/marketing/package-lock.json`.

**Warning cleanup:** removed unused imports/constants/legacy helpers across dashboard, menu, marketing, and db surfaces; deleted the unused legacy `FieldEditor` path in the theme editor; removed stale marketing constants; and kept the public DB helper re-exports while trimming unused local imports. Hook warnings were fixed by stabilizing theme-preview messaging with `useCallback`, memoizing derived `previewTheme/pageBlocks/activeSections`, scoping menu table-bill realtime to `tableSessionId`, and adding the QR ref dependency where the QR preview effect writes through it.

**Rule decisions:** dashboard `<img>` usage is intentionally allowed in ESLint because these are admin-only upload/preview/QR artifacts where `next/image` can change fixed geometry or reject blob/data-style sources. Custom Google font link warnings are also disabled intentionally for now; moving to `next/font` is a design/perf migration, not a lint cleanup. Marketing's workspace-root build warning was fixed without deleting files by setting `outputFileTracingRoot` in `apps/marketing/next.config.ts`.

**21b verify:** root `corepack pnpm lint` now passes with **0 errors / 0 warnings**. Root `corepack pnpm typecheck` passes across **9/9** workspace packages. Root `corepack pnpm build` passes across marketing, kitchen, menu, and dashboard with clean lint/build-warning output. No DB migration/type regeneration needed.

### Sprint 20 — UI polish + design system consistency 🚧

**20a — dashboard skeleton hierarchy + shared Lucide icon foundation ✅ (2026-06-20). NO migration.**

**Problem closed:** dashboard route loading states used the same centered `HeroSpinner`, so page geometry collapsed during navigation and broke visual hierarchy. Several dashboard surfaces also carried separate inline SVG icon dictionaries, causing uneven stroke/shape quality.

**Skeleton/loading behavior:** added `DashboardRouteSkeleton` with page-shaped placeholders for pano, analytics, orders, menu, theme, tables, and settings. All dashboard `loading.tsx` route fallbacks now render the matching skeleton instead of the default spinner. Inline spinners remain for button/action pending states where a small spinner is the correct affordance.

**Icon system:** added `lucide-react` to `@garsonless/ui` and exported `AppIcons`, `AppIconNodes`, and `appIconNode`. Dashboard `lib/ui.tsx` now re-exports the shared Lucide-backed `I` map while preserving the existing `<I.search />` / `I.home` API. Settings sidebar, LoyaltySection, Tables/QR builder, and landing-page generic icon dictionaries now derive from the shared icon set; social brand marks + the filled testimonial star remain custom. Lucide was selected over Tabler for this phase because it matches the current stroke-icon API and keeps tree-shakable React components.

**20a verify:** `@garsonless/ui`, `@garsonless/dashboard`, `@garsonless/menu`, and `@garsonless/kitchen` typechecks clean. Dashboard smoke `GET /dashboard` on local port **3004** returned expected auth redirect **307 → /auth/login**.

**20b — menu skeleton parity + AI photo/OCR removal ✅ (2026-06-20). NO migration.**

**Problem closed:** the menu loading state still looked like a generic card grid rather than the real menu manager geometry, and the menu page still exposed AI photo/OCR affordances that are being removed from the product surface.

**Menu loading hierarchy:** route-level `DashboardRouteSkeleton(kind="menu")` now mirrors the actual menu workspace: icon rail + top bar search/actions + category rail + product canvas toolbar/card grid + right editor empty panel. `MenuManager`'s client-only `SkeletonGrid` was also rebuilt to match the real left category list, grid/list controls, product cards, add-card slot, and right detail pane. The old `SkeletonCard` usage is gone.

**AI photo/OCR removal:** removed the menu import/enhance UI from `MenuManager` and deleted the unused `MenuOCRModal`, `EnhancePhotoModal`, `/api/enhance-photo`, and `/api/generate-from-menu-photo` surfaces. The `@fal-ai/client` dependency and lockfile entries were removed from `@garsonless/dashboard`. Menu topbar now keeps only CSV import, preview, and new-product actions. Product/category placeholders use the shared `AppIcons.cutlery` icon instead of emoji.

**20b verify:** `@garsonless/dashboard typecheck` and `@garsonless/dashboard build` pass. Dashboard search shows no remaining `@fal-ai/client`, `EnhancePhoto`, `MenuOCR`, `enhance-photo`, `generate-from-menu-photo`, `SkeletonCard`, or menu AI/OCR references. Menu route bundle remains healthy (`/dashboard/[restaurantId]/menu`, production build).

**20c — dashboard operational icon sweep ✅ (2026-06-20). NO migration.**

**Problem closed:** several high-traffic dashboard surfaces still used emoji or local inline SVGs for operational icons, causing inconsistent weight, alignment, and visual hierarchy despite the new Lucide foundation.

**Dashboard surfaces standardized:** analytics report nav/saved reports, customers list stats, customer detail timeline/stat cards, loyalty summary chips/stamp preview, pano live feed/quick actions, payment methods, notification settings, service-request/order toasts, order card/timeline status markers, notifications empty state, profile logout, onboarding logo placeholder, QR stand request page, tables pending-request chips, and settings logo placeholder now use the shared `I`/`AppIcons` system. Chart SVGs, QR/design previews, and Google/Apple brand marks intentionally remain custom because they are data/brand renderings, not generic UI icons.

**Auth + theme editor sweep:** login/signup form icons now use `AppIcons` (`mail`, `lock`, `eye/eyeOff`, `user`, `store`, `shield`, `clock`, etc.); the auth visual panel testimonial stars and floating menu chips use shared icons. Theme library and theme editor section library/sidebar/toolbar icon helpers now use `AppIcons`; menu-link `↗` and tag placeholders were converted to icon components. `@garsonless/ui/icons` gained the missing shared icons: `mail`, `lock`, `logout`, `megaphone`, `eyeOff`, and `tag`.

**20c verify:** `@garsonless/ui typecheck`, `@garsonless/dashboard typecheck`, and `@garsonless/dashboard build` pass. Dev server restarted on **http://localhost:3005** after build. Remaining emoji references are intentional content controls in the theme editor's food/icon picker or public marketing/demo content; remaining SVGs are charts, QR/preview drawings, or brand marks.

**20d — root tooling + kitchen client bundle hardening ✅ (2026-06-20). NO migration.**

**Problem closed:** root `corepack pnpm typecheck` still failed through Turbo with `Unable to find package manager binary: cannot find binary path` because this machine exposes pnpm through Corepack, not as a bare `pnpm` binary in PATH. Root build then exposed a real kitchen bundle issue: `KitchenBoard`/`KitchenCard` imported runtime helpers through the main `@garsonless/db` barrel, which pulled server-only `loyalty.ts` (`node:crypto`) into the client bundle. Root lint also reached the old `next lint` app scripts, which fell into an interactive ESLint setup prompt because the repo has no ESLint config/deps yet.

**Root scripts:** root `build`, `dev`, `lint`, and `typecheck` now orchestrate workspace scripts via `corepack pnpm -r` instead of Turbo. This keeps the package-level gates but removes the broken package-manager-binary lookup from the root workflow. App `lint` scripts temporarily used `tsc --noEmit` as the deterministic gate in 20d; real ESLint was added in Sprint 21a.

**Kitchen bundle:** client components now import priority/tier snapshot helpers from the browser-safe `@garsonless/db/order-client` subpath and keep `Tables`/`OrderStatus` as type-only imports. Service-role DB exports remain on server-only kitchen page/action/query paths.

**20d verify:** initial root `corepack pnpm typecheck` reproduced the Turbo error; after the script change, root `corepack pnpm typecheck` passes across **9/9** workspace packages. `@garsonless/kitchen typecheck` and `@garsonless/kitchen build` pass after the import split. Root `corepack pnpm build` passes across marketing, kitchen, menu, and dashboard. Root `corepack pnpm lint` passes via the current `tsc --noEmit` app lint gates. No DB migration/type regeneration needed.

### Sprint 19 — Stability + Revenue Semantics 🚧

**19a — loyalty refund on cancellation ✅ (2026-06-19). Migration: `20260619030000_loyalty_cancel_refund.sql` (db push, `types:gen`, local/remote status match).**

**Problem closed:** cancelling an order that had used points/stamps previously left the negative redeem rows in place, so the customer permanently lost spendable balance. The old `warnIfCancellingRedeemedOrder` warning-only guard is superseded.

**DB + ledger model:** `loyalty_transactions.direction` now allows `refund` in addition to `earn|redeem`. Cancel reversal rows are positive deltas with `direction='refund'` and `reason='refund_cancel'`. This restores spendable points/stamps because balances sum `delta`, but **does not inflate lifetime points** because lifetime still only sums `direction='earn'`. Existing `(order_id,type,direction)` uniqueness gives exactly one refund row per order/type.

**RPC + app wiring:** new service-role-only `refund_cancelled_loyalty(p_order)` reads redeem rows, transaction-locks each `(customer,scope_key)`, inserts refund rows with `on conflict ... do nothing`, and returns inserted amounts. `refundCancelledLoyaltyOrder(orderId)` wraps it in `packages/db`; `updateOrderStatusDB(...,'cancelled')` now calls it, so dashboard and kitchen cancel paths share the same refund behavior. Old `warnIfCancellingRedeemedOrder` remains as a back-compat export but delegates to refund.

**UI/data visibility:** `LoyaltyActivity` and CRM `CustomerTimelineEvent` accept `direction='refund'`; MemberHome and customer detail label them as **Puan iadesi / Damga iadesi**.

**19a runtime gate (isolated throwaway restaurant/customer/order; cleanup):** before cancel balance = **60 points / 0 stamps / lifetime 100** after simulated redeem rows; cancel via `updateOrderStatusDB` → **100 points / 3 stamps / lifetime still 100**; direct repeat refund inserted **0**; second cancel inserted **0**; exactly two refund rows remained: **+40 points**, **+3 stamps**. Typecheck **9/9**, db unit suite **56/56**, migration status local/remote match through `20260619030000`.

**19b — analytics/revenue semantics ✅ (2026-06-19). NO migration.**

**Metric contract locked:** dashboard `DashboardKPIs.revenue` now means **Tahsil edilen ciro** = `paid_at is not null AND status <> 'cancelled'`. `DashboardKPIs.orders` now means **Sipariş hacmi** = all non-cancelled orders. `avgBasket` is computed as collected revenue / paid order count (new `paidOrders/paidOrdersYesterday` fields are exposed for UI/future use). Sessions are counted only from non-cancelled rows, avoiding cancelled/noise sessions in daily KPIs.

**Query semantics:** `getHourlySales` and `getSalesOverTime` are paid-only and cancelled-excluding, so pano/analytics charts are tahsilat charts. `getHeatmapData` is non-cancelled order volume, not revenue. `getTopItems` and `getTablesReportData` are paid-only; top item `revenue` remains gross line total (`price*qty`) from paid orders rather than discount-allocated net, so UI labels use **Tutar** instead of ciro. Orders board KPI now sums `paid_at` rows only; floor-plan footer was relabeled from active ciro to **açık adisyon** because it is not collected money.

**UI language:** Pano labels now say **Tahsil edilen ciro**, **Sipariş hacmi**, **Ort. tahsilat**, and **Tahsilat akışı**. Analytics labels use **Tahsilat trendi**, paid-at based subtitles, **Ödemeli sipariş** on table reports, and ciro wording was removed from real report widgets (landing/marketing copy untouched).

**19b verify:** typecheck clean for all 9 packages (`db`, `menu`, `dashboard`, `kitchen`, `ui`, `design-engine`, `ai`, `qr`, `marketing`). DB unit suite via Node test runner: **56/56**. Dashboard smoke `GET /dashboard` on local dev server returned expected auth redirect **307 → /auth/login**. No DB migration/type regeneration needed.

**19c — real payment + product analytics ✅ (2026-06-20). NO migration.**

**Payment report:** removed the placeholder donut. New `PaymentBreakdown` query reads paid, non-cancelled orders for the selected range. Because `orders` currently has no payment-method/provider column, the report uses the existing secure signal: orders with a service-role-only `order_payment_tokens` row are classified as **İyzico online**, paid orders without a token as **Manuel tahsilat**. The token table remains service-role-only; dashboard query first owner-gates `(restaurant_id, owner_id)` with the auth client, then service-role reads only aggregate order ids/totals and returns no token/secret values. Sales report mini donut and the Payments tab now share this real breakdown.

**Product analytics:** removed the mock ABC/matrix/risers/fallers. New `ProductReportItem` is computed from paid, non-cancelled `orders.items` for the selected range and previous equivalent range. It supports both menu orders (`quantity`, modifier deltas) and dashboard manual orders (`qty`). ABC class is revenue-share/cumulative-share based (`A` until cumulative-before-item reaches 80%, `B` until 95%, then `C`; a single dominant first item still lands in A). Product matrix is now correctly labeled **Tahsilat payı × hacim** (no margin data exists yet), and rising/falling lists compare against the previous period.

**Range behavior:** analytics server action now refreshes `topItems`, `paymentBreakdown`, and `productReport` with the selected range; initial SSR uses `week`, pano `getTopItems()` keeps its default `day` behavior.

**19c verify:** typecheck clean for all 9 packages (`db`, `menu`, `dashboard`, `kitchen`, `ui`, `design-engine`, `ai`, `qr`, `marketing`). DB unit suite via Node test runner: **56/56**. Dashboard smoke `GET /dashboard` on local dev server returned expected auth redirect **307 → /auth/login**. No DB migration/type regeneration needed.

**19d — table status ↔ open adisyon alignment ✅ (2026-06-20). NO migration.**

**Problem closed:** Pano/FloorPlan/NewOrderModal table status used to derive from today's latest order per table, which could disagree with the real table-session/adisyon model. A table with an older open adisyon, a fully paid-but-not-closed session, cancelled-only orders, or multiple orders in one session could render misleadingly.

**Data contract:** `getTableStatuses` now reads open `table_sessions` first, then folds orders by `table_session_id`. `TableStatusData` now carries `sessionId`, `openedAt`, `unpaidTotal`, `orderCount`, and `hasUnfinished` in addition to the existing `status/time/total`. Status rules are session-scoped: no open session or no non-cancelled orders → `empty`; any unfinished order older than 20m → `late`; unfinished with fresh activity under 5m → `new`; all non-cancelled orders served and paid → `paid`; otherwise `active`. `total` is the unpaid adisyon when present, otherwise session total.

**UI alignment:** Pano table widget now says **Açık adisyonlar** and shows active/paid/empty counts from session state. FloorPlan footer sums open unpaid adisyon totals and labels paid sessions as **ödendi · kapatılabilir**. NewOrderModal table picker now explains that empty tables open a new adisyon and active tables append to the existing one. `getOpenTableSessions` now counts only non-cancelled orders, matching the Pano status fold.

**19d verify:** typecheck clean for all 9 packages (`db`, `menu`, `dashboard`, `kitchen`, `ui`, `design-engine`, `ai`, `qr`, `marketing`). DB unit suite via Node test runner: **56/56**. Dashboard smoke `GET /dashboard` returned expected auth redirect **307 → /auth/login**. No DB migration/type regeneration needed.

### Sprint 18 — Table/session tenant hardening + direct anon insert closure ✅

**18a — table/session cross-tenant hardening ✅ (2026-06-18). 18b — direct anon orders insert closure ✅ (2026-06-18). Migrations: `20260618020000_table_scoping_hardening.sql` + `20260618030000_close_orders_anon_insert.sql` (db push, types regenerated).**

**Problem closed:** `tableId` was not consistently scoped to `restaurant_id` across menu table SSR, order placement, waiter/service requests, table-session opening, and dashboard manual order paths. A tampered body like **restaurant A + table B** could previously mix table/session/order/request state. Separately, legacy `anyone_create_order with check(true)` still allowed direct PostgREST anon order inserts, bypassing `/api/orders` server-authoritative money and slug checks.

**DB hardening:** added `tables(restaurant_id,id)` unique index and NOT VALID composite FKs for new writes: `orders(restaurant_id,table_id)`, `table_sessions(restaurant_id,table_id)`, `service_requests(restaurant_id,table_id)` → `tables(restaurant_id,id)`. Existing historical data is not validated yet, but all new mismatched writes are blocked. `open_or_get_table_session(p_restaurant_id,p_table_id)` now verifies the table belongs to that restaurant and is not soft-deleted before opening/reusing a session; stale-session close/reuse queries are also restaurant-scoped. RPC remains service-role only (execute revoked from public/anon/authenticated).

**App/data layer:** `createOrder` validates table ownership before RPC/discount/order insert and returns typed `Table not found for this restaurant`; `/api/orders` maps that to 400. `createServiceRequest` validates table ownership and scopes throttle + open-session lookup by both `restaurant_id` and `table_id`; `/api/service-request` maps mismatch to 400. Menu table SSR (`/[slug]/table/[tableId]`) now queries `getTableLabel/getOpenTableSession(restaurantId, tableId)` and calls `notFound()` on mismatch. `MenuPageClient` uses `effectiveTableId` (route table wins, otherwise verified stored table), scopes bill refresh by restaurant, clears stale stored table IDs from other restaurants, and sends `effectiveTableId` in order bodies. Dashboard manual order creation validates table ownership; table dashboard close/delete/QR paths were tightened so service-role visit credit only runs after restaurant-scoped session validation.

**Direct anon insert closure:** dropped policy `anyone_create_order` and revoked `insert` on `orders` from `anon`. Customer order creation continues through `/api/orders` → service-role `createOrder`, where DB prices, loyalty, table ownership, and session opening are server-authoritative. Safe anon order SELECT for menu status tracking remains intact via the existing column grant + recent-orders policy.

**18 runtime gate (isolated throwaway restaurants/tables/items; cleanup; maf-lounge read-only):** cross-tenant order A+tableB → error `Table not found for this restaurant`, **orders rows=0**, **table_sessions rows=0**. Cross-tenant service request A+tableB → same error, **service_requests rows=0**. Scoped table lookup A+tableB → `null` (SSR path therefore 404). Valid A table order still works: subtotal/total **100** from DB price despite client line price **9999**, and attaches a real `table_session_id`; valid service request rows=**1**. Direct service-role mismatched inserts hit composite FK `23503` for both orders and service_requests. Direct anon `orders.insert` now fails `42501`; anon safe order select still **ok**. `maf-lounge` settings JSON byte-identical before/after.

**18 verify:** migration push complete; `db:status` local/remote match through `20260618030000`; `types:gen` regenerated. Typecheck clean for all 9 packages (`db`, `menu`, `dashboard`, `kitchen`, `ui`, `design-engine`, `ai`, `qr`, `marketing`). DB unit suite via Node test runner: **56/56**.

### Sprint 17 — Tier perks + flexible tier count ✅

**17a — flexible model + dynamic editor ✅ (2026-06-17). 17b — perk application (discount/multiplier/bonus stamps) ✅ (2026-06-18). 17c — priority service (order tier snapshot + kitchen/Kanban badge+sort) ✅ (2026-06-18). JSONB config → NO migration for 17a/17b; 17c migration `20260618010000_order_customer_tier_snapshot.sql` adds `orders.customer_tier jsonb` (db push).**

**Phase 17c — priority service: order tier snapshot + kitchen/Kanban badge+sort (logged 2026-06-18):**

**Order-time snapshot, not live lookup.** `computeOrderDiscount` now carries placement-internal `customerTierSnapshot` built server-side from `getMemberBalances` (`tier`, `tierIndex`, `lifetimePoints`, all four perks, `priorityService`, color/name/min). `createOrder` writes it to `orders.customer_tier` on insert. Guests and legacy orders store/read `null` and behave non-priority. This deliberately snapshots the tier at order placement — later tier/config edits do not rewrite old kitchen priority.

**Priority UI + sorting:** new pure helpers in `packages/db/src/loyalty.ts`: `readOrderCustomerTierSnapshot`, `orderHasPriorityService`, `sortOrdersByPriorityThenCreatedAt` (priority first, then older first). Kitchen initial query and realtime state use the helper; dashboard Kanban columns sort with the same helper. `KitchenCard`, dashboard `OrderCard`, and the order detail panel show an **Öncelikli · {tier.name}** badge only when `priorityService=true` in the snapshot.

**Security decision:** `customer_tier` is **NOT** added to the anon `orders` column grant from `20260617000000_security_isolation_fixes.sql`; public menu REST/realtime stays free of customer classification. Kitchen realtime still uses anon only as a change signal, then calls token-validated `getKitchenOrderAction(orderId, restaurantId, kitchenToken)` to fetch the full service-role order including `customer_tier`. Dashboard owner realtime reads it through the authenticated owner/RLS path.

**17c verify:** migration pushed; `types:gen` regenerated. Typecheck clean for db/menu/dashboard/kitchen during implementation; unit `loyalty.test.ts` now **10** (adds legacy-null snapshot, priority flag parsing, priority-first/oldest-first sort) + stack 14/tier 15/redeem 6/stampearn 6. No money/economic behavior changed in 17c; `orders.total`, İyzico amount, points/stamps logic remain 17b paths.

**Phase 17b — perk application: discount % / points × / bonus stamps (logged 2026-06-18):**

**Server-authoritative throughout — tier resolved from DB lifetime points, never client.** (1) **Discount %:** new pure `effectivePct(tier.discountPct, cfg.member_discount_pct) = tier.discountPct>0 ? tier.discountPct : member_discount_pct` — `computeOrderDiscount` passes it as `memberPct` (order of ops UNCHANGED: stamp-free → catalog-free → tier-% → points) and sets `DiscountResult.memberTierName` (cart line "Üye indirimi (Altın %10)", threaded preview→MenuPageClient→CartDrawer). `createOrder` re-stack already uses `discount.memberDiscountPct` (= effective) → placement + İyzico amount + table-bill (orders.total) all reflect it automatically. (2) **Points ×:** `computePointsDelta(total, ppl, multiplier)` gained a multiplier arg; `earnForOrder` resolves the customer's tier from **PRE-this-order lifetime** (sum earn-points EXCLUDING this order's own row → stable across paid→served retries) → `points = floor(total·ppl·tier.pointsMultiplier)`. (3) **Bonus stamps:** pure `applyBonusStamps(stampDelta, bonus) = stampDelta>=1 ? +bonus : unchanged` (never mints from nothing) in `earnForOrder`. All idempotent via the existing `(order_id,type,direction)` key. **Legacy configs (all-zero perks + member_discount_pct=N) behave byte-identical via the fallback.** **Save-time fold** (`saveLoyaltyConfig`): when ANY tier has `discountPct>0` → set `member_discount_pct=0` (fallback inert; no double-apply). Multiplier 1× / bonus 0 / discountPct 0 → identical to pre-17b.

**17b verify:** typecheck 9/9; unit `stack.test.ts` **14** (effectivePct override/fallback/none + tier-% stacking) + `loyalty.test.ts` **7** (multiplier 1.5×/2× floor, bonus-only-when-≥1) + tier 15/redeem 6/stampearn 6. **Runtime gate (Test Cafe B, REAL `createOrder`→`markOrderPaidDB`; snapshot→restore; 13/13):** VIP(min300, 15%/2×/+1) member lifetime 500, order subtotal 90 → **tier discount 13 (15%, NOT member's 10%)**, `orders.total=77` server-authoritative, **points=floor(77·1·2)=154**, **stamp delta=1+1=2**; TAMPER inflated client prices → ignored (DB subtotal); **paid-retry + served → exactly 1 points + 1 stamp earn row, still 154 (not doubled)**; LEGACY all-zero perks → discount 10% (fallback); fold rule (discountPct>0→member_pct 0). Found Test Cafe B holding a **user-built 6-tier perk ladder** (manual 17a editor test) — preserved byte-identical by the gate (guardrail A); maf-lounge untouched.

**Phase 17a — flexible tiers + perks (config + display only, NO economic change) (logged 2026-06-17):**

**`LoyaltyTier` gained 4 perks** (`discountPct`, `pointsMultiplier`, `bonusStamps`, `priorityService`) — flat, not nested. Kept field name **`min`** (not renamed to `minLifetimePoints`) to avoid a JSONB data-migration. **`readTiers` → exported pure `sanitizeTiers(arr)`** (reused by read AND the dashboard save): N≤**`MAX_TIERS`=6**, sort by `min`, `tiers[0].min=0`, **fill concrete perk defaults** (so `MemberBalances.tier` always carries all four), clamp (`discountPct 0–100`, `pointsMultiplier 0.1–10` fractional, `bonusStamps 0–20`), **unique non-empty names** (fallback `Seviye {i+1}` — fixes the old `DEFAULT_TIERS[i]` name-collision for N>4). `computeTier`/`getMemberBalances` already N-driven — now return the perk-filled tier.

**ECONOMICS UNCHANGED in 17a:** `computeOrderDiscount` still passes `cfg.member_discount_pct` (NOT `tier.discountPct`); `earnForOrder` untouched. Perks are config+display only until 17b. **member_discount_pct decision:** the engine will switch to `tier.discountPct > 0 ? tier.discountPct : member_discount_pct` in 17b; the key stays in config as the read-time legacy fallback. The standalone "Üye indirimi %" field is **removed from the dashboard UI** (folded into the base tier's discountPct), but its value persists + still drives the discount in 17a.

**Dashboard `LoyaltySection` — dynamic tier editor** (replaces the 4 locked rows): add/remove tier rows (2–6, base tier min locked 0 + un-removable), each with color picker / name / min / 4 perk fields (discount %, puan × step 0.5, bonus damga, öncelikli servis toggle). **Guardrail B — client-side ladder validation:** ascending `min` + unique non-empty names enforced inline (red row + message), **Save disabled when the ladder is invalid**. `saveLoyaltyConfig` (restaurant.ts) runs the SAME `sanitizeTiers` server-side (defense in depth).

**MemberSheet:** tier card shows a **non-default perks chip row** (`%X indirim · Y× puan · +Z damga · öncelikli servis`) from `balances.tier`.

**17a verify:** typecheck 9/9; unit `tier.test.ts` **15** (2/4/6-tier ranking, perk resolution+clamps, N>4 name fallback, sort/dedupe) + stack 10/redeem 6/stampearn 6/loyalty 5/phone 5. **Runtime gate (Test Cafe B, snapshot→restore loyalty config; maf-lounge read-only; member created+destroyed; 13/13):** N=2 ladder lifetime 500 → VIP+perks resolved, **`computeOrderDiscount` memberDiscountPct=10 (member_discount_pct), NOT VIP's 15 → economics unchanged**, lifetime 100 → Standart(0), B config byte-restored. (Guardrail A: snapshot→restore around any tier-mutating test.)

### Sprint 16 — Müşteriler (Customers CRM) 🚧

**16a — core CRM ✅ (2026-06-17). 16b — saved/custom segments ✅ (2026-06-19). 16c — campaign SMS + marketing consent ✅ (2026-06-19). Migrations: `20260618000000_customers_crm.sql`, `20260619000000_customer_segments.sql`, `20260619010000_campaign_sms_marketing.sql`, `20260619020000_marketing_integrations.sql` (db push). PII + money → ALL reads are owner-validated service-role actions hard-filtered by restaurant_id; `customers`/`customer_consents`/campaign recipient/event/config surfaces stay service-role-only where PII/credentials exist. A+B isolation proof 21/21; 16b segment isolation proof passed; 16c marketing-consent runtime gate passed.**

**Phase 16c — campaign SMS + marketing consent (logged 2026-06-19):**

**DB:** new `campaigns` (owner-managed), `campaign_recipients` (service-role-only PII phone snapshots), `message_events` (service-role-only provider/audit events), and `marketing_integrations` (service-role-only provider/İYS config/credentials reserve). `campaigns` stores segment kind + definition snapshot + sent/failed/skipped counters; recipients are only inserted for eligible marketing-consent customers. `db push`, `types:gen`, and `db:status` are complete through `20260619020000`.

**Consent + member UI:** `recordConsent/getConsentStatus` now accept `contact_data | marketing`. Join flow has a required contact/data consent plus a separate optional campaign SMS consent; `verify-otp` records both independently. MemberHome shows separate toggles; `/api/loyalty/consent` updates the requested consent type. **Compliance rule locked:** contact_data consent is NOT marketing consent.

**Provider/data/actions/UI:** `sms.ts` provider interface now sends arbitrary SMS messages; mock remains default/test, with Netgsm/Twilio fetch providers selected by `SMS_PROVIDER`. `campaigns.ts` resolves audiences through the existing restaurant-scoped segment/customer aggregate, then service-role fetches raw phone only for open `marketing` consent rows. Dashboard `lib/actions/campaigns.ts` owner-gates preview/test/send/list; Customers UI adds an SMS campaign modal (segment select → recipient count → message → test send → campaign send) using the same reference-style surfaces without removing saved segments/list/detail features.

**16c runtime gate (isolated throwaway restaurant/customers; mock SMS; cleanup):** all candidates **3**; eligible marketing recipients **1**; skipped no-marketing **2** (contact-only + revoked); test SMS mock-send ✅; campaign recipient rows **1**, sent **1**, failed **0**, skipped **2**; after revoking the final marketing consent, eligible recipients **0**. Typecheck **9/9** and db unit suite **56/56** passed.

**Phase 16b — saved/custom customer segments (logged 2026-06-19):**

**DB + aggregate:** new `customer_segments` table (`restaurant_id`, `name`, `definition jsonb`, `created_by`, timestamps, `deleted_at`) with owner-scoped RLS and no anon policy. Segment definition v1 is flat JSON: `consent: 'granted'|'missing'`; numeric rules `{op:'>='|'<=', value}` for `last_seen_days`, `visits`, `spend`, `points`, `lifetime_points`. `get_restaurant_customers` was recreated with `p_custom_segment jsonb default null`; built-in segments still work, and custom predicates apply on the existing scoped `base` CTE. **Isolation stays the same:** spend/visits/candidate set are filtered by `restaurant_id`; points/lifetime are filtered by `scope_key`.

**Data/actions/UI:** `packages/db/src/customers.ts` now exports `sanitizeCustomerSegmentDefinition`, `list/get/create/update/deleteCustomerSegment`, and typed `SavedCustomerSegment`. Dashboard customer actions keep the owner gate before service-role calls; `listCustomers` accepts `customSegmentId`, fetches it by `(restaurant_id,id)`, and rejects cross-restaurant ids. Customers UI now shows built-in chips plus saved segment chips, supports apply/edit/delete, and has a compact segment editor for consent + numeric rules. “Filtreyi kaydet” seeds from the active saved segment or built-in segment (`frequent → visits>=3`, `lapsed → last_seen_days>=60`, `consented → consent granted`).

**16b runtime gate (isolated throwaway restaurants/customers/orders/ledger; cleanup):** saved segment visible to A = **1**, visible to B = **0**; B fetch A segment id → `null`; A VIP custom segment (`consent granted + spend>=100 + visits>=3 + points>=100`) → **1** customer (`Segment A VIP`); same definition run on B → **1** B-only customer (`Segment B Only`) proving restaurant-local metrics; update segment to `visits<=1` → **1** A light customer; anon `customer_segments` select visible row = **no**; delete → A saved segments **0**. Migration pushed, `types:gen` regenerated, `db:status` local/remote match through `20260619000000`; typecheck 9/9 and db unit suite **56/56** passed.

**Phase 16a — list + detail + store credit + consent (logged 2026-06-17):**

**Consent = PER-RESTAURANT (`customer_consents`, service-role only).** Each işletme is a separate KVKK veri sorumlusu, so açık rıza to A must never expose the customer to B — a global flag would leak. `(customer_id, restaurant_id, consent_type unique)`; **open = `granted_at not null AND revoked_at is null`**. `consent_type` column designed for a future `'marketing'` type (16c İYS); v1 uses one `'contact_data'`. **Capture:** the JoinScreen KVKK checkbox is now a REAL affirmative opt-in — **default UNCHECKED** (pre-ticked consent is invalid), explicit Turkish copy naming the restaurant + KVKK link; `verify-otp` gains `consent:boolean` → `recordConsent(...,'join')`. **Revoke/re-grant:** MemberHome consent control → cookie-scoped `POST /api/loyalty/consent {restaurantId,grant}` → flips owner phone view to masked on next read. `getMemberBalances` now returns `consentGiven`.

**Owner-scoped list = `get_restaurant_customers(p_restaurant_id, p_scope_key, …)` SQL fn (security definer, REVOKED from anon/authenticated).** Aggregates per customer with activity at the venue: **spend = PAID-ONLY** (`paid_at not null`, non-cancelled), **visits** (`Σ visit delta` at restaurant_id), **points/lifetime** (`Σ points delta` at scope_key → tier via `computeTier`). Candidate set + spend + visits scope by `restaurant_id` (venue); points by `scope_key` (per config; coincide for per-restaurant scope, network shares the bucket). Search (name/phone-tail), 4 built-in segment filters (new/frequent/lapsed/consented), sort, pagination + `count(*) over()`.

**Service-role data layer (`packages/db/src/customers.ts`):** `getRestaurantCustomers` (calls the fn, **masks phone in TS** — raw never leaves without consent: `maskPhone()` → `0532 *** ** 67`), `getRestaurantCustomerDetail` (activity-at-venue gate → null/404 otherwise; venue spend/visits + `getMemberBalances` + merged orders+ledger timeline), `grantStoreCredit` (manual `type='points',direction='earn',reason='store_credit[:note]'`, **`granted_by` audit column** = owner uid; activity-gated; v1 GRANT-ONLY, deduct deferred), `recordConsent`/`getConsentStatus`.

**Dashboard (owner-validated actions `lib/actions/customers.ts` — `assertOwner` checks `restaurants.owner_id=auth.uid()` BEFORE any service-role call):** new **Müşteriler** nav (IconRail `I.users`) → `customers/page.tsx` (SSR list → `CustomersClient`: search + segment chips + sort + pagination, row-click → detail) + `customers/[customerId]/page.tsx` (**sub-route**, SSR → `CustomerDetailClient`: profile w/ masked-or-real phone + consent badge, stat tiles, **Puan/Kredi tanımla** form → `grantStoreCreditAction` → `router.refresh()`, activity timeline). No Tailwind (dashboard inline styles + `lib/ui` `I/S/Tag/EmptyState`).

**16a isolation proof (2 isolated restaurants A+B, shared customer C w/ activity at both, consent to A only; created+destroyed; maf-lounge untouched; 21/21):** A list shows C as A-scoped **spend 300 (paid-only, never B's 999) / visits 2 / points 150**; C phone **FULL for A** (consent) but **MASKED for B**; A detail timeline = 4 events (A-only, zero B leak); `grantStoreCredit(A,C,100)` → A 150→250 but **B unchanged 500** + `granted_by` recorded; `getRestaurantCustomerDetail(A, <B-only customer>)` → null; cross-owner `restaurants where id=B and owner_id=A` → 0 rows (assertOwner rejects); **revoke consent at A → `consentGiven=false` + phone flips to masked**. Typecheck 9/9; menu `/maf-lounge` 200; dashboard customers route compiles (307 auth-redirect, 0 build errors).

### Security — Multi-tenant isolation hardening ✅ (2026-06-17)

**Three confirmed cross-tenant holes closed. Migration `20260617000000_security_isolation_fixes.sql` (applied via `db push`). Proven with 2 isolated test restaurants A+B (20/20 cross-tenant probes; maf-lounge read-only, token relocated + loyalty config intact).**

- **GAP #1 (CRITICAL) — kitchen_token was in anon-readable `restaurants.settings`** (the menu reads restaurants with `select('*')` via the ANON client → the secret was serialized into the public page). Fix: new **`kitchen_credentials`** table (owner-scoped RLS, **NO anon**, mirrors `payment_credentials`); migrated tokens out; **stripped `kitchen_token` from `settings`** (`settings - 'kitchen_token'`). A separate table (not a column) was required because `select('*')` would re-expose any restaurants column. `validateKitchenToken` reads the new table (service-role); `generateKitchenToken` upserts it; dashboard SSR (orders/page + settings/page) reads it owner-scoped and threads `kitchenToken` into `SettingsForm`/`KitchenSectionWrapper`.
- **GAP #2 (HIGH) — anon could read every restaurant's last-24h orders incl. `payment_token` + `customer_id`** (+ realtime). Fix: (a) moved the İyzico token to **`order_payment_tokens`** (service-role-only, NOT in the realtime publication) and **dropped `orders.payment_token`** → the secret can't appear on any anon REST/realtime surface; `payment-credentials.ts` attach/resolve rewired (resolve now also returns `restaurantId`). (b) **Column-grant on `orders`**: `revoke select … from anon` + `grant select (<safe cols>) to anon` — **excludes `customer_id`**; the menu only ever selects safe operational columns (verified), so tracking still works. The 24h row policy stays (operational data only now).
- **GAP #3 (HIGH) — kitchen status write was cross-tenant** (`updateOrderStatusDB(orderId)` token-gated on restaurantId but not scoped). Fix: `updateOrderStatusDB`/`markOrderPaidDB` gained a **`restaurantId` arg** → `UPDATE … WHERE id AND restaurant_id` + `.select('id')`; **0 rows → reject** (`'Order not found for this restaurant'`). Callers pass it: kitchen action (token-validated id), dashboard action (owner-verified id), payment callback (token-resolved id; now marks the token-resolved order, not the İyzico-echoed `basketId`).
- **MEDIUM — `/api/orders` slug cross-check**: the order body now carries `slug`; the route resolves slug→restaurant.id (service-role) and **rejects on mismatch** (mirrors `/api/payment`). The client (`MenuPageClient.orderBody`) sends `restaurant.slug`.
- **GAP #4 (HIGH, found 2026-06-17 by the 16a real-auth e2e test) — dashboard SSR ownership gate was bypassable.** `getRestaurantById(id)` (the gate every dashboard SSR page uses via `if (!restaurant) notFound()`) filtered only `id` and relied on RLS — but the public `anon_read_restaurants` SELECT policy lets ANY authenticated user read ANY restaurant row, so the gate passed for another owner's restaurant. Harmless for RLS-gated pages (orders/menu data still owner-filtered), but the **customers pages load data via the service role** → owner A visiting `/dashboard/<B_id>/customers` would have leaked B's customers + phones. Fix: `getRestaurantById` now fetches the auth user and filters **`.eq('owner_id', user.id)`** → null (notFound) for non-owned restaurants. Hardens every dashboard SSR page. Client-side CRM actions were already safe (`assertOwner` filters owner_id). **Lesson: test the real authenticated path, not just service-role/SSR proofs — this hole was invisible to service-role tests.**
- **GAP #4b (same root cause, found 2026-06-17 via the Test Cafe B login) — `getRestaurantsForUser` was also unscoped** (`select('*')` relying on RLS → returned EVERY restaurant via the public read policy). Effects: (a) the post-login redirect `app/dashboard/page.tsx → /dashboard/${restaurants[0].id}/menu` sent every owner to the **oldest** restaurant (maf-lounge), not their own → a NEW owner (Test Cafe B) hit notFound (after the GAP #4 fix) / would have silently landed on maf's dashboard (before it); (b) the store switcher (`[restaurantId]/layout.tsx`) listed all venues. Fix: same `.eq('owner_id', user.id)` filter → returns only owned restaurants. Verified real-auth: B's login now resolves only Test Cafe B → redirect to its own dashboard.
- **Residual/update:** `customer_id` is blocked on the anon REST path (column-grant, proven); Supabase Realtime "Postgres Changes" also honors column privileges so it's stripped there too. `anon_read_recent_orders` still allows anon to read SAFE columns of any restaurant's 24h orders (no anon identity to scope by) — operational data only, no secrets/PII. The old `anyone_create_order insert check(true)` residual was closed in Sprint 18b (`20260618030000_close_orders_anon_insert.sql`); customer orders now go through `/api/orders` service-role creation. **owners still cannot read `customers` (service-role only) → phone PII isolation unchanged.**

### Sprint 15 — Tiers + Visits + Reward Catalog + Rich Member Home ✅

**Design ref: `ref/Membership_Loyalty.html` (join/OTP/member-home, 8 keyframes, 4 tiers, rewards, activity). 15a = tiers + lifetime points + visits + welcome bonus (data + config) ✅ (2026-06-15). 15b = rich member-home UI rebuild ✅ (2026-06-15). 15c = reward catalog redemption ✅ (2026-06-16). Sprint 15 COMPLETE. NOTE: theme-tokenized palette (var(--p-\*)) + fixed gold #c8922a — NOT hard-coded green.**

**Phase 15c — reward catalog redemption (logged 2026-06-16):**

**Catalog reward = redeem points → ONE free unit of a specific item (full item price off the bill), debiting a config-set `pointCost` in points.** `pointCost` is re-read SERVER-SIDE from `settings.loyalty.reward_catalog` (never trusted from client; the only client input is `catalogItemId`).

**Migration `20260616000000_loyalty_phase5_catalog.sql` (applied via `db push`):** `redeem_loyalty` gains `p_points_exact boolean default false` (DROP 7-arg → CREATE 8-arg, re-revoke from anon/auth). **EXACT mode = all-or-nothing on the points slot** (`v_points_bal >= p_points ? p_points : 0`) — required because a catalog `pointCost` is arbitrary (not a ₺-multiple) and the free item must be cleanly VOIDED, not partially paid, when a concurrent order drains the balance. Points-as-₺ keeps the partial whole-₺ path (`p_points_exact=false`). One points slot suffices because of either/or.

**EITHER/OR (locked):** at most ONE points redemption path per order — catalog reward OR points-as-₺, never both. `computeOrderDiscount`: when a catalog reward is claimed, `requestedPoints` is forced 0 (catalog IS the points spend). Stamp-free (stamps) + member-% still STACK. **Order of ops: stamp-free → catalog-free → member-% → points-as-₺** (`computeDiscountStack` gained an optional `catalogDiscountAmount` slot between stamp and member-%; both free-item slots come off at full price first; unit-tested `stack.test.ts`, 10).

**Engine (`computeOrderDiscount`):** new input `requestedCatalogReward?: {itemId}`. Eligible only if member + points_enabled + itemId in `reward_catalog` + that item in cart + `balances.points >= pointCost`; else clamp to no-claim. Produces `catalogDiscountAmount` (= item DB price), `catalogPointsCost` (exact debit), `catalogItemName/Id`. **createOrder**: points slot = `catalogActive ? catalogPointsCost : pointsRedeemed`, `pointsExact = catalogActive`; after the RPC, **re-stack from actual debits** — `catalogClaimed = pointsDebited >= catalogPointsCost`, a voided catalog → free item removed + `orders.total` corrected (`clamped`). `redeemForOrder` gained `pointsExact`. Breakdown carries `catalogDiscountAmount/catalogPointsRedeemed/catalogItemName`.

**Routes:** `catalogItemId` threaded through `preview-discount` + `/api/orders` (guests forced null). İyzico/table-bill auto-reflect via `orders.total`; the 3a clamp/re-confirm (`window.confirm` on increase) covers catalog clamps too.

**Dashboard (LoyaltySection):** new **Ödül kataloğu** editor under the points section (item `<select>` + pointCost + tag + remove + "Ödül ekle"); item choices now load when stamps OR points enabled. `saveLoyaltyConfig` validates EVERY `reward_catalog` itemId belongs to the restaurant + pointCost>0 (drops invalid/dupes, clamps tag to 24 chars). Config types in `loyalty-config.ts` (+`CatalogReward`, `reward_catalog`), threaded through `SettingsForm`.

**Customer UI:** MemberSheet **RewardsSheet** "Yakında" → real **Kullan** (enabled when `points >= pointCost`, else "Yetersiz"); on Kullan, `onRedeemCatalog(itemId)` → MenuPageClient **auto-adds the reward item to the cart if missing** (cleaner one-tap UX), sets `catalogItemId`, drops points-as-₺, opens the cart. **CartDrawer**: catalog-claim banner "🎁 Bedava [ürün] · X puan" + **Vazgeç**, a breakdown line "🎁 Ödül: [ürün] −₺X", and the points-₺ slider is HIDDEN while a catalog reward is active (client-side either/or, server-enforced too). `catalogItemId` auto-clears if the reward item leaves the cart, and resets after placement/logout. `CatalogChoice` gained `itemId`.

**ACTIVITY:** catalog redemption appears as a generic points-redeem row (reason='redeem' → label "Puan kullandın"); item-name labels deferred (would need an order join).

**15c runtime gate (ISOLATED test restaurant via real `createOrder`; created+destroyed; maf-lounge byte-identical; 35/35):** A happy path (claim coffee ₺50 free, debit EXACT 200, spendable 600→400, lifetime 600 + tier UNCHANGED, 1 redeem row −200); B either/or (catalog+300pts requested → only catalog, points-₺ suppressed, 1 debit); C reward not in cart → clamp/no debit; D insufficient points (<cost) → clamp; E item not in catalog → clamp; F **2 concurrent claims, balance exactly 200 → exactly ONE free item, other voided to subtotal, balance 0 never negative, 1 redeem row** (advisory lock + all-or-nothing); G guest → no redemption; H catalog + member-10% stack (−50 then −10 on post-catalog 100 → ₺90). Unit 40/40 (stack.test.ts catalog slot). Typecheck 9/9. Compile/serve via read-only `GET /maf-lounge` (200, 0 error signatures). 0 orphan artifacts.

**Phase 15a — tiers + visits + welcome bonus (logged 2026-06-15):**

**Migration `20260615000000_loyalty_phase4.sql` (applied via `db push`):** extended the type CHECK to `('stamp','points','visit')`; added `loyalty_transactions.session_id uuid` (FK table_sessions, on delete set null); **VISIT IDEMPOTENCY = `unique(session_id, customer_id, type) where session_id is not null`** — a session closed once credits each member exactly once. Tiers/catalog/welcome_bonus_points are JSONB config (no columns); welcome idempotency is **app-layer** (guard on existing `(customer_id, scope_key, reason='welcome')` row).

**Spendable vs LIFETIME points (the critical distinction):** `getMemberBalances` now returns `points` (SPENDABLE = Σ earn−redeem) AND `lifetimePoints` (Σ points WHERE direction='earn', never reduced by redemption). **Tier is driven by lifetimePoints, NOT spendable** — redeeming never drops tier. Also returns `visits`, `tier`, `tierIndex`, `nextTier`, `tierProgress`.

**Tiers:** `settings.loyalty.tiers` = `[{name,min,color}]`, 4 fixed names (Bronz 0 / Gümüş 500 / Altın 1000 / Platin 2500 default, thresholds configurable). Pure `computeTier(lifetimePoints, tiers)` (unit-tested `tier.test.ts`, 8) — highest tier with min ≤ lifetime; `tierProgress` is **band-relative** (`(lp−tier.min)/(next.min−tier.min)`) and **floored** (never shows 100% before promotion). `readLoyaltyConfig` sanitizes tiers (sort by min, Tier[0].min forced 0) + reads `reward_catalog` (15c) + `welcome_bonus_points`.

**Visits:** `creditVisitsForSession(sessionId)` (packages/db, service-role, **best-effort try/catch — never blocks the close**) credits +1 visit (`type='visit',delta=1,direction='earn',session_id`) to each DISTINCT member with a non-cancelled order in the session; `on conflict (session_id,customer_id,type) do nothing`. Wired into BOTH `closeTableSession` AND `deleteTable`'s session-close (tables.ts). Guest-only/empty session → 0 visits.

**Welcome bonus:** `creditWelcomeBonus(customerId, restaurantId)` (best-effort) credits `welcome_bonus_points` once (type='points', direction='earn', reason='welcome') — app-layer guard skips if a welcome row already exists for (customer, scope). Wired into `/api/loyalty/verify-otp` (now takes optional `restaurantId`; MemberSheet sends `restaurant.id`). Single-use OTP codes make a second verify a separate call that finds the existing row → no double.

**Dashboard (LoyaltySection):** config types extracted to `apps/dashboard/components/settings/loyalty-config.ts`. Added tier-thresholds editor (4 rows, Bronz locked at 0) + welcome-bonus field. Saves via existing `saveLoyaltyConfig` (extra JSONB keys pass through).

**15a runtime gate (ISOLATED test restaurant — own auth user + 2 tables + menu, created+destroyed; maf-lounge UNTOUCHED; 14/14):** 2-member session close → each +1 visit (guest order in same session → 0); re-fire close → still 1 each (idempotency key); guest-only session → 0; seed earn 500 → tier Gümüş, then redeem −200 → spendable 300 but lifetime 500 + tier Gümüş UNCHANGED; welcome +100 once, second call no double (1 row); tier boundary 499→Bronz / 500→Gümüş / 1000→Altın. Unit: 36/36 (incl. tier.test.ts). **Runtime fixtures must use run-unique phones + URL-encode `+` as `%2B` in PostgREST `like` filters.**

**Phase 15b — rich member-home UI (logged 2026-06-15):**

**Display-only rebuild — NO engine/economy change, NO migration, NO new route.** `getMemberBalances` already surfaces everything the UI binds to (extended for 15b): `memberCode` (deterministic `GRS-XXXX-XXXX` from the customer UUID — `replaceAll('-','').slice(0,8)` upper, dash-split), `joinedAt`, and `recentActivity` (last 8 ledger rows as `LoyaltyActivity {id,type,direction,delta,reason,createdAt}`, newest-first). **So activity needs NO separate `getMemberActivity` route — it rides on `/api/loyalty/balances`.** Activity labels are reason/type/direction-derived (welcome→"Hoş geldin bonusu", points earn/redeem→"Puan kazandın/kullandın", stamp→"Damga kazandın/Bedava ürün", visit→"Ziyaret"); item-name labels would need an order join → deferred (kept display-only).

**`MemberSheet.tsx` fully rebuilt (apps/menu) into a tall bottom-sheet (92vh) with three screens + two nested sheets:** **JoinScreen** (name + phone + KVKK consent checkbox gating the button + perk chips + ring-expand hero; button suffix "& X puan kazan" only when `welcome_bonus_points>0`; "Şimdilik geç"→close as guest), **OTPScreen** (6-box paste/auto-advance/backspace nav, real **60s** resend cooldown, error state clears+refocuses, dev-code hint + auto-prefill in dev, Spinner; wires real request-otp/verify-otp with `restaurantId`), **MemberHome** (membership card: tier badge+`tier.color` dot, shimmer, `tierProgress` bar + "{nextTier.min−lifetime} puan kaldı", member name + `memberCode`; Stats Puan ⭐=**spendable** + Ziyaret 🏆=visits with countUp; stamp card real `stamps/stampGoal`, 5-col dots, 🎁 on last cell, stampPop on newest, NO demo "+Damga"; rewards teaser → sheet; SON HAREKETLER activity feed w/ relative-time + empty state; "Üyelikten çık"). **RewardsSheet** is a nested overlay. (A member-QR strip + QRSheet were built in 15b via `qrcode.react`, then REMOVED 2026-06-16 — with no scan-to-credit flow the QR opened to nothing, so per user it added no value; `qrcode.react` uninstalled.) Catalog redemption deferred → reward buttons showed "Yakında" (made real in 15c). **MemberHome shows a loading spinner until balances arrive** (after verify, parent refetches then re-renders the sheet).

**Palette/animation:** reference's hard-coded greens → local `--ml-*` vars mapped onto the live theme (`--ml-accent: var(--p-accent)`, `--ml-accent2: color-mix(in srgb, var(--p-accent) 80%, #000)`, `--ml-surface: var(--p-card)`, …) + fixed `--ml-gold: #c8922a` for tier/reward accents, set on the sheet root so the card adapts per-restaurant. All **8 keyframes ported with `ml-` prefix** (ml-pulse-dot/fade-slide/stamp-pop/shimmer/count-up/sheet-up/ring-expand/confetti-drop) + ml-spin, injected via a `<style>` block. **CSS custom-property keys need `as React.CSSProperties` cast** (this @types/react rejects them in a typed literal).

**Wiring:** MenuPageClient resolves `reward_catalog` (config `{itemId,pointCost,tag}` → `{name (from live menu items),pointCost,tag}`, dangling itemIds filtered) + reads `welcome_bonus_points`, passes `restaurantName/welcomeBonus/rewardCatalog` to MemberSheet. **Header chip is tier-aware** — `memberSummary.tierColor` (= `tier.color`) renders a small dot on the compact chip.

**15b gate (ISOLATED test restaurant, created+destroyed; maf-lounge byte-identical; 23/23 data assertions + compile/serve):** seeded welcome+earn+stamp+visit+redeem ledger → `getMemberBalances` returns memberCode `GRS-####-####`, spendable 550 vs lifetime 600, tier Gümüş + progress 20 + color carried, visits 1, stamps 3, 5 activity rows newest-first with correct labels; reward-catalog resolution drops the dangling itemId (2→1). Compile/serve proven by a read-only `GET /maf-lounge` (200, SSR, 0 Next error signatures) forcing the `[slug]`→MemberSheet chain to build. 0 orphan artifacts. Typecheck 9/9 green.

### Sprint 14 — Üyelik + Sadakat (Membership & Loyalty) 🚧

**Phase 1 (2026-06-13) — identity + OTP. Phase 2 (2026-06-14) — earning ledger + balances. Phase 3 — redemption + member discount: 3a points→cart discount ✅ + 3b member auto-% ✅ + 3c stamp→free item ✅ (2026-06-14/15). Sprint 14 COMPLETE.**

**Phase 3c — stamp → free item (logged 2026-06-15):** when a member's stamp balance ≥ `stamp_goal`, they claim ONE free unit of the configured `reward_item_id` in cart (full price off). **NO migration** — `reward_item_id` lives in `settings.loyalty` JSONB; the `redeem_loyalty` RPC already does all-or-nothing stamp debit + advisory lock. Order of ops (final): **stamp-free → member-% → points** — free unit comes off at FULL price first. Engine (`computeOrderDiscount`): `requestedStampClaim` eligible only if member + stamp_enabled + `stamps≥stamp_goal` + `reward_item_id` set + **reward item actually in cart** (else clamped to no-claim); `stampDiscountAmount = DB reward price`, `stampsConsumed = stamp_goal`. createOrder passes `stamps` to the RPC, then **re-stacks from actual debits** (a clamped stamp claim changes the member-% base, so re-stack not patch). **CRITICAL re-earn fix:** `earnForOrder` queries the order's redeem stamp ledger row (`direction='redeem',type='stamp'`); if present (free claimed), `computeStampEarn` subtracts 1 from the reward item's earn so the free unit doesn't re-earn a stamp (edge: order 1 reward unit + claim → earn 0). Config: `LoyaltySection` reward-item `<select>` (items fetched via `getRewardItemChoices`, owner-validated); save via new `saveLoyaltyConfig` which **validates reward_item_id belongs to the restaurant** (clamps invalid→null). Cart: "🎁 Bedava [ürün] ekle" toggle when card full + reward in cart, nudge "Kartın doldu! [ürün] ekle" when full but not in cart, "Bedava [ürün] −₺X" breakdown line. **Runtime (ISOLATED test restaurant — own auth user + menu, created+deleted, maf-lounge untouched; 12/12):** claim free coffee → −₺50 full then member −₺4 → ₺36, stamp ledger −3; free unit no re-earn (1 coffee+claim → 0 earn stamp); claim w/o reward in cart → no discount/no debit; stamp+member%+points stacked → −50/−4/−5 = ₺31 with both redeem rows; double-claim concurrent → only one card debited (advisory lock); guest → no claim. Unit tests: `computeStampEarn` (stampearn.test.ts, 6) + `computeDiscountStack` (stack.test.ts) cover the stack + re-earn.

**Phase 3b — member auto-discount (logged 2026-06-14):** every logged-in member gets `member_discount_pct` off automatically (standing campaign; no opt-in, no ledger row — a price reduction, NOT a balance debit). **NO migration.** Filled the member-% slot in `computeOrderDiscount` via a new pure `computeDiscountStack()` (unit-tested `stack.test.ts`) implementing the locked order **stamp-free → member-% → points-last**: member-% = `floor(afterStamp * pct/100)` (floored to whole ₺) on the post-stamp amount; points then come off the remainder; `finalTotal = max(0, subtotal − stamp − member − points)`. `member_discount_pct` clamped 0–100 on read AND on save (LoyaltySection). Earning still on `finalTotal`. Preview endpoint + `OrderDiscountBreakdown` now carry `memberDiscountPct`; CartDrawer shows an "Üye indirimi %X" line above the points line; MenuPageClient previews when `member && (canRedeem || memberPct>0)` so members with no points still see the discount. **Runtime (maf-lounge, real createOrder, 8/8):** member 10% no points → ₺185→₺167, **0 ledger rows**; member 10% + redeem 50pts → −₺18 then −₺5 = ₺162, only the points −50 redeem row in ledger (member-% writes nothing); guest → no discount; pct=0 → normal total. Member-% is purely a price reduction — only points/stamp redemption debits the ledger.

**Phase 3a — points → cart discount (logged 2026-06-14):**

**Server is the source of truth for money** — discounts are computed/validated server-side; client only previews. `orders.total` and the İyzico amount both come from the server recompute.

**Migration `20260614020000_loyalty_phase3a.sql`:** added `loyalty_transactions.direction text ('earn'|'redeem')`; **dropped `unique(order_id,type)`, created `unique(order_id,type,direction)`** so an earn-points row and a redeem-points row coexist on one order, each idempotent. `redeem_loyalty(...)` RPC (service-role only, `revoke ... from anon, authenticated`): **`pg_advisory_xact_lock(hashtext(customer||scope))`** serializes redemptions per customer+scope (double-spend safe), debits points in whole-₺ multiples, stamps all-or-nothing. `earnForOrder` now inserts `direction:'earn'` with `onConflict 'order_id,type,direction'`.

**Canonical points formula (pinned):** `points_redeem_rate` = **points needed for ₺1** (e.g. 10 → 10 puan = ₺1). ₺-value = `floor(points/rate)`; consumed = `₺ × rate`. Dashboard label: "Kaç puan = ₺1 indirim". `computePointsRedemption()` is the single source (unit-tested `redeem.test.ts`), used by both preview and placement — no client money math.

**Order of operations (forward-compat for 3b/3c):** stamp-free → member-% → **points last**; `finalTotal = max(0, subtotal − stamp − member% − points)`. 3a wires points only (member/stamp = 0). **Earning computes on `finalTotal`** (amount actually paid; storing finalTotal as `orders.total` gives this for free — no farm loop).

**`computeOrderDiscount()` (packages/db, read-only):** recomputes **subtotal from DB `menu_items.price`** (not client prices — closes a tamper hole; modifier deltas still client-supplied, flagged residual), validates redemption vs real balance, clamps. Used by `POST /api/loyalty/preview-discount` (cart preview) AND `createOrder`.

**`createOrder` rewritten** (`lines` + `customerId` + `redeemPoints`, returns `{ orderId, breakdown }`): compute → insert with optimistic finalTotal → `redeem_loyalty` RPC (debit) → if clamped under concurrency, recompute + `UPDATE orders.total`. `/api/orders` returns the authoritative breakdown. **`/api/payment` now reads `orders.total` from the DB** for the İyzico amount (was client `total` — pre-existing hole, fixed). Table-bill auto-reflects discounts (sums `orders.total`).

**Divergence UX (addition C):** `/api/orders` returns `breakdown.clamped`. Pay-first re-confirms via `window.confirm` if the amount increased beyond the previewed total before opening İyzico — never silently overcharges.

**Cancel refund update:** the old warning-only cancel guard was superseded in Sprint 19a. `updateOrderStatusDB(...,'cancelled')` now writes idempotent positive `direction='refund'` ledger rows for prior redeem rows; redeem rows stay queryable by `order_id`.

**Cart UI:** CartDrawer gains a "⭐ Puan kullan" stepper (₺, capped by balance-value and bill) + "Tümünü kullan" + discount line + server-preview total. MenuPageClient: debounced preview call, `redeemPoints` threaded into both place-order and pay-first, balances refetched after placement.

**3a runtime gate (maf-lounge, real `createOrder`/`markOrderPaidDB`, all ✅):** redeem 50 pts (rate 10) → orders.total ₺185→₺180; tamper (redeem 999999 / client price 999) → clamped to balance ₺50, charged ₺135, client ignored; double-spend (2 concurrent ×100 pts, balance 100) → debited 100/100, balance 0, never negative; earn+redeem one order → both rows (−50 redeem, +180 earn), balance net-correct; guest → no discount, 0 rows; anon → RPC 401 + ledger 0 rows. 14/14 assertions. **Ops:** applied via `db push` (CLI linked; `SUPABASE_DB_URL` still empty).

**Phase 2 — earning ledger + balances (logged 2026-06-14):**

**Schema (`20260614010000_loyalty_phase2.sql`, applied via `migration repair` + `db push` — see ops):** `loyalty_transactions` (customer_id, restaurant_id=earning venue, **scope_key**=balance bucket, order_id, type `stamp`|`points`, delta int, reason, created_at) — **balance = sum(delta)**, never a stored balance. Idempotency = `unique(order_id, type) where order_id not null`. `menu_items.earns_stamp boolean default false`. RLS: owner SELECT own-venue rows; **no anon, writes service-role only** (probe: anon 0 rows even with a real row, service 1).

**Stamp model = per-item, ONE aggregated row.** `delta = Σ quantity` of order lines whose `menu_items.earns_stamp` (3 coffees → one stamp row delta=3, not 1). Keeps `unique(order_id,'stamp')`; per-item detail already lives in `orders.items` JSON. **No `order_items` table — items are JSONB** `[{itemId, quantity, …}]`; the "join" is JSON-parse + one `menu_items.in(ids).eq(earns_stamp,true)` lookup. Points = `floor(orders.total * points_per_lira)`.

**Earning seam (`packages/db/src/orders-update.ts` → `loyalty.earnForOrder(orderId, trigger)`):** `markOrderPaidDB`→`earnForOrder('paid')`; `updateOrderStatusDB`→`earnForOrder('served')` **only when status==='served'**. Both funnel through here (dashboard + kitchen + payment callback), so all callers earn with no per-app change. **Best-effort: try/catch, logs, NEVER throws** — a loyalty failure can't break the paid/served write. Gated by `cfg.earn_trigger`, so only the configured trigger credits; the unique index neutralizes paid→served / realtime retries / kitchen re-flips. Reads order total/items/customer_id from the DB (never client input → can't inflate points). `scope_key`: per-restaurant=restaurant_id, network=`NETWORK_SCOPE_KEY` zero-UUID. Pure helpers `computeStampDelta`/`computePointsDelta` are unit-tested (`loyalty.test.ts`).

**Order→member link (REQUIRED for earning):** `/api/orders` now reads the httpOnly cookie → `verifyCustomerSession` → passes `customerId` to `createOrder` (sets `orders.customer_id`). Covers **both** place-order and pay-first (one route). No cookie → guest → `customer_id` null, order still succeeds, earns nothing.

**Balance read:** `getMemberBalances(customerId, restaurantId)` (service-role, scoped) → `{ stamps, points, stampGoal, stampRewardText, stampUnlocked, stampEnabled, pointsEnabled }`. SSR: `page.tsx` (cookie) → `initialMemberBalances`. Live: **`GET /api/loyalty/balances?restaurantId=`** (cookie-scoped) — the menu refetches it when the member's own order fires its earning trigger via the existing realtime order channel (no new anon channel; anon RLS blocks the ledger).

**UI:** Header member chip shows `☕ 3/10` (stamp priority) / `⭐ pts` / "Üye ol" entry. `MemberSheet` gains a balance view (stamp dots `◐◐◐○○`, reward text, "🎉 Ödülün hazır!" when unlocked, points) — display only, verify flow kept for non-members. Promo-slider **loyalty slide connected to real data** via `memberLoyalty` prop threaded `ThemeMenuPageProps→renderCustomSection→PromoSliderBlock` (logged-in→real filled/total; else configured demo). Dashboard MenuManager `ItemEditPanel` → "Sadakat" → **Damga kazandırır** toggle (`earns_stamp`, via existing `updateItem` + zod).

**Runtime proof (maf-lounge, real `markOrderPaidDB`→`earnForOrder` path):** 3 coffees → **stamp delta 3** (not 1) + points 555; **double-fire** (paid retry + served) → still exactly 1 stamp(3) + 1 points row; `getMemberBalances` stamps=3; guest order → 0 rows. SSR with member cookie: chip `☕ 3/10` + slide real `3/10`; anon: "Üye ol" + slide demo `6/10`. All test data reverted.

**Ops:** `SUPABASE_DB_URL` still empty. The CLI **is** linked (types:gen `--linked` works); Phase 1 tables existed remotely but weren't in CLI tracking, so: `supabase migration repair --status applied 20260614000000` then `echo y | supabase db push` applied Phase 2. (SQL editor also works.) Regen types after: `pnpm --filter @garsonless/db types:gen`.

**Identity (global):** `customers` (id, phone unique E.164, name?, verified_at) — ONE phone = one customer platform-wide. `otp_codes` (phone, code_hash sha256, ip, attempts, expires_at, consumed_at). `orders.customer_id` nullable FK (guests stay null). Migration `20260614000000_loyalty_phase1.sql`. **Both tables carry NO anon/authenticated RLS → service-role only** (phone is PII, same discipline as `payment_credentials`); proven via probe: anon reads 0 even with a real row present, service-role reads it.

**Shared `packages/db` modules:** `phone.ts` `normalizePhone()` (centralized E.164, default +90; TR messy variants `0532…`/`532…`/`+90…`/`0090…`/spaces/dashes all → `+905XXXXXXXXX`; 5/5 unit tests via `npx tsx --test src/phone.test.ts`) · `sms.ts` `SmsProvider` iface + `MockSmsProvider` + `getSmsProvider()` (env `SMS_PROVIDER`, default mock) · `loyalty.ts` `requestOtp`/`verifyOtp` (sha256 hashing, customer upsert preserving existing name) · `session.ts` jose HS256 JWT (identity only), `CUSTOMER_SESSION_COOKIE = 'gl_member'`.

**OTP rate limits (locked, enforced via recent-row counts on `otp_codes`):** per-phone **3 / 15 min** + **60 s cooldown**; per-IP **10 / 15 min**; TTL **5 min**; **5** verify attempts then code burned. Throttle → friendly TR + 429, never reveals whether the phone exists.

**Customer session:** signed JWT in **httpOnly, Path=/ (menu app only), SameSite=Lax, Secure-in-prod** cookie — NOT a Supabase Auth user. Carries identity only (never balances). `page.tsx` reads the cookie server-side → `verifyCustomerSession` → service-role fetch of name → `initialMember` to MenuPageClient. **Dev OTP echo strictly gated `NODE_ENV !== 'production'`** (request-otp returns `devCode` only in dev).

**Routes:** `apps/menu/app/api/loyalty/request-otp` + `verify-otp` (service role). **Env (menu .env.local):** `CUSTOMER_SESSION_SECRET` + `SMS_PROVIDER=mock`, documented.

**UI:** Dashboard Settings → **Sadakat** section (`LoyaltySection.tsx`, registered in `SettingsForm`): stamp/points toggles, thresholds, `scope` (restaurant|network), `earn_trigger` (paid|served), `member_discount_pct`, reward text → saved via `updateSettings(restaurantId, { loyalty })` (owner-validated, merged into `restaurants.settings` JSONB — non-secret display/calc values, anon-readable OK). Menu **Header member chip** (`memberSummary`/`onOpenMember` threaded through `ThemeMenuPageProps` → Header; renders only when loyalty enabled) → **verify-only `MemberSheet`** (phone → OTP, dev code auto-fills → optional name → "Üye oldunuz ✓"; NO balance yet).

**Ops:** `SUPABASE_DB_URL` is EMPTY in dashboard .env.local and no supabase CLI login → **migrations applied via the Supabase SQL editor** (service-role key can't run DDL). `types:gen` works (`--linked`). Runtime proof on maf-lounge: enabled loyalty → request-otp (dev code echoed) → verify-otp → `customers` row created with `verified_at` + httpOnly cookie; cookie round-trips into SSR chip ("Test Üye"); test data + loyalty setting reverted.

**Phase 2 (next):** `loyalty_transactions` ledger (idempotent `unique(order_id,type)`, `scope_key` bucket) · `earnForOrder` hook in `orders-update.ts` (both `markOrderPaidDB`/`updateOrderStatusDB` funnel here) · balance display + connect promo-slider loyalty slide to real data. **Phase 3:** redemption + member discount at checkout.

---

### Sprint 12 — Payments as Data + Table Sessions 🚧

**Logged 2026-06-12**

**Payment is a column, not a status:**

- `orders.paid_at timestamptz` — İyzico callback sets ONLY paid_at via `markOrderPaidDB`; status stays in its kitchen stage. `'paid'` remains in the status CHECK for legacy rows; Kanban/KDS map legacy `paid` like `sent_to_kitchen`. ÖDENDİ chips everywhere read `paid_at != null || status==='paid'`.
- Per-restaurant İyzico credentials: `payment_credentials` table (**NO anon RLS**; menu routes read via service role), sandbox/live mode → baseUrl, dashboard Settings→Payments real (masked last4, test via `apiTest`). `serverExternalPackages: ['iyzipay']` required in BOTH menu and dashboard next.config (SDK reads its resources dir at runtime). iyzipay API: `checkoutFormInitialize.create` / `checkoutForm.retrieve` (no `.initialize`, no `checkoutFormRetrieve`).
- Callback flow: init writes `orders.payment_token` → callback resolves token→order→restaurant→credentials server-side, returns HTML page that postMessages `{type:'PAYMENT_SUCCESS'|'PAYMENT_FAILED'}` to the PaymentModal iframe (origin-checked). Local testing needs a cloudflared tunnel + `NEXT_PUBLIC_MENU_URL` (menu and callback must share the tunnel origin).

**Table sessions (adisyon):**

- `table_sessions` + `orders.table_session_id` — ⚠️ `orders.session_id` is the DEVICE/cart session (KPIs use it); do not confuse.
- `open_or_get_table_session(restaurant_id, table_id)` RPC: lazy-open on first order, partial-unique-index race resolution, 8h-inactivity lazy auto-close. **EXECUTE revoked from anon/authenticated — service-role only.**
- Customer: Header "Hesap · ₺X" chip + CartDrawer row → `TableBillSheet` (per-order status/ÖDENDİ, paid/unpaid breakdown); live via realtime filter `table_session_id=eq.{id}`; refresh-on-open detects restaurant close ("Adisyon kapatıldı"). Dashboard: TablesNav session chip + "Kapat" (unpaid override confirm); `deleteTable` closes open session.

**Anon RLS (realtime depends on these — postgres_changes respects RLS):**

- `anon_read_recent_orders`: orders SELECT, 24h window (without it customer realtime got zero events)
- `anon_read_open_table_sessions`: open sessions only
- `supabase_realtime` publication includes `orders` (added 2026-06-11; was missing entirely)

**Order bubble flow:** OrderConfirmation (sheet, ref-design) minimizes to `OrderBubble` (progress arc + unseen badge) + `OrderToastNotification`; `useOrderStore` persists `{orderId, meta, view}` to localStorage `'garsonless-active-order'`, restore re-fetches status (6h TTL, served/cancelled clears silently, never restores into sheet). Realtime callback carries `(status, paidAt)`. Browser supabase client is a singleton — channel topics must be unique per subscriber.

**Ops notes:** project lives at `~/dev/gersonless` (moved off `~/Desktop` 2026-06-13 to stop iCloud creating `"file 2"` duplicates that broke `.next` typecheck and silently split `MenuPageClient.tsx`). Supabase CLI migration tracking repaired (`supabase migration repair`); use `supabase db push` from `packages/db`. `gen_random_uuid()` in new migrations (not `uuid_generate_v4`).

**Backlog:** Garson çağır (OrderConfirmation'da TODO yorumu) · pg_cron gerçek auto-close · Spain theme section renderers · ThemeEditorClient (~4400 satır) + default MenuPage (~2000 satır) refactor · Settings remaining stubs (Team/Workspace team mgmt, Billing real plan/usage, session-timeout/IP-restriction if ever needed) · üyelik + sadakat katmanı · gerçek kişi-başı split-pay (partial-payment modeli + pay başına İyzico); müşteri `SplitBillModal` şimdilik yalnızca hesaplayıcıdır · Bakanlığın işletme kayıt/denetim karekodunu ayrı işletme ayarı ve müşteri görünümü olarak ekleme.

**Siparişler — ayrı ürün/faz backlog'u:** personel/garson atama ve “Bana atananlar” görünümü · işletme bazlı aşama SLA hedefleri · toplu sipariş işlemleri · durum değişiminden sonra kısa geri-al penceresi · tam ekran/TV operasyon modu · vardiya özeti ve operasyonel sorun etiketleri · mutfak token'ını URL'den çıkarıp güvenli ticket/cookie akışına taşıma. Bunlar mevcut Siparişler panosu polish kapsamına dahil edilmez; ayrı veri modeli, yetki ve runtime matrisiyle ele alınır.

---

### Sprint 11 — Theme Registry + Section Library 🚧

**Started ~2026-06 (logged 2026-06-10)**

**Architecture shift:** Theme Registry replaces single-theme rendering. `packages/ui/src/themes/` → `THEME_REGISTRY` dict (templateId → `{ id, name, SETTINGS_SCHEMA, THEME_DEFAULTS, MenuPage }`). Themes: `default` (full, ~2000 lines), `spain` (partial — lists 15 section ids in `CUSTOM_SECTION_IDS` but no custom renderers). Editor is `apps/dashboard/components/theme/ThemeEditorClient.tsx` (~4300 lines, needs splitting).

**New app:** `apps/marketing` (port 3003) — company/solutions/resources/legal pages.

**Section library (16 sections):** registered in `SECTION_LIBRARY` + `SECTION_SETTING_SCHEMA` (ThemeEditorClient) + dispatch branches in `renderCustomSection` (default MenuPage). Settings stored as `theme.sectionSettings[sectionId]: Record<string,string>`; page order in `theme.pageBlocks`.

**Key sections built this sprint:**

- `daily-special` (Günün Özeli): product-select dropdown, corner ribbon (scrolling text, corner/size/speed configurable), real HH:MM:SS countdown; when timer expires the whole section unmounts (`DailySpecialOuter` returns null). Discounted price flows to cart: `CartItem.originalPrice`, `addItem(item, mods, groups, qty, originalPrice?)`, CartDrawer shows strikethrough + "İndirimli" badge; cart auto-opens after quick-add.
- `promo-slider` (Kampanya Slider): 5 slide types (coupon+copy, flash countdown, freebie→category scroll, loyalty stamps, combo w/ auto discount %). Infinite loop via clone-of-first-slide technique (pos 0..N, snap to 0 after clone animation). Slides fit 150px height. Defaults: coupon+flash+combo enabled with no saved settings (`bool(key, true)` fallbacks).

**Editor field-type infra:** `SectionFieldType` = text | textarea | color | range | select | url | toggle | `product-select` (grouped by category) | `category-select` | `heading` (panel divider). Per-slide conditional hiding in `SectionSettingsEditor` (promo-slider only, detected via `couponHeading` key). Logo styling fields (`logoShape/logoShadow/logoBorder/logoBg`) + visual pickers for cols/logoShape.

**DB types:** `types.gen.ts` is pure generated output now (regen with `pnpm types:gen`); hand-maintained `OrderStatus`/`RestaurantPlan` unions moved to `packages/db/src/enums.ts`. `order.status` is `string` in generated types — cast `as OrderStatus` at use sites (OrderBoard, OrderBoardDnd, OrderCard, KitchenBoard, KitchenCard).

**Menu app:** runs on port **3011** (not 3001). Preview URL: `localhost:3011/{slug}?preview=1&template={templateId}`.

---

### Sprint 10 — Theme Diversity — Structural Variants 🚧

**Started 2026-05-25**

**Goal:** Maximum visual diversity between AI-generated themes via 6 new structural fields: `headerLayout`, `categoryDisplay`, `cardStyle`, `itemNameStyle`, `priceDisplay`, `sectionHeading`. 8 personality preset templates replace the original 8.

**New fields:**

- `headerLayout: 'classic' | 'hero' | 'minimal-strip' | 'transparent'` — fundamentally changes header structure
- `categoryDisplay: 'horizontal' | 'none' | 'fullscreen-tabs' | 'sidebar-fixed'` — full page geometry change
- `cardStyle: 'default' | 'borderless' | 'image-hero' | 'pill-row'` — card surface treatment
- `itemNameStyle: 'accent' | 'dark' | 'large'` — name color/size override
- `priceDisplay: 'right' | 'below' | 'pill'` — price placement
- `sectionHeading: 'accent' | 'editorial' | 'catalog'` — section header style

**Files changed:**

- `packages/design-engine/src/schema.ts` — 6 new fields in GarsonlessTheme + DEFAULT_THEME
- `packages/ui/src/menu/Header.tsx` — headerLayout branches (hero, minimal-strip, transparent, classic)
- `packages/ui/src/menu/ProductCard.tsx` — cardStyle, itemNameStyle, priceDisplay
- `packages/ui/src/menu/CategoryNav.tsx` — categoryDisplay (none, sidebar-fixed, fullscreen-tabs)
- `apps/menu/app/[slug]/MenuPageClient.tsx` — sidebar layout, sectionHeading styles
- `packages/design-engine/src/templates.ts` — 8 new personality presets
- `apps/dashboard/app/api/generate-theme/route.ts` — structural decision rules in prompt
- `apps/dashboard/components/theme/SectionPanels.tsx` — VisualPicker editors for 6 new fields
- `apps/dashboard/components/theme/ThemeBuilderShell.tsx` — getSectionDefaults updated

---

### Sprint 9 — AI Design Studio 🚧

**Started 2026-05-24**

**Goal:** Three interconnected AI systems: (1) OCR Menu Importer — photo of a paper menu → structured categories/items + auto-suggested GarsonlessTheme; (2) AI Design Assistant — text prompt → theme generation; (3) Claude Design Mode — click any component in the preview iframe → AI-powered property suggestions via natural language comments.

**Key decisions:**

- System 1 uses Anthropic vision API (`claude-sonnet-4-20250514`), returns `{ menuData, theme, description, confidence }` as JSON
- Image sent as base64 via multipart FormData → server converts to Anthropic vision block
- MenuOCRModal 3 phases: upload (drag+drop) → processing (BrewBar + rotating messages) → review (editable table + PhonePreview)
- `onApplyMenu` loops `createCategory` + `createItem` server actions; `onApplyTheme` calls `saveTheme` directly
- System 3 deferred until Systems 1+2 ship

**Files changed:**

- `apps/dashboard/app/api/generate-from-menu-photo/route.ts` — Anthropic vision + GarsonlessTheme generation
- `apps/dashboard/components/menu/MenuOCRModal.tsx` — 3-phase OCR modal
- `apps/dashboard/components/menu/MenuManager.tsx` — "📷 Menüden Aktar" button + OCR modal integration
- `apps/dashboard/app/api/generate-theme/route.ts` — 3-mode theme generation (prompt / photo / chat)
- `apps/dashboard/components/theme/AIDesignModal.tsx` — input → generating → result modal with mini phone mockup
- `apps/dashboard/components/theme/ThemeBuilderShell.tsx` — "✨ AI ile Tasarla" button + AI chat wired to SectionNav
- `apps/dashboard/components/layout/SectionNav.tsx` — AI button + chat input at bottom of left panel
- `apps/dashboard/components/onboarding/StepTemplateSelect.tsx` — featured AI card above template grid

---

### Sprint 8 — Full Dashboard UI ✅

**Completed 2026-05-20**

**Goal:** Build every admin panel screen end-to-end: Pano overview, Orders Kanban, Menu Manager, Tables/QR builder, Analytics, Settings, layout shell, and landing page.

**Key decisions:**

- All dashboard pages wired to real Supabase data via server components; client components receive pre-fetched props
- `PanoClient` subscribes to `orders` Realtime channel for live activity feed; KPI queries run on server
- `OrderBoard` uses `useOrdersRealtime` hook + dnd-kit for drag-to-advance status; `updateOrderStatus` server action
- `TablesBuilderShell` uses `qr-code-styling` (client-side) for live QR preview + download; `buildUrl` generates `/{slug}/table/{tableId}` URLs matching the menu app routes
- `NewOrderModal` fetches real menu items from Supabase on open; `createOrderFromDashboard` action inserts with `sent_to_kitchen` status
- `FloorPlan` overlay accepts real `TableStatusData` and renders in auto-grid layout (position data is a future feature)
- `RestaurantShell` detects `/tables` route and goes full-screen (no rail nav) for the QR builder
- `AnalyticsClient` started as rich mock-data charts; sales/table data was progressively wired, and revenue/payment/product semantics were fully corrected in Sprint 19b/19c
- `globalTheme.ts` centralises CSS variable definitions for the dashboard design system
- Marketing landing page (`apps/dashboard/app/page.tsx`) — ~80KB standalone client component

**Files changed (key):**

- `apps/dashboard/app/page.tsx` — marketing landing page
- `apps/dashboard/app/dashboard/[restaurantId]/page.tsx` — Pano server page
- `apps/dashboard/components/pano/PanoClient.tsx` — real KPIs, hourly chart, activity feed, top items, floor plan
- `apps/dashboard/lib/queries.ts` — `getDashboardKPIs`, `getHourlySales`, `getActivityFeed`, `getTopItems`, `getTableStatuses`
- `apps/dashboard/components/orders/OrderBoard.tsx` + `OrderCard.tsx` — Kanban board with realtime
- `apps/dashboard/components/menu/MenuManager.tsx` — drag-reorder categories + items, image upload
- `apps/dashboard/components/tables/TablesBuilderShell.tsx` — QR builder with presets, shapes, colors, frames, download
- `apps/dashboard/components/analytics/AnalyticsClient.tsx` — sales, items, tables, payments reports (real analytics wired by Sprint 19b/19c)
- `apps/dashboard/components/settings/SettingsForm.tsx` + section files — account, store, hours, tax, languages, payments, AI waiter, kitchen, API, billing, security
- `apps/dashboard/components/layout/RestaurantShell.tsx` + `IconRail.tsx` + `SectionNav.tsx` + `PageTopBar.tsx`
- `apps/dashboard/components/overlays/` — StoreSwitcher, NotificationsPanel, ProfileMenu, HelpModal, NewOrderModal (real data), FloorPlan (real data), DateRangePicker
- `apps/dashboard/lib/actions/orders.ts` — `updateOrderStatus`, `createOrderFromDashboard`
- `apps/dashboard/lib/ui.tsx` — shared UI primitives (Icon, Tag, Button, EmptyState, etc.)

---

### Sprint 7 — Component-Config Architecture (Theme Builder Rewrite) ✅

**Completed 2026-05-18**

**Goal:** Replace the CSS token + postMessage approach with a Shopify-inspired component-config JSON architecture. Every component owns its config schema; `COMPONENT_SCHEMAS` drives the editor UI; postMessage targets individual components.

**Key decisions:**

- `MenuPageConfig` is a flat JSON object (5 components: page, header, categoryNav, productCard, cartDrawer) — no more nested `ThemeTokens.brand/typography/shape/components`
- `COMPONENT_SCHEMAS` is the schema-of-the-schema — each field has a `FieldType` that tells the dashboard how to render it (`color`, `radio`, `slider`, `toggle`, `font`)
- `ThemeProvider` lives in `packages/ui` (not `apps/menu`) to avoid circular dependency; components call `useTheme()` directly
- postMessage protocol: dashboard → menu `{ type: 'COMPONENT_UPDATE', component, config }`; menu → dashboard `{ type: 'COMPONENT_CLICK', component }`
- Clicking a component in the preview iframe selects it in the property panel (bidirectional)
- All component styling via inline styles from `useTheme()` — no CSS vars in components
- `applyFullConfig()` still injects SSR CSS for initial paint (no FOUC), then client postMessages take over
- Theme data stored in `theme_configs.tokens` JSONB as `MenuPageConfig` (was `ThemeTokens`)
- `DEFAULT_CONFIG` fallback used when stored data lacks `page` key (detects old format)
- `?preview=1` query param enables preview mode in `ThemeProvider` (receives postMessages + sends click events)
- 8 templates updated to `MenuPageConfig` format: minimal, noir, mercato, bento, beachside, steakhouse, fast, mezze

**Files changed:**

- `packages/design-engine/src/schema.ts` — `MenuPageConfig` + `DEFAULT_CONFIG`
- `packages/design-engine/src/config-schema.ts` — `COMPONENT_SCHEMAS` (schema-of-the-schema)
- `packages/design-engine/src/templates.ts` — 8 templates as `MenuPageConfig`
- `packages/design-engine/src/apply.ts` — `applyFullConfig`, `applyPageConfig`, `buildFontsUrl`
- `packages/ui/src/menu/ThemeContext.tsx` — `ThemeProvider` + `useTheme()` with postMessage bridge
- `packages/ui/src/menu/Header.tsx` — rewritten, uses `useTheme()`, `data-component="header"`
- `packages/ui/src/menu/CategoryNav.tsx` — rewritten, uses `useTheme()`, `data-component="categoryNav"`
- `packages/ui/src/menu/ProductCard.tsx` — rewritten, 3 layouts (grid/list/compact), `data-component="productCard"`
- `packages/ui/src/menu/CartDrawer.tsx` — rewritten, uses `useTheme()`, `data-component="cartDrawer"`
- `apps/menu/app/[slug]/layout.tsx` — uses `applyFullConfig` + `buildFontsUrl`
- `apps/menu/app/[slug]/page.tsx` — passes `MenuPageConfig` + `isPreview` to `MenuPageClient`
- `apps/menu/app/[slug]/MenuPageClient.tsx` — wraps with `<ThemeProvider>`, no more tokens prop threading
- `apps/dashboard/components/theme/ThemeBuilderShell.tsx` — rewrites around `MenuPageConfig`
- `apps/dashboard/components/theme/PropertyPanel.tsx` — schema-driven field renderer
- `apps/dashboard/components/theme/fields/` — `ColorField`, `RadioField`, `SliderField`, `ToggleField`, `FontField`
- `apps/dashboard/lib/actions/theme.ts` — accepts `MenuPageConfig` instead of `ThemeTokens`

---

### Sprint 6 — Branded QR + Payment ✅

**Completed 2026-05-17**

**Goal:** Branded QR code generation with custom colors/shape/logo + İyzico payment integration + split bill.

**Key decisions:**

- QR rounded shape: SVG output → inject `rx/ry` on all `<rect>` elements → Sharp PNG conversion
- Logo from URL: `fetch()` URL → Buffer → Sharp composite (no local file path needed)
- QR style saved to `restaurants.settings.qr_style` JSONB — no migration needed
- İyzico: `checkoutFormInitialize.create()` → `paymentPageUrl` → iframe in `PaymentModal`
- İyzico callback: POST `/api/payment/callback` updates order status to `paid`
- `'paid'` added to `OrderStatus` enum in types.gen.ts
- Split bill: client-side equal/per-item share calculator shipped; individual İyzico payment per person was planned but never implemented (deferred pending a partial-payment model)
- `deviceId` added to `useCartStore` as persistent device UUID (separate from sessionId)
- Stand orders: static page + Resend email (lead capture, not e-commerce)
- Payment flow: "Ödeme Yap" places order first → gets orderId → opens PaymentModal with İyzico iframe
- iyzipay has no official types — declare module in `apps/menu/lib/iyzipay.d.ts` (different name from `iyzico.ts` to avoid TS treating it as local override)

---

### Sprint 5 — AI Waiter ✅

**Completed 2026-05-17**

**Goal:** Build the AI Waiter feature for the customer menu app — chat UI, streaming API route, tool use (add_to_cart, call_waiter, get_item_details, get_order_status), prompt caching, and dashboard settings panel.

**Key decisions:**

- Streaming via Anthropic SDK `messages.stream()` + `ReadableStream` SSE (no Vercel AI SDK)
- Wire format: newline-delimited JSON — `{ type: 'delta'|'tool_use'|'tool_result'|'done'|'error', ... }`
- Prompt caching: system prompt + menu JSON sent as `cache_control: { type: 'ephemeral' }` block — ~80% cost reduction on multi-turn chats
- Menu cache: `unstable_cache` with tag `menu:{restaurantId}`, revalidated by dashboard menu save actions
- AI settings stored in `restaurants.settings` JSONB: `ai_waiter_enabled`, `ai_persona_name`, `ai_tone`, `ai_language`
- `add_to_cart` + `call_waiter` tools handled client-side; `get_item_details` + `get_order_status` handled server-side in agentic loop

---

### Sprint 4 — Realtime Ordering + Kitchen Display ✅

**Completed 2026-05-17**

**Goal:** Wire up live order flow end-to-end: dashboard Kanban board, Kitchen Display System (KDS), PWA notifications, and Turkish status labels for customers.

**Key decisions:**

- Kitchen app is auth-free; access gated by `kitchenToken` stored in `restaurants.settings.kitchen_token` (existing JSONB), validated server-side before service-key operations
- Realtime channel: `postgres_changes` on `orders` table filtered by `restaurant_id`
- ServiceWorker in `apps/dashboard/public/sw.js` for Web Notification API
- No new DB migration needed

---

### Sprint 1 — Monorepo Foundation ✅

**Completed 2026-05-17**

- Turborepo v2 workspace with pnpm (apps: dashboard:3000, menu:3001, kitchen:3002)
- Packages: ui, design-engine, db, ai, qr — all typecheck clean
- Supabase schema: 6 tables + RLS + soft deletes (migration 20260517000000)
- TypeScript types generated to `packages/db/src/types.gen.ts`
- design-engine: ThemeTokens type + generateThemeCSS() + 8 templates (noir, mercato, bento, beachside, steakhouse, fast, mezze, minimal)
- Tailwind v4 wired via `@theme {}` in each app's globals.css; design-engine CSS vars override at runtime via injected `<style>` tag
- dnd-kit + Framer Motion installed in dashboard

**Next:** Theme builder UI, drag-and-drop menu editor, Supabase auth setup

---

### Sprint 2 — Customer Menu App ✅

**Completed 2026-05-17**

**Route structure**

- `apps/menu/app/[slug]/layout.tsx` — server component: fetches theme_config, calls `generateThemeCSS()`, injects `<style>` + Google Fonts `<link>` tags (React 19 hoists both to `<head>`)
- `apps/menu/app/[slug]/page.tsx` — server component: fetches restaurant, categories, items in parallel; passes to `MenuPageClient`
- `apps/menu/app/[slug]/MenuPageClient.tsx` — `'use client'`: wires Zustand stores to all UI components
- `apps/menu/app/[slug]/table/[tableId]/page.tsx` — same as slug page + sets `tableId` on cart store
- `apps/menu/app/api/orders/route.ts` — `POST /api/orders` with Zod validation; delegates insert to `packages/db/src/orders.ts`

**UI components (packages/ui/src/menu/)**

- `Header` — logo, name, cart badge; 3 styles: minimal/hero/centered
- `CategoryNav` — horizontal scroll tabs or pills; IntersectionObserver tracks active section; smooth scroll
- `ProductCard` — vertical/horizontal layout; image, price, modifier badge; click opens modal or adds direct
- `ProductModal` — Framer Motion bottom sheet; required (radio) / optional (checkbox) modifier groups; qty stepper; disabled Add until required groups satisfied
- `CartDrawer` — Framer Motion slide (bottom or right); qty controls; Place Order button
- `OrderConfirmation` — animated success screen; subscribes to Supabase Realtime for status updates

**State**

- `useCartStore` — Zustand + persist; sessionId auto-generated with `crypto.randomUUID()`, survives page reload
- `useOrderStore` — order id + status + isPlacing

**Fixes applied**

- `exactOptionalPropertyTypes: false` in `apps/menu/tsconfig.json` — Supabase v2 types incompatible with this flag
- `createOrder()` helper in `packages/db/src/orders.ts` encapsulates the cross-package insert type workaround
- `OrderStatus` + `RestaurantPlan` exported from `@garsonless/db`

**Next:** Kitchen Display System, Supabase auth in dashboard, theme builder drag-and-drop UI

### Modüler monolith — Atomic single-order checkout & reconciliation ✅ (2026-07-16)

- Tek-order checkout `20260716090000_atomic_order_checkout_and_reconciliation.sql`
  ile DB lease + immutable provider token modeline taşındı. Paralel başlangıçta
  yalnız bir request kazanır; yanlış lease, token replacement ve token-bound
  release reddedilir.
- Provider-success/local-settlement hataları idempotent reconciliation queue +
  claim/backoff/dead-letter üzerinden mevcut order/share settlement command'leriyle
  yeniden işlenir. Mapping-missing raw token saklamadan otomatik çözülmez ve
  görünür operasyon olayı olarak kalır.
- DEV runtime: 1 winner/1 reject, duplicate event tek UUID, iki worker toplam
  1 claim/1 resolve, anon RPC `42501`, cleanup 0. Migration PROD-at-deploy'dur.
- Cron entegrasyonu için Edge secret'ında
  `PAYMENT_RECONCILIATION_URL=https://<menu>/api/internal/payment-reconciliation`
  ve menu deployment'ında ortak `OUTBOX_WORKER_SECRET` kurulmalıdır.

### Modüler monolith — Theme editor view decomposition ✅ (2026-07-17)

- `ThemeEditorClient` içindeki sol navigasyon ve sayfa-akışı render yükü
  `ThemeEditorSidebar` bileşenine çıkarıldı; ana dosya state/command
  orkestratörü olarak kaldı.
- Şablon ve bölüm seçici modallar `ThemeEditorDialogs` sınırına taşındı.
  Modal layout, focus trap, template kart metinleri ve plan rozetleri view
  katmanında; açık/kapalı state ve seçim command'leri orchestrator'da kaldı.
- Şablon telefon çizimleri ile bölüm mini-preview kataloğu
  `ThemeEditorPreviewCatalog` salt-render view modülüne ayrıldı. Bu modül state,
  effect, action veya seçim command'i taşımaz; yalnız typed tema/id girdisini
  görsele projekte eder.
- Bölüm kütüphanesi, grup listesi, yiyecek ikon seçenekleri ve bölüm ayar şeması
  `theme-editor-section-registry` saf veri kataloğuna taşındı. Registry JSX/UI
  runtime'ı taşımaz; ikonları typed anahtar olarak saklar ve dialog view'ı bu
  anahtarları gerçek ikon bileşenlerine çözer.
- Page-flow sıralama ve kategori-scope kuralları mevcut saf
  `theme-page-flow-model` üzerinden çalışmaya devam ediyor; persistence veya
  kullanıcı davranışı değişmedi.
- `theme-editor-architecture.test.ts` sınırın yeniden birleşmesini, ortak model
  kullanımını, dialog erişilebilirliğini, preview kataloğunun render-only ve
  section registry'nin saf veri kalmasını, ayrıca 1.400 satır orchestrator
  bütçesini denetliyor. Registry bütünlük testleri benzersiz section/icon
  değerleri, geçerli grup bağlantıları, editor tab'ları ve yinelenmeyen field
  key'lerini koruyor. `ThemeEditorClient` 3.011 satırdan 1.379 satıra indi. Tema
  model + mimari test matrisi 34/34, dashboard typecheck/lint ve production
  build temiz geçti.
- Draft override üretimi, 25 adımlık undo/redo geçmişi, dirty-state ve
  navigation guard, preview bridge senkronizasyonu ve publish yarış kontrolü
  `use-theme-editor-lifecycle` controller hook'una taşındı. Saf
  `theme-editor-lifecycle-model` başlangıç patch'i, bounded history ve kayıtlı
  baseline'a göre değişiklik etiketlerini test ediyor. `ThemeEditorClient` bu
  dilimde 1.379 satırdan 1.233 satıra indi; lifecycle state/action sahipliği
  kaynak-seviye fitness testiyle tekrar orchestrator'a sızmaya karşı korunuyor.
- Preview çalışma alanının responsive eşikleri, panel genişlikleri ve zoom/sığdır
  kuralları `theme-editor-workspace-model` saf projection'ına; viewport/mode/
  scale yaşam döngüsü `use-theme-editor-workspace` controller hook'una taşındı.
  Cihaz çerçevesi, preview toolbar'ı ve iframe yüzeyi `ThemeEditorCanvas`
  salt-props view sınırındadır. `ThemeEditorClient` **1.233 → 1.036 satıra**
  indi; Theme model + mimari matrisi **43/43** ve yeni orchestrator bütçesi
  **1.050 satırdır**. Publish/preview mesaj sözleşmesi, migration ve tenant
  verisi değişmedi.
- Sağ property workspace'in frame, renderer seçimi, bölüm ayarları, empty-state
  ve marka rengi kompozisyonu `ThemeEditorPropertiesWorkspace` salt-props view
  sınırına taşındı. View ham `restaurantId`, action veya Supabase client taşımaz;
  galeri ve logo feature yüzeyleri dışarıdan node/callback olarak bağlanır.
- Logo upload/remove action ve yükleme state'i `use-theme-editor-logo` controller
  hook'una, erişilebilir dosya seçici/önizleme yüzeyi `ThemeLogoUploadCard` view'ına
  ayrıldı. Ana orchestrator artık restaurant logo action'larını import etmez.
  `ThemeEditorClient` **1.036 → 719 satıra**, başlangıçtaki 4.980 satırdan toplam
  **%85,6** küçülmeye indi. Theme matrisi **45/45**, orchestrator bütçesi
  **750 satırdır**. Tema persistence ve tenant sözleşmesi değişmedi.
- Grup/bölüm seçimi, editor tab state'i, template/section dialog yaşam döngüsü,
  arama projection'ları, bölüm ekleme/çıkarma, günlük özel expiry kontrolü ve
  page-flow drag/klavye command'leri `use-theme-editor-navigation` controller
  hook'una taşındı. Controller sıralama invariant'larını kopyalamaz;
  `theme-page-flow-model` saf kurallarını çağırır ve action/Supabase bağımlılığı
  taşımaz. `ThemeEditorClient` **719 → 516 satıra**, başlangıçtaki 4.980
  satırdan toplam **%89,6** küçülmeye indi; yeni fitness bütçesi **550 satırdır**.
  Theme model + mimari matrisi **46/46**, workspace typecheck **10/10**, lint
  **0 error** (marketing'deki mevcut 2 `img` warning) ve dashboard production
  build temiz geçti. Migration veya tenant verisi değişmedi.
- Property panel copy/reset akışı `use-theme-editor-property-commands`
  controller'ına; clipboard ve reset patch projeksiyonları saf
  `theme-editor-property-command-model` modülüne taşındı. Kayıt durum metni/renk
  projeksiyonu `theme-editor-shell-model`, erişilebilir toast markup'ı
  `ThemeEditorToast`, sidebar grup/ikon kataloğu ise
  `theme-editor-navigation-catalog` sınırındadır. `ThemeEditorClient`
  **516 → 388 satıra** indi; yeni fitness bütçesi **420 satırdır**. Saf command
  ve shell model testleriyle birlikte Theme matrisi **54/54** oldu; workspace
  typecheck **10/10**, lint **0 error** (marketing'deki mevcut 2 `img` warning)
  ve dashboard production build temiz geçti. Persistence, migration ve tenant
  verisi değişmedi.
- Kök editör yerleşimi ve ortak interaction CSS'i `ThemeEditorShell` view'ına,
  template/section modal kompozisyonu `ThemeEditorDialogsLayer` sınırına
  taşındı. Preview temasının defaults + override birleşimi, legacy page-block
  normalizasyonu ve geçersiz section temizliği React'ten bağımsız
  `theme-editor-preview-theme-model` içinde tek projection olarak test edilir.
  `ThemeEditorClient` **388 → 307 satıra**, başlangıçtaki 4.980 satırdan toplam
  **%93,8** küçülmeye indi; fitness bütçesi **330 satıra** sıkılaştırıldı. Theme
  model + mimari matrisi **57/57**, workspace typecheck **10/10**, lint
  **0 error** (marketing'deki mevcut 2 `img` warning) ve dashboard production
  build temiz geçti. Persistence, migration ve tenant verisi değişmedi.
- Local runtime'da login route'u 200, korumalı theme route'u 307 → login verdi.
  Authenticated storage state/fixture bulunmadığı için dialogların gerçek
  tarayıcı etkileşimi sonraki yetkili smoke turunda tekrar doğrulanmalıdır.

### Büyük client shell ayrıştırma — Analytics lifecycle/chrome dilimi ✅ (2026-07-17)

- Rapor/range seçimi, lazy server-action yükleme, loaded/error/pending state'i ve
  owner-only Operasyon koruması `use-analytics-reports` controller'ına taşındı.
  Hızlı sekme veya dönem değişiminde eski async yanıtın yeni state'i ezmemesi
  için latest-request-wins uzlaştırması eklendi.
- Report metadata, dönem etiketleri, ilk loaded projection'ı ve export
  readiness kuralları browser-safe `analytics-report-model` içinde tek
  kaynaktır. Topbar, erişilebilir dönem seçici, owner'a göre filtrelenen sol
  navigasyon, retry/loading yüzeyi `AnalyticsReportShell` salt-props view'ına
  ayrıldı.
- CSV serialization/download `analytics-report-export` sınırına taşındı;
  kullanıcı kontrollü ürün, masa, e-posta ve gerekçe değerleri spreadsheet
  formül enjeksiyonuna karşı bağımsız test edilir. Rapor sorgusu, tahsilat/ikram
  semantiği ve endpoint sözleşmesi değişmedi.
- `AnalyticsClient` **1.403 → 1.050 satıra** indi; **1.080 satır** fitness
  bütçesiyle kilitlendi. Yeni model/export/mimari matrisi **11/11**, workspace
  typecheck **10/10**, lint **0 error** (marketing'deki mevcut 2 `img` warning)
  ve dashboard production build temiz geçti. Migration veya tenant verisi
  değişmedi.

### Büyük client shell ayrıştırma — Analytics satış/ödeme view dilimi ✅ (2026-07-17)

- Satış KPI'ları, tahsilat trendi, saat×gün heatmap'i, ödeme donut'ı ve en çok
  satan ürünler; Ödemeler raporunun tahsilat/ikram KPI ve yöntem kırılımıyla
  birlikte `AnalyticsSalesPaymentReports` feature view'ına taşındı. Feature
  yalnız typed query projection'ları alır; server action, tenant kimliği veya
  Supabase erişimi taşımaz.
- Ortak KPI ve rapor kartı markup'ı `AnalyticsReportPrimitives` salt-props
  sınırına ayrıldı. Operasyon, Ürünler, Masalar ve Sadakat mevcut görsel
  sözleşmeyi aynı primitive'ler üzerinden kullanmaya devam eder; ikram yine
  collected taban/donut dışında kalır.
- `AnalyticsClient` **1.050 → 790 satıra**, başlangıçtaki 1.403 satırdan toplam
  **%43,7** küçülmeye indi; fitness bütçesi **820 satıra** sıkılaştırıldı.
  Analytics model/export/mimari matrisi **13/13**, workspace typecheck
  **10/10**, lint **0 error** (marketing'deki mevcut 2 `img` warning) ve
  dashboard production build temiz geçti. Migration veya tenant verisi
  değişmedi.

### Büyük client shell ayrıştırma — Analytics operasyon view dilimi ✅ (2026-07-17)

- Owner-only iptal, anormal kapatma ve personel tahsilat rapor ailesi
  `AnalyticsOperationsReport` feature view'ına taşındı. Feature yalnız typed
  query projection'larını alır; owner görünürlüğü controller'da, gerçek yetki
  kapısı server query sınırında kalır. View server action, tenant kimliği veya
  Supabase erişimi taşımaz.
- Audit KPI delta yönü/tonu, dönem içi iptal trendi compaction'ı ve sistem
  tahsilatını personel toplamından çıkarma kuralı browser-safe
  `analytics-operations-model` içinde tek kaynaktır. Bu para/personel denetim
  kuralları React'ten bağımsız boundary testleriyle korunur.
- `AnalyticsClient` **790 → 505 satıra**, başlangıçtaki 1.403 satırdan toplam
  **%64,0** küçülmeye indi; fitness bütçesi **535 satıra** sıkılaştırıldı.
  Analytics model/export/mimari matrisi **18/18**, workspace typecheck
  **10/10**, lint **0 error** (marketing'deki mevcut 2 `img` warning) ve
  dashboard production build temiz geçti. Migration, endpoint, persistence
  veya tenant verisi değişmedi.

### Büyük client shell ayrıştırma — Analytics ürün view dilimi ✅ (2026-07-18)

- Ürün KPI'ları, ABC tahsilat analizi, ürün karması scatter'ı ve
  yükselen/düşen ürün listeleri `AnalyticsItemsReport` feature view'ına
  taşındı. Scatter chart'ın `ssr:false` lazy-loading ve sabit yükseklik
  rezervasyonu feature sınırında korunur; view action, tenant kimliği veya
  Supabase erişimi taşımaz.
- Toplam tahsilat/adet ve A/B/C sınıf toplamları tek geçişli
  `projectProductReport`, hareket listeleri `selectProductMovers`, delta etiketi
  `formatProductDelta` ile browser-safe `analytics-items-model` içinde tek
  kaynaktır. Projection input dizisini mutasyona uğratmaz.
- `AnalyticsClient` **505 → 307 satıra**, başlangıçtaki 1.403 satırdan toplam
  **%78,1** küçülmeye indi; fitness bütçesi **335 satıra** sıkılaştırıldı.
  Analytics model/export/mimari matrisi **23/23**, workspace typecheck
  **10/10**, lint **0 error** (marketing'deki mevcut 2 `img` warning) ve
  dashboard production build temiz geçti. Migration, endpoint, persistence
  veya tenant verisi değişmedi.

### Büyük client shell ayrıştırma — Analytics masalar view dilimi ✅ (2026-07-18)

- Masa raporunun boş durumu, tahsilat/devir KPI'ları ve masa sıralama çubukları
  `AnalyticsTablesReport` feature view'ına taşındı. View yalnız typed
  `TableReportRow` projection'ı alır; action, tenant kimliği veya Supabase
  erişimi taşımaz.
- Tahsilata göre immutable sıralama, ödemeli sipariş, aktif/açık masa ayrımı,
  kapanan oturum devri, aktif masa başı tahsilat ve devir-ağırlıklı ortalama
  süre `analytics-tables-model` içinde tek projection'dır. Açık oturumlar devir
  veya süre hesabına katılmaz; işletme saatleri olmadan doluluk yüzdesi
  üretilmez.
- `AnalyticsClient` **307 → 218 satıra**, başlangıçtaki 1.403 satırdan toplam
  **%84,5** küçülmeye indi; fitness bütçesi **245 satıra** sıkılaştırıldı.
  Analytics model/export/mimari matrisi **28/28**, workspace typecheck
  **10/10**, lint **0 error** (marketing'deki mevcut 2 `img` warning) ve
  dashboard production build temiz geçti. Migration, endpoint, persistence
  veya tenant verisi değişmedi.

### Büyük client shell ayrıştırma — Analytics sadakat view dilimi ✅ (2026-07-18)

- Sadakat boş durumu, damga/bonus/iade özetleri, ikram hareketi ve ledger
  geçmişi `AnalyticsLoyaltyReport` feature view'ına taşındı. View yalnız typed
  `LoyaltyReport` verisi alır; action, tenant kimliği veya Supabase erişimi
  taşımaz.
- Görünürlük ve stat kartı projection'ı `projectLoyaltyReport`, bilinen
  redemption reason çevirisi ile bilinmeyen ledger reason'ını ham koruma
  politikası `resolveLoyaltyReasonLabel` üzerinden browser-safe
  `analytics-loyalty-model` içinde tek kaynaktır. İkram hareketi tahsilata
  dahil edilmeden açıkça gösterilir.
- `AnalyticsClient` **218 → 109 satıra**, başlangıçtaki 1.403 satırdan toplam
  **%92,2** küçülmeye indi; fitness bütçesi **130 satıra** sıkılaştırıldı.
  Analytics model/export/mimari matrisi **34/34**, workspace typecheck
  **10/10**, lint **0 error** (marketing'deki mevcut 2 `img` warning) ve
  dashboard production build temiz geçti. Migration, endpoint, persistence
  veya tenant verisi değişmedi.
### Merkezi hata sözleşmesi ve kurtarma ekranları ✅ (2026-07-20)

- `@garsonless/domain/errors` artık action hataları için sabit public destek kodları (`MAS-…`), güvenli kullanıcı metni ve retry semantiği taşıyor; server adapter dışındaki hiçbir katman provider/SQL hatası görmüyor.
- Dashboard sipariş command’leri (`create`, `update-status`, `cancel`, `history`) label’lı hata zarfına geçti. Özel hata nedeni yalnız server logunda `DASH-…` referansıyla kalıyor; mevcut `{ error }` tüketicileri geriye uyumlu.
- Dashboard, Menü ve Mutfak için modern, retry/home aksiyonlu `error.tsx`, `global-error.tsx` ve `not-found.tsx` sınırları `RecoveryScreen` üzerinden eklendi.

### SaaS paket/entitlement kataloğu ✅ (2026-07-20)

- `@garsonless/domain/entitlements` artık tek plan kaynağıdır: `free → starter → pro → enterprise`; eski marketing `business` ifadesi yalnız normalize edilir, bilinmeyen plan fail-closed olarak `free` davranır.
- QR/menu/sipariş, tablo, rapor, tema, bildirim, KDS, sadakat, API/webhook/SSO gibi capability’ler ve tablo/şube/ekip üyesi limitleri browser-safe saf modelde testli tanımlıdır. `@garsonless/db` `RestaurantPlan` tipini bu canonical tanımdan alır.
- İlk gerçek enforcement noktası tema yayınlamadır: Pro bölüm ID’leri hem editörde kilitlenir hem `publishRestaurantTheme` command’i tarafından plan kontrolüyle reddedilir. Tablo ekleme `create_table_with_plan_limit` RPC’sinde restaurant-row lock ile cap kontrolü + insert atomik olacak şekilde taşındı ve migration DEV’e uygulandı; geçici tenant runtime doğrulaması Free plan için `3 created + 1 plan_limit` sonucunu verdi ve temizlendi.
- Mutfak ekranı ikinci gerçek capability gate’idir: credential üretimi owner + `kitchen_display` (Pro) kontrolünden geçer; launch ticket, ticket exchange ve her KDS session doğrulaması restaurant planını yeniden okur. Böylece downgrade yeni bileti reddeder ve açık KDS oturumunu anında geçersiz kılar. DEV runtime matrisi Pro açılış/replay/rotation ile Starter downgrade’ini doğruladı; temp restaurant, credential ve launch receipt satırları sıfır orphan ile temizlendi.
- Sadakat üçüncü gerçek capability gate’idir: puan/damga scope ve bakiye okumaları, hoş geldin bonusu, sipariş kazanımı, ziyaret kredisi, indirim hesaplama ve redemption çağrısı service-role sınırında `loyalty` (Pro) yetkisini yeniden kontrol eder. Paket düşüşünde saklanan JSONB ayarları değer üretmez; dashboard ayar ekranı da kilitlenir. DEV runtime matrisi Starter’da `scope/balance=false`, `0 ledger`, `0 indirim`; aynı tenant Pro’ya yükselince `25 puan`, `10 puan redemption`, `₺99` final sonucu verdi; temp restaurant/customer sıfır orphan ile temizlendi.
- Gelişmiş analitik dördüncü capability gate’idir: Free/Starter temel Satışlar, Ürünler, Masalar ve Ödemeler raporlarını kullanır; owner-only Operasyon ve Sadakat raporları `analytics_advanced` (Pro) ister. UI bu sekmeleri göstermese bile server action paketi tekrar okur ve replay çağrısına veri yerine güvenli plan hatası döner. Browser-safe görünürlük modeli test edildi; dashboard typecheck/lint/production build temiz geçti.
- Tarayıcı bildirimi beşinci capability gate’idir: uygulama içi sipariş/garson çağrısı zili bütün paketlerde temel operasyon yüzeyi olarak kalır; yalnız işletim sistemi Web Notification kanalı `browser_notifications` (Starter+) ister. Ayar UI'ı Free planda kontrolü kapatır, server action replay isteğinde planı yeniden okur ve `MAS-PLAN-403` zarfıyla reddeder. Service worker yalnız entitlement + tercih birlikte açıkken kurulur; sipariş başına tenant-scope session receipt aynı realtime olayının yeniden bağlantı veya React effect tekrarında ses/push üretmesini engeller. Bildirim feed'i artık sorgu hatasını sessiz boş durum gibi göstermeyip `MAS-SVC-503` kodu ve yeniden-dene yüzeyi sunar.

### Faz 5.1 — SaaS billing foundation ✅ (2026-07-22)

- SaaS abonelik tahsilatı, restoranların müşteri sipariş ödemelerinden ayrı bir
  bounded context olarak başlatıldı. `@garsonless/domain/billing` TRY minor-unit
  para tipi, lifecycle/invoice/attempt sözlükleri, fail-closed state geçişleri
  ve DB'den yüklenen dunning politikasının sıralama invariant'larını taşır.
- `@garsonless/application/billing` provider bağımsız
  `SubscriptionBillingProvider` portunu ve doğrulanmış webhook event sınırını
  tanımlar. Platform billing secret'ları veya tenant `payment_credentials`
  verisi bu sözleşmenin girdisi değildir; ham webhook payload saklanmaz.
- `20260722010000_saas_billing_foundation.sql` service-role-only billing
  customer/subscription/invoice/payment-attempt/provider-event/reconciliation/
  dunning/lifecycle tablolarını hazırlar. Para bigint minor-unit'tir; provider
  event ve ödeme tekrarları idempotency anahtarlarıyla sınırlandırılır; lifecycle
  audit tablosu append-only grant alır.
- Composite foreign key'ler billing customer → subscription → invoice → attempt
  zincirinde farklı tenant kimliklerinin yanlışlıkla birleştirilmesini DB
  seviyesinde reddeder. Provider projection'ları allowlist/redacted isimli ve
  64 KiB ile sınırlı JSON object olarak saklanır.
- Billing outbox aggregate/event sözlüğü ayrıldı; bu dilim event üretmez.
  Invoice/payment state + outbox atomik RPC'leri Faz 5.2 kapsamındadır. Mevcut
  tenant'lara subscription/backfill veya plan değişikliği yapılmaz.
- Statik doğrulama temiz: domain **48/48**, application **100/100**, DB
  **133/133**; üç paketin lint'i ve 10 workspace projesinin typecheck'i geçti.
  Migration linked DEV'e uygulandı ve `types.gen.ts` yenilendi.
- Gerçek DEV runtime matrisi: service-role varsayılan politikayı okudu;
  anon/authenticated roller **9/9** billing tablosunda `42501` aldı; cross-tenant
  customer ve invoice kompozisyonu `23503`, ikinci canlı subscription, invoice/
  attempt/provider-event replay ve ikinci dunning coordinator `23505` ile
  reddedildi. TRY `14990` minor-unit olarak aynen saklandı. İki geçici tenant ve
  tüm billing tabloları test sonunda **0 orphan** ile temizlendi.

### Faz 5.2 — Atomik invoice/payment geçişleri + billing outbox ✅ (2026-07-22)

- Zamanlanmış fatura üretimi için doğrulanmış `platform-billing`, provider
  callback'leri için mevcut `payment-provider` actor context'i kullanılıyor.
  `@garsonless/application/billing` tenant/context, TRY safe-integer, dönem,
  timestamp ve idempotency girdilerini persistence'a ulaşmadan doğruluyor.
- `create_subscription_invoice_atomic`,
  `record_subscription_payment_failure_atomic` ve
  `record_subscription_payment_success_atomic` service-role-only RPC'leri
  aggregate satırlarını `FOR UPDATE` ile kilitliyor. Invoice/payment mutation,
  append-only lifecycle audit, dunning coordinator ve `domain_outbox` event'i
  tek PostgreSQL transaction'ında commit oluyor.
- Invoice oluşturma replay'i tek satır ve tek `invoice.created` üretir; aynı
  anahtarın farklı immutable payload ile kullanımı fail-closed reddedilir.
  Failure aktif aboneliği `past_due` yapıp policy snapshot'lı tek dunning run
  planlar. Geç gelen failure, paid invoice'ı geriye düşürmez.
- Ödeme tarafında partial unique index invoice başına yalnız bir başarılı
  attempt'e izin verir. İlk success invoice'ı paid, dunning'i stopped,
  subscription/`restaurants.plan` entitlement projection'ını active yapar;
  provider callback'i `manual_hold` veya terminal `cancelled` durumunu açamaz.
  Yalnız gerçekten suspended durumdan dönen tenant için `tenant.reactivated`
  event'i üretilir.
- Service-role Supabase client uygulamalara sızmadı;
  `createSubscriptionBillingPersistencePort` typed RPC sonucunu fail-closed
  doğrulayan `@garsonless/db/server` adapter'ıdır. Ham webhook body migration,
  port veya outbox payload'ına girmez.
- Migration `20260722020000_saas_billing_atomic_transitions.sql` linked DEV'e
  uygulandı ve generated tipler yenilendi. Statik doğrulama: domain **48/48**,
  application **103/103**, DB **141/141**, workspace typecheck **10/10**.
- Gerçek DEV runtime matrisi throwaway tenant'larla geçti: anon RPC `42501`;
  create/replay tek invoice+outbox; failure `past_due` + tek attempt + tek
  dunning; success `paid` + `active` + Pro projection + stopped dunning;
  success sonrası late-failure no-regression; paid callback `manual_hold` ve
  Free entitlement projection'ını açmadı. Outbox/lifecycle/dunning/event/
  attempt/invoice/subscription/customer/restaurant temizliği **0 orphan**.
- PROD migration uygulanmadı. Provider webhook HTTP adapter'ı ve gerçek iyzico
  adapter'ı sonraki dilimdir; bu faz yalnız provider-bağımsız atomik çekirdeği
  hazırlar.

### Faz 5.3 — İyzico subscription webhook + durable inbox ✅ (2026-07-22)

- Dashboard'a node-runtime `POST /api/billing/iyzico/webhook` eklendi. Route
  body'yi JSON'a çevirmeden önce raw byte olarak alır, 64 KiB sınırı uygular ve
  yalnız `X-IYZ-SIGNATURE-V3` doğrulamasından sonra service-role persistence'a
  geçer. Hata yanıtları provider/SQL ayrıntısı veya referans sızdırmaz.
- `iyzico-subscription-webhook` adapter'ı resmi subscription imza bileşimini
  HMAC-SHA256 + constant-time karşılaştırmayla doğrular; yalnız success/failure
  order event'lerini kabul eder, gelecek timestamp ve hatalı/uzun referansları
  fail-closed reddeder. SaaS secret'ları yalnız ayrı
  `IYZICO_BILLING_MERCHANT_ID` / `IYZICO_BILLING_SECRET_KEY` env'lerinden gelir;
  tenant sipariş ödemelerindeki generic `IYZICO_*` fallback kullanılmaz.
- İyzico subscription webhook'u tutar taşımadığı için provider payload'ından
  para okunmaz. `processSubscriptionBillingWebhook`, imzalı customer/
  subscription/order referansını DB'de tek tenant ve invoice'a çözer; Faz 5.2
  success/failure RPC'sine **kilitli yerel invoice `amount_due_minor`** değerini
  gönderir.
- `20260722030000_saas_billing_provider_inbox.sql` event'i allowlisted/redacted
  projection + SHA-256 hash ile idempotent inbox'a yazar. Aynı provider event
  id'sinin değiştirilmiş payload ile tekrarı conflict olur. Eşleşmeyen customer,
  subscription/invoice veya cross-tenant referans para durumunu değiştirmez;
  durable `billing_reconciliation_jobs` kaydı açar. Dispatch hatası backoff ile
  failed/dead-letter yoluna alınır; ham webhook body hiçbir tabloya yazılmaz.
- Migration linked DEV'e uygulandı, local/remote `20260722030000` eşleşti ve
  generated tipler yenilendi. Statik doğrulama: application **106/106**, DB
  **147/147**, dashboard architecture **167/167**, workspace typecheck
  **10/10**, ilgili üç paketin lint'i ve dashboard production build temiz.
- Gerçek DEV runtime (throwaway tenant, Test Cafe B yalnız owner fixture read):
  anon inbox RPC `42501`; invalid signature **0 provider-event**; signed success
  yerel **₺149,90** ile tek attempt; replay duplicate; signed failure yerel
  **₺99,90** ile `past_due` + tek dunning; unmapped ve cross-tenant eventler
  yalnız reconciliation; değiştirilmiş replay idempotency conflict. Event/job/
  geçici tenant temizliği **0 orphan**.
- PROD migration uygulanmadı. Gerçek İyzico hesabından webhook teslimi, merchant
  panelinde V3 özelliğinin açılması ve platform checkout/customer/retry/cancel
  API adapter'ları sonraki dilimdedir; bu faz provider'ın signed ingestion
  yüzeyini ve atomik dispatch zincirini tamamlar.

### Faz 5.4a — İyzico subscription capability adapter ✅ (2026-07-22)

- `SubscriptionBillingProvider` gerçek İyzico subscription yeteneklerine göre
  düzeltildi: hosted checkout müşteri profili + callback alır ve token/form
  içeriği döndürür; callback sonucu token ile ayrıca retrieve edilir; retry
  failure webhook'undaki order reference ile yapılır; cancel anlıktır.
- Dashboard server adapter'ı customer/create-checkout/retrieve/retry/cancel
  çağrılarını tek platform sınırında toplar. Timeout, allowlisted API origin,
  referans uzunluğu, HTTPS callback ve checkout form boyutu fail-closed
  doğrulanır; provider'ın serbest hata mesajı uygulama/UI'a taşınmaz.
- SaaS anahtarları yalnız açık `IYZICO_BILLING_*` env'lerinden okunur. Tenant
  sipariş ödeme credential'larına veya generic `IYZICO_*` env'lerine fallback
  yoktur. Provider pricing-plan referansı ile lokal TRY minor-unit fiyatı
  eşleşmeden checkout başlatılamaz.
- Webhook route yalnız dar `SubscriptionBillingWebhookVerifier` yeteneğini
  görür; checkout/customer yeteneği signed-ingestion katmanına yanlışlıkla
  verilmez. ADR-0002 hosted checkout, retry ve immediate-cancel gerçekleriyle
  güncellendi.
- Doğrulama temiz: application/dashboard typecheck, dashboard lint, dashboard
  production build ve dashboard architecture **173/173** geçti. Test adapter'ı
  normalize müşteri girdisi, fiyat uyuşmazlığında sıfır provider çağrısı,
  checkout retrieve, retry/cancel ve güvenli hata zarfını kanıtlıyor.
- Bu dilim checkout'u kullanıcıya açmaz. Gerçek VKN/TCKN, telefon ve fatura
  adresi için owner-gated onboarding/persistence; provider operasyon ledger'ı,
  checkout callback route'u ve lokal retry/cancel orchestration Faz 5.4b'dir.
  Platform sandbox API key/plan ref env'leri yerelde tanımlı olmadığı için gerçek
  İyzico ağ çağrısı yapılmadı. PROD'a hiçbir migration/config uygulanmadı.

### Faz 5.4b — Owner-gated billing operasyonları + checkout callback ✅ (2026-07-22)

- Owner-only billing profil kaydı, hosted checkout başlatma/tamamlama, başarısız
  fatura retry ve abonelik iptali `@garsonless/application/billing` command
  sınırına alındı. Ham `restaurantId` veya client fiyatı güvenilir kabul
  edilmiyor; dashboard action'ları önce `assertOwner` çalıştırıyor, TRY fiyatını
  yalnız server `IYZICO_BILLING_*_AMOUNT_MINOR` konfigürasyonundan çözüyor.
- `20260722040000_saas_billing_provider_operations.sql`, zorunlu fatura profili
  alanlarını ve outbound provider çağrıları için durable
  `billing_provider_operations` ledger'ını ekliyor. Checkout/retry/cancel
  idempotency anahtarları immutable request fingerprint'iyle eşleştiriliyor;
  replay provider'a ikinci kez gitmiyor. Provider başarılı olup lokal ledger
  finalize edilemezse işlem başarı sayılmayıp `requires_reconciliation`
  durumuna alınıyor.
- Node-runtime checkout callback route'u yalnız 8 KiB URL-encoded body ve kısa
  token kabul ediyor. Ham token idempotency anahtarına yazılmıyor; SHA-256 hash
  kullanılıyor. Retrieve sonucu provider customer/subscription referanslarını,
  `subscription.search` sonucu ilgili provider order/dönem referansını lokal
  kayda eşliyor. Callback ödeme başarısı sayılmıyor; entitlement yalnız imzalı
  payment webhook'uyla açılıyor.
- İptal anlık provider semantiğiyle çalışıyor; başarılı lokal finalizasyon
  subscription'ı `cancelled`, tenant plan projection'ını `free` yapıp lifecycle
  ve outbox kaydını aynı transaction'da yazıyor. Retry yalnız doğrulanmış
  failure webhook'undan saklanan provider order reference ile çağrılıyor.
- Statik doğrulama temiz: application **111/111**, DB **152/152**, dashboard
  architecture **179/179**, workspace typecheck **10/10**, ilgili lint'ler,
  `git diff --check` ve dashboard production build geçti.
- Migration linked DEV'e Faz 5 kapanışında uygulandı; PROD'a uygulanmadı.
  Gerçek İyzico sandbox anahtarları yerelde tanımlı olmadığı için gerçek sağlayıcı
  ağ çağrısı yapılmadı. Owner/member/cross-tenant, callback, retry/cancel ve
  reconciliation/dunning zinciri DEV runtime matrisinde provider test-double ile
  doğrulandı.

### Faz 5.5 — Owner billing settings + tenant-scope projection ✅ (2026-07-22)

- Ayarlar → Faturalama artık placeholder değildir. Yalnız doğrulanmış tenant
  owner'ı mevcut plan/dönem/durum özetini, zorunlu fatura profilini ve son 12
  abonelik faturasını görür; profil kaydı, hosted checkout, uygun gecikmiş
  faturayı retry ve aboneliği anlık iptal komutları Faz 5.4b action sınırlarına
  bağlanmıştır. Settings yetkili normal ekip üyesi bu bölümü navigasyonda
  görmez; doğrudan query ile açma denemesi de owner görünürlüğünü aşamaz.
- `readSubscriptionBillingSettings` trusted `DashboardActorContext` ve aynı
  `restaurantId` olmadan DB portunu çağırmaz. Service-role-only
  `read_subscription_billing_settings(uuid)` RPC'si profile/subscription/
  invoice/attention projection'ını tenant filtresiyle döndürür; provider
  customer/subscription/invoice referansları, ham provider payload'ı, internal
  hata metni ve ödeme credential'ları sözleşmeye dahil değildir.
- Provider checkout formu dashboard DOM'una HTML enjekte edilmez. İyzico'nun
  hosted form içeriği `srcDoc` iframe'de `allow-same-origin` olmadan, dar sandbox
  yetkileri ve `no-referrer` politikasıyla gösterilir. Callback başarı dönüşü
  owner'ı yeniden Faturalama bölümüne getirir; entitlement yine yalnız imzalı
  payment webhook'uyla açılır.
- Billing projection'ı Result olarak hata verirse diğer settings bölümleri
  çalışmaya devam eder; UI provider/SQL ayrıntısı yerine `MAS-SVC-503` ve
  yeniden-dene yüzeyi gösterir. Server plan fiyatı public UI'a yalnız pozitif
  integer TRY minor-unit olarak aktarılır; API secret ve provider plan ref'i
  client projection'ına girmez.
- Statik doğrulama temiz: application **112/112**, DB **156/156**, dashboard
  architecture **183/183**, workspace typecheck **10/10**, application/DB/
  dashboard lint, `git diff --check` öncesi production dashboard build temiz.
- Migration `20260722050000_saas_billing_settings_projection.sql`, Faz 5.4b'nin
  `20260722040000` migration'ıyla birlikte linked DEV'e uygulandı; PROD'a
  uygulanmadı. Owner/member/cross-tenant projection ve güvenli reconciliation
  görünürlüğü Faz 5 kapanış runtime matrisinde doğrulandı.

### Faz 5.6 — Leased dunning + reconciliation + zorunlu billing bildirimleri ✅ (2026-07-22)

- `processBillingMaintenanceBatch`, yalnız `platform-billing-worker` context'i
  ile bounded dunning/reconciliation işi claim eder. Retry provider'a gitmeden
  `billing_provider_operations` ledger'ında sabit `dunning:<run>:retry`
  anahtarı + SHA-256 fingerprint ile claim edilir; replay başarılı/belirsiz
  operasyonda ikinci provider çağrısı üretmez. Retry kabulü ödeme başarısı
  değildir; yalnız imzalı payment webhook invoice'ı paid ve tenant'ı active
  yapabilir.
- `20260722060000_saas_billing_maintenance.sql`, `FOR UPDATE SKIP LOCKED`,
  lease ownership ve bounded backoff ile retry → +3 → +7 → suspend durum
  makinesini ekler. Paid/cancelled/manual-hold aggregate işi durdurur; final
  uyarı grace-period'a, +14 gün ise tenant lifecycle/outbox ile atomik suspend
  ve Free entitlement projection'ına geçer.
- Provider başarısı/lokal finalize belirsizliği aynı transaction'da durable
  `billing_reconciliation_jobs` kaydı üretir. Crash sonrası 15 dakika
  `processing`, 24 saat `awaiting_callback` kalan outbound operasyonlar tekrar
  gönderilmeden karantinaya alınır. Reconciliation consumer para durumunu
  tahmin ederek düzeltmez; owner-only `billing.reconciliation_required`
  manual-review olayı üretir.
- Failure, retry, +3/+7 uyarı, reconciliation, paid, suspend ve reactivate
  olayları dashboard inbox + e-posta kanallarında owner-only ve susturulamazdır.
  Bu zorunlu consumer URL'lerinden biri eksikken Edge worker event'i ACK etmez;
  receipt + outbox backoff ile daha sonra tekil teslim eder.
- Dashboard internal maintenance route'u `OUTBOX_WORKER_SECRET` ve sıkı batch
  şemasıyla korunur. Supabase worker her turda opsiyonel
  `BILLING_MAINTENANCE_URL` endpoint'ini 45 saniye timeout ile tetikler.
- Statik doğrulama: application **119/119**, DB **164/164**, domain **48/48**,
  dashboard architecture **184/184**; workspace typecheck **10/10**, ilgili
  lint'ler, `git diff --check` ve dashboard production build temiz geçti.
  Migration linked DEV'e uygulandı; PROD'a uygulanmadı. Gerçek dunning zaman
  çizelgesi, owner/member/cross-tenant, replay-safe retry, reconciliation ve
  temizlik matrisi Faz 5 kapanışında çalıştırıldı.

### Faz 5 kapanış — linked DEV runtime matrisi ✅ (2026-07-22)

- `20260722040000`–`20260722060000` açık onayla linked DEV'e uygulandı. Runtime
  testi, fatura profilinin TypeScript'te kabul edilen `+905…` biçimini DB'de
  reddeden yanlış PostgreSQL regex sözleşmesini buldu. Uygulanmış migration
  değiştirilmedi; forward-only `20260722070000_saas_billing_gsm_contract.sql`
  constraint ve profile RPC regex'ini `^\+?[0-9]{10,15}$` ile düzeltti.
- Owner settings projection'ı aynı belirsiz provider operasyonunu hem operation
  hem reconciliation job olarak iki kez sayıyordu. Forward-only
  `20260722080000_saas_billing_reconciliation_projection.sql`, aktif
  `provider-operation:<id>` işi varsa operation satırını ikinci kez saymayarak
  kullanıcıya tek güvenli inceleme kaydı gösteriyor. `20260722010000`–
  `20260722080000` local/remote linked DEV migration geçmişi eşleşiyor.
- Foundation runtime: anon/authenticated roller billing yüzeylerinde `42501`,
  cross-tenant FK/unique/idempotency korumaları aktif; TRY minor-unit kaybı yok;
  tüm throwaway billing/tenant satırları `0 orphan` ile temizlendi.
- Transition runtime: invoice create/replay tek invoice + outbox; failure
  `past_due` + tek dunning; success `paid` + active plan projection; geç failure
  ve `manual_hold` entitlement'ı geri açmadı; bütün geçici satırlar `0 orphan`.
- Webhook runtime: geçersiz imza `0 provider-event`; imzalı success/failure yerel
  invoice tutarını kullandı; replay duplicate; değiştirilmiş replay conflict;
  unmapped/cross-tenant event yalnız reconciliation açtı; temizlik `0 orphan`.
- Maintenance runtime: service-role-only RPC'ler anon/authenticated rolleri
  `42501` ile reddetti; iki worker yarışında yalnız ilk lease aldı; member ve
  cross-tenant settings/retry fail-closed kaldı; retry replay'i tek provider
  dispatch + tek operation + tek outbox üretti. Warning 3 → warning 7/grace →
  suspend akışı tenant'ı Free projection'a düşürdü; paid invoice dunning'i
  durdurdu; belirsiz provider sonucu yeniden charge edilmeden bir kez
  reconciliation'a taşındı. Zorunlu billing/system eventleri yalnız owner
  inbox'ına bir kez ulaştı ve settings tam bir güvenli inceleme kaydı gösterdi.
  Ayrı cleanup sorgusunda `bill-maint-%` throwaway tenant sayısı `0` bulundu.
- Kapanış statik kapıları: DB **164/164**, application **119/119**, domain
  **48/48**, dashboard architecture **184/184**; workspace typecheck **10/10**,
  DB/application/domain/dashboard lint ve dashboard production build temiz.
- Lokal ortamda `IYZICO_BILLING_*`, `BILLING_MAINTENANCE_URL` ve iki outbox
  consumer URL'si tanımlı değil. Bu nedenle gerçek İyzico sandbox ağ çağrısı ve
  deploy edilmiş Edge worker turu yapılmadı; provider-independent akışlar gerçek
  linked DEV DB + imzalı webhook verifier + provider test-double ile kanıtlandı.
  PROD'a migration, secret, worker veya provider config uygulanmadı.

### Faz 6.1 — Platform admin güvenlik temeli ✅ (2026-07-22)

- Abonelik tahsilatı için gerçek sanal POS/provider aktivasyonu, şirket ve POS
  hesabı hazır olana kadar bilinçli olarak ertelendi. Faz 5'in provider bağımsız
  ledger, webhook, dunning ve entitlement altyapısı korunuyor; PROD/deploy yok.
- Ayrı `apps/platform-admin` kontrol düzlemi eklendi. Dashboard owner/member
  rolleri veya eski staff yardımcıları erişim üretmez; platform kimliği yalnız
  `platform_admin_users` kaydı üzerinden `support | ops | finance | superadmin`
  kapalı rol sözleşmesiyle çözülür.
- Platform actor yalnız aktif kimlik ve Supabase AAL2 sonrasında üretilir. Giriş
  yalnız e-posta/parola, devamında zorunlu TOTP'dir; self-signup ve sosyal giriş
  yoktur. Yetkisiz kullanıcı ayrı erişim-reddi ekranına gider.
- `20260722090000_platform_admin_foundation.sql`, platform kimlik tablosunu ve
  reason/request-id/before/after zorunlu, update/delete trigger'ıyla append-only
  audit tablosunu tanımlar. Tablolar ve identity RPC public/anon/authenticated
  rollerinden tamamen revoke, yalnız service-role portuna açıktır. Provider/SQL
  ayrıntıları sabit uygulama hatası arkasında kalır.
- Domain **51/51**, application **123/123**, DB **172/172** ve platform-admin
  architecture **3/3** testleri temiz geçti. Domain/application/DB/platform-admin
  typecheck, ilgili lint'ler ve platform-admin production build temizdir.
- Migration açık kullanıcı onayıyla linked DEV'e uygulandı ve generated DB
  tipleri yenilendi; PROD'a uygulanmadı. Gerçek throwaway auth kullanıcısıyla
  üyelik-yok reddi, anon/authenticated table+RPC `42501`, AAL1 MFA reddi, gerçek
  TOTP sonrası AAL2 `ops` actor ve suspended fail-closed zinciri doğrulandı;
  cleanup `platformAdminRows: 0` verdi. Kalıcı bootstrap admin oluşturulmadı.
- Yerel app `/auth/login` HTTP `200`, kimliksiz `/` ise `/auth/login` için `307`
  verdi. Bu oturumda bağlı görsel browser bulunmadığından ekran görüntülü UI
  doğrulaması açık; `http://localhost:3004` geliştirici sunucusu çalışıyor.
- Audit tablosunun append-only/reason/request-id sözleşmesi migration + statik DB
  testinde kanıtlıdır. Bilinçli olarak kalıcı audit test kaydı bırakmamak için
  update/delete runtime denemesi throwaway matrise dahil edilmedi.

### Faz 6.2 — Salt-okunur tenant dizini ve güvenli işletme özeti ✅ (2026-07-22)

- `@garsonless/application/platform-admin-tenants`, liste/arama/filtre/detail
  okumalarını yalnız AAL2 `PlatformAdminActorContext` + `tenants.read` yetkisiyle
  açar. Search 100 karakter, sayfa 1–400 ve page-size `10 | 25 | 50` ile
  sınırlıdır; plan, subscription ve lifecycle filtreleri kapalı sözleşmedir.
- `20260722100000_platform_admin_tenant_directory.sql`, service-role-only iki
  RPC ile tenant planı, abonelik durumu, sınırlı fatura geçmişi, masa/ürün/ekip/
  aktif sipariş/servis talebi sayıları ve reconciliation sayısını döndürür.
  Owner kimliği/e-postası, billing contact, `restaurants.settings`, provider
  referansları, ham payload ve hata metinleri projection'a hiç girmez.
- Yeni `apps/platform-admin` ana ekranı arama + plan/abonelik/lifecycle filtreli
  işletme dizinidir; `/tenants/[tenantId]` güvenli operasyon/billing özetidir.
  Her iki yüzey açıkça **Salt okunur**dur; suspend/reactivate, paket değişimi ve
  impersonation bu dilimde bilinçli olarak yoktur.
- `20260722110000_platform_superadmin_bootstrap.sql`, yalnız boş bir platform
  kimlik tablosunda ilk Masabu sahibini atomik olarak aktif `superadmin` yapar ve
  aynı transaction'da reason + request-id içeren append-only audit yazar. Script
  `PLATFORM_ADMIN_EMAIL` ile mevcut Supabase Auth kullanıcısını çözer; kullanıcı
  e-postası açıkça verilmeden çalıştırılmaz. Sonraki admin/rol değişiklikleri bu
  bootstrap yolundan yapılamaz.
- İlk migration runtime turunda liste RPC'sindeki lateral alias hatası
  (`bs.subscription_status`; gerçek alan `bs.status`) PostgreSQL `42703` ile
  fail-closed yakalandı. Uygulanmış migration değiştirilmedi; ileri yönlü
  `20260722120000_platform_admin_tenant_directory_status_fix.sql` RPC'yi
  düzeltti ve aday tenant setini tek materialized CTE'de sabitledi.
- `20260722100000`, `20260722110000` ve forward-only `20260722120000` açık
  kullanıcı onayıyla linked DEV'e uygulandı; generated DB tipleri yenilendi.
  Gerçek runtime matrisi 3 tenant okudu; anon liste/detail `42501`, geçersiz
  filtre `22023` aldı; projection PII/provider payload sızdırmadı ve yüzey
  read-only kaldı.
- Statik kapanış: application **129/129**, DB **185/185**, platform architecture
  **5/5**; application/DB/platform-admin typecheck ve ilgili lint'ler,
  platform-admin production build temizdir.
- Kalıcı platform sahibi olarak `mustafafurkancengel@gmail.com` onaylandı.
  İlk bootstrap denemesi Auth kimliği olmadığı için hiçbir platform-admin/audit
  satırı yazmadan güvenli biçimde durdu. Kullanıcı ortak Supabase Auth kimliğini
  kendi parolasıyla oluşturduktan sonra bootstrap tekrarlandı: kimlik `active`
  `superadmin`, audit `platform_admin.bootstrap`, `auditCount: 1` ve aynı
  request-id ile doğrulandı. Dashboard onboarding yalnız Auth kimliği oluşturma
  yolunun yan etkisiydi; platform sahibi restoran onboarding'ini tamamlamaz ve
  ayrı `apps/platform-admin` kontrol düzlemini kullanır. İlk platform girişinde
  ilk MFA ziyareti dev sunucusu çalışırken alınan production build'in `.next`
  assetlerini değiştirmesi ve platform app'in yerel env yüklememesi nedeniyle
  çıplak HTML + sonsuz `Hazırlanıyor…` gösterdi. Dev süreç temiz başlatıldı;
  platform `dev` scripti artık secret kopyalamadan mevcut dashboard `.env.local`
  dosyasını `--env-file-if-exists` ile kullanıyor. Login HTTP `200`, CSS ve JS
  assetleri ayrı ayrı `200`; platform architecture **6/6**, typecheck ve lint
  temiz. İlk gerçek enrollment'ta Supabase'in SVG data-URI'sinin satır sonuyla
  bitmesi Next Image doğrulamasını tetikledi; `qr_code.trimEnd()` ile yalnız son
  kontrol karakterleri normalize edildi ve regression kapısı eklendi. Bu ilk
  hata geride `unverified` faktör bıraktı; Supabase bunu `data.totp` yerine
  `data.all` içinde döndürdüğü için eski cleanup göremiyordu. Kurulum artık tüm
  TOTP faktörlerini `data.all` üzerinden ayırıyor, yalnız verified faktörü tekrar
  kullanıyor, yarım faktörü hata kontrollü unenroll edip yeni QR üretiyor.
  Platform architecture **8/8**, typecheck ve lint temiz. Kullanıcı yenilenmiş
  ekranda gerçek TOTP QR'ını taradı, authenticator koduyla AAL2'ye çıktı ve
  platform-admin girişini gözle doğruladı. PROD/deploy'a hiçbir değişiklik
  uygulanmadı.

### Faz 6.3 — Tenant servis kontrolü ✅ (2026-07-22)

- Platform operasyon durumu billing lifecycle'dan bilinçli olarak ayrıldı:
  `active | suspended | manual_hold`. Böylece ödeme callback'i operasyonel veya
  güvenlik amaçlı bir manuel bekletmeyi yanlışlıkla kaldıramaz. Kontrol satırı
  olmayan mevcut tenant geriye uyumlu olarak `active` kabul edilir.
- `@garsonless/application/platform-admin-tenant-operations`, okuma ve durum
  değişikliğini typed command/port sınırına aldı. Okuma bütün kapalı platform
  rollerine açıkken yazma yalnız `ops | superadmin` için açıktır; support ve
  finance DB portuna ulaşmadan reddedilir. Tenant/status/request UUID ve 10–1000
  karakter reason uygulama katmanında doğrulanır.
- `20260722130000_platform_tenant_service_controls.sql`, public/anon/
  authenticated erişimi tamamen kapalı `tenant_service_controls` tablosunu ve
  service-role-only okuma/yazma RPC'lerini ekler. Yazma RPC'si gerçek platform
  kimliğini/rolünü DB'de tekrar doğrular, tenant ve kontrol satırını kilitler,
  request-id replay'ini idempotent işler ve before/after/reason/actor kaydını
  aynı transaction'da append-only platform audit loguna yazar.
- Platform tenant detayında güncel servis erişimi gösterilir. `ops` ve
  `superadmin`, zorunlu açıklamayla sipariş alımını açabilir, manuel incelemeye
  alabilir veya askıya alabilir; diğer roller salt-okunur kalır. Kontrol okuması
  başarısızsa mutasyon butonları fail-closed görünmez.
- Yeni sipariş girişleri aynı canonical kontrolü kullanır. Public QR siparişi ve
  dashboard personel siparişi `suspended`/`manual_hold` durumunda yazmadan önce
  durur; kontrol altyapısı okunamazsa da fail-closed davranır. Mevcut siparişlerin
  hazırlanması, tahsilatı ve kapanışı etkilenmez; işletme menüsü görüntülenmeye
  devam eder.
- Statik kapanış: domain **52/52**, application **135/135**, dashboard
  architecture **184/184**, platform architecture **9/9**, DB **191/191**;
  workspace typecheck **11/11** temiz. Workspace lint `0 error` ile geçti (iki
  mevcut marketing `<img>` uyarısı); platform-admin, menu ve dashboard
  production build'leri temizdir.
- `20260722130000` açık kullanıcı onayıyla linked DEV'e uygulandı; local/remote
  migration geçmişi eşleşiyor ve generated DB tipleri kontrol tablosu ile iki
  RPC'yi içeriyor. Gerçek throwaway tenant turunda support ve finance uygulama
  katmanında reddedildi; forged DB rolü, anon tablo ve anon RPC ayrı ayrı
  `42501` aldı. Aynı suspend request-id replay'i kabul edildi ama yalnız **1**
  audit satırı yazdı.
- Gerçek sipariş kontrastında suspended tenant için dashboard ve public QR
  komutları aynı güvenli mesajla reddedildi ve `orders=0` kaldı. `manual_hold`
  canonical ingress'te görüldü; `active` reaktivasyonu sonrası gerçek dashboard
  siparişi oluşturuldu ve `orders=1` oldu. Runtime iki kez çalıştırıldı; son
  kanıt turu **3** append-only lifecycle audit kaydı üretti. Audit kayıtları
  ürünün değiştirilemez güvenlik kanıtı olduğu için bilerek korunur; throwaway
  restaurant/control/order/table/category satırlarının tamamı `0 orphan` ile
  temizlendi. DB testleri generated tiplerden sonra tekrar **191/191** geçti.
  PROD ve deploy ortamına hiçbir değişiklik uygulanmadı.

### Faz 6.4 — Denetimli tenant paket yönetimi ✅ (2026-07-22)

- Paket yönetimi ADR-0002/0004 sınırına göre eklendi: `support`, `ops` ve
  `finance` plan değiştiremez; yalnız AAL2 `superadmin` kapalı
  `catalog.manage` yetkisiyle komutu çalıştırabilir. Finance rolü billing ve
  dunning operasyonlarında kalır, ücretli entitlement grant edemez.
- `@garsonless/application/platform-admin-tenant-plans`, tenant/plan/request
  UUID, canonical `free | starter | pro | enterprise` sözleşmesi ve 10–1000
  karakter gerekçeyi porttan önce doğrular. Aktör kimliği/rolü formdan değil
  doğrulanmış platform context'inden, request ID server action'da üretilir;
  altyapı ayrıntıları sabit kullanıcı-güvenli hatalara çöker.
- `20260722140000_platform_tenant_plan_management.sql`, gerçek aktif
  superadmin kimliğini ve rolünü DB'de tekrar doğrulayan service-role-only RPC
  ekledi. Restaurant ve varsa canlı subscription satırı kilitlenir; provider
  tarafından yönetilen canlı abonelikte farklı plan projection'ı
  `platform_tenant_plan_billing_managed` ile fail-closed reddedilir. Değişiklik
  ve no-op işlemleri before/after/reason/request-id ile aynı transaction'da
  append-only platform audit loguna yazılır; request-id replay'i idempotenttir.
- Platform tenant detayında plan güvenli biçimde görünür. Yalnız superadmin,
  provider aboneliği olmayan tenant için sözleşmeli grant/düzeltme formunu
  görür. Canlı abonelik varsa form yerine provider akışının yetkili olduğunu
  açıklayan koruma yüzeyi çıkar; diğer roller salt-okunur kalır.
- Statik kapanış: application **140/140**, DB **199/199**, platform architecture
  **10/10**; application/DB/platform-admin typecheck ve lint, `git diff
  --check` ve platform-admin production build temiz geçti.
- Migration açık kullanıcı onayıyla linked DEV'e uygulandı ve generated DB
  tipleri yenilendi. Gerçek throwaway tenant matrisinde support/ops/finance
  uygulama katmanında `Not authorized` aldı ve persistence çağrısı **0** kaldı;
  forged finance rolü ve anon RPC ayrı ayrı `42501` aldı. `free → pro`
  başarılı, aynı request replay'i `duplicate=true` ve tek audit satırı,
  `pro → pro` no-op ise ayrı denetim kaydı üretti. Canlı `active` subscription
  eklendikten sonra `pro → enterprise` güvenli biçimde reddedildi; tenant planı
  `pro`, reddedilen request audit sayısı **0** kaldı. Toplam **2** append-only
  plan audit kaydı güvenlik kanıtı olarak korundu; throwaway restaurant,
  billing customer ve subscription satırlarının tamamı `0 orphan` ile
  temizlendi. PROD/deploy ortamına migration veya config uygulanmadı.

### Faz 6.5a — Güvenli finans operasyon zaman çizelgesi ✅ (2026-07-22)

- Platform tenant detayına finance ve superadmin için salt-okunur ödeme yaşam
  döngüsü eklendi. Fatura, tahsilat denemesi, dunning, reconciliation, provider
  event ve provider operation kayıtları tek zaman çizelgesinde; açık bakiye ve
  operasyonel sayaçlar üst özet olarak gösterilir. Support/ops bu projection'ı
  görmez ve application portuna ulaşamaz.
- `@garsonless/application/platform-admin-billing`, AAL2 platform actor,
  `billing.manage`, tenant UUID ve 1–100 kayıt sınırını persistence öncesinde
  doğrular. DB adapter'ı yalnız kapalı status/action sözlüğünü, güvenli integer
  TRY tutarlarını ve iç UUID/timestamp alanlarını kabul eder; bozuk projection
  fail-closed kalır.
- `20260722150000_platform_tenant_billing_timeline.sql`, aktif finance veya
  superadmin kimliğini ve gönderilen rolü DB'de tekrar doğrulayan,
  service-role-only security-definer RPC ekledi. Her kaynak ayrı tenant filtresi
  taşır. Provider/customer referansları, contact/legal kimlik, payload/result
  snapshot, idempotency/fingerprint ve ham hata metni projection'a hiç girmez.
- Migration açık kullanıcı onayıyla linked DEV'e uygulandı; local/remote geçmiş
  `20260722150000` dahil eşleşiyor ve generated tipler yenilendi. PROD veya
  deploy ortamına migration/config uygulanmadı.
- Gerçek throwaway runtime matrisinde support `Not authorized` aldı ve port
  çağrısı **0** kaldı; forged finance rolü ve anon RPC `42501`, limit `101`
  ise `22023` aldı. ₺149,90 açık bakiye; 1 açık fatura, 1 aktif dunning,
  1 reconciliation ve 1 başarısız deneme okundu. Altı timeline kaynak türünün
  tamamı geldi; gizli sentinel projection'da görünmedi. İkinci tenant `0` kayıt
  ve `0` bakiye gördü; bütün geçici billing/restaurant satırları `0 orphan` ile
  temizlendi.
- Kapanış statik kapıları: application **144/144**, DB **206/206** ve
  platform-admin architecture **11/11**; ilgili typecheck/lint, `git diff
  --check` ve platform-admin production build temiz geçti. Bu oturumda browser
  binding bulunmadığı için authenticated ekran görüntülü UI turu otomatik
  çalıştırılamadı; DB/application runtime ve production render build kanıtları
  tamamlandı.

### Faz 6.5b — Denetimli dunning müdahaleleri ✅ (2026-07-22)

- Platform tenant ödeme zaman çizelgesine yalnız AAL2 `finance` ve
  `superadmin` için iki kapalı müdahale eklendi: işlemi güvenli biçimde hemen
  yeniden sıraya alma (`retry_now`) ve yalnız ileri yönde 1–30 gün erteleme
  (`defer`). Her işlemde 10–1000 karakter gerekçe zorunlu; actor, rol ve
  request-id güvenilir server context'inden türetilir.
- Bu yüzey **ödendi işaretleyemez**, invoice/subscription/entitlement durumunu
  değiştiremez ve provider çağrısı başlatamaz. Çalışan worker lease'i, durmuş
  dunning, tenant uyuşmazlığı ve ödeme takibine uygun olmayan kayıtlar
  fail-closed reddedilir. UI bu yetki sınırını açıkça anlatır; support/ops
  müdahale formunu görmez.
- `20260722160000_platform_billing_dunning_interventions.sql`, aktif platform
  kimliği ve gönderilen rolü DB'de yeniden doğrulayan service-role-only RPC
  ekledi. Schedule satırı kilitlenir; before/after/reason/request-id aynı
  transaction'da append-only audit'e yazılır ve aynı request-id replay'i tek
  kayıt olarak döner. Migration açık kullanıcı onayıyla linked DEV'e
  uygulandı, generated tipler yenilendi ve local/remote geçmiş eşleşti. PROD
  veya deploy ortamına değişiklik uygulanmadı.
- Gerçek throwaway DEV matrisinde ops uygulama katmanında reddedildi ve port
  çağrısı **0** kaldı; forged finance rolü ve anon RPC ayrı ayrı `42501` aldı.
  `retry_now` başarılı oldu, replay `duplicate=true` döndü ve audit sayısı
  **1** kaldı. Aktif worker lease'i güvenli hata ve **0** audit ile reddedildi;
  lease bırakıldıktan sonra 7 günlük erteleme başarıyla uygulandı. Cross-tenant
  istek ve durmuş run reddedildi, reddedilen request audit sayıları **0** kaldı.
- Ödeme otoritesi kontrastı gerçek DB sorgusuyla doğrulandı: invoice
  `past_due`, `amount_paid_minor=0`, subscription `past_due` ve provider
  operation sayısı **0** kaldı. Toplam **2** append-only müdahale audit kaydı
  güvenlik kanıtı olarak korundu; throwaway restaurant, billing customer,
  subscription, invoice ve dunning satırlarının tamamı `0 orphan` ile
  temizlendi.
- Kapanış statik kapıları: application **147/147**, DB **213/213** ve
  platform-admin architecture **12/12**; generated tiplerden sonra ilgili
  typecheck'ler ve workspace typecheck **11/11** temizdir. Workspace lint
  **0 error** ile geçti (yalnız iki mevcut marketing `<img>` uyarısı);
  platform-admin production build ve `git diff --check` temizdir.

### Faz 6.6 — Süreli ve denetimli entitlement override ✅ (2026-07-22)

- Paket kataloğu tek kalıcı yetki kaynağı olarak korundu; tenant planı veya
  billing projection'ı değiştirilmeden en fazla 30 günlük `allow | deny`
  istisnası eklendi. Runtime'da gerçekten kapısı bulunan yalnız beş özellik
  yönetilebilir: tarayıcı bildirimleri, mutfak ekranı, sadakat, gelişmiş
  raporlar ve gelişmiş tema bölümleri. UI'da etkisiz kalacak sahte override
  oluşturulamaz.
- `@garsonless/domain/entitlements`, plan + aktif override için tek
  `EffectiveFeatureEntitlement` semantiğini taşır. Application command'leri
  okuma için tüm platform rollerini, mutasyon için yalnız AAL2 `ops` ve
  `superadmin` rollerini kabul eder; feature/decision/action, 1–30 gün, UUID ve
  10–1000 karakter gerekçe porttan önce doğrulanır.
- `20260722170000_tenant_feature_overrides.sql`, public/anon/authenticated
  erişimi kapalı projection ile üç service-role-only RPC ekledi. Mutasyon DB'de
  aktif exact-role kimliğini yeniden doğrular, tenant ve override satırını
  kilitler, request-id replay'ini idempotent işler ve before/after/reason/actor
  kaydını aynı transaction'da append-only platform audit'e yazar. Revoke veya
  süre dolumu erişimi otomatik olarak canonical plana döndürür.
- Platform tenant detayında mevcut/sona ermiş istisnalar salt-okunur görünür;
  yalnız ops/superadmin geçici açma, kapatma ve erken sonlandırma yapabilir.
  Dashboard settings, orders/shell push, analytics, theme editor, kitchen
  launch/session ve tüm loyalty earn/redeem yolları aynı service-role effective
  entitlement resolver'ına taşındı. Resolver veya projection okunamazsa kapı
  fail-closed kalır.
- Migration açık kullanıcı onayıyla yalnız linked DEV'e uygulandı; generated
  DB tipleri yenilendi ve local/remote geçmiş `20260722170000` dahil eşleşti.
  PROD/deploy ortamına migration veya config uygulanmadı.
- Gerçek throwaway runtime matrisinde finance uygulama katmanında reddedildi ve
  persistence çağrısı **0** kaldı; forged rol, anon RPC ve anon tablo okuması
  ayrı ayrı `42501` aldı. Free planda loyalty baseline kapalıyken süreli allow
  kapıyı açtı; aynı request replay'i `duplicate=true` ve audit **1** kaldı.
  Revoke tekrar kapattı. Pro planda süreli deny kapıyı kapattı; kısa test süresi
  dolunca erişim otomatik canonical Pro plana döndü. Toplam **3** append-only
  audit kanıtı korundu; throwaway restaurant ve override projection'ı
  **0 orphan** ile temizlendi.
- Statik kapanış: domain **55/55**, application **151/151**, DB **225/225**,
  dashboard architecture **184/184**, platform-admin architecture **13/13**;
  ilgili typecheck/lint'ler, dashboard + platform-admin production build ve
  `git diff --check` temizdir.

### Faz 6.7 — Süreli salt-okunur platform destek görünümü ✅ (2026-07-22)

- Tenant dashboard üyeliği veya owner kaydı üretmeyen, control-plane içinde
  izole bir destek görünümü eklendi. AAL2 `support`, `ops` ve `superadmin`
  yalnız doğrulanmış tenant projection'ını en fazla **60 dakika** inceleyebilir;
  `finance` ve tenant aktörleri bu yetkiyi alamaz. Oturum 15/30/60 dakika,
  zorunlu 10–1000 karakter gerekçeli ve her zaman aktör kimliğine bağlıdır.
- Platform tenant detayındaki "İşletmeyi salt okunur incele" akışı ayrı bir
  `/tenants/[tenantId]/view/[sessionId]` route'una gider. Bu yüzeyde tenant
  mutasyon action'ı bulunmaz; plan, ödeme, entitlement, kullanıcı, sipariş veya
  restoran ayarı değiştirilemez. Erken kapatma yalnız control-plane oturumunu
  sonlandırır.
- `20260722180000_platform_admin_read_only_impersonation.sql`, public/anon/
  authenticated erişimi kapalı session tablosu ve read/start/end RPC'lerini
  ekledi. DB aktif exact-role kimliğini yeniden doğrular, aynı aktör için tek
  açık oturum uygular, süre dolumunu otomatik `expired` projekte eder ve
  request-id replay'ini idempotent işler. Başlangıç/bitiş before/after/reason
  kayıtları aynı transaction'da append-only platform audit'e yazılır.
  `20260722181000_platform_admin_impersonation_service_cleanup.sql` yalnız
  service-role test/operasyon temizliği için DELETE grant'i ekler; browser
  rollerine hiçbir erişim açmaz.
- Her iki migration açık kullanıcı onayıyla yalnız linked DEV
  `yxsegwkzyiscrxiwdeuf` projesine uygulandı; local/remote geçmiş
  `20260722181000` dahil eşleşiyor ve generated tipler yenilendi. PROD/deploy
  ortamına migration veya config uygulanmadı.
- Gerçek throwaway DEV matrisinde finance uygulama katmanında reddedildi ve
  persistence çağrısı **0** kaldı; forged rol, anon RPC ve anon tablo okuması
  ayrı ayrı `42501` aldı. Oturum başladı, start/end replay'leri
  `duplicate=true` kaldı, eşzamanlı ikinci oturum reddedildi ve aktör için
  restaurant membership sayısı **0** oldu. Erken kapatma `ended`, zorlanmış
  süre sonu `expired`; replay'lerle birlikte toplam **3** immutable audit kaydı
  oluştu. Throwaway session ve restaurant satırları **0 orphan** ile temizlendi.
- Kapanış kapıları: domain **55/55**, application **155/155**, DB **230/230**,
  platform-admin architecture **14/14**; workspace typecheck **11/11**,
  platform-admin lint/build ve `git diff --check` temizdir.

### Faz 6.8 — Global hata merkezi ✅ (2026-07-23)

- Platform yöneticisi için tenantlar arası salt-okunur hata merkezi eklendi.
  Görünüm uygulama, seviye ve 1 saat/24 saat/7 gün/30 gün penceresiyle
  filtrelenir; toplam olay, tekilleştirilmiş fingerprint, kritik fingerprint ve
  etkilenen tenant sayısını gösterir. Tüm AAL2 platform rolleri mevcut
  `tenants.read` yetkisiyle okuyabilir; tenant kullanıcıları bu control-plane
  yüzeyine erişemez.
- Yeni domain sözleşmesi uygulama (`dashboard | menu | kitchen |
  platform-admin | worker`), seviye (`warning | error | critical`), zaman
  penceresi ve makine-kaynağı sözlüğünü fail-closed tutar. Application query
  kapalı filtreleri persistence öncesi doğrular; altyapı ayrıntıları sabit
  güvenli hataya çöker.
- `20260722190000_platform_error_events.sql`, ham SQL/provider mesajı, stack,
  payload veya müşteri PII tutmayan service-role-only event tablosu; deterministik
  `app + source + publicCode` fingerprint'i; güvenli aggregate read RPC'si ve
  30 günlük retention job'u ekler. Dashboard anomalik read-model gözlemleri bu
  projection'a `MAS-SVC-503` ile aktarılır; hızlı/başarılı sorgular hata olayı
  üretmez.
- Statik kapılar temiz: domain **57/57**, application **159/159**, DB
  **237/237**, platform-admin architecture **15/15**, workspace typecheck
  **11/11**, platform-admin lint/build ve `git diff --check`.
- `20260722190000_platform_error_events.sql` yalnız linked DEV'e uygulandı;
  local/remote migration geçmişi eşleşiyor ve generated DB tipleri yenilendi.
  Gerçek runtime matrisi aynı fingerprint'in iki olayda tek gruba düştüğünü
  (`groupedOccurrences=2`), en yüksek severity'nin `critical`, etkilenen tenant
  sayısının `1` ve fingerprint'in deterministik olduğunu doğruladı. Anon RPC
  okuma/yazma ile doğrudan tablo okuması `42501`, geçersiz serbest hata girdisi
  `22023` aldı; güvenli projection yasak alan içermedi ve temizlik sonrası kalan
  satır sayısı `0` oldu. PROD/deploy ortamına hiçbir değişiklik uygulanmadı.

### Faz 6.9 — Superadmin KVKK veri operasyonları ✅ (2026-07-23)

- Tenant detayına yalnız AAL2 doğrulanmış `superadmin` ve `data.manage`
  yetkisiyle açılan veri operasyonları paneli eklendi. Export ve silme
  komutları server-generated request ID, zorunlu gerekçe ve silme için açık
  `KVKK SİL` doğrulaması ister; gerekçe alanında PII tutulmaması UI'da ayrıca
  belirtilir. Finance/ops/support ve tenant aktörleri application katmanında
  persistence çağrısından önce fail-closed reddedilir.
- Veri export'u tarayıcıya `no-store` JSON attachment olarak geçici döner;
  operasyon tablosunda export içeriği veya müşteri PII'si değil yalnız güvenli
  sayım özeti, aktör, zaman ve gerekçe kanıtı kalır. Aynı request ID replay'i
  ikinci bir export/silme veya audit satırı üretmez.
- Tenant kapsamlı silme müşteri bağlantıları, consent, loyalty ve kampanya
  verisini kaldırır; sipariş ve faturalama kayıtlarını yasal/operasyonel kanıt
  olarak koruyup müşteri bağını ayırır. Global customer kimliği başka tenant
  tarafından kullanılıyorsa korunur, son tenant referansı kalkınca anonim hale
  gelir. İlgisiz guest payment-share ve message-event kayıtları forward-fix ile
  silme kapsamının dışında tutuldu.
- `20260722200000_platform_tenant_privacy_operations.sql` ve kapsam düzeltmesi
  `20260722201000_platform_tenant_privacy_erasure_scope.sql` yalnız linked DEV
  `yxsegwkzyiscrxiwdeuf` projesine uygulandı; generated DB tipleri yenilendi.
  Public/anon/authenticated tablo ve RPC erişimleri kapalıdır. PROD/deploy
  ortamına migration veya config uygulanmadı.
- Gerçek throwaway DEV matrisinde application reddi persistence çağrısını
  **0** bıraktı; anon RPC/tablo ve forged-role denemeleri `42501`, geçersiz
  girdi `22023` aldı. Export istenen PII'yi geçici payload'da içerirken kalıcı
  audit kanıtı PII içermedi. Silme replay'i `duplicate=true`, operation ve
  audit sayısı **1** kaldı; tenant link/consent/loyalty sayıları **0**, sipariş
  korunmuş ve customer bağı ayrılmış, billing satırı **1** olarak korunmuştur.
  Paylaşılan kimlik son tenant referansına kadar korundu, ardından anonimleşti.
  İki throwaway tenant ve müşteri dahil değiştirilebilir test verisi **0
  orphan** ile temizlendi; append-only audit kanıtı tasarım gereği korundu.
- Kapanış kapıları: domain **59/59**, application **162/162**, DB **244/244**,
  platform-admin architecture **16/16**, workspace typecheck **11/11** ve tam
  workspace production build temizdir. Workspace lint **0 error** ile geçti
  (yalnız iki mevcut marketing `<img>` uyarısı); `git diff --check` temizdir.

### Faz 6 control-plane arayüz polish'i ✅ (2026-07-23)

- Platform admin giriş, MFA, erişim reddi, tenant dizini/detayı, finans zaman
  çizelgesi, entitlement istisnaları, KVKK operasyonları, destek görünümü ve
  global hata merkezi; dashboard ile aynı siyah-beyaz görsel dil, tutarlı
  tipografi/boşluklar ve Türkçe operasyon etiketleriyle yeniden düzenlendi.
- Tenant planı, abonelik, lifecycle ve platform rol/status değerleri tek
  presentation sözlüğünden insan-okunur gösteriliyor; mutasyon, yetki ve veri
  erişim sözleşmeleri değiştirilmedi. Migration veya tenant verisi yazılmadı.
- Platform-admin architecture **16/16**, typecheck, lint, production build ve
  `git diff --check` temiz geçti. Codex'e bağlı uygulama içi browser
  bulunamadığı için desktop/mobile ekran görüntülü görsel tur bu dilimde
  çalıştırılmadı; bu doğrulama PROD hazırlığı öncesi açık smoke maddesidir.

### Faz 7.1 — Production readiness preflight temeli ✅ (2026-07-23)

- PROD'a bağlanmadan ve herhangi bir deploy/migration yapmadan çalışan,
  fail-closed `pnpm prod:preflight` aracı eklendi. Dashboard, menu, kitchen,
  marketing, platform-admin, outbox-worker ve send-email-hook scope'ları ile
  kart ödemesi, SaaS billing, web-push ve SMS capability sözleşmelerini ayrı
  ayrı doğrular; secret değerlerini hiçbir çıktıda göstermez.
- Eksik/placeholder değer, local veya HTTPS olmayan URL, DEV Supabase hedefi,
  zayıf secret, yanlış provider ve çakışan migration timestamp'i `MAS-DEP-*`
  kodlarıyla deploy öncesinde engellenir. DEV ref'i `yxsegwkzyiscrxiwdeuf`
  production hedefi olarak açıkça reddedilir; İyzico capability'leri sandbox
  origin ile geçmez. Hazır olmayan SaaS billing sessizce açık sayılmaz,
  `MAS-DEP-W01` ile ertelenmiş capability olarak görünür.
- `.env.production.example` platform-admin, menu worker secret'ı, outbox
  consumer URL'leri ve send-email-hook secret sözleşmeleriyle tamamlandı.
  `docs/operations/production-readiness.md` deploy sırasını, hata kodlarını,
  rollback/smoke kapılarını ve mevcut blokajları tek runbook'ta toplar.
- Migration envanteri dinamik olarak **110** dosyayı doğruladı; ilk migration
  `20260517000000_initial_schema.sql`, son migration
  `20260722201000_platform_tenant_privacy_erasure_scope.sql` ve duplicate
  timestamp sayısı **0**. Remote PROD migration geçmişi bu ağsız preflight'ın
  dışında ve ayrıca kanıtlanması gereken `MAS-DEP-W02` kapısıdır.
- Kapanış kapıları: production preflight **6/6**, domain **59/59**,
  application **162/162**, DB **244/244**, platform-admin architecture
  **16/16**, workspace typecheck **11/11**, workspace lint **0 error** ve tam
  monorepo production build temizdir. Yalnız daha önce var olan iki marketing
  `<img>` performans uyarısı devam eder. PROD ortamında hiçbir mutation,
  migration, secret veya deploy işlemi yapılmadı.

### Faz 7.2 — Migration release manifesti ve drift kapısı ✅ (2026-07-23)

- `pnpm prod:migration-manifest`, sıralı local migration zincirini dosya ve
  içerik SHA-256 değerleriyle deterministik bir release artifact'ına çevirir.
  Mevcut **110** migration için aynı çalışma ağacında tekrarlanan üretimler aynı
  aggregate SHA-256 değerini verir; aynı version altındaki SQL değişikliği de
  artifact karşılaştırmasında görünür olur.
- `pnpm prod:migration-drift`, operatörün sağladığı `supabase migration list`
  kanıtını expected production project ref, capture zamanı ve local release
  manifestiyle fail-closed doğrular. Kanıtın doğru PROD projesinden geldiği
  metadata ile bağlanır; DEV/yanlış proje, boş/okunamayan çıktı, duplicate,
  sırası bozulmuş, remote-only veya farklı local snapshot geçmişi reddedilir.
- `pre-deploy` modu remote geçmişin local zincirin append-only prefix'i
  olmasını ister ve bekleyen migration'ları `MAS-DEP-W03` olarak görünür
  planlar. `post-deploy` modu tam eşitlik ister; eksik remote migration
  `MAS-DEP-009` ile release'i başarısız kılar. Araç Supabase'e bağlanmaz,
  migration uygulamaz ve secret işlemez.
- `docs/operations/production-readiness.md` güvenli kanıt formatı, manifest,
  deploy öncesi/sonrası komutları ve yeni `MAS-DEP-008/009/010/W03` kodlarıyla
  genişletildi. Unit matrisi **6/6**, production preflight **6/6**, domain
  **59/59**, application **162/162**, DB **244/244**, platform-admin
  architecture **16/16**, workspace typecheck **11/11**, lint **0 error** ve
  tam monorepo production build temiz geçti. Yalnız iki mevcut marketing
  `<img>` uyarısı sürüyor; PROD'a mutation/deploy yapılmadı.

### Faz 7.3 — Cross-app deployment topolojisi ve release identity ✅ (2026-07-23)

- Dashboard, menu, kitchen ve marketing origin'leri; platform-admin ve
  outbox-worker dahil altı zorunlu runtime scope; ortak Supabase/worker
  bağları; altı worker endpoint'i ve beş public callback route'u tek,
  version'lanmış `config/production-topology.json` sözleşmesinde toplandı.
  `pnpm prod:topology` yanlış origin, eksik route, çapraz uygulama secret/key
  drift'i, yanlış endpoint ve DEV/yanlış Supabase project ref'ini secret
  değerlerini yazdırmadan fail-closed reddeder.
- Gerçek Edge Function koduyla yapılan çapraz kontrolde outbox worker'ın
  built-in `SUPABASE_URL` kullandığı, önceki preflight örneğinin ise yanlışlıkla
  browser değişkeni `NEXT_PUBLIC_SUPABASE_URL` beklediği bulundu. Production
  env şablonu, scope validator'ı ve testler Edge runtime sözleşmesine göre
  düzeltildi; uygulamalar arası Supabase ref eşitliği iki değişken adı için de
  korunuyor.
- `pnpm prod:release-evidence`, clean `main`, local `origin/main` eşitliği ve
  PROD project ref kapılarını geçmeden artifact üretmez. Başarılı artifact;
  commit SHA, package manager, quality gate listesi, lockfile SHA, migration
  manifest SHA/sayısı, topology SHA, public origin/endpoint'ler ve tümünün
  aggregate SHA-256 kimliğini deterministik ve secretsiz biçimde bağlar.
- Platform-admin'in nihai public domain'i henüz ürün/deploy kararı olmadığı
  için uydurulmadı; auth redirect allowlist ile birlikte runbook'ta açık PROD
  blokajı olarak bırakıldı. Araçlar yalnız local dosya ve operatör kanıtı okur;
  PROD'a erişim, migration, secret veya deploy işlemi yapmaz.
- Kapanış kapıları: production preflight **7/7**, topology + release evidence
  **10/10**, birleşik hedefli matris **16/16**, workspace `check:ci`, typecheck
  ve beş Next.js uygulamasının production build'i temizdir. Workspace lint
  **0 error** ile geçti; yalnız mevcut iki marketing `<img>` performans uyarısı
  sürüyor.

### Faz 7.4 — Edge/cron/Vault runtime kapısı ve local release provası ✅ (2026-07-23)

- İki Supabase Edge Function (`outbox-worker`, `send-email-hook`), `pg_cron` /
  `pg_net` / `vault` capability'leri, Auth Send Email Hook, iki Vault metadata
  anahtarı, üç güvenli HTTP probe ve dört kanonik cron işi
  `config/production-runtime.json` altında version'landı. Eski sweep komutunun
  30 dakikalık ara hali değil, son migration'daki **180 dakika** eşiği tek
  kanonik runtime durumu olarak tutulur.
- `pnpm prod:runtime-manifest`, Supabase `config.toml`, function kaynakları,
  import map'ler, Vault/scheduler migration'ları ve cron migration'larının
  SHA-256 değerlerini secretsiz tek artifact'a bağlar. Kaynakta kullanılmayan
  env adı, yanlış `verify_jwt`, eksik dosya veya migration'dan sapan cron
  command/schedule `MAS-DEP-018/020/021` ile CI'da fail-closed durur.
- `pnpm prod:runtime-verify`, operatörün son 24 saate ait güvenli PROD kanıtını
  project ref'e bağlar. Kanıt yalnız function/secret isimleri, configured
  boolean'ı, public URL, cron metadata ve probe HTTP durumlarını kabul eder;
  secret/token/header/body/API key alanı `MAS-DEP-022` ile reddedilir.
  Pre-deploy farkları `MAS-DEP-W04` planı, post-deploy farkları release hatasıdır.
- Release identity artık runtime artifact SHA'sını da taşır.
  `pnpm prod:rehearse`, release ve runtime SHA'larını dokuz adımlı rollout,
  gerekli PROD kanıtları ve dört aşamalı rollback matrisiyle deterministik
  `local-dry-run` artifact'ına bağlar. Migration hatasında down migration yok;
  rollout durur ve forward-fix uygulanır. Artifact açıkça
  `productionMutationPerformed: false` taşır.
- Hedefli runtime/prova matrisi **10/10**, topology + release identity **10/10**,
  production preflight **7/7**, migration release **6/6** ve tam workspace
  `check:ci` temiz geçti. Beş Next.js uygulamasının production build'i başarılı;
  yalnız iki mevcut marketing `<img>` performans uyarısı sürüyor. PROD runtime
  evidence henüz alınmadı; hiçbir PROD bağlantısı, migration, secret veya deploy
  işlemi yapılmadı.

### Faz 7.5 — Release-bound iş-kritik smoke kapısı ✅ (2026-07-23)

- Route smoke'un ötesindeki on ürün invariant'ı
  `config/production-smoke.json` altında version'landı. Sekiz çekirdek kontrol;
  auth sınırı, public menü/masa tokenı, guest ve member sipariş attribution'ı,
  loyalty idempotency, KDS transition/tenant sınırı, outbox-inbox-e-posta
  fan-out, platform-admin AAL2 ve operasyonel gözlemlenebilirliği kapsar.
  Kart ödemesi ve SaaS billing ayrı capability kontrollüdür.
- `pnpm prod:smoke-manifest`, her kontrolün uygulama kaynaklarını SHA-256 ile
  topoloji hedeflerine bağlar. Eksik kaynak, tekrarlı assertion, bilinmeyen
  capability veya yanlış origin `MAS-DEP-015/025/027` ile CI'da fail-closed
  durur. Release identity artık smoke artifact SHA'sını ve kontrol sayısını da
  taşır; local rehearsal aynı smoke SHA'ya bağlı değilse `MAS-DEP-024` alır.
- `pnpm prod:smoke-verify`, en fazla dört saatlik operatör kanıtını production
  project ref + commit + release + runtime + smoke SHA'larına bağlar. Kanıt
  yalnız boolean assertion, duration ve capability durumu kabul eder; PII,
  token, header/body, sipariş/masa/customer kimliği veya bilinmeyen alan
  `MAS-DEP-028` ile reddedilir. Pre-deploy eksikleri `MAS-DEP-W05`, post-deploy
  eksik/failed kontroller `MAS-DEP-026/027` ile release blokajıdır.
- Henüz merchant hazır olmayan `order-card-payments` ve `saas-billing`
  sessizce atlanmaz: capability `false` + kontrol `deferred` + yalnız
  `CAPABILITY_DISABLED` reason code'u kabul edilir; capability açıldığı anda
  bütün assertion'lar zorunlu olur. Güvenli operatör şeması ve snapshot/cleanup
  disiplini `docs/operations/production-readiness.md` ile
  `production-smoke-evidence.example.json` içinde belgelendi.
- Hedefli smoke kontrat matrisi **12/12**, topology + release identity
  **10/10** ve runtime/rehearsal **10/10** geçti. PROD smoke çalıştırılmadı;
  production mutation/deploy yapılmadı. Tam `pnpm check:ci` ve beş Next.js
  uygulamasını kapsayan workspace production build'i temiz geçti. Yalnız daha
  önce var olan iki marketing `<img>` lint uyarısı devam ediyor; hata yok.
