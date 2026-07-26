import {
  getSectionDefinitionId,
  type GarsonlessTheme,
  type ThemePageBlock,
} from '@garsonless/design-engine'

export type PageBlock = ThemePageBlock

export type MenuCategory = {
  id: string
  name: string
  parentId?: string | null
}

const SINGLETON_SECTION_IDS = new Set(['request-buttons'])

export type PageFlowReorderResult =
  | { ok: true; blocks: PageBlock[]; moved: PageBlock }
  | { ok: false; reason: 'missing-block' | 'child-scope' | 'nested-target' }

export function pageBlockKey(block: PageBlock) {
  return `${block.type}:${block.id}`
}

export function buildPageBlocks(
  theme: Partial<GarsonlessTheme>,
  menuCategories: MenuCategory[],
  validSectionIds: Iterable<string>,
): PageBlock[] {
  const categoryIds = new Set(menuCategories.map((category) => category.id))
  const sectionIds = new Set(validSectionIds)
  const stored = ((theme.pageBlocks ?? []) as PageBlock[]).filter((block) =>
    block.type === 'category'
      ? categoryIds.has(block.id)
      : block.type === 'nav'
        ? block.id === 'category-nav'
        : block.type === 'section' && sectionIds.has(getSectionDefinitionId(block) ?? ''),
  )
  const legacySections = (theme.sections ?? []).filter((id) => sectionIds.has(id))
  const base: PageBlock[] = stored.length > 0
    ? stored
    : [
        { type: 'nav', id: 'category-nav' },
        ...legacySections.map((id) => ({ type: 'section' as const, id })),
        ...menuCategories.map((category) => ({ type: 'category' as const, id: category.id })),
      ]
  const seen = new Set<string>()
  const unique = base.filter((block) => {
    const key = pageBlockKey(block)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  if (!seen.has('nav:category-nav')) {
    unique.unshift({ type: 'nav', id: 'category-nav' })
    seen.add('nav:category-nav')
  }

  for (const category of menuCategories) {
    const key = `category:${category.id}`
    if (!seen.has(key)) {
      unique.push({ type: 'category', id: category.id })
      seen.add(key)
    }
  }

  return unique
}

export function getCategoryParentId(menuCategories: MenuCategory[], categoryId: string) {
  return menuCategories.find((category) => category.id === categoryId)?.parentId ?? null
}

export function normalizePageBlocksForCategoryScope(
  blocks: PageBlock[],
  menuCategories: MenuCategory[],
) {
  const childIds = new Set(menuCategories.filter((category) => category.parentId).map((category) => category.id))
  const childrenByParent = new Map<string, PageBlock[]>()
  const childBlockById = new Map(
    blocks
      .filter((block) => block.type === 'category' && childIds.has(block.id))
      .map((block) => [block.id, block]),
  )

  for (const block of blocks) {
    if (block.type !== 'category' || !childIds.has(block.id)) continue
    const parentId = getCategoryParentId(menuCategories, block.id)
    if (!parentId) continue
    const bucket = childrenByParent.get(parentId) ?? []
    bucket.push(block)
    childrenByParent.set(parentId, bucket)
  }

  const next: PageBlock[] = []
  const appended = new Set<string>()
  for (const block of blocks) {
    if (block.type === 'category' && childIds.has(block.id)) continue
    next.push(block)
    if (block.type === 'category') {
      for (const child of childrenByParent.get(block.id) ?? []) {
        next.push(child)
        appended.add(child.id)
      }
    }
  }

  for (const [id, child] of childBlockById.entries()) {
    if (!appended.has(id)) next.push(child)
  }
  return next
}

export function createSectionInstanceId(blocks: PageBlock[], sectionId: string) {
  if (SINGLETON_SECTION_IDS.has(sectionId)) return sectionId
  if (!blocks.some((block) => block.type === 'section' && block.id === sectionId)) return sectionId
  let suffix = 2
  while (blocks.some((block) => block.type === 'section' && block.id === `${sectionId}--${suffix}`)) {
    suffix += 1
  }
  return `${sectionId}--${suffix}`
}

export function addSectionToPageFlow(
  blocks: PageBlock[],
  sectionId: string,
  instanceId = createSectionInstanceId(blocks, sectionId),
) {
  if (
    SINGLETON_SECTION_IDS.has(sectionId) &&
    blocks.some((block) => block.type === 'section' && getSectionDefinitionId(block) === sectionId)
  ) return blocks
  if (blocks.some((block) => block.type === 'section' && block.id === instanceId)) return blocks
  const next = [...blocks]
  const navIndex = next.findIndex((block) => block.type === 'nav')
  next.splice(navIndex >= 0 ? navIndex + 1 : 0, 0, {
    type: 'section',
    id: instanceId,
    ...(instanceId !== sectionId ? { sectionId } : {}),
  })
  return next
}

export function removeSectionFromPageFlow(blocks: PageBlock[], sectionId: string) {
  return blocks.filter((block) => !(block.type === 'section' && block.id === sectionId))
}

export function reorderPageBlocks(
  blocks: PageBlock[],
  menuCategories: MenuCategory[],
  sourceKey: string,
  targetKey: string,
): PageFlowReorderResult {
  const fromIndex = blocks.findIndex((block) => pageBlockKey(block) === sourceKey)
  const toIndex = blocks.findIndex((block) => pageBlockKey(block) === targetKey)
  const movedBlock = blocks[fromIndex]
  const targetBlock = blocks[toIndex]
  if (fromIndex < 0 || toIndex < 0 || !movedBlock || !targetBlock) {
    return { ok: false, reason: 'missing-block' }
  }

  const movedParentId = movedBlock.type === 'category'
    ? getCategoryParentId(menuCategories, movedBlock.id)
    : null
  const targetParentId = targetBlock.type === 'category'
    ? getCategoryParentId(menuCategories, targetBlock.id)
    : null

  if (movedBlock.type === 'category' && movedParentId) {
    if (targetBlock.type !== 'category' || targetParentId !== movedParentId) {
      return { ok: false, reason: 'child-scope' }
    }
  }

  if (
    targetBlock.type === 'category' &&
    targetParentId &&
    !(movedBlock.type === 'category' && movedParentId === targetParentId)
  ) {
    return { ok: false, reason: 'nested-target' }
  }

  if (movedBlock.type === 'category' && !movedParentId) {
    const childIds = new Set(
      menuCategories
        .filter((category) => category.parentId === movedBlock.id)
        .map((category) => category.id),
    )
    const movingKeys = new Set([
      pageBlockKey(movedBlock),
      ...Array.from(childIds).map((id) => `category:${id}`),
    ])
    const movingGroup = blocks.filter((block) => movingKeys.has(pageBlockKey(block)))
    if (movingGroup.length > 1) {
      const withoutGroup = blocks.filter((block) => !movingKeys.has(pageBlockKey(block)))
      const targetTopKey = targetBlock.type === 'category' && targetParentId
        ? `category:${targetParentId}`
        : pageBlockKey(targetBlock)
      const nextIndex = withoutGroup.findIndex((block) => pageBlockKey(block) === targetTopKey)
      if (nextIndex < 0) return { ok: false, reason: 'missing-block' }
      const insertIndex = nextIndex + (fromIndex < toIndex ? 1 : 0)
      withoutGroup.splice(insertIndex, 0, ...movingGroup)
      return { ok: true, blocks: withoutGroup, moved: movedBlock }
    }
  }

  const next = [...blocks]
  const [moved] = next.splice(fromIndex, 1)
  if (!moved) return { ok: false, reason: 'missing-block' }
  next.splice(toIndex, 0, moved)
  return { ok: true, blocks: next, moved }
}

export function getKeyboardMoveTarget(
  blocks: PageBlock[],
  menuCategories: MenuCategory[],
  sourceKey: string,
  direction: -1 | 1,
) {
  const source = blocks.find((block) => pageBlockKey(block) === sourceKey)
  if (!source) return null
  const sourceParentId = source.type === 'category'
    ? getCategoryParentId(menuCategories, source.id)
    : null
  const scope = sourceParentId
    ? blocks.filter(
        (block) => block.type === 'category' &&
          getCategoryParentId(menuCategories, block.id) === sourceParentId,
      )
    : blocks.filter(
        (block) => block.type !== 'category' || !getCategoryParentId(menuCategories, block.id),
      )
  const currentIndex = scope.findIndex((block) => pageBlockKey(block) === sourceKey)
  const target = scope[currentIndex + direction]
  return currentIndex < 0 || !target ? null : pageBlockKey(target)
}
