import { createHash, randomBytes } from "node:crypto";
import {
  normalizeSadakatCode,
  type SadakatPort,
} from "@garsonless/application/sadakat";
import {
  SADAKAT_ERRORS,
  type SadakatCard,
  type SadakatDashboard,
  type SadakatMutation,
  type SadakatProgram,
} from "@garsonless/domain/sadakat";
import { createServiceClient } from "./service-client";

export type SadakatRpc = (
  name: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
async function call<T>(
  name: string,
  args: Record<string, unknown>,
  rpc?: SadakatRpc,
): Promise<T> {
  const service = rpc ? null : createServiceClient();
  const execute = rpc ?? (service!.rpc.bind(service) as unknown as SadakatRpc);
  const { data, error } = await execute(name, args);
  if (error) {
    const code = Object.keys(SADAKAT_ERRORS).find((key) =>
      error.message.includes(key),
    );
    throw new Error(code ?? "SADAKAT_UNAVAILABLE");
  }
  return data as T;
}
export function sadakatError(error: unknown): string {
  return error instanceof Error
    ? (SADAKAT_ERRORS[error.message] ??
        "İşlem tamamlanamadı. Bağlantını kontrol edip tekrar dene.")
    : "İşlem tamamlanamadı.";
}
function sadakatCodeDigest(value: string): string {
  const code = normalizeSadakatCode(value);
  if (!code) throw new Error("SADAKAT_INVALID");
  return createHash("sha256").update(code).digest("hex");
}
export function createSadakatPort(rpc?: SadakatRpc): SadakatPort {
  return {
    save: (restaurantId, actorId, config) =>
      call(
        "save_sadakat_program",
        { p_restaurant: restaurantId, p_actor: actorId, p_config: config },
        rpc,
      ),
    resolve: (restaurantId, actorId, code) =>
      call(
        "resolve_sadakat_code",
        {
          p_restaurant: restaurantId,
          p_actor: actorId,
          p_digest: sadakatCodeDigest(code),
        },
        rpc,
      ),
    mutate: (input) =>
      call<SadakatMutation>(
        "mutate_sadakat",
        {
          p_restaurant: input.restaurantId,
          p_actor: input.actorId,
          p_request: input.requestId,
          p_kind: input.kind,
          p_digest: input.code ? sadakatCodeDigest(input.code) : null,
          p_quantity: input.quantity ?? 1,
          p_reverse: input.reverseId ?? null,
          p_reason: input.reason ?? "",
        },
        rpc,
      ),
  };
}
export const readSadakatProgram = (slug: string) =>
  call<SadakatProgram | null>("read_sadakat_program", { p_slug: slug });
export const readSadakatCard = (restaurantId: string, customerId: string) =>
  call<SadakatCard | null>("read_sadakat_card", {
    p_restaurant: restaurantId,
    p_customer: customerId,
  });
export const readSadakatDashboard = (restaurantId: string, actorId: string) =>
  call<SadakatDashboard>("read_sadakat_dashboard", {
    p_restaurant: restaurantId,
    p_actor: actorId,
  });
export const joinSadakat = (restaurantId: string, customerId: string) =>
  call<SadakatCard>("join_sadakat", {
    p_restaurant: restaurantId,
    p_customer: customerId,
  });
export async function hasSadakatAccess(restaurantId: string): Promise<boolean> {
  try {
    return (
      (await call<boolean>("sadakat_active", {
        p_restaurant: restaurantId,
      })) === true
    );
  } catch {
    return false;
  }
}
export async function issueSadakatCode(
  restaurantId: string,
  customerId: string,
) {
  const code = randomBytes(8).toString("hex").toUpperCase();
  const expiresAt = await call<string>("issue_sadakat_code", {
    p_restaurant: restaurantId,
    p_customer: customerId,
    p_digest: sadakatCodeDigest(code),
  });
  return { code, expiresAt };
}
export const grantSadakatPilot = (input: {
  restaurantId: string;
  actorId: string;
  startsAt: string;
  endsAt: string;
  reason: string;
  requestId: string;
}) =>
  call("grant_sadakat_pilot", {
    p_restaurant: input.restaurantId,
    p_actor: input.actorId,
    p_start: input.startsAt,
    p_end: input.endsAt,
    p_reason: input.reason,
    p_request: input.requestId,
  });
export const createSadakatBusiness = (input: {
  actorId: string;
  name: string;
  slug: string;
  requestId: string;
}) =>
  call<{ restaurantId: string }>("create_sadakat_business", {
    p_actor: input.actorId,
    p_name: input.name,
    p_slug: input.slug,
    p_request: input.requestId,
  });

export async function canSadakatAuthenticate(
  restaurantId: string,
  contact: string,
  method: "phone" | "email" = "phone",
): Promise<boolean> {
  try {
    return (
      (await call<boolean>(
        method === "email"
          ? "can_sadakat_email_authenticate"
          : "can_sadakat_authenticate",
        {
          p_restaurant: restaurantId,
          [method === "email" ? "p_email" : "p_phone"]: contact,
        },
      )) === true
    );
  } catch {
    return false;
  }
}
