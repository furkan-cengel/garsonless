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

`claim_domain_outbox` `FOR UPDATE SKIP LOCKED` kullanır; worker lease alır,
işler ve `ack_domain_outbox` ile tamamlar. `domain_outbox_receipts` tüketici
başına idempotency sınırıdır. İlk `outbox-worker` operational projection
receipt yazar; KDS, bildirim ve analitik consumer'ları bu delivery sınırına
ayrı consumer adıyla eklenir. Hatalar exponential backoff ile yeniden
planlanır; sekizinci başarısız claim event'i dead-letter durumuna taşır.
`requeue_domain_outbox` yalnız açık bir operasyon kararıyla poison event'i
tekrar kuyruğa alır, `get_domain_outbox_health` ise pending/ready/leased/dead
sayısını ve en eski event gecikmesini verir.

Worker deploy öncesi iki secret gerekir:

- `SUPABASE_SERVICE_ROLE_KEY`
- `OUTBOX_WORKER_SECRET`

Scheduler, Edge Function'a `x-outbox-secret` header'ı ile istek atar. URL ve
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
application katmanında, atomik para guard'ı `close_table_session_atomic`
RPC'sinde, visit/split-share yan etkileri ise `@garsonless/db/server`
adaptöründe tek yoldur.

Public hızlı masa isteği ham `restaurantId` veya `tableId` kabul etmez. Route,
opaque QR token'ı çözer; command doğrulanmış context ile input'taki restaurant,
internal table ve token üçlüsünü yeniden eşleştirir. İstek türü ve kullanıcı
etiketi artık browser-safe domain sözlüğüdür. Pending type/table unique index'i
eşzamanlı replay'i tek satıra indirir.

Kitchen SSR board, tek-order refresh ve liste refresh okumaları
`KitchenBoardPort` üzerinden yapılır. Token adapter'da doğrulanır; application
query yalnız güvenilir kitchen context alır. KDS yazması mevcut
`transitionKitchenOrder` command'ini kullanmaya devam eder; istasyon sahipliği,
çok-istasyon son kontrolü ve yalnız `preparing|ready` hedefleri UI'dan bağımsız
kalır. Kitchen uygulamasındaki doğrudan service-role query modülü kaldırıldı.

DEV throwaway runtime matrisinde servis isteği create+replay throttle+resolve,
normal close, unpaid close reddi, gerekçeli abnormal close ve tek-istasyon
`sent_to_kitchen -> preparing -> ready` zinciri doğrulandı; tenant, QR, session,
order, request, credential, station ve outbox kayıtları cascade ile temizlendi.

## Read-model strangler dilimi

Tahsil edilmiş sipariş semantiğinin tek sahibi artık
`@garsonless/domain/orders` içindeki `COLLECTED_ORDER_SPEC`'tir. Browser
görünümleri aynı policy'yi saf predicate olarak değerlendirir;
`@garsonless/db/server` ise specification'ı PostgREST filtresine çevirir. Bu
sayede `paid_at`, iptal ve `comp` kurallarının TypeScript ve sorgu string'i
olarak birbirinden bağımsız drift etmesi engellenir. Legacy null ödeme yöntemi
`IS DISTINCT FROM comp` davranışıyla tahsilata dahil kalır.

Orders Board SSR okuması; sayfalama, soft-delete edilmiş masa etiketi çözümü ve
kitchen credential okumasıyla birlikte `OrdersBoardReadModelPort` sınırına
taşındı. Pano masa detayı da `PanoTableDetailReadModelPort` kullanır. Her iki
application query'si repository çağrısından önce restaurant ve bölüm yetkisini
kontrol eder; cross-tenant replay port çalıştırılmadan reddedilir.

Analytics'in service-role gerektiren ödeme, iptal, anormal kapanış, personel
tahsilatı ve sadakat ham sorguları `AnalyticsReadModelPort` ile
`@garsonless/db/server` adaptörüne taşındı. Dashboard query katmanı yalnız
rapor hesaplama/bucketing yapar; service-role client oluşturmaz. DEV salt-okunur
smoke testinde Test Cafe B ve maf-lounge sonuçlarının yalnız kendi
`restaurant_id` satırlarını döndürdüğü doğrulandı.

## Sınır kuralları

1. Yeni uygulama yazmaları application command olmadan doğrudan DB kuralı
   taşımaz.
2. Service-role yalnız `@garsonless/db/server` için yeni kodda erişilebilir.
   Eski importlar strangler ölçümüyle taşınır; bir kerede kırılmaz.
3. Para, fiyat, indirim, sadakat ve order transition kararları saf policy veya
   atomik RPC'de tek sahipli olur.
4. UI state iş kuralı değildir; büyük editor shell'leri feature state,
   presentational view ve command hook katmanlarına ayrılır.

## Sonraki dilimler

1. Menu, loyalty, customer, theme strangler geçişi ve büyük client shell'lerin
   parçalanması.
2. Eski session/OTP, compatibility barrel'leri ve dağınık service-role
   importlarının retirement'ı. Geniş anon order/session/share okumaları
   kaldırıldı.
