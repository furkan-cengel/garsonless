export interface PublicMenuRevisionSnapshot {
  restaurantId: string
  revision: number
  updatedAt: string | null
}

export interface PublicMenuRevisionPort {
  readRevision(restaurantId: string): Promise<PublicMenuRevisionSnapshot>
}

export async function readPublicMenuRevision(
  restaurantId: string,
  port: PublicMenuRevisionPort,
): Promise<PublicMenuRevisionSnapshot> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(restaurantId)) {
    throw new Error('Invalid restaurant id')
  }
  const snapshot = await port.readRevision(restaurantId)
  if (
    snapshot.restaurantId !== restaurantId
    || !Number.isSafeInteger(snapshot.revision)
    || snapshot.revision < 0
  ) {
    throw new Error('Invalid public menu revision snapshot')
  }
  return snapshot
}
