# Masabu — Siparişler audit ve düzeltme raporu

6 Eylül 2026 · Başlangıç commit'i: `3e5e7cc` · İncelenen ve doğrulanan ortam: yerel production build + izole DEV Supabase restoranı.

**Sonuç:** Beş doğrulanmış bulgu düzeltildi: üç P1, iki P2. Bu kapsamda P0 doğrulanmadı; bu ifade tüm ödeme altyapısı veya tüm tenant politikaları için güvenlik onayı değildir. Mevcut tasarım, renkler, animasyon süreleri ve geçişler korundu. Commit, push ve production deploy bu çalışmada yapılmadı.

## İncelenen akış ve sağlık durumu

| Adım | Önce | Düzeltme sonrası |
|---|---|---|
| 1. Boş/dolu pano, durum kolonları ve kartlar | Temel hiyerarşi çalışıyor; mobil detayda aksiyon taşıyor | 320/390 px mobil, 768 px tablet ve 1440 px masaüstünde kontrol edildi |
| 2. Detay → iptal / tahsilat / iade → geri dönüş | Pencereler ayrışıyor; ancak J kısayolu arka plandaki seçimi değiştiriyor | Dialog açıkken pano kısayolları devre dışı, dönüşte aynı sipariş kalıyor |
| 3. İade tutarı ve gerekçe | 19,99 gibi geçerli tutar sessizce reddediliyor | Geçerli kuruş kabul ediliyor; fazla ondalık açıklamalı hata veriyor |
| 4. Geçmiş sipariş arama | Görünen #EA21A6 ile sonuç bulunamıyor | # işareti, boşluk ve Türkçe harfler doğru işleniyor |
| 5. Geçmiş → fiş → geçmiş | Arama ve durum sekmesi sıfırlanıyor | Her ikisi korunuyor; fiş açıkken tek aktif dialog var |

## Bulgular ve uygulanan çözümler

### 1. P1 — Mobil detay ve filtre genişliği içerikle uyuşmuyor

**Kullanıcı etkisi:** Dar ekranda servis aksiyonu kesiliyor; filtre panelinin içeriği panel sınırının dışına çıkıyor. Operasyon sırasında aksiyonu okumak ve kullanmak zorlaşıyor.

**Kanıt:** 320 CSS px ekranda detay dialog'u 240 px genişlikteydi; son aksiyonun sağ kenarı 387,66 px'e uzanıyordu. Filtre dialog'u 240 px iken içeriği 302 px idi. [Önce detay](evidence/09-detail-320-before.jpg), [önce filtre](evidence/10-filter-320-before.jpg).

**Kök neden:** Ortak Sheet primitive'indeki `data-[side=right]:w-3/4` / sol eşleniği, kullanım yerindeki düz `w-*` sınıfından baskın. İçerik ise başka bir genişliğe göre hazırlanmış.

**Çözüm:** Siparişler kullanımında aynı side varyantı üzerinden genişlik belirlendi. Mobil detay tam genişlik, tablet detay en çok 430 px; filtre en çok 340 px ve ekran kenarında 18 px boşluk. Filtre içeriği ebeveynine uyuyor. Detay aksiyonları gerektiğinde alt satıra geçiyor.

**Dosya:** `apps/dashboard/components/orders/OrderBoard.tsx:350`, `:704`, `:1390`, `:1399`.

**Efor:** Küçük. **Kabul:** 320 px'de detay 320 px, scrollWidth 319 px; bütün aksiyonların sağ kenarı 304 px içinde. Filtre yaklaşık 302 px, içerik 302 px. Tablet detay 430 px. [Sonra detay](evidence/13-detail-320-after.jpg), [sonra filtre](evidence/11-filter-320-after.jpg), [tablet](evidence/17-tablet-after.jpg). **Durum: düzeltildi ve tarayıcıda doğrulandı.**

### 2. P1 — Geçerli kuruşlu iade tutarları üç katmanda reddediliyor

**Kullanıcı etkisi:** İşletme sahibi 19,99 TL gibi geçerli bir iade tutarı ve yeterli gerekçe girdiği halde kaydedemiyor. Form bunun nedenini de açıklamıyordu.

**Kanıt:** [19,99 TL / geçerli gerekçe / pasif düğme](evidence/07-refund-before.jpg). JavaScript'te `19.99 * 100 = 1998.9999999999998`; eski tam eşitlik kontrolü false. Aynı kontrol form, Server Action şeması ve application refund komutlarında tekrarlanmıştı.

