-- Üyelik + Sadakat — Phase 1: global customer identity + OTP verification.
-- Earning ledger (loyalty_transactions) lands in Phase 2; this migration is
-- identity + OTP only.
--
-- SECURITY: phone is PII. customers + otp_codes carry NO anon/authenticated
-- policies — all access is service-role only (menu API routes with a verified
-- customer-session cookie), the same discipline as payment_credentials.

-- ─── customers (GLOBAL identity: one phone = one customer, platform-wide) ───────
create table customers (
  id          uuid primary key default gen_random_uuid(),
  phone       text not null unique,          -- E.164, normalized by normalizePhone()
  name        text,
  created_at  timestamptz not null default now(),
  verified_at timestamptz
);

alter table customers enable row level security;
-- Deliberately NO policies → service-role only. Phone never exposed to anon.

-- ─── otp_codes (short-lived phone verification challenges) ──────────────────────
create table otp_codes (
  id          uuid primary key default gen_random_uuid(),
  phone       text not null,                 -- E.164
  code_hash   text not null,                 -- sha256(code) hex, never plaintext
  ip          text,                          -- for per-IP rate limiting
  attempts    int  not null default 0,       -- verify attempts; capped in app layer
  expires_at  timestamptz not null,          -- now() + 5 min
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);

create index otp_codes_phone_idx on otp_codes(phone, created_at desc);
create index otp_codes_ip_idx    on otp_codes(ip, created_at desc) where ip is not null;

alter table otp_codes enable row level security;
-- Deliberately NO policies → service-role only.

-- ─── orders.customer_id (link an order to a member; guests stay null) ───────────
alter table orders add column customer_id uuid references customers(id) on delete set null;
create index orders_customer_id_idx on orders(customer_id) where customer_id is not null;
