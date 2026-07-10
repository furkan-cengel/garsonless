-- Settings JSONB is anon-readable for the public menu. API keys were never
-- wired to a real endpoint validator and must not remain in this public JSON.
update public.restaurants
set settings = settings - 'api_key'
where settings ? 'api_key';
