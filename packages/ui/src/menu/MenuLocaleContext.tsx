"use client";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  EMPTY_MENU_TRANSLATIONS,
  translatedMenuText,
  type MenuLocale,
  type PublicMenuTranslations,
} from "@garsonless/domain/menu-translation";
import type { MenuItem, MenuCategory } from "./types";
import type { GarsonlessTheme } from "@garsonless/design-engine";
import { makeReaders } from "../themes/default/lib/sectionHelpers";
import { MENU_ENGLISH } from "./menuEnglish";
const Context = createContext({
  locale: "tr" as MenuLocale,
  data: EMPTY_MENU_TRANSLATIONS,
});
export function MenuLocaleProvider({
  locale,
  data,
  children,
}: {
  locale: MenuLocale;
  data: PublicMenuTranslations;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ locale, data }), [locale, data]);
  return (
    <Context.Provider value={value}>
      <div
        lang={locale}
        data-menu-language={locale}
        style={{ display: "contents" }}
      >
        {children}
      </div>
    </Context.Provider>
  );
}
export function useMenuLocale() {
  const { locale, data } = useContext(Context);
  return useMemo(() => {
    const text = (key: string, source: string) =>
      translatedMenuText(data, locale, key, source);
    const t = (
      source: string,
      variables: Record<string, string | number> = {},
    ) => {
      let value = locale === "en" ? (MENU_ENGLISH[source] ?? source) : source;
      for (const [key, replacement] of Object.entries(variables))
        value = value.replaceAll(`{${key}}`, String(replacement));
      return value;
    };
    const item = (source: MenuItem): MenuItem => {
      if (locale === "tr") return source;
      const prefix = `item/${source.id}`;
      return {
        ...source,
        name: text(`${prefix}/name`, source.name),
        description:
          source.description === null
            ? null
            : text(`${prefix}/description`, source.description),
        allergen_note:
          source.allergen_note === null
            ? null
            : text(`${prefix}/allergen_note`, source.allergen_note),
        cross_contact_note:
          source.cross_contact_note === null
            ? null
            : text(`${prefix}/cross_contact_note`, source.cross_contact_note),
        ingredients: source.ingredients.map((ingredient) => ({
          ...ingredient,
          name: text(
            `${prefix}/ingredient/${ingredient.id}/name`,
            ingredient.name,
          ),
          ...(ingredient.amount
            ? {
                amount: text(
                  `${prefix}/ingredient/${ingredient.id}/amount`,
                  ingredient.amount,
                ),
              }
            : {}),
        })),
        modifier_groups: source.modifier_groups.map((group) => ({
          ...group,
          name: text(`${prefix}/group/${group.id}/name`, group.name),
          options: group.options.map((option) => ({
            ...option,
            name: text(
              `${prefix}/group/${group.id}/option/${option.id}/name`,
              option.name,
            ),
          })),
        })),
      };
    };
    const category = (source: MenuCategory) => ({
      ...source,
      name: text(`category/${source.id}/name`, source.name),
    });
    const theme = (source: GarsonlessTheme): GarsonlessTheme => {
      if (locale === "tr") return source;
      return {
        ...source,
        ...(source.pageDescription !== undefined
          ? {
              pageDescription: text(
                "theme/pageDescription",
                source.pageDescription,
              ),
            }
          : {}),
        ...(source.menuCustomFilters
          ? {
              menuCustomFilters: source.menuCustomFilters.map((filter) => ({
                ...filter,
                label: text(`theme/filter/${filter.id}/label`, filter.label),
              })),
            }
          : {}),
        sectionSettings: Object.fromEntries(
          Object.entries(source.sectionSettings ?? {}).map(([id, settings]) => [
            id,
            Object.fromEntries(
              Object.entries(settings).map(([key, value]) => [
                key,
                text(`theme/section/${id}/${key}`, value),
              ]),
            ),
          ]),
        ),
      };
    };
    return { locale, text, t, item, category, theme };
  }, [locale, data]);
}

/** Localizes default menu copy only; authored fields require an approved source match. */
export function useMenuReaders(config: Record<string, string>) {
  const { t } = useMenuLocale();
  const readers = makeReaders(config);
  return {
    ...readers,
    text: (key: string, fallback: string) => config[key]?.trim() || t(fallback),
  };
}
