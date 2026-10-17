import { normalizeRestaurantPlan } from "./entitlements";

export const MEDIA_STORAGE_LIMITS = {
  starter: 250_000_000,
  plus: 1_000_000_000,
  pro: 5_000_000_000,
  business: 10_000_000_000,
} as const;
export function mediaStorageLimit(plan: unknown, trial = false) {
  return trial
    ? 1_000_000_000
    : MEDIA_STORAGE_LIMITS[normalizeRestaurantPlan(plan)];
}
export const MEDIA_MAX_BYTES = 8 * 1024 * 1024;
export const MEDIA_CONTEXTS = [
  "files",
  "menu",
  "theme",
  "settings",
  "tables",
] as const;
export type MediaContext = (typeof MEDIA_CONTEXTS)[number];
export type MediaPurpose = "image" | "menu" | "logo" | "video";
export interface MediaAsset {
  id: string;
  name: string;
  alt: string;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  url: string;
  menuUrl: string;
  logoUrl: string;
  createdAt: string;
  version: number;
  status: "ready" | "deleting";
  uses: { table: string; id: string; label: string }[];
}
export interface MediaSnapshot {
  assets: MediaAsset[];
  total: number;
  used: number;
  reserved: number;
  limit: number;
  initialized: boolean;
  canManage: boolean;
}
export interface MediaQuery {
  search?: string;
  type?: "all" | "image" | "video";
  usage?: "all" | "used" | "unused";
  sort?: "newest" | "largest";
  page?: number;
}
export function mediaUploadError(size: number, mime: string): string | null {
  if (!Number.isSafeInteger(size) || size <= 0 || size > MEDIA_MAX_BYTES)
    return "Dosya en fazla 8 MB olabilir.";
  if (
    ![
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/avif",
      "video/mp4",
      "video/webm",
    ].includes(mime)
  )
    return "JPEG, PNG, WebP, AVIF, MP4 veya WebM seçin.";
  return null;
}
export function mediaUrlFor(
  asset: MediaAsset,
  purpose: MediaPurpose,
): string | null {
  if (
    asset.status !== "ready" ||
    (purpose === "video") !== asset.mime.startsWith("video/")
  )
    return null;
  return purpose === "logo"
    ? asset.logoUrl
    : purpose === "menu"
      ? asset.menuUrl
      : asset.url;
}
export function formatMediaBytes(bytes: number) {
  if (bytes < 1_000) return `${bytes} B`;
  if (bytes < 1_000_000)
    return `${(bytes / 1_000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} KB`;
  return bytes >= 1_000_000_000
    ? `${(bytes / 1_000_000_000).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} GB`
    : `${(bytes / 1_000_000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} MB`;
}
export const MEDIA_ERRORS: Record<string, string> = {
  forbidden: "Bu işlem için yetkiniz yok.",
  quota_exceeded:
    "Depolama alanınız yeterli değil. Kullanılmayan dosyaları silin veya paketinizi yükseltin.",
  not_initialized:
    "Dosya kütüphanesi hazırlanıyor. Mevcut görselleriniz korunuyor.",
  in_use: "Dosya kullanımda. Önce bağlı alanlardan kaldırın.",
  conflict: "Dosya değişti. Listeyi yenileyip tekrar deneyin.",
  expired: "Yükleme süresi doldu. Dosyayı yeniden yükleyin.",
  not_found: "Dosya artık kullanılamıyor. Yeniden seçin.",
  request_mismatch: "Bu yükleme isteği başka bir dosyaya ait.",
  busy: "Dosya hazırlanıyor. Biraz sonra yeniden deneyin.",
  invalid_file: "Dosya içeriği veya boyutu desteklenmiyor.",
  unavailable: "İşlem tamamlanamadı. Seçiminiz korunuyor; yeniden deneyin.",
};
export function mediaErrorMessage(code: string) {
  return MEDIA_ERRORS[code] ?? MEDIA_ERRORS.unavailable!;
}

/** Theme history rows keep files alive but are not places the owner uses them. */
export function summarizeMediaUses(uses: MediaAsset["uses"]): { live: number; history: number } {
  const history = uses.filter((use) => use.table === "theme_config_history").length;
  return { live: uses.length - history, history };
}

export function formatMediaUseSummary(uses: MediaAsset["uses"]): string {
  const { live, history } = summarizeMediaUses(uses);
  if (live === 0 && history === 0) return "Henüz kullanılmıyor";
  if (live === 0) return `Sadece ${history} eski tema sürümünde`;
  return history > 0 ? `${live} yerde kullanılıyor · ${history} eski sürümde` : `${live} yerde kullanılıyor`;
}

const GENERATED_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.[a-z0-9]+)?$/i;

/**
 * A readable title for the gallery. Older uploads were stored under a UUID;
 * those fall back to the description, then to where the file is used.
 */
export function mediaDisplayName(asset: Pick<MediaAsset, "name" | "alt" | "uses">): { title: string; generated: boolean } {
  const name = asset.name.trim();
  if (!GENERATED_NAME.test(name)) return { title: asset.name, generated: false };
  const alt = asset.alt.trim();
  if (alt) return { title: alt, generated: true };
  // Several files can share a use ("Yayındaki tema"), so keep a short code to tell them apart.
  const code = `#${name.slice(0, 6).toLowerCase()}`;
  const use = asset.uses.find((entry) => entry.table !== "theme_config_history") ?? asset.uses[0];
  return { title: use ? `${use.label} görseli · ${code}` : `Adsız dosya · ${code}`, generated: true };
}
