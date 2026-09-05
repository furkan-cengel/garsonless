/** A failed read must not masquerade as a legitimately empty menu in the editor. */
export function requireThemeMenuReferences<T>(result: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!result.ok) throw new Error('Theme menu references unavailable')
  return result.value
}
