# Rollback notes

Do not restore the old category constraint while any `lifecycle` inbox rows exist. Disable lifecycle fan-out, retain delivered rows for audit, and only then narrow the vocabulary if the feature is retired.
