# Rollback note

This migration changes no table data, function signature or transfer behavior.
It adds a dependency-free string pragma that describes the function-local
temporary table to `plpgsql_check`. PostgreSQL evaluates that `PERFORM` as a
no-op at runtime.

Do not remove the pragma during normal rollback: doing so only restores the
false-positive `relation "item_transfer_selection" does not exist` database
lint error. If the function is superseded, retain an equivalent
`PRAGMA:TABLE: item_transfer_selection` declaration immediately before the
first statement that references the temporary table.
