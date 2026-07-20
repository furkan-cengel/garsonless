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

## Architecture quality gate

Katman sınırları yalnız dokümantasyonla değil, root script ve CI fitness
testleriyle korunur:

- `pnpm test:architecture`: domain invariant'ları, application command/query
  sözleşmeleri ve dashboard analytics/menu/tables/theme mimari testleri.
- `pnpm check:ci`: lint + tüm workspace typecheck + architecture testleri + DB
  contract/fitness testleri.
- `pnpm check`: aynı CI kapısının ardından production build ve Playwright smoke
  doğrulaması.

`.github/workflows/architecture-ci.yml` pull request ve `main` push'larında
frozen lockfile ile `check:ci` çalıştırır. Workflow yalnız `contents: read`
iznine sahiptir, aynı ref'in eski koşusunu iptal eder ve pnpm store cache'ini
lockfile üzerinden anahtarlar. Testler `node --import tsx --test` ile çalışır;
runner böylece kısıtlı CI ortamlarında ek IPC socket'i açmaz.

İlk gate baseline'ı 318 testtir: domain 27, application 54, dashboard
architecture/model 133 ve DB 104. GitHub branch protection/ruleset içinde
`Architecture gate` status check'i ayrıca required yapılmalıdır; workflow
dosyası tek başına merge politikasını zorunlu kılmaz.

## Dashboard insights read models

Pano, Analytics ve Orders board aynı veri tabanını kullanır; fakat app
katmanında Supabase sorgusu kurmaz. Orders board kendi portunu, Pano ve
Analytics ise `DashboardInsightsReadModelPort` sözleşmesini kullanır:

```text
Dashboard page/action
  -> trusted DashboardActorContext
  -> application read query (tenant + section gate)
  -> @garsonless/db/server read-model adapter
  -> narrow Supabase projection
```

Pano/Analytics adapter'ı order volume, collected order, table reference, table
performance ve Pano operational snapshot okumalarını açık tiplerle sunar.
Owner-only payment credential durumu application katmanında trusted `isOwner`
authority ile fail-closed korunur. App query modülü `orders`,
`table_sessions` ve `payment_credentials` tablolarını doğrudan sorgulayamaz;
architecture fitness testi bu sınırı denetler.

Tahsilat semantiğinin tek sahibi domain'deki `COLLECTED_ORDER_SPEC`'tir. DB
adapter bu specification'ı `applyCollectedOrderFilter` ile PostgREST sorgusuna
çevirir; UI veya dashboard query helper'ı aynı kuralı tekrar yazmaz. Pano ve
Analytics gelir zaman serileri tahsilat anını `paidAt` üzerinden yorumlar.
Aktivite gibi dar kullanım senaryolarında limit ve iptal filtresi DB'ye itilir;
metrik gerekmeyen masa durumu okumaları tarihsel session verisini çekmez.

Read-side fiziksel olarak da feature sınırlarına ayrılmıştır:

```text
apps/dashboard/lib/
  queries.ts                         # 221 satırlık compatibility facade
  queries/
    insights-shared.ts               # actor/tenant/timezone/ortak fold
    analytics.ts                     # Analytics read queries
    analytics-operations.ts          # owner/operasyon raporları
    pano.ts                          # Pano snapshot ve widget query'leri
```

Yeni page ve action call-site'ları doğrudan feature modülünü import eder.
`queries.ts` yalnız eski ve genel restaurant/menu/theme/table tüketicileri için
geçici compatibility re-export'u taşır. Feature modüllerinin parent facade'a
import yapması yasaktır; böylece circular dependency ve facade üzerinden
gizlenen domain bağımlılığı oluşmaz. Architecture fitness testleri dosya satır
bütçelerini, bu import yönünü ve app katmanında service-role/geniş tablo sorgusu
yasağını birlikte denetler.

Read-side repository/RPC projection contract'ları ile query
latency/partial-failure telemetrisi aynı adapter sınırında tutulur. Amaç kolon
veya semantik drift'ini production UI'da sessiz boş widget olarak görünmeden
önce yakalamaktır.

## Dashboard read-model contract ve gözlemlenebilirlik

Dashboard insights repository'sinin seçtiği kolonlar
`dashboard-read-model-contract.ts` içinde açık projection sözleşmeleridir.
Adapter `.select('*')` kullanamaz; sözleşme testi her projection anahtarının
adapter tarafından gerçekten tüketildiğini ve kolon setinin bilinçli değişiklik
olmadan genişlemediğini doğrular.

Her insights read aşağıdaki typed gözlemi üretir:

```ts
type DashboardInsightsQueryOutcome = "success" | "degraded" | "failure";

interface DashboardInsightsQueryObservation {
  operation: DashboardInsightsOperation;
  restaurantId: string;
  durationMs: number;
  outcome: DashboardInsightsQueryOutcome;
  issueCount: number;
  error?: string;
}
```

