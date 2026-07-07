-- Split payment P0 fix: paying the bill must not free the table.
--
-- The 20260627 payment invariant is still authoritative: card/cash settlement
-- pays the bill only; a table is freed by an explicit staff close or by the
-- idle fully-paid sweep. The first split-payment finalize function stamped all
-- non-cancelled orders paid+'split' AND set table_sessions.closed_at, which
-- accidentally reintroduced the old auto-close coupling for split payments.
--
-- New behavior:
--   * settled shares fully cover the session -> stamp orders paid+'split'
--   * leave table_sessions.closed_at untouched
--   * closeTableSession / pg_cron sweep remain the only table-freeing paths
create or replace function finalize_split_if_covered(p_session_id uuid)
returns boolean language plpgsql as $$
declare
  v_total   numeric;
  v_settled numeric;
begin
  -- Serialize concurrent finalizers on this session. The lock is still useful
  -- even though we no longer close the session: it keeps the paid/split summary
  -- stamp deterministic under concurrent share callbacks.
  perform 1 from table_sessions s where s.id = p_session_id for update;

  select coalesce(sum(o.total), 0) into v_total
    from orders o
   where o.table_session_id = p_session_id
     and o.status <> 'cancelled'
     and o.deleted_at is null;

  select coalesce(sum(ps.amount), 0) into v_settled
    from payment_shares ps
   where ps.table_session_id = p_session_id
     and ps.status = 'settled';

  -- Never finalize a vacuous session; require FULL coverage.
  if v_total <= 0 or v_settled < v_total then
    return false;
  end if;

  update orders o
     set paid_at = now(), payment_method = 'split', updated_at = now()
   where o.table_session_id = p_session_id
     and o.status <> 'cancelled'
     and o.deleted_at is null
     and o.paid_at is null;

  -- Deliberately DO NOT close table_sessions here. The session remains open and
  -- should render as paid/kapatılabilir until staff explicitly closes it, or the
  -- fully-paid idle sweep reaps it later.
  return true;
end $$;

revoke execute on function finalize_split_if_covered(uuid) from public;
revoke execute on function finalize_split_if_covered(uuid) from anon, authenticated;
