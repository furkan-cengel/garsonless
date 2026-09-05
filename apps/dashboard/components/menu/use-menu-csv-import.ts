'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import type { Tables } from '@garsonless/db/types'
import {
  ALLERGEN_CODES,
  ALLERGEN_LABELS,
  type AllergenCode,
  type MenuIngredient,
} from '@garsonless/db/browser'
import { parseMenuNumericInput } from '@garsonless/domain/menu'
import { importMenuRows } from '../../lib/actions/menu'

export interface CsvPreviewRow {
  sourceRow: number
  category: string
  name: string
  description: string
  price: number
  ingredients: MenuIngredient[]
  energyKcal: number | null
  mayContainAllergens: AllergenCode[]
  containsAlcohol: boolean
  containsPork: boolean
  error?: string
  warning?: string
}

export interface CsvImportPreview {
  fileName: string
  rows: CsvPreviewRow[]
  importing: boolean
  importProgress: { done: number; total: number } | null
}

interface UseMenuCsvImportOptions {
  restaurantId: string
  categories: Tables<'menu_categories'>[]
  items: Tables<'menu_items'>[]
  onCategoriesCreated: (categories: Tables<'menu_categories'>[]) => void
  onItemsCreated: (items: Tables<'menu_items'>[]) => void
  onComplete: (message: string, tone: 'error' | 'success') => void
  onRefresh: () => void
}

function downloadCsv(fileName: string, csv: string) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

function downloadMenuCsvTemplate() {
  const csv = 'Kategori,Ad,Açıklama,Fiyat,İçindekiler,Çıkarılabilir İçerikler,Kalori,Olası Alerjenler,Alkol,Domuz Kaynaklı\nAna Yemekler,Izgara Tavuk,Özel baharatlı,120,Tavuk;Domates;Soğan,Domates;Soğan,420,,Hayır,Hayır\nTatlılar,Sütlaç,Fırın sütlaç,45,Süt;Pirinç;Şeker,,260,Süt,Hayır,Hayır'
  downloadCsv('menu_sablonu.csv', csv)
}

