# GA4 üretim açılışı — yayın hazırlanıyor

10 Eylül 2026. Güncel durum: veri/alıcı/süre kapsamı ve ret davranışı açıklandıktan sonra kullanıcı “Tamam uygulamaya geçelim” dedi. Aynı ortam değişikliği yeni onayla yeniden incelemeye sunuldu ve çalıştırıldı. Marketing ile dashboard üretiminde ölçüm kimliği ve teknik açılış anahtarı eklendi; hukuki onay kaydı oluşturulmadı. Kaynak yayını ve canlı doğrulama bu kayıt anında bekliyor. Önceki ret aşağıda tarihçe olarak korunuyor.

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
- Vercel salt okunur kontrolü: masabu-marketing ve masabu-dashboard projelerinde GA4 ve analitik açılış ortam değişkenleri yok. Süresi dolan mevcut CLI oturumu normal CLI yenilemesiyle düzeltildi; anahtarlar çıktıya yazılmadı.

## Reddedilen işlem ve devam koşulu

Reddedilen komut /tmp/masabu-ga-vercel-enable.mjs idi: Vercel API ile yalnız bu iki projede üretim için NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-VZ36SR80SB ve ANALYTICS_PRODUCTION_ENABLED=true ekleyecekti. Ortam değişkenleri eklenmeden reddedildi. İnceleme, aktarım değerlendirmesi açıkken hassas payload ve Google hedefi için yeterince spesifik kullanıcı yetkilendirmesi bulunmadığını belirtti. Başka bir kanal, hardcoded ID veya dolaylı yayın yoluyla ret aşılmadı.

Yeni kullanıcı onayı sonrası aynı işlem yeniden sunuldu ve ortam değişkenleri başarıyla eklendi; işlem başka bir kanaldan atlatılmadı. Sonraki adım yalnız ilgili kaynakları yayımlamak, iki uygulamanın aynı sürüme geçtiğini doğrulamak, gerçek Google ağ teslimatı ve kullanıcı ekranındaki DebugView/Realtime kontrolünü yapmak gerekir. Gerçek müşteri kaydı/iletişim mesajı oluşturulmadı.

Geri alma: ölçüm kimliği kaldırılıp iki uygulama yeniden yayımlanır. Yalnız teknik anahtarı false yapmak, gömülü ölçüm kimliği bulunan eski dağıtımları durdurmaz; bir sonraki derlemeyi engeller. Ortam değişikliği tek başına mevcut dağıtımları değiştirmez; canlı etkinleşme için yeni kaynak derlemesi gerekir.
