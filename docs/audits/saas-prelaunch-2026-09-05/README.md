# Masabu — Lansman Öncesi SaaS Audit

**Tarih:** 5 Eylül 2026 · **Hedef okuyucu:** ürün sahibi ve geliştirme ekibi

**Kapsam:** mevcut çalışma ağacı; pano, menü yönetimi, tema editörü, ortak bileşenler ve tüm SaaS için risk odaklı teknik inceleme. Ürün kodu, API ve veritabanı şeması değiştirilmedi.

## Sonuç

**Masabu’nun mevcut teknoloji temeli korunmalı. Lansman öncesi en yüksek getiriyi, günlük operasyon akışlarını sağlamlaştırmak ve var olan kalite kontrollerini doğru kapsamda çalıştırmak sağlayacak.** Next/React/Supabase’i değiştirmek için bu incelemede bir gerekçe çıkmadı.

Kod incelemesi ve yerel doğrulamalarda **9 P1, 3 P2 bulgu** belirlendi. P0 seviyesinde doğrulanmış bir açık bulunmadı; bu sonuç lansman onayı veya eksiksiz güvenlik değerlendirmesi değildir. Özellikle mobil ürün oluşturma, mutfağın bağlantı durumu ve başarısız isteklerden toparlanma lansman öncesi düzeltilmeli.

**Görsel audit tamamlanamadı:** kullanıcı Browser kontrolüne izin verdi; ancak uygulama içi tarayıcı seçimi `Browser is not available: iab`, tarayıcı keşfi ise boş liste döndürdü. Yeni ekran görüntüsü alınmadı, test restoranında oturum açılmadı. Görsel hiyerarşi, gerçek cihaz davranışı, klavye ve ekran okuyucu sonuçları doğrulanmış sayılmıyor. Aşağıdaki UI davranış bulguları koddan ve açıkça belirtilen izole fonksiyon doğrulamalarından geliyor.

## Doğrulama özeti

| Kontrol | Bu çalışmadaki sonuç | Kanıt / sınır |
|---|---|---|
| `pnpm check:ci` | Başarılı; 23 test grubunda 2.234 test, 0 hata | [Kontrol günlüğü](evidence/check-ci.log); deadcode, lint, typecheck, mimari/domain/application/DB ve release araçlarının testleri dahil |
| `pnpm build` | Beş uygulama başarılı | [Build günlüğü](evidence/build.log); yerel production build, dağıtım provası değildir |
| `design-engine` testleri | Ek olarak 72/72 başarılı | [Test günlüğü](evidence/design-engine-tests.log); ana kalite zincirinde yok |
| UI içindeki `src/themes/**/*.test.ts` | Ek olarak 25/25 başarılı | [Test günlüğü](evidence/ui-theme-tests.log); paketin normal test komutunda yok |
| Dashboard bundle bütçesi | Mevcut 9 rota geçti | [Ölçüm](evidence/dashboard-bundle.json); hemen yüklenen dinamik bileşenler için F07’ye bakın |
| Davranışın izole yeniden üretimi | Mobil geçiş, iki istek hatası, fiyat yarış durumu, sayı biçimi doğrulandı | [Sonuçlar](evidence/source-probes.json), [yeniden çalıştırılabilir araç](evidence/source-probes.mjs); gerçek kaynak fonksiyonları, sahte state/action bağımlılıkları; React render/E2E değildir |
| Yerel sunucular | Dashboard 127.0.0.1:3005, menü 127.0.0.1:3011 başlatıldı | Sunucu hazır logları mevcut; sayfa veya oturum doğrulaması değildir |
| Tarayıcı, screenshot, Lighthouse, gerçek kullanıcı performansı | **Çalıştırılamadı / ölçülmedi** | Browser bağlantısı yok; LCP/INP/CLS sonucu veya görsel kalite puanı verilmedi |

Toplam **2.331 proje testi** başarılı. Bu sayı test kapsamı yüzdesi değildir; kaynak metni kontrol eden testler de sayıya dahildir. Dosya envanterinde 506 `.test.ts/.test.tsx` dosyasının 241’i `readFileSync` içeriyor; bu oran kod kapsamı veya test kalitesi puanı olarak yorumlanmamalı.

Kurulu ve gerçekten çözümlenen sürümler: **Node 24.18.0, Next 15.5.21, React 19.2.6, Base UI 1.7.0, sharp 0.35.4, libheif 1.23.2**. Paket yöneticisi pnpm 9.15.4. [Runtime sürümleri](evidence/runtime-versions.json)

## Öncelikli bulgular

