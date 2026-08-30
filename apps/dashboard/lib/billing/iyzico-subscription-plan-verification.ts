import { err, ok, type Result } from "@garsonless/domain/result";
import type { BillingInterval } from "@garsonless/domain/entitlements";

type ProviderResponse = Record<string, unknown>;

export type ExpectedIyzicoSubscriptionPlan = {
  referenceCode: string;
  amountMinor: number;
  interval: BillingInterval;
};

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function providerAmountMinor(value: unknown): number | null {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    String(value).trim() === ""
  )
    return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const minor = Math.round(numeric * 100);
  return Math.abs(numeric * 100 - minor) < 0.000_001 &&
    Number.isSafeInteger(minor)
    ? minor
    : null;
}

/** Checks the immutable provider fields that determine when and how much a tenant is charged. */
export function verifyIyzicoSubscriptionPlanResponse(
  response: ProviderResponse,
  expected: ExpectedIyzicoSubscriptionPlan,
): Result<{ referenceCode: string }> {
  const data = object(response.data);
  const expectedInterval =
    expected.interval === "annual" ? "YEARLY" : "MONTHLY";
  if (
    response.status !== "success" ||
    !data ||
    data.referenceCode !== expected.referenceCode ||
    providerAmountMinor(data.price) !== expected.amountMinor ||
    data.currencyCode !== "TRY" ||
    data.paymentInterval !== expectedInterval ||
    data.paymentIntervalCount !== 1 ||
    data.planPaymentType !== "RECURRING" ||
    data.status !== "ACTIVE" ||
    ![0, null, undefined].includes(data.trialPeriodDays as never)
  ) {
    return err(
      "Iyzico subscription pricing plan does not match the production contract",
    );
  }
  return ok({ referenceCode: expected.referenceCode });
}
