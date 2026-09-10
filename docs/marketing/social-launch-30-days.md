# Masabu — 30 günlük organik sosyal medya projesi

Hazırlık: 10 Eylül 2026. Durum: **incelemeye hazır metin ve prodüksiyon taslakları; yayınlanmadı, planlayıcıya yüklenmedi.** Görsel/video yönergeleri teslim edilmiştir; bitmiş görseller ve gerçek ekran kayıtları henüz üretilmemiştir.

## Proje başlangıcı

- Hedef: Türkiye’deki kafe ve restoran sahiplerinin ücretsiz deneme başlatması.
- Ana mesaj: **QR menüyle başla; sipariş, adisyon ve mutfağı aynı sistemden yönet.**
- Kanallar: Instagram + Facebook (12 ortak ana içerik, 8 hikâye seti), LinkedIn (4 uyarlama). Reklam bütçesi ve yeni takip sistemi yok.
- Ana ölçü: test hesapları çıkarıldıktan sonra başlayan yeni denemeler. Yardımcı ölçüler: bağlantı tıklaması, yeni kayıt, nitelikli iletişim talebi. Kaynağı bilinmeyen kayıt bir kanala mal edilmez.
- Gün 1, kullanıcının ilk paylaşımı onayladığı gündür. Günler takvim tarihi değil, bu başlangıca göre göreli günlerdir. İlk ay saatleri ana gönderilerde 12:30, hikâyelerde 18:30, LinkedIn’de 10:00 (Europe/Istanbul); bunlar başlangıç varsayımıdır, performans iddiası değildir.
- İş akışı: metin kontrolü → gerçek ekran/görsel üretimi → mobil önizleme → kullanıcı yayın onayı → kullanıcı tarafından planlama/yayın → ölçüm. Her öğenin durumu aşağıda taslaktır; bu dosya paylaşım yetkisi vermez.

## Ürün doğruluğu ve üretim kuralları

Kaynaklar: `apps/marketing/lib/pricing-catalog.ts`, `apps/marketing/lib/product-pages.ts`, `packages/domain/src/entitlements.ts` (10 Eylül 2026 kontrolü).

- Starter: QR menü ve temel tema düzenleme. Plus: personel siparişi, adisyon, tahsilat. Pro: misafir QR siparişi, KDS ve istasyonlar. Business: çok şubeli kapsam.
- Yeni işletmelerde 14 gün Pro denemesi; kart gerekmez. Süresiz ücretsiz paket vaat edilmez. Online ödeme ayrıca iyzico eklentisidir; donanım ve her POS ile uyumluluk vaat edilmez.
- Sabit fiyatlar görsellere yazılmaz; güncel fiyat sayfasına yönlendirilir. Kurulum/bölge vurgusu kullanılmaz. Uydurma kullanıcı yorumu veya ölçülmemiş kazanç yüzdesi eklenmez.
- Tasarım önerisi: krem zemin, koyu metin, mevcut yeşil marka vurgusu; her karede tek mesaj. Kare logo mevcut marka dosyasından alınır. Ana görseller 1080×1350, video/hikâye 1080×1920 olarak hazırlanır; bunlar çalışma boyutlarıdır, platform limiti iddiası değildir. Yükleme önizlemesinde kırpma ve düğme örtüşmesi kontrol edilir.
- Video: 25–30 saniye hedefi, açık altyazı, konuşma zorunlu değil. Lisanslı ses yoksa sessiz/alttan anlatımlı yayın. Ürün arayüzü çizilip gerçek ekranmış gibi sunulmaz.
- Ekran kaydı yalnız test işletmesinde yapılır. Kişi adı, e-posta, gerçek sipariş, telefon, ödeme bilgileri ve açık tarayıcı sekmeleri çıkarılır. Test işletmesinin menüsü indeks dışı kalır.

## Bağlantı kullanımı

Instagram gönderi metnindeki son çağrı: “İncelemek ve denemek için profilimizdeki bağlantıyı açın.” Facebook’ta ilgili FB bağlantısı metnin sonuna eklenir. Ana metinlere bu kanal son eki uygulanır; gönderi gövdesine uzun UTM dizileri Instagram için kopyalanmaz.

Instagram bio bağlantısı: https://masabu.co/?utm_source=instagram&utm_medium=organic_social&utm_campaign=launch_30d&utm_content=profile
Facebook profil bağlantısı: https://masabu.co/?utm_source=facebook&utm_medium=organic_social&utm_campaign=launch_30d&utm_content=profile
LinkedIn profil bağlantısı: https://masabu.co/?utm_source=linkedin&utm_medium=organic_social&utm_campaign=launch_30d&utm_content=profile

