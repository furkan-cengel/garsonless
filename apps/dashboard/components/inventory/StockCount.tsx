"use client";
import { useState } from "react";
import type {
  InventoryCount,
  InventoryMode,
  InventorySnapshot,
} from "@garsonless/domain/inventory";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldGroup } from "@/components/ui/field";
import {
  Choice,
  Option,
  TextField,
  amount,
  decimal,
} from "./inventory-controls";
export default function StockCount({
  data,
  busy,
  isOwner,
  save,
  initialCountId,
}: {
  initialCountId?: string;
  data: InventorySnapshot;
  busy: boolean;
  isOwner: boolean;
  save: (mode: InventoryMode, payload: Record<string, unknown>) => void;
}) {
  const initial = data.counts.find((c) => c.id === initialCountId) ?? null;
  const [current, setCurrent] = useState<InventoryCount | null>(initial);
  const [values, setValues] = useState<
    Record<string, { quantity: string; version: string }>
  >(
    Object.fromEntries(
      initial?.lines.map((l) => [
        l.itemId,
        { quantity: l.quantity ?? "", version: l.version },
      ]) ?? [],
    ),
  );
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState<string[]>(
    initial?.lines.map((l) => l.itemId) ?? [],
  );
  const count = current;
  const dirty =
    !count ||
    count.lines.length !== selected.length ||
    count.lines.some(
      (l) =>
        !selected.includes(l.itemId) ||
        decimal(values[l.itemId]?.quantity ?? "") !== (l.quantity ?? "") ||
        values[l.itemId]?.version !== l.version,
    );
  const open = (id: string) => {
    const c = data.counts.find((c) => c.id === id) ?? null;
    setCurrent(c);
    setValues(
      Object.fromEntries(
        c?.lines.map((l) => [
          l.itemId,
          { quantity: l.quantity ?? "", version: l.version },
        ]) ?? [],
      ),
    );
    setSelected(c?.lines.map((l) => l.itemId) ?? []);
  };
  const items = data.items.filter(
    (i) => !i.archived && (!category || i.category === category),
  );
  return (
    <div className="flex flex-col gap-4">
      <FieldGroup className="grid gap-3 sm:grid-cols-2">
        <Choice label="Sayım" value={current?.id ?? ""} onChange={open}>
          <Option value="">Yeni sayım</Option>
          {data.counts.map((c) => (
            <Option key={c.id} value={c.id}>
              {new Date(c.createdAt).toLocaleString("tr-TR")} —{" "}
              {c.status === "draft" ? "Taslak" : "Onaylandı"}
            </Option>
          ))}
        </Choice>
        <Choice label="Kategori" value={category} onChange={setCategory}>
          <Option value="">Tümü</Option>
          {[...new Set(data.items.map((i) => i.category))]
            .filter(Boolean)
            .map((c) => (
              <Option key={c} value={c}>
                {c}
              </Option>
            ))}
        </Choice>
      </FieldGroup>
      <p className="text-sm text-muted-foreground">
        Boş alan sayılmadı, 0 ise stok yok demektir. Değişen satırı yeniden
        sayıp “Yeniden saydım” düğmesine basın.
      </p>
      <Button
        className="w-fit max-w-full self-start justify-self-start"
        variant="outline"
        disabled={busy || count?.status === "approved"}
        onClick={() =>
          setSelected((ids) => [
            ...new Set([...ids, ...items.map((i) => i.id)]),
          ])
        }
      >
        Görünen stokları seç
      </Button>
      {items.map((item) => {
        const v = values[item.id];
        const conflict =
          v?.quantity !== undefined &&
          v.quantity !== "" &&
          v.version !== item.version;
        return (
          <div
            className="flex items-center gap-3 rounded-lg border p-3"
            key={item.id}
          >
            <Checkbox
              aria-label={`${item.name} sayıma dahil`}
              disabled={count?.status === "approved"}
              checked={selected.includes(item.id)}
              onCheckedChange={(checked) =>
                setSelected((ids) =>
                  checked
                    ? [...ids, item.id]
                    : ids.filter((id) => id !== item.id),
                )
              }
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{item.name}</p>
              <p className="text-sm text-muted-foreground">
                {item.shelf} · Kayıtlı: {amount(item.quantity)} {item.unit}
              </p>
              {conflict && (
                <p className="text-sm text-destructive">
                  Sayım sonrası stok hareketi var.
                </p>
              )}
            </div>
            <div className="w-28">
              <TextField
                label={item.unit}
                value={v?.quantity ?? ""}
                numeric
                disabled={
                  !selected.includes(item.id) || count?.status === "approved"
                }
                onChange={(quantity) =>
                  setValues((rows) => ({
                    ...rows,
                    [item.id]: { quantity, version: item.version },
                  }))
                }
              />
            </div>
            {conflict && (
              <Button
                className="w-fit max-w-full self-start justify-self-start"
                size="sm"
                variant="outline"
                onClick={() =>
                  setValues((rows) => ({
                    ...rows,
                    [item.id]: {
                      quantity: rows[item.id]?.quantity ?? "",
                      version: item.version,
                    },
                  }))
                }
              >
                Yeniden saydım
              </Button>
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap gap-3">
        <Button
          className="w-fit max-w-full self-start justify-self-start"
          disabled={busy || !selected.length || count?.status === "approved"}
          onClick={() =>
            save("count_save", {
              ...(current ? { id: current.id, version: count?.version } : {}),
              lines: selected.map((itemId) => ({
                itemId,
                quantity: values[itemId]?.quantity?.trim()
                  ? decimal(values[itemId]!.quantity)
                  : null,
                version:
                  values[itemId]?.version ??
                  data.items.find((i) => i.id === itemId)!.version,
              })),
            })
          }
        >
          Taslağı kaydet
        </Button>
        {isOwner && count?.status === "draft" && (
          <Button
            className="w-fit max-w-full self-start justify-self-start"
            variant="outline"
            disabled={busy || dirty}
            onClick={() =>
              save("count_approve", { id: count.id, version: count.version })
            }
          >
            Kaydedilmiş sayımı onayla
          </Button>
        )}
      </div>
    </div>
  );
}
