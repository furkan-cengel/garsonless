# Restaurant media storage and large uploads

All final menu media uses `restaurant-assets` (public read, server-only writes).
Files above 3 MiB use `restaurant-media-staging` (private), so 5 MiB category/product
images and 8 MiB theme images/videos bypass the Vercel Functions body limit.
Logos remain limited to 2 MiB; small uploads retain the existing multipart route.

## Flow and security

1. A small JSON prepare request validates the file metadata, current restaurant
   permissions and plan. It creates an actor-bound, 15-minute upload record and a
   signed, non-overwriting URL to one random private object. Preparation is limited
   to 20 attempts per actor per 15 minutes using a transaction lock.
2. The browser PUTs bytes directly to private Storage. No session cookies or service
   credentials accompany this request. The client accepts URLs only from its
   configured Supabase origin and staging bucket.
3. A small completion request contains only the upload ID. The server loads the
   immutable target from the record, rechecks access, atomically claims the upload,
   downloads the source and checks declared size/MIME against the stored object.
   Existing menu/theme actions still validate actual contents, plan and ownership,
   perform decoding where applicable, and write the final public object.
4. Completion results are persisted for response retries. Parallel calls share a
   client request and use an atomic server claim. A download failure can retry;
   an unknown outcome after publish begins never automatically repeats the write.
5. Source objects remain private until cleanup, including after success. Signed
   upload URLs live for two hours; retaining the object prevents URL replay from
   recreating untracked objects. Cleanup selects records older than three hours,
   deletes Storage objects through the API, then deletes tracking rows in batches.
   It runs hourly, using existing Supabase pg_cron/pg_net (no Vercel plan upgrade).

## Provisioning and release checks

Apply `20260908130000_dashboard_media_staging.sql` before deploying the client.
The table and RPC have no anon/authenticated privileges. Only the server service
role accesses them. From `apps/dashboard`, check each bucket:

```sh
node --env-file=.env.production scripts/provision-restaurant-assets.mjs --project-ref=svxvloeosiksqfadgkvo
node --env-file=.env.production scripts/provision-restaurant-assets.mjs --project-ref=svxvloeosiksqfadgkvo --staging
```

Checks are read-only by default, reject project/environment mismatch and fail if a
bucket is absent or misconfigured. Append `--create-missing` only to create missing
buckets; existing settings are never overwritten. Both buckets cap objects at
8 MiB and allow JPEG/PNG/WebP/AVIF/MP4/WebM. Their visibility differs as above.

Set a randomly generated `MEDIA_STAGING_CLEANUP_SECRET` in the dashboard server
environment and the same value in Supabase Vault as `media_staging_cleanup_token`.
Create this named job once (cron.schedule updates the same named job):

```sql
select cron.schedule('masabu-media-staging-cleanup', '17 * * * *', $job$
  select net.http_get(
    url := 'https://app.masabu.co/api/internal/media-staging-cleanup',
    headers := jsonb_build_object('Authorization', 'Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name='media_staging_cleanup_token')),
    timeout_milliseconds := 60000
  );
$job$);
```

Never put the secret directly in cron SQL, source control, client code or reports.
The endpoint returns 401 without the exact credential. Verify the named job is
active, then inspect `net._http_response` for its request ID: a queued request alone
does not prove HTTP success. On cleanup failure objects and tracking remain
available for the next run. For rollback, revert the application client first;
the additive private table/bucket can remain until outstanding uploads are cleaned.

## Validation (2026-09-08)

The missing production public bucket was repaired in the initial incident. The
large-upload change was then tested in development with actual 5 MiB category PNG
and 8 MiB theme PNG files: signed direct PUT, private source read denial, server
validation/processing, public final read and replay without a duplicate publish.
Fixtures and records were removed. Actual database tests verified RPC grants,
actor isolation, single claims, replay, preparation quota and bulk cleanup inside
a rolled-back transaction. Unit tests cover full-size image/video client transport,
invalid metadata, permission revocation, wrong actor/kind, expiration, substitution,
network failures and concurrent completion. Video transport has a full-size fixture
test; it is not a claim of testing playback of a customer's video in every browser.
