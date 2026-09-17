# Masabu GA4 sağlayıcı ve aktarım incelemesi

10 Eylül 2026 — Teknik envanter ve belge eksikleri. Bu dosya, tamamlanmış sözleşme veya hukuki uygunluk onayı değildir. Kullanıcının “tamam yapalım” talebi incelemeyi ve teknik hazırlığı ilerletme yetkisidir; eksik sözleşmelerin mevcut olduğuna ilişkin beyan sayılmadı.

**Sonraki gelişme:** Veri İşleme Şartları 9 Eylül 2026 kabul tarihi ekranla doğrulandı; DPA kişi adı güncellendi. Kullanıcı ayrıca değerlendirme açıkken teknik açılışı açıkça istedi. Hazırlık yapıldı; üretim ortam değişikliği otomatik onay incelemesince reddedildi. Güncel durum ve kapsam [üretim açılışı kaydında](ga4-production-activation.md). Aşağıdaki ilk inceleme tarihçesi bu yeni kanıtlarla birlikte okunmalı; GA4 canlıya açılmadı.

## İnceleme sonucu

İzin yönetimi ve sınırlı olay gönderimi kaynakta mevcut. Canlı ölçüm son testte kapalı. Hesaptaki ayarlar büyük ölçüde doğrulandı. Eksik olan, Google sözleşme tarafının ve kabul edilmiş veri işleme şartlarının hesap kanıtı ile KVKK madde 9 kapsamındaki uygulanabilir aktarım dayanağının belgesidir. Üretim onay bayrağı değiştirilmedi.

## Teknik envanter

| Başlık | Mevcut kapsam / kanıt |
| --- | --- |
| İşletme | Masabu markasıyla Mustafa Furkan Çengel şahıs işletmesi; kaynak: apps/marketing/lib/legal-identity.ts. Google hesabındaki sözleşme sahibiyle eşleşmesi ayrıca teyit edilecek. |
| Amaç | Kampanya, ziyaret, iletişim talebi, doğrulanmış kayıt ve deneme başlangıcının performansı |
| Alanlar | masabu.co marketing sayfaları ve app.masabu.co izin verilen hesap edinme adımları; restoran operasyonları, misafir menüsü ve mutfak uygulaması hariç |
| Akış | Masabu Web / 15746955685 / G-VZ36SR80SB; kullanıcı ekranı |
| Olaylar | page_view, signup_click, generate_lead, sign_up, trial_started |
| Gönderilen alanlar | Temizlenmiş sayfa adresi, kaynak alan adı, izin verilen kampanya alanları; placement, topic, method veya plan |
| Sağlayıcı bağlantısı | İzin sonrasında tarayıcıdan Google etiketine ve ölçüm uçlarına; tarayıcı/oturum tanımlayıcıları ve bağlantı/cihaz bilgileri. E-posta gönderilmemesi veriyi anonim yapmaz. |
| Kapsam dışı alanlar | E-posta, telefon, form metni, işletme adı, hesap kimliği, doğrulama belirteci; URL sorgusu ve fragment olay adresinden çıkarılır. Kaynak kod incelemesi; gerçek sağlayıcı yükü testi bekliyor. |
| Rıza | Kabulden önce etiket yüklenmez; ret ve geri çekme desteklenir. GA kapalıyken eski essential seçimi gelecekte analitik izni sayılmaz. |
| Saklama | Kullanıcı/olay 14 ay, etkinlikle sıfırlama kapalı: kullanıcı teyidi. Tercih ve GA çerezi yapılandırması 180 gün. Standart toplulaştırılmış raporlar ayrı. |
| Reklam | Kodda Google Signals ve reklam kişiselleştirme kapalı. Hesapta Signals ve kullanıcı tarafından sağlanan veri toplama kapalı; ülke kişiselleştirme kapsamının kaldırıldığı kullanıcı beyanı. |
| İş analizi | Ayrıntılı konum/cihaz verisini açık tutma kararı korunuyor. Saklama veya reklam ayarları temel ölçümün yerine geçmez. |
| Dahili trafik | Kullanıcı bir IPv4 eşitlik kuralını kaydettiğini teyit etti; Internal Traffic filtresi Test. Eşleşme henüz gerçek veride doğrulanmadı; IPv6 veya değişen IP kapsanmış sayılmaz. |

## Sağlayıcı ve aktarım belgeleri

