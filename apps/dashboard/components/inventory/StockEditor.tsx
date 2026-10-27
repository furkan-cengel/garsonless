"use client";
import { useState } from "react";
import type { StockItem } from "@garsonless/domain/inventory";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { TextField, Choice, Option, decimal } from "./inventory-controls";
export default function StockEditor({
  item,
  busy,
  save,
}: {
  item?: StockItem;
  busy: boolean;
  save: (payload: Record<string, unknown>) => void;
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
  const [conversions, setConversions] = useState<Array<[string, string]>>(
    Object.entries(item?.conversions ?? {}),
  );
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