Instagram ana içeriklerinin tek tek site katkısı bio bağlantısından ayrılamaz; bio tıklamaları `profile` olarak raporlanır. Hikâyede bağlantı etiketi varsa öğeye özel bağlantı kullanılır; yoksa bio yönlendirmesi yapılır. Facebook ve LinkedIn’de öğeye özel bağlantı kullanılır. GA4 kapalıyken bu URL’ler ölçüm başlatmaz. GA4 açıldığında ana alan→kayıt alt alanı kaynak devamlılığı ayrıca doğrulanır; sadece UTM eklemek uçtan uca ilişkilendirme garantisi değildir.

## Yayın takvimi

| Gün | Öğe | Kanal | Biçim / konu |
| --- | --- | --- | --- |
| 1 | p01 | Instagram + Facebook | Kaydırmalı — QR menüyle başla. |
| 2 | s01 | Instagram + Facebook | 3 kare hikâye — Masabu ile neyi birlikte yönetebilirsiniz? |
| 3 | p02 | Instagram + Facebook | Kısa video — Misafirin gözünden Masabu |
| 4 | li01 | LinkedIn | QR menüden operasyon yönetimine |
| 5 | p03 | Instagram + Facebook | Statik — 14 gün kendi menünle dene. |
| 6 | s02 | Instagram + Facebook | 3 kare hikâye — 14 gün Pro denemesi |
| 8 | p04 | Instagram + Facebook | Kaydırmalı — Menü güncellemesini kolaylaştırın. |
| 9 | s03 | Instagram + Facebook | 3 kare hikâye — Menünüzde en son neyi güncellediniz? |
| 10 | p05 | Instagram + Facebook | Kısa video — Menünüz markanız gibi görünsün. |
| 11 | li02 | LinkedIn | Dijital menü, yaşayan bir içerik |
| 12 | p06 | Instagram + Facebook | Kaydırmalı — Siparişten önce bilgi verin. |
| 13 | s04 | Instagram + Facebook | 3 kare hikâye — Ürün fotoğrafının yanında hangi bilgi var? |
| 15 | p07 | Instagram + Facebook | Kaydırmalı — Bir masa, takip edilebilir adisyon. |
| 16 | s05 | Instagram + Facebook | 3 kare hikâye — Sipariş hangi masaya ait? |
| 17 | p08 | Instagram + Facebook | Kısa video — QR’dan masaya bağlı sipariş |
| 18 | li03 | LinkedIn | Paket seçimini iş akışından başlatın |
| 19 | p09 | Instagram + Facebook | Kaydırmalı — Hangi paket, hangi ihtiyaç? |
| 20 | s06 | Instagram + Facebook | 3 kare hikâye — Misafir seçsin. |
| 22 | p10 | Instagram + Facebook | Kısa video — Hazırlık durumu görünür kalsın. |
| 23 | s07 | Instagram + Facebook | 3 kare hikâye — Mutfakta hangi sipariş bekliyor? |
| 24 | p11 | Instagram + Facebook | Kaydırmalı — Denemede bu üç akışı kontrol edin. |
| 25 | li04 | LinkedIn | Denemeyi bir kontrol listesine dönüştürün |
| 26 | p12 | Instagram + Facebook | Statik — İlk adım: kendi menünüz. |
| 27 | s08 | Instagram + Facebook | 3 kare hikâye — Menünüzle başlayın. |
| 7 / 14 / 21 / 28 | değerlendirme | iç çalışma | Haftalık ölçüm ve bir sonraki hafta düzeltmesi |
| 29–30 | rapor | iç çalışma | İlk ay karşılaştırması ve ikinci ay kararları |

## 12 ana içerik

### p01 · Gün 1 · Kaydırmalı

**Kapak:** QR menüyle başla.  
**Amaç:** Ürünün kapsamını tanıtmak. **Durum:** taslak.

**Paylaşım metni:**

Menünüz, masalarınız ve mutfağınız aynı işin parçaları. Masabu, kafe ve restoranlar için QR menüyü, personel siparişini, dijital adisyonu ve mutfak ekranını seçtiğiniz pakete göre bir araya getirir. Önce dijital menünüzle başlayın; ihtiyaçlarınıza göre operasyon özellikleriyle devam edin. Kart bilgisi vermeden 14 gün Pro özelliklerini deneyin.

**Görsel / kurgu:**

- Kapak: QR menüyle başla.
- QR menü: Ürünleri, fiyatları ve görünümü yönetin.
- Plus: Personel siparişini ve adisyonu masayla birlikte takip edin.
- Pro: QR siparişini ve mutfak ekranını ekleyin.
- Son kart: 14 gün Pro denemesi. Kart bilgisi gerekmez.

