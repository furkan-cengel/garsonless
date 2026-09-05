import type { InboxNotificationItem, NotificationItem } from '../../lib/actions/notifications'

type Failure = { error: string; publicCode?: string }

/** Each source settles independently: history failures cannot erase live calls. */
export async function loadNotificationFeeds(options: {
  live: () => Promise<NotificationItem[] | Failure>
  history: () => Promise<{ items: InboxNotificationItem[]; unread: number } | Failure>
  onLive: (items: NotificationItem[]) => void
  onHistory: (history: { items: InboxNotificationItem[]; unread: number }) => void
  onLiveError: (failure: Failure) => void
  onHistoryError: (failure: Failure) => void
}) {
  await Promise.allSettled([
    Promise.resolve().then(options.live).then((result) => {
      if (Array.isArray(result)) options.onLive(result)
      else options.onLiveError(result)
    }).catch(() => options.onLiveError({ error: 'Canlı bildirimler alınamadı. Tekrar deneyin.' })),
    Promise.resolve().then(options.history).then((result) => {
      if ('items' in result) options.onHistory(result)
      else options.onHistoryError(result)
    }).catch(() => options.onHistoryError({ error: 'Bildirim geçmişi alınamadı. Tekrar deneyin.' })),
  ])
}
