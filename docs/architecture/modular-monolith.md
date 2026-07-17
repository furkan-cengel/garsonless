# Masabu Modüler Monolith

## Karar

Masabu, Supabase/Postgres merkezli modüler monolith olarak evrilir. Next.js
uygulamaları dağıtım sınırı olarak kalır; domain sınırları ise paket ve
application-command seviyesinde uygulanır. Bu aşamada mikroservis, ayrı queue
veya dağıtık transaction yoktur.

## Katmanlar

```text
UI / Route Handler / Server Action
  -> actor + tenant context adapter
  -> @garsonless/application command veya query
  -> @garsonless/domain policy, Result ve event sözleşmesi
  -> @garsonless/db/server repository / RPC / provider adapter
  -> Postgres + domain_outbox + Realtime
```

- `@garsonless/domain` tarayıcı için güvenli, saf TypeScript kurallarıdır.
  Supabase, Next.js, environment değişkeni veya service-role import etmez.
- `@garsonless/application` komutları güvenilir `CommandContext` alır;
  yetkilendirme bilgisini HTTP gövdesinden türetmez ve infrastructure portları
  üzerinden çalışır.
- `@garsonless/db/server` service-role ve Supabase repository adaptörlerinin
  tek yeni giriş noktasıdır. `@garsonless/db/browser` yalnız browser-safe
  yardımcılar içindir. `@garsonless/db/server` için browser export'u bilinçli
  olarak fail-fast guard'dır.
- Uygulamalar HTTP/UI adaptörüdür: schema doğrular, actor bağlamını kurar,
  command çağırır ve response döndürür.

## İlk strangler dilimi: sipariş ve ödeme

`placePublicOrder` ve `settleOrder` komutları artık menu order route'u,
dashboard manuel tahsilatı ve İyzico callback'i tarafından kullanılır.
Mevcut HTTP sözleşmesi, server-side fiyat çözümü, request-id idempotency'si ve
`markOrderPaidDB` atomik primitive'i korunur. Komut, dashboard üyesinin
İyzico tahsilatı yazmasını; provider callback'inin de nakit/POS yazmasını
reddeder.

Public masa akışları artık ham `tables.id` değerine güvenmez. Her masa için
opaque ve iptal edilebilir bir QR token üretilir; route handler tokenı
service-role RPC ile çözüp doğrulanmış `restaurantId` ve `tableId` bağlamını
application command'e verir. Token rotasyonunda eski QR anında geçersiz olur.
`table_sessions`, `orders` ve `payment_shares` için geniş anonim okumalar
kaldırılmıştır; public durum yalnız token kapsamlı API'lerden okunur.

## Outbox

`domain_outbox` aggregate değişimiyle aynı Postgres transaction'ında trigger
ile yazar. Başlangıç event'leri:

- `order.created`
- `order.status_changed`
- `order.settled`
- `table_session.closed`
- `service_request.created`
- `customer.welcome_bonus_requested`
- `campaign.delivery_requested`

`claim_domain_outbox` `FOR UPDATE SKIP LOCKED` kullanır; worker lease alır,
işler ve `ack_domain_outbox` ile tamamlar. `domain_outbox_receipts` tüketici
başına idempotency sınırıdır. Worker sadakat event'lerini `loyalty-ledger`,
kampanya event'lerini `campaign-sms` consumer'ına yönlendirir; consumer yan
etkiyi receipt'ten önce tamamlar ve redelivery receipt varsa no-op olur. KDS,
bildirim ve analitik consumer'ları bu delivery sınırına ayrı consumer adıyla
eklenebilir. Hatalar exponential backoff ile yeniden planlanır; sekizinci
başarısız claim event'i dead-letter durumuna taşır.
`requeue_domain_outbox` yalnız açık bir operasyon kararıyla poison event'i
tekrar kuyruğa alır, `get_domain_outbox_health` ise pending/ready/leased/dead
sayısını ve en eski event gecikmesini verir.

Worker deploy öncesi iki secret gerekir:

- `SUPABASE_SERVICE_ROLE_KEY`
- `OUTBOX_WORKER_SECRET`

Durable Node consumer devreye alınırken dashboard'daki
`/api/internal/outbox` route'u ile Edge Function aynı
`OUTBOX_WORKER_SECRET` değerini kullanır; Edge ortamındaki
`OUTBOX_CONSUMER_URL` bu route'un mutlak URL'sidir. URL henüz konfigüre
edilmemişse worker event'i ACK'lemez ve retry bütçesini tüketmez:
`defer_domain_outbox` lease'i bırakır, claim attempt'ini geri alır ve event'i
bir saat erteler. Bu staged rollout koruması consumer deploy'u ile worker
deploy'u arasındaki pencerede event kaybını engeller.