**Üretim kaynağı:** Gerçek mobil menüden bir ürün kartı ve izinli örnek verili masa ekranı. Ekran yoksa ilgili kartta yalnız metin ve simge; ürün arayüzü uydurulmaz.

**Facebook bağlantısı:** https://masabu.co/?utm_source=facebook&utm_medium=organic_social&utm_campaign=launch_30d&utm_content=p01

**Instagram yönlendirmesi:** profil bağlantısı; ilgili hikâye bağlantıları aşağıda.

### p02 · Gün 3 · Kısa video

**Kapak:** Misafirin gözünden Masabu  
**Amaç:** Ürünün somut kullanımını göstermek. **Durum:** taslak.

**Paylaşım metni:**

Misafiriniz menüyü telefonunda nasıl görüyor? Kategoriler, ürün açıklamaları, görseller ve seçenekler aynı menüde bir araya geliyor. QR menüyü incelemek için uygulama indirmek gerekmiyor. Kendi işletmenizin menüsünü Masabu’da oluşturup 14 günlük Pro denemesinde inceleyin.

**Görsel / kurgu:**

- 0–3 sn: Kapak — Misafirin gözünden Masabu.
- 3–9 sn: Örnek menüde kategori değiştir.
- 9–17 sn: Bir ürünü aç; açıklama ve tanımlı seçenekleri göster.
- 17–22 sn: Menüye dön; telefondaki görünümü göster.
- 22–27 sn: 14 gün Pro denemesi / Kart bilgisi gerekmez.

**Üretim kaynağı:** Örnek ürünler içeren gerçek mobil menü ekran kaydı. Seslendirme gerekmez; her adımın ekrandaki kısa yazısı altyazı olarak kullanılır.

**Facebook bağlantısı:** https://masabu.co/qr-menu?utm_source=facebook&utm_medium=organic_social&utm_campaign=launch_30d&utm_content=p02

**Instagram yönlendirmesi:** profil bağlantısı; ilgili hikâye bağlantıları aşağıda.

### p03 · Gün 5 · Statik

**Kapak:** 14 gün kendi menünle dene.  
**Amaç:** Deneme teklifini açıklamak. **Durum:** taslak.

**Paylaşım metni:**

Masabu’yu kendi işletmenizin ihtiyaçlarıyla değerlendirin. Yeni işletmeler 14 gün boyunca Pro özelliklerini kart bilgisi vermeden deneyebilir. Deneme sonunda devam etmek için ihtiyacınıza uygun ücretli planı seçebilirsiniz. Plan seçilmezse menü yayını ve ürün işlemleri kapanır; işletme verileri korunur. Paketleri ve güncel fiyatları inceleyin.

**Görsel / kurgu:**

- Ana başlık: 14 gün kendi menünle dene.
- Alt başlık: Pro özellikleri • Kart bilgisi gerekmez
- Alt bilgi: Deneme sonrası ücretli planla devam edilir.

**Üretim kaynağı:** Marka simgesi, krem zemin ve tek gerçek menü ekranı. Fiyat veya indirim yüzdesi görsele yazılmaz.

**Facebook bağlantısı:** https://masabu.co/fiyatlar?utm_source=facebook&utm_medium=organic_social&utm_campaign=launch_30d&utm_content=p03

**Instagram yönlendirmesi:** profil bağlantısı; ilgili hikâye bağlantıları aşağıda.

### p04 · Gün 8 · Kaydırmalı

**Kapak:** Menü güncellemesini kolaylaştırın.  
**Amaç:** QR menünün günlük kullanım değerini anlatmak. **Durum:** taslak.

**Paylaşım metni:**

Yeni ürün, değişen fiyat, güncel açıklama… Menü bilgileri işletmenizle birlikte değişir. Masabu’da ürünlerinizi ve kategorilerinizi panelden düzenleyebilir, yayınlanan menünün mobil görünümünü kontrol edebilirsiniz. QR menü ve zengin ürün içeriği Starter kapsamındadır. Nasıl çalıştığını inceleyin; kendi menünüzle deneyin.

**Görsel / kurgu:**

- Kapak: Menü güncellemesini kolaylaştırın.
- Ürün ve kategori: Menünüzü anlaşılır şekilde düzenleyin.
- Fiyat ve açıklama: Bilgileri panelden güncelleyin.
- Görünüm: Yayınlanan menüyü telefonda kontrol edin.
- Son kart: QR menü Starter’da. İlk 14 gün Pro denemesi.

**Üretim kaynağı:** Gerçek örnek menü ve ürün düzenleme ekranı. Kullanıcı adı, e-posta, bildirim ve işletme kimliği kırpılır.

**Facebook bağlantısı:** https://masabu.co/qr-menu?utm_source=facebook&utm_medium=organic_social&utm_campaign=launch_30d&utm_content=p04

