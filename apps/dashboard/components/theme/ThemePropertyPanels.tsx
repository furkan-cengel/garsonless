"use client";

import type { ReactNode } from "react";
import type { GarsonlessTheme } from "@garsonless/design-engine";
import type { SettingField } from "@garsonless/ui/themes";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldDescription, FieldGroup } from "@/components/ui/field";

import {
  contrastRatio,
  deriveSoftColor,
} from "./theme-property-renderer-model";
import {
  HeaderPropertyField,
  PropertyFieldEditor,
  PropertySection,
  ThemeColorField,
} from "./ThemePropertyControls";
import { MenuFilterPropertyEditor } from "./MenuFilterPropertyEditor";

const HEADER_FIELD_SECTIONS: Array<{ title: string; ids: string[] }> = [
  {
    title: "Görünüm",
    ids: [
      "headerLogoStyle",
      "headerNameSize",
      "headerLogoSize",
      "logoShape",
      "logoBg",
      "logoShadow",
      "logoBorder",
      "headerStyle",
    ],
  },
  {
    title: "Yerleşim",
    ids: ["headerPreset", "headerAlign", "stickyHeader", "headerHeight"],
  },
  {
    title: "Boşluk ve çizgi",
    ids: ["headerPadY", "headerBottomGap", "headerBorder"],
  },
  {
    title: "Görünür öğeler",
    ids: ["headerShowMenu", "headerShowContextBar"],
  },
  { title: "Aksiyon konumları", ids: ["memberPlacement", "billPlacement", "cartPlacement", "servicePlacement"] },
  { title: "İçerik", ids: ["headerTagline"] },
];

const DRAWER_FIELD_SECTIONS: Array<{ title: string; ids: string[] }> = [
  { title: "Hazır stil", ids: ["drawerPreset"] },
  {
    title: "Görünüm",
    ids: ["drawerTone", "drawerWidth", "drawerRadius", "drawerShadow", "drawerOverlayOpacity", "drawerOverlayBlur"],
  },
  { title: "Yerleşim", ids: ["drawerPosition", "drawerSide"] },
  {
    title: "Kategori satırları",
    ids: ["drawerDensity", "drawerShowIcons", "drawerIconStyle", "drawerShowCounts", "drawerShowDescriptions", "drawerActiveStyle"],
  },
  {
    title: "Tipografi",
    ids: ["drawerTopFontSize", "drawerSubFontSize", "drawerFontRole", "drawerTextCase"],
  },
  {
    title: "İçerik",
    ids: ["drawerShowSearch", "drawerShowBrand", "drawerShowStatus", "drawerShowTable"],
  },
  {
    title: "Müşteri merkezi",
    ids: [],
  },
];

const CARD_FIELD_SECTIONS: Array<{ title: string; ids: string[] }> = [
  {
    title: "Kart yüzeyi",
    ids: ["radius", "shadow", "border", "cardHover", "cardPlaceholderStyle"],
  },
  { title: "Aksiyon", ids: ["cardCtaStyle", "cardCtaIcon"] },
  {
    title: "Kart düzeni",
    ids: ["cardLayout", "cardColumns", "cardDensity", "cardPriceAlign"],
  },
  {
    title: "Görsel",
    ids: [
      "cardImageAspect",
      "cardImageFit",
      "cardImagePosition",
      "cardHorizontalImageWidth",
    ],
  },
  {
    title: "İçerik",
    ids: [
      "cardShowImage",
      "cardShowDesc",
      "cardShowTag",
      "cardTitleLines",
      "cardDescriptionLines",
    ],
  },
];

const NAV_FIELD_SECTIONS: Array<{ title: string; ids: string[] }> = [
  {
    title: "Görünüm",
    ids: ["catnavStyle", "catnavActiveStyle", "catnavFontSize"],
  },
  {
    title: "Yerleşim",
    ids: [
      "catnavAlign",
      "catnavDensity",
      "catnavItemGap",
      "navTopGap",
      "navBottomGap",
      "stickyNav",
    ],
  },
  {
    title: "Davranış ve içerik",
    ids: ["catnavShowCount", "catnavAutoCenter", "catnavEdgeFade"],
  },
  {
    title: "Görsel kartlar",
    ids: [
      "catnavVisualStyle",
      "catnavVisualCardWidth",
      "catnavVisualCardHeight",
      "catnavVisualRadius",
    ],
  },
  {
    title: "Fotoğraf overlay",
    ids: [
      "catnavOverlayTextPosition",
      "catnavOverlayTextAlign",
      "catnavOverlayTextColor",
      "catnavOverlayColor",
      "catnavOverlayOpacity",
      "catnavOverlayBlur",
    ],
  },
];

