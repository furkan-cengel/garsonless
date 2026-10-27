"use client";
import { useState } from "react";
import { convertInventoryQuantity, type InventorySnapshot } from "@garsonless/domain/inventory";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { I } from "../../lib/ui";
import { amount, money } from "./inventory-controls";
import { baseUnitCost, entryUnits, formatStock, orderUnitOf, priceChangePercent, suggestOrder, unitLabel } from "./inventory-model";
import { buildStockViews } from "./stock-view";

type Line = { key: number; itemId: string; amount: string; unit: string; price: string };

/** Goods in, typed the way the invoice reads: the unit it came in and its price. */
export default function ReceiveDialog({
  data,
  initialItemId,
  busy,
  error,
  onClose,
  onSave,
  onUndo,
}: {
  data: InventorySnapshot;
  initialItemId?: string;
  busy: boolean;
  error: string;
  onClose: () => void;
  /** Resolves the receipt's document id once recorded, or null. */
  onSave: (payload: Record<string, unknown>) => Promise<string | null>;
  /** Undoes the receipt just recorded; resolves true when it was undone. */
  onUndo: (documentId: string) => Promise<boolean>;
}) {
  const stock = data.items.filter((item) => !item.archived);
  const insights = new Map(data.insights?.items.map((entry) => [entry.itemId, entry]));
  const newLine = (key: number, itemId = ""): Line => {
    const item = stock.find((s) => s.id === itemId);
    // Offer the larger purchase unit first (kg, L or a pack) because invoices use it.
    const units = item ? entryUnits(item) : [];
    return { key, itemId, amount: "", unit: units[1]?.unit ?? units[0]?.unit ?? "", price: "" };
  };
  const [lines, setLines] = useState<Line[]>([newLine(1, initialItemId)]);
  const [note, setNote] = useState("");
  const [done, setDone] = useState<{ count: number; total: number; documentId: string; undone: boolean } | null>(null);
  const views = buildStockViews(data);
  const suppliers = [...new Set(stock.map((item) => item.supplier?.trim() ?? "").filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr"));
  const [supplier, setSupplier] = useState<string | null>(null);
  // Picking a supplier fills in what is due from it, in its order unit at the last price.
  const pickSupplier = (name: string) => {
    setSupplier(name);
    if (!note.trim() || suppliers.includes(note.trim())) setNote(name);
    const due = views.filter((view) => view.item.supplier?.trim() === name && view.status !== "ok");
    if (!due.length) return;
    setLines(due.map((view, index) => {
      const order = orderUnitOf(view.item);
      const lastCost = Number(view.insight?.lastReceipt?.cost ?? view.item.cost ?? NaN);
      return {
        key: Date.now() + index,
        itemId: view.item.id,
        amount: String(suggestOrder(view.quantity, view.threshold, view.dailyUse, order.factor)),
        unit: order.unit,
        price: Number.isFinite(lastCost) ? String(Number((lastCost * order.factor).toFixed(2))).replace(".", ",") : "",
      };
    }));
  };
  const patch = (key: number, change: Partial<Line>) => setLines((rows) => rows.map((row) => (row.key === key ? { ...row, ...change } : row)));

  const computed = lines.map((line) => {
    const item = stock.find((s) => s.id === line.itemId);
    const quantity = item && line.amount ? convertInventoryQuantity(line.amount, line.unit || item.unit, item) : null;
    const cost = item && line.price ? baseUnitCost(line.price, line.unit || item.unit, item) : null;
    const total = quantity !== null && cost !== null ? Number(quantity) * Number(cost) : null;
    const change = item ? priceChangePercent(cost, insights.get(item.id)?.lastReceipt?.cost) : null;
    return { line, item, quantity, cost, total, change };
  });
  const filled = computed.filter((c) => c.item && c.quantity !== null && Number(c.quantity) > 0);
  const duplicate = lines.find((line, index) => line.itemId && lines.findIndex((other) => other.itemId === line.itemId) !== index);
  const badLine = computed.findIndex((c) => c.line.itemId && c.line.amount && (c.quantity === null || (c.line.price && c.cost === null)));
  const blocked = duplicate
    ? `${stock.find((s) => s.id === duplicate.itemId)?.name}: iki satırda var; tek satırda toplayın.`
    : badLine >= 0
      ? `${badLine + 1}. satır: miktarı ve fiyatı sayı olarak girin.`
      : filled.length === 0
        ? "En az bir stok ve miktar girin."
        : null;
  const invoiceTotal = filled.reduce((sum, c) => sum + (c.total ?? 0), 0);
  const missingPrice = filled.some((c) => c.cost === null);

  async function save() {
    if (blocked) return;
    const documentId = await onSave({
      reason: note.trim() || "Mal kabul",
      lines: filled.map((c) => ({ itemId: c.item!.id, quantity: c.quantity, cost: c.cost })),
    });
    if (documentId) setDone({ count: filled.length, total: invoiceTotal, documentId, undone: false });
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="max-h-[92dvh] gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>Mal kabul</DialogTitle>
          <DialogDescription>Gelen malzemeyi faturadaki birim ve fiyatla gir; stok temel birime kendisi çevirir.</DialogDescription>
        </DialogHeader>
        {done ? (
          <div role="status" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <span aria-hidden="true" className="grid size-12 place-items-center rounded-full bg-[var(--positive-bg)] text-[var(--positive)]"><I.check size={24} /></span>
            <h3 className="text-lg font-semibold">{done.undone ? "Mal kabul geri alındı" : `${supplier ? `${supplier} · ` : ""}${done.count} kalem stoğa eklendi${done.total ? ` · ${money(done.total)}` : ""}`}</h3>
            <p className="max-w-sm text-sm text-muted-foreground">{done.undone ? "Stoklar mal kabulden önceki miktarlara döndü; iki belge de hareketlerde görünür." : "Stoklar ve son alım fiyatları güncellendi. 30 dakika içinde geri alabilirsin."}</p>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {!done.undone && <Button variant="outline" disabled={busy} onClick={() => { void onUndo(done.documentId).then((ok) => { if (ok) setDone({ ...done, undone: true }); }); }}>Geri al</Button>}
              <Button variant="outline" onClick={() => { setDone(null); setLines([newLine(Date.now())]); setNote(""); setSupplier(null); }}>Yeni mal kabul</Button>
              <Button onClick={onClose}>Stoğa dön</Button>
            </div>
          </div>
        ) : (
          <div className="grid max-h-[calc(92dvh-5rem)] min-h-0 md:grid-cols-[minmax(0,1fr)_320px]">
            <section className="flex min-h-0 flex-col gap-3 overflow-y-auto p-5">
              {suppliers.length > 0 && (
                <div role="group" aria-label="Tedarikçi" className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-xs font-medium">Tedarikçi</span>
                  {suppliers.map((name) => (
                    <Button key={name} type="button" size="xs" className="rounded-full" variant={supplier === name ? "default" : "outline"} aria-pressed={supplier === name} onClick={() => pickSupplier(name)}>{name}</Button>
                  ))}
                </div>
              )}
              <Field>
                <FieldLabel htmlFor="receive-note">Tedarikçi / fatura notu</FieldLabel>
                <Input id="receive-note" value={note} maxLength={120} placeholder="Örn. Kurukahveci Toptan · Fatura 2026-1182" onChange={(e) => setNote(e.target.value)} />
              </Field>
              <div aria-hidden="true" className="hidden grid-cols-[minmax(0,1.4fr)_90px_minmax(0,1fr)_110px_96px_32px] gap-2 px-1 text-xs font-medium text-muted-foreground md:grid">
                <span>Stok</span><span>Miktar</span><span>Birim</span><span>Birim fiyat</span><span className="text-right">Tutar</span><span />
              </div>
              {computed.map(({ line, item, quantity, cost, total, change }, index) => {
                const units = item ? entryUnits(item) : [];
                return (
                  <div key={line.key} className="flex flex-col gap-1 rounded-lg border p-2 md:border-0 md:p-1">
                    <div className="grid grid-cols-2 items-center gap-2 md:grid-cols-[minmax(0,1.4fr)_90px_minmax(0,1fr)_110px_96px_32px]">
                      <NativeSelect aria-label={`${index + 1}. satır stok`} className="col-span-2 w-full md:col-span-1" value={line.itemId} onChange={(e) => {
                        const next = stock.find((s) => s.id === e.target.value);
                        const nextUnits = next ? entryUnits(next) : [];
                        patch(line.key, { itemId: e.target.value, unit: nextUnits[1]?.unit ?? nextUnits[0]?.unit ?? "" });
                      }}>
                        <NativeSelectOption value="">Stok seçin</NativeSelectOption>
                        {stock.map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>)}
                      </NativeSelect>
                      <Input aria-label={`${item?.name ?? `${index + 1}. satır`} miktarı`} inputMode="decimal" placeholder="0" value={line.amount} onChange={(e) => patch(line.key, { amount: e.target.value.replace(/[^\d.,]/g, "") })} />
                      <NativeSelect aria-label={`${item?.name ?? `${index + 1}. satır`} birimi`} className="w-full" value={line.unit} disabled={!item} onChange={(e) => patch(line.key, { unit: e.target.value })}>
                        {units.map((u) => <NativeSelectOption key={u.unit} value={u.unit}>{u.unit === item?.unit ? u.unit : `${unitLabel(u.unit)} (${u.factor.toLocaleString("tr-TR")} ${item?.unit})`}</NativeSelectOption>)}
                      </NativeSelect>
                      <Input aria-label={`${item?.name ?? `${index + 1}. satır`} birim fiyatı (TL / ${unitLabel(line.unit) || "birim"})`} inputMode="decimal" placeholder={`TL / ${unitLabel(line.unit) || "birim"}`} value={line.price} className={change !== null && change > 3 ? "border-[var(--warning)]" : undefined} onChange={(e) => patch(line.key, { price: e.target.value.replace(/[^\d.,]/g, "") })} />
                      <strong className="text-right font-mono text-sm tabular-nums">{total !== null ? money(total) : "—"}</strong>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={`${item?.name ?? `${index + 1}. satır`} satırını kaldır`} disabled={lines.length === 1} onClick={() => setLines((rows) => rows.filter((row) => row.key !== line.key))}><I.close size={14} /></Button>
                    </div>
                    <span className={`px-1 text-xs ${change !== null && change > 3 ? "text-[var(--warning)]" : "text-muted-foreground"}`}>
                      {item && quantity !== null
                        ? `${line.unit !== item.unit ? `${line.amount} ${unitLabel(line.unit)} = ${amount(quantity)} ${item.unit}` : formatStock(Number(quantity), item.unit)}${cost !== null ? ` · ${new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 4 }).format(Number(cost))} / ${item.unit}` : " · fiyat girilmedi, maliyet değişmez"}${change !== null && Math.abs(change) >= 3 ? ` · fiyat son alıma göre ${change > 0 ? "+" : "−"}%${Math.abs(change)}` : ""}`
                        : item ? "Miktar gir" : ""}
                    </span>
                  </div>
                );
              })}
              <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setLines((rows) => [...rows, newLine(Date.now())])}>Satır ekle</Button>
            </section>
            <aside aria-label="Stok etkisi" className="flex min-h-0 flex-col border-t bg-muted/30 md:border-t-0 md:border-l">
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4">
                <h3 className="text-sm font-semibold">Kaydedince ne olur?</h3>
                {filled.length === 0 && <p className="text-xs text-muted-foreground">Satır girdikçe stokların yeni miktarı burada görünür.</p>}
                {filled.map(({ item, quantity }) => {
                  const before = Number(item!.quantity);
                  const after = before + Number(quantity);
                  const threshold = Number(item!.threshold);
                  return (
                    <div key={item!.id} className="rounded-lg border bg-card p-2.5">
                      <strong className="block text-sm">{item!.name}</strong>
                      <span className="block font-mono text-xs">{formatStock(before, item!.unit)} → {formatStock(after, item!.unit)}</span>
                      <span className={`text-xs ${after > threshold ? "text-[var(--positive)]" : "text-[var(--warning)]"}`}>{after > threshold ? "Eşiğin üstüne çıkar" : `Hâlâ eşiğin altında (${formatStock(threshold, item!.unit)})`}</span>
                    </div>
                  );
                })}
              </div>
              <footer className="flex flex-col gap-2 border-t p-4">
                <div className="flex justify-between text-sm"><span>Fatura toplamı</span><strong className="font-mono tabular-nums">{money(invoiceTotal)}</strong></div>
                {missingPrice && <p className="text-xs text-muted-foreground">Fiyatı boş satırların maliyeti değişmez.</p>}
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                {blocked && <p id="receive-blocked" className="text-xs text-muted-foreground">{blocked}</p>}
                <Button disabled={busy || Boolean(blocked)} aria-describedby={blocked ? "receive-blocked" : undefined} onClick={() => { void save(); }}>
                  {busy && <Spinner data-icon="inline-start" />}{filled.length ? `${filled.length} kalemi stoğa ekle` : "Miktar gir"}
                </Button>
              </footer>
            </aside>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
