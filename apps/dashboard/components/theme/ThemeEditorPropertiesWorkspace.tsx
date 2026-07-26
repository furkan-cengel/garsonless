"use client";

import { useMemo, type ReactNode } from "react";
import {
  getSectionDefinitionId,
  getSectionVisibility,
  type GarsonlessTheme,
  type ThemePageBlock,
  type ThemeSectionVisibility,
  type ThemeSectionVisibilityMode,
} from "@garsonless/design-engine";
import {
  deriveActivePromoSliderCampaigns,
  type MenuItem,
  type SettingField,
  type SettingsGroup,
} from "@garsonless/ui";
import { ThemeEditorControlIcon } from "./CardLayoutOptionIcon";
import { ThemePropertiesFrame } from "./ThemePropertiesFrame";
import {
  AnnouncementPropertyPanel,
  CardPropertyPanel,
  CartPropertyPanel,
  DrawerPropertyPanel,
  HeaderPropertyPanel,
  LayoutPropertyPanel,
  NavPropertyPanel,
  PropertyFieldEditor,
  PropertySection,
  ThemePropertyPanel,
} from "./ThemePropertyPanels";
import { THEME_PROPERTY_CONTROL_CSS } from "./ThemePropertyControls";
import { SectionSettingsEditor } from "./ThemeSectionSettings";
import {
  EDITOR_TABS,
  THEME_EDITOR_THEME_GROUP_ID,
  type EditorTab,
  type SectionSettingField,
} from "./theme-editor-properties-model";

interface ThemeEditorPropertiesWorkspaceProps {
  width: number;
  activeGroup: string;
  activeGroupData?: SettingsGroup;
  selectedSection?: { label: string; sub: string } | null;
  selectedSectionId: string | null;
  selectedSectionBlock: ThemePageBlock | null;
  selectedSectionSettings: Record<string, string>;
  visibleEditorTabs: Array<{ id: EditorTab; label: string }>;
  effectiveEditorTab: EditorTab;
  visibleFields: SettingField[];
  visibleSectionFields: SectionSettingField[];
  mergedTheme: GarsonlessTheme;
  overrides: Partial<GarsonlessTheme>;
  defaults: GarsonlessTheme;
  schema: SettingsGroup[];
  menuCategories: Array<{ id: string; name: string; parentId?: string | null }>;
  menuItems: Array<{
    id: string;
    name: string;
    categoryId: string;
    categoryName: string;
    price?: number;
    images?: unknown;
    isAvailable?: boolean;
  }>;
  menuHref: string;
  logoCard?: ReactNode;
  sectionMediaPanel?: ReactNode;
  onTabChange: (tab: EditorTab) => void;
  onReset: () => void;
  onCopy: () => void;
  onFieldChange: (field: SettingField, value: unknown) => void;
  onSectionSettingChange: (key: string, value: string) => void;
  onSectionVisibilityChange: (visibility: ThemeSectionVisibility) => void;
  onSectionPlacementChange: (placement: 'page' | 'drawer') => void;
}

