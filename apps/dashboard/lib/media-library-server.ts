import "server-only";
import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  createMediaLibraryPort,
  createMenuArPort,
  type MediaSession,
} from "@garsonless/db/server";
import { inspectArModel, isArModelMime } from "@garsonless/domain/ar-model";
import { executeMediaCommand } from "@garsonless/application/media-library";
import {
  mediaKind,
  mediaUploadError,
  purposeKind,
  type MediaAsset,
  type MediaContext,
  type MediaPurpose,
} from "@garsonless/domain/media-library";
import { assertAccess, assertRestaurantFeature } from "./auth/access";
import { sniffMenuImageMime } from "./menu-image-policy";
import { validateThemeVideo } from "./theme-video-policy";

export async function mediaService(
  restaurantId: string,
  context: MediaContext,
) {
  const gate = await assertAccess(restaurantId, context);
  if ("error" in gate) throw new Error("forbidden");
  const port = createMediaLibraryPort();
  const actor = {
    restaurantId,
    userId: gate.userId,
    isOwner: gate.access.isOwner,
    permissions: gate.access.permissions,
  };
  const command = <T>(mode: string, payload: Record<string, unknown> = {}) =>
    executeMediaCommand<T>(actor, context, mode, payload, port);
  async function videoAccess() {
    if (
      "error" in
      (await assertRestaurantFeature(restaurantId, "theme_video_hero"))
    )
      throw new Error("forbidden");
  }
  // 3D models are only accepted where AR is switched on for the restaurant.
  async function modelAccess() {
    const access = await createMenuArPort().readAccess({ restaurantId });
    if (!access.ok) throw new Error("unavailable");
    if (!access.value) throw new Error("ar_disabled");
  }
  async function prepare(input: {
    id: string;
    name: string;
    size: number;
    type: string;
  }) {
    if (mediaUploadError(input.size, input.type))
      throw new Error("invalid_file");
    if (input.type.startsWith("video/")) await videoAccess();
    if (isArModelMime(input.type)) await modelAccess();
    const session = await command<MediaSession>("prepare", input);
    if (session.status === "complete")
      return {
        id: session.id,
        asset: await command<MediaAsset>("asset", { id: session.result_id }),
      };
    if (
      ["cancelled", "failed"].includes(session.status) ||
      Date.parse(session.expires_at) <= Date.now()
    )
      throw new Error("expired");
    return {
      id: session.id,
      signedUrl: await port.sign(
        `library/${restaurantId}/${session.id}/source`,
      ),
    };
  }
  async function complete(
    id: string,
    supplied?: File,
  ): Promise<{ pending: true } | { asset: MediaAsset }> {
    const current = await command<MediaSession>("read", { id });
    if (current.status === "complete")
      return {
        asset: await command<MediaAsset>("asset", { id: current.result_id }),
      };
    const session = await command<MediaSession | null>("claim", { id });
    if (!session) return { pending: true };
    try {
      const source =
        supplied ??
        (await port.download(
          "restaurant-media-staging",
          `library/${restaurantId}/${id}/source`,
        ));
      if (
        source.size !== session.metadata.size ||
        source.type.split(";")[0] !== session.metadata.type
      )
        throw new Error("invalid_file");
      const bytes = Buffer.from(await source.arrayBuffer()),
        mime = session.metadata.type;
      if (mediaUploadError(bytes.length, mime)) throw new Error("invalid_file");
      const hash = createHash("sha256").update(bytes).digest("hex");
      const hashed = await command<MediaSession>("hash", {
        id,
        token: session.token,
        hash,
      });
      if (hashed.status === "complete")
        return {
          asset: await command<MediaAsset>("asset", { id: hashed.result_id }),
        };
      const outputs: {
        role: string;
        bytes: Uint8Array;
        mime: string;
        file: string;
        bucket: string;
      }[] = [
        {
          role: "source",
          bytes,
          mime,
          file: "source",
          bucket: "restaurant-media-sources",
        },
      ];
      let width: number | null = null,
        height: number | null = null,
        duration: number | null = null;
      if (isArModelMime(mime)) {
        await modelAccess();
        const inspection = inspectArModel(new Uint8Array(bytes), mime);
        if (!inspection.ok) throw new Error(`model_${inspection.reason}`);
        // No image processing: the validated file itself is the public model.
        outputs.push({
          role: "model",
          bytes,
          mime,
          file: `model.${inspection.format}`,
          bucket: "restaurant-assets",
        });
      } else if (mime.startsWith("video/")) {
        await videoAccess();
        const video = validateThemeVideo({ bytes, claimedType: mime });
        if (!video.ok) throw new Error("invalid_file");
        duration = video.video.durationSeconds;
        outputs.push({
          role: "video",
          bytes,
          mime,
          file: `video.${video.video.extension}`,
          bucket: "restaurant-assets",
        });
      } else {
        if (sniffMenuImageMime(bytes) !== mime) throw new Error("invalid_file");
        for (const [role, edge, max] of [
          ["image", 2400, 8388608],
          ["menu", 2000, 5242880],
          ["logo", 512, 2097152],
        ] as const) {
          const output = await sharp(bytes, {
            limitInputPixels: 24_000_000,
            animated: false,
          })
            .rotate()
            .resize({
              width: edge,
              height: edge,
              fit: "inside",
              withoutEnlargement: true,
            })
            .webp({ quality: 82 })
            .toBuffer({ resolveWithObject: true });
          if (output.data.length > max) throw new Error("invalid_file");
          if (role === "image") {
            width = output.info.width;
            height = output.info.height;
          }
          outputs.push({
            role,
            bytes: output.data,
            mime: "image/webp",
            file: `${role}.webp`,
            bucket: "restaurant-assets",
          });
        }
      }
      const objects = [];
      for (const output of outputs) {
        const path = `restaurants/${restaurantId}/library/${id}/${output.file}`;
        const url = await port.put(
          output.bucket,
          path,
          output.bytes,
          output.mime,
        );
        objects.push({
          role: output.role,
          bucket: output.bucket,
          path,
          bytes: output.bytes.byteLength,
          url,
        });
      }
      const finished = await command<MediaSession>("finish", {
        id,
        token: session.token,
        objects,
        width,
        height,
        duration,
      });
      return {
        asset: await command<MediaAsset>("asset", { id: finished.result_id }),
      };
    } catch (error) {
      const latest = await command<MediaSession>("read", { id }).catch(
        () => null,
      );
      if (latest?.status === "complete")
        return {
          asset: await command<MediaAsset>("asset", { id: latest.result_id }),
        };
      await command("fail", { id, token: session.token }).catch(() => {});
      throw error;
    }
  }
  async function resolve(id: string, purpose: MediaPurpose) {
    let asset = await command<MediaAsset>("asset", { id });
    if (mediaKind(asset.mime) !== purposeKind(purpose))
      throw new Error("invalid_file");
    if (purpose === "video") await videoAccess();
    if (purpose === "model") await modelAccess();
    if (
      (purpose === "menu" && asset.menuUrl === asset.url) ||
      (purpose === "logo" && asset.logoUrl === asset.url)
    ) {
      const draft = await command<MediaSession>("derive", { id });
      if (draft.status !== "complete") {
        const lease = await command<MediaSession | null>("claim", {
          id: draft.id,
        });
        if (!lease) throw new Error("busy");
        try {
          const original = await command<{ bucket: string; path: string }>(
            "source",
            { id },
          );
          const blob = await port.download(original.bucket, original.path);
          if (blob.size > 8 * 1024 * 1024) throw new Error("invalid_file");
          const bytes = Buffer.from(await blob.arrayBuffer()),
            objects = [];
          const dimensions = await sharp(bytes, {
            limitInputPixels: 24_000_000,
          }).metadata();
          for (const [role, edge, max] of [
            ["menu", 2000, 5242880],
            ["logo", 512, 2097152],
          ] as const) {
            const buffer = await sharp(bytes, { limitInputPixels: 24_000_000 })
              .rotate()
              .resize({
                width: edge,
                height: edge,
                fit: "inside",
                withoutEnlargement: true,
              })
              .webp({ quality: 82 })
              .toBuffer();
            if (buffer.length > max) throw new Error("invalid_file");
            const path = `restaurants/${restaurantId}/library/${id}/${role}.webp`;
            const url = await port.put(
              "restaurant-assets",
              path,
              buffer,
              "image/webp",
            );
            objects.push({
              role,
              bucket: "restaurant-assets",
              path,
              bytes: buffer.length,
              url,
            });
          }
          await command("finish", {
            id: lease.id,
            token: lease.token,
            objects,
            width: dimensions.width,
            height: dimensions.height,
          });
        } catch (error) {
          await command("fail", { id: lease.id, token: lease.token }).catch(
            () => {},
          );
          throw error;
        }
      }
      asset = await command<MediaAsset>("asset", { id });
    }
    const url =
      purpose === "logo"
        ? asset.logoUrl
        : purpose === "menu"
          ? asset.menuUrl
          : asset.url;
    if (!url) throw new Error("invalid_file");
    return {
      asset,
      url,
      width: asset.width,
      height: asset.height,
      mime: url.endsWith(".webp") ? "image/webp" : asset.mime,
      durationSeconds: asset.duration,
    };
  }
  return { command, prepare, complete, resolve, port };
}

/** Compatibility entry point: existing upload actions also enter the same quota/catalogue. */
export async function ingestMediaFile(
  restaurantId: string,
  context: MediaContext,
  file: File,
  purpose: MediaPurpose,
) {
  const service = await mediaService(restaurantId, context);
  const id = crypto.randomUUID();
  await service.prepare({
    id,
    name: file.name.slice(0, 200) || "Görsel",
    size: file.size,
    type: file.type,
  });
  const result = await service.complete(id, file);
  if ("pending" in result) throw new Error("busy");
  return service.resolve(result.asset.id, purpose);
}
