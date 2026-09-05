# Masabu — Masalar UI/UX ve teknik audit

5 Eylül 2026 · Çalışma ağacı ve yerel uygulama esas alınmıştır.

**Uygulama güncellemesi:** Bulguların kod düzeltmeleri ve doğrulama/yayın sınırları [tables-fixes.md](/Users/furkancengelm3/dev/gersonless/docs/audits/saas-prelaunch-2026-09-05/tables-fixes.md) içinde kayıtlıdır.


**Karar:** Masalar günlük operasyon için iyi bir temel sunuyor. Lansman öncesi öncelik yeni bir görsel tasarımdan önce tahsilat/taşıma hata sözleşmelerini ve canlı yenilemenin kullanıcı seçimlerine etkisini düzeltmek. Bu incelemede **4 P1, 6 P2** bulgu kaydedildi. Doğrulanmış P0 bulunmadı; bu sonuç tam güvenlik veya lansmana hazır olma onayı değildir.

**Kanıt düzeyi:** “Canlı” bu incelemede tarayıcıda gözlenen davranış; “Kod” çalışma ağacındaki uygulanabilir kontrol akışı; “Risk” belirtilen hata koşulunda beklenen sonuçtur. SQL bulguları dağıtılmış veritabanına yazılarak denenmedi; migration’ların bağlı ortama uygulanma durumu doğrulanmadı.

## Kapsam ve incelenen akışlar

Test restoranı: **Isolated Tables Browser Runtime Gate**. İki masa, bir açık adisyon, dört ürün adedi ve ₺323 kalan tutar. Uzun süredir açık test adisyonu süre/status sınırını incelemeye yardımcı oldu; bu veri gerçek işletme davranışını temsil etmez.

1. **Canlı Masalar — İyileştirme gerekli.** Bağlantı durumu görünür, mobil liste/filtre/geçmiş girişleri erişilebilir. Uzun masa adları kartlarda aynı biçimde kesiliyor; süre okunurluğu zayıf. [Ekran 01](/Users/furkancengelm3/dev/gersonless/docs/audits/saas-prelaunch-2026-09-05/evidence/tables/01-live-tables.png).
2. **Masa detayı — İyileştirme gerekli.** Toplam, tahsilat ve kalan ayrımı açık; borç varken kapatma pasif. Canlı yenileme taşıma seçimini siliyor. [Ekran 02](/Users/furkancengelm3/dev/gersonless/docs/audits/saas-prelaunch-2026-09-05/evidence/tables/02-table-detail.png), [önce](/Users/furkancengelm3/dev/gersonless/docs/audits/saas-prelaunch-2026-09-05/evidence/tables/05-selection-before-refresh.png), [sonra](/Users/furkancengelm3/dev/gersonless/docs/audits/saas-prelaunch-2026-09-05/evidence/tables/06-selection-after-refresh.png).
3. **Tahsilat hazırlığı — Temel akış iyi, hata yolları öncelikli.** Ödeme yöntemi seçilmeden onay açılamıyor; Nakit seçilince toplam ve onay metni güncelleniyor. Yalnızca yerel seçim yapıldı, tahsilat onaylanmadı. [Ekran 03](/Users/furkancengelm3/dev/gersonless/docs/audits/saas-prelaunch-2026-09-05/evidence/tables/03-settlement-staged.png).
4. **Ödeme almadan kapatma — İyileştirme gerekli.** Gerekçe zorunlu ve boşken onay pasif; gerekçe alanının erişilebilir etiketi eksik. Normal tahsilat onayı ile istisnai kapatma aynı anda görünüyor. İşlem onaylanmadı. [Ekran 04](/Users/furkancengelm3/dev/gersonless/docs/audits/saas-prelaunch-2026-09-05/evidence/tables/04-abnormal-close.png).
5. **Ürün/sipariş taşıma — Hazırlık anlaşılır, tekrar güvenliği öncelikli.** Ürün adedi, hedefin boş durumu ve taşınacak toplam adet gösteriliyor. Hedef seçildi; taşıma onaylanmadı. [Ekran 07](/Users/furkancengelm3/dev/gersonless/docs/audits/saas-prelaunch-2026-09-05/evidence/tables/07-transfer-prepared.png).
6. **Filtre ve boş sonuç — İyileştirme gerekli.** Sonuçsuz arama mobilde mevcut olmayan sol panele yönlendiriyor. Filtreler sonradan temizlendi. [Ekran 08](/Users/furkancengelm3/dev/gersonless/docs/audits/saas-prelaunch-2026-09-05/evidence/tables/08-mobile-empty-filter.png).
7. **Taşıma geçmişi — Gözlenen boş durum iyi.** Açıklama ve geri dönüş eylemi var; Escape sonrası odak Geçmiş düğmesine döndü. Dolu geçmiş/geri alma doğrulanmadı. [Ekran 09](/Users/furkancengelm3/dev/gersonless/docs/audits/saas-prelaunch-2026-09-05/evidence/tables/09-transfer-history.png).
8. **QR Studio — Önizleme/tasarım girişi incelendi.** Ortak tasarım kapsamı ve senkron durumu açıklanıyor; mobil indirme düğmesi kesiliyor. Export, fiziksel tarama, token yenileme ve tasarım kaydı yapılmadı. [Ekran 10](/Users/furkancengelm3/dev/gersonless/docs/audits/saas-prelaunch-2026-09-05/evidence/tables/10-qr-preview.png), [Ekran 11](/Users/furkancengelm3/dev/gersonless/docs/audits/saas-prelaunch-2026-09-05/evidence/tables/11-qr-design.png).