**Çözüm:** Domain'de ortak kuruş doğrulaması: `Math.round(amount * 100) / 100 === amount`. Sonlu, pozitif ve mevcut bir milyon TL üst sınırı korunuyor. Form virgül/noktalı, en çok iki ondalıklı girdiyi açık biçimde ayrıştırıyor; üslü/hex/çok ayırıcılı girdileri veya fazla ondalığı yuvarlayarak kabul etmiyor. Hata `aria-invalid`, `aria-describedby` ve FieldError ile gösteriliyor. Sağlayıcı açıklamasındaki uygulama içi teknik jargon sadeleştirildi.

**Dosya:** `packages/domain/src/orders.ts:15`, `packages/application/src/refunds.ts:63`, `apps/dashboard/lib/actions/orders.ts:144`, `apps/dashboard/components/orders/order-refund-model.ts:4`, `OrderBoard.tsx:1551`.

**Efor:** Küçük–orta. **Kabul:** 0,29 / 1,10 / 19,99 / 130,01 kabul; 19,999 / negatif / sıfır / üst sınırı aşan tutar reddedilir. Manual, provider reservation ve verified finalization komutları aynı kuralla test edildi. [Sonra geçerli tutar](evidence/14-refund-after.jpg), [sonra hatalı tutar](evidence/15-refund-invalid-after.jpg). **Durum: düzeltildi; form tarayıcıda, komutlar birim testinde doğrulandı.** Gerçek iade veya sağlayıcı çağrısı yapılmadı; DEV veritabanına parasal iade gönderilmedi.

### 3. P1 — Dialog açıkken global pano kısayolu seçili siparişi değiştiriyor

**Kullanıcı etkisi:** Finansal pencere kapandıktan sonra farklı bir siparişin detayına dönülüyor; sonraki operasyon yanlış siparişte yapılabilir. Testte iade hedefinin kendisinin değiştiği görülmedi, doğrulanan hata arkadaki seçim ve geri dönüş bağlamı.

**Kanıt:** İç Salon 4 iade penceresinde Vazgeç düğmesi odaktayken J basıp kapatınca Teras siparişi açılıyordu. [Önce yanlış siparişe dönüş](evidence/08-shortcut-before.jpg).

**Çözüm:** Dialog/alertdialog/menu varken global pano klavye işleyicisi çalışmıyor. Ctrl/Meta/Alt kombinasyonları da pano kısayolları tarafından ele geçirilmiyor.

**Dosya:** `apps/dashboard/components/orders/OrderBoard.tsx:1005`.

