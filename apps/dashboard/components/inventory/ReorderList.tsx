"use client";
import { useState } from "react";
import type { InventorySnapshot } from "@garsonless/domain/inventory";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { money } from "./inventory-controls";
import { formatStock, orderUnitOf, reorderMessage, suggestOrder, unitLabel } from "./inventory-model";
import type { StockView } from "./stock-view";

const NO_SUPPLIER = "Tedarikçi atanmamış";

/** Stock below its threshold, grouped by supplier, with a ready order message. */
export default function ReorderList({
  data,
  views,
  restaurantName,
  busy,
  onMarkSent,
  onEditCard,
}: {
  data: InventorySnapshot;
  views: StockView[];
  restaurantName: string;
  busy: boolean;
  onMarkSent: (supplier: string, sent: boolean, lines: Array<{ itemId: string; quantity: number; unit: string }>) => void;
  onEditCard: (itemId: string) => void;
}) {
  const due = views.filter((view) => view.status !== "ok");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [excluded, setExcluded] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const groups = [...new Set(due.map((view) => view.item.supplier?.trim() || NO_SUPPLIER))].sort((a, b) => (a === NO_SUPPLIER ? 1 : b === NO_SUPPLIER ? -1 : a.localeCompare(b, "tr")));
  const [preview, setPreview] = useState<string | null>(groups.find((g) => g !== NO_SUPPLIER) ?? null);

  const linesOf = (supplier: string) => due.filter((view) => (view.item.supplier?.trim() || NO_SUPPLIER) === supplier).map((view) => {
    const order = orderUnitOf(view.item);
    const suggested = suggestOrder(view.quantity, view.threshold, view.dailyUse, order.factor);
    const quantity = quantities[view.item.id] ?? suggested;
    const lastCost = Number(view.insight?.lastReceipt?.cost ?? view.item.cost ?? NaN);
    return { view, order, suggested, quantity, on: !excluded[view.item.id], cost: Number.isFinite(lastCost) ? quantity * order.factor * lastCost : null };
  });

  if (due.length === 0) {
    return <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">Eşiğin altında stok yok; sipariş listesi boş.</p>;
  }
  const previewLines = preview ? linesOf(preview).filter((line) => line.on) : [];
  const message = previewLines.length ? reorderMessage(restaurantName, previewLines.map((line) => ({ name: line.view.item.name, quantity: line.quantity, unit: line.order.unit }))) : "";
  const total = groups.flatMap(linesOf).filter((line) => line.on).reduce((sum, line) => sum + (line.cost ?? 0), 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">Eşiğin altına düşen stoklar tedarikçiye göre gruplanır. Önerilen miktar 4 günlük tüketim artı eşik kadardır.</p>
        <span className="text-xs text-muted-foreground">{groups.flatMap(linesOf).filter((l) => l.on).length} kalem · tahmini {money(total)}</span>
      </div>
      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-3">
          {groups.map((supplier) => {
            const lines = linesOf(supplier);
            const sum = lines.filter((l) => l.on).reduce((acc, l) => acc + (l.cost ?? 0), 0);
            const mark = data.reorders?.find((r) => r.supplier === supplier);
            // A receipt after the mark means the goods arrived; the mark no longer applies.
            const arrived = mark && lines.some((l) => l.view.insight?.lastReceipt && l.view.insight.lastReceipt.at > mark.sentAt);
            const sent = Boolean(mark && !arrived);
            const named = supplier !== NO_SUPPLIER;
            return (
              <section key={supplier} aria-label={supplier} className={`overflow-hidden rounded-xl border bg-card ${preview === supplier ? "ring-2 ring-foreground" : ""}`}>
                <header className="flex flex-wrap items-center gap-2 border-b p-3">
                  <div className="min-w-0 flex-[1_1_200px]">
                    <h3 className="text-sm font-semibold">{supplier}</h3>
                    <span className="text-xs text-muted-foreground">{lines.length} kalem · tahmini {money(sum)}</span>
                  </div>
                  {sent && <Badge variant="positive">Gönderildi · {new Date(mark!.sentAt).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</Badge>}
                  {named ? (
                    <>
                      <Button size="sm" variant="outline" aria-pressed={preview === supplier} onClick={() => setPreview(supplier)}>Mesajı gör</Button>
                      <Button size="sm" variant={sent ? "outline" : "default"} disabled={busy} onClick={() => onMarkSent(supplier, !sent, lines.filter((l) => l.on).map((l) => ({ itemId: l.view.item.id, quantity: l.quantity, unit: l.order.unit })))}>
                        {sent ? "İşareti kaldır" : "Gönderildi işaretle"}
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">Stok kartlarına tedarikçi yazınca burada gruplanır.</span>
                  )}
                </header>
                {lines.map((line) => (
                  <div key={line.view.item.id} className={`flex flex-wrap items-center gap-3 border-t p-3 first:border-t-0 ${line.on ? "" : "opacity-50"}`}>
                    <Checkbox checked={line.on} aria-label={`${line.view.item.name} siparişe dahil`} onCheckedChange={(checked) => setExcluded((e) => ({ ...e, [line.view.item.id]: checked !== true }))} />
                    <span className="min-w-0 flex-[1_1_180px]">
                      <strong className="block text-sm font-medium">{line.view.item.name}</strong>
                      <span className={`text-xs ${line.view.status === "ok" || line.view.status === "low" ? "text-muted-foreground" : "text-destructive"}`}>
                        Elde {formatStock(line.view.quantity, line.view.item.unit)} · {line.view.cover === "Bitti" ? "bitti" : `${line.view.cover.toLocaleLowerCase("tr-TR")} yeter`} · öneri {line.suggested} {unitLabel(line.order.unit)}
                      </span>
                      {!named && <Button variant="link" size="sm" className="h-auto px-0 text-xs" onClick={() => onEditCard(line.view.item.id)}>Tedarikçi ekle</Button>}
                    </span>
                    <span className="flex items-center gap-1">
                      <Button size="icon-sm" variant="outline" aria-label={`${line.view.item.name} azalt`} onClick={() => setQuantities((q) => ({ ...q, [line.view.item.id]: Math.max(1, line.quantity - 1) }))}>−</Button>
                      <strong className="min-w-24 text-center font-mono text-sm">{line.quantity} {unitLabel(line.order.unit)}</strong>
                      <Button size="icon-sm" variant="outline" aria-label={`${line.view.item.name} artır`} onClick={() => setQuantities((q) => ({ ...q, [line.view.item.id]: line.quantity + 1 }))}>+</Button>
                    </span>
                    <span className="w-24 text-right font-mono text-xs text-muted-foreground">{line.cost === null ? "Fiyat yok" : money(line.cost)}</span>
                  </div>
                ))}
              </section>
            );
          })}
        </div>
        <aside className="flex flex-col gap-2 rounded-xl border bg-card p-3 lg:sticky lg:top-0">
          <h3 className="text-sm font-semibold">{preview ? `${preview} için mesaj` : "Mesaj"}</h3>
          <pre className="whitespace-pre-wrap rounded-lg bg-muted p-3 font-sans text-sm leading-relaxed">{message || "Mesajını görmek için bir tedarikçi seç."}</pre>
          {message && (
            <Button variant="outline" size="sm" onClick={() => { void navigator.clipboard?.writeText(message).then(() => setCopied(preview)).catch(() => setCopied(null)); }}>
              {copied === preview ? "Kopyalandı" : "Mesajı kopyala"}
            </Button>
          )}
          <span role="status" className="sr-only">{copied === preview ? "Mesaj panoya kopyalandı." : ""}</span>
          <p className="text-xs text-muted-foreground">WhatsApp ya da e-postayla gönderebilirsin. Tahmini tutar son alış fiyatlarından.</p>
        </aside>
      </div>
    </div>
  );
}
