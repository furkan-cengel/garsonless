# Rollback — 20260901090000 subscription add-on lifecycle

Forward-only in production. Disable add-on checkout/change actions first, retain
all ledger rows, and deploy application code that no longer emits Video Hero or
mid-cycle add-on intents. A compensating migration may restore the Pro-only
constraints only after every Video Hero operation/change/invoice is terminal and
its entitlement has been preserved or explicitly cancelled.