`pano-operational` birden çok bağımsız kaynağı birleştirdiği için Result başarılı
olsa bile alt kaynak hatası varsa `degraded` olarak gözlenir. Repository Result
hatası ve beklenmeyen exception `failure` olur. Observer çağrısı best-effort'tür;
metric/log altyapısının çökmesi kullanıcı sorgusunu bozamaz. Varsayılan observer
yalnız degraded/failure veya 1.000 ms üzeri okumaları server loguna structured
event olarak yazar; başarılı hızlı okumalar loglanmaz.

Kalıcı adapter `dashboard_query_observations` tablosunu kullanır. Yalnız
`degraded`, `failure` veya varsayılan olarak 1.000 ms ve üzeri başarılı okumalar
yazılır; normal hızlı sorgular depolama maliyeti üretmez. Tablo service-role
sınırındadır, RLS açıktır ve anon/authenticated rollere policy verilmez. Sink
insert'i veya structured-log fallback'i başarısız olsa bile query sonucu ve
exception semantiği değişmez.

`20260718010000_dashboard_query_observations.sql` DEV'e uygulanmıştır ve
PROD-at-deploy migration setine eklenmelidir. Gerçek Test Cafe B matrisi order
volume, collected order, table reference, table performance ve Pano operational
projection'larını çalıştırdı; beşi de `success`, Pano kaynak hataları sıfırdı.
İşaretli gerçek failure observation satırı service-role ile yazıldı, anon read
reddedildi ve cleanup sonrasında orphan sayısı sıfır kaldı.

`20260718020000_dashboard_query_observation_operations.sql` bu ham event
kaynağının operasyonel sınırını tamamlar. `get_dashboard_query_observation_health`
varsayılan 15 dakikalık ve en fazla 7 günlük pencerede operation bazlı aggregate
sayılar ile p95 süre döndürür; restaurant kimliği ve ham error payload'u dışarı
çıkmaz. RPC yalnız service-role'a açıktır. Application tarafındaki saf alarm
projection'ı failure/degraded/p95 metriklerini warning ve critical eşiklerine
çevirir; CLI health entrypoint'i alarm varsa non-zero exit üretir.

Observation retention süresi 30 gündür. Service-role-only prune RPC'si pg_cron
tarafından her gün 03:17 UTC'de çalıştırılır; job migration tekrarlarında aynı
isimle yenilenir. Linked DEV runtime matrisinde Test Cafe B için p95 1.800 ms ve
tek failure iki warning alarmı üretti, 31 günlük fixture prune edildi, anon health
ve prune çağrıları reddedildi ve cleanup sonrası orphan sıfır kaldı. Her iki
observation migration'ı PROD-at-deploy setinde birlikte uygulanmalıdır.

Health entrypoint'i `.github/workflows/dashboard-insights-health.yml` ile her 15
dakikada çalışan ve manuel tetiklenebilen deploy alarmına bağlanmıştır. Job
warning/critical için non-zero, RPC erişilemezse `unavailable` sonucu üretir.
Opsiyonel HTTPS webhook payload'u yalnız aggregate alert alanlarını ve
deterministik fingerprint'i taşır; tenant kimliği ve ham altyapı hatası taşımaz.
Webhook teslim hatası scheduler'da ayrı bir exit code ile görünür kalır. Workflow
push sonrasında `DEV_SUPABASE_URL` ile `DEV_SUPABASE_SERVICE_ROLE_KEY` repo
secret'larını gerektirir; webhook secret'ı opsiyoneldir.

Dashboard'ın eski `lib/queries.ts` compatibility facade'ı da emekliye
ayrılmıştır. Restaurant access, menu management, theme editor refs ve tables
SSR okumaları ayrı feature query modüllerine taşınmış; Pano ve Analytics UI type
tüketicileri doğrudan kendi feature girişlerine bağlanmıştır. Architecture
fitness testi genel barrel'ın veya importsuz tek-file query topluluğunun geri
gelmesini engeller.

Bu feature girişlerinin içindeki doğrudan Supabase okumaları da sonraki
strangler diliminde taşınmıştır. Restaurant portföyü, menu management,
theme-editor referansları ve tables için güncel zincir şudur:

```text
apps/dashboard/lib/queries/<feature>
  -> trusted dashboard user/member context adapter
  -> @garsonless/application feature read handler
  -> @garsonless/db/server feature read-model port
  -> narrow Supabase projection
```

Portföy sorgusu yalnız authenticated user bağlamını kullanır; restaurant kapsamlı
okumalar açık owner veya aktif membership ile kurulan `DashboardActorContext`
gerektirir. Application katmanı restaurant eşitliğini ve `menu`, `theme` ya da
`tables` section yetkisini tekrar kontrol eder. DB adapter'ı auth, permission
ve HTTP bilgisi bilmez; yalnız repository/projection implementasyonudur.

Bu sınır application ve DB contract testleriyle, dashboard architecture fitness
testiyle ve Test Cafe B üzerinde yalnız-okunur runtime matrisiyle doğrulandı:
restaurant/portfolio, menu (**4 kategori, 6 ürün, 0 istasyon**), theme (**4
kategori, 6 ürün**) ve tables (**3**) yeni handler zincirinden döndü. Bu dilim
migration veya tenant veri yazısı içermemektedir. Sıradaki operasyon dilimi
settings ve customers SSR okumalarını aynı port sınırına almak, ardından kalan
dashboard direct-query call-site'larını feature bazında emekliye ayırmaktır.

