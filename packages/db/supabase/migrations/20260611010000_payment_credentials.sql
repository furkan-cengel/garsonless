-- Per-restaurant payment provider credentials (İyzico).
-- SECURITY: restaurants.settings is anon-readable, so payment secrets live
-- in this separate table with NO anon policy. The menu app's payment routes
-- read it exclusively with the service-role client (server-only).

create table payment_credentials (
  restaurant_id uuid primary key references restaurants(id) on delete cascade,
  provider      text not null default 'iyzico',
  api_key       text not null,
  secret_key    text not null,
  mode          text not null default 'sandbox' check (mode in ('sandbox', 'live')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table payment_credentials enable row level security;

-- Owner manages their own restaurant's credentials. Deliberately NO anon policy.
create policy "owner_manage_payment_credentials" on payment_credentials
  for all to authenticated
  using (exists (
    select 1 from restaurants r
    where r.id = payment_credentials.restaurant_id
      and r.owner_id = auth.uid()
      and r.deleted_at is null
  ))
  with check (exists (
    select 1 from restaurants r
    where r.id = payment_credentials.restaurant_id
      and r.owner_id = auth.uid()
      and r.deleted_at is null
  ));

-- İyzico's callback only POSTs a token; persist the token on the order at
-- checkout-init time so the callback can resolve token → order → restaurant
-- → credentials entirely server-side (no client-controllable params).
alter table orders add column payment_token text;

create index orders_payment_token_idx on orders (payment_token)
  where payment_token is not null;
