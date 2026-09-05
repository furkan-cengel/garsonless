# Tema auditi — uygulanan düzeltmeler

Tarih: 2026-09-05. Kaynak bulgular: [Tema auditi](theme-audit.md).

Altı bulgunun kod düzeltmesi tamamlandı. Mevcut LCP çalışmasına dokunulmadı. Yeni bağımlılık, framework yükseltmesi veya veritabanı migrasyonu eklenmedi. Değişiklikler yerel çalışma ağacında; bu çalışma için commit, push veya production deploy yapılmadı.

## Düzeltmeler

| Bulgu | Yeni davranış | Uygulama / doğrulama |
|---|---|---|
| F1 · P1 · Yeni sekme taslağı göstermiyor | Editör içi alan **Taslak önizlemesi**, yeni sekme bağlantıları **Yayınlanmış tasarımı yeni sekmede aç** olarak ayrıldı. Uzun imzalı önizleme URL’si görünür arayüzden kaldırıldı. | `ThemeEditorCanvas.tsx`, `ThemeEditorTopbar.tsx`. Tarayıcıda iki alanın etiketleri doğrulandı. Yeni sekmeye taslak aktarma servisi eklenmedi; auditin önerdiği açık etiketleme seçeneği uygulandı. |
| F2 · P1 · Çakışma/yenilemede yerel çalışma kaybı | Kullanıcı, restoran ve tema bazında sekmeye özel yerel yedek; sunucudan yetkili güncel taslak okuma; üç sürümü karşılaştırarak birleştirme; çakışan alanlarda açık yerel/güncel seçimi; yerel kopya indirme ve vazgeçme seçenekleri eklendi. Karar verilene kadar editör etkileşimleri bekletiliyor. | `theme-draft-recovery-model.ts`, `use-theme-draft-recovery.ts`, `ThemeDraftRecoveryPanel.tsx`, `use-theme-editor-lifecycle.ts:261`, `lib/actions/theme.ts:91`. Geri dönüş, gerçek yenileme, güncel taslağı okuma, renk geri yükleme ve yerel yedeği bırakma tarayıcıda geçti. |
| F3 · P1 · Sunucuda başlık kontrastı kontrolü eksik | Sekiz kontrast grubu tek `inspectThemePublishContrast` sözleşmesinde toplandı. Sunucu, sanitize edilmiş taslakta başlık kontrastını da denetliyor. Hata; alan, ölçülen oran ve gereken oranı bildiriyor. Taslak kaydı eksik kontrastlı çalışma için kullanılmaya devam ediyor. | `packages/design-engine/src/theme-publish-validation.ts`, `lib/actions/theme.ts:331`. Yalnızca başlıkta hata olan belgeyle davranış testi: diğer yedi grup boşken üç başlık ihlali yakalandı; sanitize işlemi ihlalleri gizlemedi. |
| F4 · P2 · Mobilde kayıt durumu/kontekst kayboluyor | Restoran adı, Kaydedilmedi/Yayın bekliyor/Yayında durumu, değişiklik sayısı ve yayın engeli tüm genişliklerde ayrı durum alanında görünüyor. İncele, ilgili ayar grubunu açıyor. Uzun uyarı 320 px’de satıra sarılıyor. | `ThemeEditorNotices.tsx`, `ThemeEditorShell.tsx`, `use-theme-publish-guidance.ts`. 320, 390, 768 ve 1440 CSS px kontrolleri yapıldı. 320 px’de uyarı düğmesinin sağ sınırı 308 px; sayfa yatay taşmıyor. |
| F5 · P2 · Mevcut kilitli bölüm normal görünüyor | Menü akışında **Paket nedeniyle gösterilmiyor**, özellik panelinde ayarların korunduğunu ve bölümün QR menü/önizlemede gösterilmediğini açıklayan metin var. Katalogdaki **Etkin**, **Temaya ekli** oldu. Video Hero ve gelişmiş bölümler kendi haklarıyla değerlendirilir. | `theme-section-access-model.ts`, `ThemeEditorSidebar.tsx`, `ThemeEditorPropertiesWorkspace.tsx`, `ThemeEditorDialogs.tsx`. Starter MAF restoranındaki İstek Butonları üzerinde doğrulandı. |
| F6 · P2 · Başarısız menü okuması boş katalog oluyor | Yetki bağlamı veya menü referansları yüklenemezse editör açılmıyor; temaya özel tekrar deneme ekranı gösteriliyor. Başarılı ama boş katalog geçerli kalıyor. | `lib/queries/theme-editor.ts`, `lib/theme-menu-references.ts`, `app/dashboard/[restaurantId]/theme/error.tsx`. Başarısız okuma/gerçek boş katalog ayrımı davranış testinde doğrulandı. |

Kurtarma sonrasında taslak ve yayın revizyonları güncel sunucu görüntüsünden alınır. Sonraki kayıtta araya başka bir değişiklik girerse mevcut atomik revizyon kontrolü yeniden çakışma döndürür. Birleştirme, farklı alanlardaki değişiklikleri birlikte tutar; bölüm dizilerinin eşzamanlı sıralama/silme değişikliklerini otomatik iç içe geçirmez. Aynı sekmede yinelenen kaydet/yayınla çağrılarına karşı istek kilidi eklendi.

