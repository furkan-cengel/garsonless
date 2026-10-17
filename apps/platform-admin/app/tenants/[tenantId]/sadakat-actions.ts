"use server";
import { validSadakatId } from "@garsonless/application/sadakat";
import { grantSadakatPilot, sadakatError } from "@garsonless/db/server";
import { requirePlatformAdminActor } from "../../../lib/platform-admin-auth";
import { revalidatePath } from "next/cache";
export async function grantSadakatPilotAction(input: unknown) {
  const actor = await requirePlatformAdminActor();
  if (actor.role !== "ops" && actor.role !== "superadmin")
    return {
      error: "Pilot erişimini operasyon veya süper yönetici atayabilir.",
    };
  if (!input || typeof input !== "object")
    return { error: "Bilgileri kontrol et." };
  const data = input as Record<string, unknown>;
  if (
    ["restaurantId", "startsAt", "endsAt", "reason", "requestId"].some(
      (key) => typeof data[key] !== "string",
    )
  )
    return { error: "Bilgileri kontrol et." };
  const value = data as {
    restaurantId: string;
    startsAt: string;
    endsAt: string;
    reason: string;
    requestId: string;
  };
  if (
    !validSadakatId(value.restaurantId) ||
    !validSadakatId(value.requestId) ||
    value.reason.trim().length < 10 ||
    value.reason.length > 1000 ||
    !Number.isFinite(Date.parse(value.startsAt)) ||
    !Number.isFinite(Date.parse(value.endsAt)) ||
    Date.parse(value.endsAt) <= Date.parse(value.startsAt)
  )
    return { error: "Tarihleri ve gerekçeyi kontrol et." };
  try {
    await grantSadakatPilot({ ...value, actorId: actor.userId });
    revalidatePath(`/tenants/${value.restaurantId}`);
    return { success: true as const };
  } catch (error) {
    return { error: sadakatError(error) };
  }
}
