"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { mutateSadakat, saveSadakat } from "@garsonless/application/sadakat";
import { setTeamMemberStatus } from "@garsonless/application/team";
import {
  createSadakatBusiness,
  createSadakatPort,
  createTeamCommandPort,
  readSadakatDashboard,
  sadakatError,
  listTeamMembers,
} from "@garsonless/db/server";
import type { SadakatConfig, SadakatCard } from "@garsonless/domain/sadakat";
import { getDashboardRequestAuth } from "../auth/current-user";

const id = z.string().uuid();
const command = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("earn"),
    requestId: id,
    code: z.string().max(32),
    quantity: z.number().int().min(1).max(20),
  }),
  z.object({
    kind: z.literal("redeem"),
    requestId: id,
    code: z.string().max(32),
  }),
  z.object({
    kind: z.literal("reversal"),
    requestId: id,
    reverseId: id,
    reason: z.string().trim().min(3).max(500),
  }),
]);
export async function saveSadakatAction(
  restaurantId: string,
  config: SadakatConfig,
) {
  const { user } = await getDashboardRequestAuth();
  try {
    await saveSadakat(restaurantId, user.id, config, createSadakatPort());
    revalidatePath(`/sadakat/${restaurantId}`);
    return { success: true as const };
  } catch (error) {
    return { error: sadakatError(error) };
  }
}
export async function resolveSadakatAction(restaurantId: string, code: string) {
  const { user } = await getDashboardRequestAuth();
  if (
    !id.safeParse(restaurantId).success ||
    typeof code !== "string" ||
    code.length > 32
  )
    return { error: "Kodu kontrol et." };
  try {
    const result = (await createSadakatPort().resolve(
      restaurantId,
      user.id,
      code,
    )) as { name: string | null; card: SadakatCard };
    return { success: true as const, ...result };
  } catch (error) {
    return { error: sadakatError(error) };
  }
}
export async function mutateSadakatAction(
  restaurantId: string,
  input: unknown,
) {
  const { user } = await getDashboardRequestAuth();
  const parsed = command.safeParse(input);
  if (!parsed.success || !id.safeParse(restaurantId).success)
    return { error: "İşlem bilgilerini kontrol et." };
  try {
    const result = await mutateSadakat(
      { ...parsed.data, restaurantId, actorId: user.id },
      createSadakatPort(),
    );
    revalidatePath(`/sadakat/${restaurantId}`);
    console.info(
      JSON.stringify({
        event: "sadakat.operation",
        restaurantId,
        kind: parsed.data.kind,
        result: "success",
      }),
    );
    return { success: true as const, result };
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "sadakat.operation",
        restaurantId,
        kind: parsed.data.kind,
        result: "error",
      }),
    );
    return { error: sadakatError(error) };
  }
}
export async function setSadakatStaffStatus(
  restaurantId: string,
  memberId: string,
  status: "active" | "disabled",
) {
  const { user } = await getDashboardRequestAuth();
  if (
    !id.safeParse(restaurantId).success ||
    !id.safeParse(memberId).success ||
    !["active", "disabled"].includes(status)
  )
    return { error: "Bilgileri kontrol et." };
  try {
    const dashboard = await readSadakatDashboard(restaurantId, user.id);
    if (!dashboard.isOwner || !dashboard.active)
      return { error: "Bu işlem için aktif sahip erişimi gerekli." };
    const member = (await listTeamMembers(restaurantId)).find(
      (row) => row.id === memberId,
    );
    if (
      !member ||
      member.permissions.length !== 1 ||
      member.permissions[0] !== "sadakat"
    )
      return { error: "Bu personeli ana Masabu panelinden yönet." };
    const result = await setTeamMemberStatus(
      {
        actor: "dashboard-member",
        userId: user.id,
        restaurantId,
        isOwner: true,
        permissions: ["settings"],
      },
      { restaurantId, memberId, status },
      createTeamCommandPort(),
    );
    if (!result.ok) return { error: "Personel durumu değiştirilemedi." };
    revalidatePath(`/sadakat/${restaurantId}`);
    return { success: true as const };
  } catch (error) {
    return { error: sadakatError(error) };
  }
}
export async function createSadakatBusinessAction(input: unknown) {
  const { user } = await getDashboardRequestAuth();
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(120),
      slug: z
        .string()
        .min(3)
        .max(80)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      requestId: id,
    })
    .safeParse(input);
  if (!parsed.success)
    return { error: "İşletme adını ve bağlantısını kontrol et." };
  try {
    return await createSadakatBusiness({ ...parsed.data, actorId: user.id });
  } catch (error) {
    return { error: sadakatError(error) };
  }
}
