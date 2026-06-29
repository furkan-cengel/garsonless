# Skill: Ordering Flow — Garsonless

## States

BROWSING → CART → ORDER_PLACED → (PENDING_APPROVAL | SENT_TO_KITCHEN) → PREPARING → READY → SERVED

## Realtime Architecture

- Supabase Realtime channel: `orders:{restaurant_id}`
- Events: order.created, order.status_changed, item.added
- Kitchen app subscribes, filters by restaurant
- Garson app (PWA) subscribes, shows notification badge

## Table Sessions

- Each QR scan creates a session_id (uuid)
- Stored in localStorage on customer device
- Multiple devices can join same session (group ordering)
- Session expires after 4 hours of inactivity

## Add-ons / Modifiers

- Modifier groups: `single | multiple | quantity` with `required`, `min`, and `max`.
- Options carry price/calorie deltas, defaults, and additional allergen codes.
- Ingredients are structured; only restaurant-marked ingredients may be removed.
- Clients send IDs only. `resolveOrderLines` re-reads menu data and writes an immutable, human-readable order snapshot for customer, dashboard, and kitchen views.

## Split Bill

- Customer `SplitBillModal` is display-only: it calculates equal or per-item shares.
- It does not create per-person payment sessions or settle partial amounts.
- One diner pays the whole bill through the normal İyzico flow, or staff settles it at the table.
- Real per-person split payment is deferred pending a partial-payment model.