**Efor:** Küçük. **Kabul:** İade ve iptal pencerelerindeki aynı J senaryosu sonrası aynı sipariş detayı açılıyor. [Sonra İç Salon 4'e dönüş](evidence/16-shortcut-after.jpg). **Durum: düzeltildi ve tarayıcıda doğrulandı.**

### 4. P2 — Geçmiş araması ekrandaki sipariş referansını bulamıyor

**Kullanıcı etkisi:** Personel gördüğü numarayı # işaretiyle aradığında boş sonuç alıyor; Türkçe büyük/küçük harf davranışı da ana panoyla tutarsız.

**Kanıt:** [Önce #EA21A6 ile boş sonuç](evidence/03-history-search-before.jpg).

**Çözüm:** Ana pano ve geçmiş aynı arama normalizasyonunu kullanıyor: boşluk temizliği, ilk # işaretinin kaldırılması ve Türkçe locale. Masasız siparişler Kasa etiketiyle de bulunabiliyor.

**Dosya:** `apps/dashboard/components/orders/order-history-model.ts:4`, `HistoryModal.tsx:78`, `order-filters.ts`.

**Efor:** Küçük. **Kabul:** #EA21A6 ilgili satırı getiriyor; İç Salon için Türkçe harf eşleşmeleri birim testinde doğrulanıyor. [Sonra masaüstü arama](evidence/19-history-search-desktop-after.jpg). **Durum: düzeltildi ve doğrulandı.**

### 5. P2 — Fişten geri dönmek geçmiş filtrelerini sıfırlıyor

**Kullanıcı etkisi:** Personel aradığı siparişin fişini açıp kapattıktan sonra aramayı ve sekmeyi yeniden seçmek zorunda kalıyor.

**Kanıt:** Salon araması ve Tamamlanan sekmesi seçildikten sonra fiş açılıp kapatıldığında Tümü + boş aramaya dönülüyor. [Önce](evidence/04-history-return-before.jpg).

**Çözüm:** HistoryModal React durumu fiş sırasında korunuyor; dialog görünürlüğü kontrollü `open` prop'u ile yönetiliyor. Geçmiş verisini fiş dönüşünde tekrar yükleme gereği de kaldırıldı.

**Dosya:** `apps/dashboard/components/orders/OrderBoard.tsx:1420`, `HistoryModal.tsx:32`, `:91`.

**Efor:** Küçük. **Kabul:** Mobil ve masaüstünde fiş dönüşü arama metni ve Tamamlanan sekmesi korunuyor. [Sonra masaüstü](evidence/20-history-return-desktop-after.jpg), [sonra mobil](evidence/12-history-return-320-after.jpg). **Durum: düzeltildi ve doğrulandı.** Uzun listenin scroll konumu için ayrıca kabul iddiası yok.

## Teknik değerlendirme — korunacak yönler

- Next.js 15.5.25 / React 19 / mevcut Base UI bileşenleri korundu. Bu bulgular için framework, component kit veya animasyon kütüphanesi değişikliği gerekmiyor.
- Server Action, application komutu ve veritabanı portu ayrımı korundu. Owner ve tenant kontrolleri refund testlerinde mevcut; para doğrulaması artık ortak domain kuralına bağlı.
- Pano açık siparişleri gün sınırından bağımsız, terminal siparişleri zaman penceresiyle okuyor. Realtime uzlaştırma, optimistic rollback ve bekleyen sipariş aksiyonu korumaları mevcut kodda yer alıyor; kaldırılmadı.
- Geçmişte fiş dönüşü gereksiz yeniden yükleme azaltıldı. Production build rota çıktısı Siparişler için 2,02 kB / First Load JS 129 kB gösteriyor. Bu yalnız build raporudur; sonradan dinamik yüklenen pano ve etkileşim parçalarının toplam ağırlığı veya Lighthouse performans sonucu değildir.
- 1.600 satırlık OrderBoard'ı daha sonra parçalara ayırmak bakım kolaylığı sağlayabilir; bu çalışmada davranış düzeltmelerini geniş bir yeniden yazımla birleştirmedik.

## Doğrulama kaydı ve sınırlar

- Siparişler + domain orders + application refunds hedefli test çalıştırması: **49/49 başarılı**.
- Dashboard `test:architecture`: **882/882 başarılı**. Bu pakette saf davranış testleri ve kaynak metni eşleyen mimari kontroller birlikte bulunur; 882 adet E2E/davranış testi olarak yorumlanmamalı.
- Değişen dosyalarda ESLint, dashboard `tsc --noEmit`, application typecheck ve dashboard production build başarılı. `git diff --check` temiz.
- Tarayıcı: Kullanıcının Codex in-app browser'ı. CSS viewport ölçümleri DOM'dan doğrulandı: 320×800, 390×844, 768×1000, 1440×1000. Bu browser fiziksel Android/iOS cihaz testi değildir. Sanal klavye ve %200 zoom bu turda ayrı simüle edilmedi.
- Boş/dolu pano, uzun ürün/masa adı, durum sekmeleri, mobil detay/filtre, iptal ve adisyon penceresine geçiş, iade validasyonu, fiş ve geçmiş dönüşü incelendi. Sentetik Bahçe 1 siparişi Yeni → Hazırlanıyor ilerletildi ve sayfa yenilemesi sonrasında kalıcı durum doğrulandı.
- Gerçek tahsilat, iade, İyzico uçtan uca işlemi, yazıcı çıktısı, çok kullanıcı eşzamanlı işlem ve ağ kesintisi/yavaş bağlantı bu browser turunda çalıştırılmadı. Bu alanlar tamamlanmış sayılmıyor. Yeni Lighthouse ölçümü veya animasyon değişikliği yapılmadı.
- İzole DEV restoranı, 5 masa ve 5 sentetik sipariş test bitiminde temizlendi. İlk fixture hazırlığındaki tek açık adisyon kuralı hatası sonrası oluşan ilk test verisi de yeniden deneme öncesinde temizlendi. Tarayıcı önceki test restoranına ve normal viewport'a döndürüldü.
- Ekran kanıtları bu incelemede alındı ve kaydedilen dosyalar yeniden açılarak incelendi. Araç çıktısının sağ/alt kısmındaki büyük boş canvas, ekran görüntüsü aracının çıktısıdır; ürün taşması olarak yorumlanmadı. Taşma bulguları DOM geometrisiyle ayrıca doğrulandı.
- Önceden var olan `docs/designs/` içeriğine dokunulmadı.

Resmî teknik referanslar: [Next.js 15 lazy loading](https://nextjs.org/docs/15/app/guides/lazy-loading), [Next.js 15 error handling](https://nextjs.org/docs/15/app/getting-started/error-handling), [Base UI shadcn Sheet](https://ui.shadcn.com/docs/components/base/sheet), [Dialog](https://ui.shadcn.com/docs/components/base/dialog), [Field](https://ui.shadcn.com/docs/components/base/field).
