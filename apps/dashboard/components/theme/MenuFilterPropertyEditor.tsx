"use client";

import { useMemo, useState } from "react";
import type { MenuFilterPresetId, ThemeMenuCustomFilter } from "@garsonless/design-engine";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PlusIcon, Trash2Icon } from "lucide-react";

interface MenuFilterItem {
  id: string;
  name: string;
  categoryName: string;
  isAvailable?: boolean;
}

const FILTER_PRESETS: Array<{ id: MenuFilterPresetId; label: string; description: string }> = [
  { id: "vegan", label: "Vegan", description: "Vegan olarak işaretlenen ürünler" },
  { id: "vegetarian", label: "Vejetaryen", description: "Vejetaryen olarak işaretlenen ürünler" },
  { id: "halal", label: "Helal", description: "Helal olarak işaretlenen ürünler" },
];

export function MenuFilterPropertyEditor({
  presetValue,
  customValue,
  menuItems,
  onPresetChange,
  onCustomChange,
}: {
  presetValue: unknown;
  customValue: unknown;
  menuItems: MenuFilterItem[];
  onPresetChange: (value: MenuFilterPresetId[]) => void;
  onCustomChange: (value: ThemeMenuCustomFilter[]) => void;
}) {
  const enabledPresets = Array.isArray(presetValue)
    ? presetValue.filter((value): value is MenuFilterPresetId => FILTER_PRESETS.some((preset) => preset.id === value))
    : FILTER_PRESETS.map((preset) => preset.id);
  const customFilters = Array.isArray(customValue)
    ? customValue.filter((value): value is ThemeMenuCustomFilter => Boolean(
      value && typeof value === "object" && typeof value.id === "string" && typeof value.label === "string" && Array.isArray(value.itemIds),
    ))
    : [];
  const [draftLabel, setDraftLabel] = useState("");
  const normalizedDraft = draftLabel.trim();
  const duplicateLabel = customFilters.some((filter) => filter.label.toLocaleLowerCase("tr-TR") === normalizedDraft.toLocaleLowerCase("tr-TR"));
  const canAdd = normalizedDraft.length > 0 && normalizedDraft.length <= 40 && !duplicateLabel && customFilters.length < 12;

  const addCustomFilter = () => {
    if (!canAdd) return;
    onCustomChange([
      ...customFilters,
      { id: `manual-${crypto.randomUUID()}`, label: normalizedDraft, itemIds: [] },
    ]);
    setDraftLabel("");
  };

  return (
    <Card data-theme-property-card size="sm" className="data-[size=sm]:[--card-spacing:--spacing(2.5)]">
      <CardHeader><CardTitle>Müşteri filtreleri</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3">
        <FieldSet className="gap-2.5">
          <FieldLegend variant="label" className="text-xs">Hazır filtreler</FieldLegend>
          <FieldDescription className="text-xs">
            Ürün düzenleyicideki beslenme işaretlerini kullanır.
          </FieldDescription>
          <FieldGroup data-slot="checkbox-group" className="gap-1.5">
            {FILTER_PRESETS.map((preset) => {
              const checked = enabledPresets.includes(preset.id);
              const controlId = `menu-filter-${preset.id}`;
              return (
                <Field key={preset.id} orientation="horizontal" className="rounded-lg border p-2">
                  <Checkbox
                    id={controlId}
                    checked={checked}
                    onCheckedChange={(next) => onPresetChange(next
                      ? [...enabledPresets, preset.id]
                      : enabledPresets.filter((candidate) => candidate !== preset.id))}
                  />
                  <div className="min-w-0 flex-1">
                    <FieldLabel htmlFor={controlId} className="text-xs">{preset.label}</FieldLabel>
                    <FieldDescription className="text-[10.5px] leading-snug">{preset.description}</FieldDescription>
                  </div>
                </Field>
              );
            })}
          </FieldGroup>
        </FieldSet>

        <Field className="gap-1.5">
          <FieldLabel htmlFor="manual-menu-filter-name" className="text-xs">Manuel filtre ekle</FieldLabel>
          <div className="flex gap-1.5">
            <Input
              id="manual-menu-filter-name"
              value={draftLabel}
              maxLength={40}
              placeholder="Örn. Acılı"
              onChange={(event) => setDraftLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                addCustomFilter();
              }}
            />
            <Button type="button" variant="outline" size="icon" aria-label="Manuel filtre ekle" disabled={!canAdd} onClick={addCustomFilter}>
              <PlusIcon data-icon="inline-start" />
            </Button>
          </div>
          <FieldDescription className="text-[10.5px] leading-snug">
            {duplicateLabel ? "Bu isimde bir filtre zaten var." : `${customFilters.length}/12 manuel filtre`}
          </FieldDescription>
        </Field>

        {customFilters.length > 0 && (
          <FieldGroup className="gap-2">
            {customFilters.map((filter) => (
              <Card key={filter.id} size="sm" className="gap-0 py-0">
                <CardHeader className="flex-row items-center gap-2 px-2.5 py-2">
                  <CardTitle className="min-w-0 flex-1 truncate text-xs">{filter.label}</CardTitle>
                  <Badge variant="secondary">{filter.itemIds.length} ürün</Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`${filter.label} filtresini kaldır`}
                    onClick={() => onCustomChange(customFilters.filter((candidate) => candidate.id !== filter.id))}
                  >
                    <Trash2Icon data-icon="inline-start" />
                  </Button>
                </CardHeader>
                <CardContent className="px-2.5 pb-2.5">
                  <CustomFilterProductsCombobox
                    label={filter.label}
                    itemIds={filter.itemIds}
                    menuItems={menuItems}
                    onChange={(itemIds) => onCustomChange(customFilters.map((candidate) =>
                      candidate.id === filter.id ? { ...candidate, itemIds } : candidate))}
                  />
                </CardContent>
              </Card>
            ))}
          </FieldGroup>
        )}
      </CardContent>
    </Card>
  );
}