function downloadCsvImportFailures(failures: Array<{ row: number; category: string; name: string; error: string }>) {
  const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`
  const csv = [
    ['Satır', 'Kategori', 'Ürün', 'Hata'].map(escape).join(','),
    ...failures.map((failure) => [failure.row, failure.category, failure.name, failure.error].map(escape).join(',')),
  ].join('\n')
  downloadCsv('menu_ice_aktarma_hatalari.csv', csv)
}

export function useMenuCsvImport({
  restaurantId,
  categories,
  items,
  onCategoriesCreated,
  onItemsCreated,
  onComplete,
  onRefresh,
}: UseMenuCsvImportOptions) {
  const [showStart, setShowStart] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [preview, setPreview] = useState<CsvImportPreview | null>(null)
  const importPendingRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function openStart() {
    setSetupError(null)
    setShowStart(true)
  }

  function closeStart() {
    setShowStart(false)
    setSetupError(null)
  }

  async function parseFile(file: File) {
    setSetupError(null)
    if (!file.name.toLocaleLowerCase('tr-TR').endsWith('.csv')) {
      setSetupError('Yalnızca .csv uzantılı dosyalar desteklenir.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setSetupError('Dosya 5 MB sınırını aşıyor.')
      return
    }

    try {
      const Papa = (await import('papaparse')).default
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          if (result.errors.length > 0) {
            const firstError = result.errors[0]
            setSetupError(`CSV okunamadı: ${firstError?.message ?? 'Biçim hatası'}`)
            return
          }
          const requiredHeaders = ['Kategori', 'Ad', 'Fiyat']
          const fields = new Set(result.meta.fields ?? [])
          const missingHeaders = requiredHeaders.filter((header) => !fields.has(header))
          if (missingHeaders.length > 0) {
            setSetupError(`Eksik zorunlu sütun: ${missingHeaders.join(', ')}`)
            return
          }
          if (result.data.length === 0) {
            setSetupError('Dosyada içe aktarılacak ürün satırı yok.')
            return
          }
          if (result.data.length > 1000) {
            setSetupError('Tek seferde en fazla 1.000 ürün içe aktarılabilir.')
            return
          }

          const allergenByLabel = new Map<string, AllergenCode>(
            ALLERGEN_CODES.flatMap((code) => [
              [code.toLowerCase(), code] as const,
              [ALLERGEN_LABELS[code].toLocaleLowerCase('tr-TR'), code] as const,
            ]),
          )
          const parseAllergens = (value: string | undefined) => {
            const labels = (value ?? '').split(';').map((part) => part.trim()).filter(Boolean)
            const codes: AllergenCode[] = []
            const unknown: string[] = []
            for (const label of labels) {
              const code = allergenByLabel.get(label.toLocaleLowerCase('tr-TR'))
              if (code) codes.push(code)
              else unknown.push(label)
            }
            return { codes: [...new Set(codes)], unknown }
          }
          const normalizeKey = (value: string) => value.trim().toLocaleLowerCase('tr-TR')
          const categoryNamesById = new Map(categories.map((category) => [category.id, category.name]))
          const existingProductKeys = new Set(items.map((item) => (
            `${normalizeKey(categoryNamesById.get(item.category_id) ?? '')}\u0000${normalizeKey(item.name)}`
          )))
          const fileProductKeys = new Set<string>()
          const rows = result.data.map((row, index): CsvPreviewRow => {
            const parsedPrice = parseMenuNumericInput(row['Fiyat'], { required: true, min: 0.01 })
            const price = parsedPrice.ok ? parsedPrice.value ?? 0 : 0
            const energyRaw = (row['Kalori'] ?? '').trim()
            const energyKcal = energyRaw ? Number(energyRaw) : null
            const name = (row['Ad'] ?? '').trim()
            const category = (row['Kategori'] ?? '').trim()
            const removableNames = new Set((row['Çıkarılabilir İçerikler'] ?? '').split(';').map((part) => part.trim().toLocaleLowerCase('tr-TR')).filter(Boolean))
            const ingredients = (row['İçindekiler'] ?? '').split(';').map((part) => part.trim()).filter(Boolean).map((ingredientName) => ({
              id: crypto.randomUUID(),
              name: ingredientName,
              removable: removableNames.has(ingredientName.toLocaleLowerCase('tr-TR')),
              allergen_codes: [] as AllergenCode[],
            }))
            const ingredientNames = new Set(ingredients.map((ingredient) => normalizeKey(ingredient.name)))
            const unmatchedRemovables = [...removableNames].filter((removable) => !ingredientNames.has(removable))
            const allergens = parseAllergens(row['Olası Alerjenler'])
            const productKey = `${normalizeKey(category)}\u0000${normalizeKey(name)}`
            const errors: string[] = []
            if (!name) errors.push('Ad boş')
            if (!category) errors.push('Kategori boş')
            if (!parsedPrice.ok) errors.push('Geçersiz fiyat')
            if (energyKcal !== null && (!Number.isInteger(energyKcal) || energyKcal < 0)) errors.push('Geçersiz kalori')
            if (unmatchedRemovables.length > 0) errors.push(`İçerikte yok: ${unmatchedRemovables.join(', ')}`)
            if (allergens.unknown.length > 0) errors.push(`Bilinmeyen alerjen: ${allergens.unknown.join(', ')}`)
            if (name && category && existingProductKeys.has(productKey)) errors.push('Ürün zaten mevcut')
            if (name && category && fileProductKeys.has(productKey)) errors.push('Dosyada tekrar ediyor')
            fileProductKeys.add(productKey)

            const missingFoodInfo = [
              ingredients.length === 0 ? 'içerik' : null,
              energyKcal === null ? 'kalori' : null,
            ].filter(Boolean)
            return {
              sourceRow: index + 2,
              category,
              name,
              description: (row['Açıklama'] ?? '').trim(),
              price,
              ingredients,
              energyKcal,
              mayContainAllergens: allergens.codes,
              containsAlcohol: ['evet', 'true', '1'].includes((row['Alkol'] ?? '').trim().toLocaleLowerCase('tr-TR')),
              containsPork: ['evet', 'true', '1'].includes((row['Domuz Kaynaklı'] ?? '').trim().toLocaleLowerCase('tr-TR')),
              error: errors.length > 0 ? errors.join(' · ') : undefined,
              warning: errors.length === 0 && missingFoodInfo.length > 0
                ? `${missingFoodInfo.join(' ve ')} eksik`
                : undefined,
            }
          })
          setShowStart(false)
          setPreview({ fileName: file.name, rows, importing: false, importProgress: null })
        },
        error: (error) => setSetupError(`CSV okunamadı: ${error.message}`),
      })
    } catch {
      setSetupError('CSV okunamadı. Dosyayı tekrar seçin.')
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) {
      try { await parseFile(file) } catch { setSetupError('CSV okunamadı. Dosyayı tekrar seçin.') }
    }
  }

  async function importPreview() {
    if (!preview || importPendingRef.current) return
    const validRows = preview.rows.filter((row) => !row.error)
    if (validRows.length === 0) return

    importPendingRef.current = true
    setPreview((current) => current ? {
      ...current,
      importing: true,
      importProgress: { done: 0, total: validRows.length },
    } : null)

    try {
      const result = await importMenuRows(restaurantId, validRows.map((row) => ({
        sourceRow: row.sourceRow,
        category: row.category,
        name: row.name,
        description: row.description,
        price: row.price,
        ingredients: row.ingredients,
        energyKcal: row.energyKcal,
        mayContainAllergens: row.mayContainAllergens,
        containsAlcohol: row.containsAlcohol,
        containsPork: row.containsPork,
      })))
      if ('error' in result) {
        setPreview((current) => current ? { ...current, importing: false, importProgress: null } : null)
        onComplete(result.error, 'error')
        return
      }

      const done = result.items.length
      const failed = result.failures.length
      if (result.categories.length > 0) onCategoriesCreated(result.categories)
      if (result.items.length > 0) onItemsCreated(result.items)
      if (result.failures.length > 0) downloadCsvImportFailures(result.failures)
      setPreview((current) => current ? {
        ...current,
        importProgress: { done: validRows.length, total: validRows.length },
      } : null)
      setPreview(null)
      onComplete(
        failed > 0
          ? `${done} ürün aktarıldı, ${failed} ürün aktarılamadı; hata raporu indirildi.`
          : `${done} ürün başarıyla içe aktarıldı`,
        failed > 0 ? 'error' : 'success',
      )
      onRefresh()
    } catch {
      onComplete('Aktarım sonucu doğrulanamadı. Menü yenilendikten sonra mevcut ürünleri kontrol edip dosyayı yeniden seçin.', 'error')
      // A lost response may follow a committed import; require a fresh preview.
      setPreview(null)
      onRefresh()
    } finally {
      importPendingRef.current = false
      setPreview((current) => current ? { ...current, importing: false, importProgress: null } : null)
    }
  }

  return {
    fileInputRef,
    showStart,
    setupError,
    preview,
    openStart,
    closeStart,
    chooseFile: () => fileInputRef.current?.click(),
    parseFile,
    handleFileChange,
    cancelPreview: () => { if (!importPendingRef.current) setPreview(null) },
    importPreview,
    downloadTemplate: downloadMenuCsvTemplate,
  }
}
