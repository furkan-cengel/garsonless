# Active Product Design Gate — Siparişli Masa Kartı İçerik Yerleşimi

- Source visual truth: user-supplied 2048×1024 Canlı Masalar screenshot in the conversation, with the occupied `Masa 2` card marked as vertically clipped.
- Root cause: the extra amount row introduced by an active order competed for height inside a fixed-size flex card; flex shrinking compressed the label and operational detail line boxes.
- Implemented layout: order count/duration and open amount now share a compact summary row on desktop, while status, label, summary and badges cannot shrink. The seat/service badges stay anchored at the bottom. Mobile keeps the taller two-row summary so narrow cards retain both values.
- Automated evidence: dashboard lint and typecheck pass; table architecture/mobile contract tests pass 34/34; dashboard production build passes.
- Runtime evidence: dashboard restarted successfully on port 3000 and the existing menu preview remains active on port 3011.
- Visual comparison: blocked because the in-app browser reported no available browser backend in this session. No post-fix screenshot or pixel-perfect pass is claimed.

final result: blocked

# Active Product Design Gate — Masalar Tabs / Rail Alignment

- Source visual truth: user-supplied 2048×1024 Canlı Masalar screenshot in the conversation, with the `Canlı Masalar / QR Studio` section tabs marked for rightward alignment.
- Implemented structure: both Canlı Masalar and QR Studio now place the persistent icon rail and the content column as siblings below the shared top bar; the section tabs live inside the content column, so they begin exactly after the 56 px desktop rail.
- Responsive contract: below 900 px the rail remains hidden and the content/tabs return to the existing full-width mobile column; no mobile spacing offset is introduced.
- Automated evidence: lint, typecheck, shell architecture and mobile layout contract pass. The architecture test guards the rail → content → tabs DOM order for both routes.
- Visual comparison: blocked because the in-app browser reported no available browser backend in this session. No browser screenshot or pixel-perfect pass is claimed.

final result: blocked

# Daily Special Media Visual QA

- Source visual truth: conversation screenshot, 2026-07-25
- Source pixels: unavailable from the embedded conversation image
- Implementation screenshot: not captured — in-app Browser reported no available browser backend
- Viewport / CSS size / density: unavailable
- State: split-layout Daily Special with product image, description, countdown, price card and membership note
- Full-view comparison evidence: blocked because the rendered implementation could not be captured
- Focused-region comparison evidence: blocked for the same reason
- Primary interactions tested: server-rendered component tests only; browser interactions not tested
- Console errors checked: not browser-tested

## Findings

- [P1 fixed in code] The source screenshot showed the product image stretching to the full height of the adjacent content column, producing an unnaturally narrow portrait crop.
- The implementation now gives split-layout media its own square frame, controlled by the existing image-size setting and aligned to the top of the section.
- The text, countdown, price and membership-note column can now grow without changing the image height.

## Comparison history

1. Initial source finding: the split media inherited the content row height through `align-self: stretch`, `height: 100%` and `min-height: 100%` behavior.
2. Fix: independent square media frame with explicit height, `aspect-ratio: 1 / 1`, and `align-self: start`.
3. Automated evidence: Daily Special component tests pass 5/5, including a regression case with a long content column; UI and dashboard typechecks pass.
4. Post-fix visual evidence: unavailable because the in-app Browser backend is not currently available.

## Residual test gap

- Refresh the signed-in theme preview and visually confirm the Daily Special image stays square while the countdown, description, chef note and price card are all visible.
- Confirm both `cover` and `contain` image-fit options produce an intentional crop at the smallest and largest image-size settings.

final result: blocked

# Product Detail, Recommendations and Product Note Visual QA

- Source visual truth: `/Users/furkancengelm3/Desktop/WhatsApp Image 2026-07-27 at 23.22.47.jpeg` and `/Users/furkancengelm3/Desktop/WhatsApp Image 2026-07-27 at 23.22.48.jpeg`
- Source pixels: both references are 945×2048; the source includes Android device chrome, so app-owned content is treated as the comparison target
- Implementation: `packages/ui/src/menu/ProductModal.tsx`
- Implementation screenshot: not captured — browser discovery returned no available in-app or Chrome backend
- Intended viewport: 390×844 CSS px at deviceScaleFactor 1
- State: product detail with required modifier, removable ingredients, three collapsed recommendations, configured recommendation, product note and sticky add action
- Primary interactions covered automatically: modifier validation, removable-ingredient server validation, recommendation tenant/limit constraints, snapshot note normalization and production compilation
- Console errors checked: not browser-tested

## Findings

- The implementation follows the source hierarchy with explicit required/optional states, ordered recommendation rows using real menu imagery, a 500-character note field and a sticky quantity/total action.
- Fonts and typography use the existing tenant display/body tokens; a rendered comparison is still required to confirm line wraps and optical weight at 390 px.
- Spacing and layout use the existing product sheet rhythm with stronger section dividers; recommendation density and sticky-footer clearance remain unverified in-browser.
- Colors use public theme tokens and semantic warning surfaces; contrast needs browser evidence in representative tenant themes.
- Image quality uses each recommended menu item's real first image and omits the image slot when none exists; no generated placeholder imagery was introduced.
- Copy matches the intended Turkish flow and separates preparation notes from allergy guidance.

## Comparison History

1. Source analysis identified required selection pills, optional removable ingredients, three visible upsells with expansion, a 500-character note and a persistent bottom action.
2. Implementation added those states while preserving the existing allergen and canonical-theme behavior.
3. Automated post-build evidence: UI/DB/application tests, all affected package lint/typechecks, and menu/dashboard/kitchen production builds pass.
4. Post-fix visual evidence is blocked because this session exposes no browser backend.

## Residual Test Gap

- Capture the open product sheet at 390×844 with real recommendations and compare it against both source screens in one normalized comparison image.
- Exercise simple upsell selection, nested configurable upsell, expansion, note entry, required-field disabled state and sticky-footer scrolling.
- Verify zero console errors and confirm long names, no-image recommendations and ten-item expansion do not overflow.

final result: blocked

# Current Build Gate — Product Detail Upsell and Note

All automated acceptance gates pass. Browser-rendered comparison and interaction evidence remain blocked until an in-app browser backend is available, so the Product Design visual gate is not marked passed.

final result: blocked

# Header and Customer Actions Redesign Visual QA

- Source visual truth: `/private/tmp/header-audit/03-header-overflow.png` (the 390×820 pre-change reproduction of the supplied problem screenshot)
- Implementation screenshot: `/private/tmp/header-audit/11-header-final-390.png`
- Combined comparison evidence: `/private/tmp/header-audit/14-before-after-comparison.png`
- Responsive evidence: `/private/tmp/header-audit/12-compact-actions-320.png`
- Context-bar and below-header Drawer evidence: `/private/tmp/header-audit/13-context-final.png`
- Shared service-sheet evidence: `/private/tmp/header-audit/10-header-service-sheet.png`
- Viewport: source and primary implementation 390×820 CSS px; compact case 320×820 CSS px
- Pixel dimensions and normalization: both primary captures are 390×820 at deviceScaleFactor 1; no resizing or density conversion was used before the side-by-side comparison
- State: source has the legacy `… > Üye ol` popover open; implementation intentionally removes that control and keeps membership on its selected Drawer surface
- Console errors checked: 0 in the final header, drawer, and service-sheet Playwright runs

## Findings

- No actionable P0/P1/P2 issue remains. The legacy popover no longer covers the category navigation, the centered brand stays stable, and the header has no horizontal overflow.
- Fonts and typography: the existing tenant DM Sans/Fraunces pairing, weights, hierarchy, wrapping, and product typography are unchanged; the redesign limits itself to header/action composition.
- Spacing and layout rhythm: 44×44 primary targets align on one row, the compact row is capped at 56 px, and the 34 px table bar remains visually separate from category navigation. The Drawer starts at the measured combined header/context boundary.
- Colors and visual tokens: controls continue to use tenant accent, soft-accent, card, border, text, and muted-text tokens. No new off-brand surface was introduced.
- Image quality and asset fidelity: the real restaurant logo and product imagery remain at their original crop and density. New service/header glyphs use the existing application icon system.
- Copy and content: the persistent `Üye ol +200 puan` overflow copy is removed; membership appears once as `Üye ol` on the configured surface. The table bar uses `Masa BAF7` and `Hesap · ₺150,00` only when real table/bill data exists.

## Comparison history

1. Source finding [P1]: the `…` trigger exposed a single membership row and its popover covered category navigation at 390 px. Fix: remove overflow entirely and route membership through canonical placement.
2. First responsive pass [P2]: the cart pill hid its label below 420 px but retained a 72 px minimum width. Fix: collapse the pill to a true 44×44 icon/badge control. Post-fix evidence: `/private/tmp/header-audit/12-compact-actions-320.png` and measured 44×44 member/cart targets with zero horizontal overflow.
3. First context/Drawer pass [P2]: when bill placement was Header, the disabled Drawer table card still displayed the total and looked like a second bill control. Fix: render a static table-status card without bill total/action outside the Drawer placement. Post-fix evidence: `/private/tmp/header-audit/13-context-final.png`.
4. Post-fix interaction evidence: service sheet opens from Header and Drawer, focuses its first action, traps focus, closes on Escape, restores focus to the trigger, and leaves zero console errors.

## Focused comparison evidence

- The full comparison is rendered at 1:1 density, so the header, first category row, typography, logo, radii, and action geometry are directly readable without a separate crop.
- The 320 px compact and table-context captures provide focused evidence for the two details not represented in the primary source state: two header actions and the combined Header + status-bar boundary.

## Follow-up Polish

- P3: a future tenant with an unusually wide horizontal logo may benefit from a dedicated maximum-logo-width editor control; current long-name and no-logo fallbacks already truncate safely.

final result: passed

---

# Masabu Gerçek Checkout Tema Önizlemesi QA

## Kaynak ve uygulama hedefi

- Source visual truth: kullanıcının bu konuşmada paylaştığı ikinci Checkout ekran görüntüsü; gerçek `CartDrawer` içinde `Sepetiniz`, ürün kartı, adet kontrolleri, toplam, `Sipariş ver`, `Ödeme Yap` ve `Kişi Başı Hesapla` eylemleri.
- Kaynak görselin yerel dosya yolu ve kesin piksel yoğunluğu bu oturumda sunulmadı; görünen konuşma görseli karşılaştırma hedefidir.
- Implementation route: `http://localhost:3011/theme-preview/maf-lounge?surface=checkout&state=cart`.
- Implementation screenshot path: oluşturulamadı. Chrome Computer Use servisi iki denemede sırasıyla `service startup request failed` ve `native pipe startup failed` döndürdü.
- Hedef viewport/state: editörün 390 px mobil cihaz çerçevesi, Checkout → Sepet; ek durumlar Ödeme formu, Başarılı, Masada ödeme ve Hata.

## Uygulanan yapı

- Eski `CheckoutFixture` mock'u kaldırıldı; Checkout tema önizlemesi üretimdeki gerçek `CartDrawer` ve `PaymentModal` bileşenlerini kullanıyor.
- Önizleme ilk gerçek, erişilebilir menü ürününü fixture sepete yansıtıyor. Adet artırma/azaltma yerel state'te çalışıyor; sipariş ve ödeme callback'leri inert kalıyor.
- `PaymentModal.previewState` ödeme formu, başarı, masada ödeme ve hata görünümlerini üretim markup/CSS'iyle açıyor. Preview guard, `/api/payment` isteğinden ve sipariş çağrılarından önce kapanıyor.
- Checkout renk tokenları gerçek sepette dış zemin, kart yüzeyi, metin, vurgu ve CTA alanlarına bağlandı. Panel boyutu kapalı `compact | standard | large` sözlüğüyle, köşe yarıçapı güvenli 4–28 px editör aralığıyla yönetiliyor.

