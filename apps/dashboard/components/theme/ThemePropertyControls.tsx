"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { SettingField } from "@garsonless/ui";

import { I } from "../../lib/ui";
import { sanitizePropertyControlId } from "./theme-property-renderer-model";

export const THEME_PROPERTY_CONTROL_CSS = `
  [data-modern-property-panel] .header-modern-range {
    width: 100%; height: 20px; margin: 0; appearance: none; -webkit-appearance: none;
    background: transparent; cursor: pointer;
  }
  [data-modern-property-panel] .header-modern-range::-webkit-slider-runnable-track {
    height: 4px; border-radius: 999px; background: #dedfe2;
  }
  [data-modern-property-panel] .header-modern-range::-webkit-slider-thumb {
    appearance: none; -webkit-appearance: none; width: 16px; height: 16px;
    margin-top: -6px; border: 3px solid #fff; border-radius: 50%;
    background: #111318; box-shadow: 0 1px 4px rgba(17,19,24,.28);
  }
  [data-modern-property-panel] .header-modern-range::-moz-range-track {
    height: 4px; border-radius: 999px; background: #dedfe2;
  }
  [data-modern-property-panel] .header-modern-range::-moz-range-thumb {
    width: 12px; height: 12px; border: 3px solid #fff; border-radius: 50%;
    background: #111318; box-shadow: 0 1px 4px rgba(17,19,24,.28);
  }
  [data-modern-property-panel] .header-modern-range:focus-visible {
    outline: 2px solid #111318; outline-offset: 3px; border-radius: 999px;
  }
`;