**Instagram yönlendirmesi:** profil bağlantısı; ilgili hikâye bağlantıları aşağıda.

### p05 · Gün 10 · Kısa video

**Kapak:** Menünüz markanız gibi görünsün.  
**Amaç:** Tema düzenleme yeteneğini göstermek. **Durum:** taslak.

**Paylaşım metni:**

Menünüzde yalnızca ürünleriniz değil, markanız da görünsün. Masabu’da logo, renk, tipografi ve kart düzenleriyle menünüzün görünümünü düzenleyebilirsiniz. Değişikliklerin mobil önizlemesini kontrol ederek yayınlayın. Menü tasarımını kendi işletmeniz için deneyin.

**Görsel / kurgu:**

- 0–3 sn: Kapak — Menünüz markanız gibi görünsün.
- 3–10 sn: Örnek temada renk değiştir.
- 10–17 sn: Kart düzeni ve tipografi seçimini göster.
- 17–23 sn: Gerçek mobil önizlemeyi aç.
- 23–28 sn: Kendi menünle dene / masabu.co.

**Üretim kaynağı:** Gerçek tema editöründen örnek verili kayıt. Kaynak tur: docs/marketing/supademo/01-menu-theme.md. Yalnız kayıtta gerçekten değişen ayarlar gösterilir.

**Facebook bağlantısı:** https://masabu.co/qr-menu?utm_source=facebook&utm_medium=organic_social&utm_campaign=launch_30d&utm_content=p05

**Instagram yönlendirmesi:** profil bağlantısı; ilgili hikâye bağlantıları aşağıda.

### p06 · Gün 12 · Kaydırmalı

**Kapak:** Siparişten önce bilgi verin.  
**Amaç:** Ürün detaylarının kullanımını anlatmak. **Durum:** taslak.

**Paylaşım metni:**

Misafiriniz bir ürünü seçerken içeriğini de anlamak ister. Masabu menüsünde ürün görsellerini, açıklamaları, seçenekleri ve alerjen bilgilerini işletmeniz yönetir. Bilgileri güncel tutarak misafirin karar vermesine yardımcı olun. QR menüdeki ürün detaylarını inceleyin.

**Görsel / kurgu:**

- Kapak: Siparişten önce bilgi verin.
- Ürün görseli: Ne sunduğunuzu gösterin.
- Açıklama: İçeriği anlaşılır şekilde yazın.
- Seçenek ve alerjen: Gerçek ürün bilginizi ekleyin.
- Son kart: Menünüzün detaylarını siz yönetin.

**Üretim kaynağı:** public/product/about-product-flow.webp ve menu-customization.jpg görsellerinden uygun kırpımlar; alerjen bilgisi örnek olarak işaretlenir, sağlık güvencesi verilmez.

**Facebook bağlantısı:** https://masabu.co/qr-menu?utm_source=facebook&utm_medium=organic_social&utm_campaign=launch_30d&utm_content=p06

**Instagram yönlendirmesi:** profil bağlantısı; ilgili hikâye bağlantıları aşağıda.

### p07 · Gün 15 · Kaydırmalı

**Kapak:** Bir masa, takip edilebilir adisyon.  
**Amaç:** Plus operasyon kapsamını açıklamak. **Durum:** taslak.

**Paylaşım metni:**

Personel siparişi, açık adisyon ve tahsilat kaydı: masanın operasyonunu birlikte takip edin. Masabu Plus, personelin sipariş girmesini ve masa hesabını yönetmesini sağlar. Misafirin QR üzerinden sipariş vermesi ise Pro kapsamındadır. İşletmenizin ihtiyacına uygun akışı inceleyin.

**Görsel / kurgu:**

- Kapak: Bir masa, takip edilebilir adisyon.
- Masayı seçin: İşlemi doğru masadan başlatın.
- Siparişi girin: Ürün ve seçenekleri kontrol edin.
- Adisyonu izleyin: Hesabı ve tahsilat kaydını takip edin.
- Son kart: Personel siparişi ve adisyon — Plus.

**Üretim kaynağı:** Örnek verili gerçek Masalar/adisyon ekranları. Misafir sepeti görseli, personel adisyon ekranıymış gibi kullanılmaz.

**Facebook bağlantısı:** https://masabu.co/dijital-adisyon?utm_source=facebook&utm_medium=organic_social&utm_campaign=launch_30d&utm_content=p07

**Instagram yönlendirmesi:** profil bağlantısı; ilgili hikâye bağlantıları aşağıda.

### p08 · Gün 17 · Kısa video

**Kapak:** QR’dan masaya bağlı sipariş  
**Amaç:** Pro QR sipariş akışını göstermek. **Durum:** taslak.