## Zorunlu görsel yüzeylerin durumu

- Fonts/typography: gerçek üretim bileşenleri ve tenant font tokenları yeniden kullanıldı; post-fix Chrome piksel karşılaştırması yapılamadı.
- Spacing/layout: kaynakta görülen gerçek sheet hiyerarşisi doğrudan `CartDrawer` ile sağlandı; mobil/masaüstü rendered karşılaştırması browser engeli nedeniyle yok.
- Colors/tokens: sabit mock renkleri kaldırıldı, gerçek Checkout tokenları kullanılıyor; canlı renk değişimi görsel olarak doğrulanamadı.
- Image quality: sahte ürün görseli kullanılmıyor; restoranın gerçek ilk uygun menü görseli yükleniyor. Crop/sharpness Chrome'da karşılaştırılamadı.
- Copy/content: gerçek `Sepetiniz`, ürün, toplam ve müşteri eylem metinleri kullanılıyor; ödeme durumları üretim kopyasını koruyor.
- Focused region comparison: ürün kartı + alt eylem alanı için implementation capture alınamadığından yapılamadı.

## Otomatik kanıt

- Design Engine: 20 test, lint ve typecheck geçti.
- UI: 30 test, lint ve typecheck geçti.
- Menu: 62 test, lint ve typecheck geçti; production build geçti. `/[slug]/menu` 277 kB first-load JS sınırını koruyor.
- Dashboard: 488 architecture testi, lint ve typecheck geçti; production build geçti. Tema editörü 108 kB first-load JS.
- Yerel Checkout preview route'u HTTP 200 döndü.

## Bloker ve kalan kontrol

- [P2 test gap] Kaynak ile implementation aynı viewportta yan yana açılıp görsel olarak karşılaştırılamadı; dolayısıyla yatay taşma, sheet yüksekliği, renk yansıması, crop ve odak davranışı için browser-rendered pass iddia edilmiyor.
- Chrome Computer Use servisi erişilebilir olduğunda beş Checkout durumunu 390×844, 820×1000 ve 1440×1000'de açmak; panel boyutu ve renk kontrollerini kaydetmeden değiştirmek; console/network'i kontrol etmek gerekir.

final result: blocked

---

# Masabu Ana Sayfa Vitrini ve Ortak Bölüm Editörü V2 QA

## Kaynak ve kanıt

- Görsel referans: `/Users/furkancengelm3/Desktop/Vitrin (Ana Sayfa).html`.
- Referans yakalama: `test-results/home-v2-qa/00-reference-vitrin.jpg`.
- Son mobil editör ve gerçek V2 önizleme: `test-results/home-v2-qa/01-home-editor-mobile-v2.jpg`.
- Ortak, yüzey filtreli bölüm seçici: `test-results/home-v2-qa/02-section-picker-v2.jpg`.
- Masaüstü editör: `test-results/home-v2-qa/03-home-editor-desktop-v2.jpg`.
- Chrome yüzde 200 zoom: `test-results/home-v2-qa/05-home-zoom-200.jpg`.
- Referans ve uygulama karşılaştırması: `test-results/home-v2-qa/06-reference-comparison.jpg`.
- Son tam görünüm: `test-results/home-v2-qa/07-final-home-v2.jpg`.

## Bulgular ve uygulanan düzeltmeler

1. Ana sayfa, Menü yüzeyiyle aynı gerçek Header ve Footer bileşenlerini tek taslak revision'ında kullanıyor; iki bileşen ana içerik sıralamasının dışında sabit ortak alanlar olarak gösteriliyor.
2. Legacy ana sayfa belgeleri editörde kaynak veriyi görüntüleme sırasında değiştirmeden V2 kompozisyonuyla önizleniyor. İlk gerçek düzenleme/kayıt aynı V2 blok yapısını saklıyor; yayınlanmış legacy tema sessizce değişmiyor.
3. Ana sayfa bölümleri Menü editöründeki arama, kategori, önizleme ve klavye davranışını kullanan tek seçiciyle ekleniyor. Wi-Fi, masa servisi, combo ve doğrudan sepete ekleme gibi restoran içi bölümler vitrin kataloğunda bulunmuyor.
4. Vitrin Hero, hikâye, kategori, sadakat, kampanya, galeri, saat/iletişim ve güvenli Menü CTA akışları gerçek restoran ve menü verisine bağlandı. Ana sayfa ürün/kategori eylemleri sipariş oluşturmuyor; kalıcı `/{slug}/menu` rotasına yönlendiriyor.
5. Görsel Hero Starter'da; MP4/WebM video ve zorunlu WebP poster Pro'da çalışıyor. Sunucu tarafı MIME/container, boyut, süre, tenant sahipliği ve plan yetkisini doğruluyor. Video poster-first, sessiz, `playsInline`, döngülü ve erişilebilir oynat/duraklat kontrolüyle render ediliyor; reduced-motion/data-saver poster fallback'ine düşüyor.
6. En az bir görünür Menü CTA'sı sanitizer ve editör komutlarında zorunlu. Mobil sabit CTA Footer görünür olduğunda gizleniyor ve Footer'ı kapatmıyor.
7. Kök rota ana sayfa kapalıyken mevcut Menüyü göstermeye devam ediyor; kalıcı `/{slug}/menu` ve masa QR rotası Menü olarak kalıyor. QA sırasında Kaydet/Yayınla kullanılmadı ve production migration uygulanmadı.
8. Chrome'daki iki development hydration bildirimi, LastPass/Urban VPN benzeri eklentilerin DOM'a eklediği niteliklere kadar izlendi. Uygulama kaynaklı console, navigation veya iframe hatası görülmedi.

## Görsel ve erişilebilirlik sonucu

- 390×844, 820×1000, 1440×1000 ve yüzde 200 zoom kontrollerinde P0/P1/P2 yerleşim, taşma veya etkileşim sorunu kalmadı.
- Ortak Header/Footer tekil render ediliyor; mobil ve masaüstü editör chrome'u sabit kalıyor.
- Bölüm seçici, blok işlemleri, görünürlük, sabit ortak alanlar, 44 px hedefler ve güvenli Menü bağlantıları Chrome erişilebilirlik ağacında doğrulandı.
- Referanstaki güçlü medya Hero, kampanya ve sadakat hiyerarşisi korunurken sahte cihaz, masa, puan, rating ve emoji içeriği kullanılmadı.

## Otomatik doğrulama

- Design Engine: 19 test geçti; lint ve typecheck geçti.
- UI: 27 test geçti; lint ve typecheck geçti.
- Menu: 56 test geçti; lint, typecheck ve production build geçti. Kalıcı Menü rotası 276 kB first-load JS ile 277 kB sınırının altında.
- Dashboard: 479 architecture testi geçti; lint, typecheck ve production build geçti. Tema editörü first-load JS 108 kB.

final result: passed

---

# Masabu Auth Durum Editörü — OTP, Başarı ve Hata QA

## Kapsam ve kanıt

- OTP, başarı ve hata ekranları 390×844, 820×1000, 1440×1000 ve 1440×1000 fiziksel alanda %200 zoom eşdeğerinde doğrulandı.
- Ekran görüntüleri `test-results/theme-editor-v2/screenshots/auth-state-editor/` altında saklandı.
- Her durumda HTTP 200, yatay taşma sıfır, console hatası sıfır ve page error sıfırdır.
- Başarı yüzeyi `role="status"` + `aria-live="polite"`; hata yüzeyi `role="alert"` + `aria-live="assertive"` kullanır.

## Sonuçlar

1. OTP e-postası sistem kontrollü ayrı satırda kalırken başlık, açıklama, CTA ve tekrar gönder etiketi tema kontratından gelir.
2. Başarı ve hata içerikleri birbirinden bağımsızdır; kapalı ikon sözlükleri, 56–96 px ikon boyutu ve sabit erişilebilir durum renkleri uygulanır.
3. Padding, gap, hizalama ve içerik genişliği güvenli aralıklarda sanitizer tarafından sınırlandırılır; HTML, CSS, URL ve interpolasyon girişleri reddedilir.
4. Varsayılana dön işlemi yalnız seçili durumun override alanını kaldırır; ortak auth teması ve diğer durumlar korunur.
5. Design Engine, Menu ve Dashboard için lint/typecheck; 548 hedefli test ve iki production build geçti.

final result: passed

---

# Giriş Yüzeyi Medya ve Semantik Renk Sistemi Görsel QA

## Kaynak, viewport ve kanıt

- Source visual truth: `/Users/furkancengelm3/.codex/attachments/bb506c36-fecb-467c-b436-11c8ec49120e/image-1.png` (1096×1386 px). Kaynak, logo/başlık çakışması ve vurgu renginin header katmanlarını birbirine karıştırdığı önceki durumu gösterir.
- Chrome editör uygulaması: `test-results/theme-editor-v2/screenshots/auth-media-color-system/implementation-editor.png` (1353×768 px, %100 zoom).
- Aynı karşılaştırma girdisi: `test-results/theme-editor-v2/screenshots/auth-media-color-system/source-vs-implementation.png` (1980×768 px).
- Odaklı header/form karşılaştırması: `test-results/theme-editor-v2/screenshots/auth-media-color-system/header-form-focus.png` (800×310 px).
- Responsive kanıt: `join-390x844.png`, `join-820x1000.png`, `join-1440x1000.png` ve birleşik `responsive-contact-sheet.png`.
- %200 zoom kanıtı: `error-200-percent.png` (1352×768 px).
- Durumlar: Üyelik, OTP, Başarılı dönüş ve Hata; dört durum aynı `AuthFrame` header ölçüsü ve medya kontratını kullanıyor.

## Bulgular ve düzeltmeler

1. Kaynak [P1]: fotoğraf/gradient, logo ve durum başlığı aynı görsel katmanda çakışıyordu. Düzeltme: zemin → gerçek medya → nötr fotoğraf overlay'i → içerik → geri kontrolü sırasına sahip bağımsız renderer katmanları kuruldu. Fotoğraf varken marka gradient'i çizilmiyor.
2. Kaynak [P1]: vurgu rengi header fotoğrafının tonunu değiştiriyordu. Düzeltme: `accent` yalnız link, checkbox, focus ve durum vurgularına bağlandı. Fotoğraf karartması siyah/beyaz nötr bir medya klonuyla ve yalnız gerçek fotoğraf piksellerinde uygulanıyor; `contain` boşlukları etkilenmiyor.
3. Kaynak [P1]: logo, başlık ve `Merhaba!` aynı alanda üst üste geliyordu. Düzeltme: form durum başlığı panel içine taşındı; ilk fotoğraf yüklemesinde yalnız varsayılan işletme logosu gizleniyor, bilinçli özel/sonraki logo seçimi korunuyor.
4. Renk sistemi [P1]: form metinlerinin bir bölümü sabit beyaz/şeffaf değerlere bağlıydı. Düzeltme: dış zemin, panel, ana/ikincil metin, alan zemini/kenarlığı, vurgu, CTA ve CTA metni semantik tokenlara bağlandı. Google butonu sabit marka güvenli beyaz/siyah kalıyor; hata/başarı sistem renkleri düzenlenemiyor.
5. Editör [P2]: medya için kadraj kontrolü yoktu. Düzeltme: cover/contain, klavye ve pointer ile X/Y odak noktası, kompakt/standart/geniş yükseklik, nötr karartma, zemin rengi ve canlı thumbnail eklendi.
6. Yayın güvenliği [P1]: düşük kontrastlı tema yayınlanabiliyordu. Düzeltme: ana/ikincil metin, input, sınır ve CTA çiftleri ortak WCAG denetiminden geçiyor; taslak kaydı serbest, kritik hata istemci ve sunucu publish katmanında kapalı biçimde engelleniyor.

