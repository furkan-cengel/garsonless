# Dashboard Spinner Audit Raporu

**Tarih:** 4 Ağustos 2026
**Kapsam:** Dashboard shell; Pano, Menü, Masalar/QR Studio, Tema, Siparişler, Müşteriler, Raporlar ve Ayarlar
**Karar:** **NO-GO — runtime verification pending**

## Sonuç

Audit'in bütün Blocker/High statik bulguları kod seviyesinde kapatıldı. Production build, dashboard/UI typecheck ve bütün otomatik testler geçiyor. Ancak zorunlu Browser backend listesi boş döndüğü için viewport, reduced-motion ve ağ bozma matrisi çalıştırılamadı. Gerçek UI kanıtı olmadan karar `GO` yapılmadı.

## Kapatılan bulgular

| ID | Önceki durum | Remediation | Statik sonuç |
|---|---|---|---|
| SPN-001 | İki bağımsız navigation göstergesi | Tek `NavigationFeedback`; operation id, URL-key completion ve scoped cancel | Closed |
| SPN-002 | `Math.random()` ile sahte yüzde | 300 ms gecikmeli indeterminate top bar; ölçülmemiş yüzde yok | Closed |
| SPN-003 | Genel route skeleton'ları isimsiz | Türkçe status etiketi, `aria-busy`, dekoratif bloklar ve reduced-motion | Closed |
| SPN-004 | Ortak spinner semantiği/hareketi eksik | `InlineSpinner` dekoratif; `LoadingStatus` canlı durum primitive'i; CSS module | Closed |
| SPN-005 | Kritik düğmeler pending sırasında adını kaybediyor | `Onaylanıyor…` ve `Kapatılıyor…`, disabled + `aria-busy` | Closed |
| SPN-006 | History/image/iframe spinner-only ve sınırsız | İsimli loading; iframe `loading/ready/error/stalled`, 10 sn timeout ve retry | Closed |
| SPN-007 | BrewBar semantiği ve clamp yok | Zorunlu label, progressbar ARIA, finite 0–100 clamp, zero-total indeterminate fallback | Closed |
| SPN-008 | Text-only durumlar duyurulmuyor | Bildirim, Pano, Tema, Ayarlar, müşteri timeline, rapor ve modal durumları busy/live sözleşmesine alındı | Closed |
| SPN-009 | Dağınık animasyon/reduced-motion | Ortak scoped spinner CSS module; dashboard shimmer/spin reduced-motion kuralları | Closed |
| SPN-010 | Spinner/navigation regresyon testi yok | Controller fake-timer, primitive ve kritik yüzey sözleşme testleri | Closed |

## Uygulanan sözleşmeler

- `ShellContext.beginNavigation(targetHref)` aynı/external URL'yi yoksayar ve benzersiz operation id döndürür; `cancelNavigation(id?)` eski işlemin yeni işlemi kapatmasını engeller.
- Pathname ve query birlikte izlenir. Query-only, redirect, geri/ileri veya başka bir URL değişikliği aktif geri bildirimi temizler.
- Gösterge 300 ms'den önce görünmez. 10 saniyede `Tekrar dene` ve `Kapat` içeren recovery durumuna geçer; bütün timer'lar retry, completion, cancel ve unmount'ta temizlenir.
- Ortak spinner görseli `aria-hidden="true"` ve `focusable="false"`; kullanıcıya anlam taşıyan yüklemeler `LoadingStatus` üzerinden duyurulur.
- Route/menu/theme/shell skeleton'ları status/busy semantiğine ve reduced-motion davranışına sahiptir.
- Billing profil, checkout ve abonelik iptal işlemleri ayrı pending durumları kullanır; çakışan mutasyonlar disabled kalır ve yalnız aktif işlem etiketi değişir.
- Gerçek ödeme, logout, push endpoint silme veya geri döndürülemez veri değişikliği çalıştırılmadı.

## Doğrulama kaydı

| Kontrol | Sonuç |
|---|---|
| `pnpm --filter @garsonless/ui test` | PASS — 34/34 |
| `pnpm --filter @garsonless/ui typecheck` | PASS |
| `pnpm --filter @garsonless/dashboard test:architecture` | PASS — 509/509 |
| `pnpm --filter @garsonless/dashboard typecheck` | PASS |
| `pnpm --filter @garsonless/dashboard build` | PASS — production build |
| Localhost restart | PASS — Next dev `Ready`, dashboard route 200 |
| HTTP smoke | PASS — `/auth/login` 200; `/dashboard` 307 → `/auth/login` |
| Navigation lifecycle fake-timer testleri | PASS — delay, stalled, same/query, rapid, scoped cancel, retry, dispose |
| Browser backend discovery | BLOCKED — `[]` |
| Responsive/reduced-motion/ağ runtime matrisi | NOT RUN |

## Kalan GO kapısı

Browser bağlantısı sağlandığında [SCENARIO-MATRIX.md](./SCENARIO-MATRIX.md) içindeki bütün zorunlu hücreler güvenli fixture veya request interception ile çalıştırılmalı ve ekran kanıtları `evidence/` altına yazılmalıdır. Beklenmeyen 4xx/5xx, `pageerror`, takılı spinner, isim kaybı, yatay taşma veya reduced-motion ihlali yoksa karar `GO` olarak güncellenebilir.
