import { bulkPrice, menuBulkPatches, type MenuBulkItem, type MenuBulkValues } from '@garsonless/domain/menu-bulk'
export type BulkDraft = Omit<MenuBulkValues, 'price'> & { price: string }
export const toBulkDraft = (item: MenuBulkValues): BulkDraft => ({ name: item.name, description: item.description, category_id: item.category_id, is_available: item.is_available, price: item.price.toFixed(2).replace('.', ',') })
export function draftPatches(original: MenuBulkItem[], draft: BulkDraft[]) {
  return menuBulkPatches(original, draft.map((item, index) => {
    try { return { ...item, price: bulkPrice(item.price) } }
    catch (cause) { throw new Error(`${original[index]?.name ?? 'Ürün'}: ${cause instanceof Error ? cause.message : 'Fiyatı kontrol edin.'}`, { cause }) }
  }))
}
export const bulkErrorMessage = (error: string) => ({
  forbidden: 'Bu menüde işlem yapma yetkiniz veya aktif paket erişiminiz yok.',
  conflict: 'Bazı ürünler değiştirildi veya silindi. Hiçbir ürün kaydedilmedi. Güncel değerleri yükleyip taslağınızı yeniden inceleyin.',
  invalid_request: 'Seçimi ve alanları kontrol edin. Bir işlemde en fazla 500 ürün ve 700 KB metin desteklenir.',
  invalid_values: 'Ürün alanlarından biri geçersiz. Ad, açıklama, kategori ve fiyatları kontrol edin.',
  request_mismatch: 'Bu istek farklı bir işlem için kullanılmış. Önizlemeye dönüp yeniden deneyin.',
  not_found: 'İşlem artık bulunamıyor.',
  unavailable: 'Sonuç doğrulanamadı. Aynı işlemi güvenle tekrar deneyebilirsiniz.',
}[error] ?? error)
