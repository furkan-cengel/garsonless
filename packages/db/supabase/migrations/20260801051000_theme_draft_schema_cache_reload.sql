-- Expose the additive draft tables and RPC signatures to PostgREST immediately
-- after the transactional DDL migration completes.
notify pgrst, 'reload schema';
