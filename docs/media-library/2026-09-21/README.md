# Masabu — İşletmeye özel dosya kütüphanesi ve ortak medya seçici

Tarih: 21 Eylül 2026. Durum: ilk sürüm kodlandı; DEV migration, dosya geçişi ve worker kurulumu uygulandı. Üretim yayını yapılmadı. Uygulama ve doğrulama notları: [IMPLEMENTATION.md](./IMPLEMENTATION.md).

## 1. Kararlar ve araştırma

Kullanıcının onayladığı kapsam: **görseller ve mevcut tema videoları**, **pakete göre farklı işletme kotası**. Hedef: dosyayı bir kez yüklemek, aynı işletmenin farklı alanlarında yeniden kullanmak ve her yükleme/seçme işleminin sonucunu anlayabilmek.

Shopify'ın [Content > Files ve ortak dosya seçici akışı](https://help.shopify.com/en/manual/shopify-admin/productivity-tools/file-uploads) referanstır: farklı editörlerde yüklenen medyanın ortak listede toplanması, arama/filtreleme, kullanım için seçme ve plan bazlı kapasite. Masabu'nun mevcut Base UI/shadcn bileşenleri, tek fontu ve tasarım tokenları kullanılacak. Shopify'ın tüm Content modülü, metaobject sistemi veya medya editörü kopyalanmayacak.

Bu araştırma resmi ürün belgeleri ve yerel kod incelemesine dayanır; giriş yapılmış Shopify ekranlarında etkileşim testi veya müşteri görüşmesi yapılmadı. Uygulamaya başlarken dosya listesi ve seçicinin görsel referansı ayrıca yakalanıp mevcut Masabu ekranlarıyla uyarlanacak. Rakip davranışı, Masabu kullanıcılarında ölçülmüş bir ihtiyaç sıklığı olarak sunulmuyor.

Yerel bulgular:

- `restaurant-assets` ortak public medya bucket'ı ve sunucuda sahiplik/gerçek dosya içeriği kontrolleri var. İşletme için ayrı bucket açmak gerekmiyor.
- Büyük yüklemeler için `restaurant-media-staging` özel bucket'ı, imzalı yükleme, prepare/complete ve süreli temizlik akışı var. Dosyanın tamamını tekrar Next.js isteğinden geçiren ikinci bir yol kurulmayacak.
- Ürün/kategori, logo, QR logosu ve tema alanları farklı giriş noktaları kullanıyor. Tekrar kullanılabilir dosya kataloğu ve işletme bazlı toplam kota mevcut akışlarda yok.
- Ürün taslağı iptalinde kullanılmayan yeni görsel temizlenebiliyor. Tema kaldırma canlı/taslak kullanıma bakıyor; ortak kütüphane için bu kontroller yeterli değil. Tema geçmişi ve farklı yüzeyler dahil ortak referans takibi şart.
- Dosya yolları bugün amaç/ürün kimliğine bağlı. Kütüphaneden seçme yalnız URL yapıştırma olarak eklenemez; alan uyumluluğu ve sahiplik doğrulaması asset kimliği üzerinden genişletilmeli.

Kod referansları: `apps/dashboard/lib/media-staging-workflow.ts`, `media-staging-client.ts`, `menu-image-policy.ts`, `logo-image-policy.ts`, `theme-media-policy.ts`; `apps/dashboard/components/menu/use-menu-image-draft.ts`; `packages/db/src/restaurant-asset-storage-port.ts`, `menu-media-cleanup.ts`; `docs/architecture/media-rendering-policy.md`.

## 2. Kullanıcı deneyimi

### Dosyalar sayfası

Dashboard'a **İçerik → Dosyalar** eklenir. İlk sürümün tek içerik bölümü Dosyalar'dır.

- Başlık, kullanılan/kalan alan ve içerik genişliğinde “Dosya yükle” eylemi.
- Önizlemeli liste/ızgara; dosya adı, türü, boyutu, yüklenme tarihi ve kullanım sayısı.
- Ada göre arama; görsel/video ve kullanımda/kullanılmıyor filtreleri; en yeni ve en büyük sıralaması. Sunucu taraflı sayfalama.
- Dosya ayrıntısında büyük önizleme, ölçüler/video süresi, görüntüleme adı, alternatif metin, indirme ve kullanım yerlerine bağlantılar.
- Ad değişikliği yalnız görüntüleme adını değiştirir; URL ve bağlı içerik bozulmaz.
- Yeni dosya yüklemek mevcut dosyayı veya aynı adlı dosyayı sessizce değiştirmez.
- İlk sürümde klasör, gelişmiş etiket sistemi, toplu global değiştirme, AI görsel üretimi ve görsel düzenleme stüdyosu yok.

