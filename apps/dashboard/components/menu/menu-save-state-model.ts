export type MenuSaveState = 'clean' | 'dirty' | 'saving' | 'saved'

export function getMenuSaveState({
  dirty,
  saving,
  recentlySaved,
}: {
  dirty: boolean
  saving: boolean
  recentlySaved: boolean
}): MenuSaveState {
  if (saving) return 'saving'
  if (dirty) return 'dirty'
  if (recentlySaved) return 'saved'
  return 'clean'
}
