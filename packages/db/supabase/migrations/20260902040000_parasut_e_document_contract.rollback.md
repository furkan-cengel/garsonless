# Paraşüt e-document contract rollback

Do not remove `provider_document_ref` or the Vault refresh-token functions while
any accounting job has reached Paraşüt. The trackable job ID expires and cannot
replace the fiscal document identity.

For an application rollback, keep this migration applied and deploy the previous
worker with accounting dispatch disabled. If a full schema rollback is approved,
first export the accounting queue and provider references, unschedule
`accounting-invoice-worker-every-minute`, stop every accounting worker, remove
the scheduler, new function overloads and OAuth functions, then drop
`accounting_provider_oauth_leases` and `provider_document_ref`. Vault secret
`parasut_refresh_token`, `accounting_worker_url` and `accounting_worker_secret`
must be removed separately by an authorized operator.
