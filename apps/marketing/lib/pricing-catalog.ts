import type { SelfServePlan } from '@garsonless/domain/entitlements'

export type MarketingPlanId = SelfServePlan | 'business'

export type MarketingPlan = {
  id: MarketingPlanId
  name: string
  description: string
  highlight?: boolean
  features: string[]
}

export const MARKETING_PLANS: readonly MarketingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Dijital menüyle başlayın.',
    features: ['Sınırsız ürün ve kategori', 'QR menü ve zengin ürün içeriği', 'Logo, renk, tipografi ve kart düzenleri'],
  },
  {
    id: 'plus',
    name: 'Plus',
    description: 'Masa ve adisyon operasyonu.',
    features: [
      'Starter’daki her şey',
      'Masa bazlı QR ve QR Studio',
      'Personel siparişi, adisyon ve tahsilat',
      'Temel satış, ürün, masa ve ödeme raporları',
      'Ekip ve yetkilendirme',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Siparişten sadakate tam operasyon.',
    highlight: true,
    features: [
      'Plus’taki her şey',
      'Müşteri sepeti ve QR siparişi',
      'Servis çağrısı, KDS ve istasyonlar',
      'Online ödeme ve hesap bölüşme',
      'Müşteri hesabı, CRM, sadakat ve kampanyalar',
      'Gelişmiş raporlar ve bildirimler',
      'Gelişmiş tema bölümleri ve video',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    description: 'Çok şubeli işletmeler için.',
    features: ['Pro’daki her şey', 'Organizasyon ve ortak ekip erişimi', 'Güvenli şube geçişi', 'Satış destekli kurulum'],
  },
] as const

export type ComparisonValue = boolean | string

export type ComparisonRow = {
  feature: string
  note?: string
  values: Record<MarketingPlanId, ComparisonValue>
}

export type ComparisonGroup = {
  id: string
  title: string
  description: string
  rows: readonly ComparisonRow[]
}

const all = (value: ComparisonValue): Record<MarketingPlanId, ComparisonValue> => ({
  starter: value, plus: value, pro: value, business: value,
})

export const PRICING_COMPARISON_GROUPS: readonly ComparisonGroup[] = [
  {
    id: 'menu-marka',
    title: 'Menü ve marka',
    description: 'Menüyü yayınlamak, içeriği zenginleştirmek ve işletmenizin görünümüne uyarlamak için gerekenler.',
    rows: [
      { feature: 'Ürün ve kategori', values: all('Sınırsız') },
      { feature: 'QR menü yayını', values: all(true) },
      { feature: 'Görsel, açıklama, seçenek ve alerjen bilgileri', values: all(true) },
      { feature: 'Logo, renk, tipografi, kart ve navigasyon düzenleri', values: all(true) },
      { feature: 'Masa bazlı QR', values: { starter: false, plus: true, pro: true, business: true } },
      { feature: 'QR Studio', values: { starter: false, plus: true, pro: true, business: true } },
      { feature: 'Gelişmiş tema bölümleri', values: { starter: false, plus: false, pro: true, business: true } },
      { feature: 'Video içeriği', values: { starter: false, plus: false, pro: true, business: true } },
    ],
  },
  {
    id: 'operasyon',
    title: 'Masa, sipariş ve tahsilat',
    description: 'Personelin ve misafirin sipariş akışını aynı masa kaydı üzerinde ilerleten operasyon araçları.',
    rows: [
      { feature: 'Personelin manuel sipariş girişi', values: { starter: false, plus: true, pro: true, business: true } },
      { feature: 'Canlı masalar ve adisyon', values: { starter: false, plus: true, pro: true, business: true } },
      { feature: 'Personel tahsilat kaydı', values: { starter: false, plus: true, pro: true, business: true } },
      { feature: 'Müşteri sepeti ve QR siparişi', values: { starter: false, plus: false, pro: true, business: true } },
      { feature: 'Servis çağrıları', values: { starter: false, plus: false, pro: true, business: true } },
      { feature: 'Mutfak ekranı ve istasyonlar', values: { starter: false, plus: false, pro: true, business: true } },
      { feature: 'Online ödeme', note: 'Ödeme kuruluşu kurulumu ve koşulları ayrıca uygulanır.', values: { starter: false, plus: false, pro: true, business: true } },
      { feature: 'Hesap bölüşme', values: { starter: false, plus: false, pro: true, business: true } },
    ],
  },
  {
    id: 'rapor-ekip',
    title: 'Raporlar ve ekip',
    description: 'Günlük performansı izlemek ve ekip erişimini işletme içinde güvenle paylaşmak için.',
    rows: [
      { feature: 'Temel satış, ürün, masa ve ödeme raporları', values: { starter: false, plus: true, pro: true, business: true } },
      { feature: 'Ekip üyeleri', values: { starter: false, plus: true, pro: true, business: true } },
      { feature: 'Rol ve yetkilendirme', values: { starter: false, plus: true, pro: true, business: true } },
      { feature: 'Gelişmiş raporlar', values: { starter: false, plus: false, pro: true, business: true } },
      { feature: 'Tarayıcı bildirimleri', values: { starter: false, plus: false, pro: true, business: true } },
    ],
  },
  {
    id: 'misafir-buyume',
    title: 'Misafir ve büyüme',
    description: 'Tekrar ziyareti ve müşteri ilişkilerini aynı operasyon verisi üzerinden yönetmek için.',
    rows: [
      { feature: 'Müşteri hesabı', values: { starter: false, plus: false, pro: true, business: true } },
      { feature: 'CRM görünümü', values: { starter: false, plus: false, pro: true, business: true } },
      { feature: 'Sadakat ve puan', values: { starter: false, plus: false, pro: true, business: true } },
      { feature: 'Kampanyalar', values: { starter: false, plus: false, pro: true, business: true } },
    ],
  },
  {
    id: 'organizasyon',
    title: 'Şubeler ve organizasyon',
    description: 'Birden fazla işletmeye ortak erişim gereken yapılara özel Business kapsamı.',
    rows: [
      { feature: 'İşletme / şube', values: { starter: '1 / 1', plus: '1 / 1', pro: '1 / 1', business: 'Birden fazla' } },
      { feature: 'Organizasyon çalışma alanı', values: { starter: false, plus: false, pro: false, business: true } },
      { feature: 'Ortak ekip erişimi', values: { starter: false, plus: false, pro: false, business: true } },
      { feature: 'Güvenli şube geçişi', values: { starter: false, plus: false, pro: false, business: true } },
    ],
  },
  {
    id: 'ticari-kosullar',
    title: 'Ticari koşullar ve ek hizmetler',
    description: 'Deneme, faturalandırma ve ayrıca fiyatlanan kurulum seçenekleri.',
    rows: [
      { feature: 'Başlangıç', values: { starter: '14 gün Pro', plus: '14 gün Pro', pro: '14 gün Pro', business: 'Satış görüşmesi' } },
      { feature: 'Faturalandırma', values: { starter: 'Aylık / yıllık', plus: 'Aylık / yıllık', pro: 'Aylık / yıllık', business: 'Teklife göre' } },
      { feature: 'Taahhüt', values: { starter: 'Yok', plus: 'Yok', pro: 'Yok', business: 'Teklife göre' } },
      { feature: 'Sipariş komisyonu', values: all('Yok') },
      { feature: 'POS / ÖKC ve özel entegrasyonlar', values: { starter: 'Ek hizmet', plus: 'Ek hizmet', pro: 'Ek hizmet', business: 'Özel kapsam' } },
      { feature: 'Profesyonel kurulum ve menü aktarımı', values: { starter: 'Ek hizmet', plus: 'Ek hizmet', pro: 'Ek hizmet', business: 'Özel kapsam' } },
      { feature: 'Fiziksel QR standları', values: { starter: 'Ek hizmet', plus: 'Ek hizmet', pro: 'Ek hizmet', business: 'Özel kapsam' } },
    ],
  },
] as const

export const PRICING_FAQS = [
  {
    question: '14 günlük denemede hangi özellikler açık?',
    answer: 'Yeni işletmeler kart bilgisi vermeden 14 gün boyunca Pro özelliklerini kullanır. Deneme sonunda ücretli plan seçilmezse menü yayını ve ürün işlemleri kilitlenir; işletme verileri korunur.',
  },
  {
    question: 'Kartlarda görünen fiyatlara KDV dâhil mi?',
    answer: 'Hayır. Starter, Plus ve Pro kartlarında gösterilen tutarlar KDV hariç liste fiyatıdır. Uygulanacak KDV ve ödenecek genel toplam checkout adımında ayrıca gösterilir.',
  },
  {
    question: 'Siparişlerden komisyon alıyor musunuz?',
    answer: 'Masabu sipariş başına komisyon almaz. Online ödeme kullanıldığında ödeme kuruluşunun kendi sözleşmesindeki işlem ücretleri ayrıca uygulanabilir.',
  },
  {
    question: 'Aboneliği istediğim zaman iptal edebilir miyim?',
    answer: 'Starter, Plus ve Pro taahhütsüzdür. Mevcut akışta iptal ücretli erişimi hemen durdurur ve yeni dönem tahsilatını engeller. Kullanılmış dönemin kalanı için otomatik oransal iade yapılmaz.',
  },
  {
    question: 'Business planını nasıl satın alırım?',
    answer: 'Business self-servis satın alınmaz. Şube sayısı, ortak ekip yapısı, kurulum ve entegrasyon ihtiyacı görüşülür; kapsam ve fiyat özel teklifte belirlenir.',
  },
  {
    question: 'KDS, sadakat veya QR siparişi Plus’a eklenebilir mi?',
    answer: 'Hayır. Bu temel ürün yetenekleri ayrı Plus eklentileri olarak satılmaz; Pro ve Business kapsamındadır. Ek hizmetler POS/ÖKC entegrasyonları, profesyonel kurulum ve fiziksel QR standlarıyla sınırlıdır.',
  },
] as const
