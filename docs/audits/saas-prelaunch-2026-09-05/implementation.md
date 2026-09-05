# Audit düzeltmeleri — uygulama ve doğrulama kaydı

5 Eylül 2026. Bu kayıt [audit raporunun](README.md) üzerine yapılan uygulamayı açıklar. Tarihsel audit kanıtları eski davranışı gösterir. Değişiklikler çalışma ağacındadır; deployment yapılmadı. Kullanıcının önceden mevcut Nilvera, faturalama, bildirim mobil görünümü ve diğer kaydedilmemiş değişiklikleri korundu.

## Uygulanan değişiklikler

| Bulgu | Uygulama | Doğrulama ve açık kalan sınır |
|---|---|---|
| F01 | Yeni ürün oluşturulunca mobil çalışma alanı `editor` aşamasına geçiyor. Aynı ürünün seçili olması, ürün listesinden editörü açmayı engellemiyor. | Kaynak değişikliği ve build doğrulandı; yeniden açma E2E senaryosu eklendi. Yeni ürün kaydı sonrası gerçek mobil akış bekliyor. |
| F02 | Mutfakta canlı, gecikmiş, çevrimdışı ve ilk bağlantı durumları; son başarılı bağlantı zamanı ve tekrar deneme gösteriliyor. Son siparişler korunuyor. Gizli/çevrimdışı sayfada sorgu duruyor; dönüşte snapshot isteniyor. Son başarılı yanıt 10 saniyeden eskiyse bağlantı canlı gösterilmiyor. | Gerçek poller ile rejection, tekrar bağlanma, eşzamanlı istek engeli, disposal ve süresi dolmuş oturum testleri. |
| F03 | Canlı bildirim ve geçmiş bağımsız hata verebiliyor. Yükleme `finally` ile bitiyor; eski sorgular yeni görünümü değiştirmiyor. Okundu/kapat komutlarında hata geri bildirimi ve tekrar tıklama koruması var. CSV parser yükleme hatası yakalanıyor; import kilidi `finally` ile açılıyor. | Feed loader davranış testleri eklendi. CSV sunucudan normal hata alırsa önizleme korunur. Yanıt kaybolduğunda işlem sunucuda tamamlanmış olabileceği için menü yenilenir ve yeni önizleme istenir; belirsiz isteği körlemesine tekrarlamaz. |
| F04 | Aynı üründe hızlı/toplu kayıtlar eşzamanlı başlayamıyor; farklı ürünler bağımsız kaydedilebiliyor. Toplu hata tüm listeyi geri almıyor; yalnız hedef ürünlerin müsaitliği geri alınıyor. Fiyat kaydı ilgisiz alanları ezmiyor. Yapısal kategori işlemleri ürün işlemlerini dışlıyor ve sunucu başarısından sonra uygulanıyor. Bekleyen kayıtlarda canlı yenileme erteleniyor. | Kilit edinme, çakışan toplu işlem, farklı ürünler ve tekrar cleanup davranış testleri. Editörü açık ürünün hızlı/toplu kontrolleri kapalı; düzenleme editörden sürer. |
| F05 | Design-engine testleri ve UI paketinin iç tema testleri ana mimari test zincirine alındı. | Önceden atlanan 72 + 25 test artık `check:ci` içinde çalışıyor. Kaynak sözleşme testleri davranış testi olarak sunulmuyor. |
| F06 | PR/push workflow'u pano, menü, tema ve diğer authenticated ekranlar için 320/390/768/1440 px ve %200 zoom matrisini çalıştıracak. Production sunucu modu ve artifact yükleme eklendi. | Mevcut odaklı settings matrisi korundu. Bildirim rejection/klavye, azaltılmış hareket ve iç içe taslak onayı senaryoları eklendi. Test keşfi başarılı; browser koşuları bu ortamda çalıştırılamadı. CI test hesabı sırları gerektirir. |
| F07 | Mevcut `initial` bütçesi korundu; tekilleştirilmiş rota + seçili açılış dynamic chunk birleşimi için ayrı `ready` bütçesi eklendi. Tema dahil 10 rota ölçülüyor. Mobil Lighthouse ve soğuk/sıcak **tarayıcı cache** koşusu CI'a bağlandı. | Build üzerinde 10 bütçe geçti. Settings onay penceresinin eager import'u ölçülen 249,8 kB yük oluşturunca lazy import'a alındı; 225,3 kB'ye indi. Eşik yükseltilmedi. Mobil runtime koşusu ve preview iframe/gerçek kullanıcı p75 ölçümü bekliyor. |
| F08 | `--text-3` koyulaştırıldı; bildirimlerin yardımcı metinleri bu erişilebilir tokena geçirildi. | Açık/sıcak temanın beş nötr yüzeyinde normal metin için en az 4,5:1 kontrastı hesaplayan test. Bu, bütün ürünün WCAG uyum sertifikası değildir. |
| F09 | Sipariş ve iyzico abonelik webhook'u ortak bounded stream reader kullanıyor. Başlık olmasa veya eksik bildirilse bile gerçek byte sınırında stream iptal ediliyor. İmza için ham byte dizisi korunuyor. | UTF-8 chunk sınırı, tam limit, limit aşımı/cancel, bozuk length ve kopan stream testleri. Sipariş 128 KiB, webhook 64 KiB. |
| F10 | Ortak kaydedilmemiş değişiklikler penceresi mevcut Base UI AlertDialog bileşenlerine taşındı. Başlangıç odağı güvenli geri dönüş düğmesine veriliyor. Paylaşılan primitive, geçiş sürecindeki eski drawer'ların üstünde merkezi confirmation katmanını kullanıyor. | İlk overlay ailesi tamamlandı; diğer özel overlay'ler ve SettingsConflictDialog mevcut yapıda. Nested portal/focus/scroll kabulü Computer Use bağlantısını bekliyor. |
| F11 | Beş uygulama ve Next ESLint paketi 15.5.25'e sabitlendi; lockfile güncellendi. Kurulu runtime'ın Next/sharp/libheif sürümlerini kontrol eden gate eklendi. | Yerelde Next 15.5.25, sharp 0.35.4, libheif 1.23.2. `node scripts/runtime-versions.mjs --app-root <deployment-uygulama-dizini>` aynı kontrolü dağıtım artifact'inde yapabilir. Deployment artifact'i ve auth/AVIF smoke bu oturumda doğrulanmadı. |
| F12 | CSV fiyatı form ile aynı `parseMenuNumericInput` parser'ını kullanıyor; `120,50` destekleniyor. Ölçülmeyen 0→100 satır ilerlemesi yerine ürün sayısı ve belirsiz ilerleme durumu gösteriliyor. | Domain sayı parser testleri ve typecheck. CSV delimiter/Excel dosyasıyla canlı import kabulü bekliyor. |

