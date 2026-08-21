"use client";

import { useState, type ReactNode } from "react";
import type { GarsonlessTheme, MenuCartPreviewState, MenuThemeContrastIssue } from "@garsonless/design-engine";
import type { SettingField } from "@garsonless/ui/themes";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FieldDescription, FieldGroup } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ChevronDown } from "lucide-react";

import { deriveSoftColor } from "./theme-property-renderer-model";
import {
  HeaderPropertyField,
  PropertyFieldEditor,
  PropertySection,
  ThemeColorField,
} from "./ThemePropertyControls";
import { MenuFilterPropertyEditor } from "./MenuFilterPropertyEditor";
import { FooterPropertyPanel } from "./FooterPropertyPanel";
import {
  buildLayoutDensityPatch,
  LAYOUT_DENSITY_FIELDS,
  LAYOUT_DENSITY_PRESETS,
  resolveLayoutDensityPreset,
  type LayoutDensityPresetId,
} from "./layout-density-model";
import {
  buildThemeFontPairPatch,
  buildThemeTypeScalePatch,
  resolveThemeFontPairPreset,
  resolveThemeTypeScalePreset,
  THEME_FONT_PAIR_PRESETS,
  THEME_TYPE_SCALE_PRESETS,
  type ThemeFontPairPresetId,
  type ThemeTypeScalePresetId,
} from "./theme-guided-style-model";

