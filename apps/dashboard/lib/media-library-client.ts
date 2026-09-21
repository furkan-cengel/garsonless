"use client";
import type {
  MediaAsset,
  MediaContext,
  MediaPurpose,
} from "@garsonless/domain/media-library";
export async function mediaRequest<T>(
  restaurantId: string,
  context: MediaContext,
  mode: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const response = await fetch("/api/media-library", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ restaurantId, context, mode, payload }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok)
    throw Object.assign(
      new Error(result?.error || "İşlem tamamlanamadı. Yeniden deneyin."),
      { code: result?.code },
    );
  return result.data as T;
}
const uploadIds = new WeakMap<File, string>();
export async function uploadLibraryFile(
  restaurantId: string,
  context: MediaContext,
  file: File,
  onProgress: (percent: number | null) => void,
  signal?: AbortSignal,
  renewed = false,
): Promise<MediaAsset> {
  if (signal?.aborted) throw new Error("Yükleme durduruldu.");
  let id = uploadIds.get(file);
  if (!id) {
    id = crypto.randomUUID();
    uploadIds.set(file, id);
  }
  let ticket: { id: string; signedUrl?: string; asset?: MediaAsset };
  try {
    ticket = await mediaRequest<{
      id: string;
      signedUrl?: string;
      asset?: MediaAsset;
    }>(restaurantId, context, "prepare", {
      id,
      name: file.name.slice(0, 200),
      size: file.size,
      type: file.type,
    });
  } catch (error) {
    if ((error as { code?: string }).code === "expired" && !renewed) {
      uploadIds.delete(file);
      return uploadLibraryFile(
        restaurantId,
        context,
        file,
        onProgress,
        signal,
        true,
      );
    }
    throw error;
  }
  if (ticket.asset) return ticket.asset;
  const url = new URL(ticket.signedUrl!);
  const origin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin;
  if (
    url.origin !== origin ||
    !url.pathname.startsWith(
      "/storage/v1/object/upload/sign/restaurant-media-staging/library/",
    )
  )
    throw new Error("Yükleme adresi doğrulanamadı.");
  try {
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.setRequestHeader("x-upsert", "false");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable)
          onProgress(Math.round((e.loaded / e.total) * 100));
      };
      const abort = () => {
        xhr.abort();
        reject(new Error("Yükleme durduruldu."));
      };
      signal?.addEventListener("abort", abort, { once: true });
      xhr.onloadend = () => signal?.removeEventListener("abort", abort);
      xhr.onload = () => {
        let duplicate = false;
        try {
          const body = JSON.parse(xhr.responseText);
          duplicate =
            xhr.status === 400 &&
            (body.error === "Duplicate" || body.statusCode === "409");
        } catch {
          /* A non-JSON error is not a duplicate acknowledgement. */
        }
        if (
          (xhr.status >= 200 && xhr.status < 300) ||
          xhr.status === 409 ||
          duplicate
        )
          resolve();
        else reject(new Error("Dosya aktarılamadı. Yeniden deneyin."));
      };
      xhr.onerror = () =>
        reject(new Error("Bağlantı kesildi. Yeniden deneyin."));
      xhr.onabort = () => reject(new Error("Yükleme durduruldu."));
      if (signal?.aborted) abort();
      else xhr.send(file);
    });
  } catch (error) {
    if (signal?.aborted)
      await mediaRequest(restaurantId, context, "cancel", { id }).catch(
        () => {},
      );
    throw error;
  }
  onProgress(null);
  for (let n = 0; n < 50; n++) {
    if (signal?.aborted) throw new Error("Yükleme durduruldu.");
    const result = await mediaRequest<{
      pending?: boolean;
      asset?: MediaAsset;
    }>(restaurantId, context, "complete", { id });
    if (result.asset) return result.asset;
    await new Promise((r) => setTimeout(r, 1200));
  }
  throw new Error("Dosya hazırlanıyor. Biraz sonra listeyi yenileyin.");
}
export async function resolveLibraryAsset(
  restaurantId: string,
  context: MediaContext,
  id: string,
  purpose: MediaPurpose,
) {
  return mediaRequest<{
    asset: MediaAsset;
    url: string;
    width: number;
    height: number;
    mime: string;
    durationSeconds: number;
  }>(restaurantId, context, "resolve", { id, purpose });
}
