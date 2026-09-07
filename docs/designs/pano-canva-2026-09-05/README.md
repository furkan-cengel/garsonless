# Masabu Pano — Canva tasarım çalışması

Tarih: 5 Eylül 2026. Kapsam: Pano için görsel yön ve etkileşim prototipi. Ürün kodu değişikliği değildir.

Canva çalışma dosyası: https://www.canva.com/design/DAHUVpMZgrg/lhysrNG7iamFat8M_P1taA/edit

## Mevcut ekranın değerlendirmesi

1. **Öncelik tekrarı:** Aynı eski masa oturumu üstte dikkat alanında, KPI içinde ve dikkat gereken masalar listesinde gösteriliyor. Tek bir müdahale listesi tekrarları azaltabilir.
2. **Alan dağılımı:** Canlı bağlantı bilgisi ayrı büyük kartta yer alıyor. Bağlı durumda üst çubukta küçük bir gösterge yeterli; bağlantı sorunu olduğunda görünür bir uyarıya dönüşmeli.
3. **Navigasyon:** Masaüstünde yalnız ikonlardan oluşan dar menü, yeni kullanıcı için bölüm adlarını keşfetmeyi zorlaştırabilir. Etiketli ve gruplanmış bir sol menü öneriliyor.
4. **Görsel ağırlık:** Siyah ciro kartı, diğer operasyonel göstergelerden daha baskın. Beyaz KPI kartları ve ölçülü marka vurgusu daha dengeli bir hiyerarşi sağlayabilir.
5. **Mobil sıralama:** Dar görünümde dört KPI art arda uzuyor; operasyon listesi aşağıda kalıyor. Sığan genişliklerde iki sütunlu kısa KPI grubu ve müdahaleleri önceleyen içerik sırası öneriliyor.

Kanıtlar bu oturumda alınmıştır: `01-pano-mobile-before.png`, `02-pano-desktop-before.png`. Test restoranının boş ve eski oturum içeren durumu incelendi. Bu gözlemler kullanıcı araştırması veya kapsamlı erişilebilirlik uygunluk testi yerine geçmez.

## Korunan temeller

- Tahsil edilen ciro ve açık hesap birbirinden ayrı tutulur.
- Marka yeşili `#2F6F4E`, nötr arka plan `#F6F6F7`, beyaz yüzey, ana metin `#111113` korunur.
- Sipariş, masa ve tahsilat operasyonları ilk ekranın merkezindedir.
- Türkçe, kısa ve eylem odaklı metinler kullanılır.

## Tasarım yönü

- Etiketli sol navigasyon; operasyon ve yönetim grupları.
- Dört dengeli KPI; güçlü sayılar ve ikincil yardımcı metinler.
- Servis akışı ve müdahale bekleyenler ana çalışma alanını oluşturur.
- Tahsilat grafiği ve ürün performansı ikincil analitik katmanında bulunur.
- 8 px boşluk ritmi, 12 px kart yarıçapı, ince kenarlık ve hafif gölge.
- Mobilde alt navigasyon, kompakt göstergeler ve önce müdahale listesi.

Canva prototipindeki işletme, tutarlar ve siparişler örnek veridir. Üretim veritabanına bağlı değildir. Gerçek uygulamaya aktarımda mevcut yetki, tenant izolasyonu, plan hakları, hata kurtarma ve işlem güvenliği davranışları korunmalıdır.

## Doğrulama

Canva oluşturma ve görsel/etkileşim kontrolü devam ediyor. Sonuçlar tamamlandıkça bu bölüme eklenecek.