## Görsel ve etkileşim sonucu

- P0/P1/P2 açık bulgu kalmadı. Kaynakla yan yana incelemede logo/başlık çakışması giderildi, header ölçüsü sabit ve form hiyerarşisi okunur.
- 390×844 mobil görünüm tam genişlikte; 820×1000 ve 1440×1000 görünümler bounded dialog düzeninde. Yatay taşma veya kırpılmış header görülmedi.
- %200 Chrome zoom'da Hata durumu okunabilir kaldı; header ve panel seam/radius bozulmadı.
- Üyelik, OTP, başarı ve hata ekranları aynı medya, logo, kadraj, içerik tonu ve yükseklik değerlerini yeniden kullanıyor.
- Exact-viewport Chrome çalıştırmalarında üç sayfa da HTTP 200 döndü; console ve page error listeleri boş kaldı. Geliştirme sunucusunda hydration hata yüzeyi oluşmadı.

## Otomatik doğrulama

- Design Engine: lint ve typecheck geçti; 13/13 test geçti.
- Menu: lint ve typecheck geçti; 55/55 test geçti; production build geçti.
- Dashboard: lint ve typecheck geçti; 473/473 architecture testi geçti; production build geçti.
- Toplam hedefli test: 541/541 geçti.

final result: passed

---

# Giriş Header — Sabit ve Yapılandırılabilir Alan Görsel QA

## Kaynak, hedef ve kanıt

- Source visual truth: `/Users/furkancengelm3/.codex/attachments/bb506c36-fecb-467c-b436-11c8ec49120e/image-1.png` (1096×1386). Pembe çerçeve, dönüştürülecek mevcut yeşil bölgenin sınır kanıtıdır; değişiklik sonrası metinlerin piksel eşleşme hedefi değildir.
- Chrome uygulama kanıtı: `test-results/theme-editor-v2/screenshots/auth-header/02-join-custom-copy.png` (1352×768).
- Aynı karşılaştırma girdisi: `test-results/theme-editor-v2/screenshots/auth-header/06-source-vs-implementation.png`.
- Odaklı header karşılaştırması: `test-results/theme-editor-v2/screenshots/auth-header/07-header-focus-comparison.png`.
- Durum kanıtları: `03-otp-fixed-header.png`, `04-success-fixed-header.png`, `05-error-fixed-header.png`.
- Uygulama viewport'u Chrome pencere pikselleriyle 1352×768'dir. Kaynak, tam görünüm karşılaştırmasında içerik değiştirilmeden 768 px yüksekliğe ölçeklenmiştir; odaklı karşılaştırmada yalnız işaretli yeşil alan ve karşılık gelen yeni header kırpılmıştır.

## Bulgular ve düzeltmeler

1. İlk durum [P1]: yeşil alan işletme adı, `Menü · QR menü` bağlamı ve form durum başlığını hard-coded gösteriyor; `Merhaba!` gibi durum metni değişince header sabit kalmıyordu. Düzeltme: tek `AuthFrame` içindeki ortak `Giriş Header` oluşturuldu ve form durum başlıkları koyu panele taşındı.
2. Kontrat [P1]: eski tema yalnız tek hero görseli taşıyordu. Düzeltme: güvenli arka plan fotoğrafı, işletme/özel/yok logo modu, isteğe bağlı başlık, slogan, hizalama ve %0–85 koyuluk alanları V2 tema kontratı ve sanitizer'a eklendi; legacy `heroImageUrl` güvenli biçimde yeni alana taşınıyor.
3. Editör [P1]: işletme header'ı düzenleyemiyordu. Düzeltme: sunucu sahipli medya yükleme yollarıyla fotoğraf ve özel logo, sınırlandırılmış metin alanları, hizalama ve koyuluk kontrolleri eklendi. Önizleme değişiklikleri canlı gösteriyor; QA sırasında Kaydet/Yayınla çalıştırılmadı.
4. Durum sürekliliği [P1]: Üyelik, OTP, başarılı dönüş ve hata önizlemeleri farklı hero içeriği üretebilirdi. Düzeltme sonrası Chrome accessibility ağacında dört durumda da aynı `Giriş Header`, aynı logo ve aynı `MAF Cafe Lounge / İyi kahve, güzel anlar.` içeriği doğrulandı; yalnız koyu panel başlığı değişti.
5. Son görsel inceleme [P2]: kaynakta üst üste binen marka ve durum metinleri okunabilirliği bozuyordu. Yeni düzen logo, başlık ve sloganı merkezde tek hiyerarşide tutuyor; geri düğmesi ayrı kalıyor, panel seam/radius ve mevcut yeşil-koyu görsel dil korunuyor. Kırpılmış logo, taşan metin veya bozuk radius görülmedi.

## Beş yüzey kontrolü

- Tipografi: marka başlığı display fontunda, slogan ikincil ölçekte; form başlıkları panel içinde tutarlı.
- Aralık ve geometri: sabit header yüksekliği, yuvarlatılmış telefon çerçevesi ve panel geçişi dört durumda değişmiyor.
- Renk ve kontrast: mevcut tenant yeşili ve koyu panel korunuyor; görsel overlay'i editör ve renderer'da aynı yüzdeyi kullanıyor.
- Varlık kalitesi: gerçek restoran logosu doğal en-boy oranıyla gösteriliyor; özel logo ve fotoğraf yalnız doğrulanmış tenant medya yollarından geliyor.
- Etkileşim ve erişilebilirlik: header semantik olarak etiketli, logo alternatif metinli, geri kontrolü erişilebilir isimli; OTP/OAuth preview istek üretmiyor.

## Doğrulama

- Design Engine lint/typecheck ve 10/10 test: geçti.
- Menü lint/typecheck ve 54/54 test: geçti.
- Dashboard lint/typecheck ve 470/470 mimari test: geçti.
- Menü ve Dashboard optimize production build: geçti.
- Chrome durum doğrulaması: Üyelik, OTP, başarı ve hata ekranlarında sabit header geçti.
- Açık P0/P1/P2 görsel veya işlevsel bulgu: yok.

final result: passed

---

# Tema Editörü V2 — Gerçek Giriş Yüzeyi

## Kaynak, viewport ve kanıt

- Source visual truth: `/Users/furkancengelm3/.codex/attachments/953ab89d-6764-43d3-8b3b-b0782e83a72d/image-2.png` (950×1344 px).
- Implementation: `apps/menu/app/[slug]/ExperienceStatePreview.tsx` içinden doğrudan üretim `MemberSheet` bileşeni.
- Chrome editör viewport'u: 1353×768 CSS px; mobil önizleme 100% editör ölçeğinde telefon çerçevesi içinde.
- Tam görünüm kanıtı: `test-results/theme-editor-v2/screenshots/auth-real-preview/comparison-source-implementation.png` (1920×768). Kaynak, yalnız yoğunluk/eş görüş yüksekliği için 768 px yüksekliğe ölçeklendi; uygulama yerel 1353×768 yakalamadır.
- Durum kanıtları: `implementation-join-full.png`, `implementation-otp-full.png`, `implementation-success-full.png`, `implementation-error-full.png` ve `interaction-local-otp.png`.
- İncelenen durumlar: Giriş / Üyelik, OTP, Başarılı dönüş ve Hata.

## Görsel ve etkileşim bulguları

- P0/P1/P2 açık bulgu kalmadı.
- Tipografi: üretimdeki serif başlık ve sans gövde sistemi aynen yeniden kullanılıyor. Başlık, alan etiketleri, hukuki metin ve CTA hiyerarşisi kaynakla aynı üretim bileşeninden geliyor.
- Yerleşim ritmi: yeşil marka kahramanı, koyu işlem paneli, alanlar, onaylar, sağlayıcı eylemi ve misafir geçişi gerçek `MemberSheet` düzenidir. Editör kanvası ve telefon ölçeği, kaynak ekranın tek başına mobil yakalamasından beklenen bağlamsal farktır.
- Renkler: yeşil gradient, siyaha yakın panel, beyaz ana metin, muted yardımcı metin ve tenant CTA tokenları üretim yüzeyiyle aynıdır.
- Varlıklar: Google işareti resmi SVG varlığından, durum ve navigasyon ikonları ortak Masabu ikon sisteminden gelir; sahte görsel veya ayrı auth fixture yoktur.
- İçerik: sağlayıcı adları ve hukuki onay metinleri üretimden gelir ve editör tarafından değiştirilemez. V2'nin düzenlenebilir alt metni bilinçli ürün genişlemesidir.
- Etkileşim: dört önizleme durumu Chrome'da ayrı ayrı açıldı. Üyelik formu alanları ve gerçek checkbox doğrulandı; e-posta akışının ağ isteği göndermeden yerel önizleme sınırında kaldığı test edildi. Son düzeltmeyle sol durum seçici önizlemenin tek otoritesi oldu; form içi eylemler seçili durumu sessizce değiştiremiyor.
- Güvenlik: önizleme OTP, OAuth veya ödeme isteği oluşturmaz; koruma koşulları tüm ilgili `fetch` çağrılarından önce çalışır.
- Erişilebilirlik: gerçek alan adları, native checkbox'lar, altı ayrı OTP girişi, dialog semantiği ve buton isimleri Chrome erişilebilirlik ağacında doğrulandı.
- Runtime: son Chrome geçişlerinde uygulama hata/hydration yüzeyi oluşmadı. Görünen Next.js issue rozeti mevcut geliştirme profili tanılamasıdır; üretim build'i başarıyla tamamlandı.

## Karşılaştırma geçmişi

1. İlk uygulama [P1]: editör, gerçek müşteri girişinden ayrı bir `AuthFixture` gösteriyordu. Düzeltme: fixture kaldırıldı ve üretim `MemberSheet` güvenli preview state kontratıyla bağlandı.
2. İlk Chrome turu [P2]: tarayıcının çevrimdışı durumu, deterministic editör önizlemesine “Çevrimdışısın” uyarısı taşıyordu. Düzeltme: preview modu çevrimdışı aboneliğinden ayrıldı ve sabit online görünüm kullandı.
3. Etkileşim turu [P2]: form içi yerel OTP geçişi, sol panelde seçili Üyelik durumuyla görselin ayrışmasına izin veriyordu. Düzeltme: görünür faz doğrudan `previewState` tarafından belirleniyor; seçici durumu görsel için otoriter kaldı.
4. Son karşılaştırma: kaynak ve uygulama aynı birleşik kanıtta yan yana incelendi. Üretim bileşeni, görsel dil ve etkileşim sözleşmesi yeniden kullanılmaktadır.

## Doğrulama

- Menu lint: geçti.
- Menu typecheck: geçti.
- Menu testleri: 53/53 geçti.
- Dashboard typecheck: geçti.
- Menu production build: geçti.

final result: passed

# Tema Editörü V2 — Dropdown Katmanı ve Sabit Header Görsel QA

## Kaynak, viewport ve kanıt

