import type { TableTransferHistoryItem } from '@garsonless/application/tables'

export type TransferHistoryViewItem = TableTransferHistoryItem & {
  actorLabel: string
  undoActorLabel: string | null
}

type TransferHistoryKindFilter = 'all' | TransferHistoryViewItem['kind']
type TransferHistoryStatusFilter = 'all' | TransferHistoryViewItem['status']

export interface TransferHistoryFilters {
  query: string
  kind: TransferHistoryKindFilter
  status: TransferHistoryStatusFilter
}

export const EMPTY_TRANSFER_HISTORY_FILTERS: TransferHistoryFilters = {
  query: '',
  kind: 'all',
  status: 'all',
}

export function transferKindLabel(kind: TransferHistoryViewItem['kind']): string {
  if (kind === 'table_move') return 'Masa taşıma'
  return kind === 'item_transfer' ? 'Ürün taşıma' : 'Hesap taşıma'
}

export function transferStatusLabel(status: TransferHistoryViewItem['status']): string {
  if (status === 'undone') return 'Geri alındı'
  if (status === 'locked') return 'Kilitli'
  return 'Aktif'
}

export function transferSessionOutcome(item: TransferHistoryViewItem): string {
  if (item.kind === 'table_move') return 'Açık adisyon hedef masaya taşındı.'
  const target = item.targetSessionCreated
    ? 'Hedefte yeni adisyon oluşturuldu.'
    : item.kind === 'item_transfer' ? 'Ürünler hedefteki açık adisyona eklendi.' : 'Siparişler hedefteki açık adisyonla birleştirildi.'
  return item.sourceSessionClosed
    ? `${target} Kaynak adisyon kapatıldı.`
    : `${target} Kaynak adisyon açık kaldı.`
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR')
}

export function filterTransferHistory(
  history: TransferHistoryViewItem[],
  filters: TransferHistoryFilters,
  tableLabels: Record<string, string>,
): TransferHistoryViewItem[] {
  const query = normalize(filters.query)
  return history.filter((item) => {
    if (filters.kind !== 'all' && item.kind !== filters.kind) return false
    if (filters.status !== 'all' && item.status !== filters.status) return false
    if (!query) return true
    const searchable = [
      transferKindLabel(item.kind),
      transferStatusLabel(item.status),
      tableLabels[item.sourceTableId] ?? '',
      tableLabels[item.targetTableId] ?? '',
      item.actorLabel,
      item.undoActorLabel ?? '',
      item.id,
      item.requestId,
      item.lockReason ?? '',
    ].map(normalize)
    return searchable.some((value) => value.includes(query))
  })
}
