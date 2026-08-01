export type TableQuickActionId =
  | 'details'
  | 'new_order'
  | 'add_order'
  | 'table_move'
  | 'order_transfer'
  | 'account_transfer'
  | 'settlement'
  | 'close_session'
  | 'resolve_request'
  | 'rename'
  | 'edit_layout'
  | 'delete'

export type TableQuickAction = {
  id: TableQuickActionId
  label: string
  disabledReason: string | null
  destructive?: boolean
  separatorBefore?: boolean
}

export type TableQuickActionInput = {
  hasSession: boolean
  canCreateOrders: boolean
  canEditLayout: boolean
  pendingRequestCount: number
  unpaidTotal: number
  declaredCashTotal: number
  hasUnfinished: boolean
}

function action(
  id: TableQuickActionId,
  label: string,
  disabledReason: string | null = null,
  options: Pick<TableQuickAction, 'destructive' | 'separatorBefore'> = {},
): TableQuickAction {
  return { id, label, disabledReason, ...options }
}

export function buildTableQuickActions(input: TableQuickActionInput): TableQuickAction[] {
  if (!input.hasSession) {
    return [
      action('details', 'Masa detayını aç'),
      ...(input.canCreateOrders ? [action('new_order', 'Sipariş başlat')] : []),
      action('rename', 'Adı ve konumu düzenle', null, { separatorBefore: true }),
      action(
        'edit_layout',
        'Yerleşimi düzenle',
        input.canEditLayout ? null : 'Yerleşimi düzenlemek için sol panelden bir kat seçin.',
      ),
      action('delete', 'Masayı sil', null, { destructive: true, separatorBefore: true }),
    ]
  }

  const closeReason = input.unpaidTotal > 0
    ? 'Önce kalan tutarı tahsil edin.'
    : input.declaredCashTotal > 0
      ? 'Bekleyen nakit beyanını önce onaylayın.'
      : input.hasUnfinished
        ? 'Tamamlanmamış siparişler varken adisyon kapatılamaz.'
        : null

  return [
    action('details', 'Masa detayını aç'),
    ...(input.canCreateOrders ? [action('add_order', 'Ürün ekle')] : []),
    action('table_move', 'Masayı boş masaya taşı', null, { separatorBefore: true }),
    ...(input.canCreateOrders ? [
      action('order_transfer', 'Ürün / sipariş taşı'),
      action('account_transfer', 'Ürün / hesap taşı'),
    ] : []),
    action('settlement', 'Tahsilata geç', null, { separatorBefore: true }),
    action('close_session', 'Adisyonu kapat', closeReason),
    ...(input.pendingRequestCount > 0
      ? [action('resolve_request', `Servis isteğini çöz${input.pendingRequestCount > 1 ? ` (${input.pendingRequestCount})` : ''}`)]
      : []),
    action('rename', 'Adı ve konumu düzenle', null, { separatorBefore: true }),
  ]
}

export function nextMenuIndex(
  current: number,
  key: 'ArrowDown' | 'ArrowUp' | 'Home' | 'End',
  length: number,
): number {
  if (length <= 0) return -1
  if (key === 'Home') return 0
  if (key === 'End') return length - 1
  if (key === 'ArrowDown') return (Math.max(current, -1) + 1) % length
  return (current <= 0 ? length : current) - 1
}