**Paylaşım metni:**

Misafiriniz masaya ait QR koduyla menüyü açsın, ürünlerini seçsin ve siparişini göndersin. Masabu Pro’daki QR sipariş akışı, siparişi ilgili masayla ilişkilendirir. Online kart ödemesi ayrı bir iyzico eklentisidir; QR siparişle aynı özellik değildir. Akışı ürün sayfasından inceleyin.

**Görsel / kurgu:**

- 0–3 sn: Kapak — QR’dan masaya bağlı sipariş.
- 3–9 sn: Test masasının QR bağlantısını aç.
- 9–16 sn: Ürün seç, seçeneği belirle, sepeti göster.
- 16–23 sn: Test siparişini gönder; aynı siparişi örnek operasyon ekranında göster.
- 23–28 sn: QR sipariş Pro’da / 14 gün dene.

**Üretim kaynağı:** Yalnız test işletmesinde kayıt. Gerçek işletmeye sipariş gönderilmez. Aktif test akışı bulunamazsa çekim bekler; sahte gönderim animasyonu üretilmez.

**Facebook bağlantısı:** https://masabu.co/qr-siparis?utm_source=facebook&utm_medium=organic_social&utm_campaign=launch_30d&utm_content=p08

**Instagram yönlendirmesi:** profil bağlantısı; ilgili hikâye bağlantıları aşağıda.

### p09 · Gün 19 · Kaydırmalı

**Kapak:** Hangi paket, hangi ihtiyaç?  
**Amaç:** Paket seçimini kolaylaştırmak. **Durum:** taslak.

**Paylaşım metni:**

İhtiyacınız dijital menü mü, masa operasyonu mu, misafirin QR siparişi mi? Starter QR menüyle başlamak; Plus personel siparişi ve adisyon; Pro QR sipariş, mutfak ekranı ve gelişmiş operasyon için. Çok şubeli ihtiyaçlar Business kapsamında değerlendirilir. Güncel kapsam ve fiyatları karşılaştırın. İlk 14 gün Pro denemesinde kart bilgisi gerekmez.

**Görsel / kurgu:**

- Kapak: Hangi paket, hangi ihtiyaç?
- Starter: QR menü ve görünüm düzenleme.
- Plus: Personel siparişi, masa ve adisyon.
- Pro: QR sipariş, mutfak ekranı ve istasyonlar.
- Business: Çok şubeli işletmeler.
- Son kart: Güncel paket karşılaştırması masabu.co/fiyatlar.

**Üretim kaynağı:** Katalogdan hazırlanmış dört sade metin kartı; fiyat, POS uyumluluğu veya donanım dahil iddiası eklenmez.

**Facebook bağlantısı:** https://masabu.co/fiyatlar?utm_source=facebook&utm_medium=organic_social&utm_campaign=launch_30d&utm_content=p09

**Instagram yönlendirmesi:** profil bağlantısı; ilgili hikâye bağlantıları aşağıda.

### p10 · Gün 22 · Kısa video

**Kapak:** Hazırlık durumu görünür kalsın.  
**Amaç:** KDS kullanımını göstermek. **Durum:** taslak.

**Paylaşım metni:**

Sipariş masadan mutfağa geçtiğinde hazırlık durumunu takip etmek gerekir. Masabu Pro’daki mutfak ekranı ve istasyonlar, ekibin bekleyen siparişleri görmesine ve durumlarını güncellemesine yardımcı olur. Kendi operasyonunuz için mutfak akışını inceleyin.

**Görsel / kurgu:**

- 0–3 sn: Kapak — Hazırlık durumu görünür kalsın.
- 3–10 sn: Örnek siparişi gerçek KDS ekranında göster.
- 10–19 sn: İlgili hazırlık durumunu güncelle.
- 19–25 sn: Aynı siparişin operasyon ekranındaki durumunu göster.
- 25–30 sn: Mutfak ekranı ve istasyonlar Pro’da.

**Üretim kaynağı:** Örnek verili gerçek KDS çekimi gerekir. Mevcut after/03-kitchen-sync.svg yalnız akış çizimidir, KDS ekran kaydı yerine kullanılmaz. Gerçek kayıt hazır olmadan video yayınlanmaz.

**Facebook bağlantısı:** https://masabu.co/mutfak-ekrani?utm_source=facebook&utm_medium=organic_social&utm_campaign=launch_30d&utm_content=p10

**Instagram yönlendirmesi:** profil bağlantısı; ilgili hikâye bağlantıları aşağıda.

### p11 · Gün 24 · Kaydırmalı

**Kapak:** Denemede bu üç akışı kontrol edin.  
**Amaç:** Denemeyi anlamlı ürün kullanımına yönlendirmek. **Durum:** taslak.