- Dropdown source visual truth: `/Users/furkancengelm3/dev/gersonless/test-results/theme-editor-v2/screenshots/dropdown-layer-source.png` (2938×1662 px).
- Header source visual truth: `/Users/furkancengelm3/dev/gersonless/test-results/theme-editor-v2/screenshots/header-stability-source.png` (2888×1644 px).
- Browser-rendered implementation, değişiklik öncesi: `/Users/furkancengelm3/dev/gersonless/test-results/theme-editor-v2/screenshots/header-stability-before.png` (1353×768 px).
- Browser-rendered implementation, `1 değişiklik` açık: `/Users/furkancengelm3/dev/gersonless/test-results/theme-editor-v2/screenshots/header-stability-after.png` (1353×768 px).
- Dropdown/canvas implementation boundary: `/Users/furkancengelm3/dev/gersonless/test-results/theme-editor-v2/screenshots/dropdown-layer-after.png` (1353×768 px).
- Full-view ve focused comparison: `/Users/furkancengelm3/dev/gersonless/test-results/theme-editor-v2/screenshots/surface-selector-layout-fixes-comparison.png` (1352×768 px); tekrar açılabilir kaynak `surface-selector-layout-fixes-comparison.html`.
- Density normalization: source görseller üst çalışma alanı odak bölgelerinde sütun genişliğine normalize edildi; before/after implementation yakalamaları aynı Chrome viewport ve sistem yoğunluğunda alındı.
- State: Menü/Home/Checkout yüzeyleri, değişiklik rozeti kapalı ve açık, yüzey dropdown’u açık/kapalı.

## Findings

- No actionable P0/P1/P2 visual, responsive, interaction or accessibility mismatch remains.
- Fonts and typography: mevcut Masabu editör fontları, ağırlıkları ve küçük durum metinleri değişmedi; değişiklik rozeti tek satırda sabit genişliğe sığıyor.
- Spacing and layout rhythm: header `minmax(0, 1fr) auto minmax(0, 1fr)` grid ile eşit yan kolonlara ayrıldı. Mobil/Masaüstü seçicisi gerçek merkez kolonunda; sağdaki durum, rozet ve aksiyonların genişliği merkezi etkilemiyor. Header 60 px sabit yükseklikte ve nowrap davranışında.
- Colors and visual tokens: mevcut surface, border, status ve warning renkleri korunuyor; rozet görünmezken yuvası `visibility: hidden` ile yer ayırıyor.
- Image quality and asset fidelity: yeni görsel veya taklit ikon eklenmedi; mevcut Masabu logo ve ikon sistemi kullanılıyor.
- Copy and content: `Kaydedilmedi`, `1 değişiklik`, cihaz ve aksiyon adları değişmedi.
- Dropdown stacking: önizleme toolbar’ı `position: relative; z-index: 40` üst katmanına alındı; dropdown kendi `z-index: 80` katmanında kalıyor. Böylece iframe/telefon önizlemesi toolbar/dropdown üzerine çizilemiyor.
- Accessibility and interactions: Chrome canlı ağacında `Düzenlenecek yüzeyi seç` menüsü, dört yüzey ve aktif seçenek odağı doğrulandı; Arrow ve Escape/focus-return kontratı korunuyor. Değişiklik sayacı `role=status`, `aria-live=polite` ve `aria-atomic=true` kullanıyor.
- Runtime health: Dashboard geliştirme derlemesi temiz; editör GET/POST istekleri 200 ve terminalde compile/runtime hatası yok.

## Comparison history

1. Source [P1]: dropdown, telefon/iframe önizlemesinin arkasında kalıyor ve seçenekleri kapatıyordu. Fix: önizleme toolbar’ına bağımsız positioned stacking context ve `z-index: 40` eklendi; dropdown `z-index: 80` ile bunun üzerinde kaldı.
2. Source [P1]: değişiklik rozeti koşullu genişlik ekliyor, Mobil/Masaüstü seçicisini itiyor ve flex-wrap nedeniyle header yüksekliğini büyütüyordu. Fix: header eşit yan kolonlu grid oldu, cihaz seçici merkez kolona ayrıldı ve 104 px rozet yuvası sürekli rezerve edildi.
3. Post-fix comparison: aynı 1353×768 Chrome viewportunda rozet kapalı/açık yakalamalarında header yüksekliği ve cihaz seçici konumu değişmedi. Dropdown açık durumu Chrome AX menü/odak çıktısıyla doğrulandı. Kalan P0/P1/P2 bulunmadı.

## Verification

- Dashboard targeted architecture tests: 27 passed, 0 failed.
- Dashboard targeted ESLint: passed.
- Dashboard typecheck: passed.
- Chrome: değişiklik rozeti açık/kapalı sabit header, dropdown open state, active option focus and Escape contract passed.

final result: passed

# Tema Editörü V2 — Yüzey Seçici Yerleşimi Görsel QA

## Kaynak, viewport ve kanıt

- Source visual truth: `/Users/furkancengelm3/dev/gersonless/test-results/theme-editor-v2/screenshots/selector-toolbar-source.png`.
- Browser-rendered implementation: `/Users/furkancengelm3/dev/gersonless/test-results/theme-editor-v2/screenshots/selector-toolbar-implementation.png`.
- Full-view ve focused comparison: `/Users/furkancengelm3/dev/gersonless/test-results/theme-editor-v2/screenshots/selector-toolbar-comparison.png`; tekrar açılabilir karşılaştırma kaynağı `selector-toolbar-comparison.html`.
- Source pixels: 2852×1494. Implementation pixels ve Chrome viewport: 1312×768. Karşılaştırma, iki tam görünümü eşit sütun genişliğinde ve üst çalışma alanlarını ayrıca focused bölgelerde göstererek yoğunluk farkını normalize eder.
- State: Menü yüzeyi, mobil önizleme, yüzey seçici kapalı; açılır menü klavye etkileşimi ayrıca doğrulandı.

## Findings

- No actionable P0/P1/P2 visual, responsive, interaction or accessibility mismatch remains.
- Fonts and typography: seçici mevcut editör tipografi tokenlarını koruyor; header marka, işletme ve sayfa başlığı yeniden tek satırlı eski hiyerarşisinde.
- Spacing and layout rhythm: seçici ana header’dan tamamen çıkarıldı ve önizleme araç çubuğunda `Aç` bağlantısı ile zoom grubu arasına yerleştirildi. Header artık seçici nedeniyle genişlemiyor veya ikinci satıra kırılmıyor.
- Colors and visual tokens: yüzey, border, metin ve seçili durum renkleri mevcut Masabu editör tokenlarından gelmeye devam ediyor.
- Image quality and asset fidelity: yeni raster, dekoratif çizim veya taklit ikon eklenmedi; yüzey ikonları mevcut uygulama ikon sistemini kullanıyor.
- Copy and content: yüzey adları, açıklamalar ve Ana sayfa `Kapalı` durumu değişmedi.
- Accessibility and interactions: yeni konumdaki tetikleyici `menu` semantiğini koruyor. Açılışta aktif `Menü` seçeneğine odaklandı; ArrowDown `Giriş` seçeneğine geçti; Escape menüyü kapatıp odağı tetikleyiciye iade etti.

## Comparison history

1. Kaynak bulgu [P1]: merkezi yüzey seçici ana header’ın görsel yüksekliğini ve dengesini bozuyordu. İstenen hedef, önizleme araç çubuğundaki zoom alanının soluydu.
2. Fix: seçici `ThemeEditorTopbar` bileşiminden çıkarılıp `ThemeEditorCanvas` araç çubuğunun sağ kontrol grubuna taşındı; kompakt tetikleyici genişliği 156 px yapıldı.
3. Post-fix full/focused comparison: header eski tek satır ritmine döndü, seçici okla işaretlenen araç çubuğu alanında görünüyor ve komşu kontrollerde taşma yok. Kalan P0/P1/P2 bulunmadı.

## Verification

- Dashboard targeted architecture tests: 27 passed, 0 failed.
- Dashboard targeted ESLint: passed.
- Dashboard typecheck: passed.
- Dashboard optimized production build: passed; tema editörü 108 kB First Load JS.
- Chrome interaction: open, ArrowDown, Escape and focus return passed.

final result: passed

---

# Masabu Çok Yüzeyli Tema Editörü V2 — Son Görsel QA

## Kaynak, ölçüler ve kanıt

- Source visual truth: `test-results/theme-editor-v2/screenshots/source-shopify-selector-1312x768.jpg`.
- Temiz son uygulama görünümü: `test-results/theme-editor-v2/screenshots/editor-final-clean-1312x768.png`.
- Aynı 1312×768 karşılaştırma girdisi: `test-results/theme-editor-v2/screenshots/source-implementation-comparison-clean-final.png`; kaynak ve uygulama aynı Chrome karesinde birlikte incelendi.
- Tam editör kanıtı: `test-results/theme-editor-v2/screenshots/editor-1440x1000-home-passed-v2.png` (1440×1000 CSS px, 2880×2000 ekran görüntüsü, deviceScaleFactor 2).
- Responsive kanıt: `editor-820x1000-home-final.png` (820×1000 CSS px, 1640×2000) ve `editor-390x844-home-final.png` (390×844 CSS px, 780×1688).
- Görsel durum: Ana sayfa kapalı taslağı, gerçek restoran/kategori verisi ve güvenli `Menüyü Gör` hedefi; ayrıca Giriş Üyelik/OTP/Başarı/Hata ile Checkout Sepet/Ödeme/Başarı/Masada ödeme/Hata fixture durumları Chrome’da ayrı ayrı doğrulandı.

## Bulgular

- P0/P1/P2 düzeyinde açık görsel, etkileşim veya erişilebilirlik sorunu kalmadı.
- Üst çubuk, Shopify kaynağındaki merkezi yüzey adı/ikon/chevron hiyerarşisini Masabu’nun mevcut token ve ikon sistemiyle koruyor. Açılır seçici dört kapalı seçenek sunuyor; ok tuşları, Home/End, Escape, dış tıklama ve tetikleyiciye odak iadesi Chrome erişilebilirlik ağacında doğrulandı.
- Ana sayfa editörü kaynakla aynı üç bölümlü çalışma mantığını kullanıyor: solda sıralanabilir bölüm akışı, ortada gerçek önizleme, sağda güvenli özellikler. Uzun Türkçe bölüm adları iki satıra kadar görünür; çoğalt/kaldır işlemleri yalnız seçili satırın erişilebilir işlem menüsünde bulunur.
- 820 px ve 390 px genişliklerde üç kolon görev sekmelerine dönüşüyor. Üst yüzey seçici, kaydet/yayınla ve önizleme kontrolleri görünür kalıyor; belge genişliği viewport dışına taşmıyor. %200 Chrome zoom kontrolünde aynı kalıcı işlemler erişilebilir kaldı.
- Ana sayfa hero, kategori, ürün, bilgi, sosyal, footer ve `Menüyü Gör` CTA’ları gerçek restoran verisiyle render ediliyor. Giriş/Checkout önizlemeleri ağ isteği üretmeyen fixture’lardır; gerçek OTP/OAuth, fiyat, sipariş ve ödeme kuralları tema belgesinden ayrıdır.
- Hero video yalnız Pro yetkisi, doğrulanmış sahiplik, poster çifti, 8 MB/15 saniye sınırı ve izinli MP4/WebM codec’iyle kabul ediliyor. Reduced-motion ve data-saver yalnız poster gösteriyor.
- Normal Chrome profilindeki iki Next.js geliştirme rozeti, eklentilerin DOM’a eklediği `bis_skin_checked` niteliğinden kaynaklanıyor; ürün kodundan gelmiyor. Optimize üretim build’leri başarıyla derlendi ve bu geliştirme portalı üretime dahil değil.

## Karşılaştırma ve düzeltme geçmişi