### Bütün medya alanlarında aynı seçici

“Görsel seç / Değiştir” eylemi masaüstünde modal, mobilde tam ekran erişilebilir dialog açar. Galeri alanları çoklu; logo, ürün kapak görseli ve benzeri tekli alanlar tekli seçim yapar.

1. Varsayılan sekme **Dosyalarım**: arama, uygun tür filtresi, mevcut seçimin işareti ve küçük önizlemeler.
2. **Yeni yükle** sekmesi: sürükle bırak / cihazdan seç, desteklenen tür ve sınır, dosya başına ilerleme.
3. Alt bölümde seçili adet, “Vazgeç” ve **“Seçimi kullan”**. Henüz doğrulanmamış dosya seçilemez.
4. Seçici yalnız form taslağını günceller. Ürün kaydı veya tema yayını kendi mevcut kaydetme/yayınlama akışını korur. “Görsel seçildi; değişikliği kaydettiğinizde uygulanacak” geri bildirimi verilir.
5. Seçiciyi kapatmak hedef alanı değiştirmez. Başarıyla yüklenmiş dosya kütüphanede kalır; “Henüz kullanılmıyor” görünür. Tamamlanmamış yükleme iptal edilebilir; tekrar açılınca sunucu durumu okunur. Sekme/tarayıcı kapandıktan sonra devam eden aktarım taahhüt edilmez.

Yükleme durumları: **Sırada → Yükleniyor (% gerçek aktarım) → Kontrol ediliyor / hazırlanıyor → Kullanıma hazır**. İşleme aşamasında uydurma yüzde kullanılmaz. Çoklu yüklemede başarı ve hata dosya bazında görünür; yalnız başarısızlar yeniden denenir. Kota hatasında gerekli alan ve kalan alan açıkça gösterilir.

Kütüphane ve alan politikaları ayrılır: örneğin video logo alanında seçilemez. Kütüphaneye kabul edilmiş büyük bir görsel ürün/logo alanına seçildiğinde uygun türev hazırlanır; mevcut ürün/logo boyut sınırı sessizce aşılmaz. Uyumsuz veya dönüştürülemeyen dosya nedeni ile gösterilir. Aynı görselin kırpma/odak ayarı kullanım yerine ait olur; başka ürünlerin görünümü değişmez.

### Ekran kapsamı

| Alan | Entegrasyon |
| --- | --- |
| Menü ürün ve kategori görseli | Ortak seçici; mevcut tekli/çoklu alan kurallarını korur. |
| İşletme logosu, ayarlar, tema logosu | Aynı dosya kütüphanesi; logo için uygun türev. |
| Masa/QR logo seçimi | Kaydedilen işletme medyası ortak seçiciye bağlanır; sadece yerel çıktı üretimi varsa bu ayrım UI'da açık olur. |
| Tema bölüm görseli/ikonu, galeri, hero poster, giriş arka planı/logosu | Ortak seçici; ilgili alan ölçüleri ve amaç doğrulaması. |
| Tema hero videosu | Video filtresi; mevcut süre/boyut ve tema paket erişimi korunur. |
| İşletme oluşturma | İşletme kimliği oluştuktan sonra aynı kütüphane. Önce seçilen dosya yerel önizlemede tutulur, işletme oluşunca yetkili akıştan yüklenir. |
| CSV içe aktarma, fatura/özel belge, kişisel profil avatarı | İşletmenin halka açık medya kütüphanesinin dışında. Mevcut görev akışları devam eder. |

## 3. Kota ve maliyet önerisi

Aşağıdaki sayısal değerler onaylanan plan kapsamında ilk sürüme uygulanmıştır. Her işletme bağımsız sayılır; Business'ta şubeler arası ortak havuz ilk sürüme dahil değildir.

| Masabu paketi | Önerilen toplam kapasite |
| --- | ---: |
| Starter | 250 MB |
| Plus | 1 GB |
| Pro denemesi | 1 GB |
| Pro | 5 GB |
| Business | 10 GB / işletme |

