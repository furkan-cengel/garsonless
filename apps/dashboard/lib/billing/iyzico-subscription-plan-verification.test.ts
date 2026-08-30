import assert from "node:assert/strict";
import test from "node:test";
import { verifyIyzicoSubscriptionPlanResponse } from "./iyzico-subscription-plan-verification";

function response(overrides: Record<string, unknown> = {}) {
  return {
    status: "success",
    data: {
      referenceCode: "starter-annual-live",
      price: 4_020.48,
      currencyCode: "TRY",
      paymentInterval: "YEARLY",
      paymentIntervalCount: 1,
      planPaymentType: "RECURRING",
      trialPeriodDays: 0,
      status: "ACTIVE",
      ...overrides,
    },
  };
}

const expected = {
  referenceCode: "starter-annual-live",
  amountMinor: 402_048,
  interval: "annual" as const,
};

test("live plan verification accepts the exact annual recurring TRY contract", () => {
  assert.deepEqual(verifyIyzicoSubscriptionPlanResponse(response(), expected), {
    ok: true,
    value: { referenceCode: expected.referenceCode },
  });
});

test("live plan verification rejects price, cadence, trial and reference drift", () => {
  for (const drift of [
    { price: 4_020.49 },
    { paymentInterval: "MONTHLY" },
    { paymentIntervalCount: 12 },
    { trialPeriodDays: 14 },
    { referenceCode: "substituted-plan" },
  ]) {
    assert.equal(
      verifyIyzicoSubscriptionPlanResponse(response(drift), expected).ok,
      false,
    );
  }
});
