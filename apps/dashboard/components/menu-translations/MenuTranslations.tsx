"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Languages,
  LoaderCircle,
  Sparkles,
  RefreshCw,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress, ProgressLabel } from "../ui/progress";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "../ui/empty";
import {
  translationFieldStatus,
  type TranslationSnapshot,
  type TranslationMode,
  type TranslationField,
} from "@garsonless/domain/menu-translation";
import { menuTranslationAction } from "../../lib/actions/menu-translation";
import { Button, buttonVariants } from "../ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../ui/card";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "../ui/field";
import { Textarea } from "../ui/textarea";
import { Input } from "../ui/input";
import { Checkbox } from "../ui/checkbox";
import { Badge } from "../ui/badge";
import { Alert, AlertTitle, AlertDescription } from "../ui/alert";
import { translationErrorText as errorText } from "../../lib/menu-translation-errors";

function fieldKind(key: string) {
  if (key.startsWith("category/")) return "Kategori adı";
  if (key.includes("/ingredient/"))
    return key.endsWith("/amount") ? "Malzeme miktarı" : "Malzeme adı";
  if (key.includes("/option/")) return "Ekstra seçenek";
  if (key.includes("/group/")) return "Seçenek grubu";
  if (key.endsWith("/description")) return "Açıklama";
  if (key.endsWith("/allergen_note")) return "Alerjen açıklaması";
  if (key.endsWith("/cross_contact_note")) return "Çapraz temas uyarısı";
  return key.startsWith("item/") ? "Ürün adı" : "Menü metni";
}
const pending = (snapshot: TranslationSnapshot) =>
  snapshot.jobs.some((j) => j.status === "queued" || j.status === "running");
