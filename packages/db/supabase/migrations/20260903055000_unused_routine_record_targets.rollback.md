# Rollback note

This forward migration changes no table data, function signature, predicate,
row lock or function privilege. It replaces two unused full-row `SELECT INTO`
targets with `PERFORM 1`, preserving the `FOUND` checks that follow them.

Do not restore the unused `v_refund` or `v_restaurant` record targets merely to
reverse this migration; doing so only restores database-lint warnings. If either
routine must later consume fields from those rows, deploy a new forward
migration with an explicitly named projection while retaining the existing
security-definer, `public, pg_temp` search path and service-role-only ACL.
