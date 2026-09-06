import {
  validateCouponWrite,
  type CouponDefinition,
  type CouponWriteInput,
  type CouponFieldErrors,
} from "@garsonless/domain/coupons";

type NumericKey =
  | "discountValue"
  | "minimumAmount"
  | "maximumDiscountAmount"
  | "totalUsageLimit"
  | "perCustomerLimit";
export type CouponDraft = Omit<CouponWriteInput, NumericKey | "requestId"> &
  Record<NumericKey, string>;

export function suggestCouponCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `KUPON-${Array.from(bytes, (n) => alphabet[n % alphabet.length]).join("")}`;
}

export function localCouponDate(iso: string | null, timeZone: string): string {
  if (!iso || !Number.isFinite(Date.parse(iso))) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

// Resolve every possible zone offset around the date; reject DST gaps and folds.
export function couponDateInstant(
  local: string | null,
  timeZone: string,
): { value: string | null; error?: string } {
  if (!local?.trim()) return { value: null };
  local = local
    .trim()
    .replace(/^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}:\d{2})$/, "$3-$2-$1T$4");
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format();
  } catch {
    return {
      value: null,
      error: "İşletmenin saat dilimi geçersiz. Mağaza ayarlarını kontrol edin.",
    };
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))
    return { value: null, error: "Geçerli bir tarih ve saat girin." };
  const guess = Date.parse(`${local}:00Z`);
  if (
    !Number.isFinite(guess) ||
    new Date(guess).toISOString().slice(0, 16) !== local
  )
    return { value: null, error: "Geçerli bir tarih ve saat girin." };
  const offsets = new Set<number>();
  for (let hours = -48; hours <= 48; hours += 6) {
    const at = guess + hours * 3600000;
    offsets.add(
      Date.parse(
        `${localCouponDate(new Date(at).toISOString(), timeZone)}:00Z`,
      ) - at,
    );
  }
  const matches = [...offsets]
    .map((offset) => new Date(guess - offset).toISOString())
    .filter((iso) => localCouponDate(iso, timeZone) === local);
  if (matches.length !== 1)
    return {
      value: null,
      error: matches.length
        ? "Bu saat, saat değişimi nedeniyle iki kez yaşanıyor. Farklı bir saat seçin."
        : "Bu saat, saat değişimi nedeniyle mevcut değil. Farklı bir saat seçin.",
    };
  return { value: matches[0]! };
}

export function createCouponDraft(
  coupon?: CouponDefinition,
  timeZone = "Europe/Istanbul",
): CouponDraft {
  return {
    ...(coupon ? { id: coupon.id, expectedUpdatedAt: coupon.updatedAt } : {}),
    name: coupon?.name ?? "",
    code: coupon?.code ?? suggestCouponCode(),
    enabled: coupon?.enabled ?? true,
    discountType: coupon?.discountType ?? "percentage",
    discountValue: String(coupon?.discountValue ?? 10),
    scope: coupon?.scope ?? "order",
    minimumAmount: String(coupon?.minimumAmount ?? 0),
    maximumDiscountAmount:
      coupon?.maximumDiscountAmount == null
        ? ""
        : String(coupon.maximumDiscountAmount),
    startsAt: localCouponDate(coupon?.startsAt ?? null, timeZone).replace(
      /^(\d{4})-(\d{2})-(\d{2})T/,
      "$3.$2.$1 ",
    ),
    endsAt: localCouponDate(coupon?.endsAt ?? null, timeZone).replace(
      /^(\d{4})-(\d{2})-(\d{2})T/,
      "$3.$2.$1 ",
    ),
    totalUsageLimit:
      coupon?.totalUsageLimit == null ? "" : String(coupon.totalUsageLimit),
    perCustomerLimit:
      coupon?.perCustomerLimit == null ? "" : String(coupon.perCustomerLimit),
    audience: coupon?.audience ?? "everyone",
    stackingPolicy: coupon?.stackingPolicy ?? "exclusive",
    marketingLabel: coupon?.marketingLabel ?? "",
    marketingDescription: coupon?.marketingDescription ?? "",
    categoryIds: coupon?.categoryIds ?? [],
    itemIds: coupon?.itemIds ?? [],
  };
}

export function parseCouponDraft(
  draft: CouponDraft,
  timeZone: string,
  requestId: string,
): { input: CouponWriteInput; errors: CouponFieldErrors } {
  const number = (text: string) =>
    text.trim() === "" ? NaN : Number(text.replace(",", "."));
  const optional = (text: string) => (text.trim() === "" ? null : number(text));
  const start = couponDateInstant(draft.startsAt, timeZone),
    end = couponDateInstant(draft.endsAt, timeZone);
  const input: CouponWriteInput = {
    ...draft,
    requestId,
    name: draft.name.trim(),
    code: draft.code.trim().toUpperCase(),
    discountValue: number(draft.discountValue),
    minimumAmount: number(draft.minimumAmount),
    maximumDiscountAmount:
      draft.discountType === "percentage"
        ? optional(draft.maximumDiscountAmount)
        : null,
    totalUsageLimit: optional(draft.totalUsageLimit),
    perCustomerLimit:
      draft.audience === "everyone" ? null : optional(draft.perCustomerLimit),
    startsAt: start.value,
    endsAt: end.value,
    categoryIds: draft.scope === "category" ? draft.categoryIds : [],
    itemIds: draft.scope === "product" ? draft.itemIds : [],
  };
  const errors = validateCouponWrite(input);
  if (start.error) errors.startsAt = start.error;
  if (end.error) errors.endsAt = end.error;
  return { input, errors };
}
