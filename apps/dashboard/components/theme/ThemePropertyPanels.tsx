"use client";

import type { GarsonlessTheme } from "@garsonless/design-engine";
import type { SettingField } from "@garsonless/ui";

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

const panelStyle = {
  padding: 14,
  minWidth: 0,
  maxWidth: "100%",
  boxSizing: "border-box" as const,
  border: "1px solid var(--border)",
  borderRadius: 12,
  background: "var(--surface)",
  boxShadow: "0 1px 2px rgba(20,25,31,.03)",
};

type FieldPanelProps = {
  fields: SettingField[];
  getValue: (field: SettingField) => unknown;
  onChange: (field: SettingField, value: unknown) => void;
};

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
      <div key={section.title} style={panelStyle}>
        <div
          style={{
            marginBottom: 12,
            fontSize: 13,
            fontWeight: 750,
            color: "var(--text)",
          }}
        >
          {section.title}
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          {sectionFields.map((field) => (
            <div key={field.id}>
              <HeaderPropertyField
                field={field}
                value={getValue(field)}
                onChange={(value) => onChange(field, value)}
              />
              {fieldNote?.(field) && (
                <div
                  style={{
                    marginTop: 5,
                    fontSize: 10.5,
                    color: "var(--text-3)",
                  }}
                >
                  {fieldNote(field)}
                </div>
              )}
            </div>
          ))}
        </div>
        {section.title === "Ürün grid’i" && (
          <div
            role="note"
            style={{
              marginTop: 10,
              fontSize: 10.5,
              lineHeight: 1.45,
              color: "var(--text-3)",
            }}
          >
            Sütun sayısı ve kart yapısı Kartlar → Düzen bölümünden yönetilir.
            Mobilde en fazla iki sütun gösterilir.
          </div>
        )}
      </div>
    );
  });
}

function HeaderPropertyPanel(props: FieldPanelProps) {
  return (
    <div
      data-header-property-panel
      data-modern-property-panel
      style={panelLayout}
    >
      <PanelFields sections={HEADER_FIELD_SECTIONS} {...props} />
    </div>
  );
}

function DrawerPropertyPanel(props: FieldPanelProps) {
  return (
    <div data-drawer-property-panel data-modern-property-panel style={panelLayout}>
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
      style={panelLayout}
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
  ...props
}: FieldPanelProps & { visual: boolean }) {
  return (
    <div data-nav-property-panel data-modern-property-panel style={panelLayout}>
      {visual && (
        <InfoNote>
          Görselli navigasyon kategori kartlarıyla çalışır; sticky ve aktif
          öğeyi ortalama ayarları yalnız yatay metin navigasyonunda kullanılır.
        </InfoNote>
      )}
      <PanelFields sections={NAV_FIELD_SECTIONS} {...props} />
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
      style={panelLayout}
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
      style={panelLayout}
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
          <div key={section.title} style={panelStyle}>
            <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 750 }}>
              {section.title}
            </div>
            <div style={{ display: "grid", gap: 12 }}>
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
            </div>
            {section.title === "Renk sistemi" && fieldMap.get("accentSoft") && (
              <button
                type="button"
                onClick={() =>
                  onChange(
                    fieldMap.get("accentSoft")!,
                    deriveSoftColor(valueFor("accent", "#2e7d52")),
                  )
                }
                style={softColorButtonStyle}
              >
                Vurgu Soft’u otomatik üret
              </button>
            )}
          </div>
        );
      })}
      <div style={panelStyle}>
        <div style={{ marginBottom: 10, fontSize: 13, fontWeight: 750 }}>
          Erişilebilirlik
        </div>
        <div style={{ display: "grid", gap: 7 }}>
          {contrastPairs.map(([label, fg, bg]) => {
            const ratio = contrastRatio(fg, bg);
            const pass = ratio >= 4.5;
            return (
              <div
                key={label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  fontSize: 11.5,
                  color: "var(--text-2)",
                }}
              >
                <span>{label}</span>
                <strong style={{ color: pass ? "#18794e" : "#b42318" }}>
                  {ratio.toFixed(2)}:1 · {pass ? "Geçer" : "Zayıf"}
                </strong>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CartPropertyPanel({
  fields,
  getValue,
  onChange,
}: FieldPanelProps) {
  const fieldById = new Map(fields.map((field) => [field.id, field]));
  return (
    <div
      data-cart-property-panel
      data-modern-property-panel
      style={panelLayout}
    >
      <InfoNote>
        Sepetin yüzeyi Header → Aksiyon Konumları bölümünden seçilir. Burada
        yalnız seçili yüzeyin görünümü düzenlenir.
      </InfoNote>
      {CART_FIELD_SECTIONS.map((section) => {
        const sectionFields = section.ids
          .map((id) => fieldById.get(id))
          .filter((field): field is SettingField => Boolean(field));
        if (!sectionFields.length) return null;
        return (
          <div key={section.title} style={panelStyle}>
            <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 750 }}>
              {section.title}
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              {sectionFields.map((field) => (
                <HeaderPropertyField
                  key={field.id}
                  field={field}
                  value={getValue(field)}
                  onChange={(value) => onChange(field, value)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FooterPropertyPanel({
  fields,
  getValue,
  onChange,
}: FieldPanelProps) {
  const fieldById = new Map(fields.map((field) => [field.id, field]));
  return (
    <div
      data-footer-property-panel
      data-modern-property-panel
      style={panelLayout}
    >
      <InfoNote>Adres, iletişim ve sosyal medya bilgileri Ayarlar &gt; Mağaza bölümündeki gerçek işletme verilerinden gelir.</InfoNote>
      {FOOTER_FIELD_SECTIONS.map((section) => {
        const sectionFields = section.ids
          .map((id) => fieldById.get(id))
          .filter((field): field is SettingField => Boolean(field));
        if (!sectionFields.length) return null;
        return (
          <div key={section.title} style={panelStyle}>
            <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 750 }}>
              {section.title}
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              {sectionFields.map((field) => (
                <HeaderPropertyField
                  key={field.id}
                  field={field}
                  value={getValue(field)}
                  onChange={(value) => onChange(field, value)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InfoNote({ children }: { children: string }) {
  return (
    <div
      role="note"
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        background: "#f3f4f6",
        color: "#4b4f58",
        fontSize: 11.5,
        lineHeight: 1.45,
      }}
    >
      {children}
    </div>
  );
}

const panelLayout = {
  display: "grid",
  gap: 14,
  minWidth: 0,
  maxWidth: "100%",
  overflow: "hidden",
};
const softColorButtonStyle = {
  marginTop: 12,
  width: "100%",
  height: 34,
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "#fff",
  color: "#111318",
  cursor: "pointer",
  fontSize: 11.5,
  fontWeight: 700,
};

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