1. İlk masaüstü geçişi [P1]: iframe `PREVIEW_READY` sinyali ilk yarışta kaçtığında önizleme kalıcı olarak gecikmiş görünüyordu. Çözüm: kapalı V2 protokolü korunarak sınırlı handshake tekrarları, tek otomatik iframe recovery ve font yükünden bağımsız çift-RAF ACK eklendi. Temiz reload sonrası önizleme retry düğmesi olmadan toparlandı.
2. İlk taslak geçişi [P2]: bir alan değiştirilip geri alındığında kayıtlı snapshot yerine yalnız history uzunluğu kontrol edildiği için kirli durum kalabiliyordu. Çözüm: undo/redo snapshot’ı son kaydedilmiş override ile canonical eşitlik üzerinden karşılaştırılıyor. Chrome’da geçici başlık değişikliği → Geri al sonrası Kaydet ve Geri al yeniden pasif oldu.
3. İlk sol panel geçişi [P2]: her satırda üç işlem düğmesi uzun başlıkları kırpıyordu. Çözüm: başlıklar iki satıra kadar sarıldı; ikincil işlemler seçili satırın 44 px işlem menüsüne taşındı ve tam ad `aria-label`/title ile korundu.
4. İlk bundle geçişi [P2]: preview sanitizer ve tüm V2 varsayılan tema belgesi genel Menü başlangıç chunk’ına giriyordu. Çözüm: preview handshake `React.lazy` sınırına, menü runtime yardımcıları yan-etkisiz alt-path export’larına taşındı. Kalıcı menü ve QR rotaları 279 kB’den 272 kB First Load JS’e indi; 277 kB kabul tabanının altına geçti. Koşullu `/{slug}` build raporu iki karşılıklı server dalını birlikte saydığı için 281 kB gösteriyor; fark %1,5’in altında ve yeni dinamik yükün %5 sınırı içinde.
5. Son ortak karşılaştırmada kaynak ve uygulama 1312×768 aynı girdide yeniden incelendi. Görsel hiyerarşi, tipografi, kolon dengesi, beyaz çalışma yüzeyi, merkez seçici ve görünür ana işlemlerde yeni P0/P1/P2 fark bulunmadı.

## Doğrulama

- Dashboard: 468 test, lint, typecheck ve production build geçti; editör rotası 108 kB First Load JS.
- Menu: 51 test, lint, typecheck ve production build geçti; `/{slug}/menu` ve masa QR rotası 272 kB, tema preview 276 kB.
- Application: 206 test, lint ve typecheck geçti.
- Design Engine: 9 test, lint ve typecheck geçti.
- UI: 26 test, lint ve typecheck geçti.
- DB: 377 test, lint ve typecheck geçti.
- `deadcode:report` yalnız görev öncesi aynı 8 dosya/14 export borcuyla başarısız; kullanılmayan export type sayısı 13’ten 12’ye indi ve V2 yeni dead-code eklemedi.
- Local route smoke: Dashboard 307 auth yönlendirmesi; legacy root, kalıcı Menü, Ana sayfa preview, Giriş preview ve Checkout preview 200.
- Production migration uygulanmadı ve harici sağlayıcı/DNS ayarı değiştirilmedi.

final result: passed

# Active Product Design Gate — Canlı Masalar Gate 4

- Source visual truth: user-approved responsive operations plan, supplied legacy Canlı Masalar screenshot and the pre-change 1440×1000 capture `test-results/tables-audit/01-desktop-main.png`.
- Production browser evidence: isolated linked-DEV restaurant against the optimized dashboard build at 1440×1000, 834×1112 and 390×844; fixture cleanup passed.
- Screenshots: `test-results/tables-floor-plan/gate4-desktop-regression.png`, `gate4-tablet-filter-drawer.png`, `gate4-tablet-detail-from-list.png`, `gate4-mobile-salon.png`, `gate4-mobile-filter-sheet.png`, `gate4-mobile-filtered-salon.png` and `gate4-mobile-table-list.png`.
- Machine-readable evidence: `test-results/tables-floor-plan/gate4-evidence.json`.

## Findings

- No actionable P0/P1/P2 visual or interaction defect remains. Desktop preserves the 320 px operations panel and spatial floor canvas; tablet exposes three floor columns with a 390 px right drawer; 390 px mobile exposes a true two-column floor grid.
- Compact `Masa listesi`, `Filtreler` and `Geçmiş` actions replace the long desktop list/filter surface below 900 px. Filters remain one shared projection, so the result count, floor plan and table list cannot disagree.
- The mobile filter surface is a bottom sheet; the table list is a tall bottom sheet; tablet uses the same contracts as right drawers. Opening from the compact list and selecting a table closes the list before opening the canonical detail drawer.
- All compact actions, floor-card overflow actions, close buttons, selects and the actual mobile search input measure at least 44 px high. Document width equals viewport width at every tested size.
- Dialogs expose Turkish accessible names, `aria-modal`, body scroll lock and inert background. Initial focus lands inside; Tab and Shift+Tab wrap in both directions; Escape closes and restores focus to the invoking control.
- Production-browser runtime health is clean: 0 console errors, 0 page errors and 0 HTTP responses at or above 400.

## Comparison history

1. Gate 3 kept the desktop navigation list visible on narrow screens, pushing the spatial plan below a dense control/list stack. Gate 4 replaces that stack with three compact operational entry points while preserving the desktop reference layout.
2. The first mobile measurement found the visible search wrapper at 30 px even though other controls were 44 px. The responsive contract now gives the actual search input and wrapper a 44 px interaction height; the final production evidence records 44 px.
3. A fast production capture could sample focus before React's dialog focus effect completed even though subsequent Tab wrapping passed. The evidence harness now waits for the initial focus contract before measuring; the final run records focus inside, forward/reverse wrapping and focus restoration for every tested sheet/drawer.
4. Final visual review found no cropping, incorrect radius, unintended overflow or hierarchy regression. Status colors remain paired with Turkish text labels and the existing token/icon system.

## Verification

- Dashboard lint: passed.
- Dashboard typecheck: passed.
- Dashboard architecture/model suite: 333 passed, 0 failed.
- Optimized dashboard production build: passed; `/dashboard/[restaurantId]/tables` is 12.7 kB route code and 335 kB First Load JS.
- Final production Playwright matrix: passed at all three viewports with isolated data and successful cleanup.

final result: passed

# Current Build Gate — Canlı Masalar Gate 4

Responsive mobile/tablet navigation, two-column/three-column salon layouts, filter and list sheet/drawer behavior, 44 px targets, focus lifecycle, automated suites, production build and production-browser evidence all pass. Gate 5 completion is documented below.

final result: passed

# Active Product Design Gate — Canlı Masalar Gate 5

- Source visual truth: the user-approved two-panel operations plan, supplied legacy Canlı Masalar screenshot, the pre-change 1440×1000 capture `test-results/tables-audit/01-desktop-main.png`, and Gate 2–4 comparison evidence above.
- Final production-browser evidence: isolated linked-DEV restaurant, an owner session and a separately provisioned temporary active employee session against the optimized dashboard build.
- Screenshots: `test-results/tables-floor-plan/gate5-mobile-legacy-import.png`, `gate5-mobile-legacy-success.png`, `gate5-desktop-realtime-conflict.png` and `gate5-desktop-reconnected.png`.
- Machine-readable evidence: `test-results/tables-floor-plan/gate5-evidence.json` and `gate5-bundle-evidence.json`.

## Findings

- No actionable P0/P1/P2 visual, accessibility, realtime or migration defect remains in Gate 5. The legacy banner fits the 390×844 two-column surface, retains the established type/radius/token system, and gives both decisions at least 44 px targets.
- Legacy import is explicit and fail-closed: two current-tenant table IDs were sanitized and imported, one unknown ID was skipped, dismissal did not initialize the server plan, the old localStorage value remained after dismissal and import, and `initializedAt` suppressed a second prompt after reload.
- The old Pano `FloorPlan` implementation and its parallel localStorage writer are removed. Pano now routes to the canonical server-backed Canlı Masalar surface.
- Owner and temporary employee edited the same floor concurrently. A remote revision reached the owner while their draft was open, exposed both Turkish conflict actions, and preserved the draft until the owner explicitly loaded the authoritative layout.
- A service-role fixture opened a session and added one order after both pages were live. Both owner and employee salon cards updated from the authoritative server projection; no realtime payload was trusted as UI state.
- Offline state changed to `Canlı güncelleme kesildi`; restoring the network returned to `Canlı güncelleme bağlı`. Final production timings were 4,881 ms for layout-conflict visibility, 6,829 ms for session/order convergence on both pages, and 3,399 ms for reconnect.
- The authenticated realtime implementation owns one channel per open client and publishes invalidation for tables, sessions, orders, payment shares and service requests. The heavy channel runtime and legacy parser are lazy chunks; floor cards are memoized and continue to share one clock.
- Final production-browser health: 0 console errors, 0 page errors and 0 HTTP responses at or above 400. The isolated restaurant, operational rows, membership and temporary auth user were all removed successfully.

## Visual comparison

- Desktop preserves the approved 320 px left operations panel, flexible spatial canvas and 360 px detail surface. The revision warning is placed between the edit properties and canvas, uses critical semantic tokens and keeps both recovery actions visible without covering tables.
- Mobile preserves the approved compact header and two-column table grid. The legacy banner sits before the grid, wraps explanatory Turkish copy without clipping and changes to the canonical success feedback after import.
- Empty, active and selected states remain legible through text, dots, borders and badges rather than color alone. No new raster, handcrafted SVG, placeholder or off-system icon was introduced.
- The final screenshots were reviewed against the supplied legacy composition and Gate 2–4 same-viewport evidence. No broken padding, crop, overflow, radius or typography regression was found.

## Verification

- Dashboard lint and typecheck: passed.
- Dashboard architecture/model suite: 338 passed, 0 failed; focused Masalar suite: 92 passed, 0 failed.
- Application suite: 175 passed, 0 failed; DB suite: 287 passed, 0 failed.
- Realtime publication migration test: passed; `20260729030000_tables_realtime_publication.sql` is applied in linked DEV.
- Optimized dashboard production build: passed. Canlı Masalar route code is 12.2 kB and First Load JS is 272 kB.
- Bundle gates: `/tables` entry 12,234/12,500 bytes and initial 271,618/350,000 bytes; `/tables/qr` entry 18,301/20,000 bytes and initial 148,528/155,000 bytes.
- Production owner/employee/legacy/reconnect Playwright matrix: passed with successful cleanup.

final result: passed

# Current Build Gate — Canlı Masalar Final

All five approved implementation gates are complete: atomic server layout, two-panel floor operations, canonical detail and quick actions, responsive/accessibility behavior, authenticated realtime conflict recovery, one-time legacy import and route-level performance budgets. The linked DEV migration and production-browser evidence pass. No production deployment was performed.

final result: passed

# Canlı Masalar — Salon Planı Gate 2 Visual QA

- Source visual truth: user-supplied conversation screenshot, 2026-07-29, plus the filesystem-backed pre-change operations evidence `/Users/furkancengelm3/dev/gersonless/test-results/tables-audit/01-desktop-main.png`
- Source viewport: the filesystem-backed comparison source is 1440×1000 CSS px at deviceScaleFactor 1; the embedded conversation reference is used for composition and product intent because its browser density is unavailable
- Implementation screenshots: `/Users/furkancengelm3/dev/gersonless/test-results/tables-floor-plan/desktop-initial.png`, `/Users/furkancengelm3/dev/gersonless/test-results/tables-floor-plan/tablet-initial.png`, and `/Users/furkancengelm3/dev/gersonless/test-results/tables-floor-plan/mobile-initial.png`
- Combined source/implementation comparison: `/Users/furkancengelm3/dev/gersonless/test-results/tables-floor-plan/desktop-before-after.png`
- Focused interaction evidence: `/Users/furkancengelm3/dev/gersonless/test-results/tables-floor-plan/desktop-selected.png`, `/Users/furkancengelm3/dev/gersonless/test-results/tables-floor-plan/desktop-late-filter.png`, `/Users/furkancengelm3/dev/gersonless/test-results/tables-floor-plan/desktop-edit-draft.png`, and `/Users/furkancengelm3/dev/gersonless/test-results/tables-floor-plan/desktop-revision-conflict.png`
- Browser viewports: 1440×1000 desktop, 834×1112 tablet, and 390×844 mobile; all at deviceScaleFactor 1 against the optimized production server
- Fixture: temporary isolated DEV restaurant with empty, newly opened, active, late, fully collected, service-request, floor and area states; cleanup completed successfully
- Console/page/HTTP errors: 0/0/0 in the final production Playwright run

