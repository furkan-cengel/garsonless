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

Mevcut public table UUID'si geçici table actor kimliği olarak command
sınırındadır. QR token rotasyonu sonraki Tables & Kitchen diliminde bu alanı
opaque, iptal edilebilir token ile değiştirir; route sözleşmesini yeniden
tasarlamak gerekmez.

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
ayrı consumer adıyla eklenir.

Worker deploy öncesi iki secret gerekir:

- `SUPABASE_SERVICE_ROLE_KEY`
- `OUTBOX_WORKER_SECRET`

Scheduler, Edge Function'a `x-outbox-secret` header'ı ile istek atmalıdır.
Bu migration yalnız tablo/RPC/trigger altyapısını kurar; scheduler secret'ı
repo veya migration içine yazılmaz.

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

1. Tables/Kitchen: rotatable QR token, table-session command'leri ve KDS
   transition portu.
2. Read models: pano, analytics ve order-board query modülleri; tahsilat
   semantiği tek specification kaynağından türetilir.
3. Menu, loyalty, customer, theme strangler geçişi ve büyük client shell'lerin
   parçalanması.
4. Eski session/OTP, geniş anon read'ler, compatibility barrel'leri ve
   dağınık service-role importlarının retirement'ı.
