import type { BillableFeature } from '@garsonless/domain/entitlements'

export type ProductPage = {
  slug: string; name: string; title: string; description: string; feature: BillableFeature
  heading: string; problem: string; image: string; imageAlt: string; illustrationAlt: string
  workflow: readonly string[]; workflowIllustration?: { src: string; alt: string }
  details: readonly { title: string; body: string; illustration?: { src: string; alt: string } }[]
  faqs: readonly { question: string; answer: string }[]; guide: string
}

export const PRODUCT_PAGES: readonly ProductPage[] = [
  {
    workflowIllustration: { src: '/illustrations/qr-menu-workflow.svg', alt: 'Panelde hazırlanan dijital menünün masa QR koduyla misafirin telefonuna ulaşması' },
    slug: 'qr-menu', name: 'QR Menü', title: 'QR Menü ve Dijital Menü Sistemi | masabu', feature: 'qr_menu',
    illustrationAlt: 'Masadaki QR kodla telefonundan dijital menüyü inceleyen misafir illüstrasyonu',
    description: 'Kafe ve restoranınızın dijital menüsünü oluşturun; ürünleri, fiyatları ve görünümü tek panelden güncelleyin. masabu QR menüyü 14 gün ücretsiz deneyin.',
    heading: 'Menünüzü güncelleyin. Her masada aynı bilgi görünsün.',
    problem: 'Basılı menü değişikliklerinde her masadaki fiyatı tek tek kontrol etmek gerekir. PDF dosyaları ise telefonda yakınlaştırma ve sayfalar arasında gezinme yükü getirir. masabu dijital menüde kategori, ürün ve seçenekleri işletmenin yönettiği bir yapıda bir araya getirir. Misafir uygulama indirmeden QR kodun açtığı menüyü inceleyebilir.',
    image: '/product/about-product-flow.webp', imageAlt: 'masabu dijital menüsünde ürün seçenekleri ve alerjen bilgilerinin örnek görünümü',
    workflow: ['Ürünleri kategorilere ayırın; fiyat, açıklama, görsel ve seçenekleri ekleyin.', 'Logo, renk, tipografi ve kart düzenlerini markanıza göre seçin.', 'Önizlemede mobil görünümü kontrol edin ve temayı yayınlayın.', 'QR Studio ile masa kodlarını hazırlayın; baskıdan sonra gerçek telefonla okutun.'],
    details: [
      { illustration: { src: '/illustrations/qr-menu-details.svg', alt: 'Ürün fotoğrafı, içerik ve porsiyon seçenekleriyle anlaşılır bir dijital menü' }, title: 'Menüde karar vermeyi kolaylaştırın', body: 'Ürün açıklamaları, porsiyon seçenekleri ve alerjen alanlarını tutarlı doldurun. Misafirlerin menüyü okuyabilmesi için hesabı olması gerekmez. Ürün fotoğrafı bulunmayan öğelerde de fiyat ve içerik bilgisi anlaşılır kalır.' },
      { illustration: { src: '/illustrations/qr-menu-growth.svg', alt: 'Dijital menüden masa yönetimi ve mutfak operasyonuna uzanan işletme ihtiyaçları' }, title: 'Menüyü büyüyen operasyonunuza bağlayın', body: 'QR menü Starter ile başlar. Personelin adisyon takibi ve misafirin QR üzerinden sipariş vermesi farklı yeteneklerdir; ihtiyaç arttığında uygun pakete geçebilirsiniz. Menü yayını aktif abonelik veya deneme erişimi gerektirir.' },
    ],
    faqs: [
      { question: 'QR menü için uygulama indirmek gerekiyor mu?', answer: 'Hayır. Misafir kodu telefonuyla okutup menüyü tarayıcıda açar.' },
      { question: 'QR menü paketi sipariş almayı da içeriyor mu?', answer: 'Starter dijital menü içindir. Personel siparişi Plus, misafirin sepet oluşturup QR siparişi vermesi Pro kapsamındadır.' },
      { question: 'Deneme sonunda menü ücretsiz kalıyor mu?', answer: '14 günlük Pro denemesi sonrasında ücretli plan seçilmezse menü yayını durur; işletme verileri korunur. Süresiz ücretsiz plan sunulmaz.' },
    ], guide: 'qr-menu-kurulum-rehberi',
  },
  {
    workflowIllustration: { src: '/illustrations/dijital-adisyon-workflow.svg', alt: 'Masa siparişinden adisyona ve tahsilat kaydına uzanan dijital akış' },
    slug: 'dijital-adisyon', name: 'Dijital Adisyon', title: 'Kafe ve Restoranlar için Dijital Adisyon Sistemi | masabu', feature: 'table_management',
    illustrationAlt: 'Tabletinden masaları ve dijital adisyonu yöneten restoran personeli illüstrasyonu',
    description: 'Masa, personel siparişi, adisyon ve tahsilatı masabu ile aynı akışta takip edin. Kafe ve restoranlar için dijital adisyon paketlerini inceleyin.',
    heading: 'Masayı açın. Siparişten tahsilata aynı kaydı izleyin.',
    problem: 'Sipariş notu, mutfak bilgisi ve hesap ayrı yerlerde tutulduğunda masanın güncel durumunu anlamak zorlaşır. Dijital adisyon; ekibin masa, ürünler ve tahsilat durumunu aynı operasyon içinde takip etmesini sağlar. masabu Canlı Masalar ekranıyla personelin manuel siparişlerini ve hesap işlemlerini birlikte yönetebilirsiniz.',
    image: '/product/payment-cart.jpg', imageAlt: 'masabu ürünündeki hesap ve ödeme akışının örnek görünümü',
    workflow: ['Salon ve masaları işletmenize göre düzenleyin.', 'İlgili masaya personel siparişini girin; ürün seçeneklerini kontrol edin.', 'Masanın açık adisyonunu ve sipariş durumlarını takip edin.', 'Tahsilatı kaydedin; gün sonunda masa, ürün ve ödeme raporlarını inceleyin.'],
    details: [
      { illustration: { src: '/illustrations/dijital-adisyon-team.svg', alt: 'Personel erişimleriyle birlikte takip edilen masa ve adisyon işlemleri' }, title: 'Ekibin yaptığı işlemler görünür olsun', body: 'Masa ve adisyon operasyonunu ekip rolleriyle birlikte kullanın. İşletmenin personeline göre erişim vererek herkesin ihtiyacı olan çalışma alanını açın. Tahsilat kaydı, misafirin internet üzerinden kartla ödeme yapmasından ayrı bir özelliktir.' },
      { illustration: { src: '/illustrations/dijital-adisyon-scope.svg', alt: 'Masa ve tahsilat yönetiminin yanındaki QR sipariş ve mutfak seçenekleri' }, title: 'İhtiyacınıza uygun kapsamla başlayın', body: 'Plus paketi personel siparişi, masa yönetimi, tahsilat ve temel raporları kapsar. QR sipariş ve mutfak ekranı gerektiğinde Pro kullanılabilir. POS/ÖKC ve özel entegrasyonlar standart paket kapsamı olarak sunulmaz; ayrıca değerlendirilir.' },
    ],
    faqs: [
      { question: 'Dijital adisyon için her misafirin QR okutması gerekir mi?', answer: 'Hayır. Personel siparişi manuel girebilir; misafirin QR siparişi vermesi ayrı bir Pro özelliğidir.' },
      { question: 'Online ödeme Plus paketinde var mı?', answer: 'Personelin tahsilat kaydı Plus kapsamındadır. İyzico online ödeme ise Pro için ayrıca satılan bir eklentidir.' },
      { question: 'Mevcut POS cihazımla doğrudan çalışır mı?', answer: 'POS/ÖKC ve özel entegrasyon ihtiyacı cihaz ve kapsam bazında değerlendirilir. Standart pakete otomatik uyumluluk varsayılmamalıdır.' },
    ], guide: 'kafelerde-dijital-adisyona-gecis',
  },
  {
    workflowIllustration: { src: '/illustrations/qr-siparis-workflow.svg', alt: 'Misafirin oluşturduğu sepetin masa bilgisiyle işletmenin sipariş ekranına ulaşması' },
    slug: 'qr-siparis', name: 'QR Sipariş', title: 'Masadan QR Sipariş Sistemi | masabu', feature: 'guest_ordering',
    illustrationAlt: 'Telefonundan sipariş veren misafir ve masasına bağlanan sipariş illüstrasyonu',
    description: 'Misafirleriniz masadaki QR ile ürün seçsin ve sipariş versin. QR sipariş, servis çağrısı ve restoran operasyonunu masabu Pro ile birleştirin.',
    heading: 'Misafir seçsin. Sipariş doğru masaya bağlansın.',
    problem: 'Menüyü dijitalleştirmek ve sipariş almak farklı ihtiyaçlardır. masabu QR sipariş akışı, misafirin ürün seçeneklerini belirleyip sepetini oluşturmasını ve siparişini masasıyla ilişkilendirmesini sağlar. Ekip siparişi işletmenin operasyon ekranından takip eder; misafir de servis çağrısı gibi desteklenen işlemleri menüden başlatabilir.',
    image: '/product/about-product-flow.webp', imageAlt: 'masabu menüsünde ürün seçimi ve sepete ekleme ekranı',
    workflow: ['Pro erişimini ve işletmenizin sipariş kabul durumunu kontrol edin.', 'QR Studio üzerinden her masa için doğru bağlantıyı hazırlayın.', 'Misafir ürünleri, ek seçenekleri ve miktarı sepetinde kontrol etsin.', 'Gelen siparişi operasyon ekranından izleyin; mutfak ve servis akışına devam edin.'],
    details: [
      { illustration: { src: '/illustrations/qr-siparis-options.svg', alt: 'Ürün boyutu, ek malzeme ve miktar seçimlerinin sipariş sepetine eklenmesi' }, title: 'Ürün seçenekleri siparişin parçası olsun', body: 'Boyut ve ek malzeme gibi seçenekleri ürünle birlikte tanımlayın. Menüde gösterilen seçimler, misafirin talebini personelin yeniden yorumlamasını azaltır. Yayına geçmeden önce seçenekli ürünlerle gerçek masa QR akışını test edin.' },
      { illustration: { src: '/illustrations/qr-siparis-payment.svg', alt: 'QR sipariş akışı ve isteğe bağlı online ödeme eklentisinin ayrı gösterimi' }, title: 'Sipariş ile ödemeyi ayrı değerlendirin', body: 'masabu sipariş başına komisyon almaz. Online kart ödemesi istenirse Pro üzerine İyzico eklentisi ve sağlayıcının işlem koşulları ayrıca uygulanır. Fiziksel QR standı ve profesyonel kurulum da ayrı hizmetlerdir.' },
    ],
    faqs: [
      { question: 'QR sipariş hangi pakette bulunuyor?', answer: 'Misafir sepeti ve QR siparişi Pro kapsamındadır. Business kapsamı şube ve kurulum ihtiyacına göre belirlenir.' },
      { question: 'Sipariş başına komisyon var mı?', answer: 'masabu sipariş başına komisyon almaz. İyzico kullanılırsa ödeme sağlayıcısının işlem ücretleri ayrıca geçerli olabilir.' },
      { question: 'Tek bir QR bütün masalara yeter mi?', answer: 'Genel menü bağlantısı menüyü açar. Masaya bağlı sipariş için her masanın kendi QR bağlantısını kullanın.' },
    ], guide: 'siparisten-mutfaga-operasyon-akisi',
  },
  {
    workflowIllustration: { src: '/illustrations/kds-workflow.svg', alt: 'Masaya ait siparişin mutfak ve bar hazırlık ekranlarına yönlendirilmesi' },
    slug: 'mutfak-ekrani', name: 'Mutfak Ekranı', title: 'Mutfak Ekranı ve KDS Sistemi | masabu', feature: 'kitchen_display',
    illustrationAlt: 'Mutfak ekranında siparişlerin hazırlık durumunu takip eden şef illüstrasyonu',
    description: 'Restoran siparişlerini mutfak ve hazırlık istasyonlarında takip edin. masabu KDS ile hazırlık ve servis durumlarını aynı operasyon içinde yönetin.',
    heading: 'Sipariş mutfağa ulaşsın. Hazırlık durumu görünür kalsın.',
    problem: 'Yoğun serviste masadan gelen bilginin mutfak ve bar arasında taşınması zaman alır. KDS, siparişleri hazırlık ekranında görünür kılar ve ekibin hangi işin beklediğini takip etmesini sağlar. masabu mutfak ekranı ve istasyonları, sipariş yönetimiyle aynı operasyonun parçasıdır.',
    image: '/problem-solution/after/03-kitchen-sync.svg', imageAlt: 'Siparişin mutfak ve hazırlık istasyonlarına aktarılmasını anlatan masabu iş akışı çizimi',
    workflow: ['Mutfak ve bar gibi hazırlık istasyonlarını tanımlayın.', 'Ekibin uygun KDS erişimini ve kullanılan cihazın bağlantısını kontrol edin.', 'Yeni siparişleri hazırlık ekranında takip edin ve durumlarını güncelleyin.', 'Hazır ürünleri servisle koordine edin; masa operasyonunu aynı akıştan izleyin.'],
    details: [
      { illustration: { src: '/illustrations/kds-stations.svg', alt: 'Servis öncesi istasyonları ve ekip erişimini kontrol eden mutfak şefi' }, title: 'Servis öncesinde istasyonları deneyin', body: 'Farklı istasyonlara giden ürünlerle örnek bir sipariş çalıştırın. Hangi ekibin hangi ekranı takip edeceğini ve hazır durumuna kimin geçireceğini belirleyin. Cihaz yerleşimi, ekran okunabilirliği ve internet bağlantısı servis akışının parçasıdır.' },
      { illustration: { src: '/illustrations/kds-operations.svg', alt: 'QR sipariş, mutfak hazırlığı ve raporların aynı operasyonda birleşmesi' }, title: 'Pro kapsamındaki operasyon yetenekleri', body: 'Mutfak ekranı ve istasyonlar Pro kapsamında bulunur; Plus üzerine ayrı bir KDS eklentisi olarak satılmaz. Donanım, profesyonel kurulum veya özel entegrasyon gerekiyorsa kapsamı satış ekibiyle netleştirin.' },
    ],
    faqs: [
      { question: 'KDS ne demek?', answer: 'Kitchen Display System, sipariş ve hazırlık durumlarını mutfak ekibine gösteren dijital mutfak ekranıdır.' },
      { question: 'Plus paketine yalnız KDS ekleyebilir miyim?', answer: 'Hayır. KDS, istasyonlar ve QR sipariş temel Pro yetenekleridir; bu ihtiyaçlar için Pro seçilir.' },
      { question: 'KDS cihazı abonelik fiyatına dahil mi?', answer: 'Yazılım paketi fiziksel cihaz içermez. Cihaz ve kurulum ihtiyacını mevcut işletme altyapınıza göre ayrıca değerlendirin.' },
    ], guide: 'mutfak-ekrani-siparis-akisi',
  },
]