## Findings

- [P1 fixed] The additive layout migration was initially absent in linked DEV, and the new pinned restaurant/table projections converted that schema mismatch into a misleading route-level 404. The DB read adapters now retry only PostgreSQL undefined-column failures through pinned pre-layout projections, synthesize safe null/default layout values, and leave layout saving disabled until the service-only RPC is present. The migration is now applied in linked DEV and the server-backed edit path is enabled.
- [P1 fixed] Floor-local automatic coordinates overlapped when `Tüm katlar` rendered several floors in one canvas. The all-floor state is now explicitly labelled `Tüm katlar · Özet` and receives a deterministic read-only overview coordinate space; floor-specific persisted coordinates remain authoritative once a floor is selected.
- [P2 fixed] The original 11.5% horizontal-card height clipped money and badge rows at the desktop canvas height. Physical layout dimensions now reserve 108 px in the verified 1440 px state, while tablet/mobile cards retain their 132/126 px responsive heights.
- [P2 fixed] Automatic placement sorted `Masa 11` between `Masa 1` and `Masa 2`. Turkish natural numeric sorting now preserves human table order. Zero-order newly opened sessions also no longer announce or render a misleading `₺0 açık` amount.
- No remaining P0/P1/P2 mismatch is visible in the read-only operational surface. The 320 px desktop panel, flexible floor canvas, 2-column mobile grid, state hierarchy and filter synchronization match the approved direction.

## Mandatory comparison pass

- Fonts and typography: the implementation keeps the existing Geist/Inter product stack and compact operations hierarchy. Card labels, status overlines, duration, money and badges remain readable without clipped baselines at all three viewports.
- Spacing and layout: desktop measures a 320 px left panel after the 56 px icon rail and a 1064 px floor region. Tablet/mobile intentionally stack the compact list above the floor surface. Document width equals viewport width at 1440, 834 and 390 px; no horizontal page overflow was recorded.
- Colors and tokens: empty, new, active and late cards use neutral, warning, positive and critical tokens, with Turkish text labels and dots so color is never the sole state signal. The collected state adds a `Tahsil edildi` badge.
- Icons and assets: floor, drag, seat, notification and action glyphs come from the existing application icon library. This operational surface requires no raster imagery and introduces no placeholder, custom SVG or CSS illustration.
- Copy and content: the isolated matrix demonstrates coherent Turkish names, amounts, elapsed time, service request and collection feedback. The migration-window error is explicit and does not imply that a safe save occurred.
- States and interactions: floor-card selection sets `aria-pressed=true` and synchronizes the compact row. The late filter reduces both surfaces to exactly one matching table. Realtime reached `Canlı güncelleme bağlı` in each viewport. A keyboard move plus shape/capacity change persisted at revision 1; a stale second tab received the Turkish revision-conflict controls and safely retried its retained draft at revision 2.
- Accessibility and targets: card states have complete Turkish accessible names; the 390 px cards measure 172×126 px, filter controls use labelled native selects, selected focus/outline is visible, and no horizontal overflow was measured.

## Comparison history

1. Initial production-browser attempt: all three routes returned 404 because linked DEV lacked the Gate 1 additive columns.
2. Rolling-deploy fix: undefined-column reads degrade to pinned legacy projections; the pre-migration repeat browser run returned HTTP 200 with zero console/page/HTTP errors and an explicit save-disabled message.
3. First visual pass: all-floor cards overlapped and desktop card content clipped. Natural label ordering also placed `Masa 11` incorrectly.
4. Post-migration production pass: eight isolated operational states occupy distinct coordinates, card content is complete, desktop/tablet/mobile widths do not overflow, selection and late filtering stay synchronized, and fixture cleanup reports success.
5. Two-tab production pass: tab A persisted a keyboard move, square shape and six-seat capacity at revision 1; stale tab B received the revision-conflict alert with both recovery choices, retained its local draft and saved at revision 2. Exact request replay was idempotent, same-ID/different-payload and foreign-table writes were rejected, and anonymous/authenticated clients could not call the service-only RPC.

## Server-backed edit verification

- Linked DEV contains `20260729020000_table_floor_layout.sql`, matching local migration history.
- Service-role snapshot/save, atomic revision increment, exact request-id replay, immutable request intent, tenant table ownership and rollback were exercised against disposable fixtures.
- The final browser and RPC evidence contains no restaurant IDs, auth tokens or secret values. All temporary fixtures were removed successfully.

final result: passed

# Current Build Gate — Canlı Masalar Salon Planı

The two-panel operations surface, responsive floor grid, operational states, selection/filter synchronization, rolling-deploy fallback, server-backed layout editing, revision conflict recovery, automated suites, production build and bundle budgets pass. The additive migration and browser/RPC edit matrix are verified in linked DEV with disposable fixtures.

final result: passed

# Menu Maintenance Debt Closure — 2026-07-28

- `MenuPageClient` was reduced from 1,502 to 1,105 lines. Table-bill reconciliation, membership/loyalty preview, persisted order tracking and idempotent checkout now live behind four focused client hooks.
- The split preserves the existing server-authoritative money path, request-id retry behavior, member balance reconciliation, protected table-state polling and order-status presentation.
- Knip now passes with zero actionable findings. The unused menu `tsx` dev dependency, obsolete analytics/activity queries, unused settings primitives/constants and redundant exports were removed; internal-only helpers and types are no longer public.
- The remaining Knip exclusions are deliberately narrow: DB compatibility/service ports and the UI menu barrel remain public package contracts even when this workspace has no direct consumer for every exported member.
- Verification: workspace lint has zero errors (two pre-existing marketing `<img>` warnings), all workspace typechecks pass, architecture suites pass, DB tests pass 266/266, and menu/dashboard production builds pass. Menu First Load JS is 248 kB.

final result: passed

# Navigation Drawer Redesign Visual QA

- Source visual truth: `/Users/furkancengelm3/Desktop/nav-drawer.html`
- Source target: 480×820 mobile navigation drawer reference
- Implementation: `packages/ui/src/menu/NavDrawer.tsx`
- State: drawer open, category hierarchy visible, optional table and information sections present
- Reference screenshot: `/private/tmp/nav-drawer-reference-open.png`
- Implementation screenshot: `/private/tmp/nav-drawer-live.png`
- Browser evidence: Playwright Chromium, 480×820, `/maf-lounge?preview=1`, 2026-07-26
- Primary interactions covered in code: open/close, scrim and Escape dismissal, category search, category and subcategory navigation, visual-category routing, bill opening, hours expansion, Wi-Fi expansion and copy actions
- Console errors checked: 0

## Findings

- The production drawer follows the reference hierarchy and responsive proportions while using tenant theme tokens. At 480×820 the measured live frame is 370×820, opens from x=0, and keeps the customer actions fixed at the bottom.
- Wi-Fi and working-hours blocks are projected into the drawer only when their section instances exist in the published page flow.
- Reference and live captures were compared at the same viewport. Brand header, search, root/child hierarchy, count badges, active row and fixed actions are all represented; the live version intentionally uses the restaurant's green theme instead of copying the reference gray surface.
- Escape closes the drawer, `aria-hidden` changes from false on open, and the dialog is removed from the tab order when closed. Focus cycling is trapped inside the open dialog.

## Residual test gap

- The current MAF draft does not contain drawer-placed Wi-Fi/hours instances, so their expanded pixels were verified from component implementation and schema tests rather than this tenant capture.
- Signed-in editor click-through was not automated in this run; the preview message bridge and selection behavior are covered by type/architecture checks.

final result: passed

# Promo Slider Campaign Card Visual QA

- Source visual truth: conversation screenshot, 2026-07-25
- Target state: active Combo Ribbon, Daily Special and Discount Badge campaigns rendered inside the same compact slider frame
- Implementation screenshot: not captured — in-app Browser reported no available browser backend
- Automated render evidence: static markup verifies the full long combo title, a two-line clamp, countdown state and configured countdown label

## Findings

- [P1 fixed in code] Long combo titles previously used an oversized single-line presentation and were clipped by the fixed card width.
- [P1 fixed in code] Daily Special and Discount Badge deadlines were present in source campaign state but had no visible countdown in the slider card.
- [P2 fixed in code] Price and title colors could lose contrast on campaign-colored surfaces.
- [P2 fixed in code] Changing countdown digits could alter inline width and make the compact card feel unstable.

## Implemented response

1. Campaign cards now use a 170px shared frame, responsive media width and a compact content column.
2. Titles wrap to at most two lines with `overflow-wrap`, so long combo names remain readable without escaping the card.
3. Countdown-enabled Daily Special and Discount Badge slides show a stable `HH:MM:SS` row and preserve the source campaign's custom countdown label.
4. Countdown digits use tabular numerals and a fixed-width value slot, preventing second-by-second layout movement.
5. Expired campaigns still retire from the slider without a page refresh.

## Verification

- Component/model tests: 6 passed, 0 failed.
- `@garsonless/ui` lint: passed.
- `@garsonless/ui` typecheck: passed.
- `@garsonless/menu` typecheck and production build: passed.
- Visual browser comparison remains blocked until an in-app Browser backend is available.

final result: blocked

# Current Build Gate — Header Redesign

The current handoff is the Header and Customer Actions redesign documented above. Its 390×820 source/implementation comparison, 320 px compact capture, table-context Drawer capture, service-sheet interaction evidence, and comparison history are complete with no remaining P0/P1/P2 finding.

final result: passed

# Section Catalogue and Information Preview Visual QA

- Source visual truth: user-supplied conversation screenshot, 2026-07-26, showing the `Bölüm ekle` catalogue with empty Çalışma Saatleri/Wi‑Fi placeholders and the retired Alerjen/Yorumlar cards
- Source pixels: 1919×1342; the embedded source has no filesystem path or reliable CSS-density metadata, so it is used as a composition and product-state reference rather than for pixel-distance scoring
- Implementation screenshot: `/Users/furkancengelm3/dev/gersonless/apps/dashboard/test-results/product-design/info-sections-preview.png`
- Drawer interaction screenshot: `/Users/furkancengelm3/dev/gersonless/apps/dashboard/test-results/product-design/drawer-focus-after-theme-update.png`
- Implementation pixels: focused information-preview board 920×379; live drawer capture 390×2246; both captured at deviceScaleFactor 1
- Browser viewport: preview board 980×640; live menu drawer 390×844
- State: settings-backed opening hours and catalogue-safe guest-network data; live drawer open with its search input focused while a full theme update rerenders Header
- Console errors checked: 0 in the final Playwright run

## Findings

- No actionable P0/P1/P2 issue remains. İstek Butonları now precedes Çalışma Saatleri in catalogue order; Alerjen Bilgileri and Yorumlar are absent; the remaining catalogue contains 14 ready sections and no stale `geliştiriliyor` footer count.
- Fonts and typography: the new cards use the existing body-font token, compact 14 px headings, 10–11.5 px metadata and strong tabular-looking hour values. Hierarchy remains readable at catalogue scale without introducing a new type family.
- Spacing and layout rhythm: both previews use the product's card radius, border, shadow, 38 px icon tile and 37 px information rows. The focused capture shows aligned outer cards and consistent header/body rhythm; Wi‑Fi is intentionally shorter because it has two data rows instead of three schedule rows.
- Colors and visual tokens: surfaces, borders, accent, soft-accent, primary text and secondary text all come from the live theme variables. Open/today and guest-network states use the same green semantic treatment as the existing drawer.
- Image quality and asset fidelity: these information sections require no raster media. Clock, globe and copy glyphs come from the existing Lucide-backed application icon library; no placeholder art, emoji, handcrafted SVG or CSS illustration was introduced.
- Copy and content: the schedule identifies `Bugün` and reads each interval from `restaurants.settings.hours`; when no schedule has been saved it shows an honest empty state instead of fabricated hours. Wi‑Fi shows a representative guest SSID and masks the password.

