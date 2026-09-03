# Rollback: subscription card-update live replay

This migration replaces `public.prepare_subscription_card_update` without changing table shape.

To roll back, restore the function body from
`20260901080000_subscription_card_update_hosted_flow.sql`. Existing operations marked
`expired` must not be reopened because their provider callback token has elapsed.