const HEADER_FIELD_SECTIONS: Array<{ title: string; ids: string[] }> = [
  {
    title: "Görünüm",
    ids: [
      "headerLogoStyle",
      "headerNameSize",
      "headerLogoSize",
      "headerLogoMaxWidth",
      "headerLogoFit",
      "logoShape",
      "logoBg",
      "logoShadow",
      "logoBorder",
      "headerStyle",
      "headerBg",
      "headerTextColor",
      "headerIconColor",
      "headerRadius",
      "headerShadow",
    ],
  },
  {
    title: "Yerleşim",
    ids: ["headerPreset", "headerAlign", "stickyHeader", "headerHeight"],
  },
  {
    title: "Boşluk ve çizgi",
    ids: ["headerPadY", "headerPadX", "headerBottomGap", "headerBorder"],
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
    ids: ["cardRadius", "cardShadow", "cardBorder", "cardHover", "cardPlaceholderStyle"],
  },
  { title: "Etiketler", ids: ["tagShimmer"] },
  { title: "Aksiyon", ids: ["cardCtaStyle", "cardCtaIcon"] },
  {
    title: "Kart düzeni",
    ids: ["cardLayout", "cardDensity", "cardPriceAlign"],
  },
  {
    title: "Görsel",
    ids: ["cardImagePosition", "cardHorizontalImageWidth"],
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
    ids: ["catnavStyle", "catnavActiveStyle"],
  },
  {
    title: "Yerleşim",
    ids: [
      "catnavDensity",
      "navTopGap",
      "navBottomGap",
      "stickyNav",
    ],
  },
  {
    title: "Davranış ve içerik",
    ids: ["catnavShowCount"],
  },
  {
    title: "Görsel kartlar",
    ids: [
      "catnavVisualStyle",
      "catnavVisualRadius",
    ],
  },
  {
    title: "Fotoğraf overlay",
    ids: [
      "catnavOverlayTextPosition",
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
  { title: "Varsayılan yüzey", ids: ["radius", "shadow", "border"] },
];

const LAYOUT_ADVANCED_SPACING_SECTIONS = [
  { title: "Gelişmiş boşluklar", ids: [...LAYOUT_DENSITY_FIELDS] },
];

const THEME_GUIDED_COLOR_IDS = ["bg", "cardColor", "accent", "cta"];
const THEME_ADVANCED_COLOR_IDS = ["textColor", "mutedTextColor", "ctaTextColor", "accentSoft", "borderColor"];

const CART_FIELD_SECTIONS: Array<{ title: string; ids: string[] }> = [
  {
    title: "Tetikleyici",
    ids: [
      "cartHeaderTriggerStyle",
      "cartFooterTriggerStyle",
      "cartIcon",
      "cartShowBadge",
      "cartPillTone",
      "cartPillPosition",
    ],
  },
  {
    title: "Çekmece özeti",
    ids: ["cartShowSubtotal", "cartShowItemCount"],
  },
  {
    title: "Metinler",
    ids: ["cartButtonText", "cartEmptyText", "cartPrimaryActionText"],
  },
];

type FieldPanelProps = {
  fields: SettingField[];
  getValue: (field: SettingField) => unknown;
  onChange: (field: SettingField, value: unknown) => void;
  onPatch?: (patch: Partial<GarsonlessTheme>) => void;
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
          Minimal düzende görsel ve ayrıntılı ürün bilgileri gizlenir; hızlı ekleme kompakt bir aksiyon olarak korunur.
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
              : field.id === "tagShimmer"
                ? "Kampanya, fırsat ve ürün rozetlerinde parlak ışık geçişini birlikte açar."
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
  fields,
  getValue,
  onChange,
  onPatch,
  ...props
}: FieldPanelProps & { texture: GarsonlessTheme["texture"] }) {
  const fieldById = new Map(fields.map((field) => [field.id, field]));
  const densityValues = Object.fromEntries(
    LAYOUT_DENSITY_FIELDS.map((id) => {
      const field = fieldById.get(id);
      return [id, field ? getValue(field) : undefined];
    }),
  );
  const activeDensity = resolveLayoutDensityPreset(densityValues);
  const applyDensity = (presetId: LayoutDensityPresetId) => {
    const patch = buildLayoutDensityPatch(presetId);
    if (onPatch) {
      onPatch(patch);
      return;
    }
    for (const id of LAYOUT_DENSITY_FIELDS) {
      const field = fieldById.get(id);
      if (field) onChange(field, patch[id]);
    }
  };
  return (
    <div
      data-layout-property-panel
      data-modern-property-panel
      className={panelLayout}
    >
      <CompactPanelCard title="Sayfa yoğunluğu">
        <div className="mb-2 flex items-center justify-between gap-2">
          <FieldDescription>Boşluk ve grid ritmini birlikte ayarlar.</FieldDescription>
          {!activeDensity && <Badge variant="secondary">Özel</Badge>}
        </div>
        <ToggleGroup
          value={activeDensity ? [activeDensity] : []}
          onValueChange={(values) => {
            const next = values[0] as LayoutDensityPresetId | undefined;
            if (next) applyDensity(next);
          }}
          size="sm"
          spacing={1}
          className="grid w-full grid-cols-3"
          aria-label="Sayfa yoğunluğu"
        >
          {LAYOUT_DENSITY_PRESETS.map((preset) => (
            <ToggleGroupItem
              key={preset.id}
              value={preset.id}
              variant="outline"
              className="h-11 min-w-0"
            >
              {preset.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </CompactPanelCard>
      <PanelFields
        sections={LAYOUT_FIELD_SECTIONS}
        {...props}
        fields={fields}
        getValue={getValue}
        onChange={onChange}
        filter={(field) =>
          field.id !== "textureStrength" || texture !== "solid"
        }
        fieldNote={(field) =>
          field.id === "pageMaxWidth"
            ? "Mobilde fark oluşturmaz; etkisini Masaüstü önizlemede görebilirsiniz."
            : field.id === "radius"
              ? "Header ve Kartlar bölümlerindeki özel yüzey ayarları bu varsayılanın önüne geçer."
              : null
        }
      />
      <Collapsible>
        <CollapsibleTrigger
          render={<Button type="button" variant="outline" className="group h-11 w-full justify-between" />}
        >
          Gelişmiş boşluklar
          <ChevronDown className="transition-transform group-data-panel-open:rotate-180" aria-hidden="true" />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2.5">
          <PanelFields
            sections={LAYOUT_ADVANCED_SPACING_SECTIONS}
            fields={fields}
            getValue={getValue}
            onChange={onChange}
          />
          <Alert role="note" className="mt-2.5"><AlertDescription>
            Dikey kart sütunları kullanılabilir genişliğe göre otomatik belirlenir. Yatay ve minimal kartlar tek, tam genişlikli satır kullanır.
          </AlertDescription></Alert>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function ThemePropertyPanel({ fields, getValue, onChange, onPatch, theme, contrastIssues, onContrastRepair }: FieldPanelProps & {
  theme: GarsonlessTheme; contrastIssues: MenuThemeContrastIssue[]; onContrastRepair: () => void;
}) {
  const [status, setStatus] = useState("");
  const fieldMap = new Map(fields.map((field) => [field.id, field]));
  const valueFor = (id: string, fallback: string) => String(fieldMap.get(id) ? getValue(fieldMap.get(id)!) : fallback);
  const issueLabelsFor = (fieldId: string) => contrastIssues.filter((issue) => issue.fields.includes(fieldId as never))
    .map((issue) => `${issue.label}: ${issue.ratio}:1 / en az ${issue.minimum}:1`);
  const renderColorField = (id: string) => {
    const field = fieldMap.get(id);
    if (!field) return null;
    return <ThemeColorField key={field.id} field={field} value={String(getValue(field) ?? field.default ?? "")}
      issueLabels={issueLabelsFor(field.id)} onChange={(value) => onChange(field, value)} />;
  };
  const fontPairPreset = resolveThemeFontPairPreset(theme);
  const typeScalePreset = resolveThemeTypeScalePreset(theme);
  const changeFontPair = (values: string[]) => {
    const next = values[0] as ThemeFontPairPresetId | undefined;
    if (!next || next === "custom" || !onPatch) return;
    onPatch(buildThemeFontPairPatch(next));
    setStatus(`${THEME_FONT_PAIR_PRESETS.find((preset) => preset.id === next)?.label} font eşleşmesi uygulandı.`);
  };
  const changeTypeScale = (values: string[]) => {
    const next = values[0] as ThemeTypeScalePresetId | undefined;
    if (!next || next === "custom" || !onPatch) return;
    onPatch(buildThemeTypeScalePatch(next));
    setStatus(`${THEME_TYPE_SCALE_PRESETS.find((preset) => preset.id === next)?.label} yazı ölçeği uygulandı.`);
  };
  const legacyAwareFontField = (id: "displayFont" | "bodyFont") => {
    const field = fieldMap.get(id);
    if (!field) return null;
    const value = String(getValue(field) ?? field.default ?? "");
    const options = field.options ?? [];
    const normalized = options.some((option) => String(option.value) === value)
      ? field
      : { ...field, options: [...options, { value, label: `${value} · Özel/eski font` }] };
    return <HeaderPropertyField key={id} field={normalized} value={value} onChange={(next) => onChange(field, next)} />;
  };
  return (
    <div data-theme-property-panel data-modern-property-panel className={panelLayout}>
      {contrastIssues.length > 0 ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            <strong>{contrastIssues.length} kontrast sorunu bulundu.</strong>
            <ul aria-label="Tema kontrast sorunları" className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs">
              {contrastIssues.map((issue) => <li key={issue.id}>{issue.label}: {issue.ratio}:1 / en az {issue.minimum}:1</li>)}
            </ul>
            <Button type="button" variant="outline" size="sm" className="mt-2 min-h-11 w-full"
              onClick={() => {
                onContrastRepair();
                setStatus("Tema paleti güvenli kontrast değerlerine getirildi.");
              }}
            >Paleti güvenli hale getir</Button>
          </AlertDescription>
        </Alert>
      ) : (
        <Alert role="status"><AlertDescription>Tema paleti kritik kontrast kontrollerini geçiyor.</AlertDescription></Alert>
      )}

      <CompactPanelCard title="Rehberli renkler">
        <FieldDescription className="mb-3">
          Header ve kartların özel renkleri varsa bu varsayılanların önüne geçer.
        </FieldDescription>
        <FieldGroup className={panelFieldGroup}>{THEME_GUIDED_COLOR_IDS.map(renderColorField)}</FieldGroup>
      </CompactPanelCard>

      <Collapsible>
        <CollapsibleTrigger render={<Button type="button" variant="outline" className="group h-11 w-full justify-between" />}>
          Gelişmiş renkler
          <ChevronDown className="transition-transform group-data-panel-open:rotate-180" aria-hidden="true" />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2.5">
          <CompactPanelCard title="Semantik renk rolleri">
            <FieldGroup className={panelFieldGroup}>{THEME_ADVANCED_COLOR_IDS.map(renderColorField)}</FieldGroup>
            {fieldMap.get("accentSoft") ? (
              <Button type="button" variant="outline"
                onClick={() => onChange(fieldMap.get("accentSoft")!, deriveSoftColor(valueFor("accent", "#2e7d52")))}
                className="mt-3 min-h-11 w-full"
              >Hafif marka yüzeyini otomatik üret</Button>
            ) : null}
          </CompactPanelCard>
        </CollapsibleContent>
      </Collapsible>

      <CompactPanelCard title="Font eşleşmesi">
        <ToggleGroup value={[fontPairPreset]} onValueChange={changeFontPair} spacing={1} className="grid grid-cols-2" aria-label="Font eşleşmesi">
          {THEME_FONT_PAIR_PRESETS.map((preset) => (
            <ToggleGroupItem key={preset.id} value={preset.id} variant="outline" className="h-auto min-h-16 min-w-0 flex-col items-start gap-0.5 px-3 py-2 text-left">
              <strong style={{ fontFamily: `"${preset.displayFont}", serif` }}>{preset.label}</strong>
              <span className="text-[11px] text-muted-foreground" style={{ fontFamily: `"${preset.bodyFont}", sans-serif` }}>Başlık / Menü metni</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {fontPairPreset === "custom" ? <Badge variant="outline" className="mt-2">Özel font eşleşmesi</Badge> : null}
      </CompactPanelCard>

      <CompactPanelCard title="Yazı ölçeği">
        <ToggleGroup value={[typeScalePreset]} onValueChange={changeTypeScale} spacing={1} className="grid grid-cols-3" aria-label="Yazı ölçeği">
          {THEME_TYPE_SCALE_PRESETS.map((preset) => (
            <ToggleGroupItem key={preset.id} value={preset.id} variant="outline" className="h-14 min-w-0 flex-col gap-0 px-1">
              <strong>{preset.label}</strong><span className="text-[10px] text-muted-foreground">{preset.fs}px · %{preset.lh}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {typeScalePreset === "custom" ? <Badge variant="outline" className="mt-2">Özel yazı ölçeği</Badge> : null}
      </CompactPanelCard>

      <Collapsible>
        <CollapsibleTrigger render={<Button type="button" variant="outline" className="group h-11 w-full justify-between" />}>
          Gelişmiş tipografi
          <ChevronDown className="transition-transform group-data-panel-open:rotate-180" aria-hidden="true" />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2.5">
          <CompactPanelCard title="Tekil tipografi ayarları">
            <FieldGroup className={panelFieldGroup}>
              {legacyAwareFontField("displayFont")}
              {legacyAwareFontField("bodyFont")}
              {["fs", "lh"].map((id) => {
                const field = fieldMap.get(id);
                return field ? <HeaderPropertyField key={id} field={field} value={getValue(field)} onChange={(value) => onChange(field, value)} /> : null;
              })}
            </FieldGroup>
          </CompactPanelCard>
        </CollapsibleContent>
      </Collapsible>
      <div role="status" aria-live="polite" className="sr-only">{status}</div>
    </div>
  );
}

function CartPropertyPanel({
  fields,
  getValue,
  onChange,
  previewState,
  onPreviewStateChange,
}: FieldPanelProps & { previewState: MenuCartPreviewState; onPreviewStateChange: (state: MenuCartPreviewState) => void }) {
  return (
    <div
      data-cart-property-panel
      data-modern-property-panel
      className={panelLayout}
    >
      <InfoNote>
        Sepetin erişim konumu Header → Aksiyon Konumları bölümünden seçilir.
        Çekmecenin yüzeyi, boyutu ve köşeleri yalnız Checkout panelinden yönetilir.
      </InfoNote>
      <CompactPanelCard title="Önizleme durumu">
        <ToggleGroup
          value={[previewState]}
          onValueChange={(values) => values[0] && onPreviewStateChange(values[0] as MenuCartPreviewState)}
          className="grid w-full grid-cols-3"
          aria-label="Sepet önizleme durumu"
        >
          <ToggleGroupItem value="trigger" variant="outline" className="min-h-11">Tetikleyici</ToggleGroupItem>
          <ToggleGroupItem value="filled" variant="outline" className="min-h-11">Dolu sepet</ToggleGroupItem>
          <ToggleGroupItem value="empty" variant="outline" className="min-h-11">Boş sepet</ToggleGroupItem>
        </ToggleGroup>
        <FieldDescription>Örnek ürün yalnız editörde görünür; müşteri sepetine yazılmaz.</FieldDescription>
      </CompactPanelCard>
      <PanelFields sections={CART_FIELD_SECTIONS} fields={fields} getValue={getValue} onChange={onChange} />
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
