# Complimentary Pro access

Operator-managed, tenant-scoped Pro access is independent of paid subscriptions. The grant has no expiry; setting `revoked_at` revokes it. The entitlement projection uses the legacy resolver's finite `expiresAt` contract (year 9999), while each read checks the grant again. Explicit feature denies and subscription manual holds remain authoritative. Pro does not include online-payment add-ons or Business multi-location access.

The grant table is RLS protected and unavailable to anonymous/authenticated clients. Existing actor permissions remain required. Service-role operators must verify the owner and exact tenant before a grant. No email-based runtime exceptions exist.

## September 29, 2026 development verification

Migration `20260929143000` and two authorized grants were applied only to development project `yxsegwkzyiscrxiwdeuf`: `maf-lounge` and `maf-lounge-demo`. Production was not migrated or granted access in this task. Existing provider-linked billing subscriptions were compared before/after and remained unchanged.

The validation transaction exercised all 23 canonical Pro features, add-on exclusions, inventory and translation database gates, revocation restoring original entitlements, and anonymous/authenticated grant-table privilege denial. The same assertions passed before the committed application.

To revoke a verified tenant's complimentary access, an operator sets `revoked_at = now()` on that tenant's row. This does not cancel or alter any paid subscription. Do not update subscription/provider records to revoke this grant.

## October 6, 2026 production grant

At the user's explicit request, migration `20260929143000` was applied to production project `svxvloeosiksqfadgkvo` using an isolated release manifest ending at that migration. The Sadakat migrations were excluded. Migration push and remote post-check passed.

The verified owner account's `test` tenant (`ff75eb79-948a-474c-b012-351f72c83e01`) received a revocable, non-expiring complimentary Pro grant. All 23 canonical Pro feature contexts returned allowed, including database-enforced inventory and translation gates. Existing billing subscription rows were compared before and after and remained unchanged. No paid subscription, provider charge, or add-on grant was created.

## October 13, 2026 social media specialist grant

At the platform owner's explicit request, the email-verified owner of `ambarcoffee` (Ambar Coffee & Bakery, tenant `315b2ef1-f563-4f95-89a7-711578e71cdd`) received a non-expiring complimentary Pro grant in production `svxvloeosiksqfadgkvo`. All 23 canonical Pro feature contexts and the inventory/translation database gates passed both a rollback rehearsal and post-commit verification.

The existing providerless trial row was retained for historical references, with its trial expiry and billing period dates cleared. Access comes from the complimentary grant; no paid subscription or renewal schedule was created. There were no invoices, provider operations, or payment attempts. One obsolete seven-day trial reminder was removed from the inbox, and pending trial reminders were suppressed. A tenant lifecycle audit records the authorization and previous expiry. Restricted before-state evidence is retained at `/private/tmp/esra-pro-before-20261013.json` and must not be committed.

For this tenant, revocation must also account for the cleared trial schedule: the retained trial row has no valid trial access without the complimentary grant. Billing screens may still describe that historical row as a trial; it is not a paid subscription.
