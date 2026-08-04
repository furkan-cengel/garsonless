-- Public restaurant assets remain readable, but physical writes are exclusively
-- performed by authenticated server actions through the service-role adapter.
-- This prevents a browser from bypassing MIME, magic-byte, dimension and tenant
-- validation by calling the Storage API directly.

drop policy if exists storage_authenticated_write on storage.objects;
drop policy if exists storage_authenticated_update on storage.objects;
drop policy if exists storage_authenticated_delete on storage.objects;

-- No authenticated INSERT/UPDATE/DELETE policy is recreated. Service-role
-- bypasses RLS after the application has revalidated the actor and generated a
-- canonical immutable path. storage_public_read is intentionally preserved.
