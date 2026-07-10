-- Typed table-service requests. Existing rows remain general waiter calls.

alter table public.service_requests
  add column if not exists request_type text not null default 'waiter';

alter table public.service_requests
  drop constraint if exists service_requests_request_type_check;

alter table public.service_requests
  add constraint service_requests_request_type_check
  check (request_type in ('waiter', 'clean_table', 'change_ashtray', 'table_service', 'water', 'bill'));

create index if not exists service_requests_pending_type_idx
  on public.service_requests(restaurant_id, table_id, request_type, created_at desc)
  where status = 'pending';

comment on column public.service_requests.request_type is
  'Server-validated waiter or quick-request kind shown to restaurant staff.';
