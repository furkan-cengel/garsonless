# Rollback — hosted subscription card update

1. Disable the owner card-update action and pause the card-update callback route.
2. Allow already-open hosted forms to expire; do not reinterpret their callbacks as checkout payments.
3. Remove `payment_method.updated` from consumers only after all matching outbox events have terminal receipts.
4. Drop the three card-update RPCs and the live-operation index.
5. Remove `callback_state_hash` only after preserving operation audit rows and confirming no card-update operation remains live.

This flow never stores card data or the provider's ₺1 validation/refund, so rollback must not create synthetic payment or refund records.
