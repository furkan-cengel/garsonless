# Rollback notes

This migration is intentionally forward-only. Rolling it back while checkout
recovery workers are running can orphan active provider sessions. Disable the
billing maintenance endpoint first, deploy the previous dashboard version,
then restore the prior RPC definitions from migrations `20260722040000`,
`20260814090000`, and `20260901010000` before dropping the recovery columns.
Never delete provider operation rows; they are the billing audit trail.
