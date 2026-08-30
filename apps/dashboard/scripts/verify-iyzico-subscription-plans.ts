import Iyzipay from "iyzipay";
import {
  BILLING_INTERVALS,
  SELF_SERVE_PLANS,
} from "@garsonless/domain/entitlements";
import { readIyzicoSubscriptionProviderConfig } from "../lib/billing/iyzico-subscription-config";
import { verifyIyzicoSubscriptionPlanResponse } from "../lib/billing/iyzico-subscription-plan-verification";

type ProviderResponse = Record<string, unknown>;
type ProviderCallback = (
  error: Error | null,
  response: ProviderResponse,
) => void;
type PricingPlanClient = {
  subscriptionPricingPlan: {
    retrieve(
      request: { pricingPlanReferenceCode: string },
      callback: ProviderCallback,
    ): void;
  };
};

const TIMEOUT_MS = 15_000;

function retrieve(
  client: PricingPlanClient,
  referenceCode: string,
): Promise<ProviderResponse> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("provider_timeout")),
      TIMEOUT_MS,
    );
    client.subscriptionPricingPlan.retrieve(
      { pricingPlanReferenceCode: referenceCode },
      (error, response) => {
        clearTimeout(timeout);
        if (error) reject(new Error("provider_request_failed"));
        else resolve(response);
      },
    );
  });
}

async function main() {
  const config = readIyzicoSubscriptionProviderConfig();
  const client = new Iyzipay({
    apiKey: config.apiKey,
    secretKey: config.secretKey,
    uri: config.baseUrl,
  }) as unknown as PricingPlanClient;
  const plans = SELF_SERVE_PLANS.flatMap((plan) =>
    BILLING_INTERVALS.map((interval) => ({
      label: `${plan}/${interval}`,
      interval,
      ...config.plans[plan][interval],
    })),
  );

  for (const plan of plans) {
    const response = await retrieve(client, plan.referenceCode);
    const result = verifyIyzicoSubscriptionPlanResponse(response, plan);
    if (!result.ok) throw new Error(`${plan.label}: contract_mismatch`);
    console.log(`PASS ${plan.label}`);
  }
  console.log(`PASS iyzico subscription provider (${plans.length} plans)`);
}

main().catch((cause: unknown) => {
  const message = cause instanceof Error ? cause.message : "unknown_failure";
  console.error(`FAIL iyzico subscription provider: ${message}`);
  process.exitCode = 1;
});
