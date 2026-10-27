"use client";
import { useState } from "react";
import type { StockItem } from "@garsonless/domain/inventory";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { TextField, Choice, Option, decimal } from "./inventory-controls";
export default function StockEditor({
  item,
  busy,
  save,
  suppliers = [],
}: {
  item?: StockItem;
  busy: boolean;
  save: (payload: Record<string, unknown>) => void;
  /** Suppliers already used on other cards, offered as suggestions. */
  suppliers?: string[];
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [unit, setUnit] = useState(item?.unit ?? "g");
  const [kind, setKind] = useState(item?.kind ?? "raw");
  const [category, setCategory] = useState(item?.category ?? "");
  const [shelf, setShelf] = useState(item?.shelf ?? "");
  const [threshold, setThreshold] = useState(item?.threshold ?? "0");
  const [openingQuantity, setQuantity] = useState("0");
  const [openingCost, setCost] = useState("");
  const [archived, setArchived] = useState(item?.archived ?? false);
  const [supplier, setSupplier] = useState(item?.supplier ?? "");
  const [orderUnit, setOrderUnit] = useState(item?.orderUnit ?? "");
  const [conversions, setConversions] = useState<Array<[string, string]>>(
    Object.entries(item?.conversions ?? {}),
  );
  const orderUnitChoices = [
    unit,
    ...(unit === "g" ? ["kg"] : unit === "ml" ? ["l"] : []),
    ...conversions.map(([key]) => key.trim()).filter(Boolean),
  ];
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        save({
          // detailsVersion lets the edit succeed while sales keep moving the quantity.
          ...(item ? { id: item.id, version: item.version, ...(item.detailsVersion !== undefined ? { detailsVersion: item.detailsVersion } : {}) } : {}),
          name,
          unit,
          kind,
          category,
          shelf,
          threshold: decimal(threshold),
          archived,
          supplier: supplier.trim(),
          // A custom unit that was removed in this edit cannot stay the order unit.
          orderUnit: orderUnitChoices.some((u) => u === orderUnit) ? orderUnit : "",
          conversions: Object.fromEntries(
            conversions.map(([k, v]) => [k.trim(), decimal(v)]),
          ),
          ...(!item
            ? {
                openingQuantity: decimal(openingQuantity),
                openingCost: decimal(openingCost),
              }
            : {}),
        });
      }}
    >
      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <TextField label="Stok adı" value={name} onChange={setName} />
        <Choice
          label="Tür"
          hint="Hammadde: satın aldığın malzeme (süt, kahve). Yarı mamul: mutfakta hazırladığın ara ürün (sos). Hazır ürün: olduğu gibi satılan (şişe su)."
          value={kind}
          onChange={(v) => setKind(v as StockItem["kind"])}
        >
          <Option value="raw">Hammadde</Option>
          <Option value="finished">Hazır ürün</Option>
          <Option value="prepared">Yarı mamul</Option>
        </Choice>
        <Choice
          label="Temel birim"
          hint="Stoğun sayıldığı en küçük birim; sonradan değiştirilemez. Örn. süt için ml, kahve çekirdeği için g."
          value={unit}
          onChange={(v) => setUnit(v as StockItem["unit"])}
          disabled={!!item}
        >
          <Option value="g">Gram (g)</Option>
          <Option value="ml">Mililitre (ml)</Option>
          <Option value="adet">Adet</Option>
        </Choice>
        <TextField
          label={`Kritik eşik (${unit})`}
          hint="Stok bu miktara veya altına inince genel bakışta uyarı görürsün."
          value={threshold}
          onChange={setThreshold}
          numeric
        />
        <TextField label="Kategori" value={category} onChange={setCategory} />
        <TextField
          label="Raf / sayım sırası etiketi"
          value={shelf}
          onChange={setShelf}
        />
        <Field>
          <FieldLabel htmlFor="stock-supplier">Tedarikçi</FieldLabel>
          <Input id="stock-supplier" list="stock-supplier-options" value={supplier} maxLength={80} placeholder="Örn. Yerel bayi" onChange={(e) => setSupplier(e.target.value)} />
          <datalist id="stock-supplier-options">{suppliers.map((name) => <option key={name} value={name} />)}</datalist>
          <FieldDescription>Sipariş listesi stokları tedarikçiye göre gruplar.</FieldDescription>
        </Field>
        <Choice
          label="Sipariş birimi"
          hint="Tedarikçiden hangi birimle alıyorsun? Sipariş önerisi bu birimle hesaplanır."
          value={orderUnitChoices.includes(orderUnit) ? orderUnit : ""}
          onChange={setOrderUnit}
        >
          <Option value="">{unit} (temel birim)</Option>
          {orderUnitChoices.slice(1).map((choice) => <Option key={choice} value={choice}>{choice === "l" ? "L" : choice}</Option>)}
        </Choice>
        {!item && (
          <>
            <TextField
              label={`Açılış miktarı (${unit})`}
              value={openingQuantity}
              onChange={setQuantity}
              numeric
            />
            <TextField
              label={`Birim maliyet (TL / ${unit}, bilinmiyorsa boş)`}
              value={openingCost}
              onChange={setCost}
              numeric
            />
          </>
        )}
      </FieldGroup>
      <p className="text-sm text-muted-foreground">
        kg → g ve litre → ml dönüşümleri hazırdır. Koli gibi özel birimleri
        aşağıda tanımlayın.
      </p>
      {conversions.map(([key, value], index) => (
        <FieldGroup key={index} className="grid gap-3 sm:grid-cols-3">
          <TextField
            label="Birim adı"
            value={key}
            onChange={(v) =>
              setConversions((rows) =>
                rows.map((row, i) => (i === index ? [v, row[1]] : row)),
              )
            }
          />
          <TextField
            label={`1 birim kaç ${unit}?`}
            value={value}
            numeric
            onChange={(v) =>
              setConversions((rows) =>
                rows.map((row, i) => (i === index ? [row[0], v] : row)),
              )
            }
          />
          <Button
            className="w-fit max-w-full self-start justify-self-start"
            type="button"
            variant="ghost"
            onClick={() =>
              setConversions((rows) => rows.filter((_, i) => i !== index))
            }
          >
            Birimi kaldır
          </Button>
        </FieldGroup>
      ))}
      <Button
        className="w-fit max-w-full self-start justify-self-start"
        type="button"
        variant="outline"
        onClick={() => setConversions((rows) => [...rows, ["", "1"]])}
      >
        Özel birim ekle
      </Button>
      {item && (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={archived}
            onCheckedChange={(v) => setArchived(v === true)}
          />
          Arşivle (aktif reçeteden önce kaldırın)
        </label>
      )}
      <Button
        className="w-fit max-w-full self-start justify-self-start"
        type="submit"
        disabled={busy || !name.trim()}
      >
        {busy ? "Kaydediliyor…" : "Stok kartını kaydet"}
      </Button>
    </form>
  );
}
