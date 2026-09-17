# Menüde toplu güncelleme

## Kullanım

1. Menü başlığındaki **Tüm ürünleri düzenle** ile kategori ve arama filtresinden bağımsız tüm menüyü açın. Mobilde bu seçenek **Menü işlemleri** menüsündedir. Belirli ürünler için tek tek seçim veya **Filtreye uyan tüm ürünleri seç → Toplu düzenle** kullanılabilir. Seçimler ilk 60 ürünün dışında kalan sonuçları da kapsar.
2. **Toplu düzenle** ile ürün adı, açıklama, ana fiyat, kategori ve yayın durumunu düzenleyin. Shadcn bileşenleriyle masaüstünde solda kural paneli, sağda düzenlenebilir tablo; mobilde açılır kural paneli ve ürün kartları görünür. Pencere içindeki ürün/kategori araması yalnız görünümü daraltır; kurallar sabitlenmiş seçimin tamamına uygulanır.
3. İsterseniz tüm seçime bir kural uygulayın: yüzde/TL artırma-azaltma, sabit fiyat, metin değiştirme, adın başına/sonuna ekleme, açıklama atama/temizleme, kategori veya yayın durumu.
4. **Değişiklikleri incele** ekranındaki eski/yeni değerleri kontrol edip **N ürünü güncelle** ile yayımlayın.
5. **İşlem geçmişi → Ayrıntılar** üzerinden işlemi inceleyin veya geri alın. İşlemi yapan kişinin kayıtlı adı, e-postası ve işlem anındaki rolü birlikte gösterilir. Ad kaydedilmemişse e-posta kimliği ayırt eder; gerçek ad tahmin edilmez.

Kurallar o anki taslak değerlerine uygulanır; sonradan yapılan elle düzenleme son değeri belirler. Metin değiştirme büyük/küçük harfe duyarlı, düz metin eşlemesidir. Varsayılan fiyat yuvarlaması kuruştur; en yakın 1, 5 veya 10 TL seçilebilir. Yarım değerler yukarı yuvarlanır.

Bir işlem en fazla **500 ürün** içerebilir. Uzun açıklamalar için istemcide 650 KB, sunucu ve RPC sınırında 700 KB koruması vardır. Büyük seçimler açık bir mesajla daraltılır; ürünler sessizce atlanmaz. Fiyat 0,01–99.999.999,99 TL aralığındadır. Varyant/ekstra fiyatları, geçmiş siparişler ve gelişmiş ürün alanları değişmez.

## Güvenlik ve veri akışı

- Mevcut menü yetkisi ve aktif paket erişimi Server Action sınırında kontrol edilir. Kullanıcı kimliği oturumdan gelir. RPC yalnız `service_role` tarafından çağrılabilir; işletme sahibi, aktif ekip veya organizasyon menü yetkisi veritabanında tekrar doğrulanır.
- `execute_menu_bulk` RPC'si `preview`, `apply`, `history`, `detail`, `undo` ve çakışma kurtarma için `snapshot` işlemlerini sunar. Yalnız beş izinli ürün alanı kabul edilir.
- Ürünler ve kategoriler kilitlenir; bütün sürümler, hedef kategoriler ve değerler yazmadan önce doğrulanır. Tek satırdaki hata tüm işlemi durdurur.
- İşletme/istek kimliği ve istek içeriği kalıcı olarak eşleştirilir. Aynı isteğin yeniden gönderilmesi aynı sonucu döndürür; farklı içerikle kullanılması reddedilir. Eşzamanlı işlemler ve geri almalar işletme bazında sıraya girer.
- `menu_bulk_operations` yalnız değişen alanların önceki/sonraki değerlerini, ürün sürümlerini, aktörü ve zamanı saklar. Aktörün adı/e-postası/rolü sunucuda işlem anında sabitlenir; profil değişikliği eski kayıtları değiştirmez. Eski kayıtlara mevcut kullanıcıdan e-posta ve kayıtlı ad eklenir, geçmiş rolü tahmin edilmez. Değişiklik içermeyen istek ürün sürümü veya geçmiş kaydı oluşturmaz.
- Geri alma yeni bir geçmiş kaydıdır; eski ürün sürümü veya silinmiş kategori tespitinde tamamı reddedilir. Sonraki düzenlemeler ezilmez.
- Kaydedilmemiş taslaklar mevcut menü gezinme/çıkış korumasını kullanır. Çakışmada güncel değerler yüklenirken yalnız kullanıcının değiştirdiği alanlar korunur; yeniden önizleme gerekir. Silinmiş ürün seçimden çıkarılabilir.
- Başarı mevcut menü invalidation tetikleyicilerini, dashboard cache yenilemesini ve halka açık menünün sürüm bazlı önbelleğini kullanır.

