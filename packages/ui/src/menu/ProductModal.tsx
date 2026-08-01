"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { MenuItem, ModifierGroup, SelectedModifier } from "./types";
import { formatTRY } from "./formatCurrency";
import { useTheme } from "./ThemeContext";
import { AllergenIconList, DietaryBadges, getDefiniteAllergens } from "./FoodInfoBadges";
import { isProductConfigurable } from "./productConfiguration";
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

interface ProductModalProps {
  item: MenuItem | null;
  onClose: () => void;
  onAddToCart: (item: MenuItem, modifiers: SelectedModifier[], quantity: number, removedIngredientIds: string[], options?: ProductModalSubmitOptions) => void;
  recommendationItems?: MenuItem[];
  contextLabel?: string;
  contextTitle?: string;
  lockQuantity?: boolean;
  submitLabel?: string;
  closeAfterAdd?: boolean;
  stackLevel?: number;
}

export function ProductModal({ item, onClose, onAddToCart, recommendationItems = [], contextLabel, contextTitle, lockQuantity = false, submitLabel, closeAfterAdd = true, stackLevel = 0 }: ProductModalProps) {
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
  const [quantity, setQuantity] = useState(1);
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
    if (!item) return;
    setQuantity(1);
    setRemovedIngredientIds([]);
    setProductNote("");
    setValidationAttempted(false);
    setSelectedRecommendations({});
    setRecommendationsExpanded(false);
    setConfiguringRecommendation(null);
    // Pre-select defaults
    const defaults: Record<string, SelectedModifier[]> = {};
    for (const group of item.modifier_groups.filter((candidate) => candidate.max > 0 && candidate.options.length > 0)) {
      const defaultOpts = group.options.filter((o) => o.is_default).map((o): SelectedModifier => ({ group_id: group.id, option_id: o.id }));
      if (defaultOpts.length > 0) defaults[group.id] = defaultOpts;
    }
    setSelections(defaults);
  }, [item]);

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

  const isValid = configurableGroups.every((group) => {
    const count = (selections[group.id] ?? []).reduce((sum, selection) => sum + (group.selection_mode === "quantity" ? (selection.quantity ?? 1) : 1), 0);
    return count >= group.min && count <= group.max;
  });

  const allModifiers = Object.values(selections).flat();

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
            <div style={{ fontSize: 15, fontWeight: 850, color: "var(--p-text)" }}>{contextLabel === "Yanında iyi gider" ? "Ek ürün seçenekleri" : "Ürün detayları"}</div>
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
            aria-label="Ürün detayını kapat"
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
                </div>
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
                    {contextLabel}
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
                    {contextTitle}
                  </div>
                )}
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
                  <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 800 }}>İçindekiler</p>
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
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Çıkarılabilir malzemeler</p>
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
                      İsteğe bağlı
                    </span>
                  </div>
                  <p
                    style={{
                      margin: "0 0 7px",
                      fontSize: 11.5,
                      color: "var(--p-text-2)",
                    }}
                  >
                    İstemediğin malzemeleri işaretle
                  </p>
                  {item.ingredients
                    .filter((ingredient) => ingredient.removable)
                    .map((ingredient) => (
                      <label
                        key={ingredient.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                          padding: "10px 0",
                          fontSize: 14,
                          cursor: "pointer",
                        }}
                      >
                        <span>{ingredient.name} olmasın</span>
                        <input type="checkbox" checked={removedIngredientIds.includes(ingredient.id)} onChange={(event) => setRemovedIngredientIds((current) => (event.target.checked ? [...current, ingredient.id] : current.filter((id) => id !== ingredient.id)))} style={{ accentColor: "var(--p-accent)" }} />
                      </label>
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
                      Önemli içerik uyarısı
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {item.contains_alcohol && <span style={{ fontSize: 12, fontWeight: 800 }}>Alkol içerir</span>}
                      {item.contains_alcohol && item.contains_pork && <span aria-hidden="true">·</span>}
                      {item.contains_pork && <span style={{ fontSize: 12, fontWeight: 800 }}>Domuz kaynaklı bileşen içerir</span>}
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
                    Alerjenler · ürün içerir
                  </p>
                  <p
                    style={{
                      margin: "4px 0 9px",
                      fontSize: 11.5,
                      lineHeight: 1.45,
                      color: "var(--p-text-2)",
                    }}
                  >
                    {item.allergen_note || "Bu alerjenler ürünün bileşenlerinde bulunur."}
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
                      Olası çapraz temas
                    </p>
                    <p
                      style={{
                        margin: "4px 0 9px",
                        fontSize: 11.5,
                        lineHeight: 1.45,
                        color: "var(--p-text-2)",
                      }}
                    >
                      {item.cross_contact_note || "Ürün eser miktarda aşağıdaki alerjenleri içerebilir."}
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
                    Bir içeriğin çıkarılması ürünün alerjensiz olduğunu garanti etmez.
                  </p>
                </div>
              )}

              {configurableGroups.map((group) => {
                const groupLabelId = `${titleId}-${group.id}-label`;
                const groupHintId = `${titleId}-${group.id}-hint`;
                return (
                  <div
                    key={group.id}
                    role="group"
                    data-modifier-invalid={
                      validationAttempted &&
                      (() => {
                        const count = (selections[group.id] ?? []).reduce((sum, selection) => sum + (group.selection_mode === "quantity" ? (selection.quantity ?? 1) : 1), 0);
                        return count < group.min || count > group.max;
                      })()
                        ? "true"
                        : "false"
                    }
                    aria-labelledby={groupLabelId}
                    aria-describedby={groupHintId}
                    aria-required={group.min > 0}
                    tabIndex={-1}
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
                          {group.min === group.max ? `${group.min} seçim yap` : group.min > 0 ? `En az ${group.min}, en fazla ${group.max} seçim` : `En fazla ${group.max} seçim`}
                        </p>
                      </div>
                      {group.required && (
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
                          Zorunlu
                        </span>
                      )}
                    </div>

                    {group.options.map((opt) => {
                      const isSelected = (selections[group.id] ?? []).some((s) => s.option_id === opt.id);
                      const priceDeltaStr = opt.price_delta !== 0 ? (opt.price_delta > 0 ? "+" : "") + formatTRY(opt.price_delta) : null;

                      return (
                        <div
                          key={opt.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            padding: "9px 0",
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
                              <div
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 7,
                                }}
                              >
                                <button
                                  type="button"
                                  aria-label={`${opt.name} azalt`}
                                  onClick={() => handleQuantityChange(group, opt.id, -1)}
                                  style={{
                                    width: 44,
                                    height: 44,
                                    border: "none",
                                    borderRadius: 8,
                                    background: "var(--p-accent-soft)",
                                    color: "var(--p-accent)",
                                    cursor: "pointer",
                                  }}
                                >
                                  <I.minus size={14} />
                                </button>
                                <span
                                  aria-live="polite"
                                  aria-label={`${opt.name} adedi`}
                                  style={{
                                    minWidth: 16,
                                    textAlign: "center",
                                    fontSize: 12,
                                    fontWeight: 800,
                                  }}
                                >
                                  {(selections[group.id] ?? []).find((selection) => selection.option_id === opt.id)?.quantity ?? 0}
                                </span>
                                <button
                                  type="button"
                                  aria-label={`${opt.name} artır`}
                                  onClick={() => handleQuantityChange(group, opt.id, 1)}
                                  style={{
                                    width: 44,
                                    height: 44,
                                    border: "none",
                                    borderRadius: 8,
                                    background: "var(--p-accent)",
                                    color: "#fff",
                                    cursor: "pointer",
                                  }}
                                >
                                  <I.plus size={14} />
                                </button>
                              </div>
                            ) : (
                              <input
                                type={group.selection_mode === "single" ? "radio" : "checkbox"}
                                name={group.id}
                                aria-label={opt.name}
                                checked={isSelected}
                                onChange={(e) => {
                                  if (group.selection_mode === "single") handleRadioChange(group, opt.id);
                                  else handleCheckboxChange(group, opt.id, e.target.checked);
                                }}
                                style={{
                                  width: 24,
                                  height: 24,
                                  accentColor: "var(--p-accent)",
                                  flexShrink: 0,
                                }}
                              />
                            )}
                            <span
                              style={{
                                fontSize: 14,
                                color: "var(--p-text)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {opt.name}
                            </span>
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

              {recommendationItems.length > 0 && (
                <div
                  data-component="product-recommendations"
                  style={{
                    borderTop: "1px solid rgba(15,23,42,.08)",
                    padding: "20px 18px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 12,
                      marginBottom: 13,
                    }}
                  >
                    <div>
                      <p
                        id={`${titleId}-recommendations`}
                        style={{
                          margin: 0,
                          fontSize: 17,
                          fontWeight: 850,
                          color: "var(--p-text)",
                        }}
                      >
                        Yanında iyi gider
                      </p>
                      <p
                        style={{
                          margin: "4px 0 0",
                          fontSize: 12,
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
                      İsteğe bağlı
                    </span>
                  </div>
                  <div id={`${titleId}-recommendation-list`} role="group" aria-labelledby={`${titleId}-recommendations`} style={{ display: "grid", gap: 9 }}>
                    {(recommendationsExpanded ? recommendationItems : recommendationItems.slice(0, 3)).map((recommendation) => {
                      const selected = selectedRecommendations[recommendation.id];
                      const needsConfiguration = isProductConfigurable(recommendation);
                      const checkboxId = `${titleId}-recommendation-${recommendation.id}`;
                      return (
                        <div
                          key={recommendation.id}
                          style={{
                            minHeight: 62,
                            display: "grid",
                            gridTemplateColumns: recommendation.images[0] ? "54px minmax(0,1fr) auto" : "minmax(0,1fr) auto",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          {recommendation.images[0] ? (
                            <img
                              src={recommendation.images[0]}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              style={{
                                width: 54,
                                height: 54,
                                borderRadius: 11,
                                objectFit: "cover",
                              }}
                            />
                          ) : null}
                          <span style={{ minWidth: 0 }}>
                            {needsConfiguration ? (
                              <span style={{ display: "block" }}>
                                <span
                                  style={{
                                    display: "block",
                                    color: "var(--p-text)",
                                    fontSize: 13.5,
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
                                    marginTop: 4,
                                    color: "var(--p-accent)",
                                    fontSize: 12.5,
                                    fontWeight: 850,
                                  }}
                                >
                                  +{formatTRY(recommendation.price)}
                                </span>
                              </span>
                            ) : (
                              <label htmlFor={checkboxId} style={{ display: "block", cursor: "pointer" }}>
                                <span
                                  style={{
                                    display: "block",
                                    color: "var(--p-text)",
                                    fontSize: 13.5,
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
                                    marginTop: 4,
                                    color: "var(--p-accent)",
                                    fontSize: 12.5,
                                    fontWeight: 850,
                                  }}
                                >
                                  +{formatTRY(recommendation.price)}
                                </span>
                              </label>
                            )}
                            {selected && needsConfiguration ? (
                              <button
                                type="button"
                                onClick={() => setConfiguringRecommendation(recommendation)}
                                style={{
                                  display: "block",
                                  minHeight: 44,
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
                                Seçenekleri düzenle
                              </button>
                            ) : null}
                          </span>
                          {needsConfiguration ? (
                            <button
                              type="button"
                              aria-label={selected ? `${recommendation.name} önerisini kaldır` : `${recommendation.name} ürününü yapılandır ve ekle`}
                              aria-pressed={Boolean(selected)}
                              onClick={() => {
                                if (selected) {
                                  setSelectedRecommendations((current) => {
                                    const next = { ...current };
                                    delete next[recommendation.id];
                                    return next;
                                  });
                                  return;
                                }
                                setConfiguringRecommendation(recommendation);
                              }}
                              style={{
                                width: 44,
                                height: 44,
                                display: "inline-grid",
                                placeItems: "center",
                                border: "1.5px solid var(--p-text-2)",
                                borderRadius: 10,
                                background: selected ? "var(--p-accent)" : "transparent",
                                color: selected ? "#fff" : "transparent",
                                cursor: "pointer",
                              }}
                            >
                              {selected ? <I.check size={20} aria-hidden="true" /> : null}
                            </button>
                          ) : (
                            <input
                              id={checkboxId}
                              type="checkbox"
                              aria-label={`${recommendation.name} ürününü öneri olarak ekle`}
                              checked={Boolean(selected)}
                              onChange={(event) => {
                                if (!event.target.checked) {
                                  setSelectedRecommendations((current) => {
                                    const next = { ...current };
                                    delete next[recommendation.id];
                                    return next;
                                  });
                                  return;
                                }
                                setSelectedRecommendations((current) => {
                                  return {
                                    ...current,
                                    [recommendation.id]: {
                                      item: recommendation,
                                      modifiers: [],
                                      removedIngredientIds: [],
                                    },
                                  };
                                });
                              }}
                              style={{
                                width: 24,
                                height: 24,
                                accentColor: "var(--p-accent)",
                              }}
                            />
                          )}
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
                      {recommendationsExpanded ? "Daha az göster" : `${recommendationItems.length - 3} seçeneği daha gör`}
                    </button>
                  )}
                </div>
              )}

              <div
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
                  Ürün notu
                </p>
                <p
                  id={noteHintId}
                  style={{
                    margin: "5px 0 12px",
                    fontSize: 11.5,
                    lineHeight: 1.5,
                    color: "var(--p-text-2)",
                  }}
                >
                  Hazırlama tercihini yazabilirsin. Alerji ve ciddi hassasiyetler için lütfen işletmeyle ayrıca görüş.
                </p>
                <textarea
                  value={productNote}
                  onChange={(event) => setProductNote(event.target.value.slice(0, 500))}
                  maxLength={500}
                  rows={4}
                  aria-labelledby={noteLabelId}
                  aria-describedby={`${noteHintId} ${noteCounterId}`}
                  placeholder="Örn. az pişmiş olsun"
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
              </div>
            </div>
          </div>
        </div>

        <div
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
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Adedi azalt"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 999,
                    border: "none",
                    background: "var(--p-accent-soft)",
                    color: "var(--p-accent)",
                    fontSize: 18,
                    fontWeight: 850,
                    cursor: "pointer",
                  }}
                >
                  <I.minus size={17} />
                </button>
                <span
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
                  disabled={quantity >= 99}
                  onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                  aria-label="Adedi artır"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 999,
                    border: "none",
                    background: "var(--p-cta)",
                    color: "var(--p-cta-text)",
                    fontSize: 18,
                    fontWeight: 850,
                    cursor: quantity >= 99 ? "not-allowed" : "pointer",
                    opacity: quantity >= 99 ? 0.5 : 1,
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
                {contextLabel === "Yanında iyi gider" ? "Ek ürün" : "Kombo ürünü"} · 1 adet
              </span>
            )}
            <span style={{ fontSize: 18, fontWeight: 850, color: "var(--p-text)" }}>{priceFormatted}</span>
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
              Sepete eklemek için zorunlu seçenekleri tamamlayın.
            </p>
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
              opacity: isValid ? 1 : 0.72,
              transition: "opacity 150ms ease",
            }}
          >
            {submitLabel ?? "Sepete ekle"}
          </button>
        </div>
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