Scheduler, Edge Function'a `x-outbox-secret` header'ı ile istek atar. Worker URL ve
ortak secret her ortamda Supabase Vault'taki `outbox_worker_url` ve
`outbox_worker_secret` kayıtlarından okunur; repo veya `cron.job.command`
içine yazılmaz. `domain-outbox-worker-every-minute` pg_cron işi worker'ı her
dakika çağırır. DEV'de function deploy, Vault, cron ve gerçek
claim/receipt/ack akışı doğrulanmıştır; PROD deploy sırasında aynı iki Vault
kaydı ve Edge secret ayrıca kurulmalıdır.

## Tables ve Kitchen strangler dilimi

Masa oturumu kapatma, açık adisyon read model'i ve servis isteği yaşam döngüsü
`@garsonless/application/tables` command/query sınırına taşındı. Dashboard
action'ları önce `tables` bölüm yetkisini çözer ve yalnız doğrulanmış
`dashboard-member` context'i ile command çağırır. Normal/anormal kapanış kararı
application katmanında, atomik para guard'ı ve token'sız split-intent temizliği
`close_table_session_atomic` RPC'sinde tek transaction'dadır. Provider token'ı
bağlanmış veya aktif checkout lease'i olan pay gerçek para callback'i
taşıyabileceği için kapanış `payment_pending` ile fail-closed reddedilir; pay ve
açık oturum korunur. Table-close outbox trigger'ı da aynı transaction içinde
yazılır, server adaptörü yalnız düşük gecikmeli consumer dispatch'i yapar.

Public hızlı masa isteği ham `restaurantId` veya `tableId` kabul etmez. Route,
opaque QR token'ı çözer; command doğrulanmış context ile input'taki restaurant,
internal table ve token üçlüsünü yeniden eşleştirir. İstek türü ve kullanıcı
etiketi artık browser-safe domain sözlüğüdür. Pending type/table unique index'i
eşzamanlı replay'i tek satıra indirir. `create_table_service_request_atomic`
tablo sahipliği, açık oturum association'ı ve insert'i tek transaction'da yapar;
raw read-then-insert helper kaldırılmıştır.

Kitchen SSR board, tek-order refresh ve liste refresh okumaları
`KitchenBoardPort` üzerinden yapılır. Application query yalnız güvenilir
kitchen context alır. KDS yazması mevcut
`transitionKitchenOrder` command'ini kullanmaya devam eder; istasyon sahipliği,
çok-istasyon son kontrolü ve yalnız `preparing|ready` hedefleri UI'dan bağımsız
kalır. `transition_kitchen_order_atomic` aynı station/status policy'sini order
row lock altında tekrar doğrular ve compare-and-set'i transaction içinde yapar;
application preflight ile DB yazısı arasındaki stale-authority yarışı böylece
fail-closed olur. Retry self-transition'ları idempotenttir. Kitchen
uygulamasındaki doğrudan service-role query modülü kaldırıldı.

Kalıcı `kitchen_credentials.token` artık dashboard read model'ine, client
component prop'una, URL query string'ine veya server action argümanına çıkmaz.
Dashboard'daki `/api/kitchen/launch/:restaurantId` route'u doğrulanmış `orders`
yetkisinden sonra credential ile 45 saniyelik, tenant ve amaç kapsamlı bir
launch artifact imzalar ve bunu KDS exchange route'una POST eder. Kitchen app
artifact'ı 8 saatlik, restaurant-path kapsamlı `HttpOnly + SameSite=Lax`
session cookie'sine çevirir; browser temiz `/kitchen/:restaurantId` URL'sine
303 ile döner. Her page/action erişimi session imzasını güncel credential ile
yeniden doğruladığı için credential rotasyonu eski ticket ve açık KDS
oturumlarını anında geçersiz kılar. Legacy `?token=` URL'si auth sağlamaz ve
middleware'de RSC'ye ulaşmadan temiz URL'ye redirect edilir.

Launch artifact aynı zamanda tek kullanımlıdır. Raw artifact DB'ye yazılmaz;
SHA-256 hash'i kısa ömürlü `kitchen_session_launches` receipt'inde tutulur.
`consume_kitchen_launch_ticket` RPC'si hash'i `consumed_at is null` ve güncel
expiry koşullarıyla atomik update eder. Böylece normal replay reddedilir ve iki
paralel exchange yarışında yalnız bir session üretilebilir. Receipt tablosu ile
consume RPC'si anon/authenticated rollere kapalı, yalnız service-role'a açıktır.
Süresi dolmuş receipt'ler yeni ticket üretiminde tenant kapsamında fırsatçı
olarak temizlenir; restaurant silinince kalan kayıtlar cascade olur.

KDS read modeli geniş `orders.select('*')` sorgusu değildir.
`read_kitchen_order_projection` security-definer RPC'si yalnız service-role'a
açıktır ve dokuz alanlık açık bir projection döndürür: `id`, `status`,
`table_id`, `items`, `customer_tier`, `paid_at`, `created_at`, `updated_at` ve
`active`. Snapshot cursor'ı sorgudan önce PostgreSQL `clock_timestamp()` ile
yakalanır. Böylece uygulama saati kayması veya okuma sırasında gerçekleşen bir
write delta penceresinden düşmez.

