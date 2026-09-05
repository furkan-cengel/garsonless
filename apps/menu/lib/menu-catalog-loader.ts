interface CatalogReads<Category extends { id: string }, Item> {
  readRevision: () => Promise<{ revision: number }>
  readCategories: (restaurantId: string, revision: number) => Promise<Category[]>
  readItems: (restaurantId: string, revision: number, categoryIds: string[]) => Promise<Item[]>
}

/** Keep only real catalog dependencies in the chain, independent of auth/theme reads. */
export async function loadMenuCatalog<Category extends { id: string }, Item>(
  restaurantId: string,
  reads: CatalogReads<Category, Item>,
): Promise<{ categories: Category[]; items: Item[] }> {
  const { revision } = await reads.readRevision()
  const categories = await reads.readCategories(restaurantId, revision)
  const items = await reads.readItems(restaurantId, revision, categories.map(({ id }) => id))
  return { categories, items }
}
