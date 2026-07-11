# Dashboard Ekran Turu — Masalar/QR Audit

Tarih: 2026-07-11  
Kapsam: salt-okuma kod auditi; davranış değişikliği yapılmadı.

## Sonuç

Ana Masalar/QR ekranı gerçek Supabase verisi ve gerçek server action'ları kullanıyor. Masa oluşturma, yeniden adlandırma, soft-delete, açık adisyon, servis isteği ve QR stil kaydı mock değil. QR görseli de statik asset değil; `qr-code-styling` ile tarayıcıda her masa için yeniden üretiliyor ve gerçek, stabil masa UUID'sini hedefliyor.

Ancak ekran tamamen dürüst değil. İki görünür toggle hiçbir runtime davranışına bağlı değil, URL örneği gerçek QR hedefiyle uyuşmuyor, bazı kontroller dead/stub ve fiziksel stand talep akışında ciddi bir auth/spam açığı var.

## 1. Dosyalar ve component ağacı

- Route: `apps/dashboard/app/dashboard/[restaurantId]/tables/page.tsx`
  - İlk iş `requireSection(restaurantId, 'tables')` çalıştırır.
  - `getRestaurantById` ve `getTablesForRestaurant` ile SSR verisini çeker.
  - `restaurant.settings.qr_style` ve gerçek `tables` satırlarını `TablesBuilderShell`'e verir.
- Ana client: `apps/dashboard/components/tables/TablesBuilderShell.tsx`
  - `TablesTopBar`: preset, undo/redo, autosave durumu, preview.
  - `TablesNav` / `TableRow`: masa listeleme, arama, ekleme, rename, silme, açık adisyon ve servis isteği durumu.
  - `QRCanvas` / `GridCard` / `Frame`: QR preview, grid, print ve indirme.
  - `QRProps`: şekil, renk, logo, çerçeve, URL/UTM ve davranış ayarları.
  - `SettlementSheet`: açık adisyon kapatma/tahsilat.
  - `MobilePreview`: iframe menü önizlemesi.
- Server actions: `apps/dashboard/lib/actions/tables.ts`
  - `createTable`, `renameTable`, `deleteTable`, `saveQRStyle`.
  - Açık session sorgusu ve güvenli kapatma akışı.
- Query: `apps/dashboard/lib/queries.ts#getTablesForRestaurant`.
- Yan ekran: `apps/dashboard/app/dashboard/[restaurantId]/tables/order-stands/page.tsx`
  - Action: `apps/dashboard/lib/actions/stands.ts#requestStands`.

## 2. Veri gerçek mi?

Gerçek:

- Masalar `public.tables` tablosundan SSR ile okunuyor; `restaurant_id` ve `deleted_at is null` ile scope'lu.
- Ekleme/rename/delete gerçek DB mutation. Delete soft-delete (`deleted_at`) ve açık adisyon varken reddediliyor.
- Aktif masa/adisyon sayıları gerçek `table_sessions`, `orders` ve `payment_shares` verisinden geliyor.
- Bekleyen masa istekleri gerçek `service_requests` action + realtime kanalından geliyor.
- QR stili `restaurants.settings.qr_style` içine service-role ile merge edilip 650 ms debounce ile kaydediliyor; save error UI'da gösteriliyor.

Sahte veya türetilmiş:

- `TableItem.orders` ilk map'te daima `0`; client açıldıktan sonra `getOpenTableSessions` sonucu gelince gerçek `orderCount` ile değişiyor. Bu kısa süreli 0/idle flicker yaratabilir.
- `slug` DB alanı değil; label ve liste index'inden client-side türetiliyor. Yalnız dosya adı ve yanlış URL örneklerinde kullanılıyor; gerçek QR hedefi değildir.
- `qr_code_url` hiçbir yerde yazılmıyor. İlk status hesabı buna bakıyor, dolayısıyla pratikte anlamsız/dead kolon; gerçek aktiflik daha sonra açık session'dan türetiliyor.

## 3. QR üretimi ve hedef URL

- QR statik değildir. `qr-code-styling` dinamik import edilir ve preview/grid/download sırasında yeniden üretilir.
- Gerçek hedef `buildUrl()` içinde şu biçimdedir:
  - `https://{baseUrl}/table/{tables.id}?utm_...`
  - Varsayılan base: `menu.masabu.co/{restaurantSlug}`.
  - Sonuç: `https://menu.masabu.co/{restaurantSlug}/table/{stable-table-uuid}`.
- Rename veya liste sırası değişse de UUID değişmediği için basılmış QR hedefi stabil kalır.
- PNG/SVG/JPEG gerçek indirme çalışır; QR export seçili boyut, margin, ECL, logo ve renkleri yeniden uygular.

Sorunlar:

- UI `"Her masa için /masa-ID eklenir"` ve `Örnek: .../masa-01` gösteriyor; gerçek URL `/table/{uuid}`. Grid kartı da `/masa-{slug}` yazıyor. Kullanıcıya gösterilen/kopyalanan model ile QR içine gömülen hedef çelişiyor.
- UTM değerleri `encodeURIComponent` kullanılmadan query string'e ekleniyor. Boşluk, `&`, `?`, `#` gibi karakterler bozuk veya beklenmeyen parametre üretebilir.
- `baseUrl` sadece 1–200 karakter string olarak doğrulanıyor. `tables` yetkili ekip üyesi bunu başka domaine çevirebilir; tüm basılı QR'ların hedefini değiştiren yüksek-etkili bir yetki. Bu ürün kararı bilinçli değilse host allowlist/owner-only sınırı gerekir.
- QR hedefi DB'de masa bazında saklanmıyor; global stil/base URL sonradan değişince yeniden indirilen QR değişir, daha önce basılan QR doğal olarak eski hedefte kalır. UI versiyon/geçmiş göstermiyor.

