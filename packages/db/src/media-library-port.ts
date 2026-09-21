import type { MediaLibraryPort } from "@garsonless/application/media-library";
import { createServiceClient } from "./service-client";
export interface MediaSession {
  id: string;
  asset_id: string;
  restaurant_id: string;
  actor_id: string;
  metadata: { name: string; size: number; type: string };
  status: string;
  token: string;
  result_id: string | null;
  expires_at: string;
}
export function createMediaLibraryPort(): MediaLibraryPort & {
  sign(path: string): Promise<string>;
  download(bucket: string, path: string): Promise<Blob>;
  put(
    bucket: string,
    path: string,
    bytes: Uint8Array,
    mime: string,
  ): Promise<string>;
  maintenance<T>(mode: string, payload?: Record<string, unknown>): Promise<T>;
  remove(bucket: string, path: string): Promise<void>;
  sourceUrl(path: string): Promise<string>;
} {
  const client = createServiceClient();
  const rpc = client.rpc.bind(client) as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
  async function call<T>(name: string, args: Record<string, unknown>) {
    const r = await rpc(name, args);
    if (r.error) throw new Error(r.error.message);
    return r.data as T;
  }
  return {
    command: (restaurantId, actorId, context, mode, payload = {}) =>
      call("media_command", {
        p_restaurant: restaurantId,
        p_actor: actorId,
        p_context: context,
        p_mode: mode,
        p_payload: payload,
      }),
    maintenance: (mode, payload = {}) =>
      call("media_maintenance", { p_mode: mode, p_payload: payload }),
    async sign(path) {
      const { data, error } = await client.storage
        .from("restaurant-media-staging")
        .createSignedUploadUrl(path, { upsert: false });
      if (error) throw error;
      return data.signedUrl;
    },
    async download(bucket, path) {
      const { data, error } = await client.storage.from(bucket).download(path);
      if (error) throw error;
      return data;
    },
    async put(bucket, path, bytes, mime) {
      const { error } = await client.storage
        .from(bucket)
        .upload(path, bytes, {
          contentType: mime,
          upsert: false,
          cacheControl: "31536000",
        });
      if (error) {
        // A lost write acknowledgement is safe to retry only for byte-identical immutable data.
        const { data, error: readError } = await client.storage
          .from(bucket)
          .download(path);
        if (
          readError ||
          !data ||
          !Buffer.from(await data.arrayBuffer()).equals(Buffer.from(bytes))
        )
          throw error;
      }
      return bucket === "restaurant-assets"
        ? client.storage.from(bucket).getPublicUrl(path).data.publicUrl
        : "";
    },
    async remove(bucket, path) {
      const { error } = await client.storage.from(bucket).remove([path]);
      if (error) throw error;
    },
    async sourceUrl(path) {
      const { data, error } = await client.storage
        .from("restaurant-media-sources")
        .createSignedUrl(path, 60, { download: true });
      if (error) throw error;
      return data.signedUrl;
    },
  };
}
export async function cleanupMediaLibrary() {
  const port = createMediaLibraryPort();
  const jobs =
    await port.maintenance<{ id: number; bucket: string; path: string }[]>(
      "sweep",
    );
  let cleaned = 0;
  for (const j of jobs) {
    try {
      await port.remove(j.bucket, j.path);
      await port.maintenance("cleaned", { id: j.id });
      cleaned++;
    } catch {
      /* Durable job remains pending for the next run. */
    }
  }
  return cleaned;
}
