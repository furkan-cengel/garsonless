import type {
  ThemePageBlock,
  ThemeSectionVisibility,
} from './schema'

export type SectionVisibilityCategory = {
  id: string
  parentId?: string | null
}

export type SectionVisibilityContext =
  | { view: 'home' }
  | { view: 'category'; categoryId: string }

export function getSectionDefinitionId(block: ThemePageBlock) {
  return block.type === 'section' ? block.sectionId ?? block.id : null
}

export function getSectionVisibility(block: ThemePageBlock): ThemeSectionVisibility {
  if (block.type !== 'section') return { mode: 'all' }
  return block.visibility ?? { mode: 'all' }
}

export function getUniqueSectionDefinitionIds(blocks: readonly ThemePageBlock[]) {
  return Array.from(new Set(blocks.flatMap((block) => {
    const id = getSectionDefinitionId(block)
    return id ? [id] : []
  })))
}

export function isSectionBlockVisibleInContext(
  block: ThemePageBlock,
  context: SectionVisibilityContext,
  categories: readonly SectionVisibilityCategory[],
) {
  if (block.type !== 'section') return false
  const visibility = getSectionVisibility(block)
  if (visibility.mode === 'all') return true
  if (visibility.mode === 'home') return context.view === 'home'
  if (context.view !== 'category') return false

  const targets = new Set(visibility.categoryIds ?? [])
  if (targets.has(context.categoryId)) return true
  if (!visibility.includeChildren || targets.size === 0) return false

  const parentById = new Map(categories.map((category) => [category.id, category.parentId ?? null]))
  const visited = new Set<string>()
  let current = parentById.get(context.categoryId) ?? null
  while (current && !visited.has(current)) {
    if (targets.has(current)) return true
    visited.add(current)
    current = parentById.get(current) ?? null
  }
  return false
}