- Kota aylık tüketim değildir; o anda saklanan toplam medya alanıdır. Silinip fiziksel temizliği tamamlanan dosyanın alanı geri gelir.
- Kaynak dosya ve kalıcı optimize türevlerin gerçek byte toplamı sayılır. Bir dosya 10 üründe kullanılırsa aynı fiziksel nesne 10 kez sayılmaz. Ayrıntıda kaynak/türev boyutu açıklanır.
- Geçici yüklemeler için ayrıca görünür rezervasyon tutulur. Geçici staging kopyası kalıcı kota olarak iki kez sayılmaz; ayrı TTL, yükleme hızı ve eşzamanlılık sınırıyla korunur.
- %80 ve %95 uyarı; dolunca yeni dosya/türev yüklemesi durur. Mevcut dosyayı yeniden kullanma ve canlı menü devam eder. Yeni türev alan gerektiriyorsa seçmeden önce açıklanır.
- Paket düşüşü/deneme bitişinde dosyalar otomatik silinmez. Yeni sınır üstündeyse yükleme durur; temizleme veya paket yükseltme gösterilir. Otomatik ek ücret yok.
- Genel kütüphane görselleri en çok 8 MiB, JPEG/PNG/WebP/AVIF; AVIF işlem hattı tema/logo için güvenli türev üretecek biçimde tamamlanır. Logo 2 MiB, ürün 5 MiB, tema 8 MiB çıktı/alan politikaları korunur. Video mevcut MP4/WebM, 8 MiB ve 15 saniye kuralıyla başlar. UI mevcut MB ifadeleriyle uyumlu ve byte dönüşümü merkezi olmalı.
- İlk sürümde ek depolama satışı ve faturalama entegrasyonu yok; limitler mevcut entitlement modelindeki sayısal plan tanımından okunur.

