import {
  canUseFeature,
  RESTAURANT_PLANS,
  type BillableFeature,
  type SelfServePlan,
} from '@garsonless/domain/entitlements'

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
    features: ['Sınırsız ürün ve kategori', 'QR menü ve zengin ürün içeriği', 'Masa bazlı QR ve QR Studio', 'Logo, renk, tipografi ve kart düzenleri'],
  },
  {
    id: 'plus',
    name: 'Plus',
    description: 'Masa ve adisyon operasyonu.',
    features: [
      'Starter’daki her şey',
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
      'Hesap bölüşme; İyzico online ödeme opsiyonel add-on',
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

export type EntitlementComparisonRow = {
  feature: string
  note?: string
  entitlement: BillableFeature
}

export type StaticComparisonRow = {
  feature: string
  note?: string
  values: Record<MarketingPlanId, ComparisonValue>
}

export type ComparisonRow = EntitlementComparisonRow | StaticComparisonRow

export type ComparisonGroup = {
  id: string
  title: string
  description: string
  rows: readonly ComparisonRow[]
}

const all = (value: ComparisonValue): Record<MarketingPlanId, ComparisonValue> => ({
  starter: value, plus: value, pro: value, business: value,
})

/** Entitlement-backed comparison cells are always projected from the domain
 * catalogue. Marketing owns labels and grouping, never package availability. */
export function comparisonValues(row: ComparisonRow): Record<MarketingPlanId, ComparisonValue> {
  if ('values' in row) return row.values
  return Object.fromEntries(
    RESTAURANT_PLANS.map((plan) => [plan, canUseFeature(plan, row.entitlement)]),
  ) as Record<MarketingPlanId, ComparisonValue>
}

export const PRICING_COMPARISON_GROUPS: readonly ComparisonGroup[] = [
  {
    id: 'menu-marka',
    title: 'Menü ve marka',
    description: 'Menüyü yayınlamak, içeriği zenginleştirmek ve işletmenizin görünümüne uyarlamak için gerekenler.',
    rows: [
      { feature: 'Ürün ve kategori', values: all('Sınırsız') },
      { feature: 'QR menü yayını', entitlement: 'qr_menu' },
      { feature: 'Görsel, açıklama, seçenek ve alerjen bilgileri', entitlement: 'rich_product_content' },
      { feature: 'Logo, renk, tipografi, kart ve navigasyon düzenleri', entitlement: 'theme_editor' },
      { feature: 'Masa bazlı QR', entitlement: 'qr_studio' },
      { feature: 'QR Studio', entitlement: 'qr_studio' },
      { feature: 'Gelişmiş tema bölümleri', entitlement: 'theme_advanced_sections' },
      { feature: 'Video içeriği', entitlement: 'theme_video_hero' },
    ],
  },
  {
    id: 'operasyon',
    title: 'Masa, sipariş ve tahsilat',
    description: 'Personelin ve misafirin sipariş akışını aynı masa kaydı üzerinde ilerleten operasyon araçları.',
    rows: [
      { feature: 'Personelin manuel sipariş girişi', entitlement: 'staff_orders' },
      { feature: 'Canlı masalar ve adisyon', entitlement: 'table_management' },
      { feature: 'Personel tahsilat kaydı', entitlement: 'settlement' },
      { feature: 'Müşteri sepeti ve QR siparişi', entitlement: 'guest_ordering' },
      { feature: 'Servis çağrıları', entitlement: 'service_requests' },
      { feature: 'Mutfak ekranı ve istasyonlar', entitlement: 'kitchen_display' },
      { feature: 'İyzico online ödeme', note: 'Pro’ya aylık 300 ₺ + KDV ile eklenir; yıllık ödemede katalog indirimi uygulanır. İyzico işlem koşulları ayrıca geçerlidir.', values: { starter: false, plus: false, pro: '+300 ₺/ay', business: 'Özel kapsam' } },
      { feature: 'Hesap bölüşme', entitlement: 'split_payments' },
    ],
  },
  {
    id: 'rapor-ekip',
    title: 'Raporlar ve ekip',
    description: 'Günlük performansı izlemek ve ekip erişimini işletme içinde güvenle paylaşmak için.',
    rows: [
      { feature: 'Temel satış, ürün, masa ve ödeme raporları', entitlement: 'analytics_basic' },
      { feature: 'Ekip üyeleri', entitlement: 'team_management' },
      { feature: 'Rol ve yetkilendirme', entitlement: 'team_management' },
      { feature: 'Gelişmiş raporlar', entitlement: 'analytics_advanced' },
      { feature: 'Tarayıcı bildirimleri', entitlement: 'browser_notifications' },
    ],
  },
  {
    id: 'misafir-buyume',
    title: 'Misafir ve büyüme',
    description: 'Tekrar ziyareti ve müşteri ilişkilerini aynı operasyon verisi üzerinden yönetmek için.',
    rows: [
      { feature: 'Müşteri hesabı', entitlement: 'customer_accounts' },
      { feature: 'CRM görünümü', entitlement: 'crm' },
      { feature: 'Sadakat ve puan', entitlement: 'loyalty' },
      { feature: 'Kampanyalar', entitlement: 'campaigns' },
    ],
  },
  {
    id: 'organizasyon',
    title: 'Şubeler ve organizasyon',
    description: 'Birden fazla işletmeye ortak erişim gereken yapılara özel Business kapsamı.',
    rows: [
      { feature: 'İşletme / şube', values: { starter: '1 / 1', plus: '1 / 1', pro: '1 / 1', business: 'Birden fazla' } },
      { feature: 'Organizasyon çalışma alanı', entitlement: 'multi_location' },
      { feature: 'Ortak ekip erişimi', entitlement: 'multi_location' },
      { feature: 'Güvenli şube geçişi', entitlement: 'multi_location' },
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
      { feature: 'İyzico online ödeme add-on', values: { starter: false, plus: false, pro: '+300 ₺/ay', business: 'Özel kapsam' } },
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
    answer: 'Masabu sipariş başına komisyon almaz. İyzico online ödeme Pro’ya ayrıca satılan bir add-on’dır; İyzico’nun kendi sözleşmesindeki işlem ücretleri de ayrıca uygulanabilir.',
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
    answer: 'Hayır. Bu temel ürün yetenekleri ayrı Plus eklentileri olarak satılmaz; Pro ve Business kapsamındadır. İyzico online ödeme yalnız Pro’ya eklenebilen ayrı bir add-on’dır.',
  },
] as const
