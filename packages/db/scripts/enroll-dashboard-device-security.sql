-- Run only during a coordinated, explicitly authorized environment rollout.
-- The dashboard app must already support step-up and have its environment flag enabled.
-- This does not create any device trust; each existing account must verify its next session.
BEGIN;
INSERT INTO public.dashboard_security_accounts(user_id)
SELECT owner_id FROM public.restaurants WHERE owner_id IS NOT NULL AND deleted_at IS NULL
UNION
SELECT user_id FROM public.restaurant_members WHERE user_id IS NOT NULL AND status='active'
UNION
SELECT user_id FROM public.legal_document_acceptances WHERE document_type='b2b_terms'
ON CONFLICT(user_id) DO NOTHING;
COMMIT;