Persistent observation tablosu ürün trafiğinin uzun vadeli metriği veya limitsiz
audit deposu değildir.

## Settings ve Customers SSR query sınırı

Settings sayfasının ilk SSR snapshot'ı aynı actor-aware read sınırına alınmıştır:

```text
Settings page
  -> getDashboardFeatureContext / authenticated-user adapter
  -> readDashboardSettings (tenant + settings section policy)
  -> createDashboardSettingsReadModelPort
  -> kitchen credential, owner-only station/team ve user-scoped security event projections
```

Owner dışındaki `settings` üyeleri credential varlığını ve kendi güvenlik
geçmişini görebilir; istasyon ve ekip listesi application katmanının verdiği
`includeOwnerData` bayrağı olmadan adapter'dan hiç istenmez. Security event
okuması service-role olsa da doğrulanmış dashboard user ID'sine açıkça
scope'ludur; secret/credential değeri hiçbir zaman SSR props'a geçmez.

Customers liste ve detay sayfaları halihazırdaki customer application portlarını
kullanıyordu; bu dilimde bunların elle kurulmuş actor nesnesi ortak trusted
`getDashboardFeatureContext` ile değiştirildi. Böylece customer query'leri de
restaurant, menu, theme, tables ve settings ile aynı tenant/permission context
çözümleme yolunu paylaşır.

Test Cafe B read-only runtime turunda Settings snapshot'ı kitchen credential
**var**, **0** station, **1** team member ve **20** security event; Customer
liste portu **2** toplam kayıt ve ilk sayfada **1** kayıt döndürdü. Bu değişiklik
migration veya tenant veri yazısı içermemektedir.

## DB explicit type surface

`@garsonless/db` artık kök entrypoint yayınlamaz. Shared generated schema ve
database-adjacent type'lar yalnız `@garsonless/db/types` üzerinden alınır;
runtime erişimi için tüketicinin kasıtlı olarak `server` veya `browser`
seçmesi gerekir. Dashboard, menu, kitchen ve UI'daki type tüketimleri bu açık
yola taşınmıştır.

DB public-boundary testi `types` yüzeyinin type-only kalmasını, kök export'un
geri gelmemesini ve uygulama kaynaklarının eski `@garsonless/db` import'una
dönmemesini denetler. Böylece browser bundle'a yanlışlıkla server capability
taşınması için bir belirsiz giriş noktası kalmaz.

## Application root-barrel retirement

`@garsonless/application` private paketi artık belirsiz bir kök barrel
yayınlamaz. Dashboard, menu, kitchen ve DB adapter'ları bir use-case'i yalnız
açık feature yolu üzerinden (`@garsonless/application/orders`,
`@garsonless/application/tables` vb.) tüketir. Public-boundary testi hem kök
export'un geri gelmesini hem de kök import kullanımını engeller.

Bu değişiklik bir davranış veya veri dönüşümü değildir: bağımlılık yönünü
görünür kılar ve yeni application feature'larının sahiplik yolunu zorunlu
hale getirir. `@garsonless/db` type tüketimleri de artık açık `types`
entrypoint'indedir.

## Dashboard feature read contracts ve projection disiplini

Dashboard feature read portları endpoint veya ekran adına bağlı belirsiz
okumalar yerine ortak bir operation vocabulary taşır. Örnek operation'lar
`restaurant.portfolio`, `menu.management`, `menu.kitchen-stations`,
`theme.menu-references`, `tables.list` ve `settings.snapshot`tır.

```text
Dashboard SSR adapter
  -> trusted DashboardActorContext
  -> application read handler + operation policy
  -> feature read-model port({ restaurantId, operation })
  -> DB projection contract
```

Section izni application katmanında operation policy ile değerlendirilir; DB
adapter yalnız doğrulanmış restaurant ve dar read-model girdisini uygular.
Feature adapter sorgularındaki `select('*')` kullanımı kaldırılmıştır. Her
projection açık alan listesiyle sabitlenir; masa projection'ı kullanılmayan
`qr_code_url` kolonunu özellikle taşımaz. Böylece UI'da gereksiz veri yayılımı
ve şema drift'i contract testinde görünür hale gelir.

## Dashboard direct-read retirement

Dashboard query feature ağacı için direct-read envanteri tamamlanmıştır.
`insights-shared` içindeki son app-level `restaurants.timezone` sorgusu da
mevcut restaurant read portu üzerinden çözülür. Query feature modülleri artık
Supabase client, `.from()` veya `.rpc()` çağrısı kuramaz; architecture fitness
testi bu yasağı query ağacının tamamında denetler.

