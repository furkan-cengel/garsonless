/** Read every server-capped page; never return partial data after a failure. */
export async function readAllPages<T>(
  read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 500,
): Promise<{ data: T[]; error: null } | { data: null; error: unknown }> {
  const rows: T[] = []
  for (let from = 0; ; from += pageSize) {
    const result = await read(from, from + pageSize - 1)
    if (result.error) return { data: null, error: result.error }
    const page = result.data ?? []
    rows.push(...page)
    if (page.length < pageSize) return { data: rows, error: null }
  }
}