Google'ın veri işleme şartları, sözleşmedeki Google kuruluşunu esas alıyor; madde 10.1, Google veya alt işleyenlerinin tesislerinin bulunduğu ülkelerde işleme öngörüyor. Bu nedenle Türkiye veya yalnız AB içinde saklama varsayılmadı. İlgili sözleşme tarafı ve hizmete uygulanan alt işleyen kapsamı hesap belgeleriyle netleştirilmeli. [Google veri işleme şartları](https://business.safety.google/adsprocessorterms/), [alt işleyen listesi](https://business.safety.google/adssubprocessors/).

Google, Türkiye gibi AEA/Birleşik Krallık/İsviçre dışında yerleşik standart Analytics müşterileri için veri işleme şartlarının hesap ayarlarında ayrıca kabul edilmesini açıklıyor. Hesaptaki kabul tarihi ve müşteri bilgileri bu incelemeye henüz sunulmadı. [Google kabul açıklaması](https://support.google.com/analytics/answer/3379636?hl=en).

KVKK'nın aktarım açıklaması, yeterlilik kararı, uygun güvence ve arızi istisnaları ayrı yollar olarak ele alıyor. Açık rıza istisnasının arızi aktarım koşulu bulunuyor. **Bu projeye ilişkin değerlendirme:** sürekli çalışan GA4 ölçümünü yalnız çerez kabulüne dayanarak arızi aktarım saymak için dayanak yok; uygulanabilir madde 9 yolu işletmenin somut koşullarıyla doğrulanmalı. [KVKK açıklaması](https://www.kvkk.gov.tr/Icerik/2053/Yurtdisina-Aktarim).

Standart sözleşme yolu seçilirse ilgili tarafların imzaladığı Kurul metni ve bildirim kaydı gerekir; Kurum beş iş günü bildirim süresini ve metnin değişmezliğini açıklıyor. Google'ın genel veri işleme şartlarının kabulü veya AB standart sözleşme hükümleri, Türk standart sözleşmesinin imzalandığının kanıtı olarak kullanılmadı. [KVKK standart sözleşme duyurusu](https://www.kvkk.gov.tr/Icerik/8170/Yurt-Disina-Kisisel-Veri-Aktariminda-Kullanilacak-Standart-Sozlesmelerde-Dikkat-Edilmesi-Gereken-Hususlara-Iliskin-Kamuoyu-Duyurusu).

## Tamamlanacak somut kayıtlar

1. Hesap ayrıntılarında veri işleme şartlarının kabul durumu/tarihi, sözleşme sahibi ve bildirim iletişim bilgisi. Asistan işletme adına sözleşme kabul etmez.
2. İşletmenin sorumlu kişisi veya hukuk danışmanıyla uygulanabilir aktarım yolu; ilgili belge, taraflar, tarih ve gerekiyorsa bildirim kaydı. Standart sözleşme seçilirse Google'ın bu hizmet için hangi süreçle taraf olacağı teyit edilmeli; mevcut olduğu varsayılmamalı.
3. Şartlar gerektiriyorsa sağlayıcı/aydınlatma metninin sonuçla uyumlandırılması. Çerez ve gizlilik politikalarının 14 ay değişikliği şu an yerel; yayımlanmadı.
4. Teknik etkinleştirme: iki uygulamada aynı ölçüm kimliği ve yalnız tamamlanmış değerlendirmeden sonra ANALYTICS_DATA_TRANSFER_APPROVED=true; ardından derleme/yayın.
5. Gerçek test: izin öncesi ve ret sonrası sıfır GA isteği; kabulde page_view; kayıt doğrulamada sign_up; ilk onboarding'de trial_started; iletişim sunucu kabulünde generate_lead; çift olay ve kişisel alan kontrolü. Gerçek DebugView, kanal/oturum devamlılığı ve dahili trafik eşleşmesi bekliyor.

İnceleme dosyası dolduruldu diye GA4 açılmaz. Sonraki kullanıcı ekranı: Yönetici → Hesap → Hesap ayrıntıları → veri işleme şartları bölümü. Kullanıcıdan tekrar genel bir “hukuki onay tamam mı?” cevabı yerine mevcut hesap belgesi okunacak.

## Bu turdaki doğrulama

Mevcut marketing-analytics domain testleri (4), signup-analytics-receipt testleri (2) ve üretim onay kapısı testi (1) geçti: toplam 7. İlk kök dizin denemesinde tsx çözülmedi; paketlerin kendi çalışma dizinlerinden tekrar çalıştırıldı ve tamamı geçti. Google'a veri gönderilmedi; testler gerçek DebugView teslimatını doğrulamaz. git diff --check temiz. Next.js 15.5.25 doğrulandı; politika metni değişikliğinden önce resmi sürüm 15 dokümanı okundu. Yeni test veya bağımlılık eklenmedi; üretim ortam değişkenleri değiştirilmedi, yayın yapılmadı.
