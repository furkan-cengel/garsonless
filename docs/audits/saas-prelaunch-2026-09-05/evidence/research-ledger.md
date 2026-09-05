# Araştırma ve kanıt defteri — 2026-09-05

## Kapsam ve yürütme

Lansman öncesi Masabu; işletmeci/personel/müşteri akışları ve geliştirici bakım maliyeti. Kullanıcının kabul ettiği Markdown rapor ve mevcut çalışma ağacı esas. Öncelikli kaynaklar: mevcut kod ve bu koşudaki test/build; Next 15, W3C, Playwright, Base UI, Supabase ve OWASP resmî kaynakları. Eski audit raporları veya ekran görüntüleri bulgu kanıtı olarak kullanılmadı.

`update_plan` aracı mevcut araç kataloğunda bulunmadı; plan yönetimi bu kayıtta sürdürüldü. Discovery, hedefli takip, sentez ve rapor doğrulaması tamamlandı. Ürünün görsel/browser kabul aşaması engelli ve tamamlanmış sayılmıyor. Deep Research kapsamındaki iki bağımsız kanıt hattı yalnız salt okunur CI/stack ve güvenlik incelemesi yaptı; nihai kritik kaynaklar ve native sürüm ana oturumda ayrıca kontrol edildi.

## İddia / boşluk matrisi

| İddia | Kanıt | Güven | Karşı kanıt / sınır | Sonuç |
|---|---|---|---|---|
| Yeni ürünün mobil editör aşaması eksik | F01 kaynak fonksiyonları + CSS + izole çalıştırma | Yüksek, kod davranışı | React/browser görülmedi | P1; E2E kabul açık |
| Mutfak hata durumunu göstermiyor | Board ve server action hata dalları | Yüksek, statik | Gerçek bağlantı koparılmadı | P1 |
| Notification/CSV rejection bayrağı takılıyor | Gerçek fonksiyon gövdesi, reddedilen action doubles | Yüksek, izole | Gerçek server action taşıma hatası görülmedi | P1 |
| Menü rollback tabanı iyimser state olabiliyor | F04 source probe | Yüksek, izole | Next15 action kuyruğu seri; ters sıra ilk örneğini sınırlıyor | Normal sıralı iki başarısız yanıtla tekrar doğrulandı; P1 |
| 97 test olağan CI dışında | Script/workflow çağrı grafiği + ayrı testler | Yüksek | Testler geçiyor; mevcut kusur oldukları söylenmiyor | CI kapsam açığı |
| Pano/menu/theme browser matrisi PR dışında | Tüm .github workflow dosyaları ve testMatch | Yüksek | Settings ve public browser gate’leri var | Kapsam açığı, test yokluğu değil |
| Rota bütçesi dinamik ilk ekran JS’ini dışarıda bırakıyor | Budget kaynak kodu, loader render, yeni build manifestleri | Yüksek | Transfer/cache/iframe/runtime ölçülmedi | Manifest birleşimi ayrı metrik olarak verildi |
| Text-3 küçük metinde düşük kontrastlı | Kaynak token ve kullanım; WCAG luminance hesabı | Yüksek, token düzeyi | Computed styles ve screenshot yok | P1, tam WCAG sertifikasyonu değil |
| Body limitleri allocation sonrası | Orders/webhook read sırası; mevcut bounded reader karşılaştırması | Yüksek | Proxy sınırı ve canlı kaynak tüketimi belirsiz | Tek P1, canlı DoS iddiası yok |
| Next15.5.21 AVIF advisory aralığında | Next resmî advisory | Yüksek, sürüm aralığı | Aktif sharp0.35.4 / heif1.23.2 yamalı | P0/RCE diye yazılmadı; P2 patch bakımı + prod native doğrulama |
| Telemetri yok | Repo reporter/endpoint dosyaları | Yanlış iddia | Reporter mevcut, structured log çıkıyor | İddia reddedildi; production toplama/retention/alarm açık |
| Mobil QR performansı kötü | Veri yok | Desteklenmiyor | Desktop budget ve SSR build sağlıklı | Kötü olduğu söylenmedi; mobil ölçüm açık |

## Kaynak defteri

Tüm erişimler 2026-09-05. Resmî dokümanlar yaşayan kaynaklardır; görünür tarih bulunmayanlar için tarih uydurulmadı. Native referanslar yalnız iç kanıt eşlemesi içindir.

