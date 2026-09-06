"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  couponStatus,
  type CouponDefinition,
  type CouponFieldErrors,
} from "@garsonless/domain/coupons";
import {
  archiveCoupon,
  getCouponEditorChoices,
  getRestaurantCoupons,
  restoreCoupon,
  upsertCoupon,
} from "../../lib/actions/coupons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { I } from "../../lib/ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  createCouponDraft,
  parseCouponDraft,
  suggestCouponCode,
  type CouponDraft,
} from "./coupon-editor-model";
import { CouponDatePicker } from "./CouponDatePicker";
import { SETTINGS_CONFIRM_DISCARD_EVENT, type SettingsConfirmDiscardDetail, useSettingsDirtyState } from "./settings-dirty-state";

type Choice = { id: string; name: string };
const STATUS_LABELS = {
  active: "Aktif",
  scheduled: "Planlandı",
  paused: "Duraklatıldı",
  expired: "Süresi doldu",
  exhausted: "Tükendi",
  archived: "Arşivlendi",
} as const;

function CouponSelect<T extends string>({
  id,
  value,
  options,
  onChange,
  disabled,
}: {
  id: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled: boolean;
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (next !== null) onChange(next);
      }}
      disabled={disabled}
      items={options}
    >
      <SelectTrigger id={id} className="w-full focus-visible:ring-2">
        <SelectValue>
          {options.find((option) => option.value === value)?.label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className="min-h-9"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function CouponManager({
  restaurantId,
  timeZone = "Europe/Istanbul",
}: {
  restaurantId: string;
  timeZone?: string;
}) {
  const [coupons, setCoupons] = useState<CouponDefinition[]>([]);
  const [categories, setCategories] = useState<Choice[]>([]);
  const [items, setItems] = useState<Choice[]>([]);
  const [draft, setDraft] = useState<CouponDraft | null>(null);
  const baseline = useRef("");
  const request = useRef<{ signature: string; id: string } | null>(null);
  const busy = useRef(false);
  const loadVersion = useRef(0);
  const [open, setOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const navigationDiscard = useRef<(() => void) | null>(null);
  const [loading, setLoading] = useState(true);
  const [choicesLoading, setChoicesLoading] = useState(false);
  const [choicesError, setChoicesError] = useState("");
  const [listError, setListError] = useState("");
  const [error, setError] = useState("");
  const [conflicted, setConflicted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<CouponFieldErrors>({});
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<CouponDefinition | null>(
    null,
  );
  const [undoArchive, setUndoArchive] = useState<{
    id: string;
    code: string;
    archiveVersion: string;
  } | null>(null);
  const dirty =
    open && draft !== null && JSON.stringify(draft) !== baseline.current;
  useSettingsDirtyState("loyalty:coupon", dirty || pending, pending);

  useEffect(() => {
    if (!open) return;
    const confirm = (event: Event) => {
      event.preventDefault();
      if (busy.current) return;
      navigationDiscard.current = (event as CustomEvent<SettingsConfirmDiscardDetail>).detail.onDiscard;
      setDiscardOpen(true);
    };
    window.addEventListener(SETTINGS_CONFIRM_DISCARD_EVENT, confirm);
    return () => window.removeEventListener(SETTINGS_CONFIRM_DISCARD_EVENT, confirm);
  }, [open]);

  const invalidateList = useCallback(() => {
    loadVersion.current++;
  }, []);
  const reload = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    try {
      const result = await getRestaurantCoupons(restaurantId);
      if (version !== loadVersion.current) return;
      if ("coupons" in result) {
        setCoupons(result.coupons);
        setListError("");
      } else setListError(result.error);
    } catch {
      if (version === loadVersion.current)
        setListError("Kuponlar yüklenemedi. Tekrar deneyin.");
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [restaurantId]);
  const loadChoices = useCallback(async () => {
    setChoicesLoading(true);
    setChoicesError("");
    try {
      const result = await getCouponEditorChoices(restaurantId);
      if ("categories" in result) {
        setCategories(result.categories);
        setItems(result.items);
      } else setChoicesError(result.error);
    } catch {
      setChoicesError("Ürün ve kategoriler yüklenemedi.");
    } finally {
      setChoicesLoading(false);
    }
  }, [restaurantId]);
  useEffect(() => {
    void reload();
    return () => {
      /* Ignore outstanding list reads after unmount. */ invalidateList();
    };
  }, [reload, invalidateList]);

  function edit(coupon?: CouponDefinition) {
    if (busy.current) return;
    const next = createCouponDraft(coupon, timeZone);
    if (next.scope !== "order") void loadChoices();
    baseline.current = JSON.stringify(next);
    request.current = null;
    setDraft(next);
    setConflicted(false);
    setFieldErrors({});
    setError("");
    setSearch("");
    setOpen(true);
  }
  function close() {
    if (busy.current) return;
    if (dirty) setDiscardOpen(true);
    else setOpen(false);
  }
  function patch(next: Partial<CouponDraft>) {
    setDraft((current) => (current ? { ...current, ...next } : current));
    setError("");
    setFieldErrors((current) => {
      const copy = { ...current };
      for (const key of Object.keys(next))
        delete copy[key as keyof CouponFieldErrors];
      return copy;
    });
  }
  function showErrors(errors: CouponFieldErrors) {
    setFieldErrors(errors);
    requestAnimationFrame(() => {
      const first = document.querySelector<HTMLElement>(
        '[data-coupon-form] [aria-invalid="true"]',
      );
      if (!first) return;
      let parent = first.parentElement;
      while (parent) {
        if (parent instanceof HTMLDetailsElement) parent.open = true;
        parent = parent.parentElement;
      }
      first.focus();
      first.scrollIntoView({ block: "nearest" });
    });
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!draft || busy.current) return;
    const signature = JSON.stringify(draft);
    const id =
      request.current?.signature === signature
        ? request.current.id
        : crypto.randomUUID();
    const parsed = parseCouponDraft(draft, timeZone, id);
    if (draft.scope !== "order" && (choicesLoading || choicesError)) {
      setError("Önce ürün ve kategori listesini yükleyin.");
      return;
    }
    if (Object.keys(parsed.errors).length) {
      showErrors(parsed.errors);
      return;
    }
    request.current = { signature, id };
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const result = await upsertCoupon(restaurantId, parsed.input);
      if ("error" in result) {
        setConflicted("code" in result && result.code === "CONFLICT");
        setError(result.error ?? "Kupon kaydedilemedi. Tekrar deneyin.");
        if ("fieldErrors" in result && result.fieldErrors)
          showErrors(result.fieldErrors);
        return;
      }
      loadVersion.current++;
      setLoading(false);
      setCoupons((current) => [
        result.coupon,
        ...current.filter((coupon) => coupon.id !== result.coupon.id),
      ]);
      setSuccess(draft.id ? "Kupon güncellendi." : "Kupon oluşturuldu.");
      setListError("");
      setOpen(false);
      request.current = null;
    } catch {
      setError(
        "Bağlantı kesildi. Taslağınız korundu; aynı işlemi tekrar deneyebilirsiniz.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  async function reloadLatest() {
    if (!draft?.id || busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      const result = await getRestaurantCoupons(restaurantId);
      if ("coupons" in result) {
        const latest = result.coupons.find((coupon) => coupon.id === draft.id);
        setCoupons(result.coupons);
        if (latest) {
          setDraft(createCouponDraft(latest, timeZone));
          baseline.current = JSON.stringify(
            createCouponDraft(latest, timeZone),
          );
          request.current = null;
          setConflicted(false);
          setFieldErrors({});
          setError(
            "Güncel kupon yüklendi. Değişikliklerinizi bu sürüme uygulayabilirsiniz.",
          );
        } else
          setError(
            "Bu kupon arşivlenmiş veya kaldırılmış. Taslağınız korunuyor.",
          );
      } else setError("Güncel kupon yüklenemedi. Tekrar deneyin.");
    } catch {
      setError("Bağlantı kurulamadı. Taslağınız korundu.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  async function archive() {
    if (!archiveTarget || busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      const result = await archiveCoupon(
        restaurantId,
        archiveTarget.id,
        archiveTarget.updatedAt,
      );
      if ("error" in result) {
        setError(result.error ?? "Kupon kaydedilemedi. Tekrar deneyin.");
        return;
      }
      loadVersion.current++;
      setLoading(false);
      setCoupons((current) =>
        current.filter((coupon) => coupon.id !== archiveTarget.id),
      );
      setUndoArchive({
        id: archiveTarget.id,
        code: archiveTarget.code,
        archiveVersion: result.archiveVersion,
      });
      setArchiveTarget(null);
    } catch {
      setError("Kupon arşivlenemedi. Tekrar deneyin.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  async function undo() {
    if (!undoArchive || busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      const result = await restoreCoupon(
        restaurantId,
        undoArchive.id,
        undoArchive.archiveVersion,
      );
      if ("error" in result) {
        setListError(result.error);
        return;
      }
      setUndoArchive(null);
      setSuccess("Kupon arşivden geri alındı.");
      await reload();
    } catch {
      setListError("Kupon geri alınamadı. Tekrar deneyin.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  const inputProps = (key: keyof CouponDraft) => ({
    id: `coupon-${key}`,
    "aria-invalid": Boolean(fieldErrors[key as keyof CouponFieldErrors]),
    "aria-describedby": fieldErrors[key as keyof CouponFieldErrors]
      ? `coupon-${key}-error`
      : undefined,
  });
  const message = (key: keyof CouponDraft) =>
    fieldErrors[key as keyof CouponFieldErrors] ? (
      <p
        id={`coupon-${key}-error`}
        role="alert"
        className="text-xs text-destructive"
      >
        {fieldErrors[key as keyof CouponFieldErrors]}
      </p>
    ) : null;
  const numberField = (
    key:
      | "discountValue"
      | "minimumAmount"
      | "maximumDiscountAmount"
      | "totalUsageLimit"
      | "perCustomerLimit",
    label: string,
    optional = false,
  ) => (
    <Field>
      <FieldLabel htmlFor={`coupon-${key}`}>{label}</FieldLabel>
      <Input
        {...inputProps(key)}
        inputMode={key.includes("Limit") ? "numeric" : "decimal"}
        value={draft?.[key] ?? ""}
        onChange={(e) => patch({ [key]: e.target.value })}
        placeholder={optional ? "Sınırsız" : undefined}
      />
      {message(key)}
    </Field>
  );
  const selectedIds =
    draft?.scope === "category" ? draft.categoryIds : (draft?.itemIds ?? []);
  const choices = (draft?.scope === "category" ? categories : items).filter(
    (choice) =>
      choice.name
        .toLocaleLowerCase("tr-TR")
        .includes(search.toLocaleLowerCase("tr-TR")),
  );

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Kuponlar</CardTitle>
            <CardDescription>
              Müşterilerinizin siparişte kullanabileceği indirim kodları.
            </CardDescription>
          </div>
          <Button type="button" onClick={() => edit()} disabled={pending || loading}>
            <I.plus size={16} />
            Yeni kupon
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 py-4">
        {success && (
          <p role="status" className="text-sm">
            {success}
          </p>
        )}
        {listError && (
          <Alert variant="destructive">
            <AlertDescription>
              {listError}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void reload()}
                disabled={loading || pending}
              >
                Tekrar dene
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {undoArchive && (
          <Alert>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
              {undoArchive.code} arşivlendi.
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => void undo()}
              >
                Geri al
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {loading ? (
          <div role="status" className="flex justify-center p-6">
            <Spinner />
            <span className="sr-only">Kuponlar yükleniyor</span>
          </div>
        ) : !coupons.length && !listError ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Henüz kupon yok. İlk indiriminizi oluşturun.
          </div>
        ) : (
          coupons.map((coupon) => (
            <div
              key={coupon.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="break-words text-sm">{coupon.name}</strong>
                  <Badge
                    variant={
                      couponStatus(coupon) === "active"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {STATUS_LABELS[couponStatus(coupon)]}
                  </Badge>
                </div>
                <p className="mt-1 break-words text-xs text-muted-foreground">
                  <span className="font-mono">{coupon.code}</span> ·{" "}
                  {coupon.discountType === "percentage"
                    ? `%${coupon.discountValue}`
                    : `${coupon.discountValue} ₺`}{" "}
                  ·{" "}
                  {coupon.scope === "order"
                    ? "Tüm sepet"
                    : coupon.scope === "category"
                      ? `${coupon.categoryIds.length} kategori`
                      : `${coupon.itemIds.length} ürün`}{" "}
                  · {coupon.redemptionCount} kullanım
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => edit(coupon)}
                >
                  Düzenle
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    setError("");
                    setArchiveTarget(coupon);
                  }}
                >
                  Arşivle
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!value) close();
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="flex w-[calc(100%-2rem)] max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
        >
          <DialogHeader className="shrink-0 border-b px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle>
                {draft?.id ? "Kuponu düzenle" : "Yeni kupon"}
              </DialogTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Kupon formunu kapat"
                disabled={pending}
                onClick={close}
              >
                <I.x size={16} />
              </Button>
            </div>
            <DialogDescription>
              Kodunuzu ve indiriminizi belirleyin. Diğer koşullar isteğe
              bağlıdır.
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <form
              data-coupon-form
              onSubmit={save}
              noValidate
              aria-busy={pending}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="min-h-0 overflow-y-auto px-5 py-4">
                <fieldset disabled={pending} className="min-w-0 space-y-4">
                  <FieldGroup className="gap-4">
                    <Field>
                      <FieldLabel htmlFor="coupon-name">Kupon adı</FieldLabel>
                      <Input
                        {...inputProps("name")}
                        value={draft.name}
                        maxLength={80}
                        onChange={(e) => patch({ name: e.target.value })}
                        placeholder="Hafta sonu indirimi"
                        autoComplete="off"
                      />
                      {message("name")}
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="coupon-code">Kupon kodu</FieldLabel>
                      <div className="flex gap-2">
                        <Input
                          {...inputProps("code")}
                          className="min-w-0 font-mono"
                          value={draft.code}
                          maxLength={32}
                          onChange={(e) =>
                            patch({ code: e.target.value.toUpperCase() })
                          }
                          autoComplete="off"
                          spellCheck={false}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => patch({ code: suggestCouponCode() })}
                        >
                          Yeni kod
                        </Button>
                      </div>
                      {message("code")}
                      <FieldDescription>
                        Müşteri bu kodu sipariş sırasında girer.
                      </FieldDescription>
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="coupon-discountType">
                          İndirim türü
                        </FieldLabel>
                        <CouponSelect
                          id="coupon-discountType"
                          value={draft.discountType}
                          disabled={pending}
                          options={[
                            { value: "percentage", label: "Yüzde indirim" },
                            { value: "fixed", label: "Sabit tutar" },
                          ]}
                          onChange={(discountType) => patch({ discountType })}
                        />
                      </Field>
                      {numberField(
                        "discountValue",
                        draft.discountType === "percentage"
                          ? "İndirim (%)"
                          : "İndirim (₺)",
                      )}
                    </div>
                    <Field
                      orientation="horizontal"
                      className="rounded-lg border p-3"
                    >
                      <FieldLabel htmlFor="coupon-enabled" className="flex-1">
                        Kullanıma açık
                      </FieldLabel>
                      <Switch
                        id="coupon-enabled"
                        checked={draft.enabled}
                        onCheckedChange={(enabled) => patch({ enabled })}
                      />
                    </Field>
                  </FieldGroup>
                  <details
                    className="rounded-lg border p-3"
                    open={undefined}
                    key={`conditions-${draft.id ?? "new"}`}
                    ref={(node) => {
                      if (node && !node.dataset.initialized) {
                        node.open =
                          draft.scope !== "order" ||
                          draft.minimumAmount !== "0" ||
                          Boolean(draft.maximumDiscountAmount) ||
                          draft.audience !== "everyone" ||
                          draft.stackingPolicy !== "exclusive";
                        node.dataset.initialized = "true";
                      }
                    }}
                  >
                    <summary className="cursor-pointer py-1 font-medium">
                      Kullanım koşulları
                    </summary>
                    <FieldGroup className="mt-4 gap-4">
                      <Field>
                        <FieldLabel htmlFor="coupon-scope">
                          Geçerli olduğu alan
                        </FieldLabel>
                        <CouponSelect
                          id="coupon-scope"
                          value={draft.scope}
                          disabled={pending}
                          options={[
                            { value: "order", label: "Tüm sepet" },
                            { value: "category", label: "Kategoriler" },
                            { value: "product", label: "Ürünler" },
                          ]}
                          onChange={(scope) => {
                            patch({ scope });
                            if (scope !== "order") void loadChoices();
                            setSearch("");
                          }}
                        />
                      </Field>
                      {draft.scope !== "order" && (
                        <Field>
                          <FieldLabel
                            htmlFor={`coupon-${draft.scope === "category" ? "categoryIds" : "itemIds"}`}
                          >
                            Uygun{" "}
                            {draft.scope === "category"
                              ? "kategoriler"
                              : "ürünler"}{" "}
                            ({selectedIds.length} seçili)
                          </FieldLabel>
                          <Input
                            {...inputProps(
                              draft.scope === "category"
                                ? "categoryIds"
                                : "itemIds",
                            )}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Ara"
                          />
                          {choicesLoading ? (
                            <p role="status">Liste yükleniyor…</p>
                          ) : choicesError ? (
                            <Alert variant="destructive">
                              <AlertDescription>
                                {choicesError}
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => void loadChoices()}
                                >
                                  Tekrar dene
                                </Button>
                              </AlertDescription>
                            </Alert>
                          ) : (
                            <div className="grid max-h-44 gap-1 overflow-auto rounded-lg border p-2 sm:grid-cols-2">
                              {choices.map((choice) => (
                                <label
                                  key={choice.id}
                                  className="flex min-h-11 cursor-pointer items-center gap-2 px-2 text-sm"
                                >
                                  <Checkbox
                                    checked={selectedIds.includes(choice.id)}
                                    onCheckedChange={(checked) =>
                                      patch({
                                        [draft.scope === "category"
                                          ? "categoryIds"
                                          : "itemIds"]: checked
                                          ? [
                                              ...new Set([
                                                ...selectedIds,
                                                choice.id,
                                              ]),
                                            ]
                                          : selectedIds.filter(
                                              (id) => id !== choice.id,
                                            ),
                                      })
                                    }
                                  />
                                  {choice.name}
                                </label>
                              ))}
                              {!choices.length && (
                                <p className="p-2 text-sm text-muted-foreground">
                                  {search
                                    ? "Aramanızla eşleşen sonuç yok."
                                    : "Menünüzde uygun kayıt bulunmuyor."}
                                </p>
                              )}
                            </div>
                          )}
                          {message(
                            draft.scope === "category"
                              ? "categoryIds"
                              : "itemIds",
                          )}
                            <Button type="button" variant="ghost" size="sm" disabled={choicesLoading} onClick={() => void loadChoices()}>Listeyi yenile</Button>
                        </Field>
                      )}
                      <div className="grid gap-3 sm:grid-cols-2">
                        {numberField(
                          "minimumAmount",
                          "Minimum sepet tutarı (₺)",
                        )}
                        {draft.discountType === "percentage" &&
                          numberField(
                            "maximumDiscountAmount",
                            "En yüksek indirim (₺)",
                            true,
                          )}
                      </div>
                      <Field>
                        <FieldLabel htmlFor="coupon-audience">
                          Hedef kitle
                        </FieldLabel>
                        <CouponSelect
                          id="coupon-audience"
                          value={draft.audience}
                          disabled={pending}
                          options={[
                            { value: "everyone", label: "Herkes" },
                            { value: "members", label: "Üyeler" },
                            { value: "first_order", label: "İlk sipariş" },
                          ]}
                          onChange={(audience) => patch({ audience })}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="coupon-stackingPolicy">
                          Üyelik avantajları
                        </FieldLabel>
                        <CouponSelect
                          id="coupon-stackingPolicy"
                          value={draft.stackingPolicy}
                          disabled={pending}
                          options={[
                            { value: "exclusive", label: "Yalnız bu kupon" },
                            {
                              value: "combine_loyalty",
                              label: "Üyelik avantajlarıyla birleştir",
                            },
                          ]}
                          onChange={(stackingPolicy) =>
                            patch({ stackingPolicy })
                          }
                        />
                      </Field>
                    </FieldGroup>
                  </details>
                  <details
                    className="rounded-lg border p-3"
                    ref={(node) => {
                      if (node && !node.dataset.initialized) {
                        node.open = Boolean(
                          draft.startsAt ||
                          draft.endsAt ||
                          draft.totalUsageLimit ||
                          draft.perCustomerLimit,
                        );
                        node.dataset.initialized = "true";
                      }
                    }}
                  >
                    <summary className="cursor-pointer py-1 font-medium">
                      Tarih ve limitler
                    </summary>
                    <FieldGroup className="mt-4 gap-4">
                      <p className="text-xs text-muted-foreground">
                        Saatler işletmenizin {timeZone} zaman dilimindedir. Boş
                        tarihler süreyi sınırlamaz.
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {(["startsAt", "endsAt"] as const).map((key) => (
                          <Field key={key}>
                            <FieldLabel htmlFor={`coupon-${key}`}>
                              {key === "startsAt" ? "Başlangıç" : "Bitiş"}
                            </FieldLabel>
                            <CouponDatePicker
                              disabled={pending}
                              {...inputProps(key)}
                              value={draft[key] ?? ""}
                              timeZone={timeZone}
                              label={key === "startsAt" ? "Başlangıç" : "Bitiş"}
                              onChange={(value) => patch({ [key]: value })}
                            />
                            {message(key)}
                          </Field>
                        ))}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {numberField(
                          "totalUsageLimit",
                          "Toplam kullanım limiti",
                          true,
                        )}
                        {draft.audience !== "everyone" &&
                          numberField(
                            "perCustomerLimit",
                            "Kişi başı kullanım limiti",
                            true,
                          )}
                      </div>
                    </FieldGroup>
                  </details>
                  <details
                    className="rounded-lg border p-3"
                    ref={(node) => {
                      if (node && !node.dataset.initialized) {
                        node.open = Boolean(
                          draft.marketingLabel || draft.marketingDescription,
                        );
                        node.dataset.initialized = "true";
                      }
                    }}
                  >
                    <summary className="cursor-pointer py-1 font-medium">
                      Menüde görünüm
                    </summary>
                    <FieldGroup className="mt-4 gap-4">
                      <Field>
                        <FieldLabel htmlFor="coupon-marketingLabel">
                          Kart etiketi
                        </FieldLabel>
                        <Input
                          {...inputProps("marketingLabel")}
                          value={draft.marketingLabel ?? ""}
                          maxLength={60}
                          onChange={(e) =>
                            patch({ marketingLabel: e.target.value })
                          }
                          placeholder="SİZE ÖZEL"
                        />
                        {message("marketingLabel")}
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="coupon-marketingDescription">
                          Kart açıklaması
                        </FieldLabel>
                        <Textarea
                          {...inputProps("marketingDescription")}
                          value={draft.marketingDescription ?? ""}
                          maxLength={160}
                          onChange={(e) =>
                            patch({ marketingDescription: e.target.value })
                          }
                          placeholder="Hafta sonu siparişlerinizde geçerli"
                        />
                        {message("marketingDescription")}
                      </Field>
                    </FieldGroup>
                  </details>
                </fieldset>
                {error && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertDescription>
                      {error}
                      {conflicted && (
                        <Button
                          type="button"
                          variant="outline"
                          disabled={pending}
                          onClick={() => void reloadLatest()}
                        >
                          Taslağı sil ve güncel kuponu yükle
                        </Button>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
              <DialogFooter className="mx-0 mb-0 shrink-0 flex-row flex-wrap items-center border-t bg-muted/20 px-5 py-4">
                <p className="mr-auto text-xs text-muted-foreground">
                  {draft.discountType === "percentage"
                    ? `%${draft.discountValue}`
                    : `${draft.discountValue} ₺`}{" "}
                  ·{" "}
                  {draft.scope === "order"
                    ? "Tüm sepet"
                    : `${selectedIds.length} ${draft.scope === "category" ? "kategori" : "ürün"}`}{" "}
                  · {draft.endsAt ? "Bitiş tarihli" : "Süresiz"}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={close}
                >
                  Vazgeç
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending && <Spinner />}
                  {pending ? "Kaydediliyor…" : "Kuponu kaydet"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog open={discardOpen} onOpenChange={(value) => { setDiscardOpen(value); if (!value) navigationDiscard.current = null; }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Değişiklikler silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              Bu kuponda kaydedilmemiş değişiklikler var.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Düzenlemeye devam et</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const navigate = navigationDiscard.current;
                navigationDiscard.current = null;
                setDiscardOpen(false);
                setOpen(false);
                navigate?.();
              }}
            >
              Değişiklikleri sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={Boolean(archiveTarget)}
        onOpenChange={(value) => {
          if (!value && !pending) setArchiveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {archiveTarget?.code} arşivlensin mi?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Kupon kullanıma kapanır. Geçmiş kullanımlar korunur; arşivlemeyi
              geri alabilirsiniz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                void archive();
              }}
            >
              {pending ? "Arşivleniyor…" : "Arşivle"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