export function ThemeEditorPropertiesWorkspace({
  width,
  activeGroup,
  activeGroupData,
  selectedSection,
  selectedSectionId,
  selectedSectionBlock,
  selectedSectionSettings,
  visibleEditorTabs,
  effectiveEditorTab,
  visibleFields,
  visibleSectionFields,
  mergedTheme,
  overrides,
  defaults,
  schema,
  menuCategories,
  menuItems,
  menuHref,
  logoCard,
  sectionMediaPanel,
  onTabChange,
  onReset,
  onCopy,
  onFieldChange,
  onSectionSettingChange,
  onSectionVisibilityChange,
  onSectionPlacementChange,
}: ThemeEditorPropertiesWorkspaceProps) {
  const selectedSectionDefinitionId = selectedSectionBlock
    ? getSectionDefinitionId(selectedSectionBlock)
    : null;
  const selectedSectionIsGlobal = selectedSectionDefinitionId === "request-buttons";
  const getValue = (field: SettingField) =>
    overrides[field.themeField] ?? defaults[field.themeField];
  const campaignOptions = useMemo(() => {
    const campaignItems: MenuItem[] = menuItems.map((item, index) => ({
      id: item.id,
      category_id: item.categoryId,
      name: item.name,
      description: null,
      price: Number(item.price ?? 0),
      images: Array.isArray(item.images)
        ? item.images.filter((image): image is string => typeof image === "string")
        : [],
      ingredients: [],
      energy_kcal: null,
      contains_allergens: [],
      may_contain_allergens: [],
      allergen_note: null,
      cross_contact_note: null,
      contains_alcohol: false,
      contains_pork: false,
      is_vegetarian: false,
      is_vegan: false,
      is_halal: false,
      food_info_reviewed_at: null,
      modifier_groups: [],
      is_available: item.isAvailable !== false,
      position: index,
    }));
    const pageBlocks = mergedTheme.pageBlocks?.length
      ? mergedTheme.pageBlocks
      : (mergedTheme.sections ?? []).map((id) => ({ type: "section" as const, id }));
    return deriveActivePromoSliderCampaigns({
      pageBlocks,
      sectionSettings: mergedTheme.sectionSettings ?? {},
      items: campaignItems,
    });
  }, [menuItems, mergedTheme.pageBlocks, mergedTheme.sectionSettings, mergedTheme.sections]);

  return (
    <>
      <style>{THEME_PROPERTY_CONTROL_CSS}</style>
      <ThemePropertiesFrame
        width={width}
        title={selectedSection?.label ?? activeGroupData?.label ?? "Sayfa"}
        subtitle={selectedSection?.sub ?? getGroupHint(activeGroupData?.id)}
        tabs={visibleEditorTabs}
        activeTab={effectiveEditorTab}
        onTabChange={onTabChange}
        propertyCount={
          selectedSection ? visibleSectionFields.length : visibleFields.length
        }
        onReset={onReset}
        headerActions={
          <>
            <IconButton title="Ayarları kopyala" onClick={onCopy}>
              <ThemeEditorControlIcon name="copy" size={18} />
            </IconButton>
            <IconButton title="Varsayılana sıfırla" onClick={onReset}>
              <ThemeEditorControlIcon name="history" size={18} />
            </IconButton>
          </>
        }
      >
        {selectedSection && selectedSectionId ? (
          <>
            <PropertySection title="Bölüm İçeriği" defaultOpen>
              {sectionMediaPanel}
              {visibleSectionFields.length > 0 ? (
                <SectionSettingsEditor
                  fields={visibleSectionFields}
                  values={selectedSectionSettings}
                  menuCategories={menuCategories}
                  menuItems={menuItems}
                  campaignOptions={campaignOptions}
                  menuHref={menuHref}
                  onChange={onSectionSettingChange}
                />
              ) : (
                <EmptySettingsMessage
                  label={selectedSection.label}
                  tab={effectiveEditorTab}
                />
              )}
            </PropertySection>
            <PropertySection title="Bölüm Davranışı" defaultOpen={false}>
              {selectedSectionBlock && !selectedSectionIsGlobal ? (
                <div style={{ marginBottom: 12 }}>
                  <div style={fieldLabelStyle}>Konum</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                    {([['page', 'Sayfa'], ['drawer', 'Menü Drawer']] as const).map(([placement, label]) => {
                      const active = (selectedSectionBlock.placement ?? 'page') === placement;
                      return (
                        <button
                          key={placement}
                          type="button"
                          aria-pressed={active}
                          onClick={() => onSectionPlacementChange(placement)}
                          style={{
                            minHeight: 38,
                            borderRadius: 9,
                            border: `1px solid ${active ? "var(--text)" : "var(--border)"}`,
                            background: active ? "var(--surface-inset)" : "var(--surface)",
                            color: "var(--text)",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >{label}</button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              {selectedSectionBlock && !selectedSectionIsGlobal && selectedSectionBlock.placement !== "drawer" ? (
                <SectionVisibilityEditor
                  block={selectedSectionBlock}
                  categories={menuCategories}
                  onChange={onSectionVisibilityChange}
                />
              ) : null}
              <div style={{ ...messageStyle, marginTop: 10 }}>
                {selectedSectionIsGlobal
                  ? "Bu araç kategori bağımsızdır. Konumu Header → Aksiyon Konumları bölümünden; istek türleri ve metinleri yukarıdaki ayarlardan yönetilir."
                  : "Bölüm sırasını sol panelden değiştirebilirsin. Görünürlük seçimi ve sıra önizlemeye anında yansır."}
              </div>
            </PropertySection>
          </>
        ) : (
          <>
            <PropertySection
              title={activeGroupData?.label ?? "Ayarlar"}
              defaultOpen
            >
              {logoCard}
              {activeGroup.startsWith("header") && visibleFields.length > 0 ? (
                <HeaderPropertyPanel
                  fields={visibleFields}
                  getValue={getValue}
                  onChange={onFieldChange}
                />
              ) : activeGroup === "drawer" && visibleFields.length > 0 ? (
                <DrawerPropertyPanel
                  fields={visibleFields}
                  getValue={getValue}
                  onChange={onFieldChange}
                />
              ) : activeGroup === "cards" && visibleFields.length > 0 ? (
                <CardPropertyPanel
                  fields={visibleFields}
                  layout={mergedTheme.cardLayout}
                  getValue={getValue}
                  onChange={onFieldChange}
                />
              ) : activeGroup === "nav" && visibleFields.length > 0 ? (
                <NavPropertyPanel
                  fields={visibleFields}
                  visual={mergedTheme.catnavStyle === "visual"}
                  getValue={getValue}
                  onChange={onFieldChange}
                />
              ) : activeGroup === "layout" && visibleFields.length > 0 ? (
                <LayoutPropertyPanel
                  fields={visibleFields}
                  texture={mergedTheme.texture}
                  getValue={getValue}
                  onChange={onFieldChange}
                />
              ) : activeGroup === THEME_EDITOR_THEME_GROUP_ID &&
                visibleFields.length > 0 ? (
                <ThemePropertyPanel
                  fields={visibleFields}
                  getValue={getValue}
                  onChange={onFieldChange}
                />
              ) : activeGroup === "cart" && visibleFields.length > 0 ? (
                <CartPropertyPanel
                  fields={visibleFields}
                  getValue={getValue}
                  onChange={onFieldChange}
                />
              ) : activeGroup === "announcement" && visibleFields.length > 0 ? (
                <AnnouncementPropertyPanel
                  fields={visibleFields}
                  getValue={getValue}
                  onChange={onFieldChange}
                />
              ) : visibleFields.length > 0 ? (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
                >
                  {visibleFields.map((field) => (
                    <PropertyFieldEditor
                      key={field.id}
                      field={field}
                      value={getValue(field)}
                      onChange={(value) => onFieldChange(field, value)}
                    />
                  ))}
                </div>
              ) : (
                <EmptySettingsMessage
                  label={activeGroupData?.label ?? "Bu bölüm"}
                  tab={effectiveEditorTab}
                />
              )}
            </PropertySection>
            {effectiveEditorTab === "design" &&
              activeGroup !== THEME_EDITOR_THEME_GROUP_ID &&
              activeGroup !== "announcement" && (
                <PropertySection title="Marka rengi" defaultOpen={false}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    {["accent", "cta"].map((key) => {
                      const field = schema
                        .flatMap((group) => group.fields)
                        .find((candidate) => candidate.themeField === key);
                      if (!field) return null;
                      return (
                        <PropertyFieldEditor
                          key={field.id}
                          field={field}
                          value={getValue(field)}
                          onChange={(value) => onFieldChange(field, value)}
                        />
                      );
                    })}
                  </div>
                </PropertySection>
              )}
          </>
        )}
      </ThemePropertiesFrame>
    </>
  );
}

function EmptySettingsMessage({
  label,
  tab,
}: {
  label: string;
  tab: EditorTab;
}) {
  return (
    <div style={messageStyle}>
      {label} için{" "}
      {EDITOR_TABS.find(
        (candidate) => candidate.id === tab,
      )?.label.toLowerCase()}{" "}
      sekmesinde ayar yok.
    </div>
  );
}

function SectionVisibilityEditor({
  block,
  categories,
  onChange,
}: {
  block: ThemePageBlock;
  categories: Array<{ id: string; name: string; parentId?: string | null }>;
  onChange: (visibility: ThemeSectionVisibility) => void;
}) {
  const visibility = getSectionVisibility(block);
  const selectedIds = new Set(visibility.categoryIds ?? []);
  const categoryIds = new Set(categories.map((category) => category.id));
  const roots = categories.filter(
    (category) => !category.parentId || !categoryIds.has(category.parentId),
  );
  const childrenByParent = new Map<string, typeof categories>();

  for (const category of categories) {
    if (!category.parentId) continue;
    const siblings = childrenByParent.get(category.parentId) ?? [];
    siblings.push(category);
    childrenByParent.set(category.parentId, siblings);
  }

  const updateMode = (mode: ThemeSectionVisibilityMode) => {
    onChange({
      mode,
      ...(mode === "categories"
        ? {
            categoryIds: visibility.categoryIds ?? [],
            includeChildren: visibility.includeChildren ?? true,
          }
        : {}),
    });
  };

  const toggleCategory = (categoryId: string) => {
    const next = new Set(selectedIds);
    if (next.has(categoryId)) next.delete(categoryId);
    else next.add(categoryId);
    onChange({
      mode: "categories",
      categoryIds: Array.from(next),
      includeChildren: visibility.includeChildren ?? true,
    });
  };

  const setSelectedCategories = (categoryIds: string[]) => {
    onChange({
      mode: "categories",
      categoryIds,
      includeChildren: visibility.includeChildren ?? true,
    });
  };

  const renderCategoryRows = (
    category: (typeof categories)[number],
    depth = 0,
    ancestry = new Set<string>(),
  ): ReactNode => {
    if (ancestry.has(category.id)) return null;
    const nextAncestry = new Set(ancestry);
    nextAncestry.add(category.id);
    return (
      <div key={category.id}>
        <CategoryVisibilityRow
          category={category}
          checked={selectedIds.has(category.id)}
          onToggle={toggleCategory}
          depth={depth}
        />
        {(childrenByParent.get(category.id) ?? []).map((child) =>
          renderCategoryRows(child, depth + 1, nextAncestry),
        )}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <div style={fieldLabelStyle}>Nerede gösterilsin?</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 7 }}>
          {([
            ["all", "Tüm menü", "Ana ekran ve bütün kategori görünümleri"],
            ["home", "Ana kategori ekranı", "Yalnız kategori seçilmeden önce"],
            ["categories", "Seçili kategoriler", "Belirlediğin kategori sayfalarında"],
          ] as const).map(([mode, label, description]) => {
            const active = visibility.mode === mode;
            return (
              <button
                key={mode}
                type="button"
                aria-pressed={active}
                onClick={() => updateMode(mode)}
                style={{
                  width: "100%",
                  minHeight: 50,
                  padding: "9px 11px",
                  borderRadius: 9,
                  border: `1px solid ${active ? "var(--text)" : "var(--border)"}`,
                  background: active ? "var(--surface-inset)" : "var(--surface)",
                  color: "var(--text)",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <span style={{ display: "block", fontSize: 12.5, fontWeight: 750 }}>{label}</span>
                <span style={{ display: "block", marginTop: 2, color: "var(--text-3)", fontSize: 11, lineHeight: 1.35 }}>
                  {description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {visibility.mode === "categories" ? (
        <div style={{ padding: 10, border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface-2)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 750, color: "var(--text)" }}>Kategoriler</span>
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <button
                type="button"
                onClick={() => setSelectedCategories(categories.map((category) => category.id))}
                style={visibilityUtilityButtonStyle}
              >
                Tümü
              </button>
              <button
                type="button"
                disabled={selectedIds.size === 0}
                onClick={() => setSelectedCategories([])}
                style={{
                  ...visibilityUtilityButtonStyle,
                  opacity: selectedIds.size === 0 ? 0.45 : 1,
                  cursor: selectedIds.size === 0 ? "default" : "pointer",
                }}
              >
                Temizle
              </button>
              <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>{selectedIds.size} seçili</span>
            </span>
          </div>
          {selectedIds.size === 0 ? (
            <div
              role="status"
              style={{
                marginBottom: 8,
                padding: "8px 9px",
                borderRadius: 8,
                background: "color-mix(in srgb, #f59e0b 11%, var(--surface))",
                color: "#9a5b05",
                fontSize: 10.5,
                lineHeight: 1.4,
              }}
            >
              En az bir kategori seçilene kadar bu bölüm menüde görünmez.
            </div>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 230, overflow: "auto" }}>
            {roots.map((root) => renderCategoryRows(root))}
          </div>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--divider)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={visibility.includeChildren ?? true}
              onChange={(event) => onChange({
                mode: "categories",
                categoryIds: visibility.categoryIds ?? [],
                includeChildren: event.target.checked,
              })}
              style={{ marginTop: 1 }}
            />
            <span>
              <span style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "var(--text)" }}>Alt kategorilere de uygula</span>
              <span style={{ display: "block", marginTop: 2, fontSize: 10.5, lineHeight: 1.35, color: "var(--text-3)" }}>
                Üst kategori seçiliyse alt kategori ekranlarında da görünür.
              </span>
            </span>
          </label>
        </div>
      ) : null}
    </div>
  );
}

const visibilityUtilityButtonStyle: React.CSSProperties = {
  padding: 0,
  border: 0,
  background: "transparent",
  color: "var(--text-2)",
  fontSize: 10.5,
  fontWeight: 700,
  cursor: "pointer",
};

function CategoryVisibilityRow({
  category,
  checked,
  onToggle,
  depth = 0,
}: {
  category: { id: string; name: string };
  checked: boolean;
  onToggle: (id: string) => void;
  depth?: number;
}) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 30, padding: `4px 7px 4px ${7 + Math.min(depth, 4) * 17}px`, borderRadius: 7, color: "var(--text-2)", cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={() => onToggle(category.id)} />
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11.5, fontWeight: depth > 0 ? 550 : 700 }}>
        {category.name}
      </span>
    </label>
  );
}

function getGroupHint(id?: string) {
  if (!id) return "Tüm sayfalara uygulanır";
  if (id === THEME_EDITOR_THEME_GROUP_ID) return "Renkler ve yazı sistemi";
  if (id.includes("surface")) return "Tüm sayfalara uygulanır";
  if (id.includes("topbar")) return "Sayfa üstündeki marka alanı";
  if (id.includes("welcome")) return "Karşılama bloğu";
  if (id.includes("menu")) return "Kategori ve menü kartları";
  if (id.includes("dish")) return "Tüm ürünlere uygulanır";
  if (id.includes("payment")) return "Sepet ve ödeme akışı";
  return "Bu tema bölümüne uygulanır";
}

function IconButton({
  children,
  title,
  onClick,
}: {
  children: ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      style={{
        width: 26,
        height: 26,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 6,
        color: "var(--text-3)",
        border: "none",
        background: "transparent",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

const messageStyle: React.CSSProperties = {
  padding: "12px",
  borderRadius: 8,
  background: "var(--surface-3)",
  color: "var(--text-3)",
  fontSize: 12.5,
  lineHeight: 1.45,
};

const fieldLabelStyle: React.CSSProperties = {
  marginBottom: 7,
  color: "var(--text-2)",
  fontSize: 12,
  fontWeight: 650,
};
