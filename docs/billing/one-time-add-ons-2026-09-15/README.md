# Tek seferlik eklentiler — 15 Eylül 2026

## Davranış

- Video Hero: başlangıç net fiyatı 390 TL; %20 KDV ile 468 TL. Starter/Plus satın alır, Pro kapsamında kullanım ayrıca sahiplik üretmez.
- İyzico Online Ödeme: başlangıç net fiyatı 3.000 TL; %20 KDV ile 3.600 TL. Satın alma ve kullanım Pro gerektirir.
- `restaurant_add_on_ownership` işletmeye bağlıdır ve abonelik döneminden bağımsızdır. Abonelik erişimi kapanınca kullanım kapanır; sahiplik silinmez.
- Fiyatlar `/add-ons` platform-admin ekranından `catalog.manage` yetkisi ve mevcut MFA kapısıyla sürümlenir. Eski ödeme oturumlarının fiyatı ve fatura profili sabittir.
- Bölüm seçici fiyatı ve KDV dahil toplamı gösterir. Satın alma faturalama ekranındaki ürün özetine gider. Yerel taslak korunur; ödeme dönüşü aynı işletme/tema ve Video Hero seçimi açılır. Kullanıcı bölümü kendisi ekler/yayımlar.
- Ekip üyeleri satın alınan özelliği normal tema yetkileriyle kullanır. Satın alma sunucuda işletme sahibine sınırlandırılır.

## Ödeme ve mali belge

