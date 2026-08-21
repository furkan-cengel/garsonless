"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { SettingField } from "@garsonless/ui/themes";
import { ChevronDown } from "lucide-react";

import { I } from "../../lib/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldError, FieldLabel, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  CardLayoutOptionIcon,
  ThemeEditorControlIcon,
} from "./CardLayoutOptionIcon";
import { CardPropertyOptionIcon } from "./CardPropertyOptionIcon";
import { CartOptionIcon } from "./CartOptionIcon";
import { HeaderOptionIcon } from "./HeaderOptionIcon";
import { LayoutOptionIcon } from "./LayoutOptionIcon";
import { NavigationOptionIcon } from "./NavigationOptionIcon";
import { sanitizePropertyControlId } from "./theme-property-renderer-model";

export const THEME_PROPERTY_CONTROL_CSS = ``;

export function ThemeColorField({
  field,
  value,
  issueLabels = [],
  onChange,
}: {
  field: SettingField;
  value: string;
  issueLabels?: string[];
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const valid = /^#[0-9a-fA-F]{6}$/.test(draft);
  const controlId = `theme-field-${sanitizePropertyControlId(field.id)}`;
  const issueId = `${controlId}-issues`;
  return (
    <Field data-invalid={!valid || issueLabels.length > 0} className="gap-1.5">
      <FieldLabel htmlFor={controlId}>
        {field.label}
      </FieldLabel>
      <InputGroup className={cn("min-h-11", issueLabels.length > 0 && "border-destructive ring-1 ring-destructive/30")}>
        <InputGroupAddon className="border-r p-0">
          <input
            aria-label={`${field.label} renk seçici`}
            aria-describedby={issueLabels.length > 0 ? issueId : undefined}
            type="color"
            value={valid ? draft : "#000000"}
            onChange={(event) => {
              setDraft(event.target.value);
              onChange(event.target.value);
            }}
            className="size-11 cursor-pointer rounded border-0 bg-transparent p-2.5"
          />
        </InputGroupAddon>
        <InputGroupInput
          id={controlId}
          aria-invalid={!valid || issueLabels.length > 0}
          aria-describedby={issueLabels.length > 0 ? issueId : undefined}
          value={draft}
          onChange={(event) => {
            const next = event.target.value;
            setDraft(next);
            if (/^#[0-9a-fA-F]{6}$/.test(next)) onChange(next);
          }}
          className="min-h-11 font-mono"
        />
      </InputGroup>
      {!valid && <FieldError>Geçerli format: #RRGGBB</FieldError>}
      {valid && issueLabels.length > 0 ? (
        <FieldError id={issueId}>{issueLabels.join(" · ")}</FieldError>
      ) : null}
    </Field>
  );
}

export function HeaderPropertyField({
  field,
  value,
  onChange,
}: {
  field: SettingField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const controlId = `theme-field-${sanitizePropertyControlId(field.id)}`;
  const segmentedSelect = field.type === "select" && [
    "memberPlacement",
    "billPlacement",
    "cartPlacement",
    "servicePlacement",
  ].includes(field.id);
  if (segmentedSelect) {
    const options = field.options ?? [];
    return (
      <Field className="gap-1.5">
        <FieldTitle id={`${controlId}-label`}>{field.label}</FieldTitle>
        <ToggleGroup
          data-theme-action-placement-options
          value={[String(value)]}
          onValueChange={(values) => { const next = values[0]; if (next) onChange(next) }}
          variant="outline"
          size="sm"
          spacing={1}
          className={cn(
            "grid w-full items-stretch",
            options.length > 3 ? "grid-cols-2" : "grid-cols-3",
          )}
          aria-labelledby={`${controlId}-label`}
        >
          {options.map((option) => {
            return (
              <ToggleGroupItem
                key={option.value}
                value={String(option.value)}
                className="h-auto min-h-8 min-w-0 whitespace-normal px-1.5 py-1 text-center leading-tight"
              >{option.label}</ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      </Field>
    );
  }
  const tiledSelect =
    field.type === "select" &&
    [
      "headerLogoStyle",
      "headerStyle",
      "headerLayout",
      "headerPreset",
      "headerAlign",
      "cardLayout",
      "cardDensity",
      "cardPriceAlign",
      "cardImageFit",
      "cardImagePosition",
      "cardHover",
      "cardPlaceholderStyle",
      "cardCtaStyle",
      "cardCtaIcon",
      "catnavStyle",
      "catnavActiveStyle",
      "catnavAlign",
      "catnavDensity",
      "catnavVisualStyle",
      "texture",
      "sectionHeading",
      "pageMaxWidth",
      "cartHeaderTriggerStyle",
      "cartFooterTriggerStyle",
      "cartIcon",
      "cartPillTone",
      "cartDrawerTone",
      "cartPillPosition",
      "footerTone",
    ].includes(field.id);
  if (tiledSelect) {
    return (
      <Field className="gap-1.5">
        <FieldLabel>{field.label}</FieldLabel>
        <ToggleGroup value={[String(value)]} onValueChange={(values) => { const next = values[0]; if (next) onChange(next) }} size="sm" spacing={1} className="grid w-full grid-cols-3" aria-label={field.label}>
          {field.options?.map((option) => {
            return (
              <ToggleGroupItem
                key={String(option.value)}
                value={String(option.value)}
                variant="outline"
                className="h-auto min-h-11 min-w-0 flex-col gap-0.5 py-1.5"
              >
                <span aria-hidden="true" className="flex justify-center leading-none">
                  {headerOptionIcon(field.id, String(option.value))}
                </span>
                {option.label}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      </Field>
    );
  }
  if (field.id === "headerHeight") {
    const height = Number(value ?? field.default ?? 64);
    const presets = [
      { label: "Kompakt", value: 56 },
      { label: "Normal", value: 64 },
      { label: "Geniş", value: 80 },
    ];
    const customHeight = !presets.some((preset) => preset.value === height);
    return (
      <Field className="gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <FieldTitle id={`${controlId}-label`}>Header yüksekliği</FieldTitle>
          {customHeight && (
            <Badge variant="secondary">
              Özel · {height}px
            </Badge>
          )}
        </div>
        <ToggleGroup value={[String(height)]} onValueChange={(values) => { const next = values[0]; if (next) onChange(Number(next)) }} size="sm" spacing={1} className="mb-1.5 grid w-full grid-cols-3" aria-label="Header yüksekliği hazır değerleri">
          {presets.map((preset) => {
            return (
              <ToggleGroupItem
                key={preset.value}
                value={String(preset.value)}
                variant="outline"
                className="h-11 min-w-0 flex-col gap-0"
              >
                <strong>{preset.label}</strong>
                {preset.value}px
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
        <HeaderRangeControl
          field={field}
          value={height}
          onChange={onChange}
          controlId={controlId}
        />
      </Field>
    );
  }
  if (field.type === "toggle")
    return (
      <Field orientation="horizontal" className="gap-2">
        <FieldLabel htmlFor={controlId}>
          {field.label}
        </FieldLabel>
        <HeaderToggleControl
          controlId={controlId}
          value={Boolean(value)}
          onChange={onChange}
          label={field.label}
        />
      </Field>
    );
  if (field.type === "range")
    return (
      <Field className="gap-1.5">
        <FieldLabel htmlFor={controlId}>
          {field.label}
        </FieldLabel>
        <HeaderRangeControl
          field={field}
          value={Number(value ?? field.default ?? 0)}
          onChange={onChange}
          controlId={controlId}
        />
      </Field>
    );
  return (
    <Field className="gap-1.5">
      <FieldLabel htmlFor={controlId}>
        {field.label}
      </FieldLabel>
      <PropertyControl
        field={field}
        value={value}
        onChange={onChange}
        controlId={controlId}
      />
    </Field>
  );
}

function HeaderRangeControl({
  field,
  value,
  onChange,
  controlId,
}: {
  field: SettingField;
  value: number;
  onChange: (value: number) => void;
  controlId: string;
}) {
  const min = field.min ?? 0;
  const max = field.max ?? 100;
  const step = field.step ?? 1;
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
      <Slider
        id={controlId}
        min={min}
        max={max}
        step={step}
        value={value}
        onValueChange={(next) => onChange(Array.isArray(next) ? next[0] ?? value : next)}
        aria-label={field.label}
      />
      <ButtonGroup aria-label={`${field.label} hassas ayarı`}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 border-0 bg-transparent p-0 hover:bg-transparent focus-visible:ring-ring"
          aria-label={`${field.label} azalt`}
          onClick={() => onChange(clamp(value - step))}
          disabled={value <= min}
        >
          <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-lg border bg-background">
            <ThemeEditorControlIcon name="minus" />
          </span>
        </Button>
        <ButtonGroupText render={<output htmlFor={controlId} className="h-7 min-w-12 self-center justify-center tabular-nums" />}>
          {value}{field.unit ?? ""}
        </ButtonGroupText>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 border-0 bg-transparent p-0 hover:bg-transparent focus-visible:ring-ring"
          aria-label={`${field.label} artır`}
          onClick={() => onChange(clamp(value + step))}
          disabled={value >= max}
        >
          <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-lg border bg-background">
            <ThemeEditorControlIcon name="plus" />
          </span>
        </Button>
      </ButtonGroup>
    </div>
  );
}

function HeaderToggleControl({
  controlId,
  value,
  onChange,
  label,
}: {
  controlId: string;
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <Switch
      id={controlId}
      checked={value}
      aria-label={label}
      onCheckedChange={onChange}
    />
  );
}

function headerOptionIcon(fieldId: string, value: string) {
  const cartIcon = <CartOptionIcon fieldId={fieldId} value={value} />;
  if (
    fieldId === "cartHeaderTriggerStyle" ||
    fieldId === "cartFooterTriggerStyle" ||
    fieldId === "cartIcon" ||
    fieldId === "cartPillTone" ||
    fieldId === "cartDrawerTone" ||
    fieldId === "cartPillPosition"
  ) {
    return cartIcon;
  }
  const layoutIcon = <LayoutOptionIcon fieldId={fieldId} value={value} />;
  if (
    fieldId === "texture" ||
    fieldId === "sectionHeading" ||
    fieldId === "pageMaxWidth"
  ) {
    return layoutIcon;
  }
  const headerIcon = <HeaderOptionIcon fieldId={fieldId} value={value} />;
  if (fieldId === "headerPreset") {
    return <HeaderOptionIcon fieldId="headerLayout" value={value === "standard" ? "center" : value === "brand" ? "split" : "compact"} />;
  }
  if (
    fieldId === "headerLogoStyle" ||
    fieldId === "headerStyle" ||
    fieldId === "headerLayout" ||
    fieldId === "headerAlign"
  ) {
    return headerIcon;
  }
  const navigationIcon = (
    <NavigationOptionIcon fieldId={fieldId} value={value} />
  );
  if (
    fieldId === "catnavStyle" ||
    fieldId === "catnavActiveStyle" ||
    fieldId === "catnavAlign" ||
    fieldId === "catnavDensity"
  ) {
    return navigationIcon;
  }
  const cardLayoutIcon = (
    <CardLayoutOptionIcon fieldId={fieldId} value={value} />
  );
  if (
    fieldId === "cardLayout" ||
    fieldId === "cardDensity" ||
    fieldId === "cardPriceAlign" ||
    fieldId === "cardImageFit" ||
    fieldId === "cardImagePosition"
  ) {
    return cardLayoutIcon;
  }
  const cardOptionIcon = (
    <CardPropertyOptionIcon fieldId={fieldId} value={value} />
  );
  if (
    fieldId === "cardHover" ||
    fieldId === "cardPlaceholderStyle" ||
    fieldId === "cardCtaStyle" ||
    fieldId === "cardCtaIcon"
  ) {
    return cardOptionIcon;
  }
  if (fieldId === "catnavVisualStyle")
    return value === "overlay" ? <I.image size={17} /> : <I.card size={17} />;
  if (fieldId === "footerTone")
    return value === "surface" ? <I.card size={17} /> : value === "brand" ? <I.palette size={17} /> : <I.layout size={17} />;
  return <I.sparkles size={17} />;
}

export function PropertySection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-b">
      <h3 className="m-0">
        <CollapsibleTrigger render={<Button type="button" variant="ghost" size="sm" className="h-9 w-full justify-between rounded-none px-3" />}>
          <span>{title}</span>
          <ChevronDown className={open ? undefined : "-rotate-90"} />
        </CollapsibleTrigger>
      </h3>
      <CollapsibleContent className="px-3 pb-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

export function PropertyFieldEditor({
  field,
  value,
  onChange,
}: {
  field: SettingField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const controlId = `theme-field-${sanitizePropertyControlId(field.id)}`;
  return (
    <Field orientation="horizontal" className="min-h-8 grid-cols-[96px_minmax(0,1fr)] items-start">
      <FieldLabel
        htmlFor={controlId}
        className={field.type === "toggle" ? undefined : "pt-1.5"}
      >
        {field.label}
      </FieldLabel>
      <PropertyControl
        field={field}
        value={value}
        onChange={onChange}
        controlId={controlId}
      />
    </Field>
  );
}

function PropertyControl({
  field,
  value,
  onChange,
  controlId,
}: {
  field: SettingField;
  value: unknown;
  onChange: (v: unknown) => void;
  controlId: string;
}) {
  if (field.type === "color")
    return (
      <InputGroup>
        <InputGroupAddon className="border-r px-1.5">
          <input
            id={`${controlId}-color`}
            type="color"
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            aria-label={`${field.label} renk seçici`}
            className="size-6 cursor-pointer rounded border-0 bg-transparent p-0"
          />
        </InputGroupAddon>
        <InputGroupInput
          id={controlId}
          type="text"
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono"
        />
      </InputGroup>
    );
  if (field.type === "range" && field.themeField === "cols") {
    const numVal = Number(value || 2);
    return (
      <ToggleGroup value={[String(numVal)]} onValueChange={(values) => { const next = values[0]; if (next) onChange(Number(next)) }} variant="outline" spacing={2} className="grid w-full grid-cols-3" aria-label={field.label}>
        {([1, 2, 3] as const).map((col) => {
          return (
            <ToggleGroupItem
              key={col}
              value={String(col)}
              title={`${col} sütun`}
              className="h-11 min-w-0"
            >
              <svg width="28" height="22" viewBox="0 0 28 22" fill="none">
                {col === 1 && (
                  <rect
                    x="3"
                    y="3"
                    width="22"
                    height="16"
                    rx="2.5"
                    fill="currentColor"
                    opacity="0.85"
                  />
                )}
                {col === 2 && (
                  <>
                    <rect
                      x="3"
                      y="3"
                      width="10"
                      height="16"
                      rx="2.5"
                      fill="currentColor"
                      opacity="0.85"
                    />
                    <rect
                      x="15"
                      y="3"
                      width="10"
                      height="16"
                      rx="2.5"
                      fill="currentColor"
                      opacity="0.85"
                    />
                  </>
                )}
                {col === 3 && (
                  <>
                    <rect
                      x="2"
                      y="3"
                      width="7"
                      height="16"
                      rx="2"
                      fill="currentColor"
                      opacity="0.85"
                    />
                    <rect
                      x="10.5"
                      y="3"
                      width="7"
                      height="16"
                      rx="2"
                      fill="currentColor"
                      opacity="0.85"
                    />
                    <rect
                      x="19"
                      y="3"
                      width="7"
                      height="16"
                      rx="2"
                      fill="currentColor"
                      opacity="0.85"
                    />
                  </>
                )}
              </svg>
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    );
  }
  if (field.type === "range") {
    const fallback = field.default ?? field.min ?? 0;
    const parsed = Number(value ?? fallback);
    const numVal = Number.isFinite(parsed) ? parsed : Number(fallback) || 0;
    return (
      <div className="flex h-8 items-center gap-2.5">
        <Slider
          id={controlId}
          min={field.min}
          max={field.max}
          step={field.step}
          value={numVal}
          onValueChange={(next) => onChange(Array.isArray(next) ? next[0] ?? numVal : next)}
          aria-label={field.label}
          className="flex-1"
        />
        <Badge variant="outline" className="min-w-12 justify-center tabular-nums">
          {numVal}
          {field.unit ?? ""}
        </Badge>
      </div>
    );
  }
  if (field.type === "toggle") {
    const boolVal = Boolean(value);
    return (
      <Switch
        id={controlId}
        checked={boolVal}
        onCheckedChange={onChange}
        aria-label={field.label}
      />
    );
  }
  if (field.type === "select" || field.type === "font") {
    const items = (field.options ?? []).map((option) => ({ label: option.label, value: String(option.value) }));
    return (
      <Select items={items} value={String(value ?? "")} onValueChange={(next) => { if (next != null) onChange(next) }}>
        <SelectTrigger id={controlId} className="min-h-11 w-full"><SelectValue /></SelectTrigger>
        <SelectContent><SelectGroup>{(field.options ?? []).map((opt) => (
          <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
        ))}</SelectGroup></SelectContent>
      </Select>
    );
  }
  if (field.type === "text")
    return (
      <Input
        id={controlId}
        type="text"
        maxLength={field.maxLength}
        value={(value as string | undefined) ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  return null;
}
