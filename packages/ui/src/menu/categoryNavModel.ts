export interface HorizontalScrollMetrics {
  containerLeft: number
  containerWidth: number
  currentScrollLeft: number
  itemLeft: number
  itemWidth: number
  scrollWidth: number
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