## Comparison History

1. Initial source finding [P1]: Çalışma Saatleri and Wi‑Fi used generic empty dashed placeholders, so selection did not explain the resulting section. Fix: add canonical token-driven schedule and network cards; hours use the saved business schedule while Wi‑Fi retains a catalogue-only safe example. Post-fix evidence: `info-sections-preview.png`, plus four server-rendered component tests.
2. Initial interaction finding [P1]: every Wi‑Fi keystroke rerendered the preview Header, changed the inline Drawer close callback and reran the focus effect, moving focus into the iframe. Fix: keep the latest close callback in a ref and make the focus/trap effect depend only on the open transition.
3. Post-fix interaction evidence: Playwright focused the live drawer search, entered `K`, dispatched the same `FULL_THEME_UPDATE` used by the editor, retained focus, completed `Kahve`, and closed the Drawer with Escape. This exercises the same iframe rerender path that previously broke Wi‑Fi typing.

## Focused Comparison Evidence

- The conversation source and focused implementation capture were reviewed together for card hierarchy, catalogue density, typography, radius, token color and explanatory content. Exact pixel scoring was intentionally avoided because the source includes the whole 1919×1342 dialog while the implementation evidence isolates the two changed preview regions.
- A separate full-height live drawer capture records the interactive focus state; it is not used for picker geometry comparison.

## Follow-up Polish

- P3: unusually long custom Wi‑Fi notes are single-line truncated in the compact catalogue card; the full editor retains the complete text and the live drawer displays it in the expanded information panel.

final result: passed

# Current Build Gate — Section Catalogue and Information Previews

The current handoff is the Section Catalogue and Information Preview update documented above. Catalogue order/removal, settings-backed hours, meaningful preview content, live rerender focus retention, Escape dismissal, component tests, architecture tests, lint, typecheck and the menu production build all pass.

final result: passed

# Global Minimal Footer Visual QA

- Source visual truth: user-approved Global Minimal Footer plan, 2026-07-27
- Implementation: `packages/ui/src/menu/MenuFooter.tsx`
- Implementation screenshot: not captured — the in-app Browser reported no available browser backend
- Target viewports: 320, 390 and 768 CSS px
- Automated evidence: footer render/normalization/contrast tests, canonicalization tests, dashboard architecture suite, UI suite, package lint/typechecks and menu production build
- Live server health: `/maf-lounge?preview=1` returned HTTP 200 on localhost:3011 after the production build

## Implemented response

1. Retired addable Social Media and Footer blocks are removed from the section catalogue and legacy theme flows are canonicalized away.
2. The global Announcement settings and runtime bar are removed; the left editor navigation now exposes one global Footer group.
3. The Footer renders once after page content, omits unavailable data, uses normalized safe contact/social links and reserves bottom clearance for fixed cart/service controls.
4. Content visibility and Surface/Brand/Dark tone controls update through the canonical theme contract. Selecting Footer sends a scoped preview message that scrolls the menu to the global footer.

## Residual test gap

- Capture and compare the enabled Footer at 320, 390 and 768 px with complete and sparse store data.
- Verify the editor scroll-to-footer interaction and live tone/content changes in a signed-in preview.
- Confirm fixed cart and floating service controls do not cover the last footer link at each target viewport.

final result: blocked

# Current Build Gate — Global Minimal Footer

The implementation and automated acceptance gates pass. Visual and signed-in editor interaction evidence remains blocked until an in-app Browser backend is available; therefore this gate is not marked passed.

final result: blocked

# Current Build Gate — Product Detail Upsell and Note

The current handoff is the Product Detail, Recommendations and Product Note implementation documented above. All automated acceptance gates pass; browser-rendered comparison and interaction evidence remain blocked because no browser backend is available in this session.

final result: blocked

# Menu End-to-End Audit Closure — 2026-07-28

- Release-blocking path: real table QR → simple item → required modifier → removable ingredient → configured recommendation → product note → cart → order API → authoritative DB snapshot → dashboard order card → kitchen card.
- Failure recovery: non-JSON 502 and offline failures both restore the checkout action and expose a retryable `role="alert"`; the successful retry reuses the request id and a direct replay returns the same order.
- Fixture safety: product/recommendation fixtures restore in Playwright teardown even after timeout; generated smoke orders use the canonical cancellation path. Final DEV verification found zero active smoke orders.
- Responsive/browser evidence: public menu passed desktop, mobile, tablet, 200% reflow, reduced-motion, focus-loop/restore, QR-less checkout and category-navigation scenarios. Result: 16 passed; authenticated dashboard matrix remained credential-gated, while the golden test authenticated an owner specifically to verify the order card.
- Performance evidence from a production build: TTFB 470.8 ms, LCP 876 ms, initial JavaScript transfer 255,217 bytes, and product interaction below the 300 ms budget. Public restaurant/catalogue queries use short-lived, mutation-invalidated data caches.
- Production builds: menu 247 kB route First Load JS, dashboard and kitchen all passed.
- Static gates: workspace lint has zero errors (two pre-existing marketing `<img>` warnings), all workspace typechecks passed, architecture suites passed, and DB tests passed 266/266.
- Dead-code follow-up is closed: manually verified candidates were cleaned, intentional package contracts are explicitly allowlisted, and Knip now passes with zero actionable findings.

## Non-blocking follow-up debt

- The runtime has one canonical theme rather than independent light/dark templates. Current published custom-theme and semantic-token paths are covered; a future dedicated dark-mode product decision needs its own contrast matrix.

final result: passed

# Active Product Design Gate — Canlı Masalar Gate 3

- Source visual truth: user-approved two-panel restaurant operations plan and supplied legacy Canlı Masalar screenshot, 2026-07-29.
- Browser evidence: isolated linked-DEV restaurant, Chromium at 1440×1000, 834×1112 and 390×844; fixture cleanup passed.
- Screenshots: `test-results/tables-floor-plan/gate3-desktop-detail.png`, `gate3-desktop-context-menu.png`, `gate3-desktop-transfer.png`, `gate3-tablet-drawer.png`, `gate3-mobile-context-menu.png`, `gate3-mobile-bottom-sheet-top.png` and `gate3-mobile-bottom-sheet.png`.
- Data projection: quantity, modifiers, removed ingredients and product notes rendered from the authoritative table-detail action. The UI displayed ₺1.615 total, ₺235 collected and ₺1.380 remaining, matching the isolated order/payment-share fixture.
- Interaction: normal click and Enter open the detail surface; right-click, `Shift+F10`/Menu and the 44×44 mobile overflow button open one quick-action menu. Arrow navigation, Escape and focus restoration passed.
- Canonical operations: one selected order opened the existing transfer dialog; full account transfer preselected all eight fixture orders and exposed the occupied-target merge state; whole-table move listed only empty targets. Settlement and new-order surfaces opened without performing a destructive mutation.
- Accessibility: transfer, settlement, table properties, new order, tablet drawer and mobile sheet all exposed Turkish labelled dialogs with focus inside, body scroll lock and inert background. Tablet/mobile Escape restored focus to the invoking card.
- Responsive: desktop uses a 360 px detail aside, tablet a 390 px drawer, and mobile a 390×709 bottom sheet. Mobile long content owns its scroll while the 44 px action footer remains visible; no viewport had horizontal overflow.
- Runtime health: zero console errors, page errors and HTTP responses ≥400 in the final matrix.

## Comparison history

1. Initial mobile capture found the bottom sheet capped only with `max-height`; the detail child expanded instead of creating a scroll owner, clipping the sticky action footer.
2. The sheet now has a bounded height and hidden outer overflow. Re-capture verified `contentScrollable: true` and stable footer position after scrolling to the final order.
3. Gate 2's additive migration, atomic save, revision conflict and retry evidence was already completed in the same evidence folder; Gate 3 reuses that server layout rather than a parallel local plan.

final result: passed

# Active Product Design Gate — TBL-014 Ürün/Adet Taşıma

- Source visual truth: user-supplied unselected and selected modal screenshots, 2026-07-29. The source demonstrates the P1 state-change defect: selecting a product introduces a stacked `Taşınacak adet` block and expands each selected row/card.
- Implementation screenshot: unavailable — this session still has no in-app Browser backend, so no post-fix pixels are claimed.
- Intended viewport/state: desktop transfer dialog, same order and product content immediately before and after checking a product.
- Implementation: ürün satırı checkbox'ı, `1 / N` adet seçicisi, sipariş düzeyi indeterminate seçim ve 44 px native kontroller tamamlandı.
- Geometry fix: every product row now reserves a fixed `44px minmax(0,1fr) 92px` grid and a 92×44 value slot. The unselected price and selected quantity control swap in the same slot; selection cannot add a second text row or increase the row's 58 px minimum height.
- Server behavior: kısmi snapshot/total split, tam siparişte kimlik koruma, canonical request intent, service-role sınırı ve drift-safe undo linked DEV üzerinde çalıştı.
- Runtime evidence: `test-results/tables-audit/tbl-014-item-transfer-db-runtime-evidence.json`; 8/8 suite, `2/3` adet taşıma, replay/collision/undo ve sıfır fixture kalıntısı.
- Static gates: latest dashboard lint and typecheck passed; focused selector/architecture/settlement tests passed 39/39; dashboard production build passed. Earlier application/DB and linked-DEV runtime gates remain green.
- Browser scenario: `tests/tables-runtime/tables-runtime.spec.ts` masaüstü ve 390×844 seçim, adet, commit, Realtime görünüm ve exact toast undo adımlarını içeriyor.
- Visual evidence: bekliyor — in-app Browser keşfinde kullanılabilir backend bulunmadı. Yeni selector için eski screenshot yeniden kullanılmadı.
- User acceptance: localhost üzerinde art arda ürün seçimi denendi; kartın artık büyümediği kullanıcı tarafından 2026-07-29 tarihinde onaylandı.
- Localhost: dashboard `http://localhost:3000`, menu preview `http://localhost:3011`; ikisi de HTTP 200 veriyor.

## Current findings

- [P1 fixed in code] Product selection changed card height and caused cumulative modal growth. Price and quantity now occupy one invariant right-hand slot.
- [P2 fixed in code] The selected state used a visually detached label above the select. The compact native select now stays aligned with product name and checkbox while retaining a Turkish accessible name.
- P3: the exact post-fix pixel comparison is still pending because a rendered implementation screenshot cannot be captured in this session.

## Comparison history

1. User evidence: unselected rows are compact; selected rows gain a second vertical control block, increasing the card and modal height for every tick.
2. Code fix: replace conditional auto-sized content with an invariant three-column row and fixed 92×44 value slot; preserve the 44 px touch target and screen-reader label.
3. Post-fix visual acceptance: localhost etkileşimi kullanıcı tarafından geçti; otomatik aynı-viewport screenshot karşılaştırması browser backend bekliyor.

final result: blocked

---

# Error Screen Design QA

## Scope

- Source visual truth: `/Users/furkancengelm3/Desktop/error-screen (1).html`
- Implementation: `packages/ui/src/errors/RecoveryScreen.tsx`
- States: light 500, light 404, dark 404
- Viewports: 1440×1000, 820×1000, 390×844 CSS pixels at 1× density