Kitchen client aynı anda yalnız bir istek olacak şekilde iki saniyelik delta
okur. Aktif siparişler upsert edilir; terminal veya silinen satırlar
`active=false` tombstone olarak gönderilip yerel projection'dan çıkarılır.
Altmış saniyelik tam snapshot ile pencere focus/visibility dönüşündeki snapshot
kaçırılan delta, uyku ve geçici ağ kesintilerini uzlaştırır. Kitchen uygulaması
anon Supabase client veya public Supabase env taşımaz; browser HttpOnly kitchen
session'ıyla server action adapter'ına konuşur. Bu, geniş bir anon Realtime
policy açmadan yakın-gerçek zamanlı consumer sınırıdır. Push/SSE transport
ileride eklenirse aynı projection batch ve merge sözleşmesini kullanabilir;
doğruluğun kaynağı yine DB cursor ve snapshot reconciliation kalır.

DEV throwaway doğrulamasında snapshot yalnız dokuz izinli alanı verdi, hassas
alan sayısı sıfır kaldı; aynı delta terminal tombstone ile yeni insert'i birlikte
taşıdı ve merge stale kartı kaldırdı. Anon RPC `42501` döndü. Gerçek local
single-use exchange sonrası board 200 açıldı; DB insert 1305 ms'de göründü,
terminal update 1815 ms'de kartı kaldırdı ve browser console error üretmedi.
`20260717020000_kitchen_order_projection.sql` PROD-at-deploy setine dahildir.

DEV throwaway runtime matrisinde servis isteği create+replay throttle+resolve,
normal close, unpaid close reddi, gerekçeli abnormal close ve tek-istasyon
`sent_to_kitchen -> preparing -> ready` zinciri doğrulandı; tenant, QR, session,
order, request, credential, station ve outbox kayıtları cascade ile temizlendi.

İkinci atomiklik matrisi ayrıca iki paralel servis çağrısında **1 satır + 1
throttle**, provider-bound pay varken `payment_pending` + açık session + korunmuş
share, provider bırakıldıktan sonra aynı transaction'da `void` + abnormal close
+ tek close outbox, yanlış istasyonda DB `42501` ve paralel iki ready retry'ında
tek kalıcı `ready` sonucu kanıtladı. Üç RPC anon için `42501`; cleanup restaurant,
session, order, share, request ve outbox için sıfırdır. DEV'e uygulanan
`20260716100000_atomic_table_close_service_request_and_kitchen_transition.sql`
PROD-at-deploy migration setine eklenmelidir.

## Read-model strangler dilimi

Tahsil edilmiş sipariş semantiğinin tek sahibi artık
`@garsonless/domain/orders` içindeki `COLLECTED_ORDER_SPEC`'tir. Browser
görünümleri aynı policy'yi saf predicate olarak değerlendirir;
`@garsonless/db/server` ise specification'ı PostgREST filtresine çevirir. Bu
sayede `paid_at`, iptal ve `comp` kurallarının TypeScript ve sorgu string'i
olarak birbirinden bağımsız drift etmesi engellenir. Legacy null ödeme yöntemi
`IS DISTINCT FROM comp` davranışıyla tahsilata dahil kalır.

Orders Board SSR okuması; sayfalama, soft-delete edilmiş masa etiketi çözümü ve
kitchen credential **varlık** kontrolüyle birlikte `OrdersBoardReadModelPort` sınırına
taşındı. Pano masa detayı da `PanoTableDetailReadModelPort` kullanır. Her iki
application query'si repository çağrısından önce restaurant ve bölüm yetkisini
kontrol eder; cross-tenant replay port çalıştırılmadan reddedilir.

Analytics'in service-role gerektiren ödeme, iptal, anormal kapanış, personel
tahsilatı ve sadakat ham sorguları `AnalyticsReadModelPort` ile
`@garsonless/db/server` adaptörüne taşındı. Dashboard query katmanı yalnız
rapor hesaplama/bucketing yapar; service-role client oluşturmaz. DEV salt-okunur
smoke testinde Test Cafe B ve maf-lounge sonuçlarının yalnız kendi
`restaurant_id` satırlarını döndürdüğü doğrulandı.

## Menu strangler dilimi

Alerjen sözlüğü, diyet beyanı çelişkileri, yerelleştirilmiş sayı ayrıştırma,
alerjen `içerir / eser miktar` ayrımı, marj ve gıda bilgisi review invalidation
kuralları `@garsonless/domain/menu` içine taşındı. Eski
`@garsonless/db/browser` aynı saf projection ve format yardımcılarını açık bir
browser sınırından sunar; eski `@garsonless/db/order-client` compatibility
subpath'i workspace call-site'ları taşındıktan sonra kaldırılmıştır. Yeni UI ve
application kodu browser veya domain girişini kullanır.

