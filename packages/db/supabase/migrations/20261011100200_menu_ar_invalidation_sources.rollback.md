# Menu AR invalidation sources recovery

Only the `menu_invalidations_source_check` constraint changes: it also allows `menu_item_ar` and `restaurant_ar_access`. Restoring the original three-value check first needs every row whose `source` is one of the two new values rewritten (for example to `menu_items`), otherwise the constraint cannot be added; after that, AR switches and publishes fail again until the AR triggers are dropped.
