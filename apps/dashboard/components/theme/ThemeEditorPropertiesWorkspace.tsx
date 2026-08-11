"use client";

import { useId, useMemo, type ReactNode } from "react";
import {
  getSectionDefinitionId,
  getSectionVisibility,
  type GarsonlessTheme,
  type ThemePageBlock,
  type ThemeSectionVisibility,
  type ThemeSectionVisibilityMode,
} from "@garsonless/design-engine";
import {
  type SettingField,
  type SettingsGroup,
} from "@garsonless/ui/themes";
import { deriveActivePromoSliderCampaigns } from "@garsonless/ui/themes/default";
import type { MenuItem } from "@garsonless/ui/menu";
import { ThemeEditorControlIcon } from "./CardLayoutOptionIcon";
import { ThemePropertiesFrame } from "./ThemePropertiesFrame";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet, FieldTitle } from "@/components/ui/field";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  FooterPropertyPanel,
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
                <Field className="mb-3">
                  <FieldTitle id="section-placement-label">Konum</FieldTitle>
                  <ToggleGroup value={[selectedSectionBlock.placement ?? 'page']} onValueChange={(value) => value[0] && onSectionPlacementChange(value[0] as 'page' | 'drawer')} className="grid w-full grid-cols-2" aria-labelledby="section-placement-label">
                    {([['page', 'Sayfa'], ['drawer', 'Menü Drawer']] as const).map(([placement, label]) => {
                      return (
                        <ToggleGroupItem
                          key={placement}
                          value={placement}
                          variant="outline"
                          className="min-h-9 min-w-0"
                        >{label}</ToggleGroupItem>
                      );
                    })}
                  </ToggleGroup>
                </Field>
              ) : null}
              {selectedSectionBlock && !selectedSectionIsGlobal && selectedSectionBlock.placement !== "drawer" ? (
                <SectionVisibilityEditor
                  block={selectedSectionBlock}
                  categories={menuCategories}
                  onChange={onSectionVisibilityChange}
                />
              ) : null}
              <Alert role="note" className="mt-2.5">
                <AlertDescription>{selectedSectionIsGlobal
                  ? "Bu araç kategori bağımsızdır. Konumu Header → Aksiyon Konumları bölümünden; istek türleri ve metinleri yukarıdaki ayarlardan yönetilir."
                  : "Bölüm sırasını sol panelden değiştirebilirsin. Görünürlük seçimi ve sıra önizlemeye anında yansır."}</AlertDescription>
              </Alert>
            </PropertySection>
          </>
        ) : (
          <>
            <div data-theme-properties-body className="flex min-w-0 flex-col gap-2.5 px-3 py-3">
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
                  menuItems={menuItems}
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
              ) : activeGroup === "footer" && visibleFields.length > 0 ? (
                <FooterPropertyPanel
                  fields={visibleFields}
                  getValue={getValue}
                  onChange={onFieldChange}
                />
              ) : visibleFields.length > 0 ? (
                <FieldGroup className="gap-2.5">
                  {visibleFields.map((field) => (
                    <PropertyFieldEditor
                      key={field.id}
                      field={field}
                      value={getValue(field)}
                      onChange={(value) => onFieldChange(field, value)}
                    />
                  ))}
                </FieldGroup>
              ) : (
                <EmptySettingsMessage
                  label={activeGroupData?.label ?? "Bu bölüm"}
                  tab={effectiveEditorTab}
                />
              )}
            </div>
            {effectiveEditorTab === "design" &&
              activeGroup !== THEME_EDITOR_THEME_GROUP_ID &&
              activeGroup !== "footer" && (
                <PropertySection title="Marka rengi" defaultOpen={false}>
                  <FieldGroup className="gap-2.5">
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
                  </FieldGroup>
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
    <Empty className="min-h-20 p-3">
      <EmptyHeader>
        <EmptyTitle>Ayar bulunmuyor</EmptyTitle>
        <EmptyDescription>
          {label} için {EDITOR_TABS.find((candidate) => candidate.id === tab)?.label.toLowerCase()} sekmesinde ayar yok.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
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
    <FieldGroup className="gap-3">
      <FieldSet>
        <FieldLegend variant="label">Nerede gösterilsin?</FieldLegend>
        <ToggleGroup value={[visibility.mode]} onValueChange={(values) => values[0] && updateMode(values[0] as ThemeSectionVisibilityMode)} className="grid w-full grid-cols-1" aria-label="Bölüm görünürlüğü">
          {([
            ["all", "Tüm menü", "Ana ekran ve bütün kategori görünümleri"],
            ["home", "Ana kategori ekranı", "Yalnız kategori seçilmeden önce"],
            ["categories", "Seçili kategoriler", "Belirlediğin kategori sayfalarında"],
          ] as const).map(([mode, label, description]) => {
            return (
              <ToggleGroupItem
                key={mode}
                variant="outline"
                value={mode}
                className="h-auto min-h-[50px] w-full min-w-0 flex-col items-start gap-0.5 px-3 py-2 text-left"
              >
                <span className="font-semibold">{label}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {description}
                </span>
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      </FieldSet>

      {visibility.mode === "categories" ? (
        <Card size="sm">
          <CardHeader>
            <CardTitle>Kategoriler</CardTitle>
            <CardAction className="flex items-center gap-1">
              <Button
                type="button"
                variant="link"
                size="xs"
                onClick={() => setSelectedCategories(categories.map((category) => category.id))}
              >
                Tümü
              </Button>
              <Button
                type="button"
                variant="link"
                size="xs"
                disabled={selectedIds.size === 0}
                onClick={() => setSelectedCategories([])}
              >
                Temizle
              </Button>
              <Badge variant="secondary">{selectedIds.size} seçili</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
          {selectedIds.size === 0 ? (
            <Alert role="note"><AlertDescription>En az bir kategori seçilene kadar bu bölüm menüde görünmez.</AlertDescription></Alert>
          ) : null}
          <ScrollArea className="h-[230px] pr-2">
            {roots.map((root) => renderCategoryRows(root))}
          </ScrollArea>
          <Field orientation="horizontal" className="border-t pt-2.5">
            <Checkbox
              id="theme-section-visibility-include-children"
              checked={visibility.includeChildren ?? true}
              onCheckedChange={(checked) => onChange({
                mode: "categories",
                categoryIds: visibility.categoryIds ?? [],
                includeChildren: checked === true,
              })}
            />
            <div className="flex flex-col gap-0.5">
              <FieldLabel htmlFor="theme-section-visibility-include-children">Alt kategorilere de uygula</FieldLabel>
              <FieldDescription>
                Üst kategori seçiliyse alt kategori ekranlarında da görünür.
              </FieldDescription>
            </div>
          </Field>
          </CardContent>
        </Card>
      ) : null}
    </FieldGroup>
  );
}

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
  const controlId = useId();
  return (
    <Field orientation="horizontal" className="min-h-8 gap-2 rounded-md px-2 py-1" style={{ paddingInlineStart: 7 + Math.min(depth, 4) * 17 }}>
      <Checkbox id={controlId} checked={checked} onCheckedChange={() => onToggle(category.id)} />
      <FieldLabel htmlFor={controlId} className={depth > 0 ? "min-w-0 truncate font-normal" : "min-w-0 truncate font-semibold"}>
        {category.name}
      </FieldLabel>
    </Field>
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
    <Tooltip>
      <TooltipTrigger render={<Button type="button" variant="ghost" size="icon-xs" aria-label={title} onClick={onClick} />}>
        {children}
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
}
