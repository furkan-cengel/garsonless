export type MenuCategoryIconKey =
  | 'breakfast'
  | 'drinks'
  | 'coffee'
  | 'cocktails'
  | 'fresh-drinks'
  | 'matcha'
  | 'desserts'
  | 'extras'

function normalizeCategoryName(name: string) {
  return name
    .trim()
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
}

export function getMenuCategoryIconKey(name: string): MenuCategoryIconKey | null {
  const normalized = normalizeCategoryName(name)

  if (/fresh|taze icecek|meyve suyu|limonata|smoothie/.test(normalized)) return 'fresh-drinks'
  if (/kahve|coffee|espresso/.test(normalized)) return 'coffee'
  if (/kokteyl|cocktail/.test(normalized)) return 'cocktails'
  if (/matcha/.test(normalized)) return 'matcha'
  if (/kahvalti|brunch|yumurta/.test(normalized)) return 'breakfast'
  if (/tatli|dessert|pasta/.test(normalized)) return 'desserts'
  if (/ekstra|extra|ilave/.test(normalized)) return 'extras'
  if (/icecek|drink|mesrubat/.test(normalized)) return 'drinks'

  return null
}