export function ThemeColorField({
  field,
  value,
  onChange,
}: {
  field: SettingField;
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const valid = /^#[0-9a-fA-F]{6}$/.test(draft);
  return (
    <div>
      <label
        style={{
          display: "block",
          marginBottom: 6,
          fontSize: 12.5,
          color: "var(--text-2)",
        }}
      >
        {field.label}
      </label>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "38px minmax(0,1fr)",
          border: `1px solid ${valid ? "var(--border)" : "#d92d20"}`,
          borderRadius: 8,
          overflow: "hidden",
          background: "#fff",
        }}
      >
        <input
          aria-label={`${field.label} renk seçici`}
          type="color"
          value={valid ? draft : "#000000"}
          onChange={(event) => {
            setDraft(event.target.value);
            onChange(event.target.value);
          }}
          style={{
            width: 38,
            height: 34,
            padding: 2,
            border: 0,
            background: "#fff",
            cursor: "pointer",
          }}
        />
        <input
          aria-label={`${field.label} hex değeri`}
          value={draft}
          onChange={(event) => {
            const next = event.target.value;
            setDraft(next);
            if (/^#[0-9a-fA-F]{6}$/.test(next)) onChange(next);
          }}
          style={{
            minWidth: 0,
            border: 0,
            borderLeft: "1px solid var(--border)",
            padding: "0 9px",
            fontFamily: "monospace",
            fontSize: 12,
            outline: 0,
          }}
        />
      </div>
      {!valid && (
        <div style={{ marginTop: 4, color: "#b42318", fontSize: 10.5 }}>
          Geçerli format: #RRGGBB
        </div>
      )}
    </div>
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
  const tiledSelect =
    field.type === "select" &&
    [
      "headerLogoStyle",
      "headerStyle",
      "headerLayout",
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
      "announcementStyle",
    ].includes(field.id);
  if (tiledSelect) {
    return (
      <div>
        <div
          style={{ marginBottom: 7, fontSize: 12.5, color: "var(--text-2)" }}
        >
          {field.label}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${Math.min(field.options?.length ?? 1, 3)}, minmax(0, 1fr))`,
            gap: 7,
            minWidth: 0,
          }}
        >
          {field.options?.map((option) => {
            const active = value === option.value;
            return (
              <button
                key={String(option.value)}
                type="button"
                aria-pressed={active}
                onClick={() => onChange(option.value)}
                style={{
                  minHeight: 54,
                  padding: "7px 5px",
                  minWidth: 0,
                  border: active
                    ? "1.5px solid #111318"
                    : "1px solid var(--border)",
                  borderRadius: 9,
                  background: active ? "#f1f2f3" : "#fff",
                  color: active ? "#111318" : "var(--text-2)",
                  cursor: "pointer",
                  fontSize: 11.5,
                  fontWeight: active ? 700 : 550,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    marginBottom: 5,
                    lineHeight: 1,
                  }}
                >
                  {headerOptionIcon(field.id, String(option.value))}
                </span>
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
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
      <div>
        <div
          style={{
            marginBottom: 7,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            fontSize: 12.5,
            color: "var(--text-2)",
          }}
        >
          <span>Header yüksekliği</span>
          {customHeight && (
            <span
              style={{
                padding: "2px 6px",
                borderRadius: 999,
                background: "#f1f2f3",
                color: "#111318",
                fontSize: 10.5,
                fontWeight: 700,
              }}
            >
              Özel · {height}px
            </span>
          )}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 7,
            marginBottom: 9,
          }}
        >
          {presets.map((preset) => {
            const active = height === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                aria-pressed={active}
                onClick={() => onChange(preset.value)}
                style={{
                  height: 48,
                  borderRadius: 9,
                  cursor: "pointer",
                  border: active
                    ? "1.5px solid #111318"
                    : "1px solid var(--border)",
                  background: active ? "#f1f2f3" : "#fff",
                  color: active ? "#111318" : "var(--text-2)",
                  fontSize: 11.5,
                }}
              >
                <strong style={{ display: "block" }}>{preset.label}</strong>
                {preset.value}px
              </button>
            );
          })}
        </div>
        <HeaderRangeControl
          field={field}
          value={height}
          onChange={onChange}
          controlId={controlId}
        />
      </div>
    );
  }
  if (field.type === "toggle")
    return (
      <div
        style={{
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <label
          htmlFor={controlId}
          style={{ minWidth: 0, fontSize: 12.5, color: "var(--text-2)" }}
        >
          {field.label}
        </label>
        <HeaderToggleControl
          controlId={controlId}
          value={Boolean(value)}
          onChange={onChange}
          label={field.label}
        />
      </div>
    );
  if (field.type === "range")
    return (
      <div style={{ minWidth: 0 }}>
        <label
          htmlFor={controlId}
          style={{
            display: "block",
            marginBottom: 7,
            fontSize: 12.5,
            color: "var(--text-2)",
          }}
        >
          {field.label}
        </label>
        <HeaderRangeControl
          field={field}
          value={Number(value ?? field.default ?? 0)}
          onChange={onChange}
          controlId={controlId}
        />
      </div>
    );
  return (
    <div style={{ minWidth: 0 }}>
      <label
        htmlFor={controlId}
        style={{
          display: "block",
          marginBottom: 7,
          fontSize: 12.5,
          color: "var(--text-2)",
        }}
      >
        {field.label}
      </label>
      <PropertyControl
        field={field}
        value={value}
        onChange={onChange}
        controlId={controlId}
      />
    </div>
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
    <div
      style={{
        minWidth: 0,
        display: "grid",
        gridTemplateColumns: "28px minmax(0,1fr) 50px 28px",
        alignItems: "center",
        gap: 6,
      }}
    >
      <button
        type="button"
        aria-label={`${field.label} azalt`}
        onClick={() => onChange(clamp(value - step))}
        disabled={value <= min}
        style={headerRangeStepButtonStyle}
      >
        −
      </button>
      <input
        id={controlId}
        className="header-modern-range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <output
        htmlFor={controlId}
        style={{
          height: 30,
          border: "1px solid var(--border)",
          borderRadius: 8,
          background: "#fff",
          color: "#111318",
          display: "grid",
          placeItems: "center",
          fontSize: 12,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
        {field.unit ?? ""}
      </output>
      <button
        type="button"
        aria-label={`${field.label} artır`}
        onClick={() => onChange(clamp(value + step))}
        disabled={value >= max}
        style={headerRangeStepButtonStyle}
      >
        +
      </button>
    </div>
  );
}

const headerRangeStepButtonStyle: CSSProperties = {
  width: 28,
  height: 28,
  padding: 0,
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "#fff",
  color: "#111318",
  cursor: "pointer",
  fontSize: 16,
  lineHeight: 1,
};

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
    <button
      id={controlId}
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      onClick={() => onChange(!value)}
      style={{
        width: 38,
        height: 22,
        padding: 0,
        border: "1px solid #d7d9dd",
        borderRadius: 999,
        background: value ? "#111318" : "#e7e8eb",
        position: "relative",
        cursor: "pointer",
        flexShrink: 0,
        transition: "background 150ms, border-color 150ms",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: value ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(17,19,24,.22)",
          transition: "left 150ms",
        }}
      />
    </button>
  );
}

function headerOptionIcon(fieldId: string, value: string) {
  if (fieldId === "headerStyle")
    return value === "blur" ? <I.sparkles size={17} /> : <I.color size={17} />;
  if (fieldId === "headerAlign")
    return value === "center" ? (
      <I.layout size={17} />
    ) : (
      <I.spacing size={17} />
    );
  if (fieldId === "headerLayout") {
    if (value === "stacked") return <I.header size={17} />;
    if (value === "center") return <I.layout size={17} />;
    if (value === "compact") return <I.card size={17} />;
    return <I.spacing size={17} />;
  }
  if (fieldId === "headerLogoStyle") {
    if (value === "image") return <I.image size={17} />;
    if (value === "wordmark") return <I.type size={17} />;
    return <I.header size={17} />;
  }
  if (fieldId === "cardLayout")
    return value === "horizontal" ? (
      <I.section size={17} />
    ) : value === "minimal" ? (
      <I.page size={17} />
    ) : (
      <I.grid size={17} />
    );
  if (fieldId === "cardDensity")
    return value === "compact" ? (
      <I.spacing size={17} />
    ) : value === "comfortable" ? (
      <I.sparkles size={17} />
    ) : (
      <I.card size={17} />
    );
  if (fieldId === "cardPriceAlign" || fieldId === "catnavAlign")
    return value === "right" ? (
      <I.arrow size={17} />
    ) : value === "center" ? (
      <I.layout size={17} />
    ) : (
      <I.chevLeft size={17} />
    );
  if (
    fieldId === "cardImageFit" ||
    fieldId === "cardImagePosition" ||
    fieldId === "cardPlaceholderStyle"
  )
    return <I.image size={17} />;
  if (fieldId === "cardHover")
    return value === "none" ? (
      <I.close size={17} />
    ) : value === "lift" ? (
      <I.arrow size={17} />
    ) : (
      <I.sparkles size={17} />
    );
  if (fieldId === "cardCtaStyle")
    return value === "none" ? (
      <I.close size={17} />
    ) : value === "icon" ? (
      <I.plus size={17} />
    ) : (
      <I.tag size={17} />
    );
  if (fieldId === "cardCtaIcon")
    return value === "cart" ? (
      <I.cart size={17} />
    ) : value === "bag" ? (
      <I.store size={17} />
    ) : (
      <I.plus size={17} />
    );
  if (fieldId === "catnavStyle")
    return value === "visual" ? <I.image size={17} /> : <I.nav size={17} />;
  if (fieldId === "catnavActiveStyle")
    return value === "underline" ? (
      <I.spacing size={17} />
    ) : value === "dot" ? (
      <I.more size={17} />
    ) : (
      <I.tag size={17} />
    );
  if (fieldId === "catnavDensity")
    return value === "compact" ? <I.spacing size={17} /> : <I.nav size={17} />;
  if (fieldId === "catnavVisualStyle")
    return value === "overlay" ? <I.image size={17} /> : <I.card size={17} />;
  if (fieldId === "texture")
    return value === "solid" ? (
      <I.color size={17} />
    ) : value === "paper" ? (
      <I.page size={17} />
    ) : (
      <I.sparkles size={17} />
    );
  if (fieldId === "sectionHeading")
    return value === "catalog" ? (
      <I.page size={17} />
    ) : value === "editorial" ? (
      <I.type size={17} />
    ) : (
      <I.color size={17} />
    );
  if (fieldId === "pageMaxWidth")
    return value === "none" ? <I.frame size={17} /> : <I.layout size={17} />;
  if (fieldId === "cartHeaderTriggerStyle")
    return value === "none" ? (
      <I.close size={17} />
    ) : value === "icon" ? (
      <I.cart size={17} />
    ) : (
      <I.receipt size={17} />
    );
  if (fieldId === "cartFooterTriggerStyle") {
    if (value === "none") return <I.close size={17} />;
    if (value === "bar") return <I.section size={17} />;
    if (value === "fab") return <I.plus size={17} />;
    if (value === "thumbs") return <I.image size={17} />;
    return <I.cart size={17} />;
  }
  if (fieldId === "cartIcon")
    return value === "cart" ? (
      <I.cart size={17} />
    ) : value === "bag" ? (
      <I.store size={17} />
    ) : (
      <I.handPlatter size={17} />
    );
  if (fieldId === "cartPillTone" || fieldId === "cartDrawerTone")
    return value === "light" || value === "clean" ? (
      <I.sparkles size={17} />
    ) : (
      <I.color size={17} />
    );
  if (fieldId === "cartPillPosition")
    return value === "edge" ? <I.spacing size={17} /> : <I.arrow size={17} />;
  if (fieldId === "announcementStyle")
    return value === "static" ? (
      <I.page size={17} />
    ) : value === "marquee" ? (
      <I.arrow size={17} />
    ) : value === "fade" ? (
      <I.sparkles size={17} />
    ) : (
      <I.section size={17} />
    );
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
    <div style={{ borderBottom: "1px solid var(--divider)" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          height: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          border: "none",
          background: "transparent",
          cursor: "pointer",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 750, color: "var(--text)" }}>
          {title}
        </span>
        <span
          style={{
            color: "var(--text-3)",
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
            transition: "transform 120ms",
          }}
        >
          <I.chevDown size={17} />
        </span>
      </button>
      {open && <div style={{ padding: "0 16px 16px" }}>{children}</div>}
    </div>
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
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "96px 1fr",
        alignItems: field.type === "toggle" ? "center" : "start",
        gap: 10,
        minHeight: 32,
      }}
    >
      <label
        htmlFor={controlId}
        style={{
          paddingTop: field.type === "toggle" ? 0 : 6,
          fontSize: 12.5,
          color: "var(--text-2)",
        }}
      >
        {field.label}
      </label>
      <PropertyControl
        field={field}
        value={value}
        onChange={onChange}
        controlId={controlId}
      />
    </div>
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
      <div
        style={{
          height: 32,
          display: "flex",
          alignItems: "center",
          border: "1px solid var(--border-strong)",
          borderRadius: 7,
          overflow: "hidden",
          background: "var(--surface)",
        }}
      >
        <input
          id={`${controlId}-color`}
          type="color"
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: 34,
            height: 32,
            border: "none",
            padding: 0,
            background: "transparent",
            cursor: "pointer",
          }}
        />
        <input
          id={controlId}
          type="text"
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          style={{
            flex: 1,
            minWidth: 0,
            height: "100%",
            border: "none",
            outline: "none",
            borderLeft: "1px solid var(--border-strong)",
            padding: "0 9px",
            fontSize: 12.5,
            color: "var(--text)",
            background: "transparent",
          }}
        />
      </div>
    );
  if (field.type === "range" && field.themeField === "cols") {
    const numVal = Number(value || 2);
    return (
      <div style={{ display: "flex", gap: 6 }}>
        {([1, 2, 3] as const).map((col) => {
          const active = numVal === col;
          return (
            <button
              key={col}
              type="button"
              title={`${col} sütun`}
              onClick={() => onChange(col)}
              style={{
                flex: 1,
                height: 44,
                border: active
                  ? "2px solid var(--accent)"
                  : "1.5px solid var(--border)",
                borderRadius: 9,
                background: active ? "var(--accent-soft)" : "var(--surface-2)",
                color: active ? "var(--accent)" : "var(--text-3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "border-color 120ms, background 120ms, color 120ms",
              }}
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
            </button>
          );
        })}
      </div>
    );
  }
  if (field.type === "range") {
    const fallback = field.default ?? field.min ?? 0;
    const parsed = Number(value ?? fallback);
    const numVal = Number.isFinite(parsed) ? parsed : Number(fallback) || 0;
    return (
      <div
        style={{ display: "flex", alignItems: "center", gap: 10, height: 32 }}
      >
        <input
          id={controlId}
          type="range"
          min={field.min}
          max={field.max}
          step={field.step}
          value={numVal}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 1, accentColor: "var(--text)" }}
        />
        <span
          style={{
            minWidth: 46,
            textAlign: "right",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "3px 6px",
            color: "var(--text-2)",
            fontSize: 12,
          }}
        >
          {numVal}
          {field.unit ?? ""}
        </span>
      </div>
    );
  }
  if (field.type === "toggle") {
    const boolVal = Boolean(value);
    return (
      <button
        type="button"
        id={controlId}
        role="switch"
        aria-checked={boolVal}
        onClick={() => onChange(!boolVal)}
        style={{
          width: 38,
          height: 22,
          justifySelf: "start",
          borderRadius: 999,
          border: "none",
          background: boolVal ? "var(--text)" : "var(--surface-3)",
          position: "relative",
          cursor: "pointer",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: boolVal ? 19 : 3,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,.2)",
            transition: "left 150ms",
          }}
        />
      </button>
    );
  }
  if (field.type === "select" || field.type === "font")
    return (
      <select
        id={controlId}
        value={value as string}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          height: 32,
          borderRadius: 7,
          border: "1px solid var(--border-strong)",
          background: "var(--surface)",
          color: "var(--text)",
          fontSize: 12.5,
          padding: "0 9px",
          cursor: "pointer",
        }}
      >
        {(field.options ?? []).map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  if (field.type === "text")
    return (
      <input
        id={controlId}
        type="text"
        value={(value as string | undefined) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          minWidth: 0,
          height: 32,
          borderRadius: 7,
          border: "1px solid var(--border-strong)",
          background: "var(--surface)",
          color: "var(--text)",
          fontSize: 12.5,
          padding: "0 9px",
          outline: "none",
        }}
      />
    );
  return null;
}
