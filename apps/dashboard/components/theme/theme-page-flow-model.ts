import {
  getSectionDefinitionId,
  groupMenuPageBlocksByPlacement,
  normalizeMenuPageBlockCategoryScope,
  resolveMenuPageFlow,
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
  | { ok: false; reason: 'missing-block' | 'child-scope' | 'nested-target' | 'placement-scope' }

export function pageBlockKey(block: PageBlock) {
  return `${block.type}:${block.id}`
}

export function buildPageBlocks(
  theme: Partial<GarsonlessTheme>,
  menuCategories: MenuCategory[],
  validSectionIds: Iterable<string>,
): PageBlock[] {
  return resolveMenuPageFlow({
    ...(theme.pageBlocks ? { pageBlocks: theme.pageBlocks } : {}),
    ...(theme.sections ? { legacySections: theme.sections } : {}),
    categories: menuCategories,
    validSectionIds: new Set(validSectionIds),
  })
}

export function getCategoryParentId(menuCategories: MenuCategory[], categoryId: string) {
  return menuCategories.find((category) => category.id === categoryId)?.parentId ?? null
}

export function normalizePageBlocksForCategoryScope(
  blocks: PageBlock[],
  menuCategories: MenuCategory[],
) {
  return normalizeMenuPageBlockCategoryScope(blocks, menuCategories)
}

export function getPageBlockReorderScope(
  block: PageBlock,
  menuCategories: MenuCategory[],
) {
  if (block.placement === 'drawer') return 'drawer'
  if (block.type === 'category') {
    const parentId = getCategoryParentId(menuCategories, block.id)
    if (parentId) return `children:${parentId}`
  }
  return 'main'
}

export function getPageBlockReorderScopeBlocks(
  blocks: PageBlock[],
  menuCategories: MenuCategory[],
  sourceKey: string,
) {
  const source = blocks.find((block) => pageBlockKey(block) === sourceKey)
  if (!source) return []
  const scope = getPageBlockReorderScope(source, menuCategories)
  return blocks.filter((block) => getPageBlockReorderScope(block, menuCategories) === scope)
}

export function filterPageBlocksForQuery(
  blocks: PageBlock[],
  menuCategories: MenuCategory[],
  query: string,
  getSearchText: (block: PageBlock) => string,
) {
  if (!query) return blocks
  const matchingKeys = new Set(blocks.flatMap((block) =>
    getSearchText(block).toLocaleLowerCase('tr').includes(query)
      ? [pageBlockKey(block)]
      : [],
  ))
  const includedKeys = new Set(matchingKeys)
  for (const block of blocks) {
    if (block.type !== 'category' || !matchingKeys.has(pageBlockKey(block))) continue
    const parentId = getCategoryParentId(menuCategories, block.id)
    if (parentId) {
      includedKeys.add(`category:${parentId}`)
      continue
    }
    for (const child of menuCategories.filter((category) => category.parentId === block.id)) {
      includedKeys.add(`category:${child.id}`)
    }
  }
  return blocks.filter((block) => includedKeys.has(pageBlockKey(block)))
}

function createSectionInstanceId(blocks: PageBlock[], sectionId: string) {
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
    ...(['hours', 'wifi-info'].includes(sectionId) ? { placement: 'drawer' as const } : {}),
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

  const sourceScope = getPageBlockReorderScope(movedBlock, menuCategories)
  const targetScope = getPageBlockReorderScope(targetBlock, menuCategories)
  if (sourceScope !== targetScope) {
    if (movedBlock.type === 'category' && movedParentId) return { ok: false, reason: 'child-scope' }
    if (targetBlock.type === 'category' && targetParentId) return { ok: false, reason: 'nested-target' }
    return { ok: false, reason: 'placement-scope' }
  }

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
      return {
        ok: true,
        blocks: groupMenuPageBlocksByPlacement(
          normalizePageBlocksForCategoryScope(withoutGroup, menuCategories),
        ),
        moved: movedBlock,
      }
    }
  }

  const next = [...blocks]
  const [moved] = next.splice(fromIndex, 1)
  if (!moved) return { ok: false, reason: 'missing-block' }
  next.splice(toIndex, 0, moved)
  return {
    ok: true,
    blocks: groupMenuPageBlocksByPlacement(
      normalizePageBlocksForCategoryScope(next, menuCategories),
    ),
    moved,
  }
}

export function getKeyboardMoveTarget(
  blocks: PageBlock[],
  menuCategories: MenuCategory[],
  sourceKey: string,
  direction: -1 | 1,
) {
  const source = blocks.find((block) => pageBlockKey(block) === sourceKey)
  if (!source) return null
  const scope = getPageBlockReorderScopeBlocks(blocks, menuCategories, sourceKey)
  const currentIndex = scope.findIndex((block) => pageBlockKey(block) === sourceKey)
  const target = scope[currentIndex + direction]
  return currentIndex < 0 || !target ? null : pageBlockKey(target)
}
