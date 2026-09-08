export type MarketingIconName =
  | 'qr'
  | 'cutlery'
  | 'cart'
  | 'chart'
  | 'layout'
  | 'palette'
  | 'shield'
  | 'globe'
  | 'sparkles'
  | 'phone'
  | 'bolt'
  | 'arrowDown'
  | 'star'

export interface ProblemSolutionNode {
  label: string
  asset: string
  x: number
  y: number
}

export interface ProblemSolutionRoute {
  label: string
  icon?: MarketingIconName
  asset?: string
}

export interface ProblemSolutionLane {
  id: 'top' | 'middle' | 'bottom'
  title: string
  tone: 'primary' | 'support'
  steps: ProblemSolutionRoute[]
}

export interface ProblemSolutionConfig {
  problemNodes: ProblemSolutionNode[]
  solutionLanes: ProblemSolutionLane[]
}

export interface ProcessStep {
  number: string
  eyebrow: string
  title: string
  description: string
  transitionLabel?: string
  poster: string
  posterAlt: string
  supademoDemo?:
    | 'menu-management'
    | 'theme-editor'
    | 'tables-qr'
    | 'dashboard-reports'
    | 'customers-loyalty'
    | 'team-permissions'
  icon: MarketingIconName
}

export interface CustomizationFeature {
  label: string
  value: string
  icon: MarketingIconName
}

export const problemSolutionConfig: ProblemSolutionConfig = {
  problemNodes: [
    {
      label: 'Garson bekleyen misafir',
      asset: '/problem-solution/before/01-waiting-for-waiter.svg',
      x: 10,
      y: 63,
    },
    {
      label: 'Kâğıda alınan sipariş',
      asset: '/problem-solution/before/02-handwritten-order.svg',
      x: 23,
      y: 33,
    },
    {
      label: 'Kaybolan sipariş fişi',
      asset: '/problem-solution/before/03-lost-ticket.svg',
      x: 42,
      y: 67,
    },
    {
      label: 'Mutfağa geç düşen sipariş',
      asset: '/problem-solution/before/04-kitchen-delay.svg',
      x: 54,
      y: 33,
    },
    {
      label: 'Yanlış veya eksik sipariş',
      asset: '/problem-solution/before/05-wrong-order.svg',
      x: 72,
      y: 68,
    },
    {
      label: 'Kasada ödeme kuyruğu',
      asset: '/problem-solution/before/06-payment-queue.svg',
      x: 91,
      y: 33,
    },
  ],
  solutionLanes: [
    {
      id: 'top',
      title: 'İçgörü & büyüme',
      tone: 'support',
      steps: [
        {
          label: 'Canlı operasyon',
          asset: '/problem-solution/after/top-01-live-operations.svg',
        },
        {
          label: 'Satış analitiği',
          asset: '/problem-solution/after/top-02-sales-analytics.svg',
        },
        {
          label: 'Müşteri içgörüsü',
          asset: '/problem-solution/after/top-03-customer-insight.svg',
        },
        {
          label: 'Kampanyalar',
          asset: '/problem-solution/after/top-04-campaign.svg',
        },
        {
          label: 'Sadakat büyümesi',
          asset: '/problem-solution/after/top-05-loyalty-growth.svg',
        },
      ],
    },
    {
      id: 'middle',
      title: 'Sipariş akışı',
      tone: 'primary',
      steps: [
        { label: 'QR ile başla', asset: '/problem-solution/after/01-scan-qr.svg' },
        { label: 'Menüyü seç', asset: '/problem-solution/after/02-digital-order.svg' },
        { label: 'Mutfağa aktar', asset: '/problem-solution/after/03-kitchen-sync.svg' },
        { label: 'Hazırlığı izle', asset: '/problem-solution/after/04-live-status.svg' },
        { label: 'Masada öde', asset: '/problem-solution/after/05-pay-at-table.svg' },
        { label: 'Sipariş tamam', asset: '/problem-solution/after/06-order-complete.svg' },
      ],
    },
    {
      id: 'bottom',
      title: 'Misafir deneyimi',
      tone: 'support',
      steps: [
        {
          label: 'İçerik detayları',
          asset: '/problem-solution/after/bottom-01-ingredient-details.svg',
        },
        {
          label: 'Alerjen filtresi',
          asset: '/problem-solution/after/bottom-02-allergen-filter.svg',
        },
        {
          label: 'Bilinçli seçim',
          asset: '/problem-solution/after/bottom-03-informed-choice.svg',
        },
        {
          label: 'İndirimler',
          asset: '/problem-solution/after/bottom-04-discount.svg',
        },
        {
          label: 'Sadakat puanı',
          asset: '/problem-solution/after/bottom-05-loyalty-points.svg',
        },
        {
          label: 'Tekrar ziyaret',
          asset: '/problem-solution/after/bottom-06-return-guest.svg',
        },
      ],
    },
  ],
}

