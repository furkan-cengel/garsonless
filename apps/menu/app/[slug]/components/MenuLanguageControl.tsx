"use client";
import { useEffect, useState } from "react";
import type { MenuLocale } from "@garsonless/domain/menu-translation";

/** Menu-only preference. Native radios keep both languages visible and keyboard accessible. */
export function MenuLanguageControl({
  locale,
  onChange,
}: {
  locale: MenuLocale;
  onChange: (value: MenuLocale) => void;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <fieldset
      data-component="menu-language-control"
      aria-label="Menü dili / Menu language"
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: 10,
        margin: 0,
        border: 0,
        minWidth: 0,
        padding: "10px var(--p-pad)",
        background: "var(--p-bg)",
        color: "var(--p-text)",
      }}
    >
      <span
        aria-hidden="true"
        style={{ fontSize: 12, color: "var(--p-text-2)" }}
      >
        Dil / Language
      </span>
      <div
        style={{
          display: "flex",
          gap: 4,
          padding: 3,
          borderRadius: 12,
          border: "1px solid var(--p-border)",
          background: "var(--p-card)",
        }}
      >
        {(
          [
            { value: "tr", label: "Türkçe" },
            { value: "en", label: "English" },
          ] as const
        ).map((option) => (
          <label
            key={option.value}
            lang={option.value}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              minHeight: 38,
              padding: "0 10px",
              borderRadius: 8,
              cursor: ready ? "pointer" : "default",
              background:
                locale === option.value ? "var(--p-bg)" : "transparent",
              fontSize: 13,
              fontWeight: locale === option.value ? 600 : 400,
            }}
          >
            <input
              type="radio"
              name="qr-menu-language"
              value={option.value}
              checked={locale === option.value}
              disabled={!ready}
              onChange={() => onChange(option.value)}
              style={{
                margin: 0,
                width: 14,
                height: 14,
                  accentColor: "var(--p-accent)",
              }}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
