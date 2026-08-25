# Rollback — onboarding activation flow

The migration is additive and does not replace the legacy restaurant creation RPC.

1. Deploy a dashboard version that no longer calls the five onboarding RPCs.
2. Drop `dismiss_restaurant_onboarding_checklist`, `complete_onboarding_csv_menu`,
   `create_onboarding_first_menu_item`, `advance_restaurant_onboarding_branding`,
   `create_restaurant_with_pro_trial_v2`, `read_owner_restaurant_onboarding`, and
   `build_restaurant_onboarding_snapshot` using their exact signatures.
3. Drop `restaurant_onboarding_operations`, then `restaurant_onboarding_states`.

Restaurant, subscription, theme and menu records created by completed onboarding
are product data and must not be deleted during rollback.