Öncelik: **P0** lansmanı engelleyen kritik kusur; **P1** lansman öncesi çözülmesi önerilen sorun; **P2** sonraki iyileştirme. Eforlar bir geliştirici için yaklaşık çalışma süresidir; entegrasyon ve tarayıcı erişimi bekleme süresini içermez.

### F01 · P1 — Mobilde yeni ürünün editörü açılamayan duruma geçiyor

**Kanıt:** [use-menu-manager-shell-state.ts:153](../../../apps/dashboard/components/menu/use-menu-manager-shell-state.ts#L153), aynı dosyada `selectItem` ve `requestAddItem`; [globals.css:1288](../../../apps/dashboard/app/globals.css#L1288). `requestAddItem` görünümü `items` yapıyor. Oluşturma başarılı olunca `createItem`, ürünü seçiyor ve drawer’ı kapatıyor; `workspaceStage` değerini `editor` yapmıyor. Aynı ürüne tekrar basıldığında `selectItem`, seçili kimlik aynı olduğu için erken dönüyor. Mobil CSS editörü yalnız `editor` aşamasında gösteriyor. İzole doğrulama bu state zincirini yeniden üretti.

**Etki:** İlk ürününü oluşturan işletmeci görsel, varyasyon ve diğer ayrıntılara geçemeyebilir; başka ürüne veya kategoriye geçerek durumdan çıkması gerekir. Yeni ürün akışının sonraki adımı kırılıyor.

**Çözüm:** Oluşturma sonrası seçim ve editör aşamasını birlikte güncelle; aynı ürün seçili olsa bile görünüm editör değilse açılmasını sağla. **Efor:** 0,5 gün. **Kabul:** 320/390 px’te ilk ürünü oluştur → editör görünür → görsel/varyasyon alanlarına erişilir → geri dönüş ürün listesine gider; aynı ürüne tekrar basmak çalışır. Görsel teyit açık.

### F02 · P1 — Mutfakta yenileme hatası operatöre görünmüyor

**Kanıt:** [KitchenBoard.tsx:74](../../../apps/kitchen/components/KitchenBoard.tsx#L74). İki saniyelik yenileme döngüsü `batch` yanıtını uygular, yalnız oturum süresi hatasına tepki verir. `Orders unavailable` gibi diğer hatalar ekrana taşınmaz. Başlıktaki yeşil işaret ve animasyonu bağlantı sonucundan bağımsızdır. `finally` mevcut fakat taşıma katmanı rejection’ı için `catch` yok.

**Etki:** Sipariş verisi eski kalırken personel bunu fark etmeyebilir. Restoran operasyonunda bu, geciken veya kaçan siparişlere yol açabilecek bir bilgi eksikliğidir; bu çalışmada gerçek sipariş kaybı gözlenmedi.

**Çözüm:** Son başarılı senkron zamanı, canlı/gecikmiş/çevrimdışı durumları, görünür hata ve yeniden deneme ekle; son veriyi koru. Pano’nun mevcut uzlaştırma yaklaşımını örnek al. Gizli sekmede sorgulamayı durdur veya azalt. **Efor:** 1–2 gün. **Kabul:** Başarısız yenileme sağlıklı gösterge bırakmamalı; bağlantı geri geldiğinde tek tam snapshot ile toparlanmalı; üst üste istek oluşmamalı.

İki saniyelik döngü teorik olarak sekme başına dakikada 30 action çağrısı demek. Bu, ölçülmüş DB maliyeti değildir; çok sayıda açık mutfak sekmesi için kapasite girdisidir.

### F03 · P1 — Bildirim ve CSV akışları reddedilen istekte takılı kalıyor

**Kanıt:** [NotificationsPanel.tsx:169](../../../apps/dashboard/components/overlays/NotificationsPanel.tsx#L169), [use-menu-csv-import.ts:215](../../../apps/dashboard/components/menu/use-menu-csv-import.ts#L215). Bildirim yüklemesindeki `Promise.all` ve CSV aktarımındaki action beklemesi `try/catch/finally` ile çevrili değil. Dönen `{error}` işleniyor, Promise rejection işlenmiyor. İzole kaynak çalıştırmasında `loading=true` ve `importing=true` kaldı. [CSV dialog’u](../../../apps/dashboard/components/menu/MenuCsvImportOverlays.tsx#L300) aktarım sırasında onay/iptal düğmelerini kapatıyor.

**Etki:** Wi-Fi kesintisi veya action taşıma hatası kullanıcıya toparlanabilir bir durum sunmuyor. Bildirim geçmişinin rejection’ı canlı bildirim yüklemesini de kesebilir. `markInboxRead` sonucu da dikkate alınmadan iyimser okunmuş durumu gösteriliyor.

**Çözüm:** Beklenen iş hataları ile taşıma hatalarını ele al; yükleme bayraklarını her çıkışta sıfırla, CSV önizlemesini koru. Canlı feed ve geçmişi bağımsız sonuçlandır; okunmuş güncellemesinde hata durumunda yeniden uzlaştır. **Efor:** 1 gün. **Kabul:** Her action için normal başarı, `{error}`, rejection; tekrar deneme; geçmiş bozulurken canlı feed’in kullanılabilmesi.

### F04 · P1 — Art arda başarısız fiyat değişiklikleri kaydedilmeyen değeri bırakabiliyor

**Kanıt:** [use-menu-manager-commands.ts:76](../../../apps/dashboard/components/menu/use-menu-manager-commands.ts#L76), [MenuItemsWorkspace.tsx:327](../../../apps/dashboard/components/menu/MenuItemsWorkspace.tsx#L327). Hızlı güncelleme mevcut satırı rollback tabanı olarak saklıyor; hata halinde tüm satırı geri yazıyor. Ürün başına pending kilidi veya sunucuca doğrulanmış rollback tabanı yok. İlk istek beklerken kullanıcı 10 → 20 → 30 değişikliği yaparsa ikinci komut ilk iyimser değer olan 20’yi saklayabiliyor. Yanıtlar normal sırayla hata verdiğinde ilk rollback 10, ikinci rollback 20 oluyor. İzole doğrulamada hiçbir işlem başarılı olmadığı halde UI 20’de kaldı.

**Etki:** Ekran, hiç kaydedilmemiş fiyatı gösterebilir. Toplu güncellemede tüm koleksiyonun snapshot’a dönmesi benzer bir risk oluşturuyor. [Next 15 dokümantasyonu](https://nextjs.org/docs/15/app/getting-started/updating-data), istemci Server Action’larının sırayla işlendiğini belirtiyor; son doğrulama bu sırayı koruyor. İlk araştırmadaki ters yanıt sırası örneği üretim davranışı kanıtı olarak kullanılmadı. Gerçek React render ve ağda bu senaryo henüz doğrulanmadı.

**Çözüm:** Ürün başına pending kilidi veya sunucuca doğrulanmış taban üzerine komut sırası; alan bazlı rollback ve sunucuyla uzlaştırma. **Efor:** 1–2 gün. **Kabul:** İki hızlı değişiklikte başarı/başarı, hata/hata, başarı/hata ve hata/başarı; farklı alanlar ve toplu işlem çakışması. Hiç başarılı kayıt yoksa doğrulanmış başlangıç fiyatı korunmalı.

### F05 · P1 — Var olan 97 tema testi normal kalite zincirinde çalışmıyor

**Kanıt:** [kök package.json:22](../../../package.json#L22), [design-engine package.json:18](../../../packages/design-engine/package.json#L18), [UI package.json:37](../../../packages/ui/package.json#L37). `test:architecture`, design-engine paketinin test komutunu çağırmıyor. UI komutu `src/themes/**` altını kapsamıyor. Bunlar arasında preview protokolü, bölüm davranışı ve kampanya fiyatı testleri var. Bu audit’te ayrıca çalıştırılan 72 + 25 test başarılı.

**Etki:** Tema veya kampanya değişikliği bu testleri bozsa bile olağan `check:ci` yeşil kalabilir. Sorun test yokluğu değil, mevcut testlerin gate’e bağlı olmaması.

**Çözüm:** İki grubun test keşfini paket komutlarına ve ana CI zincirine bağla. **Efor:** 0,5 gün. **Kabul:** CI çıktısı bu grupları içermeli; geçici kasıtlı bozuk beklentiyle PR gate’in kırıldığı doğrulanmalı.

### F06 · P1 — Pano/menü/tema tarayıcı matrisi PR kontrolüne bağlı değil

**Kanıt:** [playwright.visual.config.ts:52](../../../playwright.visual.config.ts#L52) ve [dashboard-authenticated.spec.ts:59](../../../tests/visual/dashboard-authenticated.spec.ts#L59) mevcut senaryoları tanımlıyor. [Settings workflow](../../../.github/workflows/settings-visual.yml#L55) yalnız settings matrisini çalıştırıyor. Workflow envanterinde `visual:auth` veya `visual:smoke` çağrısı yok. Public cross-browser kontrolü tam işletmeci akışını kapsamıyor. Açık IDE dosyasındaki [bildirim testi](../../../apps/dashboard/components/overlays/notifications-panel-mobile-contract.test.ts#L5), CSS ve ARIA kaynak kalıplarını eşliyor.

**Etki:** 320 px taşma, odak kaybı veya F01 gibi aşama hataları kaynak kontrolleri başarılıyken kaçabilir. Kaynak sınırı testleri mimari için faydalı; kullanıcı davranışını ayrıca doğrulamak gerekiyor. [Playwright rehberi](https://playwright.dev/docs/best-practices) de görünür davranışı temel alıyor.

**Çözüm:** Mevcut authenticated matrisi PR’a bağla; bildirim ve ürün oluşturma senaryolarını davranış düzeyinde ekle. **Efor:** 1–2 gün. **Kabul:** 320/390/768/1440 px, Tab/Shift+Tab/Escape, odak dönüşü, taşma, yükleme/hata durumları ve yakınlaştırma kontrol edilmeli. CSS `zoom` senaryosunu gerçek tarayıcı yakınlaştırmasının tüm davranışlarıyla eşdeğer sayma.

### F07 · P1 — Bundle bütçesi açılışta gereken dinamik UI yükünü eksik ölçüyor

**Kanıt:** [tables-bundle-budget.mjs:79](../../../scripts/tables-bundle-budget.mjs#L79) yalnız `app-build-manifest` rota dosyalarını topluyor. [ThemeEditorClientLoader.tsx:7](../../../apps/dashboard/components/theme/ThemeEditorClientLoader.tsx#L7) ve [OrderBoardBoundary.tsx:10](../../../apps/dashboard/components/orders/OrderBoardBoundary.tsx#L10), dinamik bileşenleri sayfa açılışında hemen render ediyor. Bu build’de rota + ilgili dynamic manifest birleşimi, dosyalar tekilleştirilerek ölçüldü:

| Ekran | Mevcut rota manifesti | Açılışta mount edilen dinamik bileşen grubu | Benzersiz JS birleşimi |
|---|---:|---:|---:|
| Tema editörü | 119,9 kB | 360,5 kB | **480,4 kB gzip** |
| Siparişler | 129,3 kB | 171,2 kB | **300,4 kB gzip** |

[Ölçüm ve dosya listeleri](evidence/dynamic-bundles.json). Bunlar gzip-9 build dosyalarıdır; gerçek transfer, browser cache, iframe, CSS ve daha sonra açılan iç dinamik modüller dahil değildir. Siparişlerde mevcut rota bütçesinin geçmesi, çalışır ekranın aynı bütçede olduğu anlamına gelmiyor.

Ek kapsam açığı: [dashboard bütçelerinde](../../../scripts/dashboard-bundle-budget.mjs#L18) tema editörü yok; [.lighthouserc.json:6](../../../.lighthouserc.json#L6) yalnız desktop preset kullanıyor. Gerçek dashboard bundle gate’i PR öncesi değil, tables runtime workflow’unda çalışıyor.

**Çözüm:** Rota manifesti ile kullanılabilir ilk ekranın JS yükünü ayrı adlandır ve ölç. Tema editörünün yüzey/property gruplarını kullanım anında yüklemek için profil çıkar; preview iframe’ini ayrıca ölç. Mobil QR menü cold/warm koşularını ekle. `ssr:false` tek başına toplam işi azaltan bir optimizasyon olarak değerlendirilmemeli. [Next 15 lazy loading](https://nextjs.org/docs/15/app/guides/lazy-loading)

**Efor:** Ölçüm/gate 1–2 gün; profil sonrası daraltma 2–4 gün. **Kabul:** Rota, ilk çalışır ekran ve etkileşim modülleri ayrı raporlanmalı; mobil Lighthouse koşusu eklenmeli; production üzerinde LCP/INP/CLS ve gerçek kullanıcı p75 değerleri, lab sonuçlarından ayrı izlenmeli. [Web Vitals tanımları](https://web.dev/articles/vitals)

### F08 · P1 — Yardımcı metin tokenı normal metin için düşük kontrastlı

**Kanıt:** [globals.css:19](../../../apps/dashboard/app/globals.css#L19) `--text-3: #8b8d94` tanımlıyor. [Tema sidebar açıklamaları](../../../apps/dashboard/components/theme/ThemeEditorSidebar.tsx#L352) 11,5 px, [pano grafik etiketleri](../../../apps/dashboard/components/pano/PanoSalesChart.tsx#L212) 10 px olarak bu rengi kullanıyor. Deklare renklerle hesaplanan oranlar: beyazda **3,31:1**, `--bg` üzerinde **3,07:1**, sıcak tema yüzeyinde **3,18:1**. [Hesap](evidence/token-contrast.json)

**Etki:** Küçük yardımcı açıklamalar ve eksen etiketleri düşük görme koşullarında zor okunabilir. WCAG normal metinde 4,5:1, büyük metinde 3:1 eşiği tanımlar. Disabled/dekoratif öğeleri bu bulguya dahil etmiyorum. [W3C kontrast açıklaması](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)

**Çözüm:** Okunması gereken yardımcı metin için erişilebilir semantic token kullan; `--text-2` beyazda 6,58:1 veren mevcut aday. Tüm yüzey çiftlerini birlikte kontrol et. **Efor:** 0,5–1 gün. **Kabul:** Gerçek computed-style çiftleri ve desteklenen temalarda normal metin ≥4,5:1; görsel hiyerarşi kontrolü. Mevcut sonuç matematiksel token incelemesidir, tam ekran erişilebilirlik denetimi değildir.

### F09 · P1 — İstek boyutu sınırları bellek tahsisinden sonra uygulanıyor

**Kanıt:** [orders/route.ts:22](../../../apps/menu/app/api/orders/route.ts#L22), [order-request.ts:67](../../../apps/menu/app/api/orders/order-request.ts#L67), [webhook/route.ts:50](../../../apps/dashboard/app/api/billing/iyzico/webhook/route.ts#L50). Sipariş gövdesi `text()`, webhook gövdesi `arrayBuffer()` ile tamamen okunuyor; gerçek 128 KiB / 64 KiB sınırı bundan sonra uygulanıyor. `Content-Length` bulunmayan gövdeler ön kontrolden geçebiliyor.

**Etki:** Sonunda 413 dönmesi, belirtilen bellek bütçesinin korunduğu anlamına gelmiyor. Paralel büyük gövdeler kaynak tüketimi yaratabilir. Canlı DoS denenmedi; hosting/proxy sınırlarının üretimdeki etkisi doğrulanmadı. [OWASP kaynak tüketimi rehberi](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/)

**Çözüm:** Mevcut [payment-callback-request.ts:28](../../../apps/menu/lib/payment-callback-request.ts#L28) yaklaşımındaki gibi byte bazlı sınırlı stream okuma ve aşımda iptal; webhook imzası için ham byte’ları koru. **Efor:** 0,5–1,5 gün. **Kabul:** Başlıksız/chunked, sınır, sınır+1, çok byte’lı UTF-8, okuma hatası; aşımda stream iptal edilmeli ve DB/verifier çalışmamalı.

### F10 · P2 — Ortak bileşenlerde paralel altyapılar bakım yükünü artırıyor

**Kanıt:** [Base UI dialog](../../../apps/dashboard/components/ui/dialog.tsx#L4), [özel modal focus hook’u](../../../apps/dashboard/components/overlays/use-modal-dialog-focus.ts#L42), [NewProductDrawer’ın ayrı focus döngüsü](../../../apps/dashboard/components/menu/NewProductDrawer.tsx#L139), [lib/ui.tsx](../../../apps/dashboard/lib/ui.tsx#L36). Aynı projede Base UI, özel modal yöneticileri ve inline button/tag yardımcıları birlikte var. NewProductDrawer başlangıç dialog’unda arka plan inert davranışını ortak focus hook’u gibi kurmuyor; yalnız discard dialog’u için inert değiştiriyor. Bunun assistive-technology etkisi tarayıcıda doğrulanmalı.

**Etki:** Focus, katmanlama, dokunma alanı ve hata geri bildirimi düzeltmeleri birden çok yerde yapılmak zorunda. Bu, tek başına her özel bileşenin bozuk olduğu anlamına gelmiyor.

**Çözüm:** Dashboard’daki dialog/sheet davranışını mevcut Base UI wrapper’ları üzerinden kademeli ortaklaştır; ürün stillerini ve mevcut etkileşimleri koru. Müşteri QR temasına dashboard görünümünü zorla taşıma. [Base UI erişilebilirlik](https://base-ui.com/react/overview/accessibility), [WAI modal modeli](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)

**Efor:** İlk overlay ailesi 2–3 gün. **Kabul:** Nested dialog, portal içindeki combobox, Escape, başlangıç/geri dönüş odağı, arka planın etkileşimsizliği ve mobil scroll aynı sözleşmeyi sağlamalı.

### F11 · P2 — Next güvenlik patch’i geride; native override önemli bir karşı kanıt

**Kanıt:** Kurulu Next 15.5.21. 25 Ağustos 2026 tarihli [resmî Next advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4), AVIF optimizer sorunu için 15.5.24 yamasını bildiriyor. Ancak kök [libheif advisory](https://github.com/strukturag/libheif/security/advisories/GHSA-g89c-p67h-r497), etkilenen aralığı 1.22.0–1.23.1 olarak veriyor; yerelde Next’in kullandığı sharp yolundan gerçekten yüklenen **libheif 1.23.2**. Kök sharp override’ı etkili.

**Yorum:** Bu çalışma projede çalışır RCE doğrulamıyor. Yalnız Next sürüm numarasından P0 çıkarmak yanıltıcı olur. Dağıtılmış artifact’in native sürümü ayrıca doğrulanmalı; yerelde güvenli çözümleme üretim için kanıt değildir.

**Çözüm:** Ayrı küçük bir çalışmayla Next 15 hattında güvenlik patch’ini güncelle; danışılan advisory’nin minimumu 15.5.24. Uygulama gününde aynı hattın güncel güvenlik patch’ini yeniden doğrula. **Efor:** 0,5 gün + CI. **Kabul:** Production artifact’te güvenli native sürüm; auth ve görsel işleme smoke kontrolleri. Next 16 major geçişi bu işin gereği değil.

### F12 · P2 — Türkçe fiyat girişi CSV ve formda tutarsız

**Kanıt:** [CSV parser](../../../apps/dashboard/components/menu/use-menu-csv-import.ts#L161) `Number(row['Fiyat'])` kullanıyor; [domain parser](../../../packages/domain/src/menu.ts#L68) virgüllü ondalığı destekliyor. `120,50`, form parser’ında 120.5 olurken CSV dönüşümünde `NaN` oluyor. Bu, CSV hücresinin parser’a doğru ulaşması halinde geçerli; delimiter sorunu ayrı konudur.

**Etki:** Türkçe Excel’den gelen fiyatlar gereksiz düzeltme gerektirebilir. CSV ilerleme değeri de tek toplu isteğin başında 0, sonunda tamamı olarak güncelleniyor; aradaki satır ilerlemesi ölçülmüyor.

**Çözüm:** Aynı domain sayı parser’ını CSV’de de kullan; örnek dosyada desteklenen biçimi açıkla. Tek toplu istek devam ediyorsa belirli satır ilerlemesi yerine belirsiz ilerleme durumu göster. **Efor:** 0,5 gün. **Kabul:** `120,50`, `120.50`, boş, negatif, sonsuz ve bozuk değerler form/CSV’de tutarlı sonuç üretmeli.

## Korunması gereken güçlü yönler

- **Yetki modeli:** [access.ts](../../../apps/dashboard/lib/auth/access.ts#L50) tenant/aktif üyelik ile bölüm yetkisini açıkça kontrol ediyor; command sınırında plan hakkı ayrıca çözülüyor. Bu ayrımı koru. Tüm route/RLS envanteri ve gerçek negatif tenant testleri henüz tamamlanmadı.
- **Platform yönetimi:** [platform-admin-auth.ts](../../../apps/platform-admin/lib/platform-admin-auth.ts#L7) sunucuda doğrulanmış kullanıcı ve AAL bilgisiyle aktör çözüyor. Süreli/gerekçeli destek oturumları ayrı tasarlanmış. [Supabase MFA rehberi](https://supabase.com/docs/guides/auth/auth-mfa), enforcement’ın UI yanında sunucuda da yapılmasını destekliyor.
- **Pano:** [use-pano-live-state.ts](../../../apps/dashboard/components/pano/use-pano-live-state.ts#L1) tenant invalidation, tek uçuşlu yenileme, uzlaştırma ve son başarılı veriyi koruma içeriyor. KPI’larda tahsil edilen ciro ile açık hesap ayrılmış. Bu operasyon odaklı yaklaşım mutfağa taşınmalı.
- **Tema:** [lifecycle](../../../apps/dashboard/components/theme/use-theme-editor-lifecycle.ts#L100) taslak/yayın revision’ları, conflict geri bildirimi, undo/redo ve çıkış koruması içeriyor. [Preview bridge](../../../apps/dashboard/components/theme/use-theme-preview-bridge.ts#L139) `origin`, pencere kaynağı ve request kimliğini kontrol ediyor; önizleme production renderer’larına dayanıyor.
- **Menü/QR:** Menü düzenleme verisi kirliyken realtime değişiklikler draft’ı doğrudan ezmiyor. Public veri cache’i tenant/revision kapsamında; fiyatlar public sipariş isteğindeki toplamdan alınmıyor. Görsel yükleme ve ödeme callback’lerinde yeniden kullanılabilecek sınırlar mevcut.
- **Onboarding:** [OnboardingFlow](../../../apps/dashboard/components/onboarding/OnboardingFlow.tsx#L42) işletme → isteğe bağlı marka → ilk ürünler sırasını izliyor; kalıcı snapshot ve sabit request kimlikleri kullanıyor. Öncelik bu ilk değer yolunun mobilde kesintisiz işlemesi olmalı.

## Techstack ve codebase kararı

| Alan | Karar | Masabu için öneri |
|---|---|---|
| Next 15 + React 19 | **Koru, patch bakımını yap** | Beş uygulama başarıyla build alıyor. RSC ve `next/dynamic` sınırlarını gerçek kullanılabilir ekran bütçesiyle doğrula. [Next 15 production rehberi](https://nextjs.org/docs/15/app/guides/production-checklist) |
| Supabase/Postgres | **Koru** | Domain/application ile altyapı adaptörlerinin ayrımı değerli. Tenant/RLS, idempotency ve worker davranışlarını gerçek test ortamında doğrula; yeni backend katmanı eklemek öncelik değil. [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) |
| pnpm workspace + domain/application paketleri | **Koru** | Paket sınırları zaten var. İlk yatırım test keşfi ve CI bağlantısı; monorepo aracı değişimi ölçülmüş darboğaz olmadan gerekçesiz. |
| shadcn/Base UI + ortak stiller | **Sadeleştir** | Dashboard primitive davranışı tek aileye yaklaşmalı; semantik tokenlar üzerinden tutarlılık sağlanmalı. QR menünün tema motoru ayrı ürün ihtiyacını karşılıyor. |
| Büyük client modülleri | **Sorumluluk ve yükleme anına göre böl** | ProductModal 1.684, MenuPageClient 1.616, OrderBoard 1.605, CustomersClient 1.539, ThemeExperiencePanels 1.473 satır. Satır sayısı tek başına kusur değil; çoklu state/komut ve eager import sınırları bakım/perf incelemesinin hedefi. |
| Test araçları | **Koru ve davranış kapsamını artır** | Yeni test framework’ünden önce mevcut 97 testi ve authenticated matrisi bağla. Kaynak regex testlerini mimari sınırlar için tut; kullanıcı state geçişlerini davranışla doğrula. |
| Gözlemlenebilirlik | **Mevcut hattı tamamla** | Dashboard/menu/marketing Web Vitals reporter’ları zaten var; “ölçüm yok” demek yanlış. Endpoint’ler structured log üretiyor. Production log toplama, retention, p75 panosu ve alarm teslimi bu incelemede doğrulanmadı; yeni servis seçmeden bunları kanıtla. |

UI/UX’i geliştirmede ilk hedef; yeni restoranın **kayıt → ilk ürün → çalışan QR menü**, müşterinin **ürün → sepet → sipariş**, personelin **yeni sipariş → hazırlık → hazır** zincirlerinin açık ve toparlanabilir olması. İlk menüye kadar geçen süre, bu adımlardaki terk oranı, siparişin mutfağa görünme gecikmesi ve hata sonrası başarılı tekrar oranı ürün başarı göstergeleri olarak kullanılabilir. Bunlar önerilen ölçütlerdir; mevcut kullanıcı ölçümü yapılmadı.

## İlk yapılacak 10 iş

| Sıra | İş | Bulgu / bağımlılık | Tamamlanma ölçütü |
|---|---|---|---|
| 1 | Mobil yeni ürün geçişini düzelt | F01 | Oluşturulan ürünün editörü aynı akışta açılır |
| 2 | Mutfakta hata/çevrimdışı/son senkron durumunu göster | F02 | Eski veri sağlıklı gösterilmez; yeniden bağlanma doğrulanır |
| 3 | Bildirim ve CSV’nin rejection kurtarmasını tamamla | F03 | Takılı yükleme kalmaz, kullanıcı tekrar deneyebilir |
| 4 | Hızlı/toplu menü komutlarını yarışa dayanıklı yap | F04 | İyimser fakat kaydedilmemiş değer rollback tabanı olmaz |
| 5 | Sipariş/webhook bounded reader’ını ortaklaştır | F09 | Başlıksız büyük stream sınırda iptal edilir |
| 6 | Atlanan 97 tema testini ana CI’a bağla | F05 | Kasıtlı bozulma PR kontrolünü kırar |
| 7 | Pano/menü/tema authenticated browser gate’ini bağla | F06; test restoranı ve browser erişimi | 1–4 numaralı düzeltmeler gerçek kullanıcı akışında doğrulanır |
| 8 | İlk çalışır ekran ve mobil performans bütçesini kur | F07; production build + browser | Dynamic/iframe yükü ayrı raporlanır; cold/warm mobil ölçüm alınır |
| 9 | Metin kontrastını düzelt, overlay ailesini ortaklaştırmaya başla | F08 + F10; 7 ile regresyon koruması | Kontrast çiftleri ve focus/scroll davranışı geçer |
| 10 | Next 15 patch ve deployment native sürüm doğrulaması | F11; CI/build ve yayın kanıtları | Güvenli native runtime ve başarılı smoke çıktısı |

F12, menü akışı iyileştirmeleriyle aynı küçük değişiklik grubuna alınabilir. Büyük client modüllerinin ayrıştırılması, 8. işteki ölçümden sonra hedeflenmeli; tek seferlik geniş yeniden yazım önerilmiyor. İlk altı iş birbirinden büyük ölçüde bağımsız; 7–8 görünür kabul kanıtını, 9–10 iyileştirme ve sürüm bakımını tamamlar.

## Akış kapsamı ve açık kalan kabul kontrolleri

| Adım | Akış | Genel durum — yalnız mevcut kanıt | Açık kontrol |
|---|---|---|---|
| 1 | Pazarlama → kayıt → onboarding | Kod/build incelendi; üç adımlı kurulum mevcut | Yeni test hesabıyla ilk QR menüye kadar ekranlar ve süre |
| 2 | Pano → navigasyon → bildirimler | Pano veri yaklaşımı güçlü; F03/F08/F06 açık | 320/390/768/1440 px, uzun restoran adı, badge, focus, notification scroll |
| 3 | Kategori → ürün → editör → CSV | F01/F03/F04 doğrulandı; F12 tutarsızlığı var | İlk ürün, 1.000 satır import, uzun metin, hata ve geri dönüş |
| 4 | Tema → önizleme → taslak → yayın | Revision ve preview sınırları mevcut; F05/F07/F08 açık | İki editör conflict’i, yanlış origin, kopan iframe, çıkış koruması, yayın/QR eşleşmesi |
| 5 | QR ürün → sepet → sipariş/ödeme | API sınırları ve fiyat doğrulama kodu incelendi; F09 açık | Gerçek mobil cold/warm açılış, modifier, geri dönüş, çift tıklama, ödeme retry |
| 6 | Masalar → mutfak → hazır | Mutfak sessiz hata riski F02 | Sipariş görünme süresi, session timeout, offline/reconnect; masa transferi runtime |
| 7 | Ekip/abonelik/fatura | Mevcut testler başarılı; değişen faturalama kodu çalışma ağacına dahil | Test sağlayıcısında purchase/refund/replay ve yeni migration’ların uygulanmışlığı |
| 8 | Platform yönetimi/destek | İncelenen auth yolunda MFA ve süreli erişim mevcut | AAL1, pasif admin, başka tenant, süresi dolmuş destek oturumu negatif runtime |

Hiçbir adım için bu çalışmada kabul edilmiş screenshot yoktur. Eski audit görselleri kanıt olarak kullanılmadı. Browser bağlanınca bu tablo tamamlanmalı; kullanıcı görsel kontrolün bittiğini varsaymamalı.

Production DB’ye mutation, ödeme, e-posta/SMS gönderimi veya yayınlama yapılmadı. Yerel build, marketing destek telefonu için uyarı verdi; [legal-readiness.mjs](../../../apps/marketing/scripts/legal-readiness.mjs#L1) bunu release modunda hata yapıyor. Bu yerel uyarıdan production değerin eksik olduğu sonucu çıkarılmadı. Yasal uyumluluk bu audit’te hukuki görüş olarak değerlendirilmedi.

## Yeniden çalıştırma ve kanıt sınırı

Repo kökünde Node 24 aktifken: `corepack pnpm check:ci`, `corepack pnpm build`, `corepack pnpm --filter @garsonless/design-engine test`, `corepack pnpm --filter @garsonless/ui exec node --import tsx --test 'src/themes/**/*.test.ts'`, `corepack pnpm check:dashboard-bundle-budget`.

İzole tanı: `node docs/audits/saas-prelaunch-2026-09-05/evidence/source-probes.mjs`. Bu araç mevcut kusurları doğrulamak için beklenen bozuk durumları assert eder; ürün regresyon testi olarak CI’a eklenmemeli. Düzeltmelerden sonra kabul senaryoları normal davranışı bekleyen testlere dönüştürülmeli.

Kaynak commit [commit.txt](evidence/commit.txt), başlangıç değişiklikleri [initial-worktree.txt](evidence/initial-worktree.txt) içinde kayıtlı. Bulgular bu snapshot ve kaydedilmemiş değişikliklere aittir. Sonraki değişikliklerde satırlar ve davranış yeniden kontrol edilmelidir.