Dashboard uygulamasında kalan authenticated Supabase client kullanımları
bilinçli HTTP/Auth adapter'larıdır: oturumdaki user'ı çözmek, OAuth code'u
session'a çevirmek ve invite e-postasını signed-in identity ile karşılaştırmak.
Bu çağrılar domain verisi veya service-role repository okuması değildir;
application/DB read-model sınırı için bypass oluşturmaz.

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

Tables/Kitchen compatibility retirement diliminde dashboard masa CRUD, QR
token listeleme/rotasyon ve stil kaydı `DashboardTablePort` arkasına alındı.
Dashboard actor'ı tenant + `tables` izniyle application katmanında doğrulanır;
rotation audit kimliği context'ten türetilir ve QR base URL yalnız doğrulanmış
restaurant slug ile sabit menu origin'den üretilebilir. Menu table page ve
table-state/order/order-status/payment/split/service-request route'ları raw QR
helper'ı yerine `PublicTableQueryPort` kullanır. Bu port token, session ve order
bağını dar projection ile çözer; order-status route'u service-role client
oluşturmaz.

Raw table CRUD/QR fonksiyonları `@garsonless/db/server` public entrypoint'inden
çıkarılmıştır. DB adapter implementasyonu aynı atomik RPC'leri kullanmaya devam
eder, fakat app katmanı bunları import edemez. DEV runtime'da açık-session delete
fail-closed kaldı, rotation eski token'ı ve soft-delete yeni token'ı geçersiz
kıldı; dört anon raw RPC denemesi `42501` aldı ve cleanup sıfır orphan bıraktı.
Temiz KDS browser koşusunda delta insert 2298 ms, terminal tombstone removal
1813 ms sürdü; console error oluşmadı. Bu retirement migration veya HTTP
sözleşmesi değişikliği gerektirmedi.

## Restaurant settings ve stand request boundary

Dashboard app katmanı service-role client oluşturmaz. Generic restaurant
settings ve notification patch'leri `patchRestaurantSettings` command'inden
`RestaurantSettingsPort` adapter'ına gider. Dashboard context'inin açık
`isOwner` authority bilgisi application katmanında owner-only key'ler ile
settings-member allowlist'ini ayırır; tenant veya section uyuşmazlığı port
çalışmadan reddedilir.

`patch_restaurant_settings_atomic` service-role-only RPC'si top-level JSON patch
merge'ini tek PostgreSQL update'ında yapar. UI'nın önce tüm settings belgesini
okuyup sonra geri yazması gerekmez; bağımsız notification, theme, QR veya
loyalty kaydı concurrent bir generic settings save tarafından silinmez. RPC'nin
geniş service-role yetkisi yalnız typed DB adapter içinde kalır.

Fiziksel stand talebi `requestQrStands` orchestration command'idir. DB portu
güvenilir restoran adını okur, restaurant-scoped atomik throttle slotunu claim
eder ve delivery başarısızlığında claim'i koşullu bırakır. Resend provider
adapter'ı yalnız yapılandırılmış talebi HTML'e dönüştürür ve tüm serbest metni
escape eder. Action FormData/Zod, actor çözümü ve result mapping dışında iş
kuralı taşımaz. DEV yarış matrisinde paralel settings patch'leri korundu, stand
replay'i provider'a ulaşmadan throttle edildi ve delivery failure claim'i sıfır
orphan ile bıraktı. `20260717030000_atomic_restaurant_settings_patch.sql`
PROD-at-deploy setine dahildir.

DEV throwaway runtime matrisinde servis isteği create+replay throttle+resolve,
normal close, unpaid close reddi, gerekçeli abnormal close ve tek-istasyon
`sent_to_kitchen -> preparing -> ready` zinciri doğrulandı; tenant, QR, session,
order, request, credential, station ve outbox kayıtları cascade ile temizlendi.

İkinci atomiklik matrisi ayrıca iki paralel servis çağrısında **1 satır + 1
throttle**, provider-bound pay varken `payment_pending` + açık session + korunmuş
share, provider bırakıldıktan sonra aynı transaction'da `void` + abnormal close

- tek close outbox, yanlış istasyonda DB `42501` ve paralel iki ready retry'ında
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

Üçüncü MenuManager diliminde kategori silme/sıralama ile ürün hızlı/bulk yayın
komutlarının optimistic state, rollback ve toast orkestrasyonu
`use-menu-manager-commands` controller'ına taşındı. Recursive kategori ağacı
kaldırma ve hedef ürün patch/fallback kuralları
`menu-manager-command-model` saf projection'larıdır. Ana orchestrator bu server
action'ları import etmez; kategori ve ürün view'larına yalnız typed controller
callback'leri verir. Fitness testi action sahipliğinin shell'e dönmesini, saf
modelin React/infrastructure bağımlılığı kazanmasını ve orchestrator'ın 1.875
satır bütçesini aşmasını engeller.

