# Architecture Decision Records

Production yolculuğunun (master roadmap Faz 0) iş kararları. Her ADR bir
platform politikasını kilitler; değişiklik ADR revizyonu gerektirir.

| ADR | Başlık | Durum |
|---|---|---|
| [0001](0001-plan-paket-katalogu.md) | Plan & paket kataloğu, trial (14 gün Pro) ve kotalar | Kabul (2026-07-21) |
| [0002](0002-abonelik-billing-iyzico.md) | SaaS abonelik billing: İyzico (tek provider) + dunning | Kabul (2026-07-21) |
| [0003](0003-tenant-lifecycle-ve-askiya-alma.md) | Tenant lifecycle, suspend davranışı, retention | Kabul (2026-07-21) |
| [0004](0004-platform-admin-ve-destek-erisimi.md) | Platform admin uygulaması ve destek erişimi | Kabul (2026-07-21) |

Kilitli ana kararlar: paketler `free/starter/pro/enterprise` (koddaki
`packages/domain/src/entitlements.ts` canonical); abonelik provider'ı İyzico
(tek provider, port arkasında); 14 gün Pro trial → ödeme yoksa free'ye düşüş;
dunning +14. günde otomatik suspend (ayarlanabilir politika); platform admin
ayrı app + ayrı aktör modeli.