**Paylaşım metni:**

Bir yazılımı işletmenizin gerçek ihtiyaçlarıyla değerlendirin. Masabu denemenizde önce örnek menünüzü telefonda açın. Ardından personel siparişi ve adisyonu deneyin. Son olarak ihtiyacınız varsa QR sipariş ve mutfak ekranını test verileriyle inceleyin. 14 günlük Pro denemesi, bu akışları birlikte değerlendirmeniz için.

**Görsel / kurgu:**

- Kapak: Denemede bu üç akışı kontrol edin.
- 1 — Menünüz: Ürün, fiyat ve mobil görünüm.
- 2 — Masanız: Personel siparişi ve adisyon.
- 3 — Mutfağınız: QR sipariş ve hazırlık takibi.
- Son kart: Kendi iş akışınıza göre değerlendirin.

**Üretim kaynağı:** Üç gerçek ürün ekranından kırpım veya numaralı kontrol listesi. Örnek siparişler ve test verileri kullanılır.

**Facebook bağlantısı:** https://masabu.co/fiyatlar?utm_source=facebook&utm_medium=organic_social&utm_campaign=launch_30d&utm_content=p11

**Instagram yönlendirmesi:** profil bağlantısı; ilgili hikâye bağlantıları aşağıda.

### p12 · Gün 26 · Statik

**Kapak:** İlk adım: kendi menünüz.  
**Amaç:** Doğrudan deneme kaydına yönlendirmek. **Durum:** taslak.

**Paylaşım metni:**

Masabu ile başlamanın ilk adımı, işletmenizin menüsünü oluşturmak. Ürünlerinizi ekleyin, görünümü düzenleyin ve telefonunuzdan kontrol edin. İhtiyacınıza göre personel siparişi, adisyon ve mutfak akışını da deneyin. Kart bilgisi vermeden 14 gün Pro denemesine başlayın.

**Görsel / kurgu:**

- Ana başlık: İlk adım: kendi menünüz.
- Alt başlık: 14 gün Pro denemesi
- Alt bilgi: Kart bilgisi gerekmez.

**Üretim kaynağı:** Gerçek menü ekranı, marka simgesi, krem zemin ve tek yeşil CTA. Kayıt formunda kişisel veri gösterilmez.

**Facebook bağlantısı:** https://app.masabu.co/auth/signup?utm_source=facebook&utm_medium=organic_social&utm_campaign=launch_30d&utm_content=p12

**Instagram yönlendirmesi:** profil bağlantısı; ilgili hikâye bağlantıları aşağıda.

## 8 hikâye seti

Her set üç kareden oluşur; kaynak ana içeriğin görsel dili ve gerçek ekran kırpımları yeniden kullanılır. Son karede bağlantı etiketi ve belirtilen CTA bulunur.

### s01 · Gün 2 · Kaynak p01

**Durum:** taslak. **Amaç:** ilgili ürün sayfasına geçiş. **Kapak:** Masabu ile neyi birlikte yönetebilirsiniz?

1. Masabu ile neyi birlikte yönetebilirsiniz?
2. QR menü → sipariş → adisyon → mutfak
3. Ürünü inceleyin.

Instagram: https://masabu.co/?utm_source=instagram&utm_medium=organic_social&utm_campaign=launch_30d&utm_content=s01

Facebook: https://masabu.co/?utm_source=facebook&utm_medium=organic_social&utm_campaign=launch_30d&utm_content=s01

### s02 · Gün 6 · Kaynak p03

**Durum:** taslak. **Amaç:** ilgili ürün sayfasına geçiş. **Kapak:** 14 gün Pro denemesi

1. 14 gün Pro denemesi
2. Kart bilgisi gerekmez. Deneme sonrası ücretli planla devam edilir.
3. Paketleri inceleyin.

Instagram: https://masabu.co/fiyatlar?utm_source=instagram&utm_medium=organic_social&utm_campaign=launch_30d&utm_content=s02

Facebook: https://masabu.co/fiyatlar?utm_source=facebook&utm_medium=organic_social&utm_campaign=launch_30d&utm_content=s02

### s03 · Gün 9 · Kaynak p04

**Durum:** taslak. **Amaç:** ilgili ürün sayfasına geçiş. **Kapak:** Menünüzde en son neyi güncellediniz?

1. Menünüzde en son neyi güncellediniz?
2. Fiyat, açıklama ve ürünleri panelden düzenleyin.
3. QR menüyü keşfedin.

Instagram: https://masabu.co/qr-menu?utm_source=instagram&utm_medium=organic_social&utm_campaign=launch_30d&utm_content=s03

Facebook: https://masabu.co/qr-menu?utm_source=facebook&utm_medium=organic_social&utm_campaign=launch_30d&utm_content=s03

