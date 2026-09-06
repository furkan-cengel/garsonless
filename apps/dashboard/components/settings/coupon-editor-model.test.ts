import assert from "node:assert/strict";
import test from "node:test";
import {
  couponDateInstant,
  createCouponDraft,
  localCouponDate,
  parseCouponDraft,
  suggestCouponCode,
} from "./coupon-editor-model";
import { validateCouponWrite, isCouponCode } from "@garsonless/domain/coupons";

test("suggested codes are readable, editable-format compatible and fresh", () => {
  const codes = Array.from({ length: 100 }, suggestCouponCode);
  assert.equal(new Set(codes).size, 100);
  for (const code of codes) {
    assert.match(code, /^KUPON-[A-HJ-NP-Z2-9]{8}$/);
    assert.equal(isCouponCode(code), true);
  }
});
test("Istanbul 14:30 survives save and reopen without using the browser timezone", () => {
  const iso = couponDateInstant("2026-09-10T14:30", "Europe/Istanbul");
  assert.equal(iso.value, "2026-09-10T11:30:00.000Z");
  assert.equal(
    localCouponDate(iso.value, "Europe/Istanbul"),
    "2026-09-10T14:30",
  );
});
for (const [zone, gap, fold] of [
  ["Europe/Berlin", "2026-03-29T02:30", "2026-10-25T02:30"],
  ["America/New_York", "2026-03-08T02:30", "2026-11-01T01:30"],
]) {
  test(`${zone} rejects skipped and ambiguous wall times`, () => {
    assert.ok(couponDateInstant(gap!, zone!).error);
    assert.ok(couponDateInstant(fold!, zone!).error);
  });
}
test("empty, invalid and impossible dates do not throw", () => {
  assert.deepEqual(couponDateInstant("", "Europe/Istanbul"), { value: null });
  for (const value of [
    "2026-02-30T12:30",
    "2026-15-10T14:30",
    "2026-01-01T25:00",
    "bad",
  ])
    assert.ok(couponDateInstant(value, "Europe/Istanbul").error);
});
test("decimal text parses only on submit and optional values remain null", () => {
  const draft = createCouponDraft();
  draft.name = "Kahve";
  draft.discountValue = "12,5";
  const { input, errors } = parseCouponDraft(
    draft,
    "Europe/Istanbul",
    crypto.randomUUID(),
  );
  assert.deepEqual(errors, {});
  assert.equal(input.discountValue, 12.5);
  assert.equal(input.maximumDiscountAmount, null);
  assert.equal(draft.discountValue, "12,5");
});
test("field errors cover required values, numbers, dates and targeted scope", () => {
  const draft = createCouponDraft();
  draft.name = "";
  draft.code = "Ş";
  draft.discountValue = "";
  draft.minimumAmount = "-1";
  draft.scope = "category";
  draft.startsAt = "2026-09-10T14:30";
  draft.endsAt = "2026-09-10T13:30";
  draft.totalUsageLimit = "1.2";
  const { errors } = parseCouponDraft(
    draft,
    "Europe/Istanbul",
    crypto.randomUUID(),
  );
  for (const field of [
    "name",
    "code",
    "discountValue",
    "minimumAmount",
    "categoryIds",
    "endsAt",
    "totalUsageLimit",
  ])
    assert.ok(errors[field as keyof typeof errors], field);
});
test("fixed discounts drop percentage caps and irrelevant hidden targets", () => {
  const draft = createCouponDraft();
  draft.name = "Test";
  draft.discountType = "fixed";
  draft.discountValue = "250";
  draft.maximumDiscountAmount = "1";
  draft.categoryIds = ["stale"];
  draft.perCustomerLimit = "3";
  const { input, errors } = parseCouponDraft(
    draft,
    "Europe/Istanbul",
    crypto.randomUUID(),
  );
  assert.deepEqual(errors, {});
  assert.equal(input.maximumDiscountAmount, null);
  assert.equal(input.perCustomerLimit, null);
  assert.deepEqual(input.categoryIds, []);
});
test("editing requires the previously loaded version", () => {
  const draft = createCouponDraft();
  draft.name = "Test";
  draft.id = crypto.randomUUID();
  const { input } = parseCouponDraft(
    draft,
    "Europe/Istanbul",
    crypto.randomUUID(),
  );
  assert.ok(validateCouponWrite(input).expectedUpdatedAt);
});


test('shadcn selected wall date and raw clock round-trip through restaurant timezone', () => {
  const draft = createCouponDraft(); draft.name = 'Takvim'; draft.startsAt = '10.09.2026 14:30';
  const parsed = parseCouponDraft(draft,'Europe/Istanbul',crypto.randomUUID());
  assert.deepEqual(parsed.errors,{}); assert.equal(parsed.input.startsAt,'2026-09-10T11:30:00.000Z');
  draft.startsAt = '10.09.2026 14:';
  assert.ok(parseCouponDraft(draft,'Europe/Istanbul',crypto.randomUUID()).errors.startsAt);
  assert.equal(draft.startsAt,'10.09.2026 14:');
})
