# Supademo 01 — Menü & Tema

Bu demo, bir ürünü operasyon için eksiksiz hale getirip markalı QR menüde canlı önizlemeye kadar götürür. Kayıt tenant'ı gerçek `maf-lounge` verisinden ayrıdır ve her prova öncesi aynı duruma döner.

## 1. Kayıt ortamını hazırla

Repo kökünden çalıştır:

```bash
pnpm --filter @garsonless/db prepare:supademo-menu-theme -- --apply
```

Komut yalnız `maf-lounge-demo` tenant'ını sıfırlar. Ardından terminalde kayıt URL'lerini ve doğrulama sonucunu verir. Veri değiştirmeden kontrol etmek için:

```bash
pnpm --filter @garsonless/db prepare:supademo-menu-theme
```

Dashboard `3000`, menü `3011` portunda açık olmalı. Kayıt çözünürlüğü `1280×800`, tarayıcı zoom'u `%100` olmalı. Bildirimleri, hata balonlarını ve geliştirici araçlarını kapat.

## 2. Supademo bölümleri

### Bölüm 1 — Ürünü operasyon için hazırla

Başlangıç: Dashboard menü ekranında `Kahvaltı` kategorisi açık.

1. `Menemen` kartını seç.
   - Balon: **Ürünü tek yerden yönetin**
   - Açıklama: Fiyat, istasyon, içerik ve görünürlük aynı panelde.
2. Mutfak istasyonunun `Mutfak` olduğunu göster.
   - Balon: **Doğru istasyona otomatik yönlensin**
3. Satış fiyatını vurgula.
   - Balon: **Fiyat ve maliyeti birlikte izleyin**

### Bölüm 2 — İçerik ve tercihleri tanımla

4. İçindekiler alanına ilerle.
   - Balon: **İçerik bilgisini netleştirin**
5. `Pişirme tercihi` grubunu aç.
   - Balon: **Her ürüne uygun seçenekler ekleyin**
6. `Ekstralar` grubunu göster.
   - Balon: **Ek satış fırsatını ürüne bağlayın**

### Bölüm 3 — Güven ve keşif ekle

7. Alerjen ve besin alanını göster.
   - Balon: **Misafirin kararını kolaylaştırın**
8. `Taze Portakal Suyu` önerisini göster.
   - Balon: **İlgili ürünlerle sepeti büyütün**
9. Ürünün yayında durumunu doğrula.
   - Balon: **Hazır olduğunda tek dokunuşla yayınlayın**

### Bölüm 4 — Markalı menüde sonucu gör

10. Tema düzenleyiciyi aç.
    - Balon: **Menünüz markanız gibi görünsün**
11. Vurgu rengini değiştir ve canlı önizlemeyi göster.
    - Balon: **Değişiklikleri yayınlamadan önce görün**
12. Mobil ve masaüstü önizleme arasında geçiş yap.
    - Balon: **Her ekranda güvenle kontrol edin**

## 3. Supademo ayarları

- Demo adı: `Menünüzü tek panelden hazırlayın`
- Kapak: Tema düzenleyicide Menemen kartı görünürken alınan temiz kare
- Bölümler: yukarıdaki dört bölüm
- Otomatik ilerleme: kapalı; kullanıcı kontrollü
- Hotspot rengi: Masabu yeşili
- Son CTA: `14 gün ücretsiz dene`
- CTA hedefi: dashboard kayıt adresi
- Ses: ilk sürümde kapalı; önce görsel akışı onayla
- Kişisel veri maskeleme: e-posta, kullanıcı adı, URL tokenları ve hata/issue balonları

## 4. Kayıt kontrol listesi

- Menemen görseli, içerikleri, iki tercih grubu ve alerjen bilgileri eksiksiz.
- Taze Portakal Suyu önerisi görünür.
- `Masa 5`, `Mutfak` ve `Bar` kayıtları mevcut.
- Tema başlangıçta Masabu yeşili ve iki kolonlu kart düzeninde.
- Hiçbir adım kaydetme hatası, toast, skeleton veya yüklenme sıçraması içermiyor.
- Hotspot metinleri mobilde de iki satırı aşmıyor.
- Kayıttan sonra hazırlık komutu yeniden çalıştırıldığında aynı başlangıç durumu oluşuyor.