const statuses = {
  missing: "Eksik",
  stale: "Kaynak değişti",
  draft: "İnceleme bekliyor",
  published: "Onaylandı",
};
export default function MenuTranslations({
  restaurantId,
  initial,
  initialError,
}: {
  restaurantId: string;
  initial?: TranslationSnapshot | null;
  initialError?: string;
}) {
  const [data, setData] = useState(initial ?? null);
  const [error, setError] = useState(
    initialError ? errorText(initialError) : "",
  );
  const [notice, setNotice] = useState("");
  const [activeMode, setActiveMode] = useState<TranslationMode | null>(null);
  const busy = activeMode !== null;
  const [syncError, setSyncError] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const reviewRef = useRef<HTMLElement>(null);
  const dataRef = useRef(initial ?? null);
  const [edits, setEdits] = useState<
    Record<string, { text: string; version: number; sourceVersion: number }>
  >({});
  const [selection, setSelection] = useState<string[]>([]);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [terms, setTerms] = useState(
    initial
      ? Object.entries(initial.glossary)
          .map(([key, value]) => `${key} = ${value}`)
          .join("\n")
      : "",
  );
  const glossaryLoaded = useRef(Boolean(initial));
  const inFlight = useRef(false);
  const syncInFlight = useRef(false);
  const mutationSequence = useRef(0);
  const pendingRequest = useRef<{ fingerprint: string; id: string } | null>(
    null,
  );
  const run = useCallback(
    async (
      mode: TranslationMode,
      payload: Record<string, unknown> = {},
      quiet = false,
    ) => {
      if (inFlight.current || (quiet && syncInFlight.current)) return null;
      if (quiet) syncInFlight.current = true;
      else {
        inFlight.current = true;
        mutationSequence.current++;
      }
      const sequence = mutationSequence.current;
      if (!quiet) {
        setActiveMode(mode);
        setError("");
        setNotice("");
      }
      const fingerprint = JSON.stringify({ mode, payload });
      const id =
        pendingRequest.current?.fingerprint === fingerprint
          ? pendingRequest.current.id
          : crypto.randomUUID();
      if (mode !== "snapshot") pendingRequest.current = { fingerprint, id };
      try {
        const result = await menuTranslationAction({
          restaurantId,
          mode,
          ...(mode !== "snapshot" ? { requestId: id } : {}),
          payload,
        });
        if (
          quiet &&
          (sequence !== mutationSequence.current || inFlight.current)
        )
          return null;
        if (!result.ok) {
          if (quiet) setSyncError(true);
          else setError(errorText(result.error));
          return null;
        }
        const previous = dataRef.current;
        dataRef.current = result.data;
        setData(result.data);
        setSyncError(false);
        if (
          mode === "snapshot" &&
          previous &&
          pending(previous) &&
          !pending(result.data)
        ) {
          const completedDrafts = result.data.fields.filter(
            (f) => translationFieldStatus(f) === "draft",
          ).length;
          const activeIds = new Set(
            previous.jobs
              .filter((j) => j.status === "queued" || j.status === "running")
              .map((j) => j.id),
          );
          const failures = result.data.jobs.filter(
            (j) => activeIds.has(j.id) && j.status === "failed",
          );
          if (failures.length) {
            setNotice("");
            setError(
              "Bazı çeviriler hazırlanamadı. Mevcut taslaklarınız ve düzenlemeleriniz korunuyor. Yeniden deneyebilir veya metni elle düzenleyebilirsiniz.",
            );
          } else {
            setNotice(
              `${completedDrafts} çeviri incelemeye hazır. Metinleri kontrol edip onaylayın.`,
            );
          }
        }
        if (!glossaryLoaded.current) {
          setTerms(
            Object.entries(result.data.glossary)
              .map(([key, value]) => `${key} = ${value}`)
              .join("\n"),
          );
          glossaryLoaded.current = true;
        }
        if (mode !== "snapshot") {
          pendingRequest.current = null;
          setNotice(
            mode === "generate"
              ? "İstek alındı. Çeviriler hazırlanırken ilerlemeyi burada takip edebilirsiniz."
              : mode === "save"
                ? "Taslak kaydedildi. Müşteriye göstermek için çeviriyi onaylayın."
                : mode === "publish"
                  ? result.data.enabled
                    ? "Onaylanan çeviriler İngilizce menüde yayınlandı."
                    : "Çeviriler onaylandı. Tüm metinler tamamlanınca İngilizce menüyü açabilirsiniz."
                  : mode === "enable"
                    ? "İngilizce menü açıldı. İngilizce cihazlarda otomatik seçilir; müşteriler menüden dil değiştirebilir."
                    : mode === "disable"
                      ? "İngilizce menü kapatıldı. Çevirileriniz korunuyor."
                      : "Tercih ettiğiniz terimler kaydedildi. Bundan sonraki AI çevirilerinde kullanılacak.",
          );
        }
        return result.data;
      } catch {
        if (quiet) {
          if (sequence === mutationSequence.current) setSyncError(true);
        } else setError(errorText("unavailable"));
        return null;
      } finally {
        if (quiet) syncInFlight.current = false;
        else {
          inFlight.current = false;
          setActiveMode(null);
        }
      }
    },
    [restaurantId],
  );
  useEffect(() => {
    if (!initial && !initialError) void run("snapshot");
  }, [initial, initialError, run]);
  const hasJobs = data?.jobs.some(
    (job) => job.status === "queued" || job.status === "running",
  );
  useEffect(() => {
    if (!hasJobs) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !inFlight.current)
        void run("snapshot", {}, true);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [hasJobs, run]);
  useEffect(() => {
    if (!Object.keys(edits).length) return;
    const guard = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [edits]);
  const fields = data?.fields ?? [];
  const visible = fields.filter(
    (f) =>
      (filter === "all" || translationFieldStatus(f) === filter) &&
      `${f.label} ${f.source}`
        .toLocaleLowerCase("tr")
        .includes(query.toLocaleLowerCase("tr")),
  );
  const shown = visible.slice(
    Math.min(page, Math.max(0, Math.ceil(visible.length / 10) - 1)) * 10,
    (Math.min(page, Math.max(0, Math.ceil(visible.length / 10) - 1)) + 1) * 10,
  );
  const complete = fields.filter(
    (f) => f.published && f.publishedSourceVersion === f.sourceVersion,
  ).length;
  const publishCount = fields.filter(
    (f) => selection.includes(f.key) && translationFieldStatus(f) === "draft",
  ).length;
  const dirty = Object.keys(edits).length > 0;
  const save = async (f: TranslationField) => {
    const edit = edits[f.key];
    if (!edit) return;
    const result = await run("save", { fields: [{ key: f.key, ...edit }] });
    if (result)
      setEdits((current) => {
        const next = { ...current };
        delete next[f.key];
        return next;
      });
  };
  const publish = async (keys = selection) => {
    const selected = fields.filter(
      (f) => keys.includes(f.key) && translationFieldStatus(f) === "draft",
    );
    if (!selected.length) return;
    const result = await run("publish", {
      fields: selected.map(({ key, version, sourceVersion }) => ({
        key,
        version,
        sourceVersion,
      })),
    });
    if (result) {
      setSelection([]);
      const next = result.fields.find(
        (f) => translationFieldStatus(f) === "draft" && !keys.includes(f.key),
      );
      if (next && keys.length === 1) {
        setActiveKey(next.key);
        setFilter("draft");
        setQuery("");
        setPage(
          Math.floor(
            result.fields
              .filter((f) => translationFieldStatus(f) === "draft")
              .findIndex((f) => f.key === next.key) / 10,
          ),
        );
      }
    }
  };
  const drafts = fields.filter(
    (f) => translationFieldStatus(f) === "draft",
  ).length;
  const prepared = fields.filter(
    (f) => f.draft && f.draftSourceVersion === f.sourceVersion,
  ).length;
  const needsTranslation = fields.length - prepared;
  const remaining = Math.max(
    0,
    (data?.quota.limit ?? 0) -
      (data?.quota.used ?? 0) -
      (data?.quota.reserved ?? 0),
  );
  const allApproved = fields.length > 0 && complete === fields.length;
  const step =
    hasJobs || needsTranslation > 0 || !fields.length
      ? 1
      : !allApproved
        ? 2
        : 3;
  const activeField = visible.find((f) => f.key === activeKey) ?? shown[0];
  const activeEdit = activeField ? edits[activeField.key] : undefined;
  const stepLabels = ["Çevirileri hazırla", "İncele ve onayla", "Menüde aç"];
  const review = () => {
    setFilter(drafts ? "draft" : "all");
    setQuery("");
    setPage(0);
    setActiveKey(null);
    reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    reviewRef.current?.focus({ preventScroll: true });
  };
  const activeJobs =
    data?.jobs.filter((j) => j.status === "queued" || j.status === "running") ??
    [];
  const failedJob = data?.jobs.find((j) => j.status === "failed");
  return (
    <main className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 pb-24 md:p-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold">Menü çevirileri</h1>
            <p className="text-sm text-muted-foreground">
              Menünüzü İngilizce hazırlayın, kontrol edin ve müşterilerinize
              açın.
            </p>
          </div>
          <Link
            className={buttonVariants({ variant: "ghost" })}
            href={`/dashboard/${restaurantId}/menu`}
          >
            <ArrowLeft data-icon="inline-start" /> Menüye dön
          </Link>
        </header>
        <div className="sticky top-0 z-10 flex flex-col gap-2 bg-background/95 empty:hidden">
          {error && (
            <Alert variant="destructive" role="alert">
              <AlertTitle>İşlem tamamlanamadı</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {notice && (
            <Alert role="status">
              <Check />
              <AlertTitle>İşlem durumu</AlertTitle>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}
          {syncError && (
            <Alert role="alert">
              <AlertTitle>İlerleme güncellenemedi</AlertTitle>
              <AlertDescription>
                Son bilinen durumu görüyorsunuz. Bağlantı geldiğinde yeniden
                kontrol edeceğiz; yeni bir çeviri isteği göndermenize gerek yok.
              </AlertDescription>
            </Alert>
          )}
        </div>
        {!data ? (
          <Button
            className="self-start"
            disabled={busy}
            onClick={() => void run("snapshot")}
          >
            {busy ? "Yükleniyor…" : "Yeniden dene"}
          </Button>
        ) : (
          <>
            {!data.allowed && (
              <Alert>
                <AlertTitle>Pro ile çoklu dil</AlertTitle>
                <AlertDescription>
                  Menü çevirisi Pro, Pro denemesi ve Business paketlerinde
                  kullanılabilir. Kayıtlı çevirileriniz korunur.
                </AlertDescription>
              </Alert>
            )}
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Languages className="size-5 text-muted-foreground" />
                    <CardTitle>Türkçe → English</CardTitle>
                  </div>
                  <Badge variant={data.enabled ? "positive" : "secondary"}>
                    {data.enabled
                      ? "İngilizce menü açık"
                      : "Henüz müşterilere açık değil"}
                  </Badge>
                </div>
                <CardDescription>
                  Çeviriler menü içeriklerine kaydedilir. Siz onaylayana kadar
                  müşteriler Türkçe metinleri görür.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <ol
                  aria-label="Çeviri adımları"
                  className="grid grid-cols-3 gap-2 md:gap-6"
                >
                  {stepLabels.map((label, index) => {
                    const done =
                      index + 1 < step || (index === 2 && data.enabled);
                    return (
                      <li
                        key={label}
                        aria-current={
                          step === index + 1 && !done ? "step" : undefined
                        }
                        className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3"
                      >
                        <span
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium",
                            done || step === index + 1
                              ? "border-primary bg-primary text-primary-foreground"
                              : "text-muted-foreground",
                          )}
                        >
                          {done ? <Check className="size-4" /> : index + 1}
                        </span>
                        <div>
                          <p className="text-sm font-medium">{label}</p>
                          <p className="mt-1 hidden text-xs text-muted-foreground sm:block">
                            {index === 0
                              ? `${prepared}/${fields.length} metin hazır`
                              : index === 1
                                ? `${complete}/${fields.length} metin onaylandı`
                                : data.enabled
                                  ? "Müşterilere açık"
                                  : "Son adım"}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
                <div className="flex flex-col gap-4 rounded-xl bg-muted/50 p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div
                      className="flex max-w-2xl flex-col gap-1.5"
                      aria-live="polite"
                    >
                      <h2 className="flex items-center gap-2 font-semibold">
                        {hasJobs && (
                          <LoaderCircle className="size-4 animate-spin" />
                        )}
                        {!fields.length
                          ? "Önce menünüze içerik ekleyin"
                          : hasJobs
                            ? activeJobs.some((j) => j.status === "running")
                              ? "AI çevirileri hazırlıyor"
                              : "Çeviri isteğiniz sırada"
                            : needsTranslation
                              ? `${needsTranslation} metin çevrilmeyi bekliyor`
                              : drafts
                                ? `${drafts} çeviri incelemenizi bekliyor`
                                : data.enabled
                                  ? "İngilizce menünüz yayında"
                                  : "Menünüz İngilizceye hazır"}
                      </h2>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {!fields.length
                          ? "Görünür kategori ve ürünleriniz burada otomatik listelenir."
                          : hasJobs
                            ? "Bu sayfayı kapatabilirsiniz. Hazır metinler otomatik güncellenir; sonraki adım sizin kontrolünüz."
                            : needsTranslation
                              ? "AI eksik veya kaynağı değişmiş metinleri taslak olarak hazırlar. Mevcut güncel düzenlemeleriniz korunur."
                              : drafts
                                ? "Türkçe ile İngilizceyi karşılaştırın. Uygun metni onaylayıp sıradakine geçin."
                                : data.enabled
                                  ? "Müşteriler menüde Türkçe / English seçebilir. Yeni içerikleri bu ekrandan takip edebilirsiniz."
                                  : "Onaylar tamamlandı. Son adımda İngilizceyi müşterilerinize açın."}
                      </p>
                    </div>
                    {hasJobs ? (
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => void run("snapshot")}
                      >
                        <RefreshCw
                          data-icon="inline-start"
                          className={
                            activeMode === "snapshot"
                              ? "animate-spin"
                              : undefined
                          }
                        />
                        Durumu kontrol et
                      </Button>
                    ) : needsTranslation > 0 ? (
                      <Button
                        disabled={
                          busy || dirty || !data.allowed || remaining === 0
                        }
                        onClick={() => void run("generate")}
                      >
                        {activeMode === "generate" ? (
                          <LoaderCircle
                            data-icon="inline-start"
                            className="animate-spin"
                          />
                        ) : (
                          <Sparkles data-icon="inline-start" />
                        )}
                        {activeMode === "generate"
                          ? "İstek gönderiliyor…"
                          : "AI ile çevirileri hazırla"}
                      </Button>
                    ) : drafts > 0 ? (
                      <Button onClick={review}>
                        Çevirileri incele
                        <ArrowRight data-icon="inline-end" />
                      </Button>
                    ) : allApproved && !data.enabled && data.owner ? (
                      <Button
                        disabled={busy || dirty || !data.allowed}
                        onClick={() => void run("enable")}
                      >
                        {activeMode === "enable" && (
                          <LoaderCircle
                            data-icon="inline-start"
                            className="animate-spin"
                          />
                        )}
                        İngilizce menüyü aç
                      </Button>
                    ) : null}
                  </div>
                  <Progress
                    value={hasJobs || needsTranslation ? prepared : complete}
                    max={Math.max(1, fields.length)}
                  >
                    <ProgressLabel>
                      {hasJobs || needsTranslation
                        ? "Hazır metinler"
                        : "Onaylanan metinler"}
                    </ProgressLabel>
                    <span className="ml-auto text-sm tabular-nums text-muted-foreground">
                      {hasJobs || needsTranslation ? prepared : complete} /{" "}
                      {fields.length}
                    </span>
                  </Progress>
                  {hasJobs && (
                    <p className="text-xs text-muted-foreground">
                      {activeJobs.filter((j) => j.status === "running").length}{" "}
                      işlem hazırlanıyor ·{" "}
                      {activeJobs.filter((j) => j.status === "queued").length}{" "}
                      işlem sırada. İlerleme tamamlanan metinleri gösterir.
                    </p>
                  )}
                  {!hasJobs && failedJob && needsTranslation > 0 && (
                    <p role="alert" className="text-sm text-destructive">
                      Bazı metinler hazırlanamadı. Hazır çevirileriniz
                      korunuyor.{" "}
                      {failedJob.error?.startsWith("provider_")
                        ? "Çeviri hizmetine erişilemiyor; destek ekibine bildirin veya metinleri elle girin."
                        : "Eksik metinleri yeniden hazırlayabilir veya elle çevirebilirsiniz."}
                    </p>
                  )}
                  {!hasJobs && drafts > 0 && needsTranslation > 0 && (
                    <Button
                      className="self-start"
                      variant="outline"
                      onClick={review}
                    >
                      Hazır {drafts} çeviriyi incele
                    </Button>
                  )}
                  {dirty && (
                    <p className="text-sm text-muted-foreground">
                      Kaydedilmemiş düzenlemeleriniz var. Çeviri hazırlamadan
                      veya menüyü açmadan önce kaydedin.
                    </p>
                  )}
                  {remaining === 0 && (
                    <p className="text-sm text-muted-foreground">
                      AI kullanım hakkınız doldu. Metinleri elle düzenleyebilir
                      ve hazır çevirileri yayınlayabilirsiniz.
                    </p>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex flex-wrap justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Kalan AI hakkı:{" "}
                  <span className="font-medium tabular-nums">
                    {remaining.toLocaleString("tr-TR")}
                  </span>{" "}
                  karakter
                  {data.quota.reserved > 0
                    ? ` · ${data.quota.reserved.toLocaleString("tr-TR")} karakter işlemde`
                    : ""}{" "}
                  · Elle düzenleme ücretsiz
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => void run("snapshot")}
                >
                  {activeMode === "snapshot" ? "Kontrol ediliyor…" : "Yenile"}
                </Button>
              </CardFooter>
            </Card>

            <section
              ref={reviewRef}
              tabIndex={-1}
              aria-label="Çeviri inceleme alanı"
              className="scroll-mt-4 outline-none"
            >
              <Card>
                <CardHeader>
                  <CardTitle>Çevirileri incele</CardTitle>
                  <CardDescription>
                    Listeden bir metin seçin. Taslağı düzenleyin veya doğruysa
                    onaylayın.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <FieldGroup className="md:grid md:grid-cols-[1fr_220px]">
                    <Field>
                      <FieldLabel htmlFor="translation-search">
                        İçerik ara
                      </FieldLabel>
                      <Input
                        id="translation-search"
                        value={query}
                        placeholder="Ürün, kategori veya açıklama"
                        onChange={(e) => {
                          setQuery(e.target.value);
                          setPage(0);
                          setActiveKey(null);
                        }}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="translation-filter">
                        Durum
                      </FieldLabel>
                      <select
                        id="translation-filter"
                        className="h-9 min-w-0 rounded-md border bg-background px-3 text-sm"
                        value={filter}
                        onChange={(e) => {
                          setFilter(e.target.value);
                          setPage(0);
                          setActiveKey(null);
                        }}
                      >
                        <option value="all">Tümü ({fields.length})</option>
                        {Object.entries(statuses).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label} (
                            {
                              fields.filter(
                                (f) => translationFieldStatus(f) === key,
                              ).length
                            }
                            )
                          </option>
                        ))}
                      </select>
                    </Field>
                  </FieldGroup>
                  {!visible.length ? (
                    <Empty>
                      <EmptyHeader>
                        <EmptyTitle>Bu görünümde metin yok</EmptyTitle>
                        <EmptyDescription>
                          Aramayı veya durum filtresini değiştirerek diğer
                          içerikleri görebilirsiniz.
                        </EmptyDescription>
                      </EmptyHeader>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setFilter("all");
                          setQuery("");
                        }}
                      >
                        Tüm metinleri göster
                      </Button>
                    </Empty>
                  ) : (
                    <>
                      <div className="grid min-w-0 overflow-hidden rounded-xl border lg:grid-cols-[300px_minmax(0,1fr)]">
                        <div className="hidden border-r bg-muted/20 lg:block">
                          <p className="px-4 py-3 text-xs font-medium text-muted-foreground">
                            {visible.length} metin ·{" "}
                            {Object.keys(edits).length
                              ? `${Object.keys(edits).length} kaydedilmemiş`
                              : "İncelemek için seçin"}
                          </p>
                          <ul
                            className="max-h-[490px] overflow-y-auto"
                            aria-label="Menü metinleri"
                          >
                            {shown.map((f) => (
                              <li
                                key={f.key}
                                className={cn(
                                  "flex items-start gap-2 border-t p-3",
                                  activeField?.key === f.key && "bg-muted",
                                )}
                              >
                                <Checkbox
                                  className="mt-1"
                                  aria-label={`${f.label}: ${f.source} seç`}
                                  checked={selection.includes(f.key)}
                                  onCheckedChange={(checked) =>
                                    setSelection((current) =>
                                      checked
                                        ? [
                                            ...current.filter(
                                              (k) => k !== f.key,
                                            ),
                                            f.key,
                                          ]
                                        : current.filter((k) => k !== f.key),
                                    )
                                  }
                                />
                                <button
                                  type="button"
                                  aria-current={
                                    activeField?.key === f.key
                                      ? "true"
                                      : undefined
                                  }
                                  className="flex min-w-0 flex-1 flex-col gap-1 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  onClick={() => setActiveKey(f.key)}
                                >
                                  <span className="text-xs text-muted-foreground">
                                    {fieldKind(f.key)} ·{" "}
                                    {edits[f.key]
                                      ? "Kaydedilmedi"
                                      : statuses[translationFieldStatus(f)]}
                                  </span>
                                  <span className="w-full truncate text-sm font-medium">
                                    {f.label}
                                  </span>
                                  <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                                    {f.source}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="flex min-w-0 flex-col gap-5 p-4 sm:p-5">
                          <Field className="lg:hidden">
                            <FieldLabel htmlFor="translation-content">
                              İncelenecek metin
                            </FieldLabel>
                            <select
                              id="translation-content"
                              className="h-11 w-full min-w-0 rounded-md border bg-background px-2 text-sm"
                              value={activeField?.key ?? ""}
                              onChange={(e) => setActiveKey(e.target.value)}
                            >
                              {visible.map((f) => (
                                <option key={f.key} value={f.key}>
                                  {f.label} · {fieldKind(f.key)} ·{" "}
                                  {f.source.slice(0, 45)}
                                </option>
                              ))}
                            </select>
                          </Field>
                          {activeField && (
                            <>
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <p className="text-xs text-muted-foreground">
                                    {fieldKind(activeField.key)}
                                  </p>
                                  <h2 className="mt-1 font-semibold">
                                    {activeField.label}
                                  </h2>
                                </div>
                                <Badge
                                  variant={
                                    activeEdit
                                      ? "warning"
                                      : translationFieldStatus(activeField) ===
                                          "published"
                                        ? "positive"
                                        : "secondary"
                                  }
                                >
                                  {activeEdit
                                    ? "Kaydedilmedi"
                                    : statuses[
                                        translationFieldStatus(activeField)
                                      ]}
                                </Badge>
                              </div>
                              <FieldGroup className="md:grid md:grid-cols-2">
                                <Field>
                                  <FieldLabel>Türkçe kaynak</FieldLabel>
                                  <p
                                    className="min-h-32 whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-sm leading-relaxed"
                                    lang="tr"
                                  >
                                    {activeField.source}
                                  </p>
                                </Field>
                                <Field>
                                  <FieldLabel htmlFor="translation-editor">
                                    İngilizce taslak
                                  </FieldLabel>
                                  <Textarea
                                    id="translation-editor"
                                    className="min-h-32"
                                    lang="en"
                                    disabled={busy || !data.allowed}
                                    value={
                                      activeEdit?.text ??
                                      activeField.draft ??
                                      ""
                                    }
                                    placeholder="İngilizce karşılığını yazın"
                                    onChange={(e) => {
                                      const f = activeField;
                                      setEdits((current) => ({
                                        ...current,
                                        [f.key]: {
                                          text: e.target.value,
                                          version:
                                            current[f.key]?.version ??
                                            f.version,
                                          sourceVersion:
                                            current[f.key]?.sourceVersion ??
                                            f.sourceVersion,
                                        },
                                      }));
                                    }}
                                  />
                                  <FieldDescription>
                                    {activeField.draftSourceVersion !==
                                      activeField.sourceVersion &&
                                    activeField.draft
                                      ? "Kaynak değişmiş. Bu eski taslağı güncel Türkçeyle karşılaştırıp kaydedin."
                                      : "Malzeme, alerjen, sayı ve ölçülerin anlamını kontrol edin."}
                                  </FieldDescription>
                                </Field>
                              </FieldGroup>
                              {activeField.manualDraft &&
                                activeField.manualDraft.text !==
                                  activeField.draft && (
                                  <details className="rounded-md border p-3 text-sm">
                                    <summary className="cursor-pointer font-medium">
                                      Önceki manuel düzenlemeniz korunuyor —
                                      karşılaştırın
                                    </summary>
                                    <p
                                      className="mt-3 whitespace-pre-wrap break-words text-muted-foreground"
                                      lang="tr"
                                    >
                                      {activeField.manualDraft.source}
                                    </p>
                                    <p
                                      className="mt-2 whitespace-pre-wrap break-words"
                                      lang="en"
                                    >
                                      {activeField.manualDraft.text}
                                    </p>
                                  </details>
                                )}
                              {activeEdit &&
                                activeEdit.version !== activeField.version && (
                                  <Button
                                    variant="outline"
                                    disabled={busy}
                                    onClick={() => {
                                      const f = activeField;
                                      setEdits((current) => ({
                                        ...current,
                                        [f.key]: {
                                          text: current[f.key]!.text,
                                          version: f.version,
                                          sourceVersion: f.sourceVersion,
                                        },
                                      }));
                                    }}
                                  >
                                    Güncel kaynakla karşılaştırdım
                                  </Button>
                                )}
                              <div className="mt-auto flex flex-col gap-3 border-t pt-4">
                                <p className="text-xs leading-relaxed text-muted-foreground">
                                  {activeEdit
                                    ? "Düzenlemenizi önce taslak olarak kaydedin. Sonra onaylayabilirsiniz."
                                    : data.enabled
                                      ? "Onayladığınız metin İngilizce QR menüde hemen görünür."
                                      : "Onaylanan metinler hazır tutulur. Son adımda İngilizce menüyü açacaksınız."}
                                </p>
                                <div className="flex flex-wrap items-center gap-2">
                                  {activeEdit && (
                                    <Button
                                      disabled={busy || !data.allowed}
                                      onClick={() => void save(activeField)}
                                    >
                                      {activeMode === "save" && (
                                        <LoaderCircle
                                          data-icon="inline-start"
                                          className="animate-spin"
                                        />
                                      )}
                                      {activeMode === "save"
                                        ? "Kaydediliyor…"
                                        : "Taslağı kaydet"}
                                    </Button>
                                  )}
                                  {!activeEdit &&
                                    translationFieldStatus(activeField) ===
                                      "draft" && (
                                      <Button
                                        disabled={busy || !data.allowed}
                                        onClick={() =>
                                          void publish([activeField.key])
                                        }
                                      >
                                        {activeMode === "publish" ? (
                                          <LoaderCircle
                                            data-icon="inline-start"
                                            className="animate-spin"
                                          />
                                        ) : (
                                          <Check data-icon="inline-start" />
                                        )}
                                        {activeMode === "publish"
                                          ? "Onaylanıyor…"
                                          : "Onayla ve devam et"}
                                      </Button>
                                    )}
                                  {translationFieldStatus(activeField) ===
                                    "published" &&
                                    !activeEdit && (
                                      <p className="flex items-center gap-2 text-sm">
                                        <Check className="size-4" />
                                        Bu çeviri onaylandı.
                                      </p>
                                    )}
                                  <Button
                                    variant="ghost"
                                    disabled={
                                      busy ||
                                      Boolean(activeEdit) ||
                                      hasJobs ||
                                      !data.allowed ||
                                      remaining <
                                        Array.from(activeField.source).length
                                    }
                                    onClick={() =>
                                      void run("generate", {
                                        keys: [activeField.key],
                                        regenerate: true,
                                      })
                                    }
                                  >
                                    <Sparkles data-icon="inline-start" />
                                    Yeniden çevir
                                  </Button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="hidden items-center justify-between gap-2 lg:flex">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page <= 0}
                          onClick={() => {
                            setPage(Math.max(0, page - 1));
                            setActiveKey(null);
                          }}
                        >
                          Önceki
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          Sayfa{" "}
                          {Math.min(
                            page + 1,
                            Math.max(1, Math.ceil(visible.length / 10)),
                          )}{" "}
                          / {Math.max(1, Math.ceil(visible.length / 10))}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={(page + 1) * 10 >= visible.length}
                          onClick={() => {
                            setPage(page + 1);
                            setActiveKey(null);
                          }}
                        >
                          Sonraki
                        </Button>
                      </div>
                      <details className="rounded-lg border p-3 text-sm">
                        <summary className="cursor-pointer font-medium">
                          Toplu onay{" "}
                          {selection.length
                            ? `· ${selection.length} metin seçili`
                            : ""}
                        </summary>
                        <p className="my-3 text-muted-foreground">
                          Yalnız okuyup kontrol ettiğiniz taslakları seçerek
                          onaylayın.{" "}
                          {data.enabled
                            ? "Seçilen metinler menüde yayınlanır."
                            : "Müşterilere göstermek için son adımda İngilizceyi açın."}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy || !data.allowed}
                            onClick={() =>
                              setSelection(
                                shown
                                  .filter(
                                    (f) =>
                                      translationFieldStatus(f) === "draft",
                                  )
                                  .map((f) => f.key),
                              )
                            }
                          >
                            Bu sayfanın taslaklarını seç
                          </Button>
                          <Button
                            size="sm"
                            disabled={
                              busy || dirty || !publishCount || !data.allowed
                            }
                            onClick={() => void publish()}
                          >
                            {activeMode === "publish"
                              ? "Onaylanıyor…"
                              : `Seçilenleri onayla (${publishCount})`}
                          </Button>
                          {selection.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelection([])}
                            >
                              Seçimi temizle
                            </Button>
                          )}
                        </div>
                      </details>
                    </>
                  )}
                </CardContent>
              </Card>
            </section>
            <Card>
              <CardHeader>
                <CardTitle>3. Müşteriler menüyü nasıl görecek?</CardTitle>
                <CardDescription>
                  İngilizce yalnız QR menü ve ürün detaylarında kullanılır.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <p className="font-medium">Cihaz diline göre açılış</p>
                    <p className="mt-1 leading-relaxed text-muted-foreground">
                      İlk ziyarette cihaz dili İngilizceyse menü İngilizce
                      açılır. Daha önce seçilen dil veya bağlantıdaki dil
                      tercihi önceliklidir.
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Menüden dil değiştirme</p>
                    <p className="mt-1 leading-relaxed text-muted-foreground">
                      Üstteki Türkçe / English seçicisiyle dil değişir; ürün
                      seçimleri ve sepet korunur. Sepet ve ödeme Türkçe kalır.
                    </p>
                  </div>
                </div>
                {!allApproved && !data.enabled && (
                  <p className="text-sm text-muted-foreground">
                    İngilizceyi açmak için {fields.length - complete} metnin
                    daha onaylanması gerekiyor.
                  </p>
                )}
                {!data.owner && (
                  <p className="text-sm text-muted-foreground">
                    Çevirileri onaylayabilirsiniz. Menü dilini yalnız işletme
                    sahibi açıp kapatabilir.
                  </p>
                )}
              </CardContent>
              <CardFooter>
                {data.owner && (
                  <Button
                    variant={data.enabled ? "outline" : "default"}
                    disabled={
                      busy ||
                      !data.allowed ||
                      dirty ||
                      hasJobs ||
                      (!data.enabled && !allApproved)
                    }
                    onClick={() =>
                      void run(data.enabled ? "disable" : "enable")
                    }
                  >
                    {(activeMode === "enable" || activeMode === "disable") && (
                      <LoaderCircle
                        data-icon="inline-start"
                        className="animate-spin"
                      />
                    )}
                    {activeMode === "enable"
                      ? "Menü açılıyor…"
                      : activeMode === "disable"
                        ? "Kapatılıyor…"
                        : data.enabled
                          ? "İngilizce menüyü kapat"
                          : "İngilizce menüyü aç"}
                  </Button>
                )}
              </CardFooter>
            </Card>
            <details className="rounded-xl border bg-card p-4 md:p-5">
              <summary className="cursor-pointer text-sm font-medium">
                <BookOpen className="mr-2 inline size-4" />
                Terim tercihleri{" "}
                <span className="font-normal text-muted-foreground">
                  · İsteğe bağlı
                </span>
              </summary>
              <div className="mt-4 flex flex-col gap-4">
                <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                  Burası çevirilerin kaydedildiği yer değil. AI’ın belirli
                  kelimeleri nasıl çevirmesini istediğinizi belirtirsiniz.
                  Örneğin “Menemen” adı aynı kalsın. Değişiklikler yalnız yeni
                  AI çevirilerinde kullanılır; mevcut metinleri veya menüyü
                  değiştirmez.
                </p>
                <Field>
                  <FieldLabel htmlFor="translation-terms">
                    Her satırda Türkçe = İngilizce
                  </FieldLabel>
                  <Textarea
                    id="translation-terms"
                    value={terms}
                    disabled={busy || !data.allowed}
                    onChange={(e) => setTerms(e.target.value)}
                    placeholder={
                      "Menemen = Menemen\nAcılı ezme = Spicy tomato dip"
                    }
                  />
                </Field>
                <Button
                  className="self-start"
                  variant="outline"
                  disabled={busy || !data.allowed}
                  onClick={() => {
                    const entries = terms
                      .split("\n")
                      .filter((line) => line.trim())
                      .map((line) => {
                        const at = line.indexOf("=");
                        return at > 0
                          ? [
                              line.slice(0, at).trim(),
                              line.slice(at + 1).trim(),
                            ]
                          : [];
                      });
                    if (
                      entries.some((entry) => entry.length !== 2 || !entry[1])
                    ) {
                      setError(
                        "Her sözlük satırını Türkçe = İngilizce biçiminde girin.",
                      );
                      return;
                    }
                    void run("glossary", {
                      terms: Object.fromEntries(entries),
                    });
                  }}
                >
                  {activeMode === "glossary"
                    ? "Kaydediliyor…"
                    : "Terim tercihlerini kaydet"}
                </Button>
              </div>
            </details>
          </>
        )}
      </div>
    </main>
  );
}
