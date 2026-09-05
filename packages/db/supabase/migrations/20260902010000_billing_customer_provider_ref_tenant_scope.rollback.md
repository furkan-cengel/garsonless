# Rollback notes

Do not restore the former global unique constraint without first proving that
no Iyzico customer reference is shared across restaurants. Iyzico can reuse a
customer reference for multiple subscriptions created by the same payer, so a
blind rollback would either fail on existing rows or block valid checkout
finalization. If rollback is required, deploy a forward repair that introduces
a separate provider-customer identity table and migrates the restaurant-scoped
bindings before changing this index.
