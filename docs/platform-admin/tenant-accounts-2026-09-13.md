# İşletme sahibi / ekip hesap yönetimi

## Kapsam

`admin.masabu.co` işletme detayına yalnız aktif, MFA doğrulanmış süper yönetici için hesap bölümü eklendi. Diğer platform rollerinin salt okunur, kişisel veri içermeyen listesi değişmedi.

- Sahip ve ekip: ad, giriş e-postası, profil telefonu, kullanıcı kimliği, hesap oluşturma / son giriş / e-posta doğrulama tarihleri, giriş engeli, üyelik durumu ve bölüm izinleri.
- Daveti kabul edilmemiş üyeler ve devre dışı üyelikler de görünür.
- Fatura profili: unvan, ilgili kişi, e-posta, telefon, VKN/TCKN, vergi dairesi ve adres.
- Gerekçe varsayılan olarak doldurulur; kullanıcı görüntüleme düğmesine basınca kişisel bilgi açılır ve audit yazılır. Render/prefetch sırasında audit mutasyonu veya kişisel veri aktarımı yapılmaz.
- Görüntülenen bilgiler tarayıcı depolamasına yazılmaz; gizleme düğmesi, 10 dakikalık süre ve hesap işlemi sonrası temizlenir.

## Ayrı erişim mekanizmaları

1. **Auth giriş engeli:** `ban_duration: 'none'` ile Supabase Auth Admin API kullanılır. Etkisi kullanıcıya bağlı tüm işletmelerde globaldir ve onay ekranında açıkça belirtilir. Platform admin hesapları bu işletme işlemiyle açılamaz.
2. **Ekip erişimi:** Yalnız önceden kabul edilmiş, kullanıcıya bağlı üyelik aktif edilir; bölüm izinleri değişmez. Davet kabulü, sahip ataması veya yeni kullanıcı oluşturma yapılmaz.
3. **Sipariş erişimi:** Mevcut denetimli `active / suspended / manual_hold` kontrolü korunur.
4. **Paket / ödeme kilidi:** Mevcut abonelik, ödeme takibi ve süreli özellik izinleri ayrı kalır. Hesap açma bir faturayı ödenmiş yapmaz, abonelik aktive etmez, cihaz doğrulamasını veya MFA'yı atlamaz.

Parola, parola hash'i, OTP, oturum tokenı, sağlayıcı anahtarı ve kart güvenlik verileri DTO'ya alınmaz. Profil telefonu ve isim profil beyanıdır; bu alanlar kimlik doğrulama kanıtı sayılmaz.

## Giriş engelini kaldırma ve belirsiz sonuç

Sunucu yeni istek kimliği üretir. RPC güncel süper yönetici rolünü, işletme-kullanıcı ilişkisini ve hesabı kontrol eder; API çağrısından **önce** kalıcı `platform_account_unlocks` kaydı ve `tenant.account.unban_requested` audit'i yazar. Yalnız yeni hazırlanan istek API'ye gider. Aynı kullanıcıda bekleyen bir işlem varken yeni istek bloke edilir.

API dönüşünden sonra RPC `auth.users.banned_until` değerini okuyarak sonucu doğrular. Yalnız doğrulanmış sonuç tamamlandı sayılır. Kesin API reddi başarısız; zaman aşımı / belirsiz dönüş / son audit hatası bekleyen olarak kalır. “Sonucu kontrol et” tekrar API çağırmaz, kalıcı durumu kontrol eder. Engel hâlâ varsa beklemeye devam eder; otomatik yeni deneme yapılmaz. Kalıcı belirsizlikte operatör sağlayıcı sonucunu ve `platform_account_unlocks` kaydını birlikte incelemelidir; pending kaydı körlemesine silinmemelidir.

## Doğrulama (13 Eylül 2026)

- Platform-admin build, lint, typecheck: başarılı.
- Application ve DB typecheck: başarılı.
- Platform application testleri: 50 başarılı.
- Platform DB testleri: 80 başarılı (77 mevcut koşu + 3 yeni migration sözleşmesi).
- Admin mimari testleri: 20 başarılı.
- İzole PostgreSQL / PGlite: 7 senaryo başarılı. Gerçek foundation ve yeni migration, minimal önkoşul tablolarında değişmeden çalıştırıldı. Güncel üretim şemasının veya gerçek Supabase Auth servisinin uçtan uca testi değildir.
- Örnek verili bileşen tarayıcı testi: 320/393/430/1440 px, yatay taşma yok; 44 px düğmeler; görüntüleme/gizleme, odak dönüşü, onay ve işlem sonrası eski verinin temizlenmesi başarılı. Gerçek kişisel veri, canlı oturum veya hesap mutasyonu kullanılmadı.