## 4. CRUD ve yetkilendirme

Ana ekran doğru katmanlı:

- Page gate: `requireSection(..., 'tables')`.
- Her mutation ayrıca `assertAccess(restaurantId, 'tables')` eşdeğeriyle korunuyor.
- Mutation'lar hem `tableId` hem `restaurantId` ile scope'lu; cross-tenant ID no-op/error.
- RLS `section_write_tables` ile yalnız owner veya `tables` section sahibi üyeye write verir; authenticated read `has_restaurant_access`, anon read yalnız soft-delete olmayan masalar için açık.
- Açık adisyonlu masa hem UI hem server action tarafından silinemez.

Kritik yan-akış açığı:

- `/tables/order-stands` kendi `requireSection('tables')` gate'ini çalıştırmıyor; yalnız restaurant layout'un kaba “herhangi bir access” kontrolünü miras alıyor. Başka section'a sahip aktif üye doğrudan URL ile ekranı açabilir.
- `requestStands` server action'ında auth, restaurantId veya `assertAccess` yok. Action yalnız form alanlarını doğrulayıp Resend maili gönderiyor. Bu, unauthenticated/action replay ile spam ve maliyet tüketimi riski oluşturur; formdaki restoran adı serbest metindir.
- Stand formu fiyatları `₺49'dan` / `₺149'dan` diye gösteriyor fakat gerçek teklif/checkout/persisted request yok; sadece e-posta gönderiyor. “Talebiniz alındı” teknik olarak email kabulünü ifade ediyor, sipariş kaydı değildir.

## 5. TODO, dead control ve yarım işler

- `autoLang` ve `countdown` toggle'ları UI'da değişir ve DB'ye kaydolur, fakat repo içinde QR config okuma/yazma dışında tüketicileri yoktur. İşlevsiz, live-looking kontrollerdir.
- “Tümünü indir (.zip)” görünür ama disabled benzeri stil + `Yakında`; gerçek `disabled` attribute yoktur. Tıklama yapmaz, fakat erişilebilirlikte aktif buton gibi görünür.
- PDF seçeneği listede görünür ama disabled; gerçek PDF üretimi yoktur.
- Logo/marka linki `href="#"`; sayfa tepesine sıçrar, navigasyon yapmaz.
- Restoran seçici görünümlü chevron butonunun handler'ı yoktur.
- `qr_code_url` dead state kaynağıdır; yalnız status map'inde okunur, hiçbir writer yoktur.
- Audit kapsamındaki dosyalarda debug `console.log` bulunmadı.

## 6. Kullanıcıyı yanıltabilecek durumlar

Önem sırasıyla:

1. **Kritik — stand action auth'suz:** Herkes Resend stand talebi gönderebilir; ekip yetkisi/tenant bağı yok.
2. **Yüksek — QR hedef domaini serbest:** `tables` yetkili üye global base URL'yi herhangi bir hosta çevirebilir. Basılı QR güven zinciri açısından güçlü bir yetki.
3. **Yüksek — sahte davranış toggle'ları:** Otomatik dil ve geri sayım kaydediliyor ama hiçbir şey yapmıyor.
4. **Orta — QR URL açıklaması yanlış:** UI `/masa-XX`, gerçek QR `/table/{uuid}` kullanıyor.
5. **Orta — UTM encoding yok:** Normal pazarlama metni bile hedef URL'yi bozabilir.
6. **Orta — ilk render status flicker:** Gerçek session sorgusu tamamlanana kadar sipariş sayısı 0 ve masa idle görünebilir.
7. **Düşük — dead/stub chrome:** restoran dropdown, logo linki, ZIP ve PDF kontrolleri işlevsiz veya yarım.
8. **Düşük — fiziksel stand vaat dili:** E-posta talebi “sipariş” ekranı gibi sunuluyor; kalıcı talep kaydı, teklif ve teslimat backend'i yok.

## Önerilen düzeltme sırası

1. `requestStands` için auth + `restaurantId` + `assertAccess('tables')`, server-side restoran adı/iletişim çözümü ve rate limit; order-stands page'e açık section gate.
2. QR `baseUrl` yetkisini kararlaştır: sabit Masabu host veya owner-only allowlist. UTM'leri `URL`/`URLSearchParams` ile üret.
3. `autoLang` ve `countdown` kontrollerini gerçek backend/runtime olana kadar kaldır veya açıkça disabled “yakında” yap.
4. Tüm `/masa-*` metinlerini gerçek `/table/{id}` modeliyle düzelt; kullanıcıya UUID göstermek istenmiyorsa yalnız “Her masa için benzersiz bağlantı” de.
5. Dead/stub chrome'u kaldır ya da semantik `disabled` yap; `qr_code_url` kolonunun rolünü kaldır/yeniden tanımla.
6. İlk status flicker'ını SSR snapshot veya dürüst loading state ile çöz.

