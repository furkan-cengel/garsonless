# Rollback: 20261028140000_inventory_invoice_reader

Adds the `inventory_invoice_reads` queue (service-role only) and its functions:
`enqueue_invoice_read`, `read_invoice_read`, `claim_invoice_read`, `finish_invoice_read`,
`expire_invoice_reads` and `inventory_invoice_public`. No stock data is touched; a read only
fills the receive dialog for review.

Down migrations are not used; fix forward. To turn the feature off, set the dashboard's
`MENU_IMPORT_ENABLED` to anything but `true` (it also gates the menu reader), or drop the six
functions and the table in a new migration. The `menu-import-worker` Edge Function treats a
missing `claim_invoice_read` as an unavailable queue and keeps reading menus.
