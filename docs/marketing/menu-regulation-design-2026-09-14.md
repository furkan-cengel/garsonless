# Menü mevzuatı sayfası — görsel yenileme

## Kapsam

- Rota: `/menu-alerjen-zorunlulugu`.
- QR Menü / QR Sipariş sayfalarının 640×480 SVG, ince koyu yeşil çizgi,
  kırık beyaz ve açık yeşil paleti korundu. Yeni bağımlılık eklenmedi.
- Üç yerel SVG: `menu-regulation.svg`, `menu-regulation-details.svg`,
  `menu-regulation-workflow.svg`.
- Giriş çizimi + kompakt tarih bandı; ürün detayı + 14 alerjen listesi;
  panel → aynı QR → misafir menüsü iş akışı.
- Çizimler temsili; gerçek ekran görüntüsü veya resmî uygunluk belgesi değildir.
- Mevcut sitemap ve footer bağlantısı korundu. QR Menü ve QR Sipariş bağlantıları eklendi.
- 800 px ve altında tek sütun. Takvim dar ekranda kendi alanında yatay kaydırılır;
  bölge klavyeyle odaklanabilir. CTA alanları en az 44 px.
- Sayaç Türkiye takvimini kullanır; son gün ve geçmiş tarih ayrılır.
  Sayfa yeniden doğrulama süresi 3600 saniye; sayaç deploy tarihine sabitlenmez.

## İçerik kontrolü

Önceki başlıktaki alerjen bildiriminin yeni başlayacağı izlenimi kaldırıldı.
[Bakanlık açıklaması](https://guvenilirgida.tarimorman.gov.tr/Haber/Detay/17279)
alerjen bildirimini 1 Ocak 2020'den itibaren zorunlu olarak açıklıyor.

2026–2027 uyum takvimi ile karekod yanında görünür bilgilendirme gereği,
[İzmir Ticaret Borsası'nın Bakanlık yazısını aktaran duyurusuna](https://itb.org.tr/Duyuru/3155-turk-gida-kodeksi-gida-etiketleme-ve-tuketicileri-bilgilendirme-yonetmeligi-uyum-sureleri)
bağlandı. Bilgilendirme/hukuki görüş ayrımı sayfada tutuldu.
Tam mevzuat uyumu sertifikalandırılmadı; işletme kapsamı ayrıca teyit edilmeli.

## Doğrulama

- Marketing: 46/46 test, lint ve typecheck başarılı.
- Üretim derlemesi: başarılı; rota 1 saat yeniden doğrulamayla üretildi.
- Gerçek sayfada Chromium: 320, 393, 430, 800, 1024, 1440 px;
  taşma yok, üç çizim yüklendi, 14 alerjen mevcut, CTA/anchor/SSS çalışıyor.
- Kalıcı Playwright dosyası `tests/marketing-readiness/menu-regulation.spec.ts`:
  üretim derlemesinde 7/7 başarılı (klavye, mobil, metadata, sitemap dahil).
- Görsel inceleme: masaüstü giriş / alerjen / iş akışı ve mobil giriş / alerjen.
- Test kanıtları: `/tmp/masabu-regulation-design.Ar2uVI/`.

Üretim derlemesi açık 3003 geliştirme sunucusunu etkilememek için geçici kopyada
çalıştırıldı; `.env` dosyaları kopyalanmadı. Bu nedenle yerel build'de destek
telefonu yayın-kapısı uyarısı vardı; canlı ortam konfigürasyonu doğrulanmış sayılmaz.
Mevcut ProductLandingPage CSS'inde `align-items: end` için bloklamayan
autoprefixer uyarısı var; referans sayfalar bu çalışmada değiştirilmedi.

## Yayın durumu

Marketing üretim hedefi ve kamuya açık destek telefonu 14 Eylül'de doğrulandı.
Depo genelindeki `pnpm check:ci` başarılı. Tasarım, DEV gerçek Auth/MFA testleri
ve yedekli PROD migration'ı ayrıca tamamlanan platform-admin hesap yönetimiyle
birlikte yayınlanmak üzere hazırlandı. Dağıtım ve canlı smoke sonuçları ayrı
yayın kaydına yazılacak.

Mevcut `LEGAL_DOCS_APPROVED` bayrağı true değil; bu çalışmada değiştirilmedi.
Sayfa tasarımı ve teknik yayın testi, hukukçu onayının yerine geçmez.
