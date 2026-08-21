import type { CSSProperties } from 'react'
import type { AllergenCode, MenuItem } from './types'
import { AllergenIconList, sortAllergenCodes } from './AllergenIcons'

export function getDefiniteAllergens(
  item: MenuItem,
  additional: Iterable<AllergenCode> = [],
): AllergenCode[] {
  return sortAllergenCodes([
    ...item.contains_allergens,
    ...item.ingredients.flatMap((ingredient) => ingredient.allergen_codes),
    ...additional,
  ])
}

export function ProductAllergenSummary({ item, maxVisible = 3, style }: {
  item: MenuItem
  maxVisible?: number
  style?: CSSProperties
}) {
  return <AllergenSummary
    definite={getDefiniteAllergens(item)}
    hasCrossContact={item.may_contain_allergens.length > 0 || Boolean(item.cross_contact_note)}
    maxVisible={maxVisible}
    {...(style ? { style } : {})}
  />
}

export function AllergenSummary({ definite, hasCrossContact, maxVisible = 3, style }: {
  definite: Iterable<AllergenCode>
  hasCrossContact: boolean
  maxVisible?: number
  style?: CSSProperties
}) {
  const definiteCodes = sortAllergenCodes(definite)
  if (definiteCodes.length > 0) {
    return <AllergenIconList codes={definiteCodes} maxVisible={maxVisible} size={15} {...(style ? { style } : {})} />
  }
  if (!hasCrossContact) return null
  return <span
    data-component="cross-contact-summary"
    title="Olası çapraz temas bilgisi"
    style={{display:'inline-flex',alignItems:'center',gap:5,alignSelf:'flex-start',padding:'4px 7px',borderRadius:7,border:'1px dashed rgba(71,85,105,.38)',background:'rgba(241,245,249,.72)',color:'var(--p-text-2)',fontSize:9.5,fontWeight:800,lineHeight:1.1,...style}}
  >
    <span aria-hidden="true" style={{fontSize:12,lineHeight:1}}>!</span>
    Çapraz temas
  </span>
}

export { AllergenIcon, AllergenIconList, sortAllergenCodes } from './AllergenIcons'

export function hasAllergenInformation(item: MenuItem): boolean {
  return getDefiniteAllergens(item).length > 0 || item.may_contain_allergens.length > 0 || Boolean(item.cross_contact_note)
}

export function DietaryBadges({
  item,
  compact = false,
  singleLine = false,
}: {
  item: MenuItem
  compact?: boolean
  singleLine?: boolean
}) {
  const badges = [
    item.is_vegan ? 'Vegan' : null,
    item.is_vegetarian && !(singleLine && item.is_vegan) ? 'Vejetaryen' : null,
    item.is_halal ? 'Helal' : null,
  ].filter((label): label is string => label !== null)

  if (badges.length === 0) return null

  return (
    <div
      data-component="dietary-badges"
      data-layout={singleLine ? 'single-line' : 'wrap'}
      style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: singleLine ? 'nowrap' : 'wrap', minWidth: 0 }}
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
            flexShrink: 0,
          }}
        >
          {label}
        </span>
      ))}
    </div>
  )
}
