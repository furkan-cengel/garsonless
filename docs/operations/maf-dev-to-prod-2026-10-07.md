# MAF Cafe Lounge DEV → PROD transfer

Transferred at the user’s explicit request on October 7, 2026. Source project: `yxsegwkzyiscrxiwdeuf`; target: `svxvloeosiksqfadgkvo`. The `maf-lounge` tenant retains ID `03352bb3-d38b-4db1-90ef-37379a07b1e5` and belongs to the existing, email-matched production owner. The separate `test` tenant was preserved.

## Verification

- 68 tables imported in one transaction, after a successful rollback rehearsal.
- 164 foreign-key relationships validated before commit; tenant row counts rechecked after commit.
- 13 categories, 25 products, 13 tables, 103 orders, 33 table sessions, 6 customers, and 25 loyalty ledger entries, plus themes, media metadata, translations, coupon/campaign history, audit history and Sadakat records.
- 80 available media objects copied and SHA-256 verified (34,937,099 bytes). A missing object associated with an already-deleted source asset was retained only as historical metadata.
- All 23 canonical Pro feature contexts allowed through a non-expiring complimentary grant.
- Public menu `https://menu.masabu.co/maf-lounge` returned HTTP 200; server-rendered data includes the production-hosted hero video and contains no DEV storage URL.

## Environment-bound records

Application business records and history were copied; credentials, payment checkout tokens, kitchen session credentials, browser push endpoints, temporary uploads, rate-limit events and short-lived Sadakat codes were not activated in production. Table QR tokens were regenerated. Existing production auth users were matched by email; one absent customer identity was created without a password or verified login state. Existing customer profiles were never overwritten.

DEV billing references were namespaced as historical imports; the DEV subscription was copied as cancelled and given independent complimentary Pro access. Provider operations were marked expired, reconciliation jobs resolved, and outbox events processed to prevent replay. Original DEV values remain in the private migration snapshot. No messages or payment-provider calls were sent.

Migration snapshots, scripts, media hashes and verification evidence are kept in restricted `/private/tmp/maf-transfer-*` and `/private/tmp/maf-dev-*` files on the operator machine; they contain private data and must not be committed.