The supplied HTML references `../../styles.css`, which was not included with the attachment. The DOM, embedded component CSS and interaction hierarchy were therefore used as the exact source specification; the unstyled local render is retained only as structural evidence.

## Evidence

- `test-results/error-screen/reference-desktop-chrome.png` — source HTML structural render, 1353×768
- `test-results/error-screen/implementation-desktop-1440x1000.png` — light 500, 1440×1000
- `test-results/error-screen/implementation-tablet-820x1000.png` — light 500, 820×1000
- `test-results/error-screen/implementation-mobile-390x844.png` — light 500, 390×844
- `test-results/error-screen/implementation-dashboard-light-404.png` — Dashboard 404
- `test-results/error-screen/implementation-kitchen-dark-404.png` — Kitchen dark 404
- `test-results/error-screen/implementation-menu-light-404.png` — Menu 404
- `test-results/error-screen/implementation-platform-admin-light-404.png` — Platform Admin 404

The reference and implementation desktop captures were inspected together. The implementation preserves the centered brand/card composition, decorative field, amber warning hierarchy, oversized status watermark, public code row and primary/secondary action order. Deliberate product changes are the removal of the unstable timestamp and omission of the status footer when no trusted HTTPS URL is configured.

## Findings and iterations

1. The first 390 px capture exposed horizontal clipping because the initial Chrome headless window reported a 500 px minimum viewport. The final capture used Chrome DevTools device metrics and verified `innerWidth=390`, `scrollWidth=390`.
2. Grid tracks, universal box sizing, desktop track centering and small-screen actions were constrained so the card shrinks safely and both actions become full width.
3. The code-copy control was increased to a real 44×44 px interactive target.
4. Kitchen contrast was checked in the shared dark appearance; text, borders and primary navigation remain visually distinct.
5. Interactive Chrome showed a development-only Next.js issue badge caused by extension-injected body attributes. Clean extension-disabled captures do not contain an application error surface regression; the small Next.js development launcher remains dev-only.

## Severity review

- P0: none
- P1: none
- P2: none
- P3: development-only Next.js launcher appears in dev screenshots; absent from production builds

final result: passed

---

# Error Screen Logo ve Noktalama Takibi

## Kaynak ve uygulama

- Kaynak: kullanıcının işaretlediği açık 500 ekranı ve merkezi `assets/brand/masabu-logo-transparent-256px.png` marka varlığı.
- Uygulama: `packages/ui/src/errors/RecoveryScreen.tsx`.
- Açık görünüm kanıtları: `test-results/error-screen/logo-copy-desktop-1440x1000.png` ve `logo-copy-mobile-390x844.png`.
- Koyu görünüm kanıtı: `test-results/error-screen/logo-dark-desktop-1440x1000.png`.
- Gerçek Dashboard 404 kanıtı: `test-results/error-screen/final-dashboard-logo-404-mobile.png`.
- Ortak ünlem ikonu kanıtları: `test-results/error-screen/final-alert-404-desktop-1440x1000.png` ve `final-alert-404-mobile-390x844.png`.

## Karşılaştırma ve sonuç

1. Metinle oluşturulan siyah `M` işareti ve yanındaki `Masabu` yazısı kaldırıldı; aynı yuvaya resmi, şeffaf Masabu wordmark'i doğal en-boy oranıyla yerleştirildi.
2. Koyu Kitchen yüzeyinde siyah logo harflerinin kaybolmaması için wordmark, küçük ve nötr bir marka yüzeyinde gösterildi.
3. Örnek hata açıklamasındaki uzun tire kaldırıldı; düşünceler ayrı Türkçe cümleler halinde noktayla ayrıldı.
4. Chrome'da 390×844 ve 1440×1000 açık görünüm ile 1440×1000 koyu görünüm incelendi. Logo kırpılmıyor, cümleler doğal akıyor ve yatay taşma bulunmuyor.
5. 404 için kullanılan pusula ikonu kaldırıldı. Ortak hata bileşenindeki 404 ve 500 durumları artık aynı, net ünlem üçgenini kullanıyor; böylece dört uygulamadaki bütün ortak hata yüzeyleri tutarlı.

## Önem derecesi

- P0: yok
- P1: yok
- P2: yok
- P3: yok

final result: passed

---

# Masabu Müşteri Kimliği — Dilim 3 Görsel QA

## Kaynak, viewport ve kanıt

- Source visual truth: `/Users/furkancengelm3/dev/gersonless/test-results/customer-auth-audit/screenshots/02-auth-ui/00-reference.jpg`.
- Browser-rendered implementation: `/Users/furkancengelm3/dev/gersonless/test-results/customer-auth-audit/screenshots/02-auth-ui/02-auth-join-desktop-1352x768.png`.
- Full-view comparison: `/Users/furkancengelm3/dev/gersonless/test-results/customer-auth-audit/screenshots/02-auth-ui/03-reference-vs-implementation-desktop.png`.
- Focused comparison: `/Users/furkancengelm3/dev/gersonless/test-results/customer-auth-audit/screenshots/02-auth-ui/04-reference-vs-implementation-focus.png`.
- Mobil durumlar: `02-auth-ui/01-auth-join-390x844.png`, `03-email-otp/01-otp-390x844.png` ve `04-google-return/01-google-return-390x844.png`.
- Desktop source pixels: 1352×768. Implementation capture: 1353×768; comparison input crops the implementation by one non-content edge pixel to 1352×768 without scaling. Combined full-view evidence is 2720×804 with neutral gutters.
- Mobile CSS viewport: 390×844; DevTools device screenshot pixels: 780×1688 at deviceScaleFactor 2. No density conversion was needed between the three implementation states.
- State: giriş/üyelik formu, 6 haneli OTP ve güvenli Google dönüş başarı yüzeyi.

## Findings

- No actionable P0/P1/P2 visual, responsive, interaction or accessibility mismatch remains.
- Fonts and typography: the source's serif display/body contrast is preserved through the existing Masabu display/body tokens. Hero titles, labels, consent copy and OTP meta copy wrap without clipping at 390 px.
- Spacing and layout rhythm: the green hero and dark action panel preserve the source hierarchy and rounded panel seam. Mobile uses full-height/safe-area spacing; desktop centers a bounded modal. The 390×844 join capture keeps the guest action visible and the OTP grid retains six equal cells.
- Colors and visual tokens: the implementation maps the source green/near-black/white hierarchy to tenant-aware Masabu tokens, with explicit disabled, error, offline and focus states and sufficient foreground contrast.
- Image quality and asset fidelity: the Google mark is the supplied vector brand asset; navigation/status glyphs use the repository icon system. No emoji, placeholder image, custom inline SVG or CSS illustration is visible in the auth surfaces.
- Copy and content: name, required KVKK disclosure and optional/default-off marketing consent are deliberate product requirements. The unavailable phone path is omitted until verified SMS exists; disabled Apple/Facebook providers are hidden as required.
- Accessibility and interactions: native checkboxes and six native OTP inputs are exposed in Chrome accessibility output. The production OAuth-return dialog moves focus inside, Tab wraps between its two controls, Escape closes it, and controls meet the 44 px target contract. OTP paste, `aria-live`, offline state and reduced-motion behavior are covered by the source-contract tests.
- Runtime health: the optimized production page reports 0 console messages. Filtering the recorded Chrome Network log by `status-code:>=400` returns no request rows. The development-only hydration warning seen in the user's normal profile was traced to an extension-injected `bis_skin_checked` attribute and is absent from the production evidence.

## Open Questions / accepted constraints

- The reference includes a phone tab and Apple/Facebook actions. Their absence is intentional: SMS verification is not available, and disabled providers must not be shown.
- The implementation asks for name and consent before email/Google continuation, so its dark panel is denser than the visual-only reference. This is the approved account contract rather than unresolved design drift.

## Comparison history

1. Initial implementation [P1]: the existing light loyalty sheet did not match the reference's branded green hero and dark transaction panel. Fix: a responsive full-height/modal auth frame, brand hero, dark panel and source-aligned provider/guest hierarchy.
2. First accessibility pass [P1]: decorative consent treatment and a single OTP field did not meet the approved interaction contract. Fix: real independent checkboxes, six labelled OTP inputs with paste distribution, focus trap/restore, Escape, live errors, safe-area and reduced-motion rules.
3. First browser evidence [P2, evidence-only]: a Chrome extension injected `bis_skin_checked` during development and caused the Next.js issue badge to cover the lower-left of the OTP capture. Fix: the development preview isolates the Next portal from screenshot evidence; the optimized production run independently confirms a zero-message console and no HTTP responses at or above 400.
4. Post-fix full and focused comparisons: hero proportions, panel seam, typography, radii, provider hierarchy and control density were reviewed together at the same desktop viewport. The remaining phone/provider/content differences are the accepted product constraints above, not actionable visual defects.

## Verification

- Menu lint: passed.
- Menu typecheck: passed.
- Menu tests: 30 passed, 0 failed.
- Optimized production build: passed; `/[slug]` First Load JS is 277 kB and the customer Auth SDK is not in the browser startup bundle.
- Chrome production interaction: focus order, focus trap and Escape passed; console and failed-request filters are clean.

final result: passed

---

# Masabu Ana Sayfa Ortak Bölüm Kataloğu QA

## Son kapsam

- Ana sayfanın `Bölüm ekle` deneyimi Menü yüzeyindeki aynı dialog, arama, kategori, kart, gerçek bileşen önizlemesi ve ekleme davranışını kullanır.
- Menü kataloğundaki 12 gerçek bileşenden yalnız halka açık ana sayfa bağlamına uygun olmayan `İstek Butonları`, `Çalışma Saatleri` ve `Wi‑Fi Bilgisi` çıkarılır.
- Ana sayfaya Menüden farklı tek bileşen olarak Pro `Video Hero` eklenir. Sonuç kataloğu 10 öğedir: Hero Banner, Video Hero, Promo Şeridi, Öne Çıkanlar, Şef'in Seçimi, Kombo Şerit, İndirim Rozeti, Günün Özeli, Kampanya Slider ve Foto Galerisi.
- Ortak Menü bileşenleri ayrı ana sayfa taklitleri değildir; aynı registry kaydını, ayar şemasını, medya yükleme panellerini ve canonical renderer'ı kullanır.
- Video Hero poster-first çalışır ve sunucu tarafında Pro, video/poster çifti ve sahiplik doğrulamasına tabidir.
- Legacy yayın, kullanıcı taslağı kaydedene kadar değişmez; ilk V2 düzenlemesi otomatik mock blok eklemeden boş bölüm akışıyla başlar.

## Chrome doğrulaması

- Ana sayfa bölüm seçicide `Tümü 10`, `Üst Bölümler 3`, `Ürün Gösterimi 2`, `Promosyon 4` ve `Bağlam 1` sayaçları doğrulandı.
- On bileşenin erişilebilir adları Chrome ağacında doğrulandı; Wi‑Fi, Çalışma Saatleri ve İstek Butonları görünmüyor.
- Menüdeki gerçek Hero Banner ana sayfaya geçici olarak eklendi; aynı sağ panel alanları ve güvenli `/{slug}/menu` CTA hedefi önizlemede doğrulandı. QA değişikliği undo ile geri alındı; Kaydet/Yayınla kullanılmadı.

## Otomatik doğrulama

- Dashboard: 483 test geçti.
- Menu: 56 test geçti.
- UI: 28 test geçti.
- Design Engine: 19 test geçti.
- Dashboard, Menu, UI ve Design Engine lint/typecheck geçti.
- Dashboard ve Menu production build geçti; kalıcı Menü rotası 276 kB first-load JS ile sınır içinde kaldı.

final result: passed
