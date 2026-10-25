type SetupTourId = 'menu' | 'logo' | 'theme'
export interface SetupTour { id: SetupTourId; section: string; title: string; description: string; route: string; steps: { selector: string; title: string; description: string }[] }
const SETUP_TOURS: SetupTour[] = [
  { id: 'menu', section: 'menu', title: 'Menünü hazırla', description: 'PDF veya fotoğrafla başla; ürünlerini kontrol et.', route: 'menu', steps: [
    { selector: '[data-guide="menu-ai-import"], [data-guide="menu-actions"]', title: 'AI ile menünü oluştur', description: 'Bu düğmeden kağıt menünün fotoğraflarını veya PDF dosyasını yükleyebilirsin. Menü arka planda okunur; hazır olduğunda ürünleri ve fiyatları kontrol edip eklersin.' },
    { selector: '[data-guide="menu-create"], [data-guide="menu-actions"]', title: 'Ürünlerini tamamla', description: 'Kategori ve ürünleri buradan elle de ekleyebilirsin. Ürünlerin fotoğraflarını ve içerik bilgilerini düzenleyebilirsin.' },
    { selector: '[data-guide="menu-preview"], [data-guide="menu-actions"]', title: 'Müşterinin gördüğü menü', description: 'Önizleme ile fiyatlarını ve ürünlerini müşteri menüsünde kontrol et. Mobilde bu seçenek Menü işlemleri içinde bulunur.' },
  ] },
  { id: 'logo', section: 'settings', title: 'Logonu ekle', description: 'Menüne işletmenin kimliğini kazandır.', route: 'settings?section=workspace', steps: [
    { selector: '[data-guide="workspace-logo"]', title: 'İşletmenin logosu', description: 'Logo yükle düğmesinden PNG, JPG veya WebP seç. Yüklendiğinde logo menünde ve QR ekranlarında görünür.' },
  ] },
  { id: 'theme', section: 'theme', title: 'Görünümünü düzenle', description: 'Önizle, taslağını kaydet ve hazır olduğunda yayınla.', route: 'theme', steps: [
    { selector: '[data-theme-editor-preview-toolbar]', title: 'Tasarımını canlı gör', description: 'Yaptığın değişiklikleri burada önizle. Sayfa ve cihaz seçenekleriyle farklı görünümleri kontrol et.' },
    { selector: '[data-theme-editor-save-draft]', title: 'Taslağını kaydet', description: 'Kaydet, değişikliklerini saklar. Müşterilerin henüz bu taslağı görmez. Kaydedilecek değişiklik yoksa düğme pasif görünür.' },
    { selector: '[data-theme-editor-publish]', title: 'Hazır olduğunda yayınla', description: 'Kontrollerini tamamladıktan sonra QR menüde yayınla düğmesini kullan. Bu tur hiçbir tasarımı kendiliğinden yayınlamaz.' },
  ] },
]
export interface GuideProgress { tour: SetupTourId; step: number }
export function parseGuideProgress(value: unknown): GuideProgress | null {
  if (!value || typeof value !== 'object') return null
  const item = value as GuideProgress
  const tour = SETUP_TOURS.find(tour => tour.id === item.tour)
  return tour && Number.isInteger(item.step) && item.step >= 0 && item.step < tour.steps.length ? { tour: tour.id, step: item.step } : null
}
export function availableSetupTours(permissions: string[], allowed: Record<string, { allowed: boolean }>, owner: boolean) {
  return SETUP_TOURS.filter(tour => (owner || permissions.includes(tour.section)) && allowed[tour.section]?.allowed !== false && (tour.id !== 'logo' || owner))
}