## Öncelikli bulgular

### T01 · P1 · Tahsilat hata sonucu, kalıcı ödeme yazımını geri almıyor

**Kanıt: Kod; gerçek tahsilatla yeniden üretilmedi.** [Atomic settlement SQL](/Users/furkancengelm3/dev/gersonless/packages/db/supabase/migrations/20260822040000_tables_critical_path_reads.sql:194) önce `orders.paid_at`, yöntem ve tahsil eden kullanıcıyı yazar; sonra kapatma fonksiyonunu çağırıp sonucu normal JSON olarak döndürür (207–209). [Kapatma SQL’i](/Users/furkancengelm3/dev/gersonless/packages/db/supabase/migrations/20260716100000_atomic_table_close_service_request_and_kitchen_transition.sql:55) `payment_pending` veya `unpaid` sonucunu exception atmadan döndürür. [Server action](/Users/furkancengelm3/dev/gersonless/apps/dashboard/lib/actions/settlement.ts:119) bunu kullanıcıya hata olarak çevirir. Normal dönüş önceki UPDATE’i kendiliğinden geri almaz. PostgreSQL’in [RETURN ve exception davranışı](https://www.postgresql.org/docs/current/plpgsql-control-structures.html#PLPGSQL-ERROR-TRAPPING) bu ayrımın temelidir; bağlı PostgreSQL sürümü tespit edilmedi.

**Etki:** Bekleyen online ödeme veya istek hazırlanırken eklenen başka bir ödenmemiş sipariş gibi durumlarda kapatma reddedilirken seçili siparişler ödenmiş olabilir. Kullanıcı “hata” ile kalıcı kısmi başarıyı ayırt edemez. Bu, mutabakatı zorlaştırır; doğrulanmış çift tahsilat iddiası değildir. RPC bulunamazsa kullanılan [ayrı komutlardan oluşan fallback](/Users/furkancengelm3/dev/gersonless/apps/dashboard/lib/actions/settlement.ts:136) de kısmi yazım üretebilir.

**Çözüm:** İşlem sözleşmesini açıklaştır: “tahsil et ve kapat” başarısızsa bütün ilgili yazımları geri al; kontrolleri uygun kilitler altında yap. Kısmi tahsilat bilinçli bir ürün kararıysa ayrı bir sonuç tipi ve görünür döküm döndür. Zorunlu atomic RPC eksikken aynı güvenceyi vermeyen fallback’e sessiz geçme.

**Efor:** 1–2 geliştirici günü, izole DB testleri dahil. **Kabul:** Bekleyen sağlayıcı ödemesi, eklenmiş ödenmemiş sipariş ve RPC eksikliği senaryolarında sonuç ile `paid_at/payment_method/session.closed_at` tutarlı; başarısız atomik işlemde hiçbir ödeme yazımı kalmıyor.

### T02 · P1 · Reddedilen istek tahsilat penceresini kilitleyebilir

**Kanıt: Kod ve hata senaryosu çıkarımı.** [use-settlement-sheet](/Users/furkancengelm3/dev/gersonless/apps/dashboard/components/tables/use-settlement-sheet.ts:101) içindeki pay onayı, kart payı serbest bırakma/uzlaştırma, normal tahsilat ve anormal kapatma akışları busy bayrağını `await` öncesi açıp yalnız normal dönüşten sonra kapatıyor. `try/finally` yok. [SettlementSheet](/Users/furkancengelm3/dev/gersonless/apps/dashboard/components/tables/SettlementSheet.tsx:106) busy iken pencere kapatmayı ve iptali engelliyor.

**Etki:** Ağ bağlantısının kesilmesi veya server-action taşıma katmanının Promise’ı reddetmesi, ekranı “işleniyor” durumunda bırakabilir. Sunucunun `{error}` döndürmesi bu koşulu kapsamaz; canlı ağ hatası enjekte edilmedi.

**Çözüm:** Her mutation için `try/catch/finally`, anlaşılır bağlantı hatası ve eşzamanlı tekrar çağrı koruması. Yanıt kaybolduysa yeniden tahsilat teklifinden önce güncel adisyonu oku; kullanıcıya sonuç belirsizliğini göster.

**Efor:** 0,5–1 gün. **Kabul:** Her mutation rejected-Promise ile test edildiğinde busy kapanır, hata görünür, kullanıcı pencereden çıkabilir; başarısız/belirsiz işlem başarı göstermez.

### T03 · P1 · Taşıma tekrarında yeni requestId, DB’deki tekrar korumasını aşabilir

**Kanıt: Kod; taşıma yapılmadı.** [TableTransferDialog.submit](/Users/furkancengelm3/dev/gersonless/apps/dashboard/components/tables/TableTransferDialog.tsx:127) her onayda `crypto.randomUUID()` üretiyor. Catch kullanıcıya tekrar denemesini söylüyor. [Transfer SQL’i](/Users/furkancengelm3/dev/gersonless/packages/db/supabase/migrations/20260729040000_table_order_item_transfers.sql:185) ise aynı tenant + requestId için kilit ve kayıt kontrolüyle tekrarı önlüyor.

**Etki:** Üç aynı üründen birinin taşınması sunucuda tamamlanıp yanıt kaybolursa, canlı veri yenilenmeden aynı seçimin yeniden gönderilmesi yeni işlem sayılabilir ve bir ürün daha taşıyabilir. Bunun için kaynaktaki adet hâlâ yeterli olmalı; her yeniden denemenin çift yazım yapacağı iddia edilmiyor.

**Çözüm:** Kaynak, hedef ve ürün/adet seçiminden oluşan aynı işlem niyeti için kimliği koru; transport retry aynı kimliği kullansın. Sonuç belirsizliğinde operation durumunu sorgula. Yeni kimlik yalnız yeni işlem niyetinde üret.

**Efor:** 1–1,5 gün. **Kabul:** DB commit sonrası ilk yanıt düşürüldüğünde retry aynı operationId’yi verir; hedef adet yalnız bir kez artar. Farklı payload ile aynı kimlik reddedilir.

### T04 · P1 · Canlı yenileme, çalışanın taşıma seçimini siliyor

**Kanıt: Canlı + Kod.** Masa detayında “Taşımak için seç” açılıp bir sipariş seçildi. Başka UI işlemi yapmadan bekleyince seçim modu kapandı ve seçim kayboldu. Adisyonun tutarı/ürünleri aynı kaldı.

![Yenileme öncesinde bir sipariş seçili](/Users/furkancengelm3/dev/gersonless/docs/audits/saas-prelaunch-2026-09-05/evidence/tables/05-selection-before-refresh.png)

![Yenileme sonrasında seçim modu kapanmış](/Users/furkancengelm3/dev/gersonless/docs/audits/saas-prelaunch-2026-09-05/evidence/tables/06-selection-after-refresh.png)

[TableDetailPanel effect](/Users/furkancengelm3/dev/gersonless/apps/dashboard/components/tables/TableDetailPanel.tsx:70) `session` nesnesi değiştiğinde seçimi sıfırlıyor ve detayları yeniden yüklüyor. [refreshSessions](/Users/furkancengelm3/dev/gersonless/apps/dashboard/components/tables/use-tables-live-state.ts:73) yeni nesneler üretiyor. Güvenlik amaçlı canlı senkronizasyon [45 saniyede bir](/Users/furkancengelm3/dev/gersonless/apps/dashboard/components/tables/tables-realtime-model.ts:3) çalışıyor. React bağımlılıkları [Object.is ile karşılaştırır](https://react.dev/reference/react/useEffect); eşdeğer içerikli yeni nesne de effect’i tetikler.

**Etki:** Garsonun yaptığı seçim boşa gidiyor; ilgisiz canlı olaylar gereksiz detay isteği ve yeniden yükleme durumu da oluşturabilir.

**Çözüm:** Seçim sıfırlamasını gerçek adisyon/masa değişimine bağla. Detay yenilemeyi ayrı yönet; aynı adisyondaki geçerli seçili orderId’leri koru, kaldırılan siparişleri seçili kümeden çıkar. Arka plan yenilemesinde mevcut içeriği koru.

**Efor:** 0,5–1 gün. **Kabul:** İki güvenlik yenilemesi ve başka masadaki olay boyunca seçim/odak korunur; gerçek adisyon değişiminde temizlenir. Aynı revision’da gereksiz detay çağrısı oluşmaz.

### T05 · P2 · Süre ve operasyon durumları pano ile aynı anlamı taşımıyor

**Kanıt: Canlı + Kod.** Test adisyonu `334s 7dk` olarak gösterildi; günler süren adisyon da sıradan “Gecikiyor” durumunda. [sessionDuration](/Users/furkancengelm3/dev/gersonless/apps/dashboard/components/tables/tables-operation-model.ts:110) yalnız saat/dakika yazıyor. [Ortak operasyon modeli](/Users/furkancengelm3/dev/gersonless/packages/application/src/table-operations.ts:33) 45 dakika sonrasında late üretirken [pano](/Users/furkancengelm3/dev/gersonless/apps/dashboard/lib/pano-table-status-model.ts:35) işletme günü ve tahsilat üzerinden ayrıca stale/paid ayrımı yapıyor. Başlıkta “1 açık” kapsayıcı, filtrede “Açık (0)” ise daha dar anlamda kullanılıyor.

**Etki:** Eski unutulmuş adisyonla bugünkü servis gecikmesi karışıyor. `s` saat/saniye açısından belirsiz. Personel iki ekranda aynı masayı farklı yorumlayabilir.

**Çözüm:** Ortak durum sözlüğü; “Önceki günden açık”, “Tahsil edildi”, “Servis süresi aşıldı” anlamlarını açıklaştır. `13 gün 22 sa` / `2 sa 7 dk` göster. 45 dakikalık eşiği işletmenin operasyonuyla doğrula; kendiliğinden yanlış kabul etme.

**Efor:** 0,5–1 gün. **Kabul:** İşletme günü geçişi, tahsil edilmiş açık adisyon ve 44/45 dakika sınırları pano ve masalarda çelişmeyen etiket/sayım verir.

### T06 · P2 · Mobil boş sonuç ekranı olmayan sol panele yönlendiriyor

**Kanıt: Canlı + Kod.** Sonuçsuz arama sonrası “Sol paneldeki filtreleri değiştirin.” yazıyor; mobilde yalnız Filtreler düğmesi var. [EmptyDescription](/Users/furkancengelm3/dev/gersonless/apps/dashboard/components/tables/TablesFloorCanvas.tsx:154) ilk masa ekleme için de aynı masaüstü varsayımını yapıyor.

![Mobil boş sonuç yönlendirmesi](/Users/furkancengelm3/dev/gersonless/docs/audits/saas-prelaunch-2026-09-05/evidence/tables/08-mobile-empty-filter.png)

**Çözüm:** Boş kartta çalışan “Filtreleri temizle” eylemi; hiç masa yoksa yetkiye uygun “İlk masayı ekle”. Cihazdan bağımsız açıklama.

**Efor:** 2–3 saat. **Kabul:** 320/390 px’de boş sonuçtan tek eylemle tüm masalara dönülür; masa oluşturma yetkisi olmayan kullanıcıya erişemeyeceği CTA gösterilmez.

### T07 · P2 · Anormal kapatma gerekçesinin erişilebilir etiketi yok

**Kanıt: Canlı AX + Kod.** [Gerekçe Input’u](/Users/furkancengelm3/dev/gersonless/apps/dashboard/components/tables/SettlementSheet.tsx:260) yalnız placeholder taşıyor; ilişkili FieldLabel/aria-label yok. Erişilebilirlik ağacında anlamlı alan adı yerine üretilmiş ID görüldü. Mobil placeholder da kesiliyor. Normal tahsilat onayı ile gerekçeli kapatma aynı footer’da birlikte sunuluyor.

**Çözüm:** Kalıcı “Kapatma gerekçesi” etiketi, açıklama/hata bağlantısı; gerekçeli modda tek açık birincil karar. Mevcut Base UI altyapısı kullanılabilir. Masalar içindeki [özel AccessibleDialog](/Users/furkancengelm3/dev/gersonless/apps/dashboard/components/tables/AccessibleDialog.tsx:1) ile Base UI dialog yollarını aynı odak/kapama sözleşmesine yaklaştır.

**Efor:** 0,5 gün. **Kabul:** Alanın anlamlı erişilebilir adı var; yazı girildikten sonra etiket görünür kalır; Escape/Tab/Shift+Tab ve tetikleyiciye odak dönüşü iki modal türünde doğrulanır. Bu inceleme tam ekran okuyucu denetimi değildir.

### T08 · P2 · İlk salon planı yükleme hatasının uygulama içi toparlanması eksik

**Kanıt: Kod; ilk istek hatası canlı enjekte edilmedi.** [Edit kapısı](/Users/furkancengelm3/dev/gersonless/apps/dashboard/components/tables/TablesFloorCanvas.tsx:51), [save](/Users/furkancengelm3/dev/gersonless/apps/dashboard/components/tables/use-table-floor-layout.ts:81) ve [external sync](/Users/furkancengelm3/dev/gersonless/apps/dashboard/components/tables/use-table-layout-external-sync.ts:66) `initialLayoutError` varken duruyor. Sonraki canlı geçersiz kılma olayı da bu başlangıç hatasını aşamıyor.

**Etki:** Geçici ilk yükleme sorunu geçtiğinde sayfa yeniden yüklenene/yeni başarılı sunucu props’u gelene kadar plan düzenleme geri gelmeyebilir. Güvenli kaydı engellemek doğru, tekrar deneme yolu eksik.

**Çözüm:** Planı yeniden okuyan açık bir retry; başarılı okuma sonrası snapshot/revision ve hatayı birlikte güncelle. Taslak koruma ve çakışma kontrolünü sürdür.

**Efor:** 0,5–1 gün. **Kabul:** İlk layout isteği hata, sonraki başarılı olduğunda tam sayfa reload olmadan düzenleme açılır; eski revision ile kayıt yapılamaz.

### T09 · P2 · Davranış testleri var, kritik runtime kapısı PR öncesi çalışmıyor

**Kanıt: Kod + test çıktıları.** [Tables Runtime Gate](/Users/furkancengelm3/dev/gersonless/.github/workflows/tables-runtime.yml:3) manuel, gece zamanlaması ve belirli `main` push’larında çalışıyor; `pull_request` tetikleyicisi yok. Mevcut suite DB/browser/Realtime akışlarını içeriyor; “E2E yok” sonucu çıkarılmamalı. Buna karşılık [accessible-dialog testi](/Users/furkancengelm3/dev/gersonless/apps/dashboard/components/tables/accessible-dialog.test.ts:1) ve başka testler kaynak metni eşliyor. Geçmeleri gerçek odak, ağ hatası veya SQL rollback davranışını kanıtlamıyor.

**Çözüm:** T01–T04 için davranış testleri ekle. İzole tenant/DB ile güvenilir PR’larda birleştirme öncesi kapı kur; fork koduna servis anahtarı vermeden mevcut sır yönetimini koru. Runtime path filtrelerini ortak domain bağımlılıklarını da kapsayacak şekilde gözden geçir.

**Efor:** 1–2 gün; T01–T04 test altyapısıyla paylaşılabilir. **Kabul:** Bu dört regresyondan herhangi biri tekrar eklendiğinde ilgili test başarısız; birleştirme öncesi sonuç görünür ve gerekli kontrol olarak çalışır.

### T10 · P2 · Mobilde ayırt edici metinler fazla daralıyor

**Kanıt: Canlı ekran 01 ve 10.** İki masa adı kartlarda `Runtime Canl…` biçiminde aynı görünüyor. Tam ad detayda/erişilebilir isimde var, ancak hızlı görsel seçim zorlaşıyor. QR araç çubuğunda “İndir PNG” kesiliyor. [Kart etiketi](/Users/furkancengelm3/dev/gersonless/apps/dashboard/components/tables/TablesFloorCard.tsx:152).

**Çözüm:** Mobil kartta kısa masa numarasını sabit göster, adı iki satıra izin verecek biçimde düzenle; kritik tutarı koru. QR ana indirme eylemine minimum genişlik ver, ikincil işlemleri menüye taşı. Tasarım tokenlarını koruyarak düzelt.

**Efor:** 0,5 gün. **Kabul:** Aynı önekli uzun adlar 320/390 px’de ayırt edilir; indirme eylemi tam okunur. Dokunma alanları ve alt navigasyonla çakışma gerçek ekran görüntüsüyle yeniden kontrol edilir.

## Korunması gereken güçlü yönler ve teknoloji kararı

| Karar | Projeye özgü gerekçe |
|---|---|
| **Koru — Next.js/React ve workspace ayrımı** | Bulgular framework yetersizliğinden değil mutation sözleşmeleri ve state yaşam döngüsünden kaynaklanıyor. Bu kapsam framework yükseltmesini gerekçelendirmiyor. |
| **Koru — Supabase/PostgreSQL** | Tenant/session kapsamlı sorgular, transfer request-intent doğrulaması ve kilitleri değerli. Bunların istemciye kadar tutarlı taşınması gerekli. |
| **Koru — Realtime + güvenlik yenilemesi** | Bağlantı durumları ayrıştırılmış; session/request yüklemelerinde eski yanıt koruması var. Yenilemeyi kapatmak yerine kullanıcı seçimiyle bağımlılığını düzelt. Supabase [Postgres Changes dokümantasyonu](https://supabase.com/docs/guides/realtime/postgres-changes) yetkilendirme ve ölçek maliyetini ayrıca ele alır; burada çok tenantlı yük testi yapılmadı. |
| **Koru — Server-side yetki ve plan kapıları** | [tables-command-access](/Users/furkancengelm3/dev/gersonless/apps/dashboard/lib/auth/tables-command-access.ts:5) kullanıcı, restoran erişimi ve özellik hakkını denetliyor. Atomic settlement RPC yalnız service_role’a açık ve DB’de tenant/session sınırını tekrar doğruluyor. Bu, tüm RLS politikalarının test edildiği anlamına gelmez. |
| **Sadeleştir — Dialog ve durum gösterimleri** | Özel dialog ile Base UI yollarının bakım yükünü azalt; pano/masalar için iş günü, tahsilat ve süre anlamlarını ortaklaştır. Yeni component kütüphanesi eklemek gerekli görünmüyor. |
| **Değiştir — Mutation hata/tekrar yönetimi** | Aynı niyetin aynı kimliği taşıması, sonuç belirsizliği ve busy temizliği ortak bir sözleşmeye bağlanmalı. Sırf bunun için yeni state kütüphanesi ekleme. |

Yerleşimde revision/çakışma uyarıları ve “Taslağımı koru / Güncel düzeni yükle” ayrımı mevcut. Tahsilatta kalan tutar, zorunlu yöntem ve gerekçeli kapatma korumaları iyi. QR tasarımının tüm masalara uygulanacağı ve senkron durumu açıkça anlatılıyor. Bunları koruyarak ilerlemek daha düşük bakım maliyeti getirir.

## Performans ve doğrulama

| Kontrol | Sonuç ve sınır |
|---|---|
| Masalar testleri | `node --import tsx --test components/tables/*.test.ts`: **125/125 geçti**, sıfır atlanan. Kaynak sözleşmesi ve gerçek model testleri birlikte; tamamı davranış testi sayılmadı. [Log](/Users/furkancengelm3/dev/gersonless/docs/audits/saas-prelaunch-2026-09-05/evidence/tables/tests.log). |
| Hedefli ESLint | Masalar bileşenleri, tables/settlement action’ları ve tables-command-access: **exit 0**. [Log](/Users/furkancengelm3/dev/gersonless/docs/audits/saas-prelaunch-2026-09-05/evidence/tables/lint.log). |
| Dashboard TypeScript | `pnpm --filter @garsonless/dashboard typecheck`: **exit 0**. [Log](/Users/furkancengelm3/dev/gersonless/docs/audits/saas-prelaunch-2026-09-05/evidence/tables/types.log). |
| Mevcut build bundle bütçesi | `/tables`: entry **0,4 kB**, initial **114,6 kB gzip**; `/tables/qr`: entry **0,5 kB**, initial **114,6 kB gzip**. Her iki rota bütçe altında. Önceki çalışmadan mevcut production build manifesti ölçüldü; bu audit yeni build almadı. [Log](/Users/furkancengelm3/dev/gersonless/docs/audits/saas-prelaunch-2026-09-05/evidence/tables/bundle.log). |
| DOM geometri | Gerçek `innerWidth` 320/390/768/1440 iken ana Masalar ekranında görünen button/input/select/link/kart kontrollerinde yatay sınır aşımı bulunmadı. [Kayıt](/Users/furkancengelm3/dev/gersonless/docs/audits/saas-prelaunch-2026-09-05/evidence/tables/verification.json). |
| Görsel kanıt | Bu audit’te alınan ve kaydedildikten sonra yeniden açılan 11 doğal tarayıcı ekran görüntüsü. Viewport override görüntülerinde ölçekleme sorunu olduğundan emüle genişliklerden yalnız DOM geometrisi kabul edildi. |

**Performans yorumu:** Bu paket ölçümü tek başına hızlı kullanıcı deneyimi kanıtı değil; veri bekleme, hidratasyon, etkileşim ve sonradan yüklenen bütün akışları ölçmez. İlk somut optimizasyon T04’teki gereksiz detay yenilemesini kaldırmak. Ardından 50/200 masalı test verisinde ilk açılış, sıcak cache, Realtime olay patlaması ve etkileşim gecikmesini ölçmek gerekir. Bu audit’te Lighthouse, CPU/ağ kısıtlama, LCP/INP/CLS veya gerçek kullanıcı verisi ölçülmedi; sayısal hız kazancı iddia edilmiyor.

**Açık kapsam sınırları:** Gerçek tahsilat/kapatma, transfer/geri alma, yeni masa veya salon planı kaydı, QR token yenileme yapılmadı. Split/online ödeme, yetkisiz personel, çok kullanıcılı eşzamanlı düzenleme ve fiziksel QR tarama uçtan uca doğrulanmadı. Klavye incelemesi Escape ve bazı odak gözlemleriyle sınırlı; tam Tab sırası, ekran okuyucu, %200 zoom ve azaltılmış hareket matrisi tamamlanmadı. Ürün kodu, şema ve API değiştirilmedi; yalnız bu rapor ve kanıt dosyaları eklendi.

## İlk yapılacak 10 iş ve bağımlılık sırası

| Sıra | İş | Bağımlılık |
|---|---|---|
| 1 | T01: Tahsilat/kapatma başarı ve rollback sözleşmesini düzelt | İzole DB fixture; migration deploy kontrolü |
| 2 | T03: Taşıma retry kimliğini koru | İstemci niyet modeli ve operation sorgulama |
| 3 | T02: Tahsilat rejected-Promise ve belirsiz sonuç toparlanmasını ekle | 1’in sonuç sözleşmesi |
| 4 | T04: Canlı yenilemede seçim/odak koruması | Bağımsız; ilk üçle paralel geliştirilebilir |
| 5 | T09: Dört regresyonu davranış testleriyle PR kapısına al | 1–4; testler düzeltmelerle birlikte yazılmalı |
| 6 | T05: Ortak durum/süre sözlüğü | İşletme günü ve gecikme ürün kararı |
| 7 | T07: Gerekçe etiketi ve modal odak tutarlılığı | 3 ile aynı componentlere dokunabilir |
| 8 | T06: Mobil boş sonuçtan doğrudan kurtarma | Bağımsız |
| 9 | T08: Salon planı ilk yükleme retry akışı | Mevcut revision korumasını koru |
| 10 | T10: Mobil kart/QR eylem okunurluğu | 6’nın son etiketleriyle görsel doğrulama |

Eforlar tek geliştirici için yaklaşık aktif uygulama/test süresidir; toplam takvim taahhüdü değildir. İlk dört iş ve bunların davranış kanıtları lansman öncesi öncelikli; geri kalanları ortak mobil/erişilebilirlik turuyla tamamlamak uygun.
