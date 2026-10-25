# Rollback: 20261012140000_guided_menu_import

Adds the AI menu reader: `menu_import_jobs`, its enqueue/read/review RPCs, the worker
claim/finish RPCs, `invoke_menu_import_worker`, the Vault provisioning RPC and the
`menu-import-worker-every-minute` cron job.

Down migrations are not used; fix forward. To switch the feature off without data loss:

1. Set `MENU_IMPORT_ENABLED` to anything other than `true` in the dashboard environment.
   The upload route then answers `not_configured` and the dialog explains CSV is still available.
2. Stop new reads: `select cron.unschedule('menu-import-worker-every-minute');`
   Uploads already in the queue expire after 24 hours (`expire_menu_imports`).

Uploaded sources are erased when a read finishes and never kept beyond 24 hours; applied
products are ordinary menu items created by `import_menu_rows` and are not touched by any
rollback. To remove the feature entirely in a later migration, unschedule the cron job, then
drop the functions listed above and `menu_import_jobs` (rows hold only drafts and job state).
