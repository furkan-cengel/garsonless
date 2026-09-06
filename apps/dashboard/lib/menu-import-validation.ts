import { z } from 'zod'
import { ALLERGEN_CODES } from '@garsonless/domain/menu'

export const bulkImportRowSchema = z.object({
  sourceRow: z.number().int().min(2),
  category: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500),
  price: z.number().min(0.01),
  ingredients: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1).max(120),
    removable: z.boolean(),
    allergen_codes: z.array(z.enum(ALLERGEN_CODES)),
    amount: z.string().max(40).optional(),
  })).max(100),
  energyKcal: z.number().int().min(0).nullable(),
  mayContainAllergens: z.array(z.enum(ALLERGEN_CODES)),
  containsAlcohol: z.boolean(),
  containsPork: z.boolean(),
})
export type MenuBulkImportRow = z.infer<typeof bulkImportRowSchema>

export function parseCsvBoolean(value: string | undefined, column: string) {
  const normalized = (value ?? '').trim().toLocaleLowerCase('tr-TR')
  if (['evet', 'true', '1'].includes(normalized)) return { value: true }
  if (['', 'hayır', 'hayir', 'false', '0'].includes(normalized)) return { value: false }
  return { value: false, error: `${column}: evet/hayır, true/false veya 1/0 kullanın` }
}

const columns: Record<string, string> = {
  category: 'Kategori', name: 'Ad', description: 'Açıklama', price: 'Fiyat',
  ingredients: 'İçindekiler', energyKcal: 'Kalori', mayContainAllergens: 'Olası Alerjenler',
  containsAlcohol: 'Alkol', containsPork: 'Domuz Kaynaklı',
}
export function menuImportRowErrors(row: unknown): string[] {
  const result = bulkImportRowSchema.safeParse(row)
  if (result.success) return []
  return [...new Set(result.error.issues.map((issue) => {
    const column = columns[String(issue.path[0])] ?? String(issue.path[0])
    return issue.code === 'too_big'
      ? `${column}: en fazla ${issue.maximum} ${issue.type === 'array' ? 'öğe' : 'karakter'}`
      : `${column}: geçersiz değer`
  }))]
}
