# Paraşüt accounting worker timeout rollback

Reapply the prior `invoke_accounting_invoice_worker()` definition with a
30-second `pg_net` timeout only after confirming that no normal Paraşüt
formalization request requires the longer bounded window.
