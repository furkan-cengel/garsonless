interface ThemeEditorSaveStatusOptions {
  saving: boolean
  hasUnsavedChanges: boolean
  lastSavedAt: Date | null
}

export function getThemeEditorSaveStatus({
  saving,
  hasUnsavedChanges,
  lastSavedAt,
}: ThemeEditorSaveStatusOptions) {
  const text = saving
    ? 'Kaydediliyor'
    : hasUnsavedChanges
      ? 'Kaydedilmedi'
      : lastSavedAt
        ? `Kaydedildi ${formatThemeEditorTime(lastSavedAt)}`
        : 'Kaydedildi'

  return {
    text,
    color: hasUnsavedChanges ? '#b86408' : 'var(--positive)',
  }
}

export function formatThemeEditorTime(date: Date) {
  return new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
