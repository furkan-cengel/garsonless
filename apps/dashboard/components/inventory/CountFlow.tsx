"use client";
import { useMemo, useState } from "react";
import {
  convertInventoryQuantity,
  type InventoryCount,
  type InventoryMode,
  type InventorySnapshot,
  type StockItem,
} from "@garsonless/domain/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { I } from "../../lib/ui";
import { ConfirmAction, money } from "./inventory-controls";
import { entryUnits, formatStock, unitLabel } from "./inventory-model";

type Counted = Record<string, { quantity: string; version: string }>;
type Step = { kind: "shelves" } | { kind: "item"; shelf: number; index: number } | { kind: "review" };

const NO_SHELF = "Rafsız";

/** Stock count on a phone: shelf by shelf, one product at a time, then the differences. */
export default function CountFlow({
  data,
  isOwner,
  busy,
  initialItemId,
  save,
}: {
  data: InventorySnapshot;
  isOwner: boolean;
  busy: boolean;
  initialItemId?: string;
  /** Resolves the command result, or null when it failed. */
  save: (mode: InventoryMode, payload: Record<string, unknown>) => Promise<{ id?: string | null } | null>;
}) {
  const shelves = useMemo(() => {
    const groups = new Map<string, StockItem[]>();
    for (const item of data.items.filter((i) => !i.archived).sort((a, b) => a.name.localeCompare(b.name, "tr"))) {
      const key = item.shelf.trim() || NO_SHELF;
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return [...groups].sort(([a], [b]) => (a === NO_SHELF ? 1 : b === NO_SHELF ? -1 : a.localeCompare(b, "tr"))).map(([name, items]) => ({ name, items }));
  }, [data.items]);
  const latestDraft = data.counts.find((count) => count.status === "draft") ?? null;
  const lastApproved = data.counts.find((count) => count.status === "approved") ?? null;
  const fromDraft = (count: InventoryCount | null): Counted =>
    Object.fromEntries((count?.lines ?? []).filter((line) => line.quantity !== null).map((line) => [line.itemId, { quantity: line.quantity!, version: line.version }]));

  const [draftId, setDraftId] = useState<string | null>(latestDraft?.id ?? null);
  const [counted, setCounted] = useState<Counted>(() => fromDraft(latestDraft));
  const [savedSignature, setSavedSignature] = useState(() => JSON.stringify(fromDraft(latestDraft)));
  const [blind, setBlind] = useState(true);
  const [units, setUnits] = useState<Record<string, string>>({});
  const [entry, setEntry] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [step, setStep] = useState<Step>(() => {
    if (!initialItemId) return { kind: "shelves" };
    const shelf = shelves.findIndex((s) => s.items.some((i) => i.id === initialItemId));
    return shelf < 0 ? { kind: "shelves" } : { kind: "item", shelf, index: shelves[shelf]!.items.findIndex((i) => i.id === initialItemId) };
  });

  const draft = draftId ? data.counts.find((count) => count.id === draftId) ?? null : null;
  const dirty = JSON.stringify(counted) !== savedSignature;
  const total = shelves.reduce((sum, shelf) => sum + shelf.items.length, 0);
  const done = Object.keys(counted).length;
  const itemById = new Map(data.items.map((item) => [item.id, item]));

  async function persist(next: Counted): Promise<boolean> {
    const result = await save("count_save", {
      ...(draft ? { id: draft.id, version: draft.version } : {}),
      lines: Object.entries(next).map(([itemId, value]) => ({ itemId, quantity: value.quantity, version: value.version })),
    });
    if (!result) return false;
    if (result.id) setDraftId(result.id);
    setSavedSignature(JSON.stringify(next));
    return true;
  }

  function openItem(shelf: number, index: number) {
    const item = shelves[shelf]?.items[index];
    if (!item) return;
    const unit = units[item.id] ?? item.unit;
    const factor = entryUnits(item).find((u) => u.unit === unit)?.factor ?? 1;
    const existing = counted[item.id];
    setEntry(existing ? String(Number(existing.quantity) / factor).replace(".", ",") : "");
    setStep({ kind: "item", shelf, index });
  }

  async function next(skip: boolean) {
    if (step.kind !== "item") return;
    const shelf = shelves[step.shelf]!;
    const item = shelf.items[step.index]!;
    let updated = counted;
    if (!skip) {
      const quantity = convertInventoryQuantity(entry, units[item.id] ?? item.unit, item);
      if (quantity === null) return;
      updated = { ...counted, [item.id]: { quantity, version: item.version } };
      setCounted(updated);
    }
    if (step.index < shelf.items.length - 1) {
      openItem(step.shelf, step.index + 1);
      return;
    }
    setStep({ kind: "shelves" });
    // A finished shelf is saved as a draft, so a dropped phone or a closed tab loses nothing.
    if (JSON.stringify(updated) !== savedSignature && Object.keys(updated).length) {
      if (await persist(updated)) setNotice(`${shelf.name} kaydedildi.`);
    }
  }

  if (step.kind === "item") {
    const shelf = shelves[step.shelf]!;
    const item = shelf.items[step.index]!;
    const options = entryUnits(item);
    const unit = units[item.id] ?? item.unit;
    const factor = options.find((u) => u.unit === unit)?.factor ?? 1;
    const quantity = entry ? convertInventoryQuantity(entry, unit, item) : null;
    const difference = quantity !== null ? Number(quantity) - Number(item.quantity) : null;
    const stepSize = factor >= 1000 ? 0.1 : 1;
    const nudge = (direction: 1 | -1) => {
      const current = Number(entry.replace(",", ".")) || 0;
      setEntry(String(Math.max(0, Math.round((current + direction * stepSize) * 10) / 10)).replace(".", ","));
    };
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Raflara dön" onClick={() => setStep({ kind: "shelves" })}><I.chevLeft size={16} /></Button>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{shelf.name} · {step.index + 1}/{shelf.items.length}</p>
            <h2 className="truncate text-lg font-semibold">{item.name}</h2>
          </div>
        </div>
        <Progress done={done} total={total} />
        <p className="rounded-lg border bg-card p-3 text-sm text-muted-foreground">
          {blind ? "Kayıtlı miktar gizli (kör sayım)." : `Kayıtlı: ${formatStock(Number(item.quantity), item.unit)}`}
        </p>
        {options.length > 1 && (
          <div role="group" aria-label="Birim" className="flex gap-1.5">
            {options.map((option) => (
              <Button key={option.unit} type="button" className="h-11 flex-1" variant={unit === option.unit ? "default" : "outline"} aria-pressed={unit === option.unit} onClick={() => { setUnits((u) => ({ ...u, [item.id]: option.unit })); setEntry(""); }}>
                {unitLabel(option.unit)}
              </Button>
            ))}
          </div>
        )}
        <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void next(false); }}>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" className="size-16 text-2xl" aria-label="Azalt" onClick={() => nudge(-1)}>−</Button>
            <Input autoFocus aria-label={`${item.name} sayılan miktar (${unitLabel(unit)})`} inputMode="decimal" placeholder="0" value={entry} onChange={(e) => setEntry(e.target.value.replace(/[^\d.,]/g, ""))} className="h-16 flex-1 text-center font-mono text-2xl font-semibold" />
            <Button type="button" variant="outline" className="size-16 text-2xl" aria-label="Artır" onClick={() => nudge(1)}>+</Button>
          </div>
          {!blind && difference !== null && (
            <p role="status" className={`rounded-lg px-3 py-2 text-sm ${Math.abs(difference) > Math.abs(Number(item.quantity)) * 0.1 + 1 ? "bg-[var(--warning-bg)] text-[var(--warning)]" : "bg-muted"}`}>
              {difference === 0 ? "Kayıtla aynı" : `Kayda göre ${difference > 0 ? "+" : ""}${formatStock(difference, item.unit)}`}
            </p>
          )}
          <Button type="submit" className="h-12 text-base" disabled={quantity === null || busy}>
            {step.index < shelf.items.length - 1 ? "Kaydet ve sonraki ürün" : "Kaydet ve rafı bitir"}
          </Button>
          <Button type="button" variant="link" onClick={() => { void next(true); }}>Bu ürünü şimdi sayma</Button>
        </form>
      </div>
    );
  }

  if (step.kind === "review") {
    const rows = Object.entries(counted).flatMap(([itemId, value]) => {
      const item = itemById.get(itemId);
      if (!item) return [];
      const difference = Number(value.quantity) - Number(item.quantity);
      return [{ item, value, difference, moved: value.version !== item.version, worth: item.cost === null ? null : difference * Number(item.cost) }];
    });
    const totalWorth = rows.reduce((sum, row) => sum + (row.worth ?? 0), 0);
    const moved = rows.filter((row) => row.moved);
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Raflara dön" onClick={() => setStep({ kind: "shelves" })}><I.chevLeft size={16} /></Button>
          <h2 className="text-lg font-semibold">Farkları kontrol et</h2>
        </div>
        <div className="rounded-xl border bg-card p-3">
          <span className="text-xs text-muted-foreground">Toplam fark</span>
          <strong className={`block text-2xl font-semibold tabular-nums ${totalWorth < 0 ? "text-destructive" : "text-[var(--positive)]"}`}>{totalWorth < 0 ? "−" : "+"}{money(Math.abs(totalWorth))}</strong>
          <span className="text-xs text-muted-foreground">{rows.length} ürün · turuncu çerçeveliler %10’dan fazla sapıyor; gerekirse yeniden say.</span>
        </div>
        {moved.length > 0 && (
          <p role="alert" className="rounded-lg bg-[var(--warning-bg)] px-3 py-2 text-sm text-[var(--warning)]">
            {moved.length} üründe sayımdan sonra satış veya başka bir hareket oldu. O ürünleri yeniden say ya da sayımın hâlâ doğru olduğunu işaretle.
          </p>
        )}
        {rows.map(({ item, value, difference, moved: hasMoved, worth }) => {
          const big = Math.abs(difference) > Math.abs(Number(item.quantity)) * 0.1 + 1;
          const shelfIndex = shelves.findIndex((s) => s.items.some((i) => i.id === item.id));
          return (
            <div key={item.id} className={`flex flex-col gap-1 rounded-xl border bg-card p-3 ${big ? "border-[var(--warning)]" : ""}`}>
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1">
                  <strong className="block text-sm font-medium">{item.name}</strong>
                  <span className="font-mono text-xs text-muted-foreground">{formatStock(Number(item.quantity), item.unit)} → {formatStock(Number(value.quantity), item.unit)}</span>
                </span>
                <strong className={`font-mono text-sm ${difference < 0 ? "text-destructive" : difference > 0 ? "text-[var(--positive)]" : "text-muted-foreground"}`}>
                  {difference > 0 ? "+" : ""}{formatStock(difference, item.unit)}{worth !== null && difference !== 0 ? ` · ${worth < 0 ? "−" : "+"}${money(Math.abs(worth))}` : ""}
                </strong>
              </div>
              {hasMoved && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => openItem(shelfIndex, shelves[shelfIndex]!.items.findIndex((i) => i.id === item.id))}>Yeniden say</Button>
                  <Button size="sm" variant="ghost" onClick={() => setCounted((c) => ({ ...c, [item.id]: { quantity: value.quantity, version: item.version } }))}>Sayım hâlâ doğru</Button>
                </div>
              )}
            </div>
          );
        })}
        <div className="sticky bottom-0 flex flex-col gap-2 border-t bg-background py-3">
          {(dirty || !draft) && (
            <Button className="h-12 text-base" disabled={busy || rows.length === 0} onClick={() => { void persist(counted).then((ok) => { if (ok) setNotice(isOwner ? "Sayım kaydedildi; onaylayabilirsin." : "Sayım onaya gönderildi."); }); }}>
              {isOwner ? "Sayımı kaydet" : "Onaya gönder"}
            </Button>
          )}
          {isOwner && draft && !dirty && (
            <Button className="h-12 text-base" disabled={busy || moved.length > 0} aria-describedby={moved.length ? "count-moved" : undefined} onClick={() => setConfirmApprove(true)}>Sayımı onayla</Button>
          )}
          {isOwner && moved.length > 0 && <p id="count-moved" className="text-center text-xs text-muted-foreground">Onaylamadan önce hareket olan ürünleri çöz.</p>}
          <p className="text-center text-xs text-muted-foreground">Sahip onaylayınca farklar deftere sayım farkı olarak yazılır.</p>
          {notice && <p role="status" className="text-center text-sm">{notice}</p>}
        </div>
        {draft && (
          <ConfirmAction
            open={confirmApprove}
            title="Sayım onaylansın mı?"
            description="Onaylanınca sayılan miktarlar kayıtlı stokun yerine geçer ve farklar sayım farkı olarak deftere yazılır. Onaylanan sayım değiştirilemez."
            confirmLabel="Sayımı onayla"
            onCancel={() => setConfirmApprove(false)}
            onConfirm={() => {
              setConfirmApprove(false);
              void save("count_approve", { id: draft.id, version: draft.version }).then((result) => {
                if (!result) return;
                setCounted({});
                setSavedSignature("{}");
                setDraftId(null);
                setStep({ kind: "shelves" });
                setNotice("Sayım onaylandı; stoklar güncellendi.");
              });
            }}
          >
            <p className="text-sm">{rows.filter((row) => row.difference !== 0).length} üründe fark yazılacak · toplam {totalWorth < 0 ? "−" : "+"}{money(Math.abs(totalWorth))}.</p>
          </ConfirmAction>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold">Sayım</h2>
        <p className="text-xs text-muted-foreground">
          {done} / {total} ürün sayıldı{draft ? " · taslak kaydedildi" : ""}{lastApproved ? ` · son onaylı sayım ${new Date(lastApproved.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long" })}` : ""}
        </p>
      </div>
      <Progress done={done} total={total} />
      {notice && <p role="status" className="text-sm">{notice}</p>}
      <label className="flex items-center gap-3 rounded-xl border bg-card p-3">
        <span className="flex-1">
          <strong className="block text-sm">Kör sayım</strong>
          <span className="text-xs text-muted-foreground">Kayıtlı miktarı gizler; sayan kişi gördüğünü yazar.</span>
        </span>
        <Switch checked={blind} onCheckedChange={(value) => setBlind(value === true)} aria-label="Kör sayım" />
      </label>
      {shelves.map((shelf, index) => {
        const counts = shelf.items.filter((item) => counted[item.id]).length;
        const full = counts === shelf.items.length;
        return (
          <button key={shelf.name} type="button" className="flex min-h-16 items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/50" onClick={() => {
            const first = shelf.items.findIndex((item) => !counted[item.id]);
            openItem(index, first < 0 ? 0 : first);
          }}>
            <span aria-hidden="true" className={`grid size-9 shrink-0 place-items-center rounded-lg ${full ? "bg-[var(--positive-bg)] text-[var(--positive)]" : "bg-muted text-muted-foreground"}`}>{full ? <I.check size={18} /> : <I.grid size={18} />}</span>
            <span className="min-w-0 flex-1">
              <strong className="block text-base font-semibold">{shelf.name}</strong>
              <span className="text-xs text-muted-foreground">{full ? `Tamamlandı · ${counts} ürün` : `${counts} / ${shelf.items.length} sayıldı`}</span>
            </span>
            <I.chevRight size={16} />
          </button>
        );
      })}
      <div className="sticky bottom-0 flex flex-col gap-2 border-t bg-background py-3">
        <Button className="h-12 text-base" disabled={done === 0} onClick={() => setStep({ kind: "review" })}>{done ? `Farkları gör (${done} ürün)` : "Bir raf seçerek başla"}</Button>
        {done > 0 && (
          <Button variant="ghost" size="sm" onClick={() => { setCounted({}); setSavedSignature("{}"); setDraftId(null); setNotice("Yeni sayım başladı; önceki taslak saklanıyor."); }}>Sıfırdan başla</Button>
        )}
      </div>
    </div>
  );
}

function Progress({ done, total }: { done: number; total: number }) {
  const percent = total ? Math.round((done / total) * 100) : 0;
  return (
    <div role="progressbar" aria-label="Sayım ilerlemesi" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-1 overflow-hidden rounded-full bg-muted">
      <div className="h-full bg-foreground transition-[width]" style={{ width: `${percent}%` }} />
    </div>
  );
}
