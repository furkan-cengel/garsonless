# GA4 üretim açılışı — canlı

10 Eylül 2026. Kullanıcının veri/alıcı/süre kapsamı ve ret davranışı açıklandıktan sonraki “Tamam uygulamaya geçelim” talebiyle teknik açılış tamamlandı. `b89e3c462ff635ba1c72a044d8e3db2f93f7ea44` ana dala gönderildi. Marketing ve dashboard Vercel dağıtımları READY; masabu.co ve app.masabu.co yeni sürüme bağlı. Gerçek Google uç noktası üç page_view isteğine HTTP 204 döndü. Sağlayıcı/veri aktarımı değerlendirmesi açık kalıyor; teknik açılış hukuki onay kaydı değildir.

## Kullanıcı talebi ve kapsam

Kullanıcı “GA+'ü açalım şimdilik burası olmadan aktif edemiyor muyuz” diyerek Google sağlayıcı/veri aktarımı değerlendirmesi tamamlanmadan teknik etkinleştirme istedi. Teknik açılışın hukuki uygunluk değerlendirmesini tamamlamadığı açıklandı. Google Veri İşleme Şartlarının 9 Eylül 2026'da kabul edildiği ekranla; DPA iletişim kişisinin tam adının güncellendiği kullanıcı beyanıyla doğrulandı. Türk aktarım dayanağı belge kaydı henüz yok.

Hazırlanan açılış yalnız masabu.co ve app.masabu.co edinme sayfalarında G-VZ36SR80SB akışını kapsıyor. Ziyaretçi analitik çerezlerini kabul ettiğinde Google Analytics'e tarayıcı/oturum tanımlayıcıları, cihaz/bağlantı bilgileri, bu bilgilerden türetilen konum, temizlenmiş sayfa ve kampanya bilgileri ile page_view, signup_click, generate_lead, sign_up, trial_started olayları gönderilebilir. Kullanıcı/olay saklama ayarı kullanıcı teyidiyle 14 ay; GA çerezi yapılandırması 180 gün. İlgili veri, Google sistemlerinde Türkiye dışında işlenebilir. Ad, e-posta, telefon, form metni, işletme ve hesap kimliği özel olay yüklerine eklenmez; Google Signals ve reklam kişiselleştirmesi kapalı kalır.

## Hazır değişiklikler

- next-security-headers.mjs: üretim açılışı ANALYTICS_PRODUCTION_ENABLED=true ile ayrı bir teknik karara bağlandı. ANALYTICS_DATA_TRANSFER_APPROVED hiçbir yerde true olarak yazılmadı; yeni anahtar hukuki onay kanıtı değildir.
- Marketing/dashboard .env.example: iki anahtarın açıklaması teknik açılış ve ziyaretçi iznini belirtiyor; varsayılan ölçüm kimliği boş, açılış kapalı.
- Gizlilik, çerez ve KVKK aydınlatma kaynakları: 14 ay saklama bilgisi, Google'a aktarımın fiilî kapsamı ve çerez kabulünün ayrı aktarım yükümlülüklerinin yerine geçmediği açıklaması. Politika gösterim tarihi 2026-09-10. Genel hizmet/operasyon veri işleme eki değiştirilmedi.
- Ziyaretçi tercih sürümü değiştirilmedi: eski essential kayıtları GA açıldığında yeniden tercih ister; önceki ret korunur.
- Mevcut yerel tarayıcı testinde ilk Next dev derlemesi için gezinme beklemesi 20 saniye yapıldı. Olay sayımı ve gizlilik kontrolleri gevşetilmedi.

## Kontroller

- Üretim açılış anahtarı testi geçti; eski hukuki onay anahtarı tek başına üretimi açmıyor.
- Next.js kuralları: 12 test geçti.
- Değişen politika sayfalarının ESLint kontrolü, marketing TypeScript kontrolü ve git diff --check geçti. Yerel test sunucusunun next-env.d.ts/tsconfig.json dosyalarında oluşturduğu geçici değişiklikler kaldırıldı.
- Yerel tarayıcı: 2 test geçti. Kabul öncesi yükleme yok; ret, geri çekme, temizlenmiş olay adresleri, tek sayfa olayı, alanlar arası tercih, kayıt işaretinin tek tüketimi ve kapsam dışı sayfalarda durdurma doğrulandı. Google etiket yanıtı taklit edildi; gerçek Google teslimatı değildir.
- Açılış öncesi Vercel salt okunur kontrolünde masabu-marketing ve masabu-dashboard projelerinde GA4 ve analitik açılış ortam değişkenleri yoktu. Açılışta iki projeye yalnız üretim kapsamıyla eklendi (ga4-production-env.json). Süresi dolan mevcut CLI oturumu normal CLI yenilemesiyle düzeltildi; anahtarlar çıktıya yazılmadı.

