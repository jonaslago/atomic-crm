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
    visma_aktoer_nr     text,
    -- Segment ejes af CRM alene (brief 13). Default X = uklassificeret;
    -- L = lead. VISMAs Onsight-felt bruges IKKE.
    segment             text NOT NULL DEFAULT 'X'
                        CHECK (segment IN ('A', 'B', 'C', 'X', 'L')),
    -- Aktiv/inaktiv fra VISMA Statuskode (1/0). Default aktiv.
    visma_statuskode    int,
    -- Brief 26: nullable. 1 = aktiv, 9/99/0 = inaktiv, tomt = NULL
    -- (vi må ikke gætte). Bruges som STANDARD-filter på sælgerskærme:
    -- default skjules inaktive, "Vis inaktive" løfter det filter.
    -- Det er IKKE en del af is_visible_to_sales — det er distrikt.
    is_active           boolean,
    -- Brief 26 §2 (rev. 16. sep 2026): ABSOLUT sælgersynlighed baseret
    -- KUN på distrikt. Kan ikke slås fra. Generated STORED i migrationen
    -- 20260916140000_lago_26_visibility_distrikt_only.sql. Skema-filen
    -- deklarerer kolonnen så alle skemaer der læser den kompilerer;
    -- expression tilhører migrationens levetid og gentages ikke her
    -- (rebuild af skemaet skal genanvende migrationen for expression).
    is_visible_to_sales boolean GENERATED ALWAYS AS (
        distrikt IN ('Øst', 'Vest', 'HQ')
    ) STORED,
    last_visit_at       timestamptz,
    next_visit_planned  timestamptz,
    -- Hvem planen er tildelt (Domain-brief 18 §3.1, 10. sep 2026):
    -- Min dag filtrerer på DENNE, ikke på kundens ejer. Så kontoret
    -- kan planlægge på Camillas vegne uden at aftalen dukker op på
    -- din dag. Nullable → ældgamle planer uden tildeling er "hjemløse".
    next_visit_planned_by bigint REFERENCES public.sales (id)
                                 ON DELETE SET NULL,
    -- Brief 15 (FS-20): valgfri "hvad vil jeg"-note der følger den
    -- planlagte booking (fx "vis rosé-katalog"). Ryddes sammen med
    -- next_visit_planned når et besøg registreres.
    next_visit_note     text,
    opening_hours       text,
    faktura_email       text,
    distrikt            text,
    betaling            text,
    visma_sales_code    text,
    visma_sales_name    text,
    -- Kundestatus (Gruppe 2) droppet i brief 13 — kolonnen står som
    -- historisk artefakt, men skrives ikke længere til.
    kundestatus         text,
    -- Kundetype (brief 19): styrer prisliste i VISMA. Følger kunden,
    -- ikke ordren. VISMA-ejet — kommer med kundeimporten, rettes ikke
    -- i CRM. Skal ikke blandes sammen med segment (A/B/C/X/L):
    -- kundetype = hvad kunden ER, segment = hvor meget vi investerer.
    kundetype           text
                        CHECK (kundetype IS NULL
                               OR kundetype IN ('engros', 'horeca', 'andre')),
    last_visma_import_at timestamptz,
    lat                 double precision,
    lng                 double precision,
    geocode_status      text CHECK (geocode_status IS NULL
                                    OR geocode_status IN ('found', 'not_found', 'error')),
    geocode_source      text,
    geocoded_address    text,
    geocoded_address_hash text,
    geocoded_at         timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS companies_lago_visma_no_idx
    ON public.companies_lago (visma_customer_no);

CREATE INDEX IF NOT EXISTS companies_lago_segment_idx
    ON public.companies_lago (segment);

CREATE INDEX IF NOT EXISTS companies_lago_distrikt_idx
    ON public.companies_lago (distrikt);

CREATE INDEX IF NOT EXISTS companies_lago_visma_sales_code_idx
    ON public.companies_lago (visma_sales_code);

CREATE UNIQUE INDEX IF NOT EXISTS companies_lago_visma_aktoer_nr_key
    ON public.companies_lago (visma_aktoer_nr)
    WHERE visma_aktoer_nr IS NOT NULL;

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