Kategori ve ürün create/update/delete, kategori sıralama ve toplu yayın durumu
artık `@garsonless/application/menu` command'lerinden geçer. Command katmanı
tenant + `menu` iznini DB çağrısından önce doğrular; partial ürün update'inde
mevcut beyanlarla yeni patch'i birleştirip diyet çelişkisini, alerjen tekilliğini
ve review zamanını tek yerde hesaplar. Supabase sahiplik sorguları, pozisyon
hesabı ve RPC çağrıları `createMenuCommandPort()` ile `@garsonless/db/server`
sınırındadır. Dashboard server action dosyası yalnız FormData/Zod adapter'ı,
actor çözümü, command çağrısı ve Next cache invalidation taşır; doğrudan tablo
mutation'ı yapmaz.

`MenuManager` için client-shell ayrıştırması iki katmanda ilerledi. Deterministik
kart tonu, arama vurgusu, modifier normalizasyonu ve eksik ürün bilgisi
projection'ı browser-safe helper modülündedir. CSV import state'i, dosya
doğrulaması, parse/import command'leri ve hata raporu üretimi
`useMenuCsvImport` feature hook'una; başlangıç/önizleme yüzeyleri ayrı
presentational overlay bileşenlerine taşındı. Kategori/sub-kategori/arama/sağ
panel türetimleri yan etkisiz `deriveMenuManagerView` projection'ının tek
sahibidir. Ana shell yalnız sayfa orkestrasyonu, editor-exit koruması ve child
component bağlantılarını taşır; CSV command akışını veya görünüm filtreleme
kuralını tekrar etmez.

İkinci MenuManager diliminde kategori workspace'i shell'den ayrıldı.
`MenuCategoryWorkspace` kategori add/edit/sub-category/delete ve lazy DnD
yaşam döngüsünü sahiplenir; `menu-category-workspace-model.ts` parent-search
fold'u, aktif üst kategori, özet ve recursive descendant kapsamını saf olarak
hesaplar. Böylece aramada eşleşen alt kategori üst kategorisini kaybetmez ve
silme yalnız doğrudan çocuğu değil bütün ağacı kapsar.

Ürün düzenleyici snapshot karşılaştırması `menu-item-editor-model.ts` sahibidir.
Inherited VAT/istasyon backing değerleri yalancı dirty üretmez; nested nutrition,
image ve modifier alanları aynı kuraldan geçer. `MenuItemEditorFrame` panel
header/scroll/footer/overlay kabuğunu, `MenuConfirmDialog` ortak doğrulama
yüzeyini taşır. Ana shell ürün seçiminden çıkış korumasını ve command
callback'lerini orkestre eder; panel chrome veya dirty equality kuralını taşımaz.

`ThemeEditorClient` preview diliminde iframe iletişimi ayrı bir feature sınırına
alındı. `useThemePreviewBridge`; hedef origin doğrulaması, preview handshake'i,
request korelasyonu, timeout/degraded fallback ve reload yaşam döngüsünün tek
sahibidir. Iframe loading/ready yüzeyi ile editor topbar'ı salt-props view
bileşenleridir. Shell yalnız tema state'i, history, panel seçimi ve publish
orkestrasyonunu taşır; browser event listener'ı veya preview timer/ref yönetmez.
Origin fallback'i saf testlerle, gerçek preview handshake'i ise Test Cafe B
owner session ile salt-okunur runtime turunda doğrulanmıştır.

Theme editor'ın ikinci diliminde page-flow command/projection kuralları ve
property panel projection'ı shell'den ayrıldı. `theme-page-flow-model.ts`
stored/legacy blokları normalize eder, kategori scope invariant'larını ve
parent+child atomik hareketini uygular; drag/keyboard UI aynı saf komutu çağırır.
`theme-editor-properties-model.ts` tab sınıflandırması ile koşullu alan
görünürlüğünün tek sahibidir. `ThemePropertiesFrame` ise başlık, erişilebilir tab
semantiği, scroll yüzeyi ve reset footer'ını salt-props view olarak taşır. Bu
ayrım theme registry sözleşmesini veya publish endpoint'ini değiştirmez.

Theme editor'ın üçüncü diliminde Header, Kartlar, Navigasyon, Düzen, Tema,
Sepet ve Duyuru renderer'ları ile ortak property kontrolleri
`ThemePropertyPanels` view sınırına taşındı. Kontrast/soft-color hesapları,
güvenli control id üretimi ve header/footer sepet erişiminin karşılıklı dışlama
invariant'ı `theme-property-renderer-model.ts` saf modelindedir. Tiled kontroller
`aria-pressed` ile seçim durumunu erişilebilir olarak duyurur. Ana shell panel
seçimi, history ve publish orkestrasyonunu korur; renderer markup'ı veya sepet
tetikleyici kuralını tekrar etmez.

Theme editor'ın dördüncü diliminde özel bölüm ayarları
`ThemeSectionSettings` feature sınırına taşındı. Hedef türü, promo-slide
default/visibility kapıları, combo kart/ikon sınırları, control id ve menü
gruplaması `theme-section-settings-model.ts` saf projection'ıdır. Galeri upload
adaptörü bu feature içinde kalır; ana shell storage client veya section control
markup'ı bilmez. Bozuk stored sayılar sınırlı fallback ile fail-closed çözülür;
erişilebilir buton, `aria-pressed` ve range/output semantiği view sınırında
korunur.

