# Rollback note

This migration corrects only implausibly future timestamps produced by an
authenticated iyzico Reporting reconciliation. Do not restore the future
timestamps: doing so would delay an immediate-refund cancellation. No provider
money movement or subscription cancellation is performed by this migration.
