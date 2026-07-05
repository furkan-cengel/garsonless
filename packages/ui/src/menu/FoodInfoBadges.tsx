import type { AllergenCode, MenuItem } from './types'

export function getDefiniteAllergens(
  item: MenuItem,
  additional: Iterable<AllergenCode> = [],
): AllergenCode[] {
  return [...new Set([
    ...item.contains_allergens,
    ...item.ingredients.flatMap((ingredient) => ingredient.allergen_codes),
    ...additional,
  ])]
}

export function hasAllergenInformation(item: MenuItem): boolean {
  return getDefiniteAllergens(item).length > 0 || item.may_contain_allergens.length > 0
}

export function DietaryBadges({
  item,
  compact = false,
}: {
  item: MenuItem
  compact?: boolean
}) {
  const badges = [
    item.is_vegan ? 'Vegan' : null,
    item.is_vegetarian ? 'Vejetaryen' : null,
    item.is_halal ? 'Helal' : null,
  ].filter((label): label is string => label !== null)

  if (badges.length === 0) return null

  return (
    <div
      data-component="dietary-badges"
      style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}
    >
      {badges.map((label) => (
        <span
          key={label}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            minHeight: compact ? 19 : 24,
            padding: compact ? '2px 6px' : '3px 8px',
            borderRadius: 999,
            background: 'var(--p-accent-soft)',
            color: 'var(--p-accent)',
            fontSize: compact ? 9.5 : 11,
            fontWeight: 800,
            lineHeight: 1,
          }}
        >
          {label}
        </span>
      ))}
    </div>
  )
}