`TablesBuilderShell` QR stil diliminde browser-safe stil modeli ile yan etkili
editor yaşam döngüsü ayrıldı. `tables-builder-model.ts`; normalize/default,
revocable-token URL üretimi, kontrast ve immutable history kurallarının tek
sahibidir. `useQRStyleEditor`; history pointer'ı, debounce autosave,
latest-pending-save kuyruğu, unload guard ve QR sağlık doğrulamasını yönetir.
Okunabilirlik dialog'u salt-props view'dır. Böylece shell masa/session/realtime
orkestrasyonunu sürdürürken QR stil iş akışını veya history kuralını tekrar
taşımaz. Saf model matrisi ve Test Cafe B snapshot→restore runtime turu,
autosave/undo davranışının sınır ayrımından sonra değişmediğini doğrular.

İkinci Tables diliminde açık-session ve service-request canlılığı
`useTablesLiveState` feature sınırına alındı. Hook access-gated query/command
çağrılarının, stale-response sequence guard'larının ve iki Supabase Realtime
channel'ının tek sahibidir; payload'ları state olarak kabul etmek yerine yalnız
invalidation sinyali sayar ve authoritative aggregate'i yeniden okur. Masa
occupancy fold'u, request gruplama/çıkarma ve unpaid/split-cash settlement guard'ı
saf modelde test edilir. Shell yalnız dönen state/command'leri TablesNav ve
SettlementSheet'e bağlar. Test Cafe B read-only turunda DB/UI sayıları, dört
postgres subscription ve değişmeyen tenant snapshot'ı birlikte doğrulanmıştır.

## Loyalty strangler dilimi

Tier merdiveni sanitizasyonu, config çözümü, restaurant/network scope seçimi,
puan ve damga kazanımı, `comp` ödeme istisnası, ücretsiz ödülün yeniden damga
kazanamaması ve indirim sırası artık `@garsonless/domain/loyalty` içindeki saf
policy'lerdir. DB modülü bu policy'leri compatibility için yeniden export eder;
aynı ekonomi kuralının ikinci bir TypeScript kopyasını taşımaz.

Supabase Auth kullanıcısı app adapter'ında `customer-member` context'ine
çevrilir. Üye bakiyesi ve server-authoritative indirim önizlemesi
`@garsonless/application/loyalty` query'lerinden geçer. Query, customer id'yi
body'den almaz; doğrulanmış context'ten türetir, başka tenant replay'ini port
çalışmadan reddeder ve guest redemption alanlarını sıfırlar. Supabase sorguları
`createLoyaltyQueryPort()` ile `@garsonless/db/server` sınırındadır.

Write-side diliminde settlement/served kazanımı, iptal iadesi, normal oturum
ziyareti ve welcome bonus doğrudan call-site yan etkisi olmaktan çıkarılıp typed
domain event + `loyalty-ledger` consumer sınırına alındı. `comp` yine hiç
kazanmaz. Ledger unique sınırları ve consumer receipt birlikte crash/retry
idempotency'sini korur; eski best-effort DB fonksiyonları yalnız compatibility
wrapper olarak kalır. Eski telefon OTP export'larının kaldırılması compatibility
retirement dilimidir.

## Customer CRM strangler dilimi

Müşteri liste/detay read model tipleri, PII maskeleme ve kaydedilmiş segment
tanımının sanitizasyonu artık `@garsonless/domain/customers` sahibidir.
`packages/db/src/customers.ts` eski importlar için compatibility export'u tutar,
fakat ikinci bir maskeleme veya segment kuralı kopyası taşımaz.

Dashboard müşteri listeleme, built-in segment sayıları, kayıtlı segment CRUD,
müşteri detayı ve manuel puan kredisi
`@garsonless/application/customers` query/command'lerinden geçer. Her query ve
command doğrulanmış `dashboard-member` context'inde aynı restaurant ve
`customers` iznini repository çağrısından önce kontrol eder. Segment `created_by`
ve manuel kredi `granted_by` kimlikleri request gövdesinden değil actor
context'inden türetilir.

Service-role CRM sorguları `createCustomerApplicationPort()` ile
`@garsonless/db/server` sınırındadır. Customers SSR sayfaları ve server
action'ları artık doğrudan service-role CRM fonksiyonu çağırmaz. Campaign
audience, customer auth linking ve consent persistence takip eden dilimde
aşağıdaki ayrı command/application sınırlarına taşınmıştır.

DEV throwaway runtime matrisinde auth-linked customer association, maskeli
liste/detay, segment create/update/delete, 25 puan manuel kredi, built-in
segment sayıları ve cross-tenant erken ret doğrulandı. Restaurant, customer ve
segment temizlik sorgularının tamamı sıfır orphan döndürdü.

## Customer identity, consent ve campaigns strangler dilimi