Dördüncü MenuManager diliminde varyant/modifier grupları, seçenek fiyat ve
kalori farkları ile çoklu alerjen seçicinin bütün görsel yaşam döngüsü
`MenuModifierGroupEditor` salt-props view sınırına taşındı. Bu view tenant,
server action veya Supabase erişimi taşımaz; typed grup dizisini yalnız
`onChange` ile üst editöre geri verir. `MenuManager` modifier state'ini dirty
snapshot ve ürün kaydetme orkestrasyonuna bağlamaya devam eder, fakat alerjen
dropdown ve seçenek editörü markup'ını sahiplenmez. Fitness testi bu izolasyonu
ve ana orchestrator için sıkılaştırılan 1.500 satır bütçesini korur.

Beşinci MenuManager diliminde ürün editörünün bütün feature state'i ve yaşam
döngüsü `MenuItemEditPanel` sınırına taşındı. Ad/açıklama, fiyat/KDV/istasyon,
nutrition, görsel ve modifier state'i; dirty snapshot, `beforeunload` koruması,
storage upload ile save/delete action orkestrasyonu artık tek feature
bileşenindedir. Ana shell yalnız seçili ürün projection'ını panele verir ve
`onSaved`, `onDeleted`, `onDirtyChange` callback'leriyle liste/seçim state'ini
uzlaştırır. Panel browser storage adapter'ını kullanabilir fakat service-role
veya `@garsonless/db/server` erişimi taşımaz. Fitness bütçesi ana orchestrator
için 900 satıra indirilmiştir.

Altıncı MenuManager diliminde ürün workspace'i `MenuItemsWorkspace` feature
sınırına taşındı. Grid/list modu, aktif/pasif filtreleri, alt-kategori tabları,
toplu seçim yaşam döngüsü, hızlı fiyat/yayın aksiyonları ve kart/list/empty
görünümleri aynı tenant-agnostic bileşendedir. Workspace yalnız ürün/category
projection'ları ile typed callback'ler alır; server action, Supabase veya
restaurant kimliği taşımaz. Ana shell hesaplanmış ürün listesini ve command
controller callback'lerini bağlar. Orchestrator fitness bütçesi 450 satıra
sıkılaştırılmıştır.

Yedinci MenuManager diliminde kalan yerel shell state'i
`use-menu-manager-shell-state` controller sınırına taşındı. Arama ve klavye
odağı, kategori/alt-kategori/ürün seçimi, dirty editörden korumalı çıkış,
toast/yeni-ürün state'i ve feature callback'lerinden dönen liste projection
uzlaştırmaları bu hook'un sorumluluğundadır. Topbar, skeleton, empty ve toast
yüzeyleri ise `MenuManagerChrome` salt-props view'larına ayrılmıştır. Her iki
sınır da action, Supabase ve tenant kimliğinden bağımsızdır; ana `MenuManager`
yalnız feature/controller bağlayan 226 satırlık bir composition root olarak
kalır. Fitness testi bu delegasyonu ve 240 satırlık orchestrator bütçesini
korur.

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
Sepet ve Duyuru renderer'ları `ThemePropertyPanels` view sınırına taşındı.
Tekrar kullanılan renk/range/toggle/select/accordion kontrol markup'ı ise
`ThemePropertyControls` sınırındadır; workspace bu kontrol CSS'ini tek kez
yükler. Kontrast/soft-color hesapları,
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
2. Service-role client yalnız `packages/db` implementasyonlarının iç detayıdır.
   App'ler `@garsonless/db/server` üzerinden typed port/adapter alır; ham
   `createServiceClient` bu public yüzeyden de export edilmez ve ESLint olası
   geri dönüşü hata olarak reddeder.
3. Para, fiyat, indirim, sadakat ve order transition kararları saf policy veya
   atomik RPC'de tek sahipli olur.
4. UI state iş kuralı değildir; büyük editor shell'leri feature state,
   presentational view ve command hook katmanlarına ayrılır.

## Sonraki dilimler

1. Kalan büyük client orchestrator'ları ölçerek en yüksek coupling'e sahip
   state/view/command parçalarını ayırmak ve mimari fitness testlerini CI
   `check` kapısına sabitlemek. Geniş anon order/session/share okumaları,
   legacy customer session/OTP yolu ve ölçülmüş DB compatibility facade'ları
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

Root `@garsonless/db` yalnız generated schema ve geçişte gereken sözleşme tiplerini
taşır. Böylece yanlışlıkla service-role üreticisinin client bundle'a çekilmesi ve
app adapter'larının belirsiz infrastructure yüzeyine bağlanması derleme/lint
aşamasında engellenir. Paket export map'inde eski `./order-client` yolu yoktur;
mevcut tüm call-site'lar `./browser` sınırına taşınmıştır.

2026-07-17 retirement diliminde `./browser` wildcard export'u da kaldırılıp
explicit allowlist'e çevrildi. Service-request vocabulary doğrudan
`@garsonless/domain/tables`, menu numeric/nutrition/review policy'leri doğrudan
`@garsonless/domain/menu` sahibi oldu; DB facade dosyaları silindi. Loyalty,
customers ve campaigns persistence modüllerindeki salt domain re-export'ları
kaldırıldı. Sıfır tüketimli customer-auth facade'u emekli edildi ve
`@garsonless/db/server` artık ham service-role client yayımlamıyor. Kaynak-seviye
fitness testleri root'un type-only, browser'ın explicit/browser-safe ve server'ın
port-only kalmasını sürekli doğrular.

