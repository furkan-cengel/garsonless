export function isThemeSectionLocked(section: { id: string; plan?: string } | null | undefined, canAddAdvancedSections: boolean, canUseVideoHero: boolean): boolean {
  if (section?.plan !== 'pro') return false
  return section.id === 'storefront-video-hero' ? !canUseVideoHero : !canAddAdvancedSections
}

export const THEME_SECTION_ACCESS_NOTICE = 'Bu bölüm mevcut paketinle QR menüde ve önizlemede gösterilmez. Ayarların korunur; paketin bu bölümü desteklediğinde kullanılabilir.'
