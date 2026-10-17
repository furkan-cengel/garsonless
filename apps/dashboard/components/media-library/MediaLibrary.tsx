"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  FileImage,
  Film,
  Upload,
  FolderOpen,
  Search,
  Check,
  Trash2,
  RefreshCw,
  Grid2X2,
  Grid3X3,
  List,
} from "lucide-react";
import {
  type MediaAsset,
  type MediaContext,
  type MediaPurpose,
  type MediaSnapshot,
  type MediaQuery,
  mediaUrlFor,
  formatMediaBytes,
  mediaUploadError,
  formatMediaUseSummary,
  mediaDisplayName,
} from "@garsonless/domain/media-library";
import {
  mediaRequest,
  resolveLibraryAsset,
  uploadLibraryFile,
} from "../../lib/media-library-client";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "../ui/select";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import {
  Item,
  ItemGroup,
  ItemContent,
  ItemTitle,
  ItemDescription,
} from "../ui/item";
import {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
  CardContent,
} from "../ui/card";
import { Field, FieldLabel, FieldGroup } from "../ui/field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Tabs, TabsContent } from "../ui/tabs";
import { Alert, AlertTitle, AlertDescription } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "../ui/empty";
import { Spinner } from "../ui/spinner";
import { cn } from "../../lib/utils";

