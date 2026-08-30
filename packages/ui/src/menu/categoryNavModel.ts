export interface HorizontalScrollMetrics {
  containerLeft: number
  containerWidth: number
  currentScrollLeft: number
  itemLeft: number
  itemWidth: number
  scrollWidth: number
}

export type CategoryNavActiveStyle = 'filled' | 'soft' | 'outline'

export interface CategoryNavActiveTreatment {
  background: string
  color: string
  borderColor: string
  boxShadow: string
}

export function getCategoryNavJustifyContent(
  categoryCount: number,
  contentFits: boolean,
): 'center' | 'flex-start' {
  if (categoryCount <= 1) return 'flex-start'
  return contentFits ? 'center' : 'flex-start'
}

export function getCategoryNavActiveTreatment(
  activeStyle: CategoryNavActiveStyle,
  accent = 'var(--p-accent)',
): CategoryNavActiveTreatment {
  if (activeStyle === 'soft') {
    return {
      background: 'var(--p-accent-soft)',
      color: accent,
      borderColor: 'color-mix(in srgb, var(--p-accent) 24%, transparent)',
      boxShadow: 'none',
    }
  }

  if (activeStyle === 'outline') {
    return {
      background: 'transparent',
      color: accent,
      borderColor: accent,
      boxShadow: 'none',
    }
  }

  return {
    background: accent,
    color: 'var(--p-cta-text)',
    borderColor: accent,
    boxShadow: 'none',
  }
}

export function getCenteredCategoryScrollLeft({
  containerLeft,
  containerWidth,
  currentScrollLeft,
  itemLeft,
  itemWidth,
  scrollWidth,
}: HorizontalScrollMetrics) {
  const desired = currentScrollLeft
    + (itemLeft - containerLeft)
    - ((containerWidth - itemWidth) / 2)
  return Math.max(0, Math.min(desired, Math.max(0, scrollWidth - containerWidth)))
}

export function getCategoryScrollEdges({
  scrollLeft,
  containerWidth,
  scrollWidth,
}: {
  scrollLeft: number
  containerWidth: number
  scrollWidth: number
}) {
  return {
    left: scrollLeft > 2,
    right: scrollLeft + containerWidth < scrollWidth - 2,
  }
}

export function getActiveCategoryAtLine(
  sections: Array<{ id: string; top: number }>,
  activationLine: number,
  reachedPageEnd = false,
) {
  if (sections.length === 0) return ''
  if (reachedPageEnd) return sections[sections.length - 1]!.id
  let activeId = sections[0]!.id
  for (const section of sections) {
    if (section.top > activationLine) break
    activeId = section.id
  }
  return activeId
}