### s04 · Gün 13 · Kaynak p06

**Durum:** taslak. **Amaç:** ilgili ürün sayfasına geçiş. **Kapak:** Ürün fotoğrafının yanında hangi bilgi var?

1. Ürün fotoğrafının yanında hangi bilgi var?
2. Açıklama, seçenek ve alerjen bilgilerini siz yönetin.
3. Ürün detaylarını inceleyin.

Instagram: https://masabu.co/qr-menu?utm_source=instagram&utm_medium=organic_social&utm_campaign=launch_30d&utm_content=s04

Facebook: https://masabu.co/qr-menu?utm_source=facebook&utm_medium=organic_social&utm_campaign=launch_30d&utm_content=s04

### s05 · Gün 16 · Kaynak p07

**Durum:** taslak. **Amaç:** ilgili ürün sayfasına geçiş. **Kapak:** Sipariş hangi masaya ait?

1. Sipariş hangi masaya ait?
2. Personel siparişi ve adisyonu birlikte takip edin.
3. Dijital adisyonu inceleyin.

Instagram: https://masabu.co/dijital-adisyon?utm_source=instagram&utm_medium=organic_social&utm_campaign=launch_30d&utm_content=s05

Facebook: https://masabu.co/dijital-adisyon?utm_source=facebook&utm_medium=organic_social&utm_campaign=launch_30d&utm_content=s05

### s06 · Gün 20 · Kaynak p08

**Durum:** taslak. **Amaç:** ilgili ürün sayfasına geçiş. **Kapak:** Misafir seçsin.

1. Misafir seçsin.
2. Sipariş masaya bağlansın. QR sipariş Pro kapsamındadır.
3. Akışı inceleyin.

Instagram: https://masabu.co/qr-siparis?utm_source=instagram&utm_medium=organic_social&utm_campaign=launch_30d&utm_content=s06

Facebook: https://masabu.co/qr-siparis?utm_source=facebook&utm_medium=organic_social&utm_campaign=launch_30d&utm_content=s06

### s07 · Gün 23 · Kaynak p10

**Durum:** taslak. **Amaç:** ilgili ürün sayfasına geçiş. **Kapak:** Mutfakta hangi sipariş bekliyor?

1. Mutfakta hangi sipariş bekliyor?
2. Hazırlık durumlarını Pro mutfak ekranında takip edin.
3. Mutfak ekranını keşfedin.

Instagram: https://masabu.co/mutfak-ekrani?utm_source=instagram&utm_medium=organic_social&utm_campaign=launch_30d&utm_content=s07

Facebook: https://masabu.co/mutfak-ekrani?utm_source=facebook&utm_medium=organic_social&utm_campaign=launch_30d&utm_content=s07

### s08 · Gün 27 · Kaynak p12

**Durum:** taslak. **Amaç:** ilgili ürün sayfasına geçiş. **Kapak:** Menünüzle başlayın.

1. Menünüzle başlayın.
2. 14 gün Pro deneyin. Kart bilgisi gerekmez.
3. Ücretsiz denemeyi başlatın.

Instagram: https://app.masabu.co/auth/signup?utm_source=instagram&utm_medium=organic_social&utm_campaign=launch_30d&utm_content=s08

Facebook: https://app.masabu.co/auth/signup?utm_source=facebook&utm_medium=organic_social&utm_campaign=launch_30d&utm_content=s08

## 4 LinkedIn uyarlaması

Ana içeriğin kapak görseli kullanılır; metin LinkedIn için aşağıdaki haliyle hazırlanır. Her birinin amacı ürün incelemesi üzerinden denemeye yönlendirmektir. Durumları taslaktır.

### li01 · Gün 4 · Kaynak p01

**Kapak:** QR menüden operasyon yönetimine

Kafe ve restoranlarda menüyü dijitalleştirmek, günlük operasyonun yalnızca bir parçası. Siparişin doğru masayla ilişkilendirilmesi, adisyonun takip edilmesi ve mutfağın hazırlık durumunu görmesi de aynı sürecin devamı.

Masabu, bu ihtiyaçları seçilen pakete göre tek web tabanlı sistemde bir araya getiriyor. QR menüyle başlayabilir, personel siparişi ve adisyonla devam edebilir, QR sipariş ve mutfak ekranını Pro kapsamında kullanabilirsiniz.

Yeni işletmeler için 14 gün Pro denemesi var; kart bilgisi gerekmiyor. Ürün akışını inceleyin.

https://masabu.co/?utm_source=linkedin&utm_medium=organic_social&utm_campaign=launch_30d&utm_content=li01

### li02 · Gün 11 · Kaynak p04

**Kapak:** Dijital menü, yaşayan bir içerik

