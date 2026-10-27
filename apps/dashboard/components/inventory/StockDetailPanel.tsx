"use client";
import { Badge } from "@/components/ui/badge";
import { I } from "../../lib/ui";
import { Button } from "@/components/ui/button";
import { amount, kinds, unitCost } from "./inventory-controls";
import { formatStock, priceChangePercent, STOCK_STATUS_LABEL } from "./inventory-model";
import { STATUS_BADGE, type StockView } from "./stock-view";

const DAY_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

/** The selected stock: level, pace, where it is used, last purchase and recent movements. */
export default function StockDetailPanel({
  view,
  today,
  isOwner,
  busy,
  onReceive,
  onWaste,
  onAdjust,
  onEdit,
  onClose,
}: {
  view: StockView;
  today: string | undefined;
  isOwner: boolean;
  busy: boolean;
  onReceive: () => void;
  onWaste: () => void;
  onAdjust: () => void;
  onEdit: () => void;
  onClose?: () => void;
}) {
  const { item, insight } = view;
  const daily = (insight?.daily ?? []).map((value) => Math.max(0, Number(value) || 0));
  const peak = Math.max(...daily, 0);
  const days = daily.map((_, index) => {
    if (!today) return "";
    const date = new Date(`${today}T12:00:00`);
    date.setDate(date.getDate() - (daily.length - 1 - index));
    return DAY_LABELS[(date.getDay() + 6) % 7]!;
  });
  const last = insight?.lastReceipt ?? null;
  const change = priceChangePercent(last?.cost, insight?.previousReceiptCost);
  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Badge variant={STATUS_BADGE[view.status]}>{STOCK_STATUS_LABEL[view.status]}</Badge>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">{item.name}</h2>
          <p className="text-xs text-muted-foreground">{[kinds[item.kind], item.category, item.shelf].filter(Boolean).join(" · ")}</p>
        </div>
        {onClose && <Button variant="ghost" size="icon-sm" aria-label="Stok kartını kapat" onClick={onClose}><I.close size={14} /></Button>}
      </header>

      <div className="flex flex-col gap-2 rounded-xl border bg-muted/30 p-3">
        <div className="flex items-baseline gap-2">
          <strong className={`flex-1 text-2xl font-semibold tabular-nums ${view.quantity < 0 ? "text-destructive" : ""}`}>{formatStock(view.quantity, item.unit)}</strong>
          <span className="text-xs text-muted-foreground">Eşik {formatStock(view.threshold, item.unit)}</span>
        </div>
        <p className="text-sm">
          {view.quantity <= 0
            ? "Stok bitti; satışlar eksiye yazılıyor."
            : view.dailyUse > 0
              ? `Günde ortalama ${formatStock(view.dailyUse, item.unit)} gidiyor; ${view.cover.toLocaleLowerCase("tr-TR")} yeter.`
              : "Son 7 günde tüketim yok."}
        </p>
        {daily.length > 0 && (
          <>
            <div role="img" aria-label={`Son 7 günün günlük tüketimi: ${daily.map((value, index) => `${days[index]} ${formatStock(value, item.unit)}`).join(", ")}`} className="flex h-14 items-end gap-1">
              {daily.map((value, index) => (
                <span key={index} className={`flex-1 rounded-t ${index === daily.length - 1 ? "bg-foreground/50" : "bg-foreground/20"}`} style={{ height: `${peak ? Math.max(4, (value / peak) * 100) : 4}%` }} />
              ))}
            </div>
            <div aria-hidden="true" className="flex gap-1 text-[10px] text-muted-foreground">
              {days.map((day, index) => <span key={index} className="flex-1 text-center">{day}</span>)}
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Button disabled={busy} onClick={onReceive}>Mal kabul</Button>
        <Button variant="outline" disabled={busy} onClick={onWaste}>Fire</Button>
        {isOwner ? <Button variant="outline" disabled={busy} onClick={onAdjust}>Düzelt</Button> : <Button variant="outline" disabled={busy} onClick={onEdit}>Kartı düzenle</Button>}
      </div>
      {isOwner && <Button variant="link" size="sm" className="-mt-2 h-auto self-start px-0" onClick={onEdit}>Kartı düzenle (ad, eşik, raf, birimler)</Button>}

      <section aria-labelledby="stock-used-heading" className="flex flex-col gap-1.5">
        <h3 id="stock-used-heading" className="text-sm font-semibold">Kullanıldığı ürünler · {view.usedIn.length}</h3>
        {view.usedIn.length === 0 ? (
          <p className="text-xs text-muted-foreground">Hiçbir reçetede yok; satışlar bu stoğu düşürmez.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {view.usedIn.map((use) => (
              <span key={use.name} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs">
                {use.name}<span className="font-mono text-muted-foreground">{amount(use.quantity)} {item.unit}</span>
              </span>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="stock-purchase-heading" className="flex flex-col gap-1 rounded-xl border p-3">
        <h3 id="stock-purchase-heading" className="text-sm font-semibold">Son alım</h3>
        {last ? (
          <>
            <span className="text-sm">{new Date(last.at).toLocaleDateString("tr-TR", { day: "numeric", month: "long" })} · {formatStock(Number(last.quantity), item.unit)} · {unitCost(last.cost, item.unit)}</span>
            {change !== null && Math.abs(change) >= 3 && (
              <span className={`mt-1 self-start rounded-md px-2 py-0.5 text-xs font-medium ${change > 0 ? "bg-[var(--warning-bg)] text-[var(--warning)]" : "bg-[var(--positive-bg)] text-[var(--positive)]"}`}>
                Fiyat bir önceki alıma göre {change > 0 ? "+" : "−"}%{Math.abs(change)}
              </span>
            )}
          </>
        ) : (
          <span className="text-xs text-muted-foreground">Henüz mal kabul kaydı yok. Kayıtlı birim maliyet: {unitCost(item.cost, item.unit)}</span>
        )}
      </section>

      <section aria-labelledby="stock-moves-heading" className="flex flex-col">
        <h3 id="stock-moves-heading" className="mb-1 text-sm font-semibold">Son hareketler</h3>
        {(insight?.recent ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">Hareket yok.</p>
        ) : insight!.recent.map((move, index) => {
          const quantity = Number(move.quantity);
          return (
            <div key={index} className="flex items-center gap-3 border-b py-1.5 text-sm last:border-b-0">
              <span className="w-16 shrink-0 text-xs text-muted-foreground">{new Date(move.at).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}</span>
              <span className="min-w-0 flex-1 truncate">{kinds[move.kind] ?? move.kind}{move.reason ? ` · ${move.reason}` : ""}{move.actor && move.kind !== "sale" ? ` · ${move.actor}` : ""}</span>
              <strong className={`font-mono text-xs ${quantity < 0 ? (move.kind === "waste" ? "text-destructive" : "text-muted-foreground") : "text-[var(--positive)]"}`}>{quantity > 0 ? "+" : ""}{formatStock(quantity, item.unit)}</strong>
            </div>
          );
        })}
      </section>
    </div>
  );
}
