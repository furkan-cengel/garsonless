import type { SettlementLineItem } from '../../lib/settlement-items'

function modifierLabel(item: SettlementLineItem['modifiers'][number]): string {
  const option = `${item.optionName}${item.quantity > 1 ? ` ×${item.quantity}` : ''}`
  return item.groupName ? `${item.groupName}: ${option}` : option
}

export function SettlementOrderItems({
  items,
  compact = false,
}: {
  items: SettlementLineItem[]
  compact?: boolean
}) {
  if (items.length === 0) {
    return <div style={{ color: 'var(--text-3)', fontSize: 11.5 }}>Sipariş detayı bulunamadı.</div>
  }

  return (
    <div role="list" aria-label="Sipariş ürünleri" style={{ display: 'grid', gap: compact ? 7 : 9 }}>
      {items.map((item, index) => (
        <div
          key={`${item.name}-${index}`}
          role="listitem"
          style={{
            minWidth: 0,
            paddingTop: index === 0 ? 0 : compact ? 7 : 9,
            borderTop: index === 0 ? 0 : '1px solid var(--divider)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
            <span
              aria-label={`${item.quantity} adet`}
              style={{ color: 'var(--text-2)', flexShrink: 0, fontSize: compact ? 11.5 : 12, fontWeight: 800 }}
            >
              {item.quantity}×
            </span>
            <span style={{ color: 'var(--text)', fontSize: compact ? 12 : 12.5, fontWeight: 650, overflowWrap: 'anywhere' }}>
              {item.name}
            </span>
          </div>
          {item.modifiers.length > 0 && (
            <div style={{ color: 'var(--text-3)', fontSize: compact ? 10.5 : 11, lineHeight: 1.45, marginTop: 3, overflowWrap: 'anywhere' }}>
              <span style={{ fontWeight: 700 }}>Seçimler:</span>{' '}
              {item.modifiers.map(modifierLabel).join(' · ')}
            </div>
          )}
          {item.removedIngredients.length > 0 && (
            <div style={{ color: 'var(--critical)', fontSize: compact ? 10.5 : 11, lineHeight: 1.45, marginTop: 2, overflowWrap: 'anywhere' }}>
              <span style={{ fontWeight: 700 }}>Çıkarılanlar:</span> {item.removedIngredients.join(', ')}
            </div>
          )}
          {item.productNote && (
            <div style={{ color: 'var(--text-2)', fontSize: compact ? 10.5 : 11, lineHeight: 1.45, marginTop: 2, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
              <span style={{ fontWeight: 700 }}>Ürün notu:</span> {item.productNote}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
