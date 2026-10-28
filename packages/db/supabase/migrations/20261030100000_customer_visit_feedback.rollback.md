# Rollback: 20261030100000_customer_visit_feedback

Adds `customer_review_settings` and `customer_feedback`, the prompt/submit/settings functions,
adds `birthdays` and `feedback` to `create_customer_privacy_export`, and redefines tenant erasure to
delete the two new tables.

Down migrations are not used; fix forward. To stop the question immediately:
`update public.customer_review_settings set enabled = false;` (the menu then gets no prompt and
submits are refused). To remove the feature, re-run the export function from
`20260802030000_customer_loyalty_privacy.sql` and the erasure function from
`20261029100000_customer_birthdays_rewards.sql`, then drop the three functions and the two tables.
