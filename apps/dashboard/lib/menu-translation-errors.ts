/** User-facing text for menu translation failures, shared by the translations page and the product panel. */
const errors: Record<string, string> = {
  forbidden: "Bu işlem için yetkiniz bulunmuyor.",
  plan_required:
    "Menü çevirisi Pro, Pro denemesi ve Business paketlerinde kullanılabilir.",
  not_initialized: "Çeviri altyapısı henüz bu ortamda kurulmamış.",
  unavailable:
    "İşlem tamamlanamadı. Düzenlemeleriniz korunuyor; yeniden deneyin.",
  conflict:
    "Bu metin siz düzenlerken değişti. Güncel kaynakla karşılaştırın; düzenlemeniz korunuyor.",
  incomplete:
    "İngilizceyi açmadan önce görünür menüdeki tüm çevirileri yayınlayın.",
  nothing_queued:
    "Yeni iş eklenmedi. Çeviriler güncel veya sırada olabilir; kalan kotanızı da kontrol edin.",
  invalid_numbers: "Çevirideki sayılar kaynak metinle aynı olmalı.",
  invalid_text: "Çeviriyi düz metin olarak, boş bırakmadan girin.",
};
export function translationErrorText(code: string) {
  return (
    errors[code] ??
    "İşlem tamamlanamadı. Düzenlemenizi kontrol edip tekrar deneyin."
  );
}
