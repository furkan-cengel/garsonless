# Rollback: 20261029100000_customer_birthdays_rewards

Adds birthday columns on `customer_restaurants`, the `customer_reward_rules` and
`customer_reward_grants` tables, the reward functions, a 10-minute pg_cron job
(`customer-rewards-every-10-minutes`), and redefines tenant erasure to delete the two new tables.

Down migrations are not used; fix forward. To stop rewards immediately:
`select cron.unschedule('customer-rewards-every-10-minutes');` or set every rule's `enabled` to
false. Points already granted are ordinary `earn` ledger rows with reason `reward:<kind>`; undo a
wrong one with a manual deduction from the customer profile. To remove the feature, unschedule the
job, re-run the erasure function from `20261027120100_tenant_erasure_manual_credit_requests.sql`,
then drop the functions, the two tables and the birthday columns.
