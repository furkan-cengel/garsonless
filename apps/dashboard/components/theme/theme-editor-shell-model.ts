interface ThemeEditorSaveStatusOptions {
  savingDraft: boolean
  publishing: boolean
  hasUnsavedChanges: boolean
  hasUnpublishedChanges: boolean
  lastSavedAt: Date | null
  lastPublishedAt: Date | null
}

export function getThemeEditorSaveStatus({
  savingDraft,
  publishing,
  hasUnsavedChanges,
  hasUnpublishedChanges,
  lastSavedAt,
  lastPublishedAt,
}: ThemeEditorSaveStatusOptions) {
  const text = publishing
    ? 'Yayınlanıyor'
    : savingDraft
      ? 'Kaydediliyor'
    : hasUnsavedChanges
      ? 'Kaydedilmedi'
      : hasUnpublishedChanges
        ? lastSavedAt
          ? `Taslak ${formatThemeEditorTime(lastSavedAt)}`
          : 'Taslak kaydedildi'
        : lastPublishedAt
          ? `Yayında ${formatThemeEditorTime(lastPublishedAt)}`
          : 'Yayında'

  return {
    text,
    color: hasUnsavedChanges || hasUnpublishedChanges ? '#b86408' : 'var(--positive)',
  }
}

function formatThemeEditorTime(date: Date) {
  return new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
