# Rollback notes

Do not restore the preceding health function as-is: it counts inbox/e-mail-only
lifecycle and billing events as dashboard-push work and therefore creates
false-positive pending/dead-letter metrics. If this release must be reversed,
deploy a forward repair that keeps the consumer-specific routing filter while
removing only vocabulary that no longer exists.
