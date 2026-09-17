# ADR 0005 — Reçeteli stok ve tüketim bütünlüğü

Durum: Uygulandı, yerel doğrulama; üretim yayını yapılmadı.
Tarih: 2026-09-17

## Kararlar

- Tek işletme/şube; Pro, Pro denemesi ve Business. Yeni `inventory` ekip yetkisi. Sayım onayı, düzeltme, tüketim iadesi ve takip açma/kapama işletme sahibi veya mevcut Business yönetici rolünde.
- Miktar ve maliyet PostgreSQL `numeric`; giriş sözleşmeleri ondalık metin. Temel birimler g, ml, adet. Özel paket dönüşümü stok kartına aittir. Kütle/hacim dönüşümü yapılmaz.
- Değiştirilemez hareket ve belge defteri; güncel bakiye aynı transaction içinde güncellenir. İade, kaynak hareket referanslı pozitif harekettir. Negatif miktar satışı engellemez.
- QR siparişi oluşturulurken reçete sabitlenir, ilk mutfak kabulünde düşülür. Personel siparişi doğrudan kabul edilir. Hazırlık başladığı kalıcı tutulur. Ödeme ve finansal iade stok olayı değildir.
- Hazırlık öncesi iptal iade; hazırlık sonrası iptal tüketimi korur ve iptal firesi görünümüne girer. Sonradan fiziksel iade sınırlı miktarla ve gerekçeyle yapılır.
- Sipariş satırının köken kimliği kısmi masa taşımada korunur. Özel tahsis tablosu mevcut siparişe düşen miktarı tutar. Transfer ve geri alma stok hareketi yaratmaz. Kaynak ve hedefin tüketim/hazırlık durumları ayrıştıysa geri alma atomik olarak reddedilir; farklı hazırlık durumları tek satıra birleştirilmez.
- Reçeteler sürümlüdür. Üretimde gerçekleşen girdiler düşer, çıktı artar; satışta yarı mamul tekrar hammaddelere açılmaz. Reçete döngüleri reddedilir.
- Sayım satırı bakiye sürümü ve taslak sürümü karşılaştırılır. Boş sayılmadı, sıfır yok anlamındadır. Çatışmada eski sayım yeni hareketi ezmez.
- Maliyet hareketli ağırlıklı ortalamadır; negatif stokta son bilinen maliyet geçicidir. Eksik maliyet bilinmiyor olarak taşınır. Rapor finansal kâr raporu değildir.
- Takip başlangıcından eski siparişlere geriye dönük tüketim yoktur. Paket erişimi kaybında yeni takip durur. Oluşmuş tüketimlerin iptal uzlaştırması devam eder. Yeniden açma güncel stok teyidi gerektirir.

## Sınırlar

Harici POS, çoklu depo/şube, satın alma/cari, lot/SKT, OCR, çevrimdışı senkronizasyon ve otomatik satış engelleme bu sürümde yoktur. Plan fiyatları ve ödeme sağlayıcısı değişmez.

## Uygulama ve doğrulama

Ayrıntılar: [uygulama kaydı](../inventory/recipe-stock-2026-09-17/README.md).