Supabase Auth provider payload'ı uygulama sınırında nötr `CustomerAuthIdentity`
sözleşmesine çevrilir. `ensureCustomerIdentity` email normalizasyonu ve isim
çözümünden sonra gerekli adımları sabit sırayla orkestre eder: customer link,
JWT metadata damgası, tenant association, welcome bonus ve yalnız affirmatif
consent. Email/auth yarışını çözen service-role sorguları
`createCustomerIdentityApplicationPort()` içindedir; application katmanı
Supabase `User` veya admin client bilmez.

Member consent değişikliği doğrulanmış `customer-member` context'iyle çalışır.
Customer id request gövdesinden alınmaz ve cross-tenant replay repository
çağrılmadan reddedilir. Consent grant/revoke işlemi ilgili restaurant association
kaydını da idempotent tutar; böylece auth dışındaki consent aktivitesi CRM
aday kümesinden kaybolmaz.

Campaign audience vocabulary, SMS metin sınırı ve audience normalization
`@garsonless/domain/campaigns` sahibidir. Dashboard read/preview/test/send
çağrıları `@garsonless/application/campaigns` üzerinden geçer; `createdBy`
doğrulanmış dashboard actor'ından türetilir ve service-role sorguları
`createCampaignApplicationPort()` arkasındadır. Gönderim komutu kampanya,
recipient snapshot'ı ve `campaign.delivery_requested` event'ini
`queue_campaign_delivery_atomic` RPC'sinde tek transaction'da yazar.
`campaign-sms` consumer recipient'ı atomik claim eder; terminal event ve kampanya
sayacı RPC'lerle tamamlanır. Provider çağrısı sırasında process kaybında sonucu
bilinmeyen `processing` recipient otomatik yeniden gönderilmez; maliyetli çift SMS
yerine gözlemlenebilir `failed/unknown` sonucu tercih edilir.

## Theme strangler dilimi

Tema alanlarının kanonik ve browser-safe sözlüğü `@garsonless/design-engine`
içinde kalır. `resolveTheme` editör SSR, menu layout, ana menu ve masa menu
yollarının template seçimi ile kayıtlı token sahipliği kuralını tekleştirir.
`sanitizeThemeTokens` yalnız bilinen alanları kabul eder; renk ve font gibi
CSS'e taşınan değerleri doğrular, sayı aralıklarını sınırlar ve büyük/bozuk
theme dokümanını fail-closed reddeder.

Dashboard tema okuma/yayınlama akışları `@garsonless/application/themes`
üzerinden geçer. Application katmanı tenant + `theme` iznini repository
çağrısından önce kontrol eder ve publisher kimliğini actor context'inden
türetir. Supabase sorguları `createThemeApplicationPort()` ile
`@garsonless/db/server` arkasındadır. Template picker yalnız editör/preview
rotasını değiştirir; kullanıcı **Yayınla** demeden canlı template'i değiştirmez.

`publish_theme_config_atomic` RPC'si `theme_configs.tokens`, publisher audit'i
ve `restaurants.settings.active_template_id` güncellemesini tek transaction'da
yapar; ilgisiz settings anahtarlarını korur. Tekrar yayın aynı config satırını
upsert eder. RPC yalnız service role'a açıktır. DEV throwaway matrisinde publish,
retry, ortak public resolver, CSS-shaped değer sanitizasyonu, cross-tenant ve
anon ret, başarısız publish rollback'i ile sıfır orphan cleanup doğrulanmıştır.

## Sınır kuralları

1. Yeni uygulama yazmaları application command olmadan doğrudan DB kuralı
   taşımaz.
2. Service-role yalnız `@garsonless/db/server` için yeni kodda erişilebilir.
   Root barrel `createServiceClient` export etmez; ESLint bu eski importu hata
   olarak reddeder.
3. Para, fiyat, indirim, sadakat ve order transition kararları saf policy veya
   atomik RPC'de tek sahipli olur.
4. UI state iş kuralı değildir; büyük editor shell'leri feature state,
   presentational view ve command hook katmanlarına ayrılır.

## Sonraki dilimler

1. DB içindeki eski compatibility wrapper'larını, çağrı sahibi domainlerin
   repository implementasyonlarına dönüştürüp dosya bazında ölçümlü kaldırmak.
   App runtime importları artık bu wrapper'lara root barrel üzerinden ulaşamaz.
   Geniş anon order/session/share okumaları ve legacy customer session/OTP yolu
   kaldırıldı.

## Legacy customer auth retirement

Müşteri kimliği yalnız Supabase Auth email OTP/OAuth session'ından çözülür.
Telefon OTP route'ları, dev-code echo, `gl_member` JWT/cookie modülü ve menu
uygulamasının `CUSTOMER_SESSION_SECRET`/SMS boot kelepçesi kaldırıldı. SMS
provider yalnız dashboard campaign delivery adaptörü olarak kaldı; login
akışının parçası değildir.