Fiyatlar, ürün seçenekleri ve açıklamalar değiştiğinde menü de güncel kalmalı. Dijital menünün değeri, yalnızca bir QR kod üretmekten ibaret değil; işletmenin içeriği yönetebilmesinde.

Masabu’da ürün ve kategorileri panelden düzenleyebilir, logo ve görünümü markanıza uyarlayabilir, yayınlanan menüyü mobilde kontrol edebilirsiniz. QR menü ve temel görünüm düzenleme Starter kapsamındadır.

Kendi menünüzü 14 günlük Pro denemesinde değerlendirebilirsiniz.

https://masabu.co/qr-menu?utm_source=linkedin&utm_medium=organic_social&utm_campaign=launch_30d&utm_content=li02

### li03 · Gün 18 · Kaynak p09

**Kapak:** Paket seçimini iş akışından başlatın

Restoran yazılımı seçerken önce hangi akışı yönetmek istediğinizi belirleyin.

Dijital menü: Starter. Personel siparişi, masa ve adisyon: Plus. QR sipariş ve mutfak ekranı: Pro. Çok şubeli ihtiyaçlar: Business.

Personelin tahsilat kaydı ile misafirin online kart ödemesi farklı özelliklerdir. Masabu’da iyzico online ödeme ayrıca sunulan bir Pro eklentisidir.

Güncel paket karşılaştırmasını inceleyin; 14 günlük Pro denemesinde ihtiyaç duyduğunuz akışları test edin.

https://masabu.co/fiyatlar?utm_source=linkedin&utm_medium=organic_social&utm_campaign=launch_30d&utm_content=li03

### li04 · Gün 25 · Kaynak p11

**Kapak:** Denemeyi bir kontrol listesine dönüştürün

Bir ürün denemesinden yarar sağlamak için hangi akışları kontrol edeceğinizi baştan belirleyin.

Masabu için üç başlangıç adımı: Menüyü telefonda açıp ürün bilgilerini inceleyin. Personel siparişi ve adisyon akışını deneyin. İhtiyacınız varsa QR sipariş ve mutfak ekranını örnek verilerle kontrol edin.

Yeni işletmeler bu özellikleri 14 gün Pro denemesinde kart bilgisi vermeden değerlendirebilir. İşletmenizin günlük ihtiyaçlarına uygunluğu, kendi kullanımınız üzerinden görün.

https://masabu.co/fiyatlar?utm_source=linkedin&utm_medium=organic_social&utm_campaign=launch_30d&utm_content=li04

## Ölçüm, haftalık karar ve teslim kontrolü

| Dönem | Yapılacak | Kaynak |
| --- | --- | --- |
| Gün 0–7 | Profil takipçi/erişim değerleri, mevcut deneme/kayıt sayıları ve tarih aralığı kaydedilir. Bilinmeyen değer “veri yok” olur, sıfır yazılmaz. | Meta/LinkedIn istatistikleri, mevcut işletme kayıtları |
| Gün 7 / 14 / 21 / 28 | İçerik başına erişim, bağlantı tıklaması, kaydetme ve gelen nitelikli talepler karşılaştırılır. Video izlenme metriği platform tanımıyla kaydedilir. | Kanalın kendi raporu |
| Gün 30 | En çok nitelikli ilgi ve doğrulanabilir deneme sağlayan konu/biçimler belirlenir. Veri azsa “sonuç için yetersiz” olarak işaretlenir. | Haftalık kayıtlar; GA4 yalnız etkin ve izinli veri varsa |

Basit haftalık kayıt alanları: tarih aralığı, kanal, içerik ID, erişim, bağlantı tıklaması, yeni takipçi, nitelikli talep, toplam yeni kayıt, toplam yeni deneme, hariç tutulan test sayısı, kaynak bağlantısı ve not. Platform toplamları tekil kişiymiş gibi toplanmaz. Kanalın denemeye katkısı kanıtlanamıyorsa toplam deneme sayısı ayrı raporlanır.

İlk ay sayısal büyüme hedefi konmaz. Bir sonraki hafta, benzer biçimlerde daha çok bağlantı tıklaması veya nitelikli talep getiren konuya ağırlık verilir; tek gönderiden nedensellik sonucu çıkarılmaz.

Üretimden önce: 12 ana içerik = 6 kaydırmalı + 4 kısa video + 2 statik; 8 hikâye = 24 kare; 4 LinkedIn metni. Her öğede gün, kapak, amaç, metin, kaynak ve yönlendirme vardır. Gerçek ekran üretimi, son kullanıcı onayı ve platform planlaması ayrıca tamamlanır. Açık hesap/teknik işler: [yayın durum kaydı](launch-readiness-2026-09-10/README.md).
