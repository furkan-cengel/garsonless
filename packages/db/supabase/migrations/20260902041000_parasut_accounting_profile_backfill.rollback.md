# Paraşüt accounting profile backfill rollback

This migration only refreshes immutable billing snapshots and requeues complete
`needs_profile` jobs. Do not automatically restore their earlier state: a worker
may already have created a Paraşüt contact, draft or fiscal document. Stop the
accounting worker and reconcile affected jobs against their provider references
before any manual status change.