## Theme editor UI boundary

Tema editörünün sol navigasyon ve sayfa-akışı görünümü
`ThemeEditorSidebar` bileşenine ayrıldı. `ThemeEditorClient` artık bu bölümü
render etmez; yalnız seçili grup/bölüm, arama, drag state ve page-flow
command'lerini orkestre edip typed callback'lerle sidebar'a verir. Kategori
scope ve sıralama kuralları `theme-page-flow-model` içinde tek kaynak olmaya
devam eder.

Kaynak-seviye fitness testi ana orchestrator'ın sidebar'ı yeniden içine
almamasını, sidebar'ın ortak page-flow modelini kullanmasını ve ana dosyanın
1.400 satırlık decomposition bütçesini aşmamasını doğrular.

İkinci view diliminde template ve section picker modalları
`ThemeEditorDialogs` içine çıkarıldı. Focus trap, modal layout, template kart
metinleri ve plan rozetleri bu view sınırına aittir; modal state'i, template
navigation command'i ve section ekleme command'i `ThemeEditorClient` içinde
kalır. Büyük template/section preview çizimleri render callback ile verilir;
böylece view ayrışırken tema registry veya command ownership'i kopyalanmaz.

Üçüncü view diliminde template telefon çizimleri ve section mini-preview
kataloğu `ThemeEditorPreviewCatalog` içine taşındı. Katalog yalnız typed tema/id
girdisini JSX'e projekte eder; state, effect, action importu ve seçim command'i
barındırmaz. Fitness testi bu render-only sözleşmeyi de korur.

Bu üç dilim sonunda orchestrator 3.011 satırdan 1.772 satıra indi. Davranış ve
persistence sözleşmesi değişmedi; sonraki UI strangler dilimleri için net bir
view/command sınırı oluştu.

Dördüncü dilimde section library, group listesi, yiyecek ikon seçenekleri ve
section settings şeması `theme-editor-section-registry` saf veri kataloğuna
ayrıldı. Registry React/JSX veya app action bağımlılığı taşımaz; ikonlar typed
anahtar olarak tutulur ve yalnız dialog view katmanında component'e çözülür.
Bütünlük testleri section id, group, field key, editor tab ve select option
tekilliğini doğrular. Bu dilim sonunda orchestrator 1.379 satıra indi.

Beşinci dilimde editörün değişiklik yaşam döngüsü
`use-theme-editor-lifecycle` controller hook'una ayrıldı. Controller draft
override'ları, bounded undo/redo geçmişini, dirty-state/navigation guard'ı,
preview bridge mesajlaşmasını ve publish sırasında yeni revizyon oluşması
yarışını tek yerde yönetir. `theme-editor-lifecycle-model` başlangıç override
projeksiyonu, history sınırı ve kaydedilmiş baseline'a göre değişiklik
etiketlerini React'ten bağımsız tutar. Orchestrator logo, dialog, page-flow ve
property UI koordinasyonunun sahibi olmaya devam eder; service action ve preview
bridge'i doğrudan çağırmaz. Kaynak-seviye fitness testi bu sahiplik ayrımını ve
1.250 satırlık yeni bütçeyi korur. Bu dilim sonunda orchestrator 1.233 satıra
indi.

Altıncı dilimde preview çalışma alanı `ThemeEditorCanvas` salt-props view
sınırına ayrıldı. Preview toolbar'ı, degraded durum göstergesi, erişilebilir
zoom kontrolleri, mobil/masaüstü cihaz çerçevesi ve iframe yüzeyi artık ana
orchestrator tarafından render edilmez. Viewport listener'ı, preview mode/scale
state'i ve dış önizleme command'i `use-theme-editor-workspace` controller
hook'una; breakpoint, panel genişliği, zoom clamp ve sığdırma ölçeği kuralları
`theme-editor-workspace-model` saf modülüne aittir. Bu sınırlar action,
Supabase ve tenant kimliği taşımaz. `ThemeEditorClient` 1.036 satıra indi ve
fitness bütçesi 1.050 satıra sıkılaştırıldı.

Yedinci dilimde sağ panel kompozisyonu `ThemeEditorPropertiesWorkspace`
salt-props feature view'ına taşındı. Frame/tab/empty-state, section settings,
özel renderer seçimi ve marka rengi alanları bu sınırda kalır; galeri ve logo
gibi infrastructure kullanan feature'lar yalnız dışarıdan node/callback alarak
bağlanır. Workspace action, Supabase client veya tenant kimliği taşımaz.

Logo persistence ayrı `use-theme-editor-logo` controller hook'unun
sorumluluğundadır; `ThemeLogoUploadCard` yalnız dosya seçimi ve erişilebilir
önizleme yüzeyidir. Böylece ana orchestrator logo action'ını ve upload state'ini
taşımaz. Bu dilim sonunda `ThemeEditorClient` 719 satıra indi ve fitness bütçesi
750 satıra sıkılaştırıldı.

