-- LAGO Domain-brief 6: side-car extension table for public.contacts.
-- One-to-one with contacts via contact_id PK/FK. Holds the VISMA-Aktørnr
-- (contact identifier in VISMA) so the periodic contact importer can
-- match, refresh and never duplicate rows. Additive only — no upstream
-- schema touched, mergeable with upstream changes.

CREATE TABLE IF NOT EXISTS public.contacts_lago (
    contact_id           bigint PRIMARY KEY
                         REFERENCES public.contacts (id) ON DELETE CASCADE,
    visma_aktoer_nr      text UNIQUE,
    last_visma_import_at timestamptz,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contacts_lago_visma_aktoer_nr_idx
    ON public.contacts_lago (visma_aktoer_nr);

ALTER TABLE public.contacts_lago ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read contacts_lago"
    ON public.contacts_lago;
CREATE POLICY "Authenticated users can read contacts_lago"
    ON public.contacts_lago
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert contacts_lago"
    ON public.contacts_lago;
CREATE POLICY "Authenticated users can insert contacts_lago"
    ON public.contacts_lago
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update contacts_lago"
    ON public.contacts_lago;
CREATE POLICY "Authenticated users can update contacts_lago"
    ON public.contacts_lago
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete contacts_lago"
    ON public.contacts_lago;
CREATE POLICY "Authenticated users can delete contacts_lago"
    ON public.contacts_lago
    FOR DELETE
    TO authenticated
    USING (true);