Yerel yedek tarayıcının `sessionStorage` alanındadır, 24 saatlik geçerlilik sınırı vardır; sunucu kaydı veya sekmeler arası kalıcı yedek değildir. Depolama başarısız olursa kalıcı uyarı ve indirme seçeneği görünür. Bu davranışla uyumlu olarak gezinme/çıkış düğmeleri “Kaydetmeden çık” ve “Kaydetmeden çıkış yap” şeklinde güncellendi.

## Doğrulama sonuçları

| Kontrol | Sonuç | Kanıt |
|---|---|---|
| Dashboard tema + layout + overlay testleri | **309 geçti** | [Test çıktısı](evidence/theme-fixes/dashboard-tests.log) |
| Design engine testleri | **74 geçti** | [Test çıktısı](evidence/theme-fixes/design-engine-tests.log) |
| Application tema testleri | **16 geçti** | [Test çıktısı](evidence/theme-fixes/application-tests.log) |
| Dashboard typecheck | Geçti; son production build tip kontrolü de geçti | [Tip kontrolü](evidence/theme-fixes/typecheck.log), [build](evidence/theme-fixes/build.log) |
| Değişen tema ve ilgili shell dosyalarında ESLint | **0 hata, 0 uyarı** | Son komut exit code 0; temiz çıktıda log içeriği yok |
| Dashboard production build · Next.js 15.5.25 | Geçti | [Build çıktısı](evidence/theme-fixes/build.log) |
| `git diff --check` | Geçti | Boş hata çıktısı |

Toplam **399 test/kontrol** geçti. Bunların tamamı tarayıcı davranış testi değildir: mevcut kaynak metni/mimari sözleşme testleri de toplamın içindedir. Bu çalışmada eklenen 11 davranış testi; kontrast, yedek kapsamı/süre/bozuk veri, üç yönlü birleştirme, dizi çakışması, menü okuma sonucu ve paket haklarını kapsar.

Build tablosundaki tema editörü rota kabuğu 2.02 kB, First Load JS 120 kB. İstemcide sonradan yüklenen editör parçaları bulunduğundan bu değer editörün toplam JavaScript yükü veya Lighthouse sonucu olarak yorumlanmamalıdır.

## Tarayıcı kanıtları

Yerel production sunucuları: dashboard `localhost:3005`, QR menü `localhost:3011`. Test restoranı: MAF Cafe Lounge, Starter. CSS viewport boyutları DOM’dan okundu; ekran yakalama aracının ölçek farkı nedeniyle görseller görünen uygulama alanına kırpıldı.

- [1440 px · durum alanı ve taslak/yayın ayrımı](evidence/theme-fixes/desktop-1440.jpg)
- [1440 px · paket nedeniyle gösterilmeyen mevcut bölüm](evidence/theme-fixes/locked-section-1440.jpg)
- [320 px · geri yüklenmiş renk, kaydedilmedi durumu ve satıra sarılan yayın uyarısı](evidence/theme-fixes/mobile-320-unsaved.jpg)
- [390 px · yerel yedek kurtarma ve güncel taslak karşılaştırması](evidence/theme-fixes/recovery-390.jpg)
- [768 px · kayıt durumu ve tema ayarları](evidence/theme-fixes/tablet-768.jpg)

Gerçek kurtarma denemesi: Sayfa rengi `#f8f9f8` → `#fff0e0`; kaydetmeden editörden çıkış; geri dönüşte yedeğin bulunması; kurtarma beklerken gerçek sayfa yenilemesi; yetkili sunucu okumasıyla karşılaştırma; geri yükle sonrası renk alanında `#fff0e0` doğrulaması. Ardından test yedeği “Yerel çalışmayı bırak, günceli aç” ile temizlendi. Son yenilemede yedek uyarısı yok ve kayıt durumu başlangıçtaki **Yayın bekliyor · 22:29**. Test sırasında taslak kaydı veya yayınlama yapılmadı.

## Doğrulama sınırları

- İki gerçek çalışan oturumunda eşzamanlı veritabanı yazımı/yayınlama yapılmadı. Çakışan alan kararları ve birleştirme davranışı saf model testleriyle; mevcut tema kayıt/yayın sözleşmeleri application testleriyle kontrol edildi.
- Canlı menü referansı isteğine hata enjekte edilmedi. F6 için hata/boş sonuç ayrımı test edildi ve error boundary production build’den geçti; gerçek upstream kesintisi ayrıca kontrollü test ortamında denenmeli.
- Depolama kotasının dolması ve tarayıcı depolamasının kapalı olması canlı tarayıcıda zorlanmadı. Yedek parse/son kullanma testleri geçti; depolama istisnaları açık kullanıcı uyarısına çevriliyor.
- Doğrudan kaydedilmemiş editör yenilemesi otomasyon tarafından iptal edildi. Yenileme kalıcılığı, uygulama içi çıkış–geri dönüşten sonra kurtarma paneli açıkken gerçek reload ile doğrulandı.
- Bu düzeltme turunda %200 yakınlaştırma, ekran okuyucu, tüm ağ kesintileri veya yeni Lighthouse performans ölçümü yapılmadı. Bunlar tamamlanmış kabul edilmez.

Next.js hata sınırı yaklaşımı [resmî Next.js 15 dokümanı](https://nextjs.org/docs/15/app/getting-started/error-handling) ile; uyarı/düğme kullanımları mevcut shadcn Base UI bileşenleriyle uyumludur. Mevcut müşteri tasarımı ve önceden kaydedilmiş kontrast sorunu otomatik değiştirilmedi; yayın engeli arayüzde açıkça gösteriliyor.
