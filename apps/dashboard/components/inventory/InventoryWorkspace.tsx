"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { inventoryAction } from "@/lib/actions/inventory";
import {
  INVENTORY_ERRORS,
  inventoryCsv,
  parseInventoryCsv,
  type InventoryDocument,
  type InventoryMode,
  type InventoryError,
  type InventorySnapshot,
  type StockItem,
} from "@garsonless/domain/inventory";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import StockEditor from "./StockEditor";
import RecipeEditor from "./RecipeEditor";
import StockOperation from "./StockOperation";
import StockCount from "./StockCount";
import { ConfirmAction, TextField, amount, money, kinds, unitCost } from "./inventory-controls";
import { STOCK_IMPORT_TEMPLATE, readStockImport, type StockImportRow } from "./inventory-model";
const SECTIONS: Array<[string, Array<[string, string]>]> = [
  ["Özet", [["overview", "Genel bakış"]]],
  ["Kurulum", [["items", "Stoklar"], ["recipes", "Reçeteler"]]],
  ["Günlük", [["operations", "İşlemler"], ["counts", "Sayım"]]],
  ["Rapor", [["history", "Hareketler ve raporlar"]]],
];
function download(name: string, content: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
export default function InventoryWorkspace({
  restaurantId,
  isOwner,
  initial,
  initialMenuItemId,
  initialError,
}: {
  restaurantId: string;
  isOwner: boolean;
  initial: InventorySnapshot | null;
  initialMenuItemId?: string;
  initialError?: InventoryError;
}) {
  const [documentDetail, setDocumentDetail] =
    useState<InventoryDocument | null>(null);
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const [error, setError] = useState(
    initialError ? INVENTORY_ERRORS[initialError] : "",
  );
  const errorAnchor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) errorAnchor.current?.scrollIntoView({ block: "nearest" });
  }, [error]);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState(initialMenuItemId ? "recipes" : "overview");
  const [editor, setEditor] = useState<StockItem | "new" | null>(null);
  const [csv, setCsv] = useState("");
  const [csvPreview, setCsvPreview] = useState<StockImportRow[] | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [trackingConfirm, setTrackingConfirm] = useState<"activate" | "pause" | null>(null);
  const [countFocus, setCountFocus] = useState<string>();
  const [countRevision, setCountRevision] = useState(0);
  const [editorVersion, setEditorVersion] = useState(0);
  const [recipeTarget, setRecipeTarget] = useState<string | undefined>(initialMenuItemId);
  // The editor sits below the coverage list; picking a product must bring it into view.
  const recipeEditorRef = useRef<HTMLDivElement>(null);
  const [recipeJump, setRecipeJump] = useState(0);
  useEffect(() => {
    if (!recipeJump) return;
    const editorElement = recipeEditorRef.current;
    editorElement?.scrollIntoView({ block: "start", behavior: "smooth" });
    editorElement?.querySelector<HTMLSelectElement>("select")?.focus({ preventScroll: true });
  }, [recipeJump]);
  const pending = useRef<{ signature: string; key: string } | null>(null);
  useEffect(() => {
    const timer = setInterval(() => {
      if (!working.current && document.visibilityState === "visible")
        void inventoryAction({ restaurantId, mode: "snapshot" })
          .then((r) => {
            if (r.ok)
              setData((current) =>
                current?.movementOffset
                  ? current
                  : (r.data as InventorySnapshot),
              );
          })
          .catch(() => {
            // Background refresh must not discard unsaved work or report success.
          });
    }, 30000);
    return () => clearInterval(timer);
  }, [restaurantId]);
  // Recipes, operations and counts all pick from stock cards; without any the
  // forms are dead dropdowns, so lead to the missing step instead.
  // A result message belongs to the section it came from.
  const showSection = (value: string) => {
    setTab(value);
    setMessage("");
  };
  const needsStock = (task: string) => (
    <Empty className="border">
      <EmptyHeader>
        <EmptyTitle>Önce bir stok kartı ekleyin</EmptyTitle>
        <EmptyDescription>{task} için seçilecek malzeme yok. Stok kartı ekleyince bu ekran açılır.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button className="w-fit" disabled={busy} onClick={() => setEditor("new")}>Stok kartı ekle</Button>
      </EmptyContent>
    </Empty>
  );
  async function refresh(offset = 0) {
    try {
      const r = await inventoryAction({
        restaurantId,
        mode: "snapshot",
        payload: {
          offset,
          ...(offset && data?.asOf ? { before: data.asOf } : {}),
        },
      });
      if (r.ok) {
        setData(r.data as InventorySnapshot);
        return true;
      }
      setError(INVENTORY_ERRORS[r.error]);
      return false;
    } catch {
      setError(INVENTORY_ERRORS.unavailable);
      return false;
    }
  }
  async function run(mode: InventoryMode, payload: Record<string, unknown>) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    const signature = JSON.stringify({ mode, payload });
    if (pending.current?.signature !== signature)
      pending.current = { signature, key: crypto.randomUUID() };
    try {
      const r = await inventoryAction({
        restaurantId,
        mode,
        payload,
        requestId: pending.current.key,
      });
      if (!r.ok) {
        setError(INVENTORY_ERRORS[r.error]);
        return;
      }
      pending.current = null;
      const warnings =
        "warnings" in r.data && Array.isArray(r.data.warnings)
          ? r.data.warnings
          : [];
      setMessage(
        warnings.length
          ? "İşlem kaydedildi. Kritik stok veya eksik maliyet var; genel bakıştaki uyarıları inceleyin."
          : "İşlem kaydedildi.",
      );
      setEditor(null);
      if (mode === "import") {
        setImportOpen(false);
        setCsv("");
        setCsvPreview(null);
      }
      if (
        mode === "recipe" ||
        [
          "receipt",
          "waste",
          "adjustment",
          "external_sale",
          "production",
          "return",
        ].includes(mode)
      )
        setEditorVersion((v) => v + 1);
      await refresh();
      if (mode === "count_save" || mode === "count_approve") {
        setCountFocus(
          String(
            mode === "count_save"
              ? "id" in r.data
                ? r.data.id
                : ""
              : payload.id,
          ),
        );
        setCountRevision((v) => v + 1);
      }
    } catch {
      setError(INVENTORY_ERRORS.unavailable);
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  async function exportHistory() {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      const rows: unknown[][] = [
        [
          "Tarih",
          "Stok",
          "İşlem",
          "Miktar",
          "Birim maliyet TL",
          "Gerekçe",
          "İşlemi yapan",
          "Belge",
          "Sipariş",
        ],
      ];
      let offset = 0;
      let before: string | undefined;
      for (;;) {
        const r = await inventoryAction({
          restaurantId,
          mode: "snapshot",
          payload: { offset, before },
        });
        if (!r.ok) throw new Error(INVENTORY_ERRORS[r.error]);
        const snapshot = r.data as InventorySnapshot;
        before ??= snapshot.asOf;
        rows.push(
          ...snapshot.movements.map((m) => [
            m.createdAt,
            m.name,
            kinds[m.kind] ?? m.kind,
            m.quantity,
            m.cost,
            m.reason,
            m.actor,
            m.documentId,
            m.orderId,
          ]),
        );
        if (!snapshot.hasMore) break;
        offset += 100;
      }
      download("stok-hareketleri.csv", inventoryCsv(rows));
    } catch {
      setError("Dışa aktarma tamamlanamadı. Yeniden deneyin.");
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  async function openDocument(id: string) {
    setError("");
    try {
      const r = await inventoryAction({
        restaurantId,
        mode: "snapshot",
        payload: { documentId: id },
      });
      if (r.ok)
        setDocumentDetail((r.data as InventorySnapshot).document ?? null);
      else setError(INVENTORY_ERRORS[r.error]);
    } catch {
      setError(INVENTORY_ERRORS.unavailable);
    }
  }
  function previewCsv() {
    setError("");
    setCsvPreview(null);
    try {
      setCsvPreview(readStockImport(parseInventoryCsv(csv), data?.items.map((i) => i.name) ?? []));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "CSV okunamadı.");
    }
  }
  if (!data)
    return (
      <div className="p-6">
        <Alert variant="destructive" ref={errorAnchor}>
          <AlertTitle>Stok yüklenemedi</AlertTitle>
          <AlertDescription>
            {!error || error === INVENTORY_ERRORS.unavailable
              ? "Stok verisi alınamadı. Bağlantınızı kontrol edip yeniden deneyin."
              : error}
          </AlertDescription>
        </Alert>
        <Button
          className="w-fit max-w-full self-start justify-self-start mt-4"
          onClick={() => {
            void refresh();
          }}
        >
          Yeniden dene
        </Button>
      </div>
    );
  const active = data.items.filter((i) => !i.archived);
  const critical = active.filter(
    (i) => Number(i.quantity) <= Number(i.threshold),
  );
  const untracked = data.menuItems.filter(
    (i) =>
      !data.recipes.some((r) => r.menuItemId === i.id && r.mode !== "none"),
  );
  const incompleteMappings = data.menuItems.filter((i) => {
    const recipe = data.recipes.find(
      (r) => r.menuItemId === i.id && r.mode !== "none",
    );
    return (
      recipe &&
      (i.ingredients.some(
        (x) =>
          x.removable &&
          !recipe.lines.some((l) => !l.optionId && l.ingredientId === x.id),
      ) ||
        i.modifiers.some((g) =>
          g.options.some(
            (o) =>
              !recipe.lines.some(
                (l) => l.groupId === g.id && l.optionId === o.id,
              ),
          ),
        ))
    );
  });
  const filtered = data.items.filter((i) =>
    `${i.name} ${i.category} ${i.shelf}`
      .toLocaleLowerCase("tr-TR")
      .includes(query.toLocaleLowerCase("tr-TR")),
  );
  const knownValue = active.reduce(
    (sum, i) => sum + Math.max(0, Number(i.quantity)) * Number(i.cost ?? 0),
    0,
  );
  return (
    <section
      aria-label="Stok çalışma alanı"
      tabIndex={0}
      className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain"
      aria-busy={busy}
    >
      <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Stok</h1>
            <p className="text-sm text-muted-foreground">
              Malzemeden porsiyona, her hareketi takip edin.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              className="w-fit max-w-full self-start justify-self-start"
              variant="outline"
              disabled={busy}
              onClick={() => {
                void refresh(data.movementOffset);
              }}
            >
              Yenile
            </Button>
            {/* With no stock yet every tab shows its own "add a stock card" call to action. */}
            {data.items.length > 0 && (
              <Button
                className="w-fit max-w-full self-start justify-self-start"
                disabled={busy}
                onClick={() => setEditor("new")}
              >
                Stok ekle
              </Button>
            )}
          </div>
        </div>
        {error && (
          <Alert variant="destructive" ref={errorAnchor}>
            <AlertTitle>İşlem tamamlanamadı</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
        {!data.enabled && data.items.length > 0 && (
          <Alert className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <AlertTitle>Otomatik tüketim kapalı</AlertTitle>
              <AlertDescription>
                Reçeteleri ve mevcut stok miktarlarını kontrol ederek takibi
                başlatın.
                {data.legacyOpenOrders > 0 &&
                  ` Mevcut ${data.legacyOpenOrders} açık siparişten geriye dönük tüketim yapılmaz.`}
              </AlertDescription>
            </div>
            {isOwner && (
              <Button
                className="w-fit max-w-full self-start justify-self-start shrink-0"
                disabled={busy || !active.length}
                onClick={() => setTrackingConfirm("activate")}
              >
                Stoklar güncel, takibi başlat
              </Button>
            )}
          </Alert>
        )}
        <Tabs value={tab} onValueChange={(v) => showSection(String(v))}>
          {/* On a phone six tabs do not fit; the same sections become one grouped select. */}
          <Field className="sm:hidden">
            <FieldLabel htmlFor="inventory-section">Bölüm</FieldLabel>
            <NativeSelect id="inventory-section" className="w-full" value={tab} onChange={(e) => showSection(e.target.value)}>
              {SECTIONS.map(([group, sections]) => (
                <NativeSelectOptGroup key={group} label={group}>
                  {sections.map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}
                </NativeSelectOptGroup>
              ))}
            </NativeSelect>
          </Field>
          <div className="hidden overflow-x-auto sm:block">
            {/* Six tabs read as three jobs: set up once, run daily, review. */}
            <TabsList>
              {[
                ["overview", "Genel bakış", null],
                ["items", "Stoklar", "Kurulum"],
                ["recipes", "Reçeteler", null],
                ["operations", "İşlemler", "Günlük"],
                ["counts", "Sayım", null],
                ["history", "Hareketler ve raporlar", "Rapor"],
              ].map(([value, label, group]) => (
                <span key={value} className="contents">
                  {group && (
                    <span aria-hidden="true" className="ml-2 border-l pl-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {group}
                    </span>
                  )}
                  <TabsTrigger value={value!}>{label}</TabsTrigger>
                </span>
              ))}
            </TabsList>
          </div>
          <TabsContent value="overview" className="flex flex-col gap-5 pt-4">
            {!data.items.length && (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyTitle>Stoklarınızı ekleyerek başlayın</EmptyTitle>
                  <EmptyDescription>
                    Önce malzemelerinizi ve açılış miktarlarını ekleyin. Sonra
                    reçeteleri eşleyip otomatik tüketimi başlatın. Menü ürünleri
                    kendiliğinden stok kartına dönüşmez.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button
                      className="w-fit max-w-full self-start justify-self-start"
                      disabled={busy}
                      onClick={() => setEditor("new")}
                    >
                      İlk stok kartını ekle
                    </Button>
                    {isOwner && (
                      <Button
                        className="w-fit max-w-full self-start justify-self-start"
                        disabled={busy}
                        variant="outline"
                        onClick={() => setImportOpen(true)}
                      >
                        CSV ile stok yükle
                      </Button>
                    )}
                  </div>
                </EmptyContent>
              </Empty>
            )}
            {data.items.length > 0 && (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    ["Kritik / negatif stok", critical.length],
                    ["Takip edilmeyen ürün", untracked.length],
                    ["Bilinen pozitif stok değeri", money(knownValue)],
                  ].map(([label, value]) => (
                    <Card key={label}>
                      <CardHeader>
                        <CardDescription>{label}</CardDescription>
                        <CardTitle>{value}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          {label === "Bilinen pozitif stok değeri"
                            ? `${active.filter((i) => i.cost === null).length} stokta maliyet eksik; negatif miktarlar hariç.`
                            : "Detayları aşağıda inceleyin."}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <Card>
                  <CardHeader>
                    <CardTitle>Dikkat gereken stoklar</CardTitle>
                    <CardDescription>
                      Stok yetersizliği satışı durdurmaz. Gerekirse ürünü
                      menüden satışa kapatın.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    {critical.length ? (
                      critical.map((i) => (
                        <div key={i.id} className="flex justify-between gap-2">
                          <span>{i.name}</span>
                          <Badge
                            variant={
                              Number(i.quantity) < 0
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {amount(i.quantity)} {i.unit}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Kritik stok bulunmuyor.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
            <Card>
              <CardHeader>
                <CardTitle>Takip kapsamı</CardTitle>
                <CardDescription>
                  İçerik açıklamaları kendiliğinden stok reçetesine dönüşmez.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm">
                  {untracked.map((i) => i.name).join(", ") ||
                    "Tüm menü ürünleri eşlendi."}
                </p>
                {incompleteMappings.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Seçenek eşlemelerini kontrol edin:{" "}
                    {incompleteMappings.map((i) => i.name).join(", ")}.
                    Eşlenmeyen ekstra ve çıkarma seçimleri tüketimi değiştirmez.
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  Son onaylı sayım:{" "}
                  {data.counts.find((c) => c.status === "approved")
                    ? new Date(
                        data.counts.find((c) => c.status === "approved")!
                          .createdAt,
                      ).toLocaleString("tr-TR")
                    : "Henüz yok"}
                </p>
                <Button
                  className="w-fit max-w-full self-start justify-self-start"
                  variant="outline"
                  onClick={() => setTab("recipes")}
                >
                  Reçeteleri düzenle
                </Button>
                <Link
                  className="text-sm underline"
                  href={`/dashboard/${restaurantId}/menu`}
                >
                  Menü yönetimine git
                </Link>
              </CardContent>
            </Card>
            {isOwner && data.enabled && (
              <Button
                className="w-fit max-w-full self-start justify-self-start"
                variant="outline"
                disabled={busy}
                onClick={() => setTrackingConfirm("pause")}
              >
                Otomatik takibi duraklat
              </Button>
            )}
          </TabsContent>
          <TabsContent value="items" className="flex flex-col gap-4 pt-4">
            <FieldGroup>
              <TextField
                label="Stok, kategori veya raf ara"
                value={query}
                onChange={setQuery}
              />
            </FieldGroup>
            {isOwner && (
              <Button
                className="w-fit max-w-full self-start justify-self-start"
                variant="outline"
                onClick={() => setImportOpen(true)}
              >
                CSV ile stok ekle
              </Button>
            )}
            {!data.items.length ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>İlk stok kartınızı ekleyin</EmptyTitle>
                  <EmptyDescription>
                    Örneğin kahve çekirdeği, süt veya şişe su ile başlayın.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <>
              {/* Phones get one card per stock so the edit action is never off-screen. */}
              <ul className="m-0 flex list-none flex-col gap-2 p-0 sm:hidden">
                {filtered.map((i) => (
                  <li key={i.id} className="flex items-start gap-3 rounded-lg border bg-card p-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{i.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {kinds[i.kind]}{i.archived ? " · Arşiv" : ""}{[i.category, i.shelf].filter(Boolean).length ? ` · ${[i.category, i.shelf].filter(Boolean).join(" · ")}` : ""}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                        <Badge variant={Number(i.quantity) < 0 ? "destructive" : "secondary"}>{amount(i.quantity)} {i.unit}</Badge>
                        <span className="text-muted-foreground">{unitCost(i.cost, i.unit)}</span>
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="min-h-11" onClick={() => setEditor(i)} aria-label={`${i.name} düzenle`}>Düzenle</Button>
                  </li>
                ))}
              </ul>
              <Table className="hidden sm:table">
                <TableHeader>
                  <TableRow>
                    {["Stok", "Miktar", "Birim maliyet", "Konum", ""].map(
                      (v, i) => (
                        <TableHead key={i}>{v}</TableHead>
                      ),
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>
                        <span className="font-medium">{i.name}</span>
                        <p className="text-xs text-muted-foreground">
                          {kinds[i.kind]}
                          {i.archived ? " · Arşiv" : ""}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            Number(i.quantity) < 0 ? "destructive" : "secondary"
                          }
                        >
                          {amount(i.quantity)} {i.unit}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {unitCost(i.cost, i.unit)}
                      </TableCell>
                      <TableCell>
                        {i.category} · {i.shelf}
                      </TableCell>
                      <TableCell>
                        <Button
                          className="w-fit max-w-full self-start justify-self-start"
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditor(i)}
                        >
                          Düzenle
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </>
            )}
          </TabsContent>
          <TabsContent value="recipes" className="pt-4">
            {!data.items.length ? needsStock("Reçete yazmak") : <>
            {/* Coverage first: which menu items consume stock, which do not yet. */}
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>Reçete kapsamı</CardTitle>
                <CardDescription>
                  {data.menuItems.length - untracked.length} / {data.menuItems.length} menü ürününde reçete var.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="m-0 flex list-none flex-col divide-y p-0">
                  {data.menuItems.map((menuItem) => {
                    const missing = untracked.some((i) => i.id === menuItem.id);
                    const partial = !missing && incompleteMappings.some((i) => i.id === menuItem.id);
                    return (
                      <li key={menuItem.id} className="flex items-center gap-3 py-2 text-sm">
                        <span className="min-w-0 flex-1 truncate">{menuItem.name}</span>
                        <Badge variant={missing ? "secondary" : partial ? "warning" : "positive"}>
                          {missing ? "Reçete yok" : partial ? "Seçenek eşlemesi eksik" : "Reçete var"}
                        </Badge>
                        <Button variant="ghost" size="sm" aria-pressed={recipeTarget === menuItem.id} onClick={() => { setRecipeTarget(menuItem.id); setRecipeJump((value) => value + 1); }}>
                          {missing ? "Reçete yaz" : "Düzenle"}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
            <div ref={recipeEditorRef} className="scroll-mt-4">
            <RecipeEditor
              key={`${editorVersion}:${recipeTarget ?? ""}`}
              initialMenuItemId={recipeTarget}
              data={data}
              busy={busy}
              save={(payload) => {
                void run("recipe", payload);
              }}
            />
            </div>
            </>}
          </TabsContent>
          <TabsContent value="operations" className="pt-4">
            {!data.items.length ? needsStock("Mal kabul, fire veya düzeltme kaydetmek") : <StockOperation
              key={editorVersion}
              data={data}
              isOwner={isOwner}
              busy={busy}
              save={(mode, payload) => {
                void run(mode, payload);
              }}
            />}
          </TabsContent>
          <TabsContent value="counts" className="pt-4">
            {!data.items.length ? needsStock("Sayım yapmak") : <StockCount
              key={countRevision}
              initialCountId={countFocus}
              data={data}
              isOwner={isOwner}
              busy={busy}
              save={(mode, payload) => {
                void run(mode, payload);
              }}
            />}
          </TabsContent>
          <TabsContent value="history" className="flex flex-col gap-4 pt-4">
            <div className="flex flex-wrap gap-3">
              <Button
                className="w-fit max-w-full self-start justify-self-start"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  void exportHistory();
                }}
              >
                Tüm hareketleri CSV indir
              </Button>
              <Button
                className="w-fit max-w-full self-start justify-self-start"
                variant="outline"
                onClick={() =>
                  download(
                    "stok-ozeti.csv",
                    inventoryCsv([
                      [
                        "Stok",
                        "Miktar",
                        "Birim",
                        "Birim maliyet",
                        "Kritik eşik",
                      ],
                      ...data.items.map((i) => [
                        i.name,
                        i.quantity,
                        i.unit,
                        i.cost,
                        i.threshold,
                      ]),
                    ]),
                  )
                }
              >
                Stok özetini indir
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {data.movements.length
                ? `Hareket ${data.movementOffset + 1}–${data.movementOffset + data.movements.length}. `
                : "Henüz stok hareketi yok. "}
              Üretim girdileri/çıktıları ve sayım farkları ayrı kaydedilir.
              Sayım farkı tek başına fire değildir.
            </p>
            <ul className="m-0 flex list-none flex-col gap-2 p-0 sm:hidden">
              {data.movements.map((m) => (
                <li key={m.id} className="rounded-lg border bg-card p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{kinds[m.kind] ?? m.kind} · {m.actor} · {new Date(m.createdAt).toLocaleString("tr-TR")}</p>
                    </div>
                    <span className={Number(m.quantity) < 0 ? "shrink-0 font-medium text-destructive" : "shrink-0 font-medium"}>{amount(m.quantity)}</span>
                  </div>
                  <Button className="mt-1 h-auto min-h-11 px-0 text-left whitespace-normal" variant="link" size="sm" onClick={() => { void openDocument(m.documentId); }}>
                    {m.reason || `${kinds[m.kind] ?? "İşlem"} belgesi`}
                  </Button>
                </li>
              ))}
            </ul>
            <Table className="hidden sm:table">
              <TableHeader>
                <TableRow>
                  {["Tarih", "Stok / işlem", "Miktar", "Maliyet", "Kaynak"].map(
                    (h) => (
                      <TableHead key={h}>{h}</TableHead>
                    ),
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      {new Date(m.createdAt).toLocaleString("tr-TR")}
                    </TableCell>
                    <TableCell>
                      {m.name}
                      <p className="text-xs text-muted-foreground">
                        {kinds[m.kind] ?? m.kind} · {m.actor}
                      </p>
                    </TableCell>
                    <TableCell>{amount(m.quantity)}</TableCell>
                    <TableCell>{money(m.cost)}</TableCell>
                    <TableCell>
                      <Button
                        className="w-fit max-w-full self-start justify-self-start"
                        variant="link"
                        size="sm"
                        onClick={() => {
                          void openDocument(m.documentId);
                        }}
                      >
                        {/* Opening balances carry no reason; name the document, not its id. */}
                        {m.reason || `${kinds[m.kind] ?? "İşlem"} belgesi`}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex gap-3">
              <Button
                className="w-fit max-w-full self-start justify-self-start"
                variant="outline"
                disabled={!data.movementOffset || busy}
                onClick={() => {
                  void refresh(Math.max(0, data.movementOffset - 100));
                }}
              >
                Önceki
              </Button>
              <Button
                className="w-fit max-w-full self-start justify-self-start"
                variant="outline"
                disabled={!data.hasMore || busy}
                onClick={() => {
                  void refresh(data.movementOffset + 100);
                }}
              >
                Sonraki
              </Button>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Tüketim ve fark raporu</CardTitle>
                <CardDescription>
                  Tüm kayıtlı hareketler; sayfalama bu toplamları etkilemez.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-fit max-w-full self-start justify-self-start"
                  variant="outline"
                  onClick={() =>
                    download(
                      "stok-tuketim-raporu.csv",
                      inventoryCsv([
                        ["Stok", "İşlem", "Miktar", "Hareket maliyeti TL"],
                        ...(data.summary ?? []).map((s) => [
                          data.items.find((i) => i.id === s.itemId)?.name,
                          kinds[s.kind] ?? s.kind,
                          s.quantity,
                          s.value,
                        ]),
                      ]),
                    )
                  }
                >
                  Raporu indir
                </Button>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Stok</TableHead>
                      <TableHead>Hareket</TableHead>
                      <TableHead>Miktar</TableHead>
                      <TableHead>Hareket maliyeti</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data.summary ?? []).map((s) => (
                      <TableRow key={s.itemId + s.kind}>
                        <TableCell>
                          {data.items.find((i) => i.id === s.itemId)?.name}
                        </TableCell>
                        <TableCell>{kinds[s.kind] ?? s.kind}</TableCell>
                        <TableCell>{amount(s.quantity)}</TableCell>
                        <TableCell>{money(s.value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>İptal firesi</CardTitle>
                <CardDescription>
                  Hazırlık başladıktan sonra iptal edilen tüketim. Bu liste
                  stoku ikinci kez düşürmez.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.cancelledWaste.length ? (
                  data.cancelledWaste.map((w) => (
                    <p key={w.orderId + w.itemId} className="text-sm">
                      {w.orderId.slice(0, 8)} · {w.name}:{" "}
                      {amount(Number(w.quantity) - Number(w.returned))}{" "}
                      {data.items.find((i) => i.id === w.itemId)?.unit}
                    </p>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    İptal firesi yok.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        <ConfirmAction
          open={trackingConfirm !== null}
          title={trackingConfirm === "pause" ? "Otomatik takip duraklatılsın mı?" : "Otomatik takip başlatılsın mı?"}
          description={trackingConfirm === "pause"
            ? "Duraklatma süresince satışlar stoktan düşmez ve bu satışlar sonradan geriye dönük düşülmez. Takibi yeniden başlatmadan önce sayım yapmanız gerekebilir."
            : `Bundan sonraki her siparişte reçetelerdeki malzemeler stoktan düşer.${data.legacyOpenOrders > 0 ? ` Şu an açık olan ${data.legacyOpenOrders} siparişten geriye dönük tüketim yapılmaz.` : ""} Başlatmadan önce mevcut miktarların güncel olduğundan emin olun.`}
          confirmLabel={trackingConfirm === "pause" ? "Takibi duraklat" : "Takibi başlat"}
          destructive={trackingConfirm === "pause"}
          onCancel={() => setTrackingConfirm(null)}
          onConfirm={() => {
            const mode = trackingConfirm;
            setTrackingConfirm(null);
            if (mode === "activate") void run("activate", { confirmed: true });
            else if (mode === "pause") void run("pause", {});
          }}
        />
        <Dialog
          open={documentDetail !== null}
          onOpenChange={(open) => {
            if (!open) setDocumentDetail(null);
          }}
        >
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {documentDetail
                  ? (kinds[documentDetail.kind] ?? documentDetail.kind)
                  : "Stok belgesi"}
              </DialogTitle>
              <DialogDescription>
                {documentDetail?.actor} ·{" "}
                {documentDetail
                  ? new Date(documentDetail.createdAt).toLocaleString("tr-TR")
                  : ""}
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm">
              {documentDetail?.reason || "Otomatik stok hareketi"}
            </p>
            <p className="break-all text-xs text-muted-foreground">
              Belge: {documentDetail?.id}
            </p>
            {documentDetail?.lines.map((l, i) => (
              <div key={i} className="rounded-lg border p-3">
                <p>
                  {l.name}: {amount(l.quantity)} {l.unit}
                </p>
                <p className="text-sm text-muted-foreground">
                  Birim maliyet: {money(l.cost)}
                  {l.reversalOf ? " · Önceki hareketin iadesi" : ""}
                </p>
              </div>
            ))}
            {documentDetail?.order && (
              <div className="flex flex-col gap-2 border-t pt-3">
                <p className="font-medium">
                  Kaynak sipariş · {documentDetail.order.id.slice(0, 8)}
                </p>
                <p className="text-sm">
                  {(
                    {
                      pending_approval: "Onay bekliyor",
                      sent_to_kitchen: "Mutfağa gönderildi",
                      preparing: "Hazırlanıyor",
                      ready: "Hazır",
                      served: "Servis edildi",
                      cancelled: "İptal",
                      paid: "Ödendi",
                    } as Record<string, string>
                  )[documentDetail.order.status] ?? documentDetail.order.status}
                </p>
                {documentDetail.order.items.map((l, i) => (
                  <p className="text-sm" key={i}>
                    {l.quantity} × {l.name}
                  </p>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
        <Dialog
          open={editor !== null}
          onOpenChange={(open) => {
            if (!open && !busy) setEditor(null);
          }}
        >
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editor === "new" ? "Stok ekle" : "Stok kartı"}
              </DialogTitle>
              <DialogDescription>
                Miktar değişiklikleri hareket defterine kaydedilir.
              </DialogDescription>
            </DialogHeader>
            {error && (
              <Alert variant="destructive" ref={errorAnchor}>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {editor && (
              <StockEditor
                key={editor === "new" ? "new" : editor.id}
                item={editor === "new" ? undefined : editor}
                busy={busy}
                save={(payload) => {
                  void run("item", payload);
                }}
              />
            )}
          </DialogContent>
        </Dialog>
        <Dialog
          open={importOpen}
          onOpenChange={(open) => {
            if (!busy) setImportOpen(open);
          }}
        >
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>CSV ile yeni stoklar</DialogTitle>
              <DialogDescription>
                Sütunlar: ad, tür, birim, miktar, maliyet, eşik, kategori, raf.
                Tür: Hammadde, Hazır ürün veya Yarı mamul. Birim: g, ml veya adet.
                Maliyet birim başına TL’dir; bilinmiyorsa boş bırakın. Excel’den
                kaydedilen CSV doğrudan okunur.
              </DialogDescription>
            </DialogHeader>
            {error && (
              <Alert variant="destructive" ref={errorAnchor}>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button
              className="w-fit max-w-full self-start justify-self-start"
              variant="outline"
              onClick={() =>
                download("stok-sablonu.csv", inventoryCsv(STOCK_IMPORT_TEMPLATE))
              }
            >
              Şablonu indir
            </Button>
            <label className="text-sm">
              CSV dosyası
              <input
                type="file"
                accept=".csv,text/csv"
                className="block w-full py-2"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  // A cancelled picker clears the selection; that is not an error.
                  if (!file) return;
                  if (file.size < 700000) {
                    setError("");
                    setCsv(await file.text());
                    setCsvPreview(null);
                  } else setError("Dosya 700 KB’den küçük olmalı.");
                }}
              />
            </label>
            <Textarea
              aria-label="CSV içeriği"
              value={csv}
              onChange={(e) => {
                setCsv(e.target.value);
                setCsvPreview(null);
              }}
              rows={7}
            />
            <Button
              className="w-fit max-w-full self-start justify-self-start"
              variant="outline"
              onClick={previewCsv}
            >
              Satırları kontrol et
            </Button>
            {csvPreview && (
              <>
                <p>{csvPreview.length} yeni stok kartı eklenecek:</p>
                <div className="max-h-48 overflow-y-auto">
                  {csvPreview.map((i, index) => (
                    <p key={index} className="text-sm">
                      {i.name} · {amount(i.openingQuantity)} {i.unit} · {kinds[i.kind]}
                    </p>
                  ))}
                </div>
                <Button
                  className="w-fit max-w-full self-start justify-self-start"
                  disabled={busy}
                  onClick={() => {
                    void run("import", { items: csvPreview });
                  }}
                >
                  Önizlemeyi içe aktar
                </Button>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}
