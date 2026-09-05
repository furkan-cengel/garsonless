# LCP iyileştirmeleri — 5 Eylül 2026

İlk optimizasyonlar uygulandı. Yerel production build üzerinde Lighthouse mobil LCP medyanı pazarlamada **4,29 → 3,90 saniye**, QR menüde **4,14 → 3,84 saniye** oldu. Her iki rota da Lighthouse için belirlenen **2,5 saniye sınırının üzerinde**; LCP işi tamamlanmış sayılmamalı. Bu çalışma production'a deploy edilmedi.

## Uygulanan değişiklikler

1. **QR menü veri zinciri:** Katalog revizyonu → kategoriler → ürünler zinciri, tema/yetki ve müşteri oturumu sorgularından bağımsız ilerliyor. Ana menü, V2 ana sayfa ve masa rotası güncellendi. Masa rotasında restoran ve public masa durumu paralel okunuyor; tokenın restoran ve slug eşleşmesi denetlenmeye devam ediyor. Plan kontrolleri sonuçlanmadan içerik döndürülmüyor. Tenant ve revizyon temelli cache anahtarları değişmedi.
2. **Gerçek ilk ürün görseli:** Öncelik veritabanındaki kategori sırasından değil, yayımlanmış temanın ekranda kullandığı kategori sırasından belirleniyor. Lighthouse'ın LCP olarak seçtiği ilk ürün önceden `lazy/auto`, son ölçümde `eager/high` yükleniyor ve ilk HTML'de keşfedilebiliyor. Görsel kategori girişinde gizli ürünlere öncelik verilmiyor.
3. **Kupon sorgusu:** Bağlı kupon kartı bulunmayan temalarda gereksiz aktif kupon sorgusu atlanıyor. Kupon kartı olan temalar canlı veriyi okumayı sürdürüyor.
4. **Pazarlama fontu:** Fraunces'in Türkçe ve temel Latin karakterlerini içeren 77.928 baytlık alt kümesi üretildi; ağırlık ve optik boyut eksenleri korundu. Önceki dosya 102.960 bayttı. Diğer Latin karakterleri için orijinal dosya unicode aralığıyla gerektiğinde yükleniyor. Lisans ve üretim scripti depoda tutuluyor.
5. **Ekran altındaki görseller:** Deneme ve süreç bölümlerindeki görsellerin yüksek yükleme önceliği kaldırıldı. Tasarım ve içerik değiştirilmedi.

Kaynaklar: [katalog yükleyici](../../../apps/menu/lib/menu-catalog-loader.ts), [menü veri akışı](../../../apps/menu/app/[slug]/_menu-experience.tsx), [görsel önceliği](../../../packages/ui/src/themes/default/MenuPage.tsx), [font tanımları](../../../apps/marketing/app/layout.tsx), [font üretimi](../../../scripts/generate-marketing-font-subset.py).

## Lighthouse ölçümleri

Next.js **15.5.25**, yerel production build, Lighthouse **12.6.1** ve `.lighthouserc.mobile.json`; her aşamada rota başına üç ölçüm. Aşağıdaki değerler medyandır. Rotalar: `http://127.0.0.1:3003/` ve `http://127.0.0.1:3011/maf-lounge`.

| Ölçüt | Pazarlama önce | Pazarlama sonra | QR menü önce | QR menü sonra |
|---|---:|---:|---:|---:|
| LCP | 4.290 ms | 3.899 ms | 4.142 ms | 3.840 ms |
| FCP | 1.372 ms | 1.378 ms | 1.363 ms | 1.365 ms |
| Sunucu yanıtı (`server-response-time`) | 21 ms | 73 ms | 1.614 ms | 1.290 ms |
| TBT | 34 ms | 58 ms | 48 ms | 43 ms |
| CLS | 0,00193 | 0,00193 | 0,00031 | 0,00031 |

Pazarlama font transferi **168.383 → 143.350 bayt**. QR menünün ilk JavaScript transferi yaklaşık **322 KB** seviyesinde kaldı. Bu çalışma JS paketini küçültmüş sayılmaz.

Son LCP koşuları: pazarlama **3.966 / 3.899 / 3.782 ms**; menü **4.000 / 3.840 / 3.039 ms**. Sunucu/veri cache'i kontrol edilmediğinden süre farkları kesin nedensel kazanım veya production garantisi değildir. Pazarlama TBT ve sunucu yanıtı medyanları bu örneklemde arttı; bütün metrikler iyileşti denemez.

Lighthouse'ın raporladığı LCP, ağ ve CPU için simülasyon sonucudur. İzdeki yavaşlatılmamış gözlemler ve `lcp-phases-insight` değerleriyle doğrudan eşitlenmemelidir. Aşağıdaki Playwright ölçümü de ayrı bir laboratuvar profilidir; ikisi gerçek kullanıcı verisi değildir.