type MediaView = "small" | "large" | "list";
const VIEW_KEY = "masabu:media-library:view";
const FILTERS = {
  type: [
    { value: "all", label: "Tümü" },
    { value: "image", label: "Görseller" },
    { value: "video", label: "Videolar" },
  ],
  sort: [
    { value: "newest", label: "En yeni" },
    { value: "largest", label: "En büyük" },
  ],
  usage: [
    { value: "all", label: "Tümü" },
    { value: "used", label: "Kullanımda" },
    { value: "unused", label: "Kullanılmıyor" },
  ],
};
function MediaFilter({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Field className="w-auto min-w-28 flex-1 sm:flex-none">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        value={value}
        items={options}
        onValueChange={(value) => {
          if (value) onChange(value);
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}
type UploadRow = {
  id: string;
  file: File;
  progress: number | null;
  status: "queued" | "uploading" | "ready" | "failed";
  error?: string;
  asset?: MediaAsset;
};
export type SelectedMedia = {
  asset: MediaAsset;
  url: string;
  width: number;
  height: number;
  mime: string;
  durationSeconds: number;
};
export function MediaPicker({
  restaurantId,
  context,
  purpose = "image",
  multiple = false,
  open,
  onOpenChange,
  onSelect,
}: {
  restaurantId: string;
  context: MediaContext;
  purpose?: MediaPurpose;
  multiple?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (selected: SelectedMedia[]) => void | Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-full max-w-full flex-col rounded-none sm:h-[min(820px,90dvh)] sm:max-w-5xl sm:rounded-xl">
        <DialogHeader className="pr-8">
          <DialogTitle>
            {purpose === "video" ? "Video seç" : "Görsel seç"}
          </DialogTitle>
          <DialogDescription>
            Dosyalarınızdan seçin veya yeni yükleyin. Seçim bu alana uygulanır.
          </DialogDescription>
        </DialogHeader>
        <MediaLibrary
          restaurantId={restaurantId}
          context={context}
          purpose={purpose}
          multiple={multiple}
          onSelect={async (selected) => {
            await onSelect(selected);
            onOpenChange(false);
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
export default function MediaLibrary({
  restaurantId,
  context = "files",
  purpose,
  multiple = false,
  onSelect,
  onCancel,
}: {
  restaurantId: string;
  context?: MediaContext;
  purpose?: MediaPurpose;
  multiple?: boolean;
  onSelect?: (selected: SelectedMedia[]) => Promise<void> | void;
  onCancel?: () => void;
}) {
  const fieldId = useId();
  const [view, setView] = useState<MediaView>("small");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      if (saved === "small" || saved === "large" || saved === "list")
        setView(saved);
    } catch {
      /* Storage can be unavailable in private sessions. */
    }
  }, []);
  function changeView(value: MediaView) {
    setView(value);
    try {
      localStorage.setItem(VIEW_KEY, value);
    } catch {
      /* The view still works without persistence. */
    }
  }
  const [data, setData] = useState<MediaSnapshot | null>(null),
    [query, setQuery] = useState<MediaQuery>({
      type: purpose === "video" ? "video" : purpose ? "image" : "all",
      page: 0,
    }),
    [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [tab, setTab] = useState("library"),
    [selected, setSelected] = useState<MediaAsset[]>([]),
    [busy, setBusy] = useState(false);
  const [uploads, setUploads] = useState<UploadRow[]>([]),
    [detail, setDetail] = useState<MediaAsset | null>(null),
    [name, setName] = useState(""),
    [alt, setAlt] = useState(""),
    [confirmDelete, setConfirmDelete] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    sequence = useRef(0),
    controllers = useRef(new Map<string, AbortController>()),
    cancelled = useRef(new Set<string>()),
    unmounted = useRef(false);
  const load = useCallback(async () => {
    const n = ++sequence.current;
    setLoading(true);
    try {
      const d = await mediaRequest<MediaSnapshot>(
        restaurantId,
        context,
        "list",
        { ...query },
      );
      if (n === sequence.current) setData(d);
    } catch (e) {
      if (n === sequence.current)
        setError(e instanceof Error ? e.message : "Liste yüklenemedi.");
    } finally {
      if (n === sequence.current) setLoading(false);
    }
  }, [restaurantId, context, query]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const t = setTimeout(
      () => setQuery((q) => ({ ...q, search, page: 0 })),
      250,
    );
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    unmounted.current = false;
    const tasks = controllers.current;
    return () => {
      unmounted.current = true;
      for (const c of tasks.values()) c.abort();
    };
  }, []);
  async function upload(row: UploadRow) {
    if (unmounted.current || cancelled.current.has(row.id)) return;
    const incompatible =
      purpose && (purpose === "video") !== row.file.type.startsWith("video/");
    const invalid = incompatible
      ? purpose === "video"
        ? "Bu alan için video seçin."
        : "Bu alan için görsel seçin."
      : mediaUploadError(row.file.size, row.file.type);
    if (invalid) {
      setUploads((xs) =>
        xs.map((x) =>
          x.id === row.id ? { ...x, status: "failed", error: invalid } : x,
        ),
      );
      return;
    }
    const controller = new AbortController();
    controllers.current.set(row.id, controller);
    setUploads((xs) =>
      xs.map((x) =>
        x.id === row.id
          ? { ...x, status: "uploading", error: undefined, progress: 0 }
          : x,
      ),
    );
    try {
      const asset = await uploadLibraryFile(
        restaurantId,
        context,
        row.file,
        (progress) =>
          setUploads((xs) =>
            xs.map((x) => (x.id === row.id ? { ...x, progress } : x)),
          ),
        controller.signal,
      );
      setUploads((xs) =>
        xs.map((x) => (x.id === row.id ? { ...x, status: "ready", asset } : x)),
      );
      setNotice(
        onSelect
          ? "Dosya kütüphaneye kaydedildi. Kullanmak için seçiminizi onaylayın."
          : "Dosya kütüphaneye kaydedildi. Menü ve tema alanlarından seçebilirsiniz.",
      );
      await load();
    } catch (e) {
      setUploads((xs) =>
        xs.map((x) =>
          x.id === row.id
            ? {
                ...x,
                status: "failed",
                error: e instanceof Error ? e.message : "Yüklenemedi.",
              }
            : x,
        ),
      );
    } finally {
      controllers.current.delete(row.id);
    }
  }
  async function addFiles(files: File[]) {
    const rows = files.slice(0, 20).map((file) => ({
      id: crypto.randomUUID(),
      file,
      progress: 0,
      status: "queued" as const,
    }));
    setUploads((xs) => [...rows, ...xs]);
    setTab("upload");
    for (const row of rows) await upload(row);
  }
  function choose(asset: MediaAsset) {
    if (!onSelect) {
      setDetail(asset);
      setName(asset.name);
      setAlt(asset.alt);
      return;
    }
    setSelected((xs) =>
      xs.some((x) => x.id === asset.id)
        ? xs.filter((x) => x.id !== asset.id)
        : multiple
          ? [...xs, asset]
          : [asset],
    );
  }
  async function apply() {
    setBusy(true);
    setError("");
    try {
      const result = [];
      for (const a of selected)
        result.push(
          await resolveLibraryAsset(
            restaurantId,
            context,
            a.id,
            purpose ?? "image",
          ),
        );
      await onSelect?.(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Seçim uygulanamadı.");
    } finally {
      setBusy(false);
    }
  }
  async function edit(remove = false) {
    if (!detail) return;
    setBusy(true);
    setError("");
    try {
      await mediaRequest(
        restaurantId,
        context,
        remove ? "delete" : "metadata",
        { id: detail.id, version: detail.version, name, alt },
      );
      setNotice(
        remove
          ? "Silme isteği alındı. Temizlik tamamlanınca alanınız açılacak."
          : "Dosya bilgileri kaydedildi.",
      );
      setDetail(null);
      setConfirmDelete(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "İşlem tamamlanamadı.");
      setConfirmDelete(false);
    } finally {
      setBusy(false);
    }
  }
  const usage = data ? Math.min(100, (100 * data.used) / data.limit) : 0;
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
      {error && (
        <Alert variant="destructive" role="alert">
          <AlertTitle>İşlem tamamlanamadı</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <Button
            className="w-fit"
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setError("");
              void load();
            }}
          >
            Yeniden dene
          </Button>
        </Alert>
      )}
      {notice && (
        <p className="text-sm text-muted-foreground" role="status">
          {notice}
        </p>
      )}
      {data && (
        <Card size="sm" className="shrink-0">
          <CardHeader>
            <CardTitle>Depolama</CardTitle>
            <CardAction>
              {formatMediaBytes(data.used)} / {formatMediaBytes(data.limit)}
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Progress value={usage} aria-label="Kullanılan depolama" />
            <p className="text-xs text-muted-foreground">
              {data.reserved > 0
                ? `${formatMediaBytes(data.reserved)} yüklemeler için ayrıldı. `
                : ""}
              {usage >= 100
                ? "Alan dolu. Mevcut dosyalarınızı kullanabilirsiniz."
                : usage >= 95
                  ? "Alanınızın %95’i dolu. Yeni yüklemeler için yer açın."
                  : usage >= 80
                    ? "Alanınız dolmak üzere. Kullanılmayan dosyaları gözden geçirin."
                    : "Aynı dosyayı farklı alanlarda kullanmak kotayı tekrar tüketmez."}
            </p>
            {!data.initialized && (
              <p role="status" className="text-sm">
                Kütüphane hazırlanıyor. Mevcut görselleriniz korunuyor.
              </p>
            )}
          </CardContent>
        </Card>
      )}
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(String(value))}
        className="flex min-h-0 flex-1 flex-col gap-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* "Upload" is an action, not a view of the library: a button opens the upload surface. */}
          {tab === "upload" ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => setTab("library")}>
              ← Dosyalarım
            </Button>
          ) : (
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <FolderOpen className="size-4" />
              Dosyalarım
            </h2>
          )}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={loading}
              onClick={() => void load()}
            >
              <RefreshCw data-icon="inline-start" />
              Yenile
            </Button>
            {tab !== "upload" && (
              <Button type="button" size="sm" disabled={!data?.initialized} onClick={() => setTab("upload")}>
                <Upload data-icon="inline-start" />
                Dosya yükle
              </Button>
            )}
          </div>
        </div>
        <TabsContent
          value="library"
          className="flex min-h-0 flex-1 flex-col gap-3"
        >
          <div className="flex flex-wrap items-end gap-3">
            <Field className="min-w-40 flex-1">
              <FieldLabel htmlFor={`${fieldId}-search`}>
                <Search className="size-4" />
                Dosya ara
              </FieldLabel>
              <Input
                id={`${fieldId}-search`}
                placeholder="Dosya adı"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Field>
            {!purpose && (
              <MediaFilter
                id={`${fieldId}-type`}
                label="Tür"
                value={query.type ?? "all"}
                options={FILTERS.type}
                onChange={(value) =>
                  setQuery((q) => ({
                    ...q,
                    type: value as MediaQuery["type"],
                    page: 0,
                  }))
                }
              />
            )}
            <MediaFilter
              id={`${fieldId}-sort`}
              label="Sırala"
              value={query.sort ?? "newest"}
              options={FILTERS.sort}
              onChange={(value) =>
                setQuery((q) => ({
                  ...q,
                  sort: value as MediaQuery["sort"],
                  page: 0,
                }))
              }
            />
            <MediaFilter
              id={`${fieldId}-usage`}
              label="Kullanım"
              value={query.usage ?? "all"}
              options={FILTERS.usage}
              onChange={(value) =>
                setQuery((q) => ({
                  ...q,
                  usage: value as MediaQuery["usage"],
                  page: 0,
                }))
              }
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">
              {data ? `${data.total} dosya` : "Dosyalar"}
            </span>
            <ToggleGroup
              aria-label="Dosya görünümü"
              value={[view]}
              onValueChange={(values) => {
                const next = values[0];
                if (next === "small" || next === "large" || next === "list")
                  changeView(next);
              }}
              variant="outline"
              spacing={0}
            >
              <ToggleGroupItem value="small" aria-label="Küçük kartlar">
                <Grid3X3 />
                Küçük
              </ToggleGroupItem>
              <ToggleGroupItem value="large" aria-label="Büyük kartlar">
                <Grid2X2 />
                Büyük
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="Liste görünümü">
                <List />
                Liste
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div
            className={
              onSelect
                ? "min-h-0 flex-1 overflow-y-auto overscroll-contain"
                : "overflow-visible"
            }
            aria-label="Dosya galerisi"
            aria-busy={loading}
          >
            {!data ? (
              // Before the first list arrives nothing is known yet: never show
              // the empty state here, or a full library briefly looks empty.
              error ? null : (
                <div role="status" aria-label="Dosyalar yükleniyor" className={cn("grid gap-3 p-1", view === "list" ? "grid-cols-1" : view === "small" ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4")}>
                  {Array.from({ length: view === "small" ? 12 : 8 }, (_, index) => (
                    <div key={index} className={cn("animate-pulse rounded-lg bg-muted", view === "list" ? "h-14" : "aspect-[4/3]")} />
                  ))}
                </div>
              )
            ) : data.assets.length ? (
              <ItemGroup
                role="group"
                aria-label="Dosyalar"
                data-media-view={view}
                className={cn(
                  "grid gap-3 p-1",
                  view === "list"
                    ? "grid-cols-1"
                    : view === "small"
                      ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6"
                      : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
                )}
              >
                {data.assets.map((a, index) => {
                  const picked = selected.some((x) => x.id === a.id),
                    available = !purpose || Boolean(mediaUrlFor(a, purpose)),
                    display = mediaDisplayName(a);
                  return (
                    <Item
                      key={a.id}
                      variant="outline"
                      render={
                        <button
                          type="button"
                          disabled={a.status !== "ready" || !available}
                          aria-pressed={onSelect ? picked : undefined}
                        />
                      }
                      onClick={() => choose(a)}
                      className={cn(
                        "min-w-0 overflow-hidden text-left outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50",
                        view === "list"
                          ? "flex-nowrap"
                          : "flex-col items-stretch gap-0 p-0",
                        picked && "ring-2 ring-primary",
                      )}
                    >
                      <div
                        className={cn(
                          "relative flex shrink-0 items-center justify-center overflow-hidden bg-muted",
                          view === "list"
                            ? "size-12 rounded-md"
                            : "aspect-[4/3] w-full",
                        )}
                      >
                        {a.mime.startsWith("video/") ? (
                          <Film className="size-10 text-muted-foreground" />
                        ) : (
                          <MediaThumb src={a.url} eager={index < 12} />
                        )}
                        {picked && (
                          <Badge
                            className={
                              view === "list"
                                ? "absolute inset-0 justify-center"
                                : "absolute right-1 top-1"
                            }
                          >
                            <Check />
                            <span className={view === "large" ? "" : "sr-only"}>
                              Seçildi
                            </span>
                          </Badge>
                        )}
                      </div>
                      <ItemContent
                        className={cn(
                          "min-w-0",
                          view === "list"
                            ? ""
                            : view === "small"
                              ? "p-2"
                              : "p-3",
                        )}
                      >
                        <ItemTitle
                          className="block w-full truncate"
                          title={a.name}
                        >
                          {display.title}
                        </ItemTitle>
                        <ItemDescription>
                          {formatMediaBytes(a.bytes)} ·{" "}
                          {a.mime.startsWith("video/") ? "Video" : "Görsel"}
                        </ItemDescription>
                        <ItemDescription>
                          {a.status === "deleting"
                            ? "Temizlik bekliyor"
                            : formatMediaUseSummary(a.uses)}
                        </ItemDescription>
                      </ItemContent>
                      {view === "list" && (
                        <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                          {new Date(a.createdAt).toLocaleDateString("tr-TR")}
                        </span>
                      )}
                    </Item>
                  );
                })}
              </ItemGroup>
            ) : (
              <Empty>
                <EmptyHeader>
                  <FileImage className="size-8 text-muted-foreground" />
                  <EmptyTitle>
                    {search ? "Dosya bulunamadı" : "Dosyalarınız burada"}
                  </EmptyTitle>
                  <EmptyDescription>
                    Görsellerinizi bir kez yükleyin; ürün, logo ve temada tekrar
                    kullanın.
                  </EmptyDescription>
                </EmptyHeader>
                <Button type="button" onClick={() => setTab("upload")}>
                  Dosya yükle
                </Button>
              </Empty>
            )}
          </div>
          {data && data.total > 40 && (
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!query.page}
                onClick={() =>
                  setQuery((q) => ({ ...q, page: (q.page ?? 0) - 1 }))
                }
              >
                Önceki
              </Button>
              <span className="text-xs">
                {(query.page ?? 0) + 1} / {Math.ceil(data.total / 40)}
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={((query.page ?? 0) + 1) * 40 >= data.total}
                onClick={() =>
                  setQuery((q) => ({ ...q, page: (q.page ?? 0) + 1 }))
                }
              >
                Sonraki
              </Button>
            </div>
          )}
        </TabsContent>
        <TabsContent
          value="upload"
          className={cn(
            "flex min-h-0 flex-1 flex-col gap-3",
            onSelect && "overflow-y-auto",
          )}
        >
          <div
            className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-8 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (data?.initialized)
                void addFiles(Array.from(e.dataTransfer.files));
            }}
          >
            <Upload className="size-8 text-muted-foreground" />
            <p className="font-medium">Dosyaları buraya sürükleyin</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Görsel veya kısa tema videosu · en fazla 8 MB. Videolar en fazla
              15 saniye. Bir defada 20 dosya.
            </p>
            <Input
              ref={input}
              type="file"
              className="sr-only"
              aria-label="Yeni dosyalar"
              multiple
              accept={
                purpose === "video"
                  ? "video/mp4,video/webm"
                  : purpose
                    ? "image/jpeg,image/png,image/webp,image/avif"
                    : "image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm"
              }
              onChange={(e) => {
                void addFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              disabled={!data?.initialized}
              onClick={() => input.current?.click()}
            >
              Cihazdan seç
            </Button>
          </div>
          {uploads.map((row) => (
            <div
              key={row.id}
              className="flex flex-col gap-2 rounded-lg border p-3"
            >
              <div className="flex justify-between gap-3">
                <span className="truncate text-sm font-medium">
                  {row.file.name}
                </span>
                <span className="shrink-0 text-xs" role="status">
                  {row.status === "queued"
                    ? "Sırada"
                    : row.status === "ready"
                      ? "Kullanıma hazır"
                      : row.status === "failed"
                        ? "Yüklenemedi"
                        : row.progress === null
                          ? "Kontrol ediliyor…"
                          : `Yükleniyor · %${row.progress}`}
                </span>
              </div>
              {row.status === "uploading" &&
                (row.progress === null ? (
                  <Spinner />
                ) : (
                  <Progress value={row.progress} />
                ))}
              {row.error && (
                <p role="alert" className="text-sm text-destructive">
                  {row.error}
                </p>
              )}
              <div className="flex gap-2">
                {(row.status === "queued" ||
                  (row.status === "uploading" && row.progress !== null)) && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      cancelled.current.add(row.id);
                      controllers.current.get(row.id)?.abort();
                      setUploads((xs) =>
                        xs.map((x) =>
                          x.id === row.id
                            ? {
                                ...x,
                                status: "failed",
                                error: "Yükleme durduruldu.",
                              }
                            : x,
                        ),
                      );
                    }}
                  >
                    Durdur
                  </Button>
                )}
                {row.status === "failed" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      cancelled.current.delete(row.id);
                      void upload(row);
                    }}
                  >
                    Yeniden dene
                  </Button>
                )}
                {row.asset && onSelect && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      choose(row.asset!);
                      setTab("library");
                    }}
                  >
                    Bu dosyayı seç
                  </Button>
                )}
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>
      {onSelect && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <span className="text-sm text-muted-foreground">
            {selected.length
              ? `${selected.length} dosya seçildi`
              : "Kullanmak istediğiniz dosyayı seçin"}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onCancel}
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              disabled={!selected.length || busy}
              onClick={() => void apply()}
            >
              {busy && <Spinner data-icon="inline-start" />}
              {busy ? "Seçim hazırlanıyor…" : "Seçimi kullan"}
            </Button>
          </div>
        </div>
      )}
      <Dialog
        open={Boolean(detail)}
        onOpenChange={(value) => {
          if (!value) setDetail(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dosya ayrıntısı</DialogTitle>
            <DialogDescription>
              Adı ve açıklamayı düzenlemek dosyanın bağlantısını değiştirmez.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {detail && (
            <>
              {detail.mime.startsWith("video/") ? (
                <video
                  src={detail.url}
                  controls
                  preload="metadata"
                  className="max-h-56 w-full"
                />
              ) : (
                <img
                  src={detail.url}
                  alt={detail.alt}
                  className="max-h-56 w-full object-contain"
                />
              )}
              <p className="text-sm text-muted-foreground">
                {formatMediaBytes(detail.bytes)} ·{" "}
                {detail.width && detail.height
                  ? `${detail.width} × ${detail.height}`
                  : detail.mime}{" "}
                · {new Date(detail.createdAt).toLocaleDateString("tr-TR")}
              </p>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor={`${fieldId}-name`}>Dosya adı</FieldLabel>
                  <Input
                    id={`${fieldId}-name`}
                    value={name}
                    maxLength={200}
                    disabled={!data?.canManage}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${fieldId}-alt`}>
                    Görsel açıklaması
                  </FieldLabel>
                  <Input
                    id={`${fieldId}-alt`}
                    value={alt}
                    maxLength={500}
                    disabled={!data?.canManage}
                    onChange={(e) => setAlt(e.target.value)}
                  />
                </Field>
              </FieldGroup>
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Kullanıldığı yerler</p>
                {detail.uses.length ? (
                  detail.uses.map((u) => (
                    <Link
                      className="text-sm underline"
                      key={`${u.table}:${u.id}`}
                      href={`/dashboard/${restaurantId}/${u.table.startsWith("theme_") ? "theme" : u.table === "restaurants" ? "settings" : "menu"}`}
                    >
                      {u.label}
                      {u.table === "theme_config_history"
                        ? " · geçmiş sürüm"
                        : ""}
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Henüz bir alana bağlı değil.
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button
                  nativeButton={false}
                  variant="outline"
                  render={
                    <a
                      href={`/api/media-library/download?restaurantId=${restaurantId}&context=${context}&id=${detail.id}`}
                      target="_blank"
                      rel="noreferrer"
                    />
                  }
                >
                  Orijinali indir
                </Button>
                {data?.canManage && (
                  <>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={busy || detail.uses.length > 0}
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Trash2 data-icon="inline-start" />
                      Sil
                    </Button>
                    <Button
                      type="button"
                      disabled={
                        busy ||
                        !name.trim() ||
                        (name === detail.name && alt === detail.alt)
                      }
                      onClick={() => void edit()}
                    >
                      Bilgileri kaydet
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dosya kalıcı olarak silinsin mi?</DialogTitle>
            <DialogDescription>
              {detail?.name} kütüphaneden kaldırılacak. Bu işlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmDelete(false)}
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={() => void edit(true)}
            >
              Kalıcı olarak sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Gallery thumbnail: the first screenful loads eagerly, and a pulse stays
 * until the image has decoded so a card is never an unexplained grey box.
 */
function MediaThumb({ src, eager }: { src: string; eager: boolean }) {
  const ref = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    // A cached image can finish before React attaches onLoad.
    if (ref.current?.complete && ref.current.naturalWidth > 0) setLoaded(true);
  }, [src]);
  return (
    <>
      {!loaded && <span aria-hidden="true" className="absolute inset-0 animate-pulse bg-muted" />}
      <img
        ref={ref}
        src={src}
        alt=""
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={cn("absolute inset-0 size-full object-contain transition-opacity duration-200", loaded ? "opacity-100" : "opacity-0")}
      />
    </>
  );
}