Standart [iyzico Checkout Form](https://docs.iyzico.com/odeme-metotlari/odeme-formu/cf-entegrasyonu/cf-baslatma) Masabu tahsilat hesabını kullanır. Bu akış abonelik sağlayıcısının initialize/upgrade metodunu çağırmaz.

[Sonuç sorgulamasının](https://docs.iyzico.com/odeme-metotlari/odeme-formu/cf-entegrasyonu/cf-sorgulama) HMAC imzası, token, basket/işlem kimliği, TRY ve toplamı doğrulanır. Fraud sonucu 1 onaydır; 0 incelemede kalır, diğer belirsiz durumlar hak açmaz. Reporting API üzerinden doğrulanmış tam iade hakkı kaldırır, kısmi iade korur. Kesinleşmiş ters ibraz, finans/superadmin aktörü ve sağlayıcı kanıt referansıyla `record_add_on_chargeback` RPC'sine kaydedilir; aynı satın alıma ait hak kaldırılır.

Ayrı `accounting_invoice_jobs.add_on_purchase_id` kaydı Nilvera'ya tek seferlik ürün satışı olarak gider. Abonelik dönemi üretilmez; fatura kalemi satın alma anındaki net fiyat ve KDV'yi kullanır. Belge indirme işletme sahibi kontrolünden geçer. Mevcut fatura e-posta işçisi aynı tekilleştirme anahtarını kullanır.

`/api/internal/billing-maintenance` kayıp callback'leri ve iadeleri uzlaştırır. Kuyruk işleri sağlayıcı çağrısından önce alınır; sorunlu kayıt sonraki kayıtları engellemez. Başlangıç yanıtı belirsizse yeni tahsilat otomatik başlatılmaz; henüz ödeme URL'si verilmemiş işlem sağlayıcının boş ödeme raporuyla kapatılabilir. Token'ı olan fakat sonucu doğrulanamayan oturum destek uzlaştırmasında kalır. İki yıldan eski satışlar Reporting API otomatik taramasından çıkar; hakları korunur, kesin ters ibraz kanıtı operatör RPC'siyle işlenebilir.

## Geliştirme doğrulamaları

- Gerçek iyzico **sandbox** kart ödemesi: 468 TL, `paid`; HMAC, tutar, para birimi, basket/işlem kimliği doğrulandı. Test ödeme formu uygulama veritabanına bağlı olmayan bağımsız sağlayıcı senaryosudur; veritabanı hakkı ayrıca aşağıdaki rollback testiyle doğrulanır.
- Geliştirme veritabanındaki rollback testi: 10. gün alımı abonelik kaydının tamamını değiştirmedi; tekrar istek tek ödeme kaydı, tekrar sonuç tek hak/fatura işi üretti. İnceleme ve hatalı tutar hak açmadı. Yetkisiz sahip/fiyat güncelleme, paket değişimi/yeniden açma ve kısmi/tam iade kontrolleri geçti.
- Playwright: faturalama ve bölüm seçici 1440px/390px; doğru fiyatlar, taşmayan mobil diyalog, tarayıcı uygulama hatası yok. Yerel kanıtlar `/private/tmp/masabu-add-ons-browser` altında. Kullanılan mevcut test işletmesinin aboneliği kilitli olduğundan satın alma düğmesinin bu durumda kapalı olduğu da doğrulandı.
- Nilvera sandbox: aynı 468 TL toplamı için dönem içermeyen ayrı e-Fatura oluşturuldu ve 54.563 bayt PDF indirildi. E-posta işçisi çağrılmadı.
- Eski birleşik abonelik sağlayıcı provası: dönem ve önceki ücret aynı kaldı; sonraki yenilemede eklenti bedeli kalktı. Sandbox test aboneliği kapatıldı; yeni tahsilat bırakılmadı.
- Tam tarayıcı zinciri: izole Starter test işletmesi → bölüm seçiciden satın al → 468 TL sandbox ödeme → gerçek callback → aynı editöre dönüş → kalıcı hak → ayrı Nilvera e-Fatura → uygulamanın yetkili indirme endpointinden 54.911 bayt PDF. Abonelik satırının tamamı değişmedi; Video Hero otomatik eklenmedi/yayımlanmadı. Kanıtlar `/private/tmp/masabu-addon-e2e` altında.
- Birim/sözleşme testleri: domain, application, DB, ödeme imzası, Nilvera tek seferlik kalemi, dashboard ve marketing kontrolleri.

Sandbox kimlik bilgileri ve checkout token'ları repoya yazılmaz. `verify-add-on-sandbox.ts` geçici oturum dosyasını yalnız sahibi okuyabilecek izinle `/private/tmp` altında tutar. Sandbox'ın Node 24 TLS 1.3 bağlantı sıfırlaması nedeniyle yalnız sandbox hostunda doğrulanmış TLS 1.2 kullanılır; canlı API varsayılan TLS ayarını kullanır.

## Komutlar

Repo kökünde Node 24:

```sh
corepack pnpm --filter @garsonless/db test:add-ons:runtime
corepack pnpm --filter @garsonless/dashboard billing:add-ons:report:dev
corepack pnpm --filter @garsonless/dashboard billing:add-ons:browser
corepack pnpm --filter @garsonless/dashboard billing:add-ons:sandbox
corepack pnpm --filter @garsonless/dashboard billing:add-ons:e2e
corepack pnpm --filter @garsonless/dashboard billing:add-ons:legacy:sandbox
```

Sandbox oturumunu test kartıyla tamamlamak için dashboard dizininde:

```sh
node --env-file=.env.sandbox --import tsx scripts/verify-add-on-sandbox.ts --complete
node --env-file=.env.sandbox --import tsx scripts/verify-add-on-sandbox.ts --verify
```

`--verify` yalnız sorgular; tekrar ödeme başlatmaz.

## Geçiş ve canlıya çıkış

Dört migration geliştirme projesine uygulandı:

- `20260915120000_one_time_add_on_purchases.sql`
- `20260915130000_add_on_migration_and_recovery.sql`
- `20260915140000_add_on_reconciliation_claims.sql`
- `20260915150000_add_on_recovery_guards.sql`

**16 Eylül 2026:** Dört migration yedekli olarak PROD projesine uygulandı. Salt okunur ve apply geçiş raporlarında geçmiş eklenti ödemesi/aboneliği 0; müşteri aboneliği değişikliği gerekmedi. Uygulama sürümü `054301f9deb26ea694365b602d4b117bc663f79f` main üzerinden Vercel’e gönderildi; dağıtım sonrası kontroller aşağıya kaydedilir.

1. Hedefe özgü migration ön kontrolünü ve yedeği mevcut release süreciyle tamamla. Yeni satışları geçiş süresince kapalı tut.
2. `migrate-one-time-add-ons.ts` varsayılan olarak salt okunurdur. Veritabanı proje kimliği ve sağlayıcı sandbox/canlı eşleşmesi zorunludur. Üretim hedefi ayrıca `--confirm-prod=svxvloeosiksqfadgkvo` ister.
3. Araç, ödenmiş ve iade edilmemiş yerel fatura/deneme kaydını gerçek sağlayıcı ödeme kaydıyla eşleştirir. Fixture ve doğrulanamayan ödemeler hak üretmez. Başarısız kayıtlar işletme bazında raporlanır.
4. `--apply`, doğrulanmış geçmiş ödemelere kalıcı hak verir ve aktif birleşik aboneliği aynı aralık/sonraki dönem politikasıyla eklentisiz plana taşır. Mevcut sağlayıcı plan değişikliği defteri, sabit işlem anahtarı ve sağlayıcı soy bağı/dönem doğrulaması kullanılır. İptal kararı korunur.
5. **Önceden planlanmış, hâlâ eklenti içeren sağlayıcı değişikliği otomatik üzerine yazılmaz.** Bu durumda `existing_scheduled_change_requires_reconciliation` raporlanır. Sağlayıcıda aynı yenileme sınırı ve hedef paket korunarak uzlaştırılmadan geçiş tamamlanmış sayılmamalıdır. Tüm rapor satırları kapanmadan yeni satışları açma.
6. Dev salt okunur rapor: hak üretilecek doğrulanmış eski ödeme 0; bir eski birleşik abonelik zaten iptal edilmiş. Buna ek olarak gerçek iyzico sandbox hesabında Starter + Video Hero birleşik aboneliği oluşturulup eklentisiz Starter planına NEXT_PERIOD geçişi doğrulandı: geçmiş ödenen tutar ve dönem sınırları değişmedi; sonraki yenileme aynı sınırda yalnız plan bedelini taşıdı. Test aboneliği sonunda kapatıldı. Önceden planlanmış eklentili değişiklikler için 5. adımdaki uzlaştırma kapısı geçerlidir.
7. Tam uygulama callback → hak → Nilvera belge indirme zinciri izole aktif Starter test işletmesiyle doğrulandı. `billing:add-ons:e2e` mevcut fixture dosyası varsa ödenmiş işlemi tekrar tahsil etmeden belge/erişim kontrollerini sürdürür. Test işletmesi geliştirme projesinde “Sandbox — one-time add-on E2E” adıyla tutulur; gerçek müşteriye ait değildir.

Üretim dry-run örneği (dashboard dizininde):

```sh
node --env-file=.env.production --import tsx scripts/migrate-one-time-add-ons.ts --target=prod --confirm-prod=svxvloeosiksqfadgkvo
```

Rapor onaylandıktan sonra aynı komuta `--apply` eklenir. Geçmiş fatura/ödeme delilleri silinmez. Satışı kapatmak yalnız yeni oturumları engeller; callback/uzlaştırma ve mevcut kalıcı haklar çalışmaya devam etmelidir.

## Son kontrol sonuçları

- Mimari testler: 1.773 test geçti (domain, design-engine, application, UI, menu, dashboard, kitchen, platform-admin).
- Veritabanı birim/sözleşme testleri: 669 geçti; geliştirme rollback senaryosu geçti.
- Marketing: 46 test geçti. Next.js kuralları: 12 test geçti.
- Workspace lint ve typecheck geçti; beş uygulama production build geçti.
- Canlı marketing destek telefonu yapılandırması doğrulandı; yerel ortamda eksik olan bu değer production’da mevcut. CSS `end` uyumluluk uyarısı mevcut koddan geliyor.
- 16 Eylül: yalnız yayın kapsamını içeren temiz checkout üzerinde tam `pnpm check:ci` geçti. Marketing’in `server-only` bağımlılığı açıkça eklendi; kilit dosyası güncellendi.

## Localhost

Dashboard'un yerel ödeme denemeleri için `corepack pnpm --filter @garsonless/dashboard dev:billing-sandbox` kullanılır. Yalnız process ortamına sandbox anahtarları yüklenir ve callback localhost'a döner; `.env.local` içine ödeme anahtarı kopyalanmaz. Diğer uygulamalar ayrı terminalde:

```sh
corepack pnpm --parallel --filter @garsonless/menu --filter @garsonless/kitchen --filter @garsonless/marketing --filter @garsonless/platform-admin dev
```

Dashboard 3000, menü 3011, kitchen 3002, marketing 3003, platform-admin 3005 portundadır.

## 16 Eylül canlı geçiş kanıtları

- PROD: `svxvloeosiksqfadgkvo`; dört migration sonrası bekleyen migration yok. CLI bağlantısı yeniden DEV’e döndürüldü.
- Yedek: `/private/tmp/masabu-addon-release-20260916/backup`; public şema, roller ve public veri; SHA-256 dosya doğrulamaları geçti. Tam Auth/Storage yedeği değildir.
- Eski alım dry-run/apply: uygun ödeme 0, taşınacak abonelik 0, hata 0. Sandbox hakları canlıya taşınmadı.
- Canlı katalog: Video Hero net 390 TL / toplam 468 TL; İyzico net 3.000 TL / toplam 3.600 TL, fiyat sürümü 1.
- Anonim katalog RPC erişimi `42501` ile reddedildi. Mevcut aboneliklerin paket/durum/iptal/sağlayıcı bağları değişmedi.
- Canlı iyzico Reporting API salt okunur sorgusu başarılı; gerçek kart tahsilatı veya test faturası oluşturulmadı.
- Vercel üretim ortamlarında canlı Supabase/iyzico/Nilvera adresleri doğrulandı; sandbox ayrı DEV projesine bağlı.
- Yerel yayın kanıtları: `/private/tmp/masabu-addon-release-20260916`; anahtar ve ödeme token’ları repoya eklenmedi.

### Uygulama dağıtımı ve yayın sonrası kontrol

16 Eylül 06:56 UTC’de altı uygulama da `054301f9deb26ea694365b602d4b117bc663f79f` kaynak sürümüyle READY oldu.

| Uygulama | Deployment |
| --- | --- |
| masabu-sandbox | `dpl_B4Qz1qADT67uPieCjVphZnnBRisV` |
| masabu-dashboard | `dpl_FMBpUYT5tDCiyyeL9cTezRG42me5` |
| masabu-marketing | `dpl_5cMj3qptZVW9TSEmSkpuFcq72JEu` |
| masabu-kitchen | `dpl_GpcpgaSdJ9YSvAVLRjzC6UyAG7Sj` |
| masabu-menu | `dpl_HuE186kBuKr9nuE8kV1qTzGkv1Ca` |
| masabu-platform-admin | `dpl_7ZyLjPHDHA4ce1WKhnqgxJRfQEyP` |

- Canlı marketing tarayıcısında `₺3.000 · Tek seferlik` ve Pro koşulu doğrulandı.
- Otomatik outbox/fatura cron’ları aktif; HTTP 200, timeout yok. Yeni eklenti uzlaştırması `checked: 0, failed: 0` döndü.
- Yanlış formatlı callback 400, bilinmeyen checkout 404, yetkisiz bakım işçisi 401 döndü. Hak/tahsilat oluşturulmadı.
- Oturumsuz fatura kontrolünde mevcut ortak işleyicinin Next.js giriş yönlendirmesini 503’e çevirdiği bulundu. Yetki çözümü belge/sağlayıcı catch bloğunun dışına alındı; gerçek Next.js redirect kullanan regresyon testi dahil 12 belge testi geçti. Bu düzeltme abonelik ve eklenti belgesi için ortak uygulanır.

### Devam eden performans kapıları

[Architecture CI](https://github.com/furkan-cengel/garsonless/actions/runs/35065074750) başarılı. Tam `check:ci` temiz checkout üzerinde de geçti. Aşağıdaki ayrı akışlar başarılı sayılmadı:

- [Dashboard Visual](https://github.com/furkan-cengel/garsonless/actions/runs/35065074694): `/menu` ready JS 358075 B > 357651 B.
- [Tables Runtime](https://github.com/furkan-cengel/garsonless/actions/runs/35065074730): aynı eşikte 358079 B; sonraki browser matrisi bu adımda durdu.
- [Public Quality](https://github.com/furkan-cengel/garsonless/actions/runs/35065074646): mobil LCP/etkileşim ve Lighthouse performans/CLS sınırları. Ana sayfa LCP yaklaşık 3796 ms; örnek menü 3876 ms, CLS 0,170.

Aynı JS bütçesi ve mobil performans sorunları [önceki yayın kaydında](../../platform-admin/release-2026-09-14.md) da bulunuyor. Eşikler gevşetilmedi; eklenti ödeme/fatura doğrulamaları tüm ürünün performans onayı olarak sunulmaz.