## Ayrı mobil tarayıcı testi

`tests/smoke/menu-mobile-performance.spec.ts`: Pixel 7, 150 ms gecikme, 1,6 Mbps indirme; CPU yavaşlatması yok. Soğuk/sıcak ayrımı tarayıcı cache'i içindir, sunucu cache'i kontrol edilmedi.

| QR menü | Soğuk tarayıcı | Sıcak tarayıcı |
|---|---:|---:|
| LCP | 1.616 ms | 1.140 ms |
| CLS | 0,00040 | 0,03891 |
| TTFB | 881 ms | 993 ms |
| Ürün tıklamasından dialog açılmasına | 921 ms | 66 ms |

Bu testin LCP, CLS ve JS bütçeleri geçti; **testin tamamı başarısız**, çünkü ilk ürün detayının açılması 300 ms sınırını aştı. Bu etkileşim süresi saha INP metriği değildir. Bütçeler gevşetilmedi.

## Doğrulama

| Kontrol | Sonuç |
|---|---|
| Menü testleri | 162 geçti |
| UI testleri | 133 geçti |
| Pazarlama testleri | 35 geçti |
| Next.js konvansiyon kontrolleri | 12 geçti |
| Workspace lint ve typecheck | Geçti |
| Knip | Geçti |
| Menü ve pazarlama production build | Geçti |
| Chromium, Firefox, WebKit kritik gezinme testleri | 3 geçti |
| QR menü mobil performans testi | İlk ürün etkileşim süresi nedeniyle başarısız |
| Lighthouse mobil LCP bütçesi | İki rotada da 2,5 saniyenin üzerinde |

Yeni davranış testleri katalog sorgularının bağımsız ilerlemesini, tenant/revizyon ayrımını, hata yayılımını ve SSR'da tema sırasına göre görsel önceliğini kapsıyor. Kaynak metni eşleyen mevcut testler davranış kanıtı olarak kullanılmadı. Font alt kümesinin Türkçe karakterleri, yatay glif metrikleri ve değişken eksenleri orijinalle karşılaştırıldı. Son font fallback düzeltmesinden sonra pazarlama build/lint ve üç Lighthouse koşusu tekrarlandı; diğer uygulama kodu bu düzeltmeden etkilenmedi.

## Kalan işler ve doğrulama sırası

1. **QR menünün başlangıç JS yükü:** `MenuPageClient` ve ortak renderer importlarını bundle analiziyle ayır; ilk ekran için gerekmeyen hesap, sipariş ve panel kodlarını böl. İlk ürün dialogunu yalnız tıklamada indirmek soğuk etkileşimi kötüleştirebilir; ilk görünür ürün için hazır olma stratejisini aynı 300 ms testiyle doğrula.
2. **Sunucu bekleme süresi:** Production bölgesi ile veritabanı bölgesini ve sorgu sürelerini ölç. Müşteriye özel oturum/sadakat verisinin ilk public menü render'ını bekletmesini ayrı bir render sınırıyla azaltmayı değerlendir. Yetki ve tenant izolasyonunu koruyarak giriş yapmış/giriş yapmamış kullanıcıları ayrı test et.
3. **Pazarlama kritik kaynak zinciri:** Font küçültmeden sonra kalan CSS/JS ve hero bağımlılıklarını production trace üzerinden incele. Lighthouse simülasyonundaki render gecikmesini, başlığın gerçekte o kadar süre görünmediği şeklinde yorumlama.
4. **Aynı profilde tekrar ölç:** Production adreste üçten fazla koşu, kontrollü soğuk/sıcak cache ve mevcut bütçelerle doğrula. Ardından gerçek kullanıcı Web Vitals verisinde mobil p75 LCP'yi takip et. Yerel sonuçlardan saha p75 çıkarılamaz.

## Kanıtlar ve referanslar

- [Önce/sonra ölçüm verileri](evidence/lcp-optimization/measurements.json)
- [Soğuk mobil ölçüm](evidence/lcp-optimization/cold-browser.json), [sıcak mobil ölçüm](evidence/lcp-optimization/warm-browser.json)
- Pazarlama: [önce](evidence/lcp-optimization/marketing-before.jpg), [sonra](evidence/lcp-optimization/marketing-after.jpg)
- QR menü: [önce](evidence/lcp-optimization/menu-before.jpg), [sonra](evidence/lcp-optimization/menu-after.jpg)
- [Next.js 15 veri okuma ve paralel sorgular](https://nextjs.org/docs/15/app/getting-started/fetching-data), [Next.js 15 Image](https://nextjs.org/docs/15/app/api-reference/components/image), [web.dev LCP optimizasyonu](https://web.dev/articles/optimize-lcp)