## Doğrulama

2026-09-17 tarihinde DEV migration uygulandı. Testler gerçek tahsilat veya üretim menüsü üzerinde değişiklik yapmaz. DEV runtime testleri yalnız kendi geçici kayıtlarını oluşturup temizler.

```sh
# Repository root; Node 24
pnpm --filter @garsonless/domain test
pnpm --filter @garsonless/application test
pnpm --filter @garsonless/db test
pnpm --filter @garsonless/dashboard test:architecture
pnpm --filter @garsonless/domain --filter @garsonless/application --filter @garsonless/db --filter @garsonless/dashboard typecheck

# Explicit DEV mutation guard
MENU_RUNTIME_ALLOW_MUTATION=1 pnpm --filter @garsonless/db test:menu-bulk-runtime

# Local dashboard :3000 and public menu :3011; creates an isolated DEV trial tenant
pnpm --filter @garsonless/dashboard test:menu-bulk-browser

# Isolated build directory keeps the existing dev server running
NEXT_DIST_DIR=.next-bulk-check pnpm --filter @garsonless/dashboard build
node scripts/dashboard-bundle-budget.mjs --build-dir apps/dashboard/.next-bulk-check
```

Doğrulanan senaryolar:

- Türkçe ondalık girişi, yüzdeler/TL, yuvarlama, metin kuralları, sınır değerler ve değişen alanların ayrılması.
- 150 üründe atomik önizleme/kayıt, eşzamanlı aynı isteğin tek kayda dönüşmesi, farklı içerikli tekrarın reddi, yetkisiz/başka işletmeye ait erişimin reddi.
- İşletme sahibi/ekip üyesinin ad, e-posta ve rolünün doğru kaydı; profil değişince işlem kimliğinin korunması.
- Aktif menü ekip üyesinin kaydı, yetki kaldırıldıktan sonra erişimin reddi, anonim RPC çağrısının engellenmesi.
- Geçersiz veya silinmiş ürün, güncel olmayan sürüm ve silinmiş kategori nedeniyle kısmi kayıt/geri alma oluşmaması; mevcut siparişin fiyat ve isim snapshot'ının korunması.
- İki kategorideki 70 ürünün, ana ekranda tek ürüne daraltılmış aramaya rağmen tüm menü seçimiyle açılması; masaüstü ve 390 px mobilde 70 ürün seçimi, kural + elle düzenleme, taslak çıkış uyarısı, sunucu önizlemesi, kayıt, geçmiş, geri alma ve yatay taşma kontrolü.
- 700 px tablette pencere genişliği ve 1100 px ekrana geçişte toplu işlem ayarlarının açılması.
- Halka açık menünün değişikliği göstermesi; önizlemeden sonra değişen fiyatın üzerine yazılmaması; güncel fiyat yüklenirken açıklama taslağının korunması.

Ayrı yüklenen toplu düzenleme penceresi ilk menü paketine eklenmez. CSV doğrulaması da yalnız dosya seçildiğinde yüklenir. Performans bütçeleri yükseltilmedi.

## Ortam ve yayın

Migrationlar: `packages/db/supabase/migrations/20260917120000_menu_bulk_edit.sql` ve `20260917130000_menu_bulk_actor_identity.sql`.

DEV (`yxsegwkzyiscrxiwdeuf`) migration ve runtime doğrulaması tamamlandı. Bu özellik için PROD migration veya dağıtımı yapılmadı. Yayında önce mevcut hedef kontrollü migration akışıyla iki migration sırasıyla uygulanmalı, ardından dashboard dağıtılmalı. Geri dönüşte önce eski dashboard sürümüne dönülebilir; işlem geçmişi korunmalıdır.
