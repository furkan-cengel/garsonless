import { sanitizeServerDiagnostic } from "../../../lib/server-log-redaction";
import { after } from "next/server";
import { cleanupMediaLibrary } from "@garsonless/db/server";
import { z } from "zod";
import {
  MEDIA_CONTEXTS,
  type MediaSnapshot,
  formatMediaBytes,
  mediaErrorMessage,
} from "@garsonless/domain/media-library";
import { mediaService } from "../../../lib/media-library-server";
import { readMediaMetadataRequest } from "../../../lib/media-staging-request";
export const runtime = "nodejs";
export const maxDuration = 60;
const schema = z
  .object({
    restaurantId: z.string().uuid(),
    context: z.enum(MEDIA_CONTEXTS),
    mode: z.enum([
      "list",
      "prepare",
      "complete",
      "cancel",
      "asset",
      "metadata",
      "delete",
      "resolve",
    ]),
    payload: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
export async function POST(request: Request) {
  let authorized = false;
  let service: Awaited<ReturnType<typeof mediaService>> | undefined;
  let requestedBytes = 0;
  try {
    const input = schema.parse(await readMediaMetadataRequest(request));
    const s = await mediaService(input.restaurantId, input.context);
    authorized = true;
    service = s;
    requestedBytes =
      input.mode === "prepare"
        ? Number(input.payload.size) +
          (String(input.payload.type).startsWith("video/")
            ? Number(input.payload.size)
            : 15728640)
        : 7340032;
    let result: unknown;
    if (input.mode === "prepare")
      result = await s.prepare(
        z
          .object({
            id: z.string().uuid(),
            name: z.string().min(1).max(200),
            size: z.number().int().positive(),
            type: z.string().max(100),
          })
          .parse(input.payload),
      );
    else if (input.mode === "complete")
      result = await s.complete(z.string().uuid().parse(input.payload.id));
    else if (input.mode === "resolve")
      result = await s.resolve(
        z.string().uuid().parse(input.payload.id),
        z.enum(["image", "menu", "logo", "video"]).parse(input.payload.purpose),
      );
    else result = await s.command(input.mode, input.payload);
    if (["complete", "delete", "cancel"].includes(input.mode))
      after(async () => {
        await cleanupMediaLibrary().catch(() => {});
      });
    return Response.json(
      { ok: true, data: result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.warn("[media-library]", sanitizeServerDiagnostic(error));
    if (authorized)
      after(async () => {
        await cleanupMediaLibrary().catch(() => {});
      });
    const code = error instanceof Error ? error.message : "unavailable";
    let message = mediaErrorMessage(code);
    if (code === "quota_exceeded" && service) {
      const quota = await service
        .command<MediaSnapshot>("list")
        .catch(() => null);
      if (quota)
        message = `Bu işlem için en fazla ${formatMediaBytes(requestedBytes)} ayrılması gerekiyor. Kullanılabilir alan: ${formatMediaBytes(Math.max(0, quota.limit - quota.used - quota.reserved))}. Kullanılmayan dosyaları silin veya paketinizi yükseltin.`;
    }
    return Response.json(
      {
        ok: false,
        code: code === "expired" ? "expired" : undefined,
        error: message,
      },
      {
        status: code === "forbidden" ? 403 : 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