Sekizinci dilimde navigation ve page-flow orkestrasyonu
`use-theme-editor-navigation` controller hook'una ayrıldı. Seçili grup/bölüm,
editor tab'ı, arama ve drag state'i; dialog focus/Escape yaşam döngüsü; template
navigation, section add/remove/settings ve günlük özel expiry davranışı bu
controller'a aittir. Reorder ve kategori-scope invariant'ları yine yalnız saf
`theme-page-flow-model` tarafından üretilir. Controller app action, Supabase
client veya persistence çağrısı taşımaz; yalnız lifecycle controller'ın verdiği
typed theme patch callback'ine konuşur. Bu dilim sonunda `ThemeEditorClient`
516 satıra indi ve fitness bütçesi 550 satıra sıkılaştırıldı.

Dokuzuncu dilimde property panel'in kopyalama ve sıfırlama command'leri
`use-theme-editor-property-commands` controller'ına ayrıldı. Clipboard payload,
section settings removal ve group default patch kuralları browser API'lerinden
bağımsız `theme-editor-property-command-model` içinde test edilir. Kayıt durum
etiketi `theme-editor-shell-model` projection'ıdır; toast markup'ı
`ThemeEditorToast` salt-props view'ında, sidebar grup/ikon üretimi ise
`theme-editor-navigation-catalog` içinde kalır. Ana orchestrator navigator,
confirm, tarih formatlama, toast markup'ı veya ikon katalog kuralı taşımaz. Bu
dilim sonunda `ThemeEditorClient` 388 satıra indi ve fitness bütçesi 420 satıra
sıkılaştırıldı.

Onuncu dilimde kök editör yerleşimi, ortak interaction CSS'i ve toast slot'u
`ThemeEditorShell` salt-props view'ına taşındı. Template ve section picker
kompozisyonu `ThemeEditorDialogsLayer` içinde kalır; ana orchestrator dialog
markup'ı veya preview katalog wiring'i üretmez. Defaults/override birleşimi,
legacy page-block geçişi, kategori-scope normalizasyonu ve geçersiz section
temizliği `theme-editor-preview-theme-model` saf projection'ında tek kaynak
haline getirildi. Bu dilim sonunda `ThemeEditorClient` 307 satıra indi ve
fitness bütçesi 330 satıra sıkılaştırıldı.

## Analytics UI boundary

Analytics ekranının ilk client-shell diliminde rapor/range seçimi, lazy yükleme,
loaded/error/pending state'i ve owner-only Operasyon kapısı
`use-analytics-reports` controller'ına ayrıldı. Controller server action'ı çağırır
ancak report markup'ı taşımaz; istek sırası token'ı hızlı sekme/dönem
değişimlerinde stale yanıtın yeni state'i ezmesini engeller.

Report metadata, dönem etiketleri, ilk yüklenme projection'ı ve export readiness
kuralları `analytics-report-model` içindeki browser-safe saf fonksiyonlardır.
`AnalyticsReportShell` topbar, dönem seçici, owner'a göre filtrelenen sol
navigasyon ve retry/loading chrome'unu salt props üzerinden render eder. CSV
serialization ve browser download adapter'ı `analytics-report-export` sınırında
kalır; spreadsheet formula injection koruması React'ten bağımsız test edilir.
Bu dilim sonunda `AnalyticsClient` 1.403 satırdan 1.050 satıra indi ve fitness
bütçesi 1.080 satıra sıkılaştırıldı.

İkinci Analytics UI diliminde Satışlar ve Ödemeler rapor aileleri
`AnalyticsSalesPaymentReports` feature view'ına taşındı. Trend/heatmap/donut
renderer'ları, tahsilat KPI'ları, ürün sıralaması ve ikramın collected tabandan
ayrı gösterilmesi bu typed view sınırında kalır; action, tenant kimliği veya
Supabase bağımlılığı taşımaz. Ortak `AnalyticsCard` ve `AnalyticsKpi`
presentation sözleşmeleri `AnalyticsReportPrimitives` modülüne ayrıldı ve diğer
raporlar da aynı primitive'leri kullanır. Bu dilim sonunda `AnalyticsClient`
790 satıra indi ve fitness bütçesi 820 satıra sıkılaştırıldı.

Üçüncü Analytics UI diliminde owner-only Operasyon rapor ailesi
`AnalyticsOperationsReport` feature view'ına ayrıldı. İptal trendi, anormal
kapatma dökümü ve personel tahsilat tablosu typed projection'lar üzerinden
render edilir; owner görünürlüğü controller'da, gerçek erişim kontrolü server
query sınırında kalır. Audit delta tonu, trend compaction'ı ve otomatik provider
satırını personel toplamından çıkarma kuralı `analytics-operations-model`
içindeki saf fonksiyonların tek sorumluluğudur. Bu dilim sonunda
`AnalyticsClient` 505 satıra indi ve fitness bütçesi 535 satıra
sıkılaştırıldı.

