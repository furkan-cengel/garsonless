# Architecture Decision Records

Production yolculuğunun (master roadmap Faz 0) iş kararları. Her ADR bir
platform politikasını kilitler; değişiklik ADR revizyonu gerektirir.

| ADR | Başlık | Durum |
|---|---|---|
| [0001](0001-plan-paket-katalogu.md) | Starter/Plus/Pro/Business kataloğu ve 14 gün Pro trial | Revize (2026-08-14) |
| [0002](0002-abonelik-billing-iyzico.md) | İyzico aylık/yıllık plan referansları + dunning | Revize (2026-08-14) |
| [0003](0003-tenant-lifecycle-ve-askiya-alma.md) | `trial_expired`, suspend davranışı ve retention | Revize (2026-08-14) |
| [0004](0004-platform-admin-ve-destek-erisimi.md) | Platform admin uygulaması ve destek erişimi | Kabul (2026-07-21) |

Kilitli ana kararlar: paketler `starter/plus/pro/business`; fiyat ve özellik
kataloğu `packages/domain/src/entitlements.ts` içinde canonical; 14 gün Pro
trial sonrası ödeme yoksa `trial_expired` ve veri korumalı kilit; Starter/Plus/
Pro için altı İyzico aylık/yıllık referansı; Business satış destekli; platform
admin ayrı app + ayrı aktör modeli.
