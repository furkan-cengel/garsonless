"use client";
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
import CountFlow from "./CountFlow";
import ReceiveDialog from "./ReceiveDialog";
import WasteDialog from "./WasteDialog";
import StockOverview from "./StockOverview";
import StockDetailPanel from "./StockDetailPanel";
import { buildStockViews } from "./stock-view";
import { ConfirmAction, amount, money, kinds } from "./inventory-controls";
import { STOCK_IMPORT_TEMPLATE, readStockImport, type StockImportRow } from "./inventory-model";
const WIDE_LAYOUT_QUERY = "(min-width: 1180px)";
/** The stock card sits beside the list on wide screens and opens as a sheet otherwise. */
function useWideLayout(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(WIDE_LAYOUT_QUERY);
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return wide;
}
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
  const [tab, setTab] = useState(initialMenuItemId ? "recipes" : "overview");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [wasteFor, setWasteFor] = useState<{ itemId?: string } | null>(null);
  const [receiveFor, setReceiveFor] = useState<{ itemId?: string } | null>(null);
  const [operationFor, setOperationFor] = useState<{ mode: InventoryMode; itemId?: string } | null>(null);
  const [countItem, setCountItem] = useState<string | undefined>();
  const [countKey, setCountKey] = useState(0);
  const wide = useWideLayout();
  const [editor, setEditor] = useState<StockItem | "new" | null>(null);
  const [csv, setCsv] = useState("");
  const [csvPreview, setCsvPreview] = useState<StockImportRow[] | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [trackingConfirm, setTrackingConfirm] = useState<"activate" | "pause" | null>(null);
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
  async function run(mode: InventoryMode, payload: Record<string, unknown>): Promise<{ id?: string | null } | null> {
    if (working.current) return null;
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
        return null;
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
      setWasteFor(null);
      setOperationFor(null);
      await refresh();
      return "id" in r.data ? { id: r.data.id } : {};
    } catch {
      setError(INVENTORY_ERRORS.unavailable);
      return null;
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
  const views = buildStockViews(data);
  const selected = views.find((view) => view.item.id === selectedId) ?? null;
  const lastSaleAt = data.insights?.lastSaleAt;
  const openCount = (itemId?: string) => {
    setCountItem(itemId);
    setCountKey((value) => value + 1);
    showSection("counts");
  };
  const detail = selected ? (
    <StockDetailPanel
      view={selected}
      today={data.insights?.today}
      isOwner={isOwner}
      busy={busy}
      onReceive={() => setReceiveFor({ itemId: selected.item.id })}
      onWaste={() => setWasteFor({ itemId: selected.item.id })}
      onAdjust={() => setOperationFor({ mode: "adjustment", itemId: selected.item.id })}
      onEdit={() => setEditor(selected.item)}
      // The sheet has its own close button; only the side column needs one.
      onClose={wide ? () => setSelectedId(null) : undefined}
    />
  ) : null;
  return (
    <section
      aria-label="Stok çalışma alanı"
      tabIndex={0}
      className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain"
      aria-busy={busy}
    >
      <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6 p-4 sm:p-6">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-2xl font-semibold">Stok</h1>
          {/* Whether sales are moving stock right now is the first thing to know on this screen. */}
          <span role="status" className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ${data.enabled ? "bg-[var(--positive-bg)] text-[var(--positive)]" : "bg-muted text-muted-foreground"}`}>
            <span aria-hidden="true" className={`size-1.5 rounded-full ${data.enabled ? "bg-[var(--positive)]" : "bg-muted-foreground"}`} />
            {data.enabled
              ? `Satışlarla düşüyor${lastSaleAt ? ` · son satış ${new Date(lastSaleAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}` : ""}`
              : "Otomatik düşüm kapalı"}
          </span>
          <span className="flex-1" />
          {data.items.length > 0 && (
            <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex" disabled={busy} onClick={() => { void refresh(data.movementOffset); }}>Yenile</Button>
              <Button variant="outline" disabled={busy} onClick={() => setWasteFor({ itemId: selected?.item.id })}>Fire kaydet</Button>
              <Button variant="outline" disabled={busy} onClick={() => openCount()}>Sayım başlat</Button>
              <Button disabled={busy} onClick={() => setReceiveFor({ itemId: selected?.item.id })}>Mal kabul</Button>
            </div>
          )}
        </header>
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
          <div className="overflow-x-auto">
            <TabsList>
              <TabsTrigger value="overview">Genel bakış</TabsTrigger>
              <TabsTrigger value="recipes">Reçeteler</TabsTrigger>
              <TabsTrigger value="counts">Sayım</TabsTrigger>
              <TabsTrigger value="history">Hareketler</TabsTrigger>
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
              <div className={wide && selected ? "grid items-start gap-4 grid-cols-[minmax(0,1fr)_380px]" : ""}>
                <StockOverview
                  data={data}
                  views={views}
                  selectedId={selectedId}
                  untrackedCount={untracked.length}
                  isOwner={isOwner}
                  busy={busy}
                  onSelect={setSelectedId}
                  onReceive={(itemId) => setReceiveFor({ itemId })}
                  onCount={(itemId) => openCount(itemId)}
                  onAddCard={() => setEditor("new")}
                  onImport={() => setImportOpen(true)}
                  onOtherOperation={() => setOperationFor({ mode: "external_sale", itemId: selected?.item.id })}
                  onRecipes={() => showSection("recipes")}
                />
                {wide && detail && (
                  <aside aria-label="Stok kartı" className="sticky top-0 max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl border bg-card">
                    {detail}
                  </aside>
                )}
              </div>
            )}
            {isOwner && data.enabled && (
              <Button
                className="w-fit max-w-full self-start justify-self-start"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => setTrackingConfirm("pause")}
              >
                Otomatik takibi duraklat
              </Button>
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
          <TabsContent value="counts" className="pt-4">
            {!data.items.length ? needsStock("Sayım yapmak") : (
              <CountFlow
                key={countKey}
                data={data}
                isOwner={isOwner}
                busy={busy}
                initialItemId={countItem}
                save={(mode, payload) => run(mode, payload)}
              />
            )}
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
        {!wide && (
          <Sheet open={Boolean(detail)} onOpenChange={(open) => { if (!open) setSelectedId(null); }}>
            <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-[420px]">
              <SheetHeader className="sr-only"><SheetTitle>{selected?.item.name ?? "Stok kartı"}</SheetTitle><SheetDescription>Seviye, tüketim, son alım ve hareketler</SheetDescription></SheetHeader>
              {detail}
            </SheetContent>
          </Sheet>
        )}
        {wasteFor && (
          <WasteDialog
            items={data.items}
            initialItemId={wasteFor.itemId}
            busy={busy}
            error={error}
            onClose={() => setWasteFor(null)}
            onSave={(payload) => { void run("waste", payload); }}
          />
        )}
        {receiveFor && (
          <ReceiveDialog
            data={data}
            initialItemId={receiveFor.itemId}
            busy={busy}
            error={error}
            onClose={() => setReceiveFor(null)}
            onSave={async (payload) => (await run("receipt", payload)) !== null}
          />
        )}
        <Dialog open={operationFor !== null} onOpenChange={(open) => { if (!open && !busy) setOperationFor(null); }}>
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Diğer stok işlemi</DialogTitle>
              <DialogDescription>Üretim, Masabu dışı satış{isOwner ? ", gerekçeli düzeltme ve iptal firesi iadesi" : ""}. Her işlem hareket defterine belge olarak yazılır.</DialogDescription>
            </DialogHeader>
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            {operationFor && (
              <StockOperation
                data={data}
                isOwner={isOwner}
                busy={busy}
                initialMode={operationFor.mode}
                initialItemId={operationFor.itemId}
                save={(mode, payload) => { void run(mode, payload); }}
              />
            )}
          </DialogContent>
        </Dialog>
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
