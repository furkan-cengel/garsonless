# Rollback note

This forward migration changes no table data, index, function signature or
function privilege. It aligns two active loyalty RPC bodies with the
refund-aware partial unique index introduced by
`20260802030000_customer_loyalty_privacy.sql`.

Do not restore the predecessor `WHERE order_id IS NOT NULL` conflict target
while `loyalty_tx_order_type_dir_uniq` also requires `refund_id IS NULL`.
Doing so reintroduces PostgreSQL error `42P10` and prevents loyalty redemption
from reaching either insert.

If the index predicate is superseded, deploy another forward migration that
updates both `redeem_loyalty` and `finalize_order_discount` to exactly infer the
new unique index. Keep their existing service-role-only privileges intact.
