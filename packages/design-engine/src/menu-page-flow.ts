import type { ThemePageBlock } from './schema'
import { getSectionDefinitionId } from './section-blocks'

export interface MenuPageFlowCategory {
  id: string
  parentId?: string | null
}

export interface ResolveMenuPageFlowInput {
  pageBlocks?: readonly ThemePageBlock[]
  legacySections?: readonly string[]
  categories: readonly MenuPageFlowCategory[]
  validSectionIds?: ReadonlySet<string>
}

export function normalizeMenuPageBlockCategoryScope(
  blocks: readonly ThemePageBlock[],
  categories: readonly MenuPageFlowCategory[],
) {
  const parentById = new Map(categories.map((category) => [category.id, category.parentId ?? null]))
  const childrenByParent = new Map<string, ThemePageBlock[]>()
  const childBlocks = new Map<string, ThemePageBlock>()

  for (const block of blocks) {
    if (block.type !== 'category') continue
    const parentId = parentById.get(block.id)
    if (!parentId) continue
    const bucket = childrenByParent.get(parentId) ?? []
    bucket.push(block)
    childrenByParent.set(parentId, bucket)
    childBlocks.set(block.id, block)
  }

  const normalized: ThemePageBlock[] = []
  const appendedChildren = new Set<string>()
  for (const block of blocks) {
    if (block.type === 'category' && parentById.get(block.id)) continue
    normalized.push(block)
    if (block.type !== 'category') continue
    for (const child of childrenByParent.get(block.id) ?? []) {
      normalized.push(child)
      appendedChildren.add(child.id)
    }
  }

  for (const [id, child] of childBlocks) {
    if (!appendedChildren.has(id)) normalized.push(child)
  }
  return normalized
}

export function groupMenuPageBlocksByPlacement(blocks: readonly ThemePageBlock[]) {
  return [
    ...blocks.filter((block) => block.placement !== 'drawer'),
    ...blocks.filter((block) => block.placement === 'drawer'),
  ]
}

export function resolveMenuPageFlow({
  pageBlocks,
  legacySections = [],
  categories,
  validSectionIds,
}: ResolveMenuPageFlowInput): ThemePageBlock[] {
  const categoryIds = new Set(categories.map((category) => category.id))
  const stored = (pageBlocks ?? []).filter((block) => {
    if (block.type === 'category') return categoryIds.has(block.id)
    if (block.type === 'nav') return block.id === 'category-nav'
    const definitionId = getSectionDefinitionId(block)
    return !validSectionIds || Boolean(definitionId && validSectionIds.has(definitionId))
  })
  const base: ThemePageBlock[] = stored.length > 0
    ? [...stored]
    : [
        { type: 'nav', id: 'category-nav' },
        ...legacySections
          .filter((id) => !validSectionIds || validSectionIds.has(id))
          .map((id) => ({ type: 'section' as const, id })),
        ...categories.map((category) => ({ type: 'category' as const, id: category.id })),
      ]

  const seen = new Set<string>()
  const unique = base.filter((block) => {
    const key = `${block.type}:${block.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  if (!seen.has('nav:category-nav')) {
    unique.unshift({ type: 'nav', id: 'category-nav' })
    seen.add('nav:category-nav')
  }
  for (const category of categories) {
    const key = `category:${category.id}`
    if (seen.has(key)) continue
    unique.push({ type: 'category', id: category.id })
    seen.add(key)
  }

  return groupMenuPageBlocksByPlacement(
    normalizeMenuPageBlockCategoryScope(unique, categories),
  )
}