## Reddedilen işlem ve devam koşulu

Reddedilen komut /tmp/masabu-ga-vercel-enable.mjs idi: Vercel API ile yalnız bu iki projede üretim için NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-VZ36SR80SB ve ANALYTICS_PRODUCTION_ENABLED=true ekleyecekti. Ortam değişkenleri eklenmeden reddedildi. İnceleme, aktarım değerlendirmesi açıkken hassas payload ve Google hedefi için yeterince spesifik kullanıcı yetkilendirmesi bulunmadığını belirtti. Başka bir kanal, hardcoded ID veya dolaylı yayın yoluyla ret aşılmadı.

Yeni kullanıcı onayı sonrası aynı işlem yeniden sunuldu ve ortam değişkenleri başarıyla eklendi; işlem başka bir kanaldan atlatılmadı. İlgili kaynaklar yayımlandı; iki uygulama aynı sürümde doğrulandı. Gerçek Google ağ teslimatı aşağıda kayıtlıdır; kullanıcı hesabındaki DebugView/Realtime rapor doğrulaması ayrı adımdır. Gerçek müşteri kaydı/iletişim mesajı oluşturulmadı.

Geri alma: ölçüm kimliği kaldırılıp iki uygulama yeniden yayımlanır. Yalnız teknik anahtarı false yapmak, gömülü ölçüm kimliği bulunan eski dağıtımları durdurmaz; bir sonraki derlemeyi engeller. Ortam değişikliği tek başına mevcut dağıtımları değiştirmez; canlı etkinleşme için yeni kaynak derlemesi gerekir.


## Canlı doğrulama ve sınırlar

- `ga4-production-deployments.json`: iki üretim dağıtımı READY ve aynı kaynak SHA.
- `ga4-live-policy-check.json`: üç politika sayfası HTTP 200 ve 10 Eylül sürüm tarihi; çerez ve gizlilik metinlerinde 14 ay saklama.
- `ga4-live-activation-test.json`: temiz tarayıcıda seçimden önce ve reddedip yeniden yükledikten sonra sıfır GA isteği/çerezi/etiketi. Kabulden sonra ana sayfa, QR menü ve kayıt sayfasında doğru ölçüm kimliğine page_view/HTTP 204. QR menü gezinmesinde tek page_view. Alan adı geçişinde istemci ve oturum kimliği eşitliği bellekte karşılaştırıldı; ham kimlikler rapora yazılmadı.
- İzole test olayları debug_mode ve traffic_type=internal ile işaretlendi. Dahili trafik filtresi Test durumunda olduğu için bu işaretleme tek başına raporlardan dışlanma anlamına gelmez. Kullanıcının IP kuralının eşleşmesi ayrıca doğrulanmadı.
- İzni geri çekip yeniden yükleyince GA çerezleri ve etiketi sıfır; dashboard ve marketing üzerinde sonraki GA isteği sıfır.
- İlk çalıştırma signup_click HTTP yanıtını gözleyemediği için başarısızdı; `ga4-live-activation-first-attempt.json` korunuyor. İkinci çalıştırma navigasyon sırasında signup_click ağ isteğini doğruladı, ancak bu isteğin HTTP yanıtı gözlenmedi. İstek çıkışını Google raporunda görünmüş olmakla eşitlemiyoruz.
- Gerçek müşteri kaydı, deneme hesabı ve iletişim mesajı oluşturulmadı. sign_up, trial_started ve generate_lead başarılı iş akışlarının gerçek Google teslimatı kullanıcıyla yapılacak sonraki doğrulamadır; yerel tetikleme kontrolleri gerçek teslimat kanıtı değildir.
- CI: Architecture CI başarılı. Dashboard Visual Gate/Tables Runtime Gate menü bundle bütçesi; Public Quality Gate mobil performans/LCP nedeniyle başarısız. Önceki sürümde de aynı kategoriler açık olduğundan GA açılışına bağlı yeni bir bozulma olduğu gösterilmedi. Bütçeler gevşetilmedi. Sayısal kanıt `ga4-ci-failures.json` içinde; tüm CI yeşil diye raporlanmamalı.

- `ga4-live-signup-click-diagnostic.json`: Google isteklerine müdahale edilmeyen ayrı testte, ilk kayıt tıklamasının varsayılan gezinmesi yalnız yanıt gözlemi için bir kez tutuldu; signup_click için HTTP 204 doğrulandı. Sonraki tıklama normal biçimde kayıt sayfasına gitti ve yine istek çıktı. Bu, olay yükünün ve sağlayıcı bağlantısının çalıştığını doğrular; normal sayfa çıkışındaki her isteğin rapora işlendiği garantisi değildir. Üretim kodunda gezinmeyi geciktiren bir değişiklik yapılmadı. Ret/geri çekme ve oturum sürekliliği bu testte de geçti.
