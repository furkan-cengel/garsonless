import {
  validSadakatConfig,
  type SadakatConfig,
  type SadakatMutation,
} from "@garsonless/domain/sadakat";
export interface SadakatPort {
  save(
    restaurantId: string,
    actorId: string,
    config: SadakatConfig,
  ): Promise<unknown>;
  resolve(
    restaurantId: string,
    actorId: string,
    code: string,
  ): Promise<unknown>;
  mutate(input: {
    restaurantId: string;
    actorId: string;
    requestId: string;
    kind: SadakatMutation["kind"];
    code?: string;
    quantity?: number;
    reverseId?: string;
    reason?: string;
  }): Promise<SadakatMutation>;
}
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
export function validSadakatId(value: string) {
  return UUID.test(value);
}
export function normalizeSadakatCode(value: string): string | null {
  const code = value.trim().replace(/[-\s]/g, "").toUpperCase();
  return /^[A-F\d]{16}$/.test(code) ? code : null;
}
export async function saveSadakat(
  restaurantId: string,
  actorId: string,
  config: SadakatConfig,
  port: SadakatPort,
) {
  if (
    !UUID.test(restaurantId) ||
    !UUID.test(actorId) ||
    !validSadakatConfig(config)
  )
    throw new Error("SADAKAT_INVALID");
  return port.save(restaurantId, actorId, config);
}
export async function mutateSadakat(
  input: Parameters<SadakatPort["mutate"]>[0],
  port: SadakatPort,
) {
  if (
    ![input.restaurantId, input.actorId, input.requestId].every(validSadakatId)
  )
    throw new Error("SADAKAT_INVALID");
  if (input.kind === "reversal") {
    if (
      !input.reverseId ||
      !UUID.test(input.reverseId) ||
      !input.reason ||
      input.reason.trim().length < 3 ||
      input.reason.length > 500
    )
      throw new Error("SADAKAT_REASON_REQUIRED");
  } else if (
    (input.kind !== "earn" && input.kind !== "redeem") ||
    !input.code ||
    !normalizeSadakatCode(input.code)
  )
    throw new Error("SADAKAT_INVALID");
  if (
    input.kind === "earn" &&
    (!Number.isInteger(input.quantity) ||
      input.quantity! < 1 ||
      input.quantity! > 20)
  )
    throw new Error("SADAKAT_INVALID");
  return port.mutate(input);
}
