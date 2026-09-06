# Müşteriler yayın doğrulaması · 6 Eylül 2026

İlk commit grupları: `9c0559a` ürün düzeltmeleri; `39983c7` audit ve doğrulama belgeleri. Kullanıcı bu turda commit, push ve production deploy istedi.

Uzak build kontrolleri ilk yayında CustomersClientBoundary için eski dinamik import kaydını bulamadı. Gerçek build ölçümü doğrudan importta ilk paketin 230.580 baytla 133.311 baytlık sınırı aştığını gösterdi. Yalnız ana bileşeni ayırmak 179.309 bayta indi; taslak sağlayıcısı da aynı client paketine taşınınca ilk yükleme sınır içine döndü. SSR kapatılmadı ve bütçe eşikleri değiştirilmedi.

Son yerel doğrulama:

- Dashboard production build başarılı; SSR açık, CustomersClient ayrı pakette, kampanya kullanıcı eylemiyle yükleniyor.
- On kritik rotanın gerçek build bütçesi geçti. Müşteriler: initial 129,1 / 133,3 kB gzip; ready 300,9 / 313,8 kB. Tam kayıt: `release-bundle-budget.json`.
- Etkilenen müşteri/taslak testleri: 26 geçti. Bundle ölçüm testleri: 3 geçti. İlk uygulamadaki kapsamlı 87 test ve check:ci sonuçları ayrı kayıtlarda korunuyor.
- İlk uzak Architecture CI `39983c7` için başarılı. Public Quality mobil performans kapıları başarısız; önceki committe de aynı kapılar başarısızdı. Eski görsel/runtime başarısızlıklarını bu sürümde çözülmüş saymıyoruz.

Production hedef ve alan adı eşleşmeleri yayın sonunda `/tmp/customers-production-release-20260906.json` dosyasına kaydedilecek. Geri dönüş referansları `/tmp/customers-release-rollback.json` içinde. Production veri tabanı şeması, gerçek müşteri verisi, kampanya veya ödeme değişikliği yapılmadı.
