"use client";
import { useState } from "react";
import {
  convertInventoryQuantity,
  type InventoryMode,
  type InventorySnapshot,
} from "@garsonless/domain/inventory";
import { baseUnitCost } from "./inventory-model";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Choice,
  Option,
  TextField,
  decimal,
  amount,
  money,
} from "./inventory-controls";
type Line = { itemId: string; quantity: string; unit: string; cost: string };

const OPERATION_HINTS: Partial<Record<InventoryMode, string>> = {
  receipt: "Mal kabul: tedarikçiden gelen malzemeyi stoğa ekler.",
  waste: "Fire: bozulan, dökülen veya atılan malzemeyi stoktan düşer.",
  external_sale: "Dış satış tüketimi: Masabu dışında satılan ürünlerin malzemesini düşer.",
  production: "Üretim: reçeteyle yarı mamul hazırlar; malzemeyi düşer, çıktıyı ekler.",
  adjustment: "Gerekçeli düzeltme: sayılan ile kayıtlı miktar arasındaki farkı elle kapatır.",
  return: "İptal firesini iade: iptal edilen siparişte harcanmamış malzemeyi stoğa geri alır.",
};

const money4 = (value: string) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 4 }).format(Number(value));

export default function StockOperation({
  data,
  isOwner,
  busy,
  save,
}: {
  data: InventorySnapshot;
  isOwner: boolean;
  busy: boolean;
  save: (mode: InventoryMode, payload: Record<string, unknown>) => void;
}) {
  const [mode, setMode] = useState<InventoryMode>("receipt");
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { itemId: "", quantity: "1", unit: "", cost: "" },
  ]);
  const [recipeId, setRecipe] = useState("");
  const [outputQuantity, setOutput] = useState("1");
  const [preview, setPreview] = useState(false);
  const [orderId, setOrder] = useState("");
  const recipe = data.recipes.find((r) => r.id === recipeId);
  const change = (index: number, patch: Partial<Line>) => {
    setLines((rows) =>
      rows.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    );
  };
  const normalized = lines.map((l) => {
    const item = data.items.find((i) => i.id === l.itemId);
    const q =
      mode === "adjustment"
        ? decimal(l.quantity)
        : item
          ? convertInventoryQuantity(l.quantity, l.unit || item.unit, item)
          : null;
    return {
      itemId: l.itemId,
      quantity: q,
      cost: item && l.cost ? baseUnitCost(l.cost, l.unit || item.unit, item) : null,
    };
  });
  const lineName = (index: number) => `${index + 1}. satır`;
  const duplicateIndex = lines.findIndex((l, i) => l.itemId && lines.findIndex((other) => other.itemId === l.itemId) !== i);
  // Say why the submit button is off instead of only greying it out.
  const blockedReason =
    lines.findIndex((l) => !l.itemId) >= 0
      ? `${lineName(lines.findIndex((l) => !l.itemId))}: stok seçin.`
      : duplicateIndex >= 0
        ? `${lineName(duplicateIndex)}: bu stok başka bir satırda zaten var. Miktarları tek satırda toplayın.`
        : normalized.findIndex((l) => l.quantity === null) >= 0
          ? `${lineName(normalized.findIndex((l) => l.quantity === null))}: miktarı bu birimle yazılabilecek bir sayı olarak girin.`
          : normalized.findIndex((l, i) => lines[i]!.cost.trim() && l.cost === null) >= 0
            ? `${lineName(normalized.findIndex((l, i) => lines[i]!.cost.trim() && l.cost === null))}: birim fiyatı sayı olarak girin.`
            : mode === "production" && !recipeId
              ? "Üretim reçetesini seçin."
              : mode === "return" && !orderId
                ? "İade edilecek siparişi seçin."
                : null;
  const valid = blockedReason === null;
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!preview) {
          setPreview(true);
          return;
        }
        if (valid)
          save(mode, {
            reason,
            lines: normalized,
            ...(mode === "production"
              ? { recipeId, outputQuantity: decimal(outputQuantity) }
              : {}),
            ...(mode === "return" ? { orderId } : {}),
          });
      }}
    >
      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <Choice
          label="İşlem"
          hint={OPERATION_HINTS[mode]}
          value={mode}
          onChange={(v) => {
            setMode(v as InventoryMode);
            // A different operation type changes what the preview means; field edits only update it.
            setPreview(false);
            setLines([{ itemId: "", quantity: "1", unit: "", cost: "" }]);
          }}
        >
          <Option value="receipt">Mal kabul</Option>
          <Option value="waste">Fire</Option>
          <Option value="external_sale">Dış satış tüketimi</Option>
          <Option value="production">Üretim</Option>
          {isOwner && (
            <>
              <Option value="adjustment">Gerekçeli düzeltme (+/−)</Option>
              <Option value="return">İptal firesini stoğa iade</Option>
            </>
          )}
        </Choice>
        <TextField
          label="Gerekçe / belge notu"
          value={reason}
          onChange={(v) => {
            setReason(v);
          }}
        />
      </FieldGroup>
      {mode === "return" && (
        <Choice
          label="Hazırlanmış ve iptal edilmiş sipariş"
          value={orderId}
          onChange={(v) => {
            setOrder(v);
          }}
        >
          <Option value="">Seçin</Option>
          {[...new Set(data.cancelledWaste.map((w) => w.orderId))].map((id) => (
            <Option key={id} value={id}>
              {id.slice(0, 8)}
            </Option>
          ))}
        </Choice>
      )}
      {mode === "production" && (
        <FieldGroup>
          <Choice
            label="Üretim reçetesi"
            value={recipeId}
            onChange={(v) => {
              setRecipe(v);
            }}
          >
            <Option value="">Seçin</Option>
            {data.recipes
              .filter((r) => r.outputItemId && r.mode !== "none")
              .map((r) => (
                <Option key={r.id} value={r.id}>
                  {data.items.find((i) => i.id === r.outputItemId)?.name}
                </Option>
              ))}
          </Choice>
          <TextField
            label={`Gerçekleşen çıktı (${data.items.find((i) => i.id === recipe?.outputItemId)?.unit ?? "temel birim"})`}
            value={outputQuantity}
            numeric
            onChange={(v) => {
              setOutput(v);
            }}
          />
          <Button
            className="w-fit max-w-full self-start justify-self-start"
            type="button"
            variant="outline"
            disabled={!recipe}
            onClick={() => {
              if (!recipe) return;
              const amounts = new Map<string, number>();
              for (const l of recipe.lines)
                amounts.set(
                  l.itemId,
                  (amounts.get(l.itemId) ?? 0) +
                    (Number(l.quantity) * Number(decimal(outputQuantity))) /
                      Number(recipe.outputQuantity),
                );
              setLines(
                [...amounts].map(([itemId, quantity]) => ({
                  itemId,
                  quantity: quantity.toFixed(6),
                  unit: data.items.find((i) => i.id === itemId)!.unit,
                  cost: "",
                })),
              );
            }}
          >
            Reçeteden girdileri öner
          </Button>
          <p className="text-sm text-muted-foreground">
            Aşağıdaki miktarları gerçek tüketimle düzeltin. Satışta yalnız
            üretilmiş stok düşer.
          </p>
        </FieldGroup>
      )}
      {lines.map((line, index) => {
        const item = data.items.find((i) => i.id === line.itemId);
        const units = item
          ? [
              item.unit,
              ...(item.unit === "g" ? ["kg"] : item.unit === "ml" ? ["l"] : []),
              ...Object.keys(item.conversions),
            ]
          : [];
        return (
          <FieldGroup
            className="grid gap-3 rounded-lg border p-4 sm:grid-cols-4"
            key={index}
          >
            <Choice
              label="Stok"
              value={line.itemId}
              onChange={(v) =>
                change(index, {
                  itemId: v,
                  unit: data.items.find((i) => i.id === v)?.unit ?? "",
                })
              }
            >
              <Option value="">Seçin</Option>
              {data.items
                .filter((i) => !i.archived)
                .map((i) => (
                  <Option key={i.id} value={i.id}>
                    {i.name}
                  </Option>
                ))}
            </Choice>
            <TextField
              label="Miktar"
              value={line.quantity}
              numeric
              onChange={(v) => change(index, { quantity: v })}
            />
            <Choice
              label="Giriş birimi"
              value={line.unit}
              onChange={(v) => change(index, { unit: v })}
              disabled={mode === "adjustment"}
            >
              <Option value="">Temel birim</Option>
              {units.map((u) => (
                <Option key={u} value={u}>
                  {u}
                </Option>
              ))}
            </Choice>
            {mode === "receipt" ? (
              <TextField
                label={`Birim fiyat (TL / ${line.unit || item?.unit || "birim"})`}
                hint="Faturadaki fiyat, seçtiğin giriş birimi başına."
                value={line.cost}
                numeric
                onChange={(v) => change(index, { cost: v })}
              />
            ) : (
              <p className="self-center text-sm text-muted-foreground">
                {item ? `${amount(item.quantity)} ${item.unit} mevcut` : ""}
              </p>
            )}
            {lines.length > 1 && (
              <Button
                className="w-fit max-w-full self-start justify-self-start"
                type="button"
                variant="ghost"
                onClick={() => {
                  setLines((rows) => rows.filter((_, i) => i !== index));
                }}
              >
                Satırı kaldır
              </Button>
            )}
          </FieldGroup>
        );
      })}
      <Button
        className="w-fit max-w-full self-start justify-self-start"
        type="button"
        variant="outline"
        onClick={() => {
          setLines((rows) => [
            ...rows,
            { itemId: "", quantity: "1", unit: "", cost: "" },
          ]);
        }}
      >
        Stok satırı ekle
      </Button>
      {preview && (
        <Alert>
          <AlertDescription>
            <div className="flex flex-col gap-2">
              <strong>Stok etkisi</strong>
              {normalized.map((l, i) => {
                const item = data.items.find((s) => s.id === l.itemId);
                return (
                  <p key={i}>
                    {item?.name}:{" "}
                    {["waste", "external_sale", "production"].includes(mode)
                      ? "−"
                      : mode === "adjustment"
                        ? ""
                        : "+"}
                    {amount(l.quantity)} {item?.unit}
                    {mode === "receipt" && l.cost !== null && l.quantity !== null && (
                      <> · {money(Number(l.quantity) * Number(l.cost))} ({money4(l.cost)} / {item?.unit})</>
                    )}
                    {item &&
                    Number(item.quantity) +
                      Number(l.quantity) *
                        (["waste", "external_sale", "production"].includes(mode)
                          ? -1
                          : 1) <
                      0
                      ? " — negatif stok oluşacak, işlem devam eder"
                      : ""}
                  </p>
                );
              })}
              {mode === "production" && (
                <p>
                  Çıktı: +{outputQuantity}{" "}
                  {data.items.find((i) => i.id === recipe?.outputItemId)?.unit}
                </p>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}
      <Button
        className="w-fit max-w-full self-start justify-self-start"
        type="submit"
        disabled={busy || !valid}
        aria-describedby={blockedReason ? "stock-operation-blocked" : undefined}
      >
        {busy
          ? "İşleniyor…"
          : preview
            ? "İşlemi kesinleştir"
            : "Stok etkisini incele"}
      </Button>
      {blockedReason && (
        <p id="stock-operation-blocked" className="-mt-3 text-sm text-muted-foreground">{blockedReason}</p>
      )}
    </form>
  );
}
