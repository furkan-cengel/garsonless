# Subscription checkout add-ons rollback

This migration is intentionally additive. Do not roll it back while an add-on
checkout is in `processing`, `awaiting_callback`, or `requires_reconciliation`.

1. Set both `subscription_add_on_catalog.active` rows to `false` and remove the
   six `IYZICO_BILLING_PRO_IYZICO_ADDON_*` environment values. This closes new
   add-on checkout without affecting plan-only checkout.
2. Wait until every add-on provider operation is terminal and reconcile any
   provider subscription already created.
3. Deploy application code that no longer emits `addOnEntitlementsVersion: 1`.
   The rolling compatibility boundary will temporarily restore the legacy Pro
   entitlement and avoids an online-payment outage during rollback.
4. Drop the two add-on triggers and four add-on functions, then drop
   `restaurant_subscription_add_ons` and `subscription_add_on_catalog`.
5. Drop the two array constraints and only then drop `requested_add_ons` and
   `add_ons` columns.

Never delete provider subscriptions as part of the database rollback. Provider
cancellation and customer communication are separate, audited operations.