`createServiceClient` public DB barrel'ından kaldırıldı. App adapter'ları
service-role client'a ihtiyaç duyduğunda açıkça `@garsonless/db/server`
import eder; browser-safe anon client ve projection'lar
`@garsonless/db/browser` sınırındadır. `@garsonless/db` root entrypoint'i yalnız
type export eder. ESLint runtime root importunu hata olarak reddeder ve yalnız
`import type` kullanımına izin verir. Eski `@garsonless/db/order-client`
subpackage export'u da kaldırılmıştır.

`20260716060000_retire_phone_otp.sql` DEV'e uygulanmıştır ve generated schema
tipleri yenilenmiştir. Migration `public.otp_codes` tablosunu kaldırır ve PROD
deploy migration setine dahil edilmelidir.

## DB compatibility barrel retirement

Uygulama katmanındaki runtime DB bağımlılıkları artık niyeti açık üç sınırdan
birini kullanır:

- `@garsonless/db/server`: service-role repository, RPC ve server adapter'ları,
- `@garsonless/db/browser`: anon client ve browser-safe read projection'ları,
- `@garsonless/domain/*`: saf policy, vocabulary ve iş kuralları.

Root `@garsonless/db` yalnız generated schema ve compatibility sözleşme tiplerini
taşır. Böylece yanlışlıkla service-role üreticisinin client bundle'a çekilmesi ve
app adapter'larının belirsiz infrastructure yüzeyine bağlanması derleme/lint
aşamasında engellenir. Paket export map'inde eski `./order-client` yolu yoktur;
mevcut tüm call-site'lar `./browser` sınırına taşınmıştır.

## Dashboard order lifecycle strangler

Dashboard sipariş durum ilerletme ve iptal akışları artık raw DB fonksiyonlarını
çağırmaz. Adapter doğrulanmış `dashboard-member` context'i üretir;
`transitionDashboardOrder` ve `cancelDashboardOrder` tenant + `orders` iznini
port çalışmadan doğrular. İptal actor kimliği context'ten türetilir, gerekçe
normalize edilir ve nakit/POS gerekçe zorunluluğu ile online/split iade yasağı
`@garsonless/domain/orders` saf policy'sinin sahibidir.

Supabase implementasyonu `createDashboardOrderLifecyclePort()` arkasındadır.
Status compare-and-set ve settle/cancel yarış korumaları package-private atomik
DB primitive'lerinde kalır; böylece application preflight'ı kullanıcı dostu hata
verirken eşzamanlı provider callback'i güvenlik duvarını aşamaz. Raw
`updateOrderStatusDB`, `cancelOrderDB`, `markOrderPaidDB` ve
`validateKitchenToken` artık public server entrypoint'inden export edilmez.

Bu dilimde ayrıca application portlarıyla değiştirilmiş CRM, loyalty, campaign,
service-request ve split helper'larının kullanılmayan raw server export'ları
kaldırıldı. Fiziksel persistence modülleri mevcut port implementasyonlarının iç
detayı olarak kalır; app katmanı bunlara package export map üzerinden erişemez.

## Order creation, checkout ve split-payment strangler

Dashboard sipariş oluşturma artık action içinde fiyat çözmez, service-role RPC
çağırmaz ve doğrudan order insert etmez. Doğrulanmış `dashboard-member`
context'i `createDashboardOrder` command'ine verilir; authoritative menü
snapshot'ı, masa sahipliği, açık adisyon RPC'si ve order insert'i
`createDashboardOrderPort()` arkasındadır. Siparişi oluşturan staff kimliği
yalnız actor context'inden türetilir.

Tek sipariş İyzico başlangıcı `prepareOrderCheckout`, split beyanı/checkout'u
`declareSplitShare` ve `prepareSplitCheckout`, nakit onayı ile callback
settlement'ı ise ayrı `confirmDashboardCashShare` ve `settleProviderShare`
command'lerinden geçer. Staff yalnız nakit payı; İyzico provider yalnız online
payı settle edebilir. Client fiyatı kullanılmaz; persisted order/session
tutarları hesaplanır, yinelenen item referansları tekilleştirilir ve yeni pay
kalan adisyon tutarını aşamaz.

Supabase implementasyonları `createOrderCheckoutPort()` ve
`createSplitPaymentPort()` içindedir. Payment credential/token lookup ve upsert
işlemleri de `payment-provider-port` arkasına taşınmıştır; route ve provider
helper'ları service-role client görmez. Raw `createShareDB` ve `settleShareDB`
server entrypoint'inden kaldırılmış, yalnız repository implementasyon detayı
olarak kalmıştır.

DEV throwaway runtime matrisinde cross-tenant dashboard create erken reddi,
₺80 server fiyatı, online pay clamp + provider settlement retry, ₺40 nakit payda
provider reddi + staff audit'i, iki order'ın `payment_method=split` finalizasyonu,
token mapping ve sıfır orphan cleanup doğrulanmıştır.

## Atomic split checkout ve settlement dilimi

