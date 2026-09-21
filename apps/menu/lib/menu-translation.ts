import "server-only";
import { cookies, headers } from "next/headers";
import { readPublicMenuTranslations } from "@garsonless/db/server";
import { resolveMenuLocale } from "@garsonless/domain/menu-translation";
export async function readMenuLanguage(
  restaurantId: string,
  explicit: string | string[] | undefined,
) {
  const [translations, cookieStore, requestHeaders] = await Promise.all([
    readPublicMenuTranslations(restaurantId),
    cookies(),
    headers(),
  ]);
  return {
    menuTranslations: translations,
    initialMenuLocale: resolveMenuLocale({
      enabled: translations.enabled,
      explicit: typeof explicit === "string" ? explicit : null,
      saved: cookieStore.get("masabu_menu_locale")?.value,
      acceptLanguage: requestHeaders.get("accept-language"),
    }),
  };
}