export const processSteps: ProcessStep[] = [
  {
    number: '01',
    eyebrow: 'Menüyü tek yerden yönetin',
    title: 'Ürünü, fiyatı ve seçenekleri tek panelden düzenleyin.',
    description:
      'Kategorileri, ürün bilgilerini, görselleri, fiyatları ve seçim gruplarını aynı çalışma alanında yönetin. Değişikliklerin menüye nasıl yansıdığını etkileşimli olarak inceleyin.',
    transitionLabel: 'menü markaya uyarlanır',
    poster: '/product/menu-customization.jpg',
    posterAlt: 'masabu menü yönetimi ekranının gerçek uygulama görünümü',
    supademoDemo: 'menu-management',
    icon: 'layout',
  },
  {
    number: '02',
    eyebrow: 'Menünüzü markanıza uyarlayın',
    title: 'Her ayrıntıyı düzenleyin, sonucu anında görün.',
    description:
      'Yerleşimden ürün kartlarına, navigasyondan masa durumuna kadar menü görünümünü sol araçlardan seçin; sağ panelde ayrıntıları düzenleyip canlı önizlemede doğrulayın.',
    transitionLabel: 'markalı QR masaya ulaşır',
    poster: '/product/qr-menu.jpg',
    posterAlt: 'masabu tema düzenleyicisinin ve canlı menü önizlemesinin görünümü',
    supademoDemo: 'theme-editor',
    icon: 'palette',
  },
  {
    number: '03',
    eyebrow: 'Masaları ve QR’ları yönetin',
    title: 'Canlı masa operasyonu, markalı QR’larla buluşur.',
    description:
      'Salon planındaki masa durumlarını izleyin; her masaya özel QR görünümünü şekil, renk, logo ve çerçeve seçenekleriyle düzenleyip tek tek veya toplu olarak dışa aktarın.',
    transitionLabel: 'masa verisi raporlanır',
    poster: '/product/qr-menu.jpg',
    posterAlt: 'masabu Canlı Masalar ve QR Studio ekranlarının gerçek uygulama görünümü',
    supademoDemo: 'tables-qr',
    icon: 'qr',
  },
  {
    number: '04',
    eyebrow: 'Günü anlık raporla',
    title: 'Sipariş ve tahsilat, tek panoda görünür.',
    description:
      'Satış, ürün ve masa hareketleri aynı işletme verisinden raporlanır. Ekip operasyonu izlerken yönetici sonuçları tek yerden takip eder.',
    transitionLabel: 'veri müşteriyi tanımlar',
    poster: '/product/menu-customization.jpg',
    posterAlt: 'masabu pano ve rapor ekranlarının gerçek uygulama görünümü',
    supademoDemo: 'dashboard-reports',
    icon: 'chart',
  },
  {
    number: '05',
    eyebrow: 'Müşteriyi tanıyın',
    title: 'Her ziyareti, kalıcı bir ilişkiye dönüştürün.',
    description:
      'Müşterileri puan, ziyaret ve harcama bilgileriyle görüntüleyin. Sadakat geçmişini inceleyin, puan tanımlayın ve hareketlerin müşteri bakiyesine nasıl yansıdığını aynı profilden takip edin.',
    transitionLabel: 'erişim ekiple paylaşılır',
    poster: '/product/payment-cart.jpg',
    posterAlt: 'masabu müşteri profili ve sadakat yönetimi ekranlarının gerçek uygulama görünümü',
    supademoDemo: 'customers-loyalty',
    icon: 'sparkles',
  },
  {
    number: '06',
    eyebrow: 'Ekip ve izinleri yönetin',
    title: 'Doğru yetki, doğru kişide kalsın.',
    description:
      'Ekip üyelerinin rapor ve masa yönetimi erişimlerini görevlerine göre belirleyin. Her kullanıcı yalnız ihtiyaç duyduğu işletme araçlarına erişsin.',
    poster: '/product/team-permissions-01.jpg',
    posterAlt: 'masabu ekip üyesi rol ve erişim izinleri ekranının gerçek uygulama görünümü',
    supademoDemo: 'team-permissions',
    icon: 'shield',
  },
]

export const customizationFeatures: CustomizationFeature[] = [
  { label: 'Porsiyon', value: 'Varyant ve porsiyonlar', icon: 'layout' },
  { label: 'Seçimler', value: 'Ekstra ve seçim grupları', icon: 'sparkles' },
  { label: 'Fiyat', value: 'Satış fiyatı ve maliyet', icon: 'chart' },
  { label: 'İçindekiler', value: 'Malzeme ve çıkarma seçenekleri', icon: 'cutlery' },
  { label: 'Besin', value: 'Kalori ve makro değerleri', icon: 'chart' },
  { label: 'Alerjen', value: 'İçerir ve iz uyarıları', icon: 'shield' },
  { label: 'Diyet', value: 'Vegan, vejetaryen ve helal', icon: 'globe' },
  { label: 'Görsel', value: 'Ürün ve kategori fotoğrafı', icon: 'palette' },
  { label: 'Öneri', value: 'İlgili ürünler', icon: 'bolt' },
  { label: 'Menü', value: 'Gruplar ve kampanyalar', icon: 'layout' },
  { label: 'Akış', value: 'Kategori ve istasyon', icon: 'cutlery' },
  { label: 'Durum', value: 'Aktif / pasif yönetimi', icon: 'shield' },
  { label: 'Vergi', value: 'Kategori ve ürün KDV oranı', icon: 'chart' },
  { label: 'Sıralama', value: 'Kategori ve ürün sırası', icon: 'arrowDown' },
  { label: 'Filtre', value: 'Hazır ve özel menü filtreleri', icon: 'sparkles' },
  { label: 'Sadakat', value: 'Ürün bazlı damga kuralı', icon: 'star' },
  { label: 'Tema', value: 'Taslak, önizleme ve yayın', icon: 'palette' },
  { label: 'QR', value: 'Tema ve QR görünümü', icon: 'qr' },
]