İzole SQL testi tekrar çalıştırma:

```sh
PGLITE_MODULE_PATH=/absolute/path/to/@electric-sql/pglite/dist/index.js \
  node packages/db/scripts/verify-platform-tenant-accounts-isolated.mjs
```

PGlite yalnız geçici test dizinine kuruldu; uygulamaya bağımlılık eklenmedi.

## 14 Eylül 2026 — yayın öncesi doğrulama

- DEV ve PROD migration geçmişleri doğrulandı; ikisinde de yalnız `20260913120000` bekliyordu.
- Migration önce DEV'e uygulandı. `scripts/verify-platform-tenant-accounts-runtime.ts` gerçek Supabase Auth servisi üzerinde 8 senaryoyu geçti: AAL1 reddi, gerçek TOTP ile AAL2, anon/owner/staff/doğrudan RPC reddi, kapsamlı ama kapalı DTO ve audit, support/suspended reddi, ekip aktivasyonu/replay, gerçek Auth unban ve belirsiz sonuç uzlaştırması.
- Test çalışma kimliği: `fcd6eee8-a623-4ba5-a681-188cbec2e5c9`. Yalnız dört üretilmiş `example.test` hesabı ve iki DEV test işletmesi kullanıldı. Hesaplar kapatıldı, admin rolü revoked, ekip üyelikleri disabled, işletmeler soft-delete edildi; audit bağlantılı kayıtlar korunuyor. Gerçek hesaplar değiştirilmedi, e-posta gönderilmedi.
- Depo genelinde `pnpm check:ci` başarılı. Admin üretim derlemesi ve örnek verili 320/393/430/1440 px tarayıcı testi yeniden geçti.
- PROD public şema, roller ve veri yedeği `/private/tmp/masabu-prod-backup-20260914-tenant-accounts` dizininde alındı. SHA-256 ve boyutlar doğrulandı; dosyalar `0600`. Bu, tam Auth/Storage/PITR yedeği değildir ve repoya eklenmez.
- PROD migration `20260913120000` uygulandı; post-check bekleyen migration olmadığını doğruladı. Yerel Supabase bağlantısı yeniden DEV'e döndü. Migration mevcut kullanıcı veya ödeme durumlarını değiştirmiyor.
- Marketing/admin Vercel production hedefleri `svxvloeosiksqfadgkvo` ve doğru alan adlarıyla doğrulandı. Dağıtım ve canlı smoke sonucu ayrı yayın kaydına yazılacak.

DEV testini tekrar çalıştırmak için (yeni, kapatılacak audit fixture'ları oluşturur):

```sh
cd packages/db
node --env-file=../../apps/dashboard/.env.local --import tsx scripts/verify-platform-tenant-accounts-runtime.ts --apply-dev-fixtures
```

## Yayın sırası

1. Tamamlandı: DEV/PROD kimliği ve yalnız ilgili migration doğrulandı.
2. Tamamlandı: DEV migration, gerçek AAL2 ve Auth ban kaldırma testleri geçti.
3. Tamamlandı: PROD yedeği, migration ve `e2f3ec9` kaynaklı platform-admin deployment'ı READY. Canlı anonim erişim reddi doğrulandı; ayrıntılar `release-2026-09-14.md` dosyasında.
4. `bilgi@masabu.co` AAL2 oturumuyla bir işletme detayını aç, hesap bilgilerini göster, audit kaydını doğrula. Gerçek işletme hesabını deneme amaçlı engelleme/açma.

Geri dönüşte önce uygulama sürümünü geri al. Yeni RPC ve ledger mevcut akışları değiştirmez; audit ve bekleyen işlem kayıtlarını kaybetmemek için tabloları düşürme. Mevcut tenant rolleri, izinleri ve üretim hesabı durumları bu geliştirme sırasında değiştirilmedi.

Teknik kaynaklar: [Next.js 15 Server Action güvenliği](https://nextjs.org/docs/15/app/guides/data-security), [Supabase Auth Admin kullanıcı güncelleme](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid).
