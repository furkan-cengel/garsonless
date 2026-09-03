# Masabu yayın ve ödeme kabul kontrol listesi

Bu belge production secret içermez. İşaretlenmeyen kapılar canlı ödeme ve nihai hukuk onayı önünde engeldir; yasal metinler taslak durumunda da indekslenir.

## Doğrulanmış işletme kimliği

- Marka: Masabu
- İşletme sahibi: Mustafa Furkan Çengel
- Tür: şahıs işletmesi
- Vergi dairesi: Kartal Vergi Dairesi
- VKN: 2420625143
- Adres: Cevizli Mah. Zuhal Cad. A Blok No: 46 İç Kapı No: 50, Maltepe/İstanbul
- T.C. kimlik numarası hiçbir kamu sayfasında veya logda kullanılmaz.

## Harici tamamlanma kapıları

- [ ] `bilgi@masabu.co`, `destek@masabu.co`, `kvkk@masabu.co` ve `fatura@masabu.co` kutuları açıldı ve gelen/giden posta doğrulandı.
- [ ] Kamuya açık destek telefonu belirlendi ve `NEXT_PUBLIC_BUSINESS_PHONE` production secret’ına eklendi.
- [ ] KEP adresi edinildi ve `NEXT_PUBLIC_BUSINESS_KEP` production secret’ına eklendi.
- [ ] MERSİS veya ESBİS/esnaf sicil statüsü mali müşavirle doğrulandı; yalnız doğrulanmış bilgi yayımlandı.
- [ ] ETBİS kaydı tamamlandı ve alan adı/iletişim bilgileri güncel tutuluyor.
- [ ] VERBİS yükümlülüğü ve istisnalar KVKK hukukçusu tarafından yazılı değerlendirildi.
- [ ] Supabase, Resend, iyzico, Paraşüt ve Supademo için bölge, saklama, alt işleyen ve yurt dışı aktarım envanteri tamamlandı.
- [ ] Gerekli yurt dışı aktarım güvenceleri ve Kurum bildirimleri tamamlandı.
- [ ] KVKK, gizlilik, çerez, abonelik ve iptal/iade metinleri avukat tarafından onaylandı; ardından `LEGAL_DOCS_APPROVED=true` verildi.
- [ ] Muhasebeci `INVOICE_VAT_RATE` ve `INVOICE_SERVICE_NAME` production değerlerini onayladı.
- [ ] iyzico şirket hesabı, sözleşme ve IBAN doğrulaması tamamlandı; altı temel ve altı birleşik add-on olmak üzere 12 provider plan referansı canlı tutarlarla eşleştirildi.

`MASABU_RELEASE_BUILD=true` veya Vercel production build’i, kamuya açık destek telefonu eksikken marketing yayınını fail-closed durdurur. KEP isteğe bağlıdır; hukuk onayı indeksleme kapısı değildir.

## Alan adları ve SSL

- `masabu.co`: marketing, blog ve yasal metinler
- `app.masabu.co`: dashboard, signup, login, iyzico callback/webhook ve accounting worker
- `menu.masabu.co`: misafir menüsü ve restoran ödeme callback’leri
- `kds.masabu.co`: mutfak ekranı

Her alan adı için geçerli TLS sertifikası, HSTS kararı, doğru origin yönlendirmesi ve güvenli çerez kapsamı doğrulanmalıdır. Supabase izinli redirect URL listesine yalnız gerekli `https://app.masabu.co/auth/callback` ve recovery akışları eklenmelidir.

## E-posta DNS

- Resend’in verdiği SPF ve DKIM kayıtları aynen uygulanır ve doğrulama ekranında “verified” görülür.
- DMARC önce raporlama modunda (`p=none`) gözlemlenir; meşru göndericiler doğrulandıktan sonra maliyet/risk değerlendirmesiyle `quarantine` veya `reject` seviyesine yükseltilir.
- Marketing satış formu `bilgi@`, sistem faturaları `fatura@`, hesap/destek postaları uygun doğrulanmış göndericiden çıkar.
- `kvkk@` gelen kutusu için erişim, saklama ve yanıt sorumlusu tanımlanır.

## Ödeme ve fatura işleyicileri

- İyzico callback/webhook URL’leri HTTPS ve production origin üzerinde doğrulanır.
- Provider plan tutarları kod kataloğuyla bire bir uyuşmadığında checkout’un açılmadığı test edilir.
- `POST https://app.masabu.co/api/internal/accounting-invoices` yalnız `ACCOUNTING_WORKER_SECRET` Bearer değeriyle çağrılır. `ACCOUNTING_WORKER_URL` ve aynı secret ile `pnpm --filter @garsonless/db configure:accounting-worker-vault` çalıştırıldığında Supabase Vault değerleri ve dakikalık cron birlikte yapılandırılır.
- Paraşüt OAuth refresh token’ı ilk worker çağrısında Supabase Vault’a alınır; Paraşüt’ün her yenilemede döndürdüğü yeni refresh token atomik olarak Vault’a yazılır. Token loglanmaz veya veritabanı iş kayıtlarına konmaz.
- İlk yetkilendirmede Paraşüt’ün döndürdüğü tek kullanımlık code, geçici `PARASUT_AUTHORIZATION_CODE` olarak verilerek `pnpm --filter @garsonless/dashboard accounting:configure-parasut:dev` çalıştırılır. Komut yalnız refresh token’ı Vault’a yazar; token’ı ekrana basmaz. Ardından authorization code secret’tan kaldırılır.
- `pnpm --filter @garsonless/dashboard accounting:verify-parasut:dev` yalnız yapılandırılmış Paraşüt ürününü okur; müşteri, taslak veya mali belge oluşturmaz.
- Worker Paraşüt’ün şirket başına `10 istek / 10 saniye` sınırına uymak için her çağrıda yalnız bir mali belge işi alır.
- `ACCOUNTING_DISPATCH_ENABLED=false` iken worker hiçbir kuyruk kaydı almaz; DEV test şirketi ve production açılışı ayrı ayrı açıkça etkinleştirilir.
- Aynı ödenmiş abonelik faturası için `subscription_invoice_id` unique sınırı yalnız bir Paraşüt işi üretir.
- Paraşüt kesintisi aboneliği geri almaz; kuyruk backoff ile tekrar eder.
- İptal/iade mali belgeyi otomatik silmez; muhasebe inceleme kuyruğu açar.

## Yayın kanıtı

- [ ] Marketing ve dashboard production build çıktıları saklandı.
- [ ] Mobil/masaüstü kritik sayfalar ve klavye erişimi kontrol edildi.
- [ ] Broken-link, canonical, sitemap, RSS, robots ve JSON-LD kontrolleri geçti.
- [ ] Supademo yalnız ilgili demo adımı görüntü alanına girdiğinde otomatik yükleniyor; diğer adımlar erken ağ isteği üretmiyor.
- [ ] Signup sözleşme kabulü ve checkout özeti sürüm, kullanıcı, zaman ve request-id bağlamıyla kaydoluyor.
- [ ] Şifre, magic link, recovery ve harici `next` reddi production origin’de test edildi.
- [ ] iyzico sandbox ve Paraşüt test şirketi üzerinde idempotency/kesinti senaryoları geçti.
