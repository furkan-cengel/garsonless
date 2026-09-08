import type { BillableFeature } from '@garsonless/domain/entitlements'
import type { Icon } from '../../lib/ui'
import { I } from '../../lib/ui'

type FeaturePresentation = {
  label: string
  icon: Icon
  benefits: readonly string[]
}

const FEATURE_PRESENTATIONS: Partial<Record<BillableFeature, FeaturePresentation>> = {
  qr_studio: {
    label: 'QR Studio', icon: I.qr,
    benefits: ['Masalara özel QR kodlar', 'Markanıza uygun QR tasarımı', 'Baskıya uygun dışa aktarma', 'Dijital menüye doğrudan erişim'],
  },
  team_management: {
    label: 'Ekip yönetimi', icon: I.users,
    benefits: ['Ekip üyesi davetleri', 'Göreve uygun erişim yetkileri', 'Üye ve rol yönetimi', 'Ekip işlemlerinin takibi'],
  },
  loyalty: {
    label: 'Sadakat', icon: I.users,
    benefits: ['Müşteri puanları', 'Sadakat seviyeleri', 'Puan kazanım kuralları', 'Müşteri sadakat takibi'],
  },
  kitchen_display: {
    label: 'Mutfak', icon: I.clipboard,
    benefits: ['Mutfak sipariş ekranı', 'Hazırlık durumlarının takibi', 'Mutfak istasyonları', 'Ekip genelinde güncel sipariş akışı'],
  },
  online_payments: {
    label: 'Ödeme ayarları', icon: I.check,
    benefits: ['İyzico bağlantı ayarları', 'Online ödeme yapılandırması', 'Ödeme bağlantısı durumunun takibi', 'Merkezi ödeme yönetimi'],
  },
  browser_notifications: {
    label: 'Bildirimler', icon: I.bell,
    benefits: ['Yeni sipariş bildirimleri', 'Servis çağrısı bildirimleri', 'Tarayıcı bildirim tercihleri', 'Ekip için güncel operasyon akışı'],
  },
  analytics_basic: {
    label: 'Raporlar',
    icon: I.chart,
    benefits: [
      'Satış, ürün, masa ve ödeme raporları',
      'Operasyonu tek bakışta izleyen canlı pano',
      'Saatlik ve dönemsel performans kırılımları',
      'Karar vermeyi hızlandıran karşılaştırmalar',
    ],
  },
  staff_orders: {
    label: 'Siparişler',
    icon: I.clipboard,
    benefits: [
      'Personelin manuel sipariş girişi',
      'Canlı sipariş, adisyon ve tahsilat akışı',
      'Hazırlanıyor ve teslim edildi durumları',
      'Ekip genelinde tek operasyon görünümü',
    ],
  },
  table_management: {
    label: 'Canlı Masalar',
    icon: I.chair,
    benefits: [
      'Canlı masa ve hesap takibi',
      'Masa taşıma ve hesap birleştirme araçları',
      'Salon düzenini tek ekrandan yönetme',
      'Adisyon ve tahsilat operasyonu',
    ],
  },
  customer_accounts: {
    label: 'Müşteriler',
    icon: I.users,
    benefits: [
      'Müşteri hesapları ve CRM görünümü',
      'Sadakat, segment ve kampanya araçları',
      'İzinli iletişim tercihleri',
      'Müşteri davranışına göre hedefleme',
    ],
  },
  qr_menu: {
    label: 'Dijital menü',
    icon: I.qr,
    benefits: [
      'Yayınlanan sınırsız dijital menü',
      'Zengin ürün içeriği ve QR erişimi',
      'Kategori ve ürünleri anında güncelleme',
      'Tüm cihazlara uyumlu misafir deneyimi',
    ],
  },
  theme_editor: {
    label: 'Tema editörü',
    icon: I.palette,
    benefits: [
      'Logo, renk ve tipografi ayarları',
      'Kart ve navigasyon düzenleri',
      'Canlı mobil ve masaüstü önizleme',
      'Markanıza uygun menü görünümü',
    ],
  },
}

const FALLBACK_PRESENTATION: FeaturePresentation = {
  label: 'Paket özelliği',
  icon: I.sparkles,
  benefits: [
    'Bu bölümün tüm operasyon araçları',
    'İşletme verilerinizi koruyan güvenli erişim',
    'Plan etkinleştiğinde kesintisiz devam',
    'Dashboard içinden merkezi yönetim',
  ],
}


export function getPlanLockPresentation(feature: BillableFeature) {
  return FEATURE_PRESENTATIONS[feature] ?? FALLBACK_PRESENTATION
}
