/** Translation is a presentation concern of the QR menu, never an order input. */
export type MenuLocale = "tr" | "en";
export type MenuTranslationValue = { source: string; text: string };
export type PublicMenuTranslations = {
  enabled: boolean;
  revision: number;
  fields: Record<string, MenuTranslationValue>;
};
export const EMPTY_MENU_TRANSLATIONS: PublicMenuTranslations = {
  enabled: false,
  revision: 0,
  fields: {},
};
export const TRANSLATION_MODES = [
  "snapshot",
  "generate",
  "save",
  "publish",
  "enable",
  "disable",
  "glossary",
] as const;
export type TranslationMode = (typeof TRANSLATION_MODES)[number];
export type TranslationField = {
  key: string;
  label: string;
  source: string;
  sourceVersion: number;
  version: number;
  draft: string | null;
  draftSourceVersion: number | null;
  published: string | null;
  publishedSourceVersion: number | null;
  manualDraft?: { text: string; source: string; sourceVersion: number } | null;
};
export type TranslationSnapshot = {
  enabled: boolean;
  allowed: boolean;
  owner: boolean;
  revision: number;
  fields: TranslationField[];
  glossary: Record<string, string>;
  quota: { limit: number; used: number; reserved: number; period: string };
  jobs: {
    id: string;
    status: string;
    error: string | null;
    createdAt: string;
  }[];
};
export type TranslationRequest = {
  restaurantId: string;
  mode: TranslationMode;
  requestId?: string;
  payload?: Record<string, unknown>;
};
export type TranslationResult =
  | { ok: true; data: TranslationSnapshot }
  | { ok: false; error: string };

export function resolveMenuLocale(input: {
  enabled: boolean;
  explicit?: string | null;
  saved?: string | null;
  acceptLanguage?: string | null;
}): MenuLocale {
  if (!input.enabled) return "tr";
  for (const value of [input.explicit, input.saved])
    if (value === "tr" || value === "en") return value;
  const preferences = (input.acceptLanguage ?? "")
    .split(",")
    .map((part, index) => {
      const [tag = "", ...parameters] = part.trim().split(";");
      const quality = parameters.find((parameter) =>
        parameter.trim().startsWith("q="),
      );
      return {
        language: tag.toLowerCase().split("-")[0],
        quality: quality ? Number(quality.trim().slice(2)) : 1,
        index,
      };
    })
    .filter(
      (entry) =>
        Number.isFinite(entry.quality) &&
        entry.quality > 0 &&
        entry.quality <= 1,
    )
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
  return preferences.find(
    (entry) => entry.language === "tr" || entry.language === "en",
  )?.language === "en"
    ? "en"
    : "tr";
}

export function translatedMenuText(
  data: PublicMenuTranslations,
  locale: MenuLocale,
  key: string,
  source: string,
): string {
  const value = data.fields[key];
  return locale === "en" && data.enabled && value?.source === source
    ? value.text
    : source;
}

export function translationFieldStatus(
  field: TranslationField,
): "missing" | "stale" | "draft" | "published" {
  if (field.draft && field.draftSourceVersion === field.sourceVersion) {
    if (
      field.published === field.draft &&
      field.publishedSourceVersion === field.sourceVersion
    )
      return "published";
    return "draft";
  }
  return field.published || field.draft ? "stale" : "missing";
}

export function validateTranslationText(
  source: string,
  text: unknown,
): text is string {
  if (
    typeof text !== "string" ||
    !text.trim() ||
    text.length > 12000 ||
    /[<>]/u.test(text) ||
    [...text].some((character) => character.charCodeAt(0) < 9)
  )
    return false;
  // Keep quantities exact, including decimal separators; no currency/price is sent to AI.
  const numbers = (value: string) =>
    (value.match(/\d+(?:[.,]\d+)?/g) ?? []).sort().join("|");
  return numbers(source) === numbers(text);
}
