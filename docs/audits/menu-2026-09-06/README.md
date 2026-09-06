# Menü yönetimi — audit ve uygulama kaydı

Tarih: 6 Eylül 2026. Başlangıç commit'i: `fd43b9ec103bd8c23024f9cd92a2aca880a39124`.

## Kapsam ve karar

Kategori–ürün–editör düzeni ve animasyonlar korunarak kayıt güvenilirliği, taslak koruması, erişilebilirlik ve büyük katalog okuması iyileştirildi. Yeni framework, servis veya veritabanı kolonu eklenmedi. Görsel değişikliklerinin ana **Kaydet** işlemiyle yayımlanması kullanıcı tarafından seçildi.

Audit akışı: boş menü → dolu katalog → ürün editörü → yeni ürün/başka bölüm → CSV başlangıcı. Başlangıç gözlemleri yerel uygulamada 1440, 768, 390 ve 320 CSS px üzerinden yapıldı. İncelenen mobil editörde alt navigasyon kayıt düğmelerini örtmüyordu. Bu, değişiklik sonrası kabul testi değildir.

## Bulgular ve uygulanan çözümler

| Öncelik | Bulgu | Uygulama | Doğrulama |
|---|---|---|---|
| P1 | Bölüm/yeni ürün geçişinde taslak kaybı | Menü taslak kayıtçısı; ürün, kategori, yeni ürün ve öneri taslakları; mevcut shell koruması ve gezinme interceptor'ı; pending yazmada çıkışı durdurma | Kayıtçı davranış testleri geçti. Tarayıcı regresyonları eklendi; oturum bekliyor |
| P1 | Görsel değişikliği hemen yayımlanıyor | Yerel blob önizleme; Kaydet sırasında yükleme; başarısız kayıtta aynı yüklemeyi yeniden kullanma; vazgeçilen yeni dosyalarda yetki ve referans kontrolü | DEV'de kullanılan görsel korunması ve kullanılmayan görsel temizliği geçti. Tarayıcıda seçim/iptal testi eklendi |
| P1 | Eski oturum güncel ürünü ezebiliyor | `expectedUpdatedAt` zorunlu güncelleme girdisi; atomik `updated_at` filtresi; `conflict` cevabı; temiz editörde sürüme bağlı yeniden başlatma; taslak korunarak açık yeniden yükleme seçeneği | Gerçek DEV satırında ilk yazma başarılı, eski sürümden ikinci yazma reddedildi; diğer tenant erişimi reddedildi |
| P1 | Beklenmeyen hata sonrası kayıt/silme kilidi | İşlem kilidi, `try/catch/finally`, taslağı koruyan hata mesajı; kategori formu dahil pending alanların devre dışı bırakılması | Lint/typecheck geçti. İki ardışık ağ hatasında taslak ve yeniden deneme testi eklendi; tarayıcı çalıştırması bekliyor |
| P1 | Temel ürün alanlarının etiketi bağlı değil | Field/FieldLabel, kararlı input ID'leri, alan hata bağlantıları ve ilk hataya odak | Derleme geçti; erişilebilirlik ağacının değişiklik sonrası kontrolü bekliyor |
| P1 | CSV önizleme/sunucu doğrulaması farklı | Paylaşılan Zod satır şeması, metin/öğe sınırları; tanınmayan boolean değerlerinde sütun hatası | Geçerli/geçersiz metin ve boolean davranış testleri geçti |
| P2 | 1000+ üründe sessiz eksik katalog | 500 satırlık sıralı sayfalar; kategori ID'lerini 100'lük gruplama; `position,id` sırası; hata halinde kısmi veri döndürmeme | DEV'de 1002 ürün ve son ürün doğrulandı; geç sayfa hatası birim testi geçti |

Ek düzeltme: Hızlı fiyat/görünürlük güncellemesinde gönderilmeyen açıklama alanı artık `null` olarak işlenmiyor. Sunucudan dönen ürün sürümü de yerel hızlı güncelleme sonucuna ekleniyor.

## Kalite kontrolleri

- `pnpm check:ci`: **2387 test geçti, 0 hata**; deadcode, lint, workspace typecheck ve mevcut kalite kapıları başarılı.
- Dashboard production build: başarılı. Next.js **15.5.25**, sürüm değişmedi.
- `MENU_RUNTIME_ALLOW_MUTATION=1 pnpm --filter @garsonless/db test:menu-runtime`: **1 DEV entegrasyon senaryosu geçti**. CAS, tenant izolasyonu, 1002 satır, görsel referansı ve temizlik kapsanıyor. Test yalnız `yxsegwkzyiscrxiwdeuf.supabase.co` hedefinde yazmaya izin verir.
- Test restoranları ve yüklenen test dosyaları temizlendi. İlk denemedeki restaurant cascade/menü invalidation FK hatası, test temizliğinde önce ürün/kategori silinerek giderildi; ürün şemasına bu nedenle değişiklik yapılmadı.
- `tests/visual/dashboard-menu-reliability.spec.ts`: taslağı koruyarak kapatma, bölüme geçiş uyarısı, görselin yerel kalması ve ağ hatasında tekrar deneme. Mevcut authenticated visual matrise eklendi: masaüstü, mobil, dar mobil, tablet ve %200 zoom. **Bu yeni tarayıcı testleri henüz çalıştırılmadı.**

## Açık kabul kontrolleri

Tarayıcıdaki yerel oturum audit sonrasında giriş ekranına döndü. Kullanıcıdan yeniden giriş istendi. Bu nedenle değişiklik sonrası gerçek tarayıcı ekranları, klavye/odak, %200 zoom, azaltılmış hareket, dosya yükleme etkileşimi ve istek kesintisi tamamlanmış sayılmıyor. Kod ve DEV veri katmanı testlerinin geçmesi bunların yerine kullanılmıyor.

Önceki bölüm geçişinde görülen istemci hatasının kök nedeni kanıtlanmadı. Güncel production build hazırlanırken eski yerel Next sunucusu durduruldu; yeniden giriş sonrası taze doküman üzerinden tekrar kontrol edilmeli.

Production deploy veya commit/push bu uygulama adımında yapılmadı.

## Başlangıç ekran kanıtları

`before/` altındaki görseller audit sırasında alınıp açılarak kontrol edilmiş **değişiklik öncesi** kanıtlardır. Tarayıcı yakalama aracının sağ/alt boş tuval alanları ürün bulgusu olarak değerlendirilmedi.

- `01-desktop.jpg`: boş menü.
- `03-editor-desktop.jpg`: ürün editörü.
- `04-editor-mobile-390.jpg`, `06-editor-mobile-320.jpg`: mobil editör.
- `05-new-product-over-dirty-editor.jpg`: ürün taslağından yeni ürüne geçiş.
- `07-csv-start-desktop.jpg`: CSV başlangıcı.
- `08-catalog-tablet-768.jpg`: tablet katalog.

Teknik referanslar: [React durum yapısı](https://react.dev/learn/choosing-the-state-structure), [Next.js 15 hata yönetimi](https://nextjs.org/docs/15/app/getting-started/error-handling), [shadcn Base Field](https://ui.shadcn.com/docs/components/base/field).
