# Masabu Sadakat pilotu

Bağımsız ürün aynı müşteri kimliğini ve `loyalty_transactions` defterini kullanır. Ürün erişimi `restaurant_product_access` içindeki süreli `sadakat` kaydıdır; restoran planını veya diğer ücretli özellikleri değiştirmez.

## Kullanım

- İşletme: dashboard uygulamasında `/sadakat`. Mevcut işletme seçilebilir veya `/sadakat/kurulum` üzerinden menüsüz işletme oluşturulabilir. Hesap oluşturma/giriş bağlantısına `next=/sadakat/kurulum` eklenebilir.
- Operatör: platform-admin işletme detayındaki **Masabu Sadakat pilotu** formundan başlangıç, bitiş ve gerekçe kaydeder. Aktif `ops`/`superadmin` ve mevcut MFA sınırı gerekir. Varsayılan 30 gündür; aynı form süreyi uzatabilir veya bitişi geçmişe alarak erişimi sonlandırabilir.
- Sahip: `/sadakat/[restaurantId]` üzerinden kartını yayınlar ve yalnız `sadakat` yetkili personel davet eder. Personel ana Masabu bölümlerine erişim kazanmaz. Mevcut daha geniş yetkili personel durumu ana panelden yönetilir.
- Müşteri: müşteri uygulamasındaki `/sadakat/[slug]` bağlantısından e-posta koduyla giriş yapar, katılır ve **Kasada göster** üzerinden iki dakika geçerli QR/kod oluşturur. Her yeni kod önceki kodu geçersiz kılar.
- Personel: QR’ı kamerayla okutur veya aynı kodu elle yazar. Uygun ürün adedi 1–20’dir; otomatik damga verilmediğini onaylar. Bir ödül kullanımında hedef kadar damga düşülür; fazla damga korunur.
- Sahip yanlış manuel işlemi gerekçeli ters kayıtla geri alır. Harcanmış damgaların ters kaydı bakiyeyi negatife düşüremez. Eski işlem silinmez.

İlk damgadan sonra hedef kilitlenir. Eski Masabu ayarlarının hedefi/kapsamı değiştirmesi de veritabanında engellenir. Ağ kapsamındaki eski kartlar bu tek işletme pilotuna otomatik çevrilmez. Doğrulanmış kimlik birleştirmeleri üyelik ve manuel işlem öznelerini de hayatta kalan müşteriye taşır.

Pilot bitince yeni katılım, kod üretimi ve bakiye işlemleri durur. Mevcut üye aynı doğrulanmış e-postayla tekrar giriş yaparak kartını ve geçmişini okuyabilir. İşletme sahibi/personel mevcut geçmişe erişmeye devam eder. Veriler silinmez.

## Kurulum ve doğrulama

Migration sırası:

1. `20261005120000_sadakat_pilot.sql`
2. `20261006120000_sadakat_program_association_fix.sql`
3. `20261006130000_sadakat_email_pilot.sql`

Müşteri uygulamasında `NEXT_PUBLIC_MENU_URL` doğru origin olmalıdır; API mutasyonları aynı origin ve JSON şartını korur. `CUSTOMER_AUTH_STATE_KEYS`, mevcut müşteri rate-limit altyapısı ve Supabase e-posta OTP gereklidir. Gerçek müşterili pilot SMS yerine e-posta doğrulaması kullanır; `CUSTOMER_AUTH_EMAIL_OTP_ENABLED` açık olmalıdır (varsayılan açık). SMTP gönderimi ve e-posta şablonunda altı haneli kodun bulunması pilot açılmadan önce gerçek bir adresle doğrulanmalıdır. CAPTCHA için mevcut reCAPTCHA anahtarları kullanılır. SMS gönderici adı hazır olduğunda mevcut telefon OTP akışı ayrıca etkinleştirilebilir; sabit kod veya doğrulamasız giriş üretimde kullanılmaz.

Telefon zorunlu değildir. E-posta OTP ile oluşturulan kimlik mevcut doğrulanmış kimlik altyapısını kullanır; kullanıcının yazdığı doğrulanmamış telefon eski bir kartı açmaz ve hesapları birleştirmez. Telefon ve e-posta aynı doğrulanmış hesaba bağlıysa mevcut bakiye korunur. Eski telefon oturumları çalışmaya devam eder.

Yerel PostgreSQL testi yalnız `localhost`/`127.0.0.1` kabul eder; kendi rastgele veritabanını oluşturup siler:

```sh
SADAKAT_TEST_DATABASE_URL=postgresql://postgres:password@127.0.0.1:port/postgres node packages/db/scripts/sadakat-runtime.mjs
```

DEV mobil tarayıcı testi yalnız `yxsegwkzyiscrxiwdeuf` hedefini kabul eder. Gerçek DEV Auth/RPC’leri kullanır, e-posta taşımasını tarayıcıda taklit eder; SMS/e-posta göndermez. Sentetik kayıtlar test sonunda pasifleştirilir, audit nedeniyle korunur. İzole Next önizlemeleri ve ekran görüntüleri `/tmp/masabu-sadakat-*` altında bulunur.

```sh
node --env-file=apps/dashboard/.env.local --env-file=apps/dashboard/.env.sandbox packages/db/scripts/verify-sadakat-browser.mjs --apply-dev-fixtures
```

Mevcut müşteri OTP metriklerine ek olarak `sadakat.join` ve `sadakat.operation` başarı/hata olayları kimlik doğrulama verileri, telefon veya kişisel kod kaydetmeden üretilir. Aktif işletmeler erişim tarihlerinden, tekrar ziyaret davranışı paneldeki işletme bazlı rapordan izlenir. Rapor başlangıçtan bugüne hesaplanır; müşteri/manuel işlem listeleri son 100 kayıt, müşteri kartı geçmişi son 30 kayıttır. Ziyaret günleri `Europe/Istanbul` ile hesaplanır.

Otomatik ödeme, fiyatlandırma, NFC, cüzdan entegrasyonları, kampanyalar, puan/seviye arayüzü ve ortak şube kartı sonraki aşamadır. Mevcut Masabu Pro sipariş kazanımı, ödül ve iade yolları kullanılmaya devam eder; bağımsız kasa ekranı otomatik işlenmemiş alışverişler içindir.
