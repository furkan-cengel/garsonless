# Masabu P01 — Meta yükleme düzeltmesi

Kullanıcının Meta Business Suite ekranı, önceki 1092×1440 dosyalar için otomatik kırpma uyarısı gösterdi. Bu sette tuval oranı, ekranda belirtilen 4:5–1.91:1 aralığına göre kontrol edilir.

Yerleşik image_gen aracıyla 4:5 tuval istendi; amaç metni, logoyu ve çizimleri kırpmadan korumak, yanlardaki krem zemini genişletmek. Üretimin gerçek ölçüleri ve oranları `verification.json` dosyasında kayıtlıdır. Kaynaklar değiştirilmez.

**Doğrulanan teslim:** Beş PNG de **1122×1402**; en/boy oranı **0.8002853**. Ekrandaki minimum 4:5 (0.8) ile maksimum 1.91:1 arasında. Dosya ölçüsü 1080×1350 olarak iddia edilmez. Başlıklar, Türkçe metinler, sayfa numaraları ve alt bilgiler görsel olarak kontrol edildi. Görseller yeniden üretim içerdiğinden kaynakla piksel-birebir eşitlik iddia edilmez.

## Yükleme

1. Mevcut gönderi taslağındaki eski beş görseli kaldırın; gönderi metnini koruyun.
2. Bu klasördeki 01 → 05 sıralı yeni PNG dosyalarını yükleyin.
3. Otomatik kırpma uyarısının kalktığını ve hem Instagram hem Facebook önizlemelerinde yazıların tam olduğunu kontrol edin.
4. Son yayın işlemi kullanıcıya aittir. Bu çalışma sırasında hesaplara girilmedi ve yayın yapılmadı.

Önceki açıklamalar ve alternatif metinler, ilk teslimin `README.md` dosyasında aynen geçerlidir. Teknik dosya oranı kontrolü, Meta üzerinde gerçek yükleme testi olarak sunulmaz.