Split checkout artık session toplamını okuyup daha sonra share'i güncelleyen iki
adımlı akışı kullanmaz. `reserve_split_checkout` aynı masa oturumundaki bütün
checkout ve settlement işlemlerini `table_sessions ... FOR UPDATE` kilidiyle
serileştirir. Settled toplamı ile aktif provider rezervasyonlarını birlikte
hesaplar; aynı bakiye iki eşzamanlı checkout'a ayrılamaz. Provider token'ı henüz
bağlanmamış kısa rezervasyon bırakılabilir, fakat token bağlandıktan sonra gerçek
para callback'i gelebileceği için bakiye korunur ve release reddedilir.

`attach_split_checkout_token` share rezervasyonu ile provider token mapping'ini
tenant doğrulaması altında bağlar. Route token mapping yazılamazsa ödeme sayfasını
kullanıcıya dönmez; split rezervasyonunu bırakır ve fail-closed hata üretir. Tek
order checkout da mapping yazılamadığında provider sayfasını döndürmez. Böylece
provider ödeme oturumu ile yerel callback eşlemesi sessizce ayrışmaz.

`settle_payment_share_atomic` declared→settled geçişini, kesin tahsilat tutarını
ve session tam karşılandıysa order'ların `paid_at + split` finalizasyonunu tek
PostgreSQL transaction'ında yapar. `orders` update trigger'ı `order.settled`
outbox event'ini aynı transaction içinde yazar. Nakit settlement, başka bir
online checkout'a ayrılmış bakiyeyi tüketemez; online callback yalnız token ile
bağlanmış `checkout_amount` tutarını kapatır. Retry aynı sonucu idempotent döndürür
ve masa ödeme sonrasında yine açık kalır.

`20260716070000_atomic_split_checkout_and_settlement.sql` ve tam ödeme sonrası
provider token'ı olmayan eski beyanları aynı transaction'da `void` eden
`20260716080000_void_stale_split_intents.sql` DEV'e uygulanmış; generated tipler
yenilenmiştir. İki migration da PROD-at-deploy migration setine eklenmelidir.
Gerçek DEV yarış matrisinde iki paralel ₺80 checkout ₺80+₺20 olarak serileşti,
toplam rezervasyon ₺100 kaldı; release edilen bakiye yeniden kullanıldı, bağlı
rezervasyon release'i reddedildi ve kalan iki stale niyet `void` oldu. Paralel settlement tam bir kez finalize edip
tek `order.settled` outbox satırı yazdı, retry idempotent kaldı, provider'a
ayrılmış ₺30 için nakit settlement reddedildi ve anon RPC `42501` döndü. Throwaway
restaurant/order/share/outbox cleanup sayaçlarının tamamı sıfırdır.

## Atomic single-order checkout ve payment recovery dilimi

Tek sipariş İyzico başlangıcı artık read-then-initialize yapmaz.
`reserve_order_checkout` siparişi `FOR UPDATE` ile kilitler; tenant + masa,
terminal durum, server-authoritative tutar ve mevcut provider token'ını aynı
transaction içinde doğrular. Yalnız lease sahibi request provider oturumu
başlatabilir. `attach_order_checkout_token` lease UUID'sini doğrular ve ilk
token'ı immutable bağlar; farklı token eski mapping'i ezemez.
`release_order_checkout_reservation` yalnız aynı lease'e ve henüz token
bağlanmamış checkout'a izin verir. Ödeme veya iptal checkout koordinasyon
alanlarını trigger ile temizler.

Provider ödemesi başarılı fakat yerel settlement başarısız olduğunda
`payment_reconciliation_events` artık idempotency key, lease, backoff ve
dead-letter alanları taşıyan operasyonel bir kuyruktur. Callback aynı olayı
tekrar yazarsa tek satır güncellenir. `processPaymentReconciliationBatch`
yalnız order/share kimliği bilinen provider-success olaylarını mevcut application
settlement command'leriyle yeniden işler; raw provider token saklanmadığı için
`order_mapping_missing` otomatik çözülmez, görünür biçimde retry/dead-letter'a
ilerler. Menu `/api/internal/payment-reconciliation` endpoint'i ortak
`OUTBOX_WORKER_SECRET` ile korunur. Edge outbox worker'ın her cron çalışmasında
bu kuyruğu da tetiklemesi için deployment secret'larına
`PAYMENT_RECONCILIATION_URL=https://<menu>/api/internal/payment-reconciliation`
eklenmelidir.

`20260716090000_atomic_order_checkout_and_reconciliation.sql` DEV'e
uygulanmıştır ve generated tipler yenilenmiştir; migration PROD-at-deploy setine
eklenmelidir. Gerçek DEV yarış testinde iki paralel checkout'tan **1 winner + 1
kilit reddi**, farklı lease release reddi, token replacement reddi ve token-bound
release reddi doğrulandı. Duplicate reconciliation insert aynı UUID'yi döndürdü;
iki paralel worker toplam **1 claim / 1 resolve** yaptı, sipariş
`payment_method=iyzico` olarak settle oldu ve checkout lease alanları temizlendi.
Anon RPC `42501`; throwaway restaurant/order/reconciliation/outbox cleanup
sayaçlarının tamamı sıfırdır.
