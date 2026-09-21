import type { MediaContext } from "@garsonless/domain/media-library";
export interface MediaActor {
  userId: string;
  restaurantId: string;
  isOwner: boolean;
  permissions: readonly string[];
}
export interface MediaLibraryPort {
  command<T>(
    restaurantId: string,
    actorId: string,
    context: MediaContext,
    mode: string,
    payload?: Record<string, unknown>,
  ): Promise<T>;
}
export async function executeMediaCommand<T>(
  actor: MediaActor,
  context: MediaContext,
  mode: string,
  payload: Record<string, unknown>,
  port: MediaLibraryPort,
): Promise<T> {
  if (!actor.isOwner && !actor.permissions.includes(context))
    throw new Error("forbidden");
  if (
    ["delete", "metadata"].includes(mode) &&
    !actor.isOwner &&
    !actor.permissions.includes("files")
  )
    throw new Error("forbidden");
  return port.command<T>(
    actor.restaurantId,
    actor.userId,
    context,
    mode,
    payload,
  );
}
