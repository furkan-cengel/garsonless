# QR menü — 100 örnek çeviri incelemesi

18 Eylül 2026 · DEV · `gpt-5.4-mini-2026-03-17`

**Durum: çeviriler üretildi; insan onayı bekliyor.** Teknik işlemlerin başarılı olması anlam doğruluğu onayı değildir. Aşağıdaki notlar asistanın ön incelemesidir; insan değerlendirmesi yerine geçmez. Hiçbir örnek müşteri menüsüne yayınlanmadı.

İncelemeci [evaluation-review.json](evaluation-review.json) dosyasında her satırın `acceptable`, `criticalError`, `reviewer` ve `note` alanlarını doldurur. Hedef: 100 tamamlanmış inceleme, sıfır kritik hata, en az %95 kabul. Aynı örnekler talimat iyileştirmesinde kullanıldığı için bağımsız kalite ölçümü sayılmaz; gerçek işletme pilotunda yeni içerikler ayrıca incelenir.

| # | Türkçe | İngilizce taslak | Ön inceleme notu |
| --- | --- | --- | --- |
| 1 | Başlangıçlar | Appetizers |  |
| 2 | Sıcak mezeler | Hot appetizers |  |
| 3 | Soğuk mezeler | Cold appetizers |  |
| 4 | Ana yemekler | Main courses |  |
| 5 | Günün çorbası | Soup of the day |  |
| 6 | Izgara çeşitleri | Grill varieties |  |
| 7 | Deniz ürünleri | Seafood |  |
| 8 | Çocuk menüsü | Children's menu |  |
| 9 | Kahvaltılıklar | Breakfast items |  |
| 10 | Ev yapımı tatlılar | Homemade desserts |  |
| 11 | Sıcak içecekler | Hot drinks |  |
| 12 | Soğuk içecekler | Cold drinks |  |
| 13 | Alkolsüz kokteyller | Non-alcoholic cocktails |  |
| 14 | Vegan seçenekler | Vegan options |  |
| 15 | Vejetaryen seçenekler | Vegetarian options |  |
| 16 | Fırından taze | Fresh from the oven |  |
| 17 | Paylaşmalık tabaklar | Sharing platters |  |
| 18 | Mevsim salataları | Seasonal salads |  |
| 19 | Yan lezzetler | Side dishes |  |
| 20 | Şefin önerileri | Chef's recommendations |  |
| 21 | Mantı | Mantı | İlk üretimde yemek adı çevrilmişti; bu sürümde Mantı korunuyor. |
| 22 | Menemen | Menemen |  |
| 23 | İskender | İskender |  |
| 24 | İçli köfte | Stuffed meatballs |  |
| 25 | Kuru fasulye | White beans |  |
| 26 | Mercimek çorbası | Lentil soup |  |
| 27 | Fırın sütlaç | Baked rice pudding |  |
| 28 | Kazandibi | Kazandibi |  |
| 29 | Zeytinyağlı enginar | Artichoke with olive oil |  |
| 30 | Izgara levrek | Grilled sea bass |  |
| 31 | Közlenmiş patlıcan salatası | Roasted eggplant salad |  |
| 32 | Fırında sebzeli tavuk | Baked chicken with vegetables |  |
| 33 | Keçi peynirli salata | Goat cheese salad |  |
| 34 | Tahinli kabak tatlısı | Tahini pumpkin dessert |  |
| 35 | Et suyu ile hazırlanan pirinç pilavı | Rice pilaf prepared with meat stock |  |
| 36 | Yoğurt, sarımsak ve tereyağlı sos ile servis edilir. | Served with yogurt, garlic and butter sauce. |  |
| 37 | Nohut, tahin, limon ve zeytinyağı ile hazırlanır. | Prepared with chickpeas, tahini, lemon and olive oil. |  |
| 38 | Masabu Özel Burger | Masabu Special Burger |  |
| 39 | Coca-Cola Zero Sugar | Coca-Cola Zero Sugar |  |
| 40 | Türk kahvesi | Turkish coffee |  |
| 41 | Dana eti | Beef |  |
| 42 | Kuzu eti | Lamb |  |
| 43 | Tavuk göğsü | Chicken breast |  |
| 44 | Hindi füme | Smoked turkey |  |
| 45 | Domuz pastırması | Pork bacon |  |
| 46 | Süzme yoğurt | Strained yogurt |  |
| 47 | Tereyağı | Butter |  |
| 48 | Sade yağ | Clarified butter |  |
| 49 | Tahin | Tahini |  |
| 50 | Yer fıstığı | Peanuts |  |
| 51 | Antep fıstığı | Antep pistachios |  |
| 52 | Ceviz | Walnuts |  |
| 53 | Badem | Almonds |  |
| 54 | Kereviz sapı | Celery stalk |  |
| 55 | Hardal tohumu | Mustard seeds |  |
| 56 | Susam | Sesame |  |
| 57 | Acı bakla | Lupin |  |
| 58 | Karides | Shrimp |  |
| 59 | Midye | Mussels |  |
| 60 | Soya sosu | Soy sauce |  |
| 61 | Süt ve yumurta içerir. | Contains milk and egg. |  |
| 62 | Eser miktarda yer fıstığı içerebilir. | May contain traces of peanuts. |  |
| 63 | Gluten içeren ürünlerle aynı ekipmanda hazırlanır. | Prepared on equipment used for products containing gluten. |  |
| 64 | Bu ürün glutensiz değildir. | This product is not gluten-free. |  |
| 65 | Alkol içerir. | Contains alcohol. |  |
| 66 | Domuz kaynaklı bileşen içerir. | Contains pork-derived ingredients. |  |
| 67 | Vegan değildir; bal içerir. | Not vegan; contains honey. |  |
| 68 | Vejetaryen değildir; et suyu içerir. | Not vegetarian; contains meat stock. | İlk üretimde et bilgisi eksilmişti; bu sürüm meat stock kullanıyor. |
| 69 | Süt ürünü içermez; yumurta içerir. | Contains no dairy; contains egg. |  |
| 70 | Şeker ilavesizdir; doğal olarak şeker içerir. | No added sugar; contains naturally occurring sugar. |  |
| 71 | Laktozsuz süt ile hazırlanır. | Prepared with lactose-free milk. |  |
| 72 | Çiğ balık içerir. | Contains raw fish. |  |
| 73 | İçeriğin çıkarılması alerjensiz olduğunu garanti etmez. | Removing the ingredient does not guarantee it is allergen-free. |  |
| 74 | 250 g dana eti ile hazırlanır. | Prepared with 250 g beef. |  |
| 75 | 330 ml şişe içecek | 330 ml bottled drink |  |
| 76 | 1,5 l su | 1,5 l water |  |
| 77 | 0.5 kg paket | 0.5 kg pack |  |
| 78 | 2 adet köfte ve 100 g patates | 2 meatballs and 100 g potatoes |  |
| 79 | Acı sos ayrı servis edilir. | Hot sauce is served separately. |  |
| 80 | Sipariş öncesinde alerjiniz hakkında personeli bilgilendirin. | Inform staff about your allergy before ordering. |  |
| 81 | Pişirme derecesi | doneness |  |
| 82 | Az pişmiş | rare |  |
| 83 | Orta pişmiş | medium | İlk üretim medium rare idi; bu sürüm medium. |
| 84 | İyi pişmiş | well done |  |
| 85 | Soğan olmasın | No onion |  |
| 86 | Sarımsaksız | No garlic |  |
| 87 | Sossuz | No sauce |  |
| 88 | Sosu ayrı olsun | Sauce on the side |  |
| 89 | Ekstra peynir | Extra cheese |  |
| 90 | Çift köfte | Double meatball | Ürün bağlamını inceleyin: double patty veya iki köfte olabilir; double meatball ifadesi bağlamsız. |
| 91 | Süt seçimi | Milk selection |  |
| 92 | Yulaf içeceği | Oat drink |  |
| 93 | Badem içeceği | Almond drink |  |
| 94 | Laktozsuz süt | Lactose-free milk |  |
| 95 | Şekersiz | Sugar-free | Bağlamı inceleyin: şekersiz ifadesi içecek siparişinde no sugar/unsweetened olabilir; sugar-free bir beslenme iddiası olarak anlaşılabilir. |
| 96 | Az şekerli | Less sugar |  |
| 97 | Buzsuz | No ice |  |
| 98 | Az buzlu | Light ice |  |
| 99 | Acısız | No spice | Acısız için not spicy daha açık; no spice tüm baharatların çıkarılacağı izlenimi verebilir. |
| 100 | Çok acılı | Very spicy |  |