| Kaynak / yayıncı | Görünür yayın-güncelleme tarihi | URL | Desteklediği iddia | Erişim / native kayıt |
|---|---|---|---|---|
| Production checklist / Next.js | 2025-08-13 | https://nextjs.org/docs/15/app/guides/production-checklist | Version15 üretim/bundle ölçümü | Tam sayfa; turn0view0 |
| Package bundling / Next.js | Yaşayan v15 dokümanı | https://nextjs.org/docs/15/app/guides/package-bundling | Paketleme bağlamı | Açıldı; turn0view1; doğrudan bulgu üretmedi |
| Lazy loading / Next.js | Yaşayan v15 dokümanı | https://nextjs.org/docs/15/app/guides/lazy-loading | Dynamic loading sınırları | Tam sayfa; turn12view2 |
| Updating data / Next.js | Yaşayan v15 dokümanı | https://nextjs.org/docs/15/app/getting-started/updating-data | Server Action dispatch seri; F04 karşı kanıt | Tam sayfa + hedefli find; turn13view0/1 |
| Web Vitals / Google web.dev | Yaşayan doküman | https://web.dev/articles/vitals | Lab/field ve CWV ayrımı | Açıldı; turn0view2 |
| Contrast Minimum / W3C WAI | Yaşayan WCAG2.2 açıklaması | https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html | 4.5:1 normal metin, istisnalar | Tam sayfa; turn7view0 |
| Dialog Modal Pattern / W3C WAI APG | Tarih belirtilmiyor | https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ | Modal focus ve arka plan etkileşimsizliği | Tam sayfa; turn7view1 |
| Accessibility / Base UI | Yaşayan doküman; sayfa güncel sürümü gösterebilir | https://base-ui.com/react/overview/accessibility | Focus altyapısı ve uygulamanın etiket/kontrast sorumluluğu | Tam sayfa; turn12view0; v1.7 API değişikliği önerilmedi |
| Best Practices / Playwright | Tarih belirtilmiyor | https://playwright.dev/docs/best-practices | Görünür davranış ve test izolasyonu | Tam sayfa; turn12view1 |
| Row Level Security / Supabase | Yaşayan doküman | https://supabase.com/docs/guides/database/postgres/row-level-security | RLS gerekçesi; gerçek politika uygulanmışlığını kanıtlamaz | Açıldı; turn0view3 |
| MFA / Supabase | Yaşayan doküman | https://supabase.com/docs/guides/auth/auth-mfa | AAL/server enforcement | Tam sayfa; turn10view1 |
| API4 Unrestricted Resource Consumption / OWASP | 2023 edisyonu | https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/ | Bellek/payload sınırları | Tam sayfa; turn10view0 |
| REST Security Cheat Sheet / OWASP | Tarih belirtilmiyor | https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html | Endpoint ve 413 yaklaşımı | Güvenlik hattı açtı; nihai rapor ana OWASP API4’e dayandı |
| GHSA-2xp9-vwfh-vxw4 / Vercel Next.js | 2026-08-25 | https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4 | Next15.5.24 AVIF optimizer yaması | Tam advisory; turn10view2, turn11view1 |
| GHSA-g89c-p67h-r497 / libheif | Advisory tarihi ana çıktıda teyit edilmedi | https://github.com/strukturag/libheif/security/advisories/GHSA-g89c-p67h-r497 | Native heif1.23.2 karşı kanıt | Advisory; turn11view0 |

## Arama/izleme ve durma gerekçesi

1. Repo manifest, AGENTS, route/loader, workflow, test script ve component envanteri; parola/env içerikleri okunmadı.
2. İlk dış kaynak dalgası: Next15 production/package bundling, Web Vitals, Supabase RLS.
3. Hedefli ikinci dalga: W3C kontrast/dialog, OWASP body sınırı, Supabase MFA, Base UI/Playwright davranış ilkeleri.
4. Güvenlik farkının doğrulanması: Next advisory → özgün libheif advisory → aktif Next bağımlılık yolundan `sharp.versions` kontrolü. Eski pnpm store kopyaları aktif dependency olarak sayılmadı.
5. Sentez spot-check: F04 için Next Server Action seri işleme karşı kanıtı bulundu; source probe normal sıralı iki hata durumuna çevrildi ve tekrar geçti.
6. Durma: Teknik iddialar kod/koşu kanıtıyla destekli; kalan browser/production veri boşluklarını ilave web araması çözemez. Broad teknoloji taraması veya yeni servis/pricing önerisi yapılmadı.

## Browser engeli

Kullanıcı uygulama içi Browser’ı açıkça seçti ve yetki verdi. Runtime bootstrap başarılı; `agent.browsers.get("iab")` kullanılamıyor, `agent.browsers.list()` boş. Bootstrap troubleshooting okundu. Alternatif tarayıcı veya standalone Playwright ile bu tercih aşılmadı. Ekran görüntüsü, cookies, storage veya browser profil erişimi yapılmadı. Yerel production sunucuları loopback’e bağlı başlatıldı; port dinleme için sandbox yükseltmesi kabul edildi.
