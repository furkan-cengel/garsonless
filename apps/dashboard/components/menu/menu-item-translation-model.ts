import { translationFieldStatus, type TranslationField } from '@garsonless/domain/menu-translation'

/** The English a field should show: its current draft, else its published text. */
export function currentEnglish(field: TranslationField | undefined) {
  if (!field) return ''
  return field.draft && field.draftSourceVersion === field.sourceVersion ? field.draft : field.published ?? ''
}

/** Typed English that differs from what the field already holds; blank text is never saved. */
export function typedEnglishChanges(fields: TranslationField[], edits: Record<string, string>) {
  return fields
    .filter((field) => edits[field.key] !== undefined && edits[field.key]!.trim() !== '' && edits[field.key] !== currentEnglish(field))
    .map((field) => ({ key: field.key, text: edits[field.key]!.trim(), version: field.version, sourceVersion: field.sourceVersion }))
}

/** Drafts that match the current Turkish and are not live yet: what Kaydet publishes. */
export function publishableDrafts(fields: TranslationField[]) {
  return fields
    .filter((field) => translationFieldStatus(field) === 'draft')
    .map(({ key, version, sourceVersion }) => ({ key, version, sourceVersion }))
}