const LAYOUT_FIELD_SECTIONS: Array<{ title: string; ids: string[] }> = [
  {
    title: "Sayfa görünümü",
    ids: ["texture", "textureStrength", "sectionHeading", "pageMaxWidth"],
  },
  {
    title: "Sayfa boşlukları",
    ids: [
      "pad",
      "sectionGap",
      "sectionHeadingTopGap",
      "sectionHeadingBottomGap",
    ],
  },
  { title: "Ürün grid’i", ids: ["gap"] },
];

const THEME_COLOR_IDS = [
  "bg",
  "cardColor",
  "textColor",
  "mutedTextColor",
  "accent",
  "accentSoft",
  "cta",
  "ctaTextColor",
  "borderColor",
  "headerBg",
];

const CART_FIELD_SECTIONS: Array<{ title: string; ids: string[] }> = [
  {
    title: "Sepete erişim",
    ids: [
      "cartHeaderTriggerStyle",
      "cartFooterTriggerStyle",
      "cartIcon",
      "cartShowBadge",
    ],
  },
  {
    title: "Alt tetikleyici",
    ids: [
      "cartPillTone",
      "cartPillPosition",
      "cartShowSubtotal",
      "cartShowItemCount",
    ],
  },
  { title: "Sepet çekmecesi", ids: ["cartDrawerTone"] },
  {
    title: "Metinler",
    ids: ["cartButtonText", "cartEmptyText", "cartPrimaryActionText"],
  },
];

const FOOTER_FIELD_SECTIONS: Array<{ title: string; ids: string[] }> = [
  {
    title: "Durum",
    ids: ["footerEnabled"],
  },
  {
    title: "İçerik",
    ids: ["footerShowLogo", "footerShowAddress", "footerShowContact", "footerShowSocial", "footerShowCopyright"],
  },
  { title: "Görünüm", ids: ["footerTone"] },
];

type FieldPanelProps = {
  fields: SettingField[];
  getValue: (field: SettingField) => unknown;
  onChange: (field: SettingField, value: unknown) => void;
};

