-- Make the newly added terminal cancellation reconciliation RPC immediately
-- visible to PostgREST. This migration changes no billing data.

begin;

notify pgrst, 'reload schema';

commit;
