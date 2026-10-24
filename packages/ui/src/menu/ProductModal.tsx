"use client";

import { useMenuLocale } from "./MenuLocaleContext";
import { useEffect, useMemo, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { MenuItem, ModifierGroup, SelectedModifier } from "./types";
import { formatTRY } from "./formatCurrency";
import { useTheme } from "./ThemeContext";
import { AllergenIconList, DietaryBadges, getDefiniteAllergens } from "./FoodInfoBadges";
import { isProductConfigurable } from "./productConfiguration";
import {
  areModifierSelectionsValid,
  getModifierGroupMinimum,
  getModifierGroupSelectionCount,
  isModifierGroupSelectionValid,
} from "./modifierSelectionValidation";
import { AppIcons as I } from "../icons";

const FOCUSABLE_SELECTOR = ["button:not([disabled])", "a[href]", "input:not([disabled])", "select:not([disabled])", "textarea:not([disabled])", '[tabindex]:not([tabindex="-1"])'].join(",");

export interface ProductRecommendationSelection {
  item: MenuItem;
  modifiers: SelectedModifier[];
  removedIngredientIds: string[];
  productNote?: string;
}

export interface ProductModalSubmitOptions {
  productNote?: string;
  recommendations: ProductRecommendationSelection[];
}

export interface ProductModalComboContext {
  baseTotal: number;
  items: Array<{
    id: string;
    name: string;
    imageUrl: string | null;
    state: "current" | "ready" | "included" | "upcoming";
  }>;
}

interface ProductModalProps {
  item: MenuItem | null;
  onClose: () => void;
  onAddToCart: (item: MenuItem, modifiers: SelectedModifier[], quantity: number, removedIngredientIds: string[], options?: ProductModalSubmitOptions) => void;
  recommendationItems?: MenuItem[];
  contextLabel?: string;
  contextTitle?: string;
  comboContext?: ProductModalComboContext;
  promotionLabel?: string;
  quantityStep?: number;
  lockQuantity?: boolean;
  submitLabel?: string;
  closeAfterAdd?: boolean;
  stackLevel?: number;
  orderingEnabled?: boolean;
  /** Opens the published 3D model; the button shows only when the item has one. */
  onOpenAr?: (item: MenuItem) => void;
}

interface CompactSelectionControlProps {
  id?: string;
  type: "checkbox" | "radio";
  name?: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Radio only: a click on the already-selected option. Optional groups use it to clear their choice. */
  onReselect?: (() => void) | undefined;
}

function CompactSelectionControl({
  id,
  type,
  name,
  label,
  checked,
  disabled = false,
  onCheckedChange,
  onReselect,
}: CompactSelectionControlProps) {
  const [focusVisible, setFocusVisible] = useState(false);

  return (
    <span
      data-component="compact-selection-control"
      data-state={checked ? "checked" : "unchecked"}
      style={{
        position: "relative",
        width: 20,
        height: 20,
        display: "inline-grid",
        placeItems: "center",
        flexShrink: 0,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <input
        id={id}
        type={type}
        name={name}
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onCheckedChange(event.currentTarget.checked)}
        // A checked radio fires no change event when clicked again, so the clear happens here.
        onClick={type === "radio" && checked && onReselect ? onReselect : undefined}
        onFocus={(event) => setFocusVisible(event.currentTarget.matches(":focus-visible"))}
        onBlur={() => setFocusVisible(false)}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          margin: 0,
          opacity: 0,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      />
      <span
        aria-hidden="true"
        style={{
          width: 20,
          height: 20,
          boxSizing: "border-box",
          display: "grid",
          placeItems: "center",
          border: checked
            ? "1.5px solid var(--p-accent)"
            : "1.5px solid rgba(71,85,105,.58)",
          borderRadius: 6,
          background: checked ? "var(--p-accent)" : "var(--p-card)",
          color: "#fff",
          boxShadow: focusVisible ? "0 0 0 3px var(--p-accent-soft)" : "none",
          pointerEvents: "none",
          transition: "background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease",
        }}
      >
        {checked ? <I.check size={14} /> : null}
      </span>
    </span>
  );
}

function ReadOnlyModifierOption({ option }: { option: ModifierGroup["options"][number] }) {
  const priceDelta = option.price_delta !== 0
    ? `${option.price_delta > 0 ? "+" : ""}${formatTRY(option.price_delta)}`
    : null;
  const detail = [
    priceDelta,
    option.calorie_delta !== 0 ? `${option.calorie_delta > 0 ? "+" : ""}${option.calorie_delta} kcal` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div
      data-component="product-modal-readonly-option"
      style={{
        minHeight: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "5px 0",
      }}
    >
      <span style={{ minWidth: 0, display: "inline-flex", alignItems: "center", gap: 7 }}>
        <span style={{ color: "var(--p-text)", fontSize: 13 }}>{option.name}</span>
        {option.is_default ? (
          <small
            style={{
              flexShrink: 0,
              padding: "2px 6px",
              borderRadius: 999,
              background: "var(--p-accent-soft)",
              color: "var(--p-accent)",
              fontSize: 9.5,
              fontWeight: 800,
            }}
          >
            Standart
          </small>
        ) : null}
      </span>
      {detail ? <span style={{ flexShrink: 0, color: "var(--p-text-2)", fontSize: 12 }}>{detail}</span> : null}
    </div>
  );
}

function ComboContextSummary({ context }: { context: ProductModalComboContext }) {
  const { t } = useMenuLocale();
  const stateLabel = {
    current: t("Şimdi seçiliyor"),
    ready: t("Hazır"),
    included: "Komboya dahil",
    upcoming: t("Sırada"),
  } as const;

  return (
    <section
      aria-label={t("Kombo içeriği: {count} ürün birlikte eklenecek", { count: context.items.length })}
      style={{
        display: "grid",
        gap: 7,
        margin: "0 0 14px",
        padding: 10,
        border: "1px solid var(--p-border)",
        borderRadius: 12,
        background: "color-mix(in srgb, var(--p-card) 82%, var(--p-accent-soft))",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <strong style={{ color: "var(--p-text)", fontSize: 11.5, fontWeight: 850 }}>{t("Kombo içeriği")}</strong>
        <span style={{ color: "var(--p-text-2)", fontSize: 10.5, fontWeight: 700 }}>{t("{count} ürün birlikte", { count: context.items.length })}</span>
      </div>
      <div role="list" style={{ display: "grid", gap: 6 }}>
        {context.items.map((comboItem) => {
          const current = comboItem.state === "current";
          return (
            <div
              key={comboItem.id}
              role="listitem"
              aria-current={current ? "step" : undefined}
              style={{
                minWidth: 0,
                minHeight: 42,
                display: "grid",
                gridTemplateColumns: "34px minmax(0,1fr) max-content",
                alignItems: "center",
                gap: 8,
                padding: 5,
                border: current ? "1px solid var(--p-accent)" : "1px solid var(--p-border)",
                borderRadius: 9,
                background: current ? "var(--p-accent-soft)" : "var(--p-card)",
              }}
            >
              <span style={{ width: 34, height: 34, display: "grid", placeItems: "center", overflow: "hidden", borderRadius: 8, background: "var(--p-accent-soft)", color: "var(--p-accent)" }}>
                {comboItem.imageUrl
                  ? <img src={comboItem.imageUrl} alt="" style={{ width: "100%", height: "100%", display: "block", objectFit: "cover" }} />
                  : comboItem.state === "ready" || comboItem.state === "included" ? <I.check size={16} /> : <I.image size={16} />}
              </span>
              <strong style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--p-text)", fontSize: 11.5, fontWeight: 800 }}>
                {comboItem.name}
              </strong>
              <span style={{ color: current ? "var(--p-accent)" : "var(--p-text-2)", fontSize: 9.5, lineHeight: 1.2, fontWeight: 800, textAlign: "right" }}>
                {stateLabel[comboItem.state]}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function ProductModal({ item: sourceItem, onClose, onAddToCart, recommendationItems: sourceRecommendations = [], contextLabel, contextTitle, comboContext, promotionLabel, quantityStep = 1, lockQuantity = false, submitLabel, closeAfterAdd = true, stackLevel = 0, orderingEnabled = true, onOpenAr }: ProductModalProps) {
  const menuLocale = useMenuLocale();
  const { t } = menuLocale;
  const item = useMemo(() => sourceItem ? menuLocale.item(sourceItem) : null, [sourceItem, menuLocale]);
  const recommendationItems = useMemo(() => sourceRecommendations.map(menuLocale.item), [sourceRecommendations, menuLocale]);
  const { theme } = useTheme();
  const titleId = useId();
  const noteLabelId = useId();
  const noteHintId = useId();
  const noteCounterId = useId();
  const validationMessageId = useId();
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const configuringRecommendationRef = useRef<MenuItem | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const [selections, setSelections] = useState<Record<string, SelectedModifier[]>>({});
  const [removedIngredientIds, setRemovedIngredientIds] = useState<string[]>([]);
  const normalizedQuantityStep = Math.max(1, Math.min(99, Math.round(quantityStep) || 1));
  const maximumQuantity = Math.max(normalizedQuantityStep, Math.floor(99 / normalizedQuantityStep) * normalizedQuantityStep);
  const [quantity, setQuantity] = useState(normalizedQuantityStep);
  const [productNote, setProductNote] = useState("");
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [selectedRecommendations, setSelectedRecommendations] = useState<Record<string, ProductRecommendationSelection>>({});
  const [recommendationsExpanded, setRecommendationsExpanded] = useState(false);
  const [configuringRecommendation, setConfiguringRecommendation] = useState<MenuItem | null>(null);
  const configurableGroups = item?.modifier_groups.filter((group) => group.max > 0 && group.options.length > 0) ?? [];

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    configuringRecommendationRef.current = configuringRecommendation;
  }, [configuringRecommendation]);

  useEffect(() => {
    if (!sourceItem) return;
    setQuantity(normalizedQuantityStep);
    setRemovedIngredientIds([]);
    setProductNote("");
    setValidationAttempted(false);
    setSelectedRecommendations({});
    setRecommendationsExpanded(false);
    setConfiguringRecommendation(null);
    // Pre-select defaults
    const defaults: Record<string, SelectedModifier[]> = {};
    for (const group of sourceItem.modifier_groups.filter((candidate) => candidate.max > 0 && candidate.options.length > 0)) {
      const defaultOpts = group.options.filter((o) => o.is_default).map((o): SelectedModifier => ({ group_id: group.id, option_id: o.id }));
      if (defaultOpts.length > 0) defaults[group.id] = defaultOpts;
    }
    setSelections(defaults);
  }, [sourceItem, normalizedQuantityStep]);

  useEffect(() => {
    if (!item) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (configuringRecommendationRef.current) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(modalRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []);
      if (focusable.length === 0) {
        event.preventDefault();
        modalRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
    };
  }, [item?.id]);

  if (!item) return null;

  const arButton = item.ar && onOpenAr ? (
    <button
      type="button"
      data-component="product-modal-ar"
      onClick={() => onOpenAr(item)}
      style={{
        position: "absolute",
        left: 12,
        bottom: 12,
        minHeight: 36,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "0 14px",
        border: "1px solid var(--p-border)",
        borderRadius: 999,
        background: "color-mix(in srgb, var(--p-card) 92%, transparent)",
        color: "var(--p-text)",
        fontSize: 13,
        fontWeight: 800,
        cursor: "pointer",
        boxShadow: "0 2px 10px rgba(0,0,0,.12)",
      }}
    >
      <I.cube size={16} />
      {t("3D incele")}
    </button>
  ) : null;

  const allModifiers = Object.values(selections).flat();
  const isValid = areModifierSelectionsValid(item.modifier_groups, allModifiers);

  const modifierTotal = allModifiers.reduce((sum, sel) => {
    for (const group of configurableGroups) {
      const opt = group.options.find((o) => o.id === sel.option_id);
      if (opt) return sum + opt.price_delta * (sel.quantity ?? 1);
    }
    return sum;
  }, 0);
  const calorieDelta = allModifiers.reduce((sum, sel) => {
    for (const group of configurableGroups) {
      const opt = group.options.find((o) => o.id === sel.option_id);
      if (opt) return sum + opt.calorie_delta * (sel.quantity ?? 1);
    }
    return sum;
  }, 0);
  const selectedAllergens = new Set(getDefiniteAllergens(item));
  for (const group of configurableGroups) {
    for (const selection of selections[group.id] ?? []) {
      const option = group.options.find((candidate) => candidate.id === selection.option_id);
      for (const code of option?.allergen_codes ?? []) selectedAllergens.add(code);
    }
  }
  const energyKcal = item.energy_kcal === null ? null : Math.max(0, Math.round(item.energy_kcal + calorieDelta));
  const crossContactAllergens = item.may_contain_allergens.filter((code) => !selectedAllergens.has(code));

  const recommendationUnitTotal = Object.values(selectedRecommendations).reduce((sum, recommendation) => {
    const modifierDelta = recommendation.modifiers.reduce((total, selection) => {
      for (const group of recommendation.item.modifier_groups) {
        const option = group.options.find((candidate) => candidate.id === selection.option_id);
        if (option) return total + option.price_delta * (selection.quantity ?? 1);
      }
      return total;
    }, 0);
    return sum + recommendation.item.price + modifierDelta;
  }, 0);
  const totalPrice = (item.price + modifierTotal + recommendationUnitTotal) * quantity;

  const priceFormatted = formatTRY(totalPrice);
  const footerPriceFormatted = comboContext
    ? formatTRY(comboContext.baseTotal + modifierTotal)
    : priceFormatted;

  const clearGroupSelection = (group: ModifierGroup) => {
    setSelections((prev) => ({ ...prev, [group.id]: [] }));
  };

  const handleRadioChange = (group: ModifierGroup, optionId: string) => {
    setSelections((prev) => ({
      ...prev,
      [group.id]: [{ group_id: group.id, option_id: optionId }],
    }));
  };

  const handleCheckboxChange = (group: ModifierGroup, optionId: string, checked: boolean) => {
    setSelections((prev) => {
      const current = prev[group.id] ?? [];
      if (checked) {
        if (current.length >= group.max) return prev;
        return {
          ...prev,
          [group.id]: [...current, { group_id: group.id, option_id: optionId }],
        };
      }
      return {
        ...prev,
        [group.id]: current.filter((s) => s.option_id !== optionId),
      };
    });
  };

  const handleQuantityChange = (group: ModifierGroup, optionId: string, delta: number) => {
    setSelections((prev) => {
      const current = prev[group.id] ?? [];
      const existing = current.find((selection) => selection.option_id === optionId);
      const groupTotal = current.reduce((sum, selection) => sum + (selection.quantity ?? 1), 0);
      const nextQuantity = Math.max(0, (existing?.quantity ?? 0) + delta);
      if (delta > 0 && groupTotal >= group.max) return prev;
      const without = current.filter((selection) => selection.option_id !== optionId);
      return {
        ...prev,
        [group.id]:
          nextQuantity > 0
            ? [
                ...without,
                {
                  group_id: group.id,
                  option_id: optionId,
                  quantity: nextQuantity,
                },
              ]
            : without,
      };
    });
  };

  const handleAddToCart = () => {
    if (!orderingEnabled) return;
    if (!isValid) {
      setValidationAttempted(true);
      window.requestAnimationFrame(() => {
        const invalidGroup = modalRef.current?.querySelector<HTMLElement>('[data-modifier-invalid="true"]');
        invalidGroup?.scrollIntoView({
          behavior: prefersReducedMotion ? "auto" : "smooth",
          block: "center",
        });
        invalidGroup?.focus({ preventScroll: true });
      });
      return;
    }
    onAddToCart(item, allModifiers, quantity, removedIngredientIds, {
      ...(productNote.trim() ? { productNote: productNote.trim() } : {}),
      recommendations: Object.values(selectedRecommendations),
    });
    if (closeAfterAdd) onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 80 + stackLevel * 20,
          background: "rgba(15,23,42,.46)",
          backdropFilter: "blur(2px)",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
        onClick={configuringRecommendation ? undefined : onClose}
      />
      <motion.div
        key="modal"
        ref={modalRef}
        data-component="product-modal"
        data-ordering-enabled={orderingEnabled ? "true" : "false"}
        role="dialog"
        aria-modal={configuringRecommendation ? undefined : "true"}
        aria-hidden={configuringRecommendation ? true : undefined}
        aria-labelledby={titleId}
        inert={configuringRecommendation ? true : undefined}
        tabIndex={-1}
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 90 + stackLevel * 20,
          width: "100%",
          maxWidth: 720,
          margin: "0 auto",
          maxHeight: "90dvh",
          background: "var(--p-card)",
          color: "var(--p-text)",
          borderRadius: `${Math.max(theme.radius + 14, 24)}px ${Math.max(theme.radius + 14, 24)}px 0 0`,
          boxShadow: "0 -24px 70px rgba(15,23,42,.28)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid rgba(15,23,42,.08)",
          fontFamily: "var(--p-body)",
          lineHeight: "var(--p-line-body)",
        }}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", damping: 30, stiffness: 300 }}
      >
        <style>{`
          @media (min-width: 900px) {
            [data-component="product-modal"] {
              top: 50% !important;
              bottom: auto !important;
              translate: 0 -50%;
              width: calc(100% - 48px) !important;
              max-width: 960px !important;
              max-height: min(86dvh, 820px) !important;
              border-radius: ${Math.max(theme.radius + 14, 24)}px !important;
              box-shadow: 0 28px 90px rgba(15,23,42,.3) !important;
            }
            [data-component="product-modal-drag-handle"] { display: none !important; }
            [data-component="product-modal-header"] { padding: 12px 18px 12px 24px !important; }
            [data-component="product-modal-scroll"] { overflow: hidden !important; }
            [data-component="product-modal-layout"] {
              display: grid;
              grid-template-columns: minmax(0, 40%) minmax(0, 60%);
              height: 100%;
              min-height: 0;
            }
            [data-component="product-modal-summary"],
            [data-component="product-modal-configuration"] {
              min-width: 0;
              min-height: 0;
              overflow-y: auto;
              overscroll-behavior: contain;
              scrollbar-gutter: stable;
            }
            [data-component="product-modal-summary"] { background: var(--p-card); }
            [data-component="product-modal-configuration"] {
              border-left: 1px solid rgba(15,23,42,.08);
              background: color-mix(in srgb, var(--p-card) 97%, var(--p-accent-soft));
            }
            [data-component="product-modal-configuration"] > :first-child { border-top: 0 !important; }
            [data-component="product-modal-summary"] > [data-component="product-modal-media"] { height: 280px !important; }
            [data-component="product-modal-actions"] { padding: 16px 24px !important; }
          }
        `}</style>
        <div
          data-component="product-modal-drag-handle"
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "12px 0 6px",
          }}
        >
          <div
            style={{
              width: 42,
              height: 4,
              borderRadius: 999,
              background: "rgba(15,23,42,.16)",
            }}
          />
        </div>

        <div
          data-component="product-modal-header"
          style={{
            minHeight: 50,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "0 14px 8px 18px",
            borderBottom: "1px solid rgba(15,23,42,.08)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 850, color: "var(--p-text)" }}>{comboContext ? t("Kombo seçenekleri") : contextLabel === "Yanında iyi gider" ? t("Ek ürün seçenekleri") : t("Ürün detayları")}</div>
            {contextLabel === "Yanında iyi gider" && (
              <div
                style={{
                  marginTop: 2,
                  fontSize: 10.5,
                  color: "var(--p-text-2)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {item.name}
              </div>
            )}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={t("Ürün detayını kapat")}
            style={{
              width: 44,
              height: 44,
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: 0,
              borderRadius: 999,
              background: "var(--p-accent-soft)",
              color: "var(--p-text)",
              cursor: "pointer",
            }}
          >
            <I.close size={19} />
          </button>
        </div>

        <div
          data-component="product-modal-scroll"
          style={{
            overflowY: "auto",
            overscrollBehavior: "contain",
            WebkitOverflowScrolling: "touch",
            flex: 1,
            minHeight: 0,
          }}
        >
          <div data-component="product-modal-layout">
            <div data-component="product-modal-summary">
              {item.images[0] && (
                <div
                  data-component="product-modal-media"
                  style={{
                    position: "relative",
                    width: "100%",
                    height: 210,
                    overflow: "hidden",
                    background: "var(--p-accent-soft)",
                  }}
                >
                  <img
                    src={item.images[0]}
                    alt={item.name}
                    decoding="async"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                  {arButton}
                </div>
              )}
              {!item.images[0] && arButton && (
                <div style={{ position: "relative", height: 56 }}>{arButton}</div>
              )}

              <div style={{ padding: 18 }}>
                {contextLabel && (
                  <div
                    style={{
                      marginBottom: 5,
                      color: "var(--p-accent)",
                      fontSize: 11,
                      fontWeight: 850,
                      letterSpacing: ".06em",
                      textTransform: "uppercase",
                    }}
                  >
                    {contextLabel ? t(contextLabel) : null}
                  </div>
                )}
                {contextTitle && (
                  <div
                    style={{
                      marginBottom: 12,
                      color: "var(--p-text-2)",
                      fontSize: 13,
                      fontWeight: 650,
                    }}
                  >
                    {contextTitle ? t(contextTitle) : null}
                  </div>
                )}
                {comboContext ? <ComboContextSummary context={comboContext} /> : null}
                <h2
                  id={titleId}
                  style={{
                    margin: 0,
                    fontFamily: "var(--p-display)",
                    fontSize: 24,
                    lineHeight: 1.12,
                    fontWeight: 800,
                    color: "var(--p-text)",
                  }}
                >
                  {item.name}
                </h2>
                {(item.is_vegan || item.is_vegetarian || item.is_halal) && (
                  <div style={{ marginTop: 8 }}>
                    <DietaryBadges item={item} />
                  </div>
                )}
                {item.description && (
                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: 14,
                      lineHeight: 1.5,
                      color: "var(--p-text-2)",
                    }}
                  >
                    {item.description}
                  </p>
                )}
                {promotionLabel && normalizedQuantityStep > 1 ? (
                  <div
                    data-component="product-modal-promotion"
                    style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 7, marginTop: 10 }}
                  >
                    <span
                      style={{
                        display: "inline-flex", padding: "4px 8px", borderRadius: 999,
                        background: "var(--p-cta)", color: "var(--p-cta-text)",
                        fontSize: 11, fontWeight: 850, letterSpacing: ".02em",
                      }}
                    >
                      {promotionLabel ? t(promotionLabel) : null}
                    </span>
                    <strong style={{ fontSize: 18, fontWeight: 850, color: "var(--p-accent)" }}>
                      {normalizedQuantityStep} {t("adet")} {formatTRY(item.price * normalizedQuantityStep)}
                    </strong>
                  </div>
                ) : (
                  <p
                    style={{
                      margin: "10px 0 0",
                      fontSize: 20,
                      fontWeight: 850,
                      color: "var(--p-accent)",
                    }}
                  >
                    {formatTRY(item.price)}
                  </p>
                )}
                {energyKcal !== null && (
                  <span
                    style={{
                      display: "inline-flex",
                      marginTop: 10,
                      padding: "4px 8px",
                      borderRadius: 6,
                      background: "var(--p-accent-soft)",
                      color: "var(--p-accent)",
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    {energyKcal} kcal / porsiyon
                  </span>
                )}
              </div>

              {item.ingredients.length > 0 && (
                <div
                  style={{
                    borderTop: "1px solid rgba(15,23,42,.08)",
                    padding: "14px 18px",
                  }}
                >
                  <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 800 }}>{t("İçindekiler")}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {item.ingredients.map((ingredient) => (
                      <span
                        key={ingredient.id}
                        style={{
                          padding: "5px 8px",
                          borderRadius: 6,
                          background: ingredient.allergen_codes.length > 0 ? "#fff2df" : "var(--p-accent-soft)",
                          color: "var(--p-text)",
                          fontSize: 12,
                          fontWeight: ingredient.allergen_codes.length > 0 ? 800 : 600,
                        }}
                      >
                        {ingredient.name}
                        {ingredient.amount ? (
                          <span
                            style={{
                              marginLeft: 5,
                              color: "var(--p-text-2)",
                              fontWeight: 600,
                            }}
                          >
                            · {ingredient.amount}
                          </span>
                        ) : null}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div data-component="product-modal-configuration">
              {item.ingredients.some((ingredient) => ingredient.removable) && (
                <div
                  style={{
                    borderTop: "1px solid rgba(15,23,42,.08)",
                    padding: "14px 18px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      marginBottom: 6,
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>{t("Çıkarılabilir malzemeler")}</p>
                    <span
                      style={{
                        padding: "3px 7px",
                        borderRadius: 999,
                        background: "rgba(15,23,42,.06)",
                        color: "var(--p-text-2)",
                        fontSize: 10.5,
                        fontWeight: 750,
                      }}
                    >
                      {orderingEnabled ? t("İsteğe bağlı") : t("Bilgi")}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: "0 0 7px",
                      fontSize: 11.5,
                      color: "var(--p-text-2)",
                    }}
                  >
                    {orderingEnabled ? t("İstemediğin malzemeleri işaretle") : t("Ürün, aşağıdaki malzemeler çıkarılarak hazırlanabilir.")}
                  </p>
                  {item.ingredients
                    .filter((ingredient) => ingredient.removable)
                    .map((ingredient) => (
                      orderingEnabled ? (
                        <label
                          key={ingredient.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 9,
                            minHeight: 40,
                            padding: "6px 0",
                            fontSize: 13,
                            cursor: "pointer",
                          }}
                        >
                          <span>{t("{name} olmasın", { name: ingredient.name })}</span>
                          <CompactSelectionControl
                            type="checkbox"
                            label={t("{name} malzemesini çıkar", { name: ingredient.name })}
                            checked={removedIngredientIds.includes(ingredient.id)}
                            onCheckedChange={(checked) =>
                              setRemovedIngredientIds((current) =>
                                checked
                                  ? [...current, ingredient.id]
                                  : current.filter((id) => id !== ingredient.id),
                              )
                            }
                          />
                        </label>
                      ) : (
                        <div key={ingredient.id} data-component="product-modal-readonly-removable" style={{ minHeight: 36, display: "flex", alignItems: "center", padding: "4px 0", color: "var(--p-text)", fontSize: 13 }}>
                          {ingredient.name}
                        </div>
                      )
                    ))}
                </div>
              )}

              {(item.contains_alcohol || item.contains_pork) && (
                <div
                  data-component="special-content-warning"
                  style={{
                    borderTop: "1px solid rgba(15,23,42,.08)",
                    padding: "14px 18px",
                  }}
                >
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      background: "#fee2e2",
                      color: "#991b1b",
                    }}
                  >
                    <p
                      style={{
                        margin: "0 0 7px",
                        fontSize: 13,
                        fontWeight: 850,
                      }}
                    >
                      {t("Önemli içerik uyarısı")}</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {item.contains_alcohol && <span style={{ fontSize: 12, fontWeight: 800 }}>{t("Alkol içerir")}</span>}
                      {item.contains_alcohol && item.contains_pork && <span aria-hidden="true">·</span>}
                      {item.contains_pork && <span style={{ fontSize: 12, fontWeight: 800 }}>{t("Domuz kaynaklı bileşen içerir")}</span>}
                    </div>
                  </div>
                </div>
              )}

              {(selectedAllergens.size > 0 || item.allergen_note) && (
                <div
                  data-component="contains-allergens"
                  style={{
                    borderTop: "1px solid rgba(15,23,42,.08)",
                    padding: "14px 18px",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      fontWeight: 850,
                      color: "#7a4300",
                    }}
                  >
                    {t("Alerjenler · ürün içerir")}</p>
                  <p
                    style={{
                      margin: "4px 0 9px",
                      fontSize: 11.5,
                      lineHeight: 1.45,
                      color: "var(--p-text-2)",
                    }}
                  >
                    {item.allergen_note || t("Bu alerjenler ürünün bileşenlerinde bulunur.")}
                  </p>
                  {selectedAllergens.size > 0 && <AllergenIconList codes={selectedAllergens} showLabels size={17} />}
                </div>
              )}

              {(crossContactAllergens.length > 0 || item.cross_contact_note) && (
                <div
                  data-component="cross-contact-allergens"
                  style={{
                    borderTop: "1px solid rgba(15,23,42,.08)",
                    padding: "14px 18px",
                  }}
                >
                  <div
                    style={{
                      padding: 12,
                      border: "1px dashed rgba(71,85,105,.38)",
                      borderRadius: 8,
                      background: "rgba(241,245,249,.72)",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: 14,
                        fontWeight: 800,
                        color: "var(--p-text)",
                      }}
                    >
                      {t("Olası çapraz temas")}</p>
                    <p
                      style={{
                        margin: "4px 0 9px",
                        fontSize: 11.5,
                        lineHeight: 1.45,
                        color: "var(--p-text-2)",
                      }}
                    >
                      {item.cross_contact_note || t("Ürün eser miktarda aşağıdaki alerjenleri içerebilir.")}
                    </p>
                    {crossContactAllergens.length > 0 && <AllergenIconList codes={crossContactAllergens} showLabels variant="trace" size={17} />}
                  </div>
                </div>
              )}

              {removedIngredientIds.length > 0 && (selectedAllergens.size > 0 || crossContactAllergens.length > 0) && (
                <div style={{ padding: "0 18px 14px" }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 11.5,
                      lineHeight: 1.45,
                      color: "var(--p-text-2)",
                    }}
                  >
                    {t("Bir içeriğin çıkarılması ürünün alerjensiz olduğunu garanti etmez.")}</p>
                </div>
              )}

              {configurableGroups.map((group) => {
                const groupLabelId = `${titleId}-${group.id}-label`;
                const groupHintId = `${titleId}-${group.id}-hint`;
                const minimumSelections = getModifierGroupMinimum(group);
                const selectionCount = getModifierGroupSelectionCount(group, allModifiers);
                const groupIsValid = isModifierGroupSelectionValid(group, allModifiers);
                return (
                  <div
                    key={group.id}
                    role={orderingEnabled ? "group" : undefined}
                    data-modifier-invalid={orderingEnabled && validationAttempted && !groupIsValid ? "true" : "false"}
                    aria-labelledby={groupLabelId}
                    aria-describedby={groupHintId}
                    aria-required={orderingEnabled && minimumSelections > 0 ? true : undefined}
                    tabIndex={orderingEnabled ? -1 : undefined}
                    style={{
                      borderTop: "1px solid rgba(15,23,42,.08)",
                      padding: "14px 18px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        marginBottom: 8,
                      }}
                    >
                      <div>
                        <p
                          id={groupLabelId}
                          style={{
                            margin: 0,
                            fontSize: 14,
                            fontWeight: 800,
                            color: "var(--p-text)",
                          }}
                        >
                          {group.name}
                        </p>
                        <p
                          id={groupHintId}
                          style={{
                            margin: "3px 0 0",
                            fontSize: 10.5,
                            color: "var(--p-text-2)",
                          }}
                        >
                          {orderingEnabled
                            ? minimumSelections === group.max
                              ? t("{min} seçim yap", { min: minimumSelections })
                              : minimumSelections > 0
                                ? t("En az {min}, en fazla {max} seçim", { min: minimumSelections, max: group.max })
                                : t("En fazla {max} seçim", { max: group.max })
                            : t("Seçenekler ve fiyat farkları")}
                        </p>
                      </div>
                      {orderingEnabled && minimumSelections > 0 && (
                        <span
                          style={{
                            backgroundColor: "var(--p-accent)",
                            color: "#fff",
                            borderRadius: 999,
                            padding: "3px 8px",
                            fontSize: 11,
                            fontWeight: 800,
                          }}
                        >
                          {t("Zorunlu")}
                        </span>
                      )}
                    </div>

                    {group.options.map((opt) => {
                      if (!orderingEnabled) return <ReadOnlyModifierOption key={opt.id} option={opt} />;
                      const isSelected = (selections[group.id] ?? []).some((s) => s.option_id === opt.id);
                      const priceDeltaStr = opt.price_delta !== 0 ? (opt.price_delta > 0 ? "+" : "") + formatTRY(opt.price_delta) : null;
                      const optionQuantity = (selections[group.id] ?? []).find((selection) => selection.option_id === opt.id)?.quantity ?? 0;
                      const selectionLimitReached = group.selection_mode === "multiple" && !isSelected && selectionCount >= group.max;

                      return (
                        <div
                          key={opt.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            minHeight: 40,
                            padding: "5px 0",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              minWidth: 0,
                            }}
                          >
                            {group.selection_mode === "quantity" ? (
                              <>
                                <div
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 6,
                                  }}
                                >
                                  <button
                                    type="button"
                                    aria-label={t("{name} azalt", { name: opt.name })}
                                    disabled={optionQuantity <= 0}
                                    onClick={() => handleQuantityChange(group, opt.id, -1)}
                                    style={{
                                      width: 32,
                                      height: 32,
                                      display: "grid",
                                      placeItems: "center",
                                      padding: 0,
                                      border: "none",
                                      borderRadius: 8,
                                      background: "var(--p-accent-soft)",
                                      color: "var(--p-accent)",
                                      cursor: optionQuantity <= 0 ? "not-allowed" : "pointer",
                                      opacity: optionQuantity <= 0 ? 0.45 : 1,
                                    }}
                                  >
                                    <I.minus size={13} />
                                  </button>
                                  <span
                                    aria-live="polite"
                                    aria-label={`${opt.name} adedi`}
                                    style={{
                                      minWidth: 14,
                                      textAlign: "center",
                                      fontSize: 12,
                                      fontWeight: 800,
                                    }}
                                  >
                                    {optionQuantity}
                                  </span>
                                  <button
                                    type="button"
                                    aria-label={t("{name} artır", { name: opt.name })}
                                    disabled={selectionCount >= group.max}
                                    onClick={() => handleQuantityChange(group, opt.id, 1)}
                                    style={{
                                      width: 32,
                                      height: 32,
                                      display: "grid",
                                      placeItems: "center",
                                      padding: 0,
                                      border: "none",
                                      borderRadius: 8,
                                      background: "var(--p-accent)",
                                      color: "#fff",
                                      cursor: selectionCount >= group.max ? "not-allowed" : "pointer",
                                      opacity: selectionCount >= group.max ? 0.45 : 1,
                                    }}
                                  >
                                    <I.plus size={13} />
                                  </button>
                                </div>
                                <span
                                  style={{
                                    fontSize: 13,
                                    color: "var(--p-text)",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {opt.name}
                                </span>
                              </>
                            ) : (
                              <label
                                style={{
                                  minWidth: 0,
                                  minHeight: 32,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 9,
                                  cursor: selectionLimitReached ? "not-allowed" : "pointer",
                                }}
                              >
                                <CompactSelectionControl
                                  type={group.selection_mode === "single" ? "radio" : "checkbox"}
                                  name={`${titleId}-${group.id}`}
                                  label={opt.name}
                                  checked={isSelected}
                                  disabled={selectionLimitReached}
                                  onCheckedChange={(checked) => {
                                    if (group.selection_mode === "single") {
                                      if (checked) handleRadioChange(group, opt.id);
                                      return;
                                    }
                                    handleCheckboxChange(group, opt.id, checked);
                                  }}
                                  // Optional single-choice groups can be left empty again.
                                  onReselect={group.selection_mode === "single" && minimumSelections === 0 ? () => clearGroupSelection(group) : undefined}
                                />
                                <span
                                  style={{
                                    fontSize: 13,
                                    color: "var(--p-text)",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {opt.name}
                                </span>
                              </label>
                            )}
                          </div>
                          <span
                            style={{
                              fontSize: 12,
                              color: "var(--p-text-2)",
                              flexShrink: 0,
                            }}
                          >
                            {[priceDeltaStr, opt.calorie_delta !== 0 ? `${opt.calorie_delta > 0 ? "+" : ""}${opt.calorie_delta} kcal` : null].filter(Boolean).join(" · ")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {orderingEnabled && recommendationItems.length > 0 && (
                <div
                  data-component="product-recommendations"
                  style={{
                    borderTop: "1px solid rgba(15,23,42,.08)",
                    padding: "14px 18px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 10,
                      marginBottom: 8,
                    }}
                  >
                    <div>
                      <p
                        id={`${titleId}-recommendations`}
                        style={{
                          margin: 0,
                          fontSize: 14,
                          fontWeight: 800,
                          color: "var(--p-text)",
                        }}
                      >
                        {t("Yanında iyi gider")}</p>
                      <p
                        style={{
                          margin: "4px 0 0",
                          fontSize: 11.5,
                          color: "var(--p-text-2)",
                        }}
                      >
                        Genellikle birlikte tercih edilir
                      </p>
                    </div>
                    <span
                      style={{
                        padding: "4px 8px",
                        borderRadius: 999,
                        background: "rgba(15,23,42,.06)",
                        color: "var(--p-text-2)",
                        fontSize: 10.5,
                        fontWeight: 750,
                      }}
                    >
                      {t("İsteğe bağlı")}</span>
                  </div>
                  <div id={`${titleId}-recommendation-list`} role="group" aria-labelledby={`${titleId}-recommendations`} style={{ display: "grid", gap: 6 }}>
                    {(recommendationsExpanded ? recommendationItems : recommendationItems.slice(0, 3)).map((recommendation) => {
                      const selected = selectedRecommendations[recommendation.id];
                      const needsConfiguration = isProductConfigurable(recommendation);
                      const checkboxId = `${titleId}-recommendation-${recommendation.id}`;
                      return (
                        <div
                          key={recommendation.id}
                          style={{
                            minHeight: 52,
                            display: "grid",
                            gridTemplateColumns: recommendation.images[0] ? "48px minmax(0,1fr) auto" : "minmax(0,1fr) auto",
                            alignItems: "center",
                            gap: 9,
                          }}
                        >
                          {recommendation.images[0] ? (
                            <img
                              src={recommendation.images[0]}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              style={{
                                width: 48,
                                height: 48,
                                borderRadius: 9,
                                objectFit: "cover",
                              }}
                            />
                          ) : null}
                          <span style={{ minWidth: 0 }}>
                            <label htmlFor={checkboxId} style={{ display: "block", cursor: "pointer" }}>
                              <span
                                style={{
                                  display: "block",
                                  color: "var(--p-text)",
                                  fontSize: 13,
                                  fontWeight: 750,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {recommendation.name}
                              </span>
                              <span
                                style={{
                                  display: "block",
                                  marginTop: 2,
                                  color: "var(--p-accent)",
                                  fontSize: 12,
                                  fontWeight: 850,
                                }}
                              >
                                +{formatTRY(recommendation.price)}
                              </span>
                            </label>
                            {selected && needsConfiguration ? (
                              <button
                                type="button"
                                onClick={() => setConfiguringRecommendation(recommendation)}
                                style={{
                                  display: "block",
                                  minHeight: 30,
                                  marginTop: 1,
                                  padding: 0,
                                  border: 0,
                                  background: "transparent",
                                  color: "var(--p-accent)",
                                  fontSize: 10.5,
                                  fontWeight: 800,
                                  cursor: "pointer",
                                }}
                              >
                                {t("Seçenekleri düzenle")}</button>
                            ) : null}
                          </span>
                          <CompactSelectionControl
                            id={checkboxId}
                            type="checkbox"
                            label={
                              selected
                                ? t("{name} önerisini kaldır", { name: recommendation.name })
                                : needsConfiguration
                                  ? t("{name} ürününü yapılandır ve ekle", { name: recommendation.name })
                                  : t("{name} ürününü öneri olarak ekle", { name: recommendation.name })
                            }
                            checked={Boolean(selected)}
                            onCheckedChange={(checked) => {
                              if (!checked) {
                                setSelectedRecommendations((current) => {
                                  const next = { ...current };
                                  delete next[recommendation.id];
                                  return next;
                                });
                                return;
                              }
                              if (needsConfiguration) {
                                setConfiguringRecommendation(recommendation);
                                return;
                              }
                              setSelectedRecommendations((current) => ({
                                ...current,
                                [recommendation.id]: {
                                  item: recommendation,
                                  modifiers: [],
                                  removedIngredientIds: [],
                                },
                              }));
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  {recommendationItems.length > 3 && (
                    <button
                      type="button"
                      aria-expanded={recommendationsExpanded}
                      aria-controls={`${titleId}-recommendation-list`}
                      onClick={() => setRecommendationsExpanded((value) => !value)}
                      style={{
                        marginTop: 8,
                        minHeight: 44,
                        padding: 0,
                        border: 0,
                        background: "transparent",
                        color: "var(--p-text)",
                        fontSize: 12.5,
                        fontWeight: 800,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        cursor: "pointer",
                      }}
                    >
                      <I.chevDown
                        size={16}
                        style={{
                          transform: recommendationsExpanded ? "rotate(180deg)" : "none",
                          transition: "transform 150ms ease",
                        }}
                      />
                      {recommendationsExpanded ? t("Daha az göster") : t("{count} seçeneği daha gör", { count: recommendationItems.length - 3 })}
                    </button>
                  )}
                </div>
              )}

              {orderingEnabled && <div
                data-component="product-note"
                style={{
                  borderTop: "1px solid rgba(15,23,42,.08)",
                  padding: "20px 18px",
                }}
              >
                <p
                  id={noteLabelId}
                  style={{
                    margin: 0,
                    fontSize: 17,
                    fontWeight: 850,
                    color: "var(--p-text)",
                  }}
                >
                  {t("Ürün notu")}</p>
                <p
                  id={noteHintId}
                  style={{
                    margin: "5px 0 12px",
                    fontSize: 11.5,
                    lineHeight: 1.5,
                    color: "var(--p-text-2)",
                  }}
                >
                  {t("Hazırlama tercihini yazabilirsin. Alerji ve ciddi hassasiyetler için lütfen işletmeyle ayrıca görüş.")}</p>
                <textarea
                  value={productNote}
                  onChange={(event) => setProductNote(event.target.value.slice(0, 500))}
                  maxLength={500}
                  rows={4}
                  aria-labelledby={noteLabelId}
                  aria-describedby={`${noteHintId} ${noteCounterId}`}
                  placeholder={t("Örn. az pişmiş olsun")}
                  style={{
                    width: "100%",
                    minHeight: 94,
                    resize: "vertical",
                    boxSizing: "border-box",
                    padding: 12,
                    border: "1px solid rgba(15,23,42,.16)",
                    borderRadius: 13,
                    background: "var(--p-card)",
                    color: "var(--p-text)",
                    fontFamily: "var(--p-body)",
                    fontSize: 13,
                    lineHeight: 1.45,
                    outline: "none",
                  }}
                />
                <div
                  id={noteCounterId}
                  style={{
                    marginTop: 5,
                    textAlign: "right",
                    color: "var(--p-text-2)",
                    fontSize: 10.5,
                  }}
                >
                  {productNote.length}/500 karakter
                </div>
              </div>}
            </div>
          </div>
        </div>

        {orderingEnabled ? <div
          data-component="product-modal-actions"
          style={{
            flexShrink: 0,
            padding: "18px 18px max(18px, env(safe-area-inset-bottom))",
            borderTop: "1px solid rgba(15,23,42,.08)",
            background: "rgba(255,255,255,.96)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            {!lockQuantity ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(normalizedQuantityStep, q - normalizedQuantityStep))}
                  aria-label={t("Adedi azalt")}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 999,
                    border: "none",
                    background: "var(--p-accent-soft)",
                    color: "var(--p-accent)",
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                    padding: 0,
                    lineHeight: 0,
                  }}
                >
                  <I.minus size={17} />
                </button>
                <span
                  data-component="product-modal-quantity"
                  style={{
                    minWidth: 24,
                    textAlign: "center",
                    fontSize: 15,
                    fontWeight: 850,
                    color: "var(--p-text)",
                  }}
                >
                  {quantity}
                </span>
                <button
                  type="button"
                  disabled={quantity >= maximumQuantity}
                  onClick={() => setQuantity((q) => Math.min(maximumQuantity, q + normalizedQuantityStep))}
                  aria-label={t("Adedi artır")}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 999,
                    border: "none",
                    background: "var(--p-cta)",
                    color: "var(--p-cta-text)",
                    cursor: quantity >= maximumQuantity ? "not-allowed" : "pointer",
                    display: "grid",
                    placeItems: "center",
                    padding: 0,
                    lineHeight: 0,
                    opacity: quantity >= maximumQuantity ? 0.5 : 1,
                  }}
                >
                  <I.plus size={17} />
                </button>
              </div>
            ) : (
              <span
                style={{
                  fontSize: 13,
                  color: "var(--p-text-2)",
                  fontWeight: 700,
                }}
              >
                {comboContext ? t("{count} ürün birlikte", { count: comboContext.items.length }) : `${t(contextLabel === "Yanında iyi gider" ? "Ek ürün" : "Kombo ürünü")} · 1 ${t("adet")}`}
              </span>
            )}
            <span style={{ display: "grid", justifyItems: "end", gap: 1 }}>
              {comboContext ? <small style={{ color: "var(--p-text-2)", fontSize: 10.5, fontWeight: 700 }}>{t("Kombo toplamı")}</small> : null}
              <strong style={{ fontSize: 18, fontWeight: 850, color: "var(--p-text)" }}>{footerPriceFormatted}</strong>
            </span>
          </div>
          {validationAttempted && !isValid && (
            <p
              id={validationMessageId}
              role="alert"
              style={{
                margin: "0 0 10px",
                color: "#9a3412",
                fontSize: 12,
                fontWeight: 750,
              }}
            >
              {t("Sepete eklemek için zorunlu seçenekleri tamamlayın.")}</p>
          )}
          <button
            type="button"
            aria-describedby={validationAttempted && !isValid ? validationMessageId : undefined}
            aria-disabled={!isValid}
            onClick={handleAddToCart}
            style={{
              width: "100%",
              padding: "14px 0",
              border: "none",
              borderRadius: Math.max(theme.radius + 4, 16),
              backgroundColor: "var(--p-text)",
              color: "#fff",
              fontSize: 15,
              fontWeight: 850,
              cursor: "pointer",
              opacity: isValid ? 1 : 0.55,
              transition: "opacity 150ms ease",
            }}
          >
            {t(submitLabel ?? "Sepete ekle")}
          </button>
        </div> : (
          <div
            data-component="product-modal-view-only-notice"
            role="note"
            style={{
              minHeight: 52,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "10px 18px max(10px, env(safe-area-inset-bottom))",
              borderTop: "1px solid rgba(15,23,42,.08)",
              background: "color-mix(in srgb, var(--p-card) 92%, var(--p-accent-soft))",
              color: "var(--p-text-2)",
              fontSize: 12,
              fontWeight: 750,
              textAlign: "center",
            }}
          >
            <I.eye size={16} aria-hidden="true" />
            {t("Bu menü yalnızca görüntüleme amaçlıdır.")}</div>
        )}
      </motion.div>
      {configuringRecommendation && (
        <ProductModal
          item={configuringRecommendation}
          recommendationItems={[]}
          stackLevel={stackLevel + 1}
          lockQuantity
          contextLabel="Yanında iyi gider"
          contextTitle={`${item.name} ile birlikte eklenecek`}
          submitLabel="Seçimi kaydet"
          onClose={() => setConfiguringRecommendation(null)}
          onAddToCart={(configuredItem, modifiers, _configuredQuantity, removedIds, options) => {
            setSelectedRecommendations((current) => ({
              ...current,
              [configuredItem.id]: {
                item: configuredItem,
                modifiers,
                removedIngredientIds: removedIds,
                ...(options?.productNote ? { productNote: options.productNote } : {}),
              },
            }));
            setConfiguringRecommendation(null);
          }}
        />
      )}
    </AnimatePresence>
  );
}