function CompactPanelCard({
  title,
  children,
  contentClassName,
}: {
  title: string;
  children: ReactNode;
  contentClassName?: string;
}) {
  return (
    <Card data-theme-property-card size="sm" className={panelCard}>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}

function PanelFields({
  sections,
  fields,
  getValue,
  onChange,
  filter,
  fieldNote,
}: FieldPanelProps & {
  sections: Array<{ title: string; ids: string[] }>;
  filter?: (field: SettingField) => boolean;
  fieldNote?: (field: SettingField) => string | null;
}) {
  return sections.map((section) => {
    const sectionFields = section.ids
      .map((id) => fields.find((field) => field.id === id))
      .filter((field): field is SettingField => Boolean(field))
      .filter((field) => filter?.(field) ?? true);
    if (!sectionFields.length) return null;
    return (
      <CompactPanelCard key={section.title} title={section.title}>
        <FieldGroup className={panelFieldGroup}>
          {sectionFields.map((field) => (
            <div key={field.id} className="flex flex-col gap-1">
              <HeaderPropertyField
                field={field}
                value={getValue(field)}
                onChange={(value) => onChange(field, value)}
              />
              {fieldNote?.(field) && (
                <FieldDescription className="text-xs">
                  {fieldNote(field)}
                </FieldDescription>
              )}
            </div>
          ))}
        </FieldGroup>
        {section.title === "Ürün grid’i" && (
          <Alert role="note" className="mt-2.5"><AlertDescription>
            Sütun sayısı ve kart yapısı Kartlar → Düzen bölümünden yönetilir. Mobilde en fazla iki sütun gösterilir.
          </AlertDescription></Alert>
        )}
      </CompactPanelCard>
    );
  });
}

function HeaderPropertyPanel(props: FieldPanelProps) {
  return (
    <div
      data-header-property-panel
      data-modern-property-panel
      className={panelLayout}
    >
      <PanelFields sections={HEADER_FIELD_SECTIONS} {...props} />
    </div>
  );
}

function DrawerPropertyPanel(props: FieldPanelProps) {
  return (
    <div data-drawer-property-panel data-modern-property-panel className={panelLayout}>
      <InfoNote>
        Drawer içeriğini Bölüm Ekle alanından taşıyabilir; canlı konumunu, görünümünü ve yalnız kullanılabilir müşteri aksiyonlarını buradan düzenleyebilirsiniz.
      </InfoNote>
      <PanelFields sections={DRAWER_FIELD_SECTIONS} {...props} />
    </div>
  );
}

function CardPropertyPanel({
  layout,
  ...props
}: FieldPanelProps & { layout: GarsonlessTheme["cardLayout"] }) {
  return (
    <div
      data-card-property-panel
      data-modern-property-panel
      className={panelLayout}
    >
      {layout === "minimal" && (
        <InfoNote>
          Minimal düzende ürün görseli ve hızlı ekleme aksiyonu kullanılmaz.
        </InfoNote>
      )}
      <PanelFields
        sections={CARD_FIELD_SECTIONS}
        {...props}
        fieldNote={(field) =>
          field.id === "cardShowDesc"
            ? "Yalnız açıklaması olan ürünlerde görünür."
            : field.id === "cardShowTag"
              ? "Yalnız seçenek grubu olan ürünlerde görünür."
              : null
        }
      />
    </div>
  );
}

function NavPropertyPanel({
  visual,
  menuItems,
  ...props
}: FieldPanelProps & {
  visual: boolean;
  menuItems: Array<{ id: string; name: string; categoryName: string; isAvailable?: boolean }>;
}) {
  const regularFields = props.fields.filter((field) => !["menuFilterPresetIds", "menuCustomFilters"].includes(field.id));
  const presetField = props.fields.find((field) => field.id === "menuFilterPresetIds");
  const customField = props.fields.find((field) => field.id === "menuCustomFilters");
  return (
    <div data-nav-property-panel data-modern-property-panel className={panelLayout}>
      {visual && (
        <InfoNote>
          Görselli navigasyon kategori kartlarıyla çalışır; sticky ve aktif
          öğeyi ortalama ayarları yalnız yatay metin navigasyonunda kullanılır.
        </InfoNote>
      )}
      <PanelFields sections={NAV_FIELD_SECTIONS} {...props} fields={regularFields} />
      {presetField && customField && (
        <MenuFilterPropertyEditor
          presetValue={props.getValue(presetField)}
          customValue={props.getValue(customField)}
          menuItems={menuItems}
          onPresetChange={(value) => props.onChange(presetField, value)}
          onCustomChange={(value) => props.onChange(customField, value)}
        />
      )}
    </div>
  );
}

function LayoutPropertyPanel({
  texture,
  ...props
}: FieldPanelProps & { texture: GarsonlessTheme["texture"] }) {
  return (
    <div
      data-layout-property-panel
      data-modern-property-panel
      className={panelLayout}
    >
      <PanelFields
        sections={LAYOUT_FIELD_SECTIONS}
        {...props}
        filter={(field) =>
          field.id !== "textureStrength" || texture !== "solid"
        }
      />
    </div>
  );
}

function ThemePropertyPanel({ fields, getValue, onChange }: FieldPanelProps) {
  const fieldMap = new Map(fields.map((field) => [field.id, field]));
  const valueFor = (id: string, fallback: string) =>
    String(fieldMap.get(id) ? getValue(fieldMap.get(id)!) : fallback);
  const contrastPairs = [
    [
      "Ana metin / Sayfa",
      valueFor("textColor", "#1c1d20"),
      valueFor("bg", "#ffffff"),
    ],
    [
      "Ana metin / Kart",
      valueFor("textColor", "#1c1d20"),
      valueFor("cardColor", "#ffffff"),
    ],
    [
      "Buton metni / Buton",
      valueFor("ctaTextColor", "#ffffff"),
      valueFor("cta", "#111111"),
    ],
    ["Vurgu / Sayfa", valueFor("accent", "#111111"), valueFor("bg", "#ffffff")],
  ] as const;
  return (
    <div
      data-theme-property-panel
      data-modern-property-panel
      className={panelLayout}
    >
      {[
        { title: "Renk sistemi", ids: THEME_COLOR_IDS },
        { title: "Tipografi", ids: ["displayFont", "bodyFont", "fs", "lh"] },
      ].map((section) => {
        const sectionFields = section.ids
          .map((id) => fieldMap.get(id))
          .filter((field): field is SettingField => Boolean(field));
        if (!sectionFields.length) return null;
        return (
          <CompactPanelCard key={section.title} title={section.title}>
            <FieldGroup className={panelFieldGroup}>
              {sectionFields.map((field) =>
                field.type === "color" ? (
                  <ThemeColorField
                    key={field.id}
                    field={field}
                    value={String(getValue(field) ?? field.default ?? "")}
                    onChange={(value) => onChange(field, value)}
                  />
                ) : (
                  <HeaderPropertyField
                    key={field.id}
                    field={field}
                    value={getValue(field)}
                    onChange={(value) => onChange(field, value)}
                  />
                ),
              )}
            </FieldGroup>
            {section.title === "Renk sistemi" && fieldMap.get("accentSoft") && (
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  onChange(
                    fieldMap.get("accentSoft")!,
                    deriveSoftColor(valueFor("accent", "#2e7d52")),
                  )
                }
                className="mt-3 w-full"
              >
                Vurgu Soft’u otomatik üret
              </Button>
            )}
          </CompactPanelCard>
        );
      })}
      <CompactPanelCard title="Erişilebilirlik" contentClassName="flex flex-col gap-2">
          {contrastPairs.map(([label, fg, bg]) => {
            const ratio = contrastRatio(fg, bg);
            const pass = ratio >= 4.5;
            return (
              <div key={label} className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{label}</span>
                <Badge variant={pass ? "positive" : "destructive"}>
                  {ratio.toFixed(2)}:1 · {pass ? "Geçer" : "Zayıf"}
                </Badge>
              </div>
            );
          })}
      </CompactPanelCard>
    </div>
  );
}

