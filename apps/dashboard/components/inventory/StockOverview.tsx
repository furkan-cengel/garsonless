"use client";
import { useState } from "react";
import type { InventorySnapshot } from "@garsonless/domain/inventory";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { money } from "./inventory-controls";
import { foodCostPercent, formatStock, STOCK_STATUS_LABEL, STOCK_STATUS_ORDER, type StockStatus } from "./inventory-model";
import { STATUS_BADGE, STATUS_BAR, type StockView } from "./stock-view";

type Filter = "all" | StockStatus;
const FILTERS: Array<[Filter, string]> = [["all", "Tümü"], ["negative", "Eksi"], ["critical", "Kritik"], ["low", "Azalıyor"], ["ok", "Yeterli"]];

/** Figures, the "look at these today" list and the stock list of the overview. */
export default function StockOverview({
  data,
  views,
  selectedId,
  untrackedCount,
  isOwner,
  busy,
  onSelect,
  onCount,
  onAddCard,
  onImport,
  onOtherOperation,
  onRecipes,
  onReorder,
  canManageMenu,
  onSoldOut,
}: {
  data: InventorySnapshot;
  views: StockView[];
  selectedId: string | null;
  untrackedCount: number;
  isOwner: boolean;
  busy: boolean;
  onSelect: (id: string) => void;
  onCount: (id?: string) => void;
  onAddCard: () => void;
  onImport: () => void;
  onOtherOperation: () => void;
  onRecipes: () => void;
  onReorder: () => void;
  /** Owners and members with menu access may take linked products off sale. */
  canManageMenu: boolean;
  onSoldOut: (menuItemIds: string[], offSale: boolean, names: string[]) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const counts = { all: views.length, negative: 0, critical: 0, low: 0, ok: 0 } as Record<Filter, number>;
  for (const view of views) counts[view.status] += 1;
  const stockValue = views.reduce((sum, view) => sum + (view.value ?? 0), 0);
  const missingCost = views.filter((view) => view.value === null).length;
  const waste = data.insights?.waste;
  const foodCost = data.insights?.foodCost;
  const foodPercent = foodCostPercent(foodCost?.consumption, foodCost?.revenue);
  const offSale = new Set(data.insights?.unavailableMenuItems ?? []);
  const attention = views.filter((view) => view.status !== "ok").sort((a, b) => STOCK_STATUS_ORDER[a.status] - STOCK_STATUS_ORDER[b.status]);
  const needle = query.trim().toLocaleLowerCase("tr-TR");
  const rows = views
    .filter((view) => filter === "all" || view.status === filter)
    .filter((view) => !needle || `${view.item.name} ${view.item.category} ${view.item.shelf}`.toLocaleLowerCase("tr-TR").includes(needle))
    .sort((a, b) => STOCK_STATUS_ORDER[a.status] - STOCK_STATUS_ORDER[b.status] || a.item.name.localeCompare(b.item.name, "tr"));

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Figure label="Stok değeri" value={money(stockValue)} note={missingCost ? `${missingCost} kartta maliyet eksik; hesaba katılmadı.` : "Tüm kartlarda maliyet var."} />
        <Figure
          label="Bu hafta fire"
          value={waste ? money(Number(waste.thisWeek)) : "—"}
          note={waste ? `Son 7 gün · önceki 7 gün ${money(Number(waste.lastWeek))}${waste.missingCost ? " · bazı firelerde maliyet yok" : ""}` : "Hesaplanamadı."}
        />
        <Figure
          label="Gıda maliyeti"
          value={foodPercent === null ? "—" : `%${foodPercent}`}
          note={foodPercent === null
            ? "Son 7 günde tahsil edilen ciro yok."
            : `Son 7 gün · ciro ${money(Number(foodCost!.revenue))}${foodCost!.missingCost ? " · maliyeti eksik stoklar hariç" : ""}`}
        />
        <Figure
          label="Reçetesiz ürün"
          value={String(untrackedCount)}
          note={untrackedCount ? "Bu ürünler satıldığında stok düşmez." : "Tüm menü ürünlerinde reçete var."}
          action={untrackedCount ? <Button variant="link" size="sm" className="h-auto px-0" onClick={onRecipes}>Reçetelere git</Button> : null}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bugün ilgilen</CardTitle>
          <CardDescription>Stok bitse de satış durmaz; bu yüzden önce bunlara bak.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {attention.length === 0 ? (
            <p className="text-sm text-muted-foreground">Bugün ilgilenmen gereken stok yok.</p>
          ) : attention.map((view) => (
            <div key={view.item.id} className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border p-3 ${view.status === "negative" ? "border-destructive/40 bg-destructive/5" : ""}`}>
              <Badge variant={STATUS_BADGE[view.status]}>{STOCK_STATUS_LABEL[view.status]}</Badge>
              <button type="button" className="min-w-0 flex-[1_1_220px] text-left" onClick={() => onSelect(view.item.id)}>
                <span className="block font-medium">{view.item.name} · {formatStock(view.quantity, view.item.unit)}</span>
                <span className="block text-xs text-muted-foreground">
                  {view.status === "negative"
                    ? "Sistem eksi gösteriyor: mal kabul girilmemiş ya da reçete fazla düşüyor. Sayımla düzelt."
                    : `Bugünkü tempoyla ${view.cover.toLocaleLowerCase("tr-TR")} yeter${view.usedIn.length ? ` · ${view.usedIn.length} üründe kullanılıyor` : ""}`}
                </span>
              </button>
              {canManageMenu && (view.status === "negative" || view.status === "critical") && (() => {
                const linked = view.usedIn.filter((use) => use.menuItemId);
                if (!linked.length) return null;
                const ids = linked.map((use) => use.menuItemId!);
                const allOff = ids.every((id) => offSale.has(id));
                return (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => onSoldOut(ids, !allOff, linked.map((use) => use.name))}>
                    {allOff ? "Menüde tükendi · geri aç" : `Bağlı ${linked.length} ürünü tükendi yap`}
                  </Button>
                );
              })()}
              {view.status === "negative" ? (
                <Button size="sm" disabled={busy} onClick={() => onCount(view.item.id)}>Sayımla düzelt</Button>
              ) : (
                <Button size="sm" disabled={busy} onClick={onReorder}>Sipariş listesi</Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b p-3">
          <h2 className="text-base font-semibold">Stoklar <span className="font-mono text-xs font-normal text-muted-foreground">{views.length}</span></h2>
          <span className="flex-1" />
          <div role="group" aria-label="Duruma göre" className="flex flex-wrap gap-1.5">
            {FILTERS.map(([value, label]) => (
              <Button key={value} size="xs" variant={filter === value ? "default" : "outline"} aria-pressed={filter === value} className="rounded-full" onClick={() => setFilter(value)}>
                {label}<span className="font-mono text-[10.5px] opacity-80">{counts[value]}</span>
              </Button>
            ))}
          </div>
          <Input aria-label="Stok ara" placeholder="Stok, kategori veya raf" value={query} onChange={(e) => setQuery(e.target.value)} className="h-8 w-full sm:w-48" />
        </div>
        <div className="flex flex-wrap gap-2 border-b px-3 py-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={onAddCard}>Stok kartı ekle</Button>
          {isOwner && <Button size="sm" variant="outline" disabled={busy} onClick={onImport}>CSV ile ekle</Button>}
          <Button size="sm" variant="ghost" disabled={busy} onClick={onOtherOperation}>Diğer işlem (üretim, dış satış, düzeltme)</Button>
        </div>
        <div aria-hidden="true" className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_96px_96px_96px] gap-3 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground md:grid">
          <span>Stok</span><span>Seviye</span><span className="text-right">Miktar</span><span className="text-right">Yeter mi?</span><span className="text-right">Değer</span>
        </div>
        <ul className="m-0 list-none p-0">
          {rows.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">Bu filtrede stok yok.</li>}
          {rows.map((view) => {
            const max = Math.max(view.threshold * 2, view.quantity, 1);
            const active = selectedId === view.item.id;
            return (
              <li key={view.item.id} className="border-t first:border-t-0">
                <button
                  type="button"
                  aria-current={active || undefined}
                  aria-label={`${view.item.name}, ${STOCK_STATUS_LABEL[view.status]}, ${formatStock(view.quantity, view.item.unit)}, ${view.cover}`}
                  onClick={() => onSelect(view.item.id)}
                  className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-3 py-2.5 text-left transition-colors hover:bg-muted/50 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_96px_96px_96px] ${active ? "bg-muted" : ""}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{view.item.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{[view.item.category, view.item.shelf].filter(Boolean).join(" · ") || "Konum yok"}</span>
                  </span>
                  <span className="col-start-2 row-start-1 flex min-w-0 items-center gap-2 md:col-start-auto md:row-start-auto">
                    <Badge variant={STATUS_BADGE[view.status]}>{STOCK_STATUS_LABEL[view.status]}</Badge>
                    <span aria-hidden="true" className="relative hidden h-1.5 min-w-10 flex-1 rounded-full bg-muted md:block">
                      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(0, Math.min(100, (view.quantity / max) * 100))}%`, background: STATUS_BAR[view.status] }} />
                      <span className="absolute -top-1 -bottom-1 w-0.5 bg-foreground/60" style={{ left: `${(view.threshold / max) * 100}%` }} />
                    </span>
                  </span>
                  <span className={`text-right font-mono text-sm tabular-nums ${view.quantity < 0 ? "text-destructive" : ""}`}>{formatStock(view.quantity, view.item.unit)}</span>
                  <span className={`text-right text-xs ${view.status === "ok" ? "text-muted-foreground" : view.status === "low" ? "text-[var(--warning)]" : "text-destructive"}`}>{view.cover}</span>
                  <span className="hidden text-right font-mono text-sm tabular-nums md:block">{view.value === null ? "Maliyet yok" : view.quantity > 0 ? money(view.value) : "—"}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">Dikey çizgi kritik eşiği gösterir. “Yeter mi?” son 7 günün ortalama tüketimine göre tahmindir.</p>
      </Card>
    </div>
  );
}

function Figure({ label, value, note, action }: { label: string; value: string; note: string; action?: React.ReactNode }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-1">
        <p className="text-xs text-muted-foreground">{note}</p>
        {action}
      </CardContent>
    </Card>
  );
}
