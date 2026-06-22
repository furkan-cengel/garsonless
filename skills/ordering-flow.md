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

- Modifier groups: required (pick 1) / optional (pick many) / quantity
- Each modifier has: name, price_delta, is_default
- Cart item stores selected modifiers as JSON

## Split Bill

- Session tracks device_id per order item
- /checkout shows items grouped by device
- Each device pays independently