function CartPropertyPanel({
  fields,
  getValue,
  onChange,
}: FieldPanelProps) {
  return (
    <div
      data-cart-property-panel
      data-modern-property-panel
      className={panelLayout}
    >
      <InfoNote>
        Sepetin yüzeyi Header → Aksiyon Konumları bölümünden seçilir. Burada
        yalnız seçili yüzeyin görünümü düzenlenir.
      </InfoNote>
      <PanelFields sections={CART_FIELD_SECTIONS} fields={fields} getValue={getValue} onChange={onChange} />
    </div>
  );
}

function FooterPropertyPanel({
  fields,
  getValue,
  onChange,
}: FieldPanelProps) {
  return (
    <div
      data-footer-property-panel
      data-modern-property-panel
      className={panelLayout}
    >
      <InfoNote>Adres, iletişim ve sosyal medya bilgileri Ayarlar &gt; Mağaza bölümündeki gerçek işletme verilerinden gelir.</InfoNote>
      <PanelFields sections={FOOTER_FIELD_SECTIONS} fields={fields} getValue={getValue} onChange={onChange} />
    </div>
  );
}

function InfoNote({ children }: { children: string }) {
  return (
    <Alert data-theme-property-note role="note"><AlertDescription>{children}</AlertDescription></Alert>
  );
}

const panelCard = "data-[size=sm]:[--card-spacing:--spacing(2.5)]";
const panelFieldGroup = "gap-2.5";
const panelLayout = "grid min-w-0 max-w-full gap-2.5 overflow-hidden";

export {
  FooterPropertyPanel,
  CardPropertyPanel,
  CartPropertyPanel,
  HeaderPropertyPanel,
  DrawerPropertyPanel,
  LayoutPropertyPanel,
  NavPropertyPanel,
  PropertyFieldEditor,
  PropertySection,
  ThemePropertyPanel,
};
