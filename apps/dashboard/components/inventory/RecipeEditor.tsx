"use client";
import { useState } from "react";
import type {
  InventorySnapshot,
  InventoryRecipe,
  RecipeLine,
} from "@garsonless/domain/inventory";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import {
  TextField,
  Choice,
  Option,
  decimal,
  money,
  amount,
} from "./inventory-controls";
export default function RecipeEditor({
  data,
  busy,
  save,
  initialMenuItemId,
}: {
  initialMenuItemId?: string;
  data: InventorySnapshot;
  busy: boolean;
  save: (payload: Record<string, unknown>) => void;
}) {
  const initial = data.recipes.find((r) => r.menuItemId === initialMenuItemId);
  const [loadedVersion, setLoadedVersion] = useState(initial?.version ?? 0);
  const [target, setTarget] = useState(
    initialMenuItemId ? "menu:" + initialMenuItemId : "",
  );
  const [mode, setMode] = useState<InventoryRecipe["mode"]>(
    initial?.mode ?? "recipe",
  );
  const [output, setOutput] = useState(initial?.outputQuantity ?? "1");
  const [lines, setLines] = useState<RecipeLine[]>(initial?.lines ?? []);
  const menu = data.menuItems.find((i) => "menu:" + i.id === target);
  const update = (index: number, patch: Partial<RecipeLine>) =>
    setLines((rows) =>
      rows.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );
  const choose = (value: string) => {
    setTarget(value);
    const r = data.recipes.find(
      (r) =>
        (r.menuItemId ? "menu:" + r.menuItemId : "output:" + r.outputItemId) ===
        value,
    );
    setLoadedVersion(r?.version ?? 0);
    setLines(r?.lines ?? []);
    setMode(r?.mode ?? "recipe");
    setOutput(r?.outputQuantity ?? "1");
  };
  const baseLines = lines.filter((l) => !l.optionId);
  const mappingGaps =
    menu && mode !== "none"
      ? [
          ...menu.ingredients
            .filter(
              (i) =>
                i.removable &&
                !lines.some((l) => !l.optionId && l.ingredientId === i.id),
            )
            .map((i) => `Çıkarma: ${i.name}`),
          ...menu.modifiers.flatMap((g) =>
            g.options
              .filter(
                (o) =>
                  !lines.some((l) => l.groupId === g.id && l.optionId === o.id),
              )
              .map((o) => `${g.name}: ${o.name}`),
          ),
        ]
      : [];

  const missing = baseLines.some(
    (l) => data.items.find((i) => i.id === l.itemId)?.cost == null,
  );
  const total = baseLines.reduce(
    (sum, l) =>
      sum +
      Number(l.quantity.replace(",", ".")) *
        Number(data.items.find((i) => i.id === l.itemId)?.cost ?? 0),
    0,
  );
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        const [kind, id] = target.split(":");
        save({
          ...(kind === "menu" ? { menuItemId: id } : { outputItemId: id }),
          mode,
          version: loadedVersion,
          outputQuantity: decimal(output),
          lines:
            mode === "none"
              ? []
              : lines.map((l) => ({ ...l, quantity: decimal(l.quantity) })),
        });
      }}
    >
      <FieldGroup className="grid gap-4 sm:grid-cols-3">
        <Choice
          label="Menü ürünü / üretim çıktısı"
          value={target}
          onChange={choose}
        >
          <Option value="">Seçin</Option>
          {data.menuItems.map((i) => (
            <Option key={i.id} value={"menu:" + i.id}>
              {i.name}
            </Option>
          ))}
          {data.items
            .filter((i) => !i.archived && i.kind !== "raw")
            .map((i) => (
              <Option key={i.id} value={"output:" + i.id}>
                Üretim: {i.name}
              </Option>
            ))}
        </Choice>
        <Choice
          label="Takip biçimi"
          value={mode}
          onChange={(v) => setMode(v as InventoryRecipe["mode"])}
        >
          <Option value="recipe">Reçeteli</Option>
          <Option value="direct">Doğrudan stok</Option>
          <Option value="none">Takip edilmiyor</Option>
        </Choice>
        {target.startsWith("output:") && (
          <TextField
            label="Bu reçetenin çıktı miktarı (temel birim)"
            value={output}
            onChange={setOutput}
            numeric
          />
        )}
      </FieldGroup>
      {mode !== "none" &&
        lines.map((line, index) => (
          <FieldGroup className="rounded-lg border p-4" key={index}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Choice
                label="Tüketilecek stok"
                value={line.itemId}
                onChange={(v) => update(index, { itemId: v })}
              >
                <Option value="">Seçin</Option>
                {data.items
                  .filter((i) => !i.archived)
                  .map((i) => (
                    <Option key={i.id} value={i.id}>
                      {i.name} ({i.unit})
                    </Option>
                  ))}
              </Choice>
              <TextField
                label="Temel birimde tüketim"
                value={line.quantity}
                onChange={(v) => update(index, { quantity: v })}
                numeric
              />
            </div>
            {menu && (
              <div className="grid gap-4 sm:grid-cols-3">
                <Choice
                  label="Ne zaman tüketilir?"
                  value={
                    line.optionId
                      ? JSON.stringify([line.groupId, line.optionId])
                      : ""
                  }
                  onChange={(v) => {
                    const [groupId, optionId] = v
                      ? (JSON.parse(v) as string[])
                      : ["", ""];
                    update(index, { groupId, optionId, replacesItemId: "" });
                  }}
                >
                  <Option value="">Her porsiyonda</Option>
                  {menu.modifiers.flatMap((g) =>
                    g.options.map((o) => (
                      <Option
                        key={g.id + o.id}
                        value={JSON.stringify([g.id, o.id])}
                      >
                        {g.name}: {o.name}
                      </Option>
                    )),
                  )}
                </Choice>
                {!line.optionId ? (
                  <Choice
                    label="Çıkarılabilir içerik bağlantısı"
                    value={line.ingredientId ?? ""}
                    onChange={(v) => update(index, { ingredientId: v })}
                  >
                    <Option value="">Bağlantı yok</Option>
                    {menu.ingredients
                      .filter((i) => i.removable)
                      .map((i) => (
                        <Option key={i.id} value={i.id}>
                          {i.name}
                        </Option>
                      ))}
                  </Choice>
                ) : (
                  <Choice
                    label="Yerine geçtiği temel stok"
                    value={line.replacesItemId ?? ""}
                    onChange={(v) => update(index, { replacesItemId: v })}
                  >
                    <Option value="">Ek tüketim</Option>
                    {baseLines.map((l, i) => (
                      <Option key={i} value={l.itemId}>
                        {data.items.find((s) => s.id === l.itemId)?.name}
                      </Option>
                    ))}
                  </Choice>
                )}
              </div>
            )}
            <Button
              className="w-fit max-w-full self-start justify-self-start"
              type="button"
              variant="ghost"
              onClick={() =>
                setLines((rows) => rows.filter((_, i) => i !== index))
              }
            >
              Satırı kaldır
            </Button>
          </FieldGroup>
        ))}
      {mode !== "none" && (
        <Button
          className="w-fit max-w-full self-start justify-self-start"
          type="button"
          variant="outline"
          onClick={() =>
            setLines((rows) => [...rows, { itemId: "", quantity: "1" }])
          }
        >
          Malzeme ekle
        </Button>
      )}
      {mode !== "none" && target && (
        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <p className="font-medium">
            {menu
              ? "Bir porsiyon tüketim önizlemesi"
              : "Üretim reçetesi önizlemesi"}
          </p>
          {lines.length ? (
            lines.map((line, index) => {
              const item = data.items.find((i) => i.id === line.itemId);
              const option = menu?.modifiers
                .find((g) => g.id === line.groupId)
                ?.options.find((o) => o.id === line.optionId);
              const removed = menu?.ingredients.find(
                (i) => i.id === line.ingredientId,
              );
              return (
                <p key={index} className="text-sm">
                  {item?.name ?? "Stok seçin"}:{" "}
                  {amount(line.quantity.replace(",", "."))} {item?.unit}
                  {option
                    ? ` · ${option.name} seçilirse, her ekstra adedi için`
                    : " · Temel tüketim"}
                  {removed ? ` · ${removed.name} çıkarılırsa tüketilmez` : ""}
                  {line.replacesItemId
                    ? ` · ${data.items.find((i) => i.id === line.replacesItemId)?.name} yerine`
                    : ""}
                </p>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">
              Önizleme için malzeme ekleyin.
            </p>
          )}
          {mappingGaps.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Stok eşlemesi olmayan seçenekler: {mappingGaps.join(", ")}. Bu
              seçimler tüketimi değiştirmez; malzeme etkisi varsa eşleyin.
            </p>
          )}
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        Temel reçete maliyeti: {missing ? "Eksik maliyet" : money(total)}.
        Ekstra seçimler ayrıca tüketilir. Yeni sürüm mevcut siparişleri
        değiştirmez.
      </p>
      <Button
        className="w-fit max-w-full self-start justify-self-start"
        disabled={busy || !target}
        type="submit"
      >
        Reçeteyi kaydet
      </Button>
    </form>
  );
}