Dördüncü Analytics UI diliminde Ürünler rapor ailesi `AnalyticsItemsReport`
feature view'ına ayrıldı. ABC tablosu, ürün karması scatter'ı ve hareket
listeleri typed ürün projection'ları üzerinden render edilir; scatter'ın
client-only lazy chart sınırı feature içinde kalır. KPI/A-B-C toplamları,
yükselen/düşen seçimi ve delta etiketi `analytics-items-model` saf
fonksiyonlarının sorumluluğudur; selection input dizisini değiştirmez. Bu dilim
sonunda `AnalyticsClient` 307 satıra indi ve fitness bütçesi 335 satıra
sıkılaştırıldı.

Beşinci Analytics UI diliminde Masalar raporu `AnalyticsTablesReport` feature
view'ına ayrıldı. Tahsilata göre immutable sıralama, aktif masa ile şu-an-açık
oturum ayrımı, kapanan oturum devri ve devir-ağırlıklı süre
`analytics-tables-model` saf projection'ında hesaplanır. Açık oturumlar devir
ve süre hesabına katılmaz; işletme saatleri olmadan doluluk yüzdesi üretilmez.
Bu dilim sonunda `AnalyticsClient` 218 satıra indi ve fitness bütçesi 245
satıra sıkılaştırıldı.

Altıncı Analytics UI diliminde Sadakat raporu `AnalyticsLoyaltyReport` feature
view'ına ayrıldı. Damga, hoş geldin bonusu, iade, ikram ve ledger geçmişi typed
projection üzerinden render edilir. Görünürlük/stat kartı üretimi ile bilinen
redemption reason çevirisi ve bilinmeyen reason'ı ham koruma politikası
`analytics-loyalty-model` içindeki saf fonksiyonların sorumluluğudur. İkram
hareketi tahsilat toplamına karıştırılmaz. Bu dilim sonunda `AnalyticsClient`
109 satıra indi ve fitness bütçesi 130 satıra sıkılaştırıldı.

## Tables builder UI boundary

Tables builder'ın QR style history/autosave ve okunabilirlik yaşam döngüsü
`use-qr-style-editor`, açık session/realtime/service-request yaşam döngüsü
`use-tables-live-state` sahibidir. Üçüncü ayrıştırma diliminde sağ QR Stüdyosu
paneli `TablesQRProperties` callback-driven view sınırına taşındı. Bu view
accordion ve form primitive'leriyle şekil, renk, logo, çerçeve ve URL/UTM
sekmelerini render eder; server action, Supabase client, realtime channel veya
feature hook'u çağırmaz.

Dördüncü ayrıştırma diliminde sol masa navigasyonu `TablesNavigation`, add/rename/
delete command orkestrasyonu `use-table-management` sınırına taşındı. View server
action import etmez; controller persistence adapter'larını çağırır, arama ve
liste projection kuralları browser-safe modelde kalır.

Beşinci ayrıştırma diliminde QR çalışma yüzeyi `TablesQRCanvas`, browser export
ve okunabilirlik adaptörleri `tables-qr-renderer` sınırına taşındı. Canvas view
QR instance'ını ve yerel export state'ini sahiplenir; teknik renderer lazy QR
library yükleme, SVG/raster dönüşümü, `jsQR` doğrulama ve print iframe'i yönetir.
İki sınır da server action, Supabase veya tenant context import etmez.

Altıncı ayrıştırma diliminde preset/save/undo/bildirim topbar'ı, otomatik-kayıt
statusbar'ı ve telefon önizleme overlay'i `TablesBuilderChrome` view sınırına
taşındı. Bu görünüm action, Supabase, realtime veya feature hook'u çağırmaz;
yalnız mevcut notification projection'ı için dashboard shell context'ini okur.

`TablesBuilderShell` settlement ve altı feature sınırının
koordinasyonunu sürdürür. Kaynak-seviye fitness testi QR paneli, navigasyon veya
canvas/chrome görünümünün shell'e geri gömülmesini; view katmanlarına
infrastructure bağımlılığı eklenmesini ve shell'in 350 satır bütçesini aşmasını
engeller. Altı dilim sonunda shell 2.982 satırdan 306 satıra indi; persistence ve runtime sözleşmeleri
değişmedi.

Yedinci ayrıştırma diliminde QR credential rotasyonunun hedef/onay/pending/error
yaşam döngüsü `use-table-qr-token-rotation` controller'ına, erişilebilir ve
yeniden-denenebilir onay yüzeyi `TablesQRRotationDialog` view'una taşındı. Root
shell server action veya native browser confirm çağırmaz. Controller doğrulanmış
dashboard action adapter'ını çağırır; başarılı token'ı saf `replaceTableQrToken`
projection'ı ile yalnız hedef masaya uygular ve eşzamanlı ikinci rotasyonu
engeller. Tenant gate'i ve atomik eski-token iptali application/DB sınırlarında
kalmaya devam eder. Dialog/controller kompozisyonuyla root shell 317 satırdır ve
350 satırlık bütçenin altındadır.

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