function CustomFilterProductsCombobox({
  label,
  itemIds,
  menuItems,
  onChange,
}: {
  label: string;
  itemIds: string[];
  menuItems: MenuFilterItem[];
  onChange: (itemIds: string[]) => void;
}) {
  const anchor = useComboboxAnchor();
  const options = useMemo(() => menuItems.map((item) => ({
    value: item.id,
    label: item.name,
    item,
  })), [menuItems]);
  const selectedOptions = options.filter((option) => itemIds.includes(option.value));
  const staleCount = itemIds.filter((id) => !options.some((option) => option.value === id)).length;

  if (menuItems.length === 0) {
    return <FieldDescription className="text-xs">Filtreye atanabilecek ürün bulunmuyor.</FieldDescription>;
  }

  return (
    <Field className="gap-1.5">
      <FieldLabel className="text-[10.5px]">Filtredeki ürünler</FieldLabel>
      <Combobox
        multiple
        items={options}
        value={selectedOptions}
        onValueChange={(next) => onChange(next.map((option) => option.value))}
      >
        <ComboboxChips ref={anchor} aria-label={`${label} filtresindeki ürünler`} className="min-h-8">
          <ComboboxValue>
            {(values: typeof options) => values.map((option) => (
              <ComboboxChip key={option.value}>{option.label}</ComboboxChip>
            ))}
          </ComboboxValue>
          <ComboboxChipsInput placeholder={selectedOptions.length ? "Ürün ara…" : "Ürün seç…"} />
        </ComboboxChips>
        <ComboboxContent anchor={anchor} className="min-w-(--anchor-width)">
          <ComboboxEmpty>Ürün bulunamadı.</ComboboxEmpty>
          <ComboboxList>
            {(option) => (
              <ComboboxItem key={option.value} value={option} disabled={option.item.isAvailable === false}>
                <span className="min-w-0">
                  <span className="block truncate text-xs">{option.item.name}</span>
                  <span className="block truncate text-[10.5px] text-muted-foreground">{option.item.categoryName}{option.item.isAvailable === false ? " · Pasif" : ""}</span>
                </span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {itemIds.length === 0 && (
        <FieldDescription className="text-[10.5px] text-amber-700" aria-live="polite">
          En az bir ürün seçildiğinde bu filtre müşteriye gösterilir.
        </FieldDescription>
      )}
      {staleCount > 0 && <FieldDescription className="text-[10.5px] text-destructive">Kaldırılmış {staleCount} ürün seçimi var; yeni seçimde temizlenir.</FieldDescription>}
    </Field>
  );
}
