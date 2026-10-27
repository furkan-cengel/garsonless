"use client";
import { useState } from "react";
import { convertInventoryQuantity, type StockItem } from "@garsonless/domain/inventory";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { money } from "./inventory-controls";
import { entryUnits, formatStock, unitLabel } from "./inventory-model";

const REASONS = ["Bozuldu", "Döküldü / düştü", "Son kullanma geçti", "Hatalı hazırlık"];

/** Records waste in three choices: what, how much, why. Shows the stock and money effect first. */
export default function WasteDialog({
  items,
  initialItemId,
  busy,
  error,
  onClose,
  onSave,
}: {
  items: StockItem[];
  initialItemId?: string;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const active = items.filter((item) => !item.archived);
  const [itemId, setItemId] = useState(initialItemId ?? active[0]?.id ?? "");
  const item = active.find((stock) => stock.id === itemId);
  const [unit, setUnit] = useState(item?.unit ?? "");
  const [amountText, setAmountText] = useState("");
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const quantity = item && amountText ? convertInventoryQuantity(amountText, unit || item.unit, item) : null;
  const blocked = !item ? "Stok seçin." : !amountText ? "Miktar girin." : quantity === null || Number(quantity) <= 0 ? "Miktarı bu birimle yazılabilecek bir sayı olarak girin." : !reason ? "Bir neden seçin." : null;
  const current = Number(item?.quantity ?? 0);
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fire kaydet</DialogTitle>
          <DialogDescription>Bozulan, dökülen veya atılan malzeme stoktan düşer ve fire raporuna girer.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (blocked || !item || !quantity) return;
            onSave({ reason: note.trim() ? `${reason} · ${note.trim()}` : reason, lines: [{ itemId: item.id, quantity, cost: null }] });
          }}
        >
          <Field>
            <FieldLabel htmlFor="waste-item">Stok</FieldLabel>
            <NativeSelect id="waste-item" className="w-full" value={itemId} onChange={(e) => { setItemId(e.target.value); setUnit(active.find((s) => s.id === e.target.value)?.unit ?? ""); }}>
              {active.map((stock) => <NativeSelectOption key={stock.id} value={stock.id}>{stock.name}</NativeSelectOption>)}
            </NativeSelect>
          </Field>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <Field>
              <FieldLabel htmlFor="waste-amount">Miktar</FieldLabel>
              <Input id="waste-amount" inputMode="decimal" value={amountText} placeholder="0" onChange={(e) => setAmountText(e.target.value.replace(/[^\d.,]/g, ""))} />
            </Field>
            <Field>
              <FieldLabel htmlFor="waste-unit">Birim</FieldLabel>
              <NativeSelect id="waste-unit" value={unit} onChange={(e) => setUnit(e.target.value)} disabled={!item}>
                {item && entryUnits(item).map((entry) => <NativeSelectOption key={entry.unit} value={entry.unit}>{unitLabel(entry.unit)}</NativeSelectOption>)}
              </NativeSelect>
            </Field>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Neden</legend>
            <div className="flex flex-wrap gap-1.5">
              {REASONS.map((label) => (
                <Button key={label} type="button" size="sm" variant={reason === label ? "default" : "outline"} aria-pressed={reason === label} onClick={() => setReason(label)}>{label}</Button>
              ))}
            </div>
            <Input aria-label="Not (isteğe bağlı)" placeholder="Not (isteğe bağlı)" value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} />
          </fieldset>
          <p role="status" className="rounded-lg bg-muted px-3 py-2 text-sm">
            {item && quantity !== null && Number(quantity) > 0
              ? `${item.name}: ${formatStock(current, item.unit)} → ${formatStock(current - Number(quantity), item.unit)}${item.cost !== null ? ` · yaklaşık ${money(Number(quantity) * Number(item.cost))} fire` : " · maliyet bilinmiyor"}`
              : "Miktar girince stok etkisi burada görünür."}
          </p>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex items-center justify-end gap-2">
            {blocked && <span id="waste-blocked" className="mr-auto text-xs text-muted-foreground">{blocked}</span>}
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Vazgeç</Button>
            <Button type="submit" disabled={busy || Boolean(blocked)} aria-describedby={blocked ? "waste-blocked" : undefined}>{busy && <Spinner data-icon="inline-start" />}Fireyi kaydet</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
