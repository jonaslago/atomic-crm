-- Security fix (6. okt 2026): RLS on two tables that were missing it.
--
-- _kontrol_28: temporary control table from §28 migration (501 rows, no
-- customer data). Kept until Jonas decides in week 42.
--
-- next_visit_facit_20261001: frozen verification facit from §24 migration
-- (11 rows with company_id and plan dates — customer data).
--
-- Rule going forward: every new table in public gets RLS + a policy in
-- the same migration that creates it. Not after Supabase sends a mail.

-- 1. _kontrol_28
ALTER TABLE public._kontrol_28 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read _kontrol_28" ON public._kontrol_28;
CREATE POLICY "Authenticated read _kontrol_28"
    ON public._kontrol_28 FOR SELECT TO authenticated USING (true);
-- No write policy — nobody should write to a control table.

-- 2. next_visit_facit_20261001
ALTER TABLE public.next_visit_facit_20261001 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read next_visit_facit" ON public.next_visit_facit_20261001;
CREATE POLICY "Authenticated read next_visit_facit"
    ON public.next_visit_facit_20261001 FOR SELECT TO authenticated USING (true);
-- No write policy — verification facit is read-only.
