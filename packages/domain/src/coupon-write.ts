import { isCouponCode, type CouponDefinition } from "./coupons";

export type CouponWriteInput = Pick<
  CouponDefinition,
  | "name"
  | "code"
  | "enabled"
  | "discountType"
  | "discountValue"
  | "scope"
  | "minimumAmount"
  | "maximumDiscountAmount"
  | "startsAt"
  | "endsAt"
  | "totalUsageLimit"
  | "perCustomerLimit"
  | "audience"
  | "stackingPolicy"
  | "marketingLabel"
  | "marketingDescription"
  | "categoryIds"
  | "itemIds"
> & { id?: string; expectedUpdatedAt?: string | null; requestId: string };

export type CouponFieldErrors = Partial<Record<keyof CouponWriteInput, string>>;
export type CouponWriteErrorCode =
  | "INVALID_INPUT"
  | "CODE_CONFLICT"
  | "CONFLICT"
  | "REQUEST_CONFLICT"
  | "FORBIDDEN"
  | "UNAVAILABLE";
export class CouponWriteError extends Error {
  constructor(
    public code: CouponWriteErrorCode,
    message: string,
    public fieldErrors: CouponFieldErrors = {},
  ) {
    super(message);
  }
}

export function validateCouponWrite(
  input: CouponWriteInput,
): CouponFieldErrors {
  const errors: CouponFieldErrors = {};
  if (!input.name.trim() || input.name.trim().length > 80)
    errors.name = "Kupon adı 1-80 karakter olmalıdır.";
  if (!isCouponCode(input.code))
    errors.code = "3-32 karakter kullanın: A-Z, rakam, tire veya alt çizgi.";
  if (
    !Number.isFinite(input.discountValue) ||
    input.discountValue <= 0 ||
    input.discountValue > (input.discountType === "percentage" ? 100 : 100000)
  )
    errors.discountValue =
      input.discountType === "percentage"
        ? "0’dan büyük, en fazla %100 indirim girin."
        : "0’dan büyük, en fazla 100.000 ₺ girin.";
  if (
    !Number.isFinite(input.minimumAmount) ||
    input.minimumAmount < 0 ||
    input.minimumAmount > 1000000
  )
    errors.minimumAmount = "0 ile 1.000.000 ₺ arasında tutar girin.";
  if (
    input.discountType === "percentage" &&
    input.maximumDiscountAmount !== null &&
    (!Number.isFinite(input.maximumDiscountAmount) ||
      input.maximumDiscountAmount <= 0 ||
      input.maximumDiscountAmount > 1000000)
  )
    errors.maximumDiscountAmount =
      "0’dan büyük, en fazla 1.000.000 ₺ girin veya boş bırakın.";
  for (const key of ["totalUsageLimit", "perCustomerLimit"] as const) {
    const value = input[key];
    if (
      value !== null &&
      (!Number.isSafeInteger(value) || value < 1 || value > 2147483647)
    )
      errors[key] = "Pozitif bir tam sayı girin veya boş bırakın.";
  }
  for (const key of ["startsAt", "endsAt"] as const)
    if (input[key] !== null && !Number.isFinite(Date.parse(input[key]!)))
      errors[key] = "Geçerli bir tarih ve saat girin.";
  if (
    input.startsAt &&
    input.endsAt &&
    Date.parse(input.endsAt) <= Date.parse(input.startsAt)
  )
    errors.endsAt = "Bitiş, başlangıçtan sonra olmalıdır.";
  if (input.scope === "category" && !input.categoryIds.length)
    errors.categoryIds = "En az bir kategori seçin.";
  if (input.scope === "product" && !input.itemIds.length)
    errors.itemIds = "En az bir ürün seçin.";
  if (input.categoryIds.length > 100)
    errors.categoryIds = "En fazla 100 kategori seçebilirsiniz.";
  if (input.itemIds.length > 200)
    errors.itemIds = "En fazla 200 ürün seçebilirsiniz.";
  if (input.audience === "everyone" && input.perCustomerLimit !== null)
    errors.perCustomerLimit =
      "Kişi başı limit için üyeler veya ilk sipariş kitlesini seçin.";
  if ((input.marketingLabel?.length ?? 0) > 60)
    errors.marketingLabel = "En fazla 60 karakter kullanın.";
  if ((input.marketingDescription?.length ?? 0) > 160)
    errors.marketingDescription = "En fazla 160 karakter kullanın.";
  if (input.id && !input.expectedUpdatedAt)
    errors.expectedUpdatedAt = "Kuponun güncel sürümünü yükleyin.";
  return errors;
}
