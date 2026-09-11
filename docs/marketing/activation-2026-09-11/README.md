# İlk kullanım ölçümü — 11 Eylül 2026

Bu sürüm ilk kullanım olaylarını ve çerez tercihlerinin yeni erişim noktalarını içerir. GA4 üzerinde yeni rapor veya özel boyut oluşturulmadı.

| Olay | Tetikleyici | Parametre |
| --- | --- | --- |
| `first_product_added` | Kurulumda önceki ürün sayısı sıfırken başarılı manuel/CSV menü tamamlama sonucu en az bir ürün içeriyor | `method`: `manual` / `csv` |
| `menu_setup_completed` | Manuel/CSV işlemi sunucuda kurulumun menü adımını tamamlıyor | `method`: `manual` / `csv` |
| `menu_preview_click` | Tamamlama ekranındaki “Canlı menüyü gör” bağlantısına tıklanıyor | `placement`: `onboarding_complete` |

İlk ürün ve menü tamamlama genellikle aynı işlemdir. Ayrı bağımsız huni aşamaları gibi yorumlanmamalı. Önerilen ilk kullanım hunisi: `trial_started` → `menu_setup_completed` → `menu_preview_click`. `first_product_added`, ürün ekleme yöntemini incelemek için yardımcı olaydır.

Önizleme olayı sayfa yüklenmesini veya gerçek QR taramasını doğrulamaz. Tekrarlanan tıklamalar ayrı olaylardır; kullanıcı dönüşümü için kullanıcı sayısını kullanın. Kurulumu duraklatıp özel menü düzenleyicisinde devam eden kullanıcıların ürün eklemeleri bu kapsamda ölçülmez. Mevcut müşterilerin özel panel sayfalarına ölçüm eklenmedi.

## Gönderim kuralları

- Yalnızca güncel analitik izni ve etkin GA4 istemcisiyle gönderilir.
- İzin öncesi olaylar saklanmaz veya sonradan tekrar gönderilmez.
- Başarısız, boş, tamamlanmamış ya da sunucunun `replayed` döndürdüğü işlemler sayılmaz.
- Tamamlama ekranının yeniden render edilmesi veya yeniden açılması menü olaylarını tetiklemez.
- İşletme kimliği/adı, ürün bilgileri, CSV içeriği ve işletmeye özel menü URL'si gönderilmez.
- Mevcut `trial_started` gönderimi aynı isteğe bağlı yükleme ve izin kontrolünü kullanır.

## Doğrulama

Yerel kontroller: onboarding ve ilgili Ayarlar testleri 31/31, analytics domain testleri 4/4, çerez ve alt alan adı Playwright testleri 2/2. Dashboard TypeScript, değişen dosyaların ESLint ve `git diff --check` kontrolleri geçti.

Dağıtımdan sonra analitik izni verilmiş bir test oturumunda:

1. Yeni işletme kurun: `trial_started` bir kez gelmeli.
2. İlk ürünü kaydedin: `first_product_added` ve `menu_setup_completed`, `method=manual` ile gelmeli.
3. Tamamlama sayfasını yenileyin: iki menü olayı yeniden gönderilmemeli.
4. “Canlı menüyü gör” bağlantısına tıklayın: `menu_preview_click` gelmeli ve bağlantı açılmalı.
5. Ayrı bir kurulumda CSV yolunu deneyin: aynı iki olay `method=csv` ile gelmeli.
6. Reddedilmiş analitik izniyle aynı işlemleri yapın: GA4 olayları gönderilmemeli; sonradan izin vermek geçmiş işlemleri göndermemeli.
7. Hatalı ürün kaydında aktivasyon olayı gelmemeli.

Canlı doğrulama henüz yapılmadı; otomatik testler Google'a gerçek olay göndermez.

## Çerez yönetimi konumu

App içindeki sabit sol alt düğme kaldırıldı. Ayarlar → Profil → Gizlilik ve çerezler bölümündeki düğme aynı tercih panelini açar; işletme sahibi olmayan ve Ayarlar erişimi olan üyeler de Profil bölümünden ulaşabilir. Giriş/kayıt ekranlarında yasal bağlantıların yanında, kurulum ekranında ise içerik altında Çerez yönetimi bağlantısı bulunur.

İlk ziyaret izin bildirimi korunur. Tercih paneli özel panel sayfalarında elle açılabilir; bu sayfalarda analitik ölçüm başlatılmaz.
