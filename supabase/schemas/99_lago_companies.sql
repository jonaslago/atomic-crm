-- LAGO: side-car extension table for public.companies (Fase 1, Domain-brief 1).
-- One-to-one with companies via company_id PK/FK.
-- Holds the VISMA-customer-number key plus CRM-owned customer fields that are
-- not present in upstream's companies table. VISMA-owned fields (name,
-- address, phone, CVR, etc.) stay on public.companies; ownership is declared
-- in the frontend manifest at src/lago/customers/fieldOwnership.ts.
--
-- Additive only — no upstream schema touched, mergeable with upstream changes.

CREATE TABLE IF NOT EXISTS public.companies_lago (
    company_id          bigint PRIMARY KEY
                        REFERENCES public.companies (id) ON DELETE CASCADE,
    visma_customer_no   text UNIQUE,
    segment             text CHECK (segment IS NULL OR segment IN ('A', 'B', 'C')),
    last_visit_at       timestamptz,
    next_visit_planned  timestamptz,
    opening_hours       text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS companies_lago_visma_no_idx
    ON public.companies_lago (visma_customer_no);

CREATE INDEX IF NOT EXISTS companies_lago_segment_idx
    ON public.companies_lago (segment);

ALTER TABLE public.companies_lago ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read companies_lago"
    ON public.companies_lago;
CREATE POLICY "Authenticated users can read companies_lago"
    ON public.companies_lago
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert companies_lago"
    ON public.companies_lago;
CREATE POLICY "Authenticated users can insert companies_lago"
    ON public.companies_lago
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update companies_lago"
    ON public.companies_lago;
CREATE POLICY "Authenticated users can update companies_lago"
    ON public.companies_lago
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete companies_lago"
    ON public.companies_lago;
CREATE POLICY "Authenticated users can delete companies_lago"
    ON public.companies_lago
    FOR DELETE
    TO authenticated
    USING (true);