## Kontroller

25 test grubunda **2343 test geçti**, 0 başarısız / 0 atlanan test. Tam kalite zinciri, beş uygulamanın build’i ve 10 rota bütçesi başarılı.

- [Tam kalite zinciri](evidence/implementation-check-ci.log): lint, typecheck, deadcode, mimari/domain/database/operasyon testleri ve runtime sürüm doğrulaması.
- [Beş uygulamanın production build'i](evidence/implementation-build.log).
- [Settings lazy-load sonrası dashboard build'i](evidence/implementation-dashboard-rebuild.log).
- [On rota için initial/ready bütçe kanıtı](evidence/implementation-bundle.json).
- [Görsel test keşfi](evidence/implementation-visual-test-list.log), [mobil performans testi keşfi](evidence/implementation-mobile-test-list.log). `--list` yalnız keşiftir; testlerin geçtiği anlamına gelmez.
- [Computer Use bağlantı denemeleri](evidence/implementation-computer-use.json).

## Performans kanıtının kapsamı

`initial`, Next rota manifestindeki JS'tir. `ready`, incelenen varsayılan ekranın açılışında kullanılan ve bütçe konfigürasyonunda açıkça listelenen dynamic import'larla birleşimdir. Dosyalar ortak chunk'lar için tekrar sayılmaz. Baseline, audit build'inden ölçülmüştür; büyüme eşiği %5'tir. Konfigürasyonun route/rapor/plan varyantlarının tamamını otomatik keşfettiği iddia edilmez. Yeni startup import'u eklenirken liste güncellenmelidir. Dynamic manifest anahtarı veya chunk kaybolursa kontrol hata verir.

Bu rakamlar gzip-9 dosya ölçümüdür; gerçek ağ transferi değildir. iframe, CSS, görsel/font ve sonradan açılan etkileşim modülleri ayrıca profillenmelidir. Mobil senaryo 150 ms gecikme ve 1,6 Mbps indirme ile iki browser cache durumunu ayrı artifact olarak kaydeder; sunucu/data cache durumu kontrol edilmez. Tıklamadan dialog'a geçen laboratuvar süresi INP olarak adlandırılmaz. Üretim p75 panosu/alarmları ayrıca doğrulanmalıdır.

## Açık kabul işleri

1. Computer Use bağlantısı kurulunca yeni ürün kaydı → editör, bildirim hata/tekrar, nested dialog ve mutfak offline/reconnect senaryolarını gerçek ekran üzerinde doğrula; ekran kanıtlarını ekle.
2. PR workflow'larını test restoranı hesabıyla çalıştır; başarılı keşif veya yerel build'i başarılı E2E yerine kullanma.
3. Mobil Lighthouse/cache koşularının gerçek ölçümünü al. Sonrasında tema property grupları/preview iframe için profiler bulgularına göre dar kapsamlı optimizasyon yap.
4. Yayın artifact'inde native sürüm kontrolünü ve auth/görsel işleme smoke'u çalıştır; Web Vitals p75 ve alarm teslimini kanıtla.

Computer Use yetkisi kullanıcı tarafından verilmiş olmasına rağmen yerel oturum `Sky Computer Use native pipe startup failed` hatasıyla başlayamadı. Güncel eklenti başlangıç yöntemi ve temiz JS oturumu da aynı hatayı verdi. Bu nedenle hiçbir ekran görüntüsü veya görsel onay üretilmedi; erişim kontrolleri tamamlanmış sayılmaz.

Yerel inceleme sunucuları: dashboard `http://127.0.0.1:3005`, menü `http://127.0.0.1:3011`. Computer Use bağlantı sorunu uygulama sunucularından önce, native kontrol oturumunun başlatılmasında oluşuyor.
