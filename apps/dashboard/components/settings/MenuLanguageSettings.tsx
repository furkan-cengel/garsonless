"use client";

import { useCallback, useEffect, useState } from "react";
import {
  translationFieldStatus,
  type TranslationMode,
  type TranslationSnapshot,
} from "@garsonless/domain/menu-translation";
import { menuTranslationAction } from "../../lib/actions/menu-translation";
import { translationErrorText } from "../../lib/menu-translation-errors";
import { Alert, AlertDescription } from "../ui/alert";
import { Field, FieldContent, FieldDescription, FieldLabel } from "../ui/field";
import { Skeleton } from "../ui/skeleton";
import { Switch } from "../ui/switch";

/**
 * Settings → Diller: one switch for the guest-facing English menu. Translating
 * happens in each product's panel; this only shows coverage and lets the owner
 * open English once every visible text is published.
 */
export default function MenuLanguageSettings({ restaurantId }: { restaurantId: string }) {
  const [snapshot, setSnapshot] = useState<TranslationSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async (mode: TranslationMode) => {
      const result = await menuTranslationAction({
        restaurantId,
        mode,
        ...(mode === "snapshot" ? {} : { requestId: crypto.randomUUID() }),
      });
      if (!result.ok) {
        setError(translationErrorText(result.error));
        return;
      }
      setError(null);
      setSnapshot(result.data);
    },
    [restaurantId],
  );

  useEffect(() => {
    void run("snapshot").catch(() => setError(translationErrorText("unavailable")));
  }, [run]);

  if (!snapshot && !error) return <Skeleton className="h-24 w-full max-w-xl" />;
  if (!snapshot) return <Alert variant="destructive" className="max-w-xl"><AlertDescription>{error}</AlertDescription></Alert>;

  const live = snapshot.fields.filter((field) => translationFieldStatus(field) === "published");
  const missing = snapshot.fields.filter((field) => translationFieldStatus(field) !== "published");
  // Field labels are the product or category names; list each once.
  const missingNames = [...new Set(missing.map((field) => field.label))];
  const complete = snapshot.fields.length > 0 && missing.length === 0;
  const canToggle = snapshot.allowed && snapshot.owner && !busy && (snapshot.enabled || complete);

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <Field orientation="horizontal" className="items-center rounded-lg border bg-card p-4">
        <FieldContent>
          <FieldLabel htmlFor="menu-english-enabled" className="text-sm font-medium">İngilizce menü</FieldLabel>
          <FieldDescription className="text-xs">
            {!snapshot.allowed
              ? "Menü çevirisi Pro, Pro denemesi ve Business paketlerinde kullanılabilir."
              : snapshot.enabled
                ? "Açık. Misafirler QR menüde Türkçe ve İngilizce arasında seçim yapabilir."
                : complete
                  ? "Bütün metinlerin İngilizcesi yayında. Açtığında misafirler İngilizce menüyü görür."
                  : "Kapalı. Açmak için menüdeki bütün metinlerin İngilizcesi yayında olmalı."}
          </FieldDescription>
        </FieldContent>
        <Switch
          id="menu-english-enabled"
          checked={snapshot.enabled}
          disabled={!canToggle}
          aria-describedby="menu-english-coverage"
          onCheckedChange={(checked) => {
            setBusy(true);
            void run(checked ? "enable" : "disable").finally(() => setBusy(false));
          }}
        />
      </Field>
      {snapshot.allowed && !snapshot.owner && (
        <FieldDescription className="text-xs">İngilizce menüyü yalnız işletme sahibi açıp kapatabilir.</FieldDescription>
      )}
      {snapshot.allowed && (
        <div id="menu-english-coverage" className="flex flex-col gap-1.5 text-sm">
          <span>
            <strong className="tabular-nums">{live.length}/{snapshot.fields.length}</strong> metnin İngilizcesi yayında
          </span>
          {missingNames.length > 0 && (
            <span className="text-xs text-muted-foreground">
              Çevrilecek: {missingNames.slice(0, 8).join(", ")}
              {missingNames.length > 8 ? ` ve ${missingNames.length - 8} kayıt daha` : ""}. Ürünü açıp
              Temel sekmesindeki <strong>İngilizceye çevir</strong> düğmesini kullan.
            </span>
          )}
        </div>
      )}
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    </div>
  );
}
