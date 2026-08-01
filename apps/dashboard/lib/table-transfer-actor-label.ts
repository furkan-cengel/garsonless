export function transferActorLabel(actorId: string, viewerId: string): string {
  return actorId === viewerId ? 'Siz' : 'Başka bir yetkili'
}
