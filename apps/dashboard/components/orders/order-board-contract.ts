import type { OperationalOrderStatus, OrderLifecycleTarget } from '@garsonless/domain/orders'

export interface OrderBoardColumn {
  id: 'new' | 'prep' | 'ready' | 'done'
  label: string
  desc: string
  statuses: OperationalOrderStatus[]
  /** Canonical status written when a card is dropped into this column. */
  targetStatus: OrderLifecycleTarget | null
  tone: 'warning' | 'info' | 'positive' | 'neutral'
}

export const ORDER_BOARD_COLUMNS: OrderBoardColumn[] = [
  { id: 'new', label: 'Yeni', desc: 'Onay bekliyor', statuses: ['pending', 'pending_approval'], targetStatus: null, tone: 'warning' },
  { id: 'prep', label: 'Hazırlanıyor', desc: 'Mutfak / Bar', statuses: ['sent_to_kitchen', 'preparing'], targetStatus: 'sent_to_kitchen', tone: 'info' },
  { id: 'ready', label: 'Hazır', desc: 'Servise hazır', statuses: ['ready'], targetStatus: 'ready', tone: 'positive' },
  { id: 'done', label: 'Kapanan', desc: 'Tamamlandı / İptal', statuses: ['served', 'cancelled'], targetStatus: 'served', tone: 'neutral' },
]
