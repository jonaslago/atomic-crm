-- LAGO: company-level notes (Domain-brief 1, FS-4 refinement).
-- Notes ARE about the company / visit — not a named person. An optional
-- contact_id lets the salesperson tag a person when relevant, but the note
-- belongs to the company.
--
-- Additive only — upstream's public.contact_notes is left alone.

CREATE TABLE IF NOT EXISTS public.company_notes_lago (
    id          bigserial PRIMARY KEY,
    company_id  bigint NOT NULL
                REFERENCES public.companies (id) ON DELETE CASCADE,
    contact_id  bigint
                REFERENCES public.contacts (id) ON DELETE SET NULL,
    text        text NOT NULL,
    sales_id    bigint
                REFERENCES public.sales (id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_notes_lago_company_id_created_at_idx
    ON public.company_notes_lago (company_id, created_at DESC);

ALTER TABLE public.company_notes_lago ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read company_notes_lago"
    ON public.company_notes_lago;
CREATE POLICY "Authenticated users can read company_notes_lago"
    ON public.company_notes_lago
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert company_notes_lago"
    ON public.company_notes_lago;
CREATE POLICY "Authenticated users can insert company_notes_lago"
    ON public.company_notes_lago
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update company_notes_lago"
    ON public.company_notes_lago;
CREATE POLICY "Authenticated users can update company_notes_lago"
    ON public.company_notes_lago
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete company_notes_lago"
    ON public.company_notes_lago;
CREATE POLICY "Authenticated users can delete company_notes_lago"
    ON public.company_notes_lago
    FOR DELETE
    TO authenticated
    USING (true);