[Supabase fiyat sayfasında](https://supabase.com/pricing) 21 Eylül 2026 itibarıyla Pro dahil alanın üstünde dosya saklama 0,0213 USD/GB, cached/uncached egress 0,03/0,09 USD/GB olarak listeleniyor. Örneğin fazladan saklanan 5 GB yaklaşık 0,1065 USD/ay yalnız storage bedelidir; görüntüleme trafiği, işleme, veritabanı ve diğer hizmetler buna dahil değildir. Bu hesap Masabu'nun gerçek faturası veya işletme kullanım ölçümü değildir. Video maliyeti için oynatma trafiği ayrıca izlenir. Kapasite değerleri pilotta gerçek işletmelerin toplam ve p95 kullanımıyla yeniden değerlendirilir.

## 4. Mimari ve veri bütünlüğü

Mevcut `domain → application → db` ayrımı, Next.js 15.5.x ve Supabase korunur. Yeni dosya sağlayıcısına taşınma gerekmez.

Önerilen modeller:

- `media_assets`: restaurant_id, kimlik, görünen ad, doğrulanmış MIME, kaynak hash'i, ölçüler/süre, durum, oluşturan ve zaman.
- `media_asset_objects`: kaynak/preview/amaç bazlı türev, bucket/path, gerçek byte, içerik hash'i ve dönüşüm sürümü; nesne yolu benzersiz.
- `media_asset_references`: işletme, asset, ürün/kategori/logo/tema hedefi ve alan yolu; canlı/taslak/geçmiş ayrımı.
- `media_upload_sessions`: mevcut staging kaydını genişleten tekrar güvenli istek, rezervasyon, lease ve sonuç.
- `media_storage_usage`: kullanılmış/ayrılmış byte; bigint, işletme başına atomik kota kontrolü.
- Silme/işleme işleri için kalıcı outbox/iş kaydı ve işlem günlüğü; günlük mutabakat görevi.

Komutlar: listele/ayrıntı, yükleme başlat, doğrula/tamamla, kullanım için hazırla, metadata güncelle, hedef kaydına bağla/ayır, kullanılmayan dosyayı sil. Tüm mutasyonlarda tenant ve aktör yeniden doğrulanır; requestId ve kayıt sürümüyle çift istek/çakışma kontrolü uygulanır.

Kota kontrolü yalnız tarayıcıda veya yükleme sonrasında yapılmaz. Başlangıçta işletme kota satırı kilitlenerek kaynak ve sınırlı çıktı bütçesi ayrılır. Gerçek byte ve gerçek format sunucuda doğrulanır; çıktı bütçeyi aşarsa ek rezervasyon atomik alınır, alınamıyorsa dosya hazır sayılmaz. Başarı rezervasyonu gerçek kullanıma çevirir. Hata/expiry rezervasyonu bir kez bırakır; süresi bitmiş imzalı yüklemelerin artık nesneleri temizlenir. Geç kalan complete/cancel yarışı terminal durumu değiştiremez.

Object Storage ve PostgreSQL birlikte tek transaction değildir: deterministik immutable path + işlem kaydı + tekrar güvenli finalization ve telafi temizliği kullanılır. DB kaydı başarısızsa public nesne yetim kalabilir; bu durum mutabakatla bulunup temizlenir ve sayımdan kaybolmaz. `storage.objects` kaydını SQL ile silmek yerine [Storage API ile fiziksel silme](https://supabase.com/docs/guides/storage/management/delete-objects) yapılır. Silme tamamlanmadan kota serbest gösterilmez.

Listeleme ve yönetim tabloları tenant RLS ile korunur; [Supabase Storage erişim kuralları](https://supabase.com/docs/guides/storage/security/access-control) ve mevcut server-only yazma sınırı korunur. Kısa süreli imzalı staging yüklemesi yalnız hazırlanan nesneye izin verir. MIME beyanı yeterli değildir: gerçek byte, decode/piksel, video codec/süre kontrolleri ve hız sınırı devam eder. Kaynak dosyalar özel, müşteriye sunulan optimize görseller mevcut public bucket'ta olur. **İşletmeye özel yönetim, menüdeki public dosya URL'sinin özel olduğu anlamına gelmez.** PDF/özel belgeler bu yüzden kapsama eklenmez.

Yetkiler: sahip tam erişir. Mevcut menü/tema/ayar düzenleme yetkisi olan ekip ilgili alandan seçme ve yükleme yapabilir; medya seçici hedef ekranın paket/yetki kısıtını aşamaz. Bağımsız Dosyalar yönetimi ve kullanılmayan dosya silme için ayrı `files` yetkisi eklenir. Sunucu asset kimliğinin aynı işletmeye ait olduğunu her bağlama işleminde kontrol eder.

Aynı işletmede sunucuda doğrulanmış aynı hash'li kaynak yüklenirse mevcut dosya önerilir/yeniden kullanılır; eşzamanlı yüklemede unique sınırı fiziksel tekrarları uzlaştırır. Farklı işletmeler arasında dedup veya bilgi paylaşımı yapılmaz. Yeni dosya seçme mevcut asset'in içeriğini global olarak değiştirmez; immutable nesneler ve hedef bağlantısının değiştirilmesi CDN sorunlarını önler.

## 5. Kullanım, silme ve eski verinin geçişi

- **Alandan kaldır:** yalnız ürün/tema bağlantısını değiştirir. Kütüphane dosyası kalır. Form iptaliyle başarılı upload otomatik silinmez.
- **Kütüphaneden sil:** kullanıcıya dosya ve kullanım yerleri gösterilir. Canlı kayıt, kaydedilmiş taslak veya geri alınabilir tema geçmişinde referansı varsa silme engellenir; ilgili yere bağlantı verilir.
- Bağlama ve silme aynı asset kilidi üzerinden yarışa dayanıklı yapılır. `deleting` dosyaya yeni bağlantı kurulamaz. Kaydedilmemiş formda seçilen dosya bu sırada silinirse kaydetme anlaşılır hatayla durur; kırık URL yazılmaz.
- İlk sürümde çöp kutusu yok; referanssız dosya için açık kalıcı silme onayı var. “Kullanılmıyor” tek başına otomatik silme sebebi değildir.
- Tema rollback geçmişinin saklama politikası aynen korunur. Geçmişe bağlı dosya, tarihçe yaşam döngüsü bitene kadar kullanımda sayılır. Sessiz toplu geçmiş temizliği yapılmaz.
- Kaynak/türevler, silme kuyruğu ve kullanım göstergesi birbirinden ayrılır; silinemeyen nesne “Temizlik bekliyor” durumunda kalır ve iş tekrar denenir.

Geçiş sırası: önce salt okunur envanter raporu; mevcut logolar, menü/kategori görselleri, tema canlı/taslak/geçmiş URL'leri ve storage nesneleri eşleştirilir. İşletmesi kanıtlanan dosyalar kopyalanmadan kataloglanır, URL değişmez; geçmiş dosyalarda orijinal yoksa mevcut optimize dosya kaynak kabul edilir. Aynı path tek asset olur. Harici URL'ler veya varsayılan sistem görselleri mevcut yerinde çalışır; tenant kotasına yanlış yazılmaz ve otomatik indirilmez. Sahibi belirsiz/boşta eski nesneler raporlanır, otomatik silinmez. Hedef ilişkisiz ama yolu doğrulanmış tenant nesneleri de kullanımda olmadığı belirtilerek sayılır. Envanter ve gerçek byte toplamı mutabık olmadan kota zorlaması açılmaz.

Yeni merkezi referans sistemi devreye girmeden eski cleanup fonksiyonları paylaşılan dosyayı silemez. Ürün, kategori, logo ve tema kaydetme/yayınlama/geri alma yolları referansları kendi DB işlemleriyle birlikte günceller. Geçişte eski URL alanları korunur; uygulama çözümlenmiş URL ile render eder, yeni seçimler asset kimliğiyle yönetilir. Rollback URL'leri korur ve kota zorlamasını feature flag ile kapatabilir; nesne taşıma/silme geri alma mekanizması olarak kullanılmaz.

## 6. Uygulama sırası ve kabul

1. **Envanter ve temel:** tüm medya giriş/temizlik yollarının listesi; salt okunur geçiş raporu; sayısal kota önerisinin kesinleşmesi; şema/RLS, referanslar, rezervasyon ve outbox.
2. **Dosyalar ve seçici:** mevcut tasarım bileşenleriyle masaüstü/mobil ekran; arama, liste, detay, yükleme durumları ve yeniden kullanım. Önce ürün ve kategori entegrasyonu.
3. **Bütün medya alanları:** logo, onboarding, QR ve tema/galeri/video; taslak/yayın/geçmiş entegrasyonu; eski cleanup kaldırma davranışının düzeltilmesi.
4. **Geçiş ve doğrulama:** izole veride yarış/hata testleri, DEV işletmesinde backfill ve kota mutabakatı; 390px/1440px ve klavye QA.
5. **Pilot/yayın:** seçili işletmelerde feature flag; dosya-kota farkı, yarım yükleme, seçici kullanım oranı, yükleme gecikmesi ve trafik maliyeti gözlemi; ardından mevcut release süreciyle kademeli yayın.

Kabul senaryoları:

- Aynı görseli ikinci üründe kullanmak tekrar upload/aynı nesne için tekrar kota üretmez.
- Farklı tenant asset kimliği, sahte URL veya doğrudan storage yazımıyla sınır aşılamaz.
- Kota sonuna yakın eşzamanlı iki yükleme limiti aşamaz; tekrar complete/iptal rezervasyonu iki kez değiştirmez.
- Dosya ile DB işlemi arasında kesinti, işleme hatası, süresi dolan yükleme, ağ kesilmesi ve silme hatası sonunda mutabakat sağlanır; sahte başarı yok.
- Menü + tema + kaydedilmiş taslak + geçmiş aynı dosyayı korur. Silme/bağlama yarışı kırık medya üretmez.
- Paket düşüşü canlı menüyü bozmaz; yeni upload engellenir, mevcut uygun dosya seçilebilir.
- Seçici açıkken hedef formun alanları, scroll ve kaydedilmemiş içerik korunur. Escape/iptal, focus iadesi, klavye seçimi ve mobil tam ekran düzgün çalışır.
- Tek/çoklu seçim, büyük liste, boş arama, uygun olmayan dosya ve çoklu kısmi hata senaryoları anlaşılırdır.
- Kota gerçek storage nesnelerinden yeniden üretilebilir; geçiş eski URL'leri bozmaz.
- Domain/application, gerçek PostgreSQL yarış/RLS ve izole Storage entegrasyon testleri; ilgili mevcut menü/tema/onboarding regresyonları; lint, typecheck, build ve tarayıcı kontrolleri geçer.

Bu plan ilk sürümdür; dosya kotası işletme başınadır. Ortak şube kütüphanesi, ek depolama satışı, PDF/özel belge ve AI görsel üretimi ayrı iş paketleridir.
