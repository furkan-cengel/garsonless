-- Customer login is now exclusively Supabase Auth email OTP / OAuth.
-- The legacy phone challenge table is no longer reachable from application
-- code. Removing it also removes the stored phone/IP challenge surface.

drop table if exists public.otp_codes;
