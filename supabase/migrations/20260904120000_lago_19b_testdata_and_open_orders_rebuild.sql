-- LAGO Domain-brief 19b — testdata-flag + open_orders rebuild + salgstype
-- på sales_monthly. Erstatter trin 3 i brief 19 (var pauset).
--
-- Ændringer:
--   1. er_testdata boolean NOT NULL DEFAULT true på alle 3 tabeller.
--      Default true med vilje — man skal aktivt erklære data er
--      driftsdata, ikke omvendt.
--   2. sales_monthly_lago får salgstype (FRIFLM/FRIFL/PROMO/PRØVE/tom).
--      Uden den kan vareprøver aldrig følges (FS-5, FS-21).
--      PK udvides til (kundenr, år, måned, salgstype).
--   3. open_orders_lago drop+create — de rå felter fra Ordrelinier +
--      Ordrer (hoveder) gemmes; kategorien udledes i view. Erstatter
--      den forkerte ordre_type-kolonne fra 20260902150000.
--   4. Linjeniveau, ikke ordreniveau — PK er (ordre_nr, linje_nr).
--
-- Alle tre tabeller har 0 rækker → destruktive ændringer er sikre.
-- Views på sales_monthly_lago genskabes i næste migration
-- (20260904130000_lago_19b_views_v2.sql).

-- ---------------------------------------------------------------------
-- 1. sales_monthly_lago — tilføj salgstype + er_testdata, ændre PK
-- ---------------------------------------------------------------------

-- Views der læser fra tabellen skal droppes før PK-ændring (fordi
-- PostgreSQL låser dem). Genskabes af 20260904130000.
DROP VIEW IF EXISTS public.v_customer_activity_status;
DROP VIEW IF EXISTS public.v_sales_district_periods;
DROP VIEW IF EXISTS public.v_sales_customer_periods;

ALTER TABLE public.sales_monthly_lago
    DROP CONSTRAINT IF EXISTS sales_monthly_lago_pkey;

ALTER TABLE public.sales_monthly_lago
    ADD COLUMN IF NOT EXISTS salgstype text NOT NULL DEFAULT '';

ALTER TABLE public.sales_monthly_lago
    ADD COLUMN IF NOT EXISTS er_testdata boolean NOT NULL DEFAULT true;

ALTER TABLE public.sales_monthly_lago
    ADD CONSTRAINT sales_monthly_lago_pkey
    PRIMARY KEY (visma_customer_no, aar, maaned, salgstype);

CREATE INDEX IF NOT EXISTS sales_monthly_lago_testdata_idx
    ON public.sales_monthly_lago (er_testdata);

CREATE INDEX IF NOT EXISTS sales_monthly_lago_salgstype_idx
    ON public.sales_monthly_lago (salgstype)
    WHERE salgstype <> '';

-- ---------------------------------------------------------------------
-- 2. open_orders_lago — drop+create med rå felter, linjeniveau
-- ---------------------------------------------------------------------
--
-- Bevidst DROP+CREATE frem for ADD/DROP column-orgie:
--  a) 0 rækker → ingen data-tab
--  b) Schemaet skifter fundamentalt (linjeniveau, mange nye kolonner,
--     ny PK) → læsbarheden vinder ved rewriting
--  c) Kategorien udledes i view, ikke gemt (jf. rettelsen i baggrunds-
--     doket VISMA_datamodel §4)

DROP TABLE IF EXISTS public.open_orders_lago CASCADE;

CREATE TABLE public.open_orders_lago (
    -- Nøgle: linjeniveau, ikke ordreniveau. En ordre kan have både
    -- restordre-linjer og normale linjer.
    ordre_nr              text NOT NULL,
    linje_nr              text NOT NULL,

    visma_customer_no     text NOT NULL,

    -- Fra ordrehovedet (Ordrer)
    ordre_dato            date NOT NULL,
    ordreart              text,          -- "2 [Leveres med andre varer]" = MAV
    status                text,          -- "21 [En Primeur]" = femte kategori
    kampagne              text,          -- læsbar tekst, fx "Julepris 2026"
    saelger               text,          -- Sælger/indkøber

    -- Fra ordrelinjen (Ordrelinier)
    produktnr             text,
    beskrivelse           text,
    produktgruppe         text,          -- "1 [Vin]" — tal foran klammen
    kundeprisgruppe       text,          -- Engros/HoReCa historisk pr. linje
    salgstype             text,          -- FRIFLM/FRIFL/PROMO/PRØVE/tom
    antal                 numeric(14, 2),
    rest                  numeric(14, 2),
    i_rest                numeric(14, 2), -- >0 → restordre-kategori
    ej_faktureret         numeric(14, 2) NOT NULL DEFAULT 0, -- beløbet
    oensket_leveringsdato date,          -- "uden dato" måles på DENNE
    bekraeftet_lev_dato   date,
    sellerno              text,          -- sælger pr. linje

    er_testdata           boolean NOT NULL DEFAULT true,
    kilde                 text NOT NULL DEFAULT 'import'
                          CHECK (kilde IN ('import', 'vbs')),
    synced_at             timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (ordre_nr, linje_nr)
);

CREATE INDEX open_orders_lago_customer_idx
    ON public.open_orders_lago (visma_customer_no);
CREATE INDEX open_orders_lago_dato_idx
    ON public.open_orders_lago (ordre_dato);
CREATE INDEX open_orders_lago_testdata_idx
    ON public.open_orders_lago (er_testdata);
CREATE INDEX open_orders_lago_i_rest_idx
    ON public.open_orders_lago (i_rest)
    WHERE i_rest > 0;
CREATE INDEX open_orders_lago_status_idx
    ON public.open_orders_lago (status)
    WHERE status IS NOT NULL;

ALTER TABLE public.open_orders_lago ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read open_orders_lago"
    ON public.open_orders_lago FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert open_orders_lago"
    ON public.open_orders_lago FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() IN (
            SELECT user_id FROM public.sales WHERE administrator IS TRUE
        )
    );

CREATE POLICY "Admins can update open_orders_lago"
    ON public.open_orders_lago FOR UPDATE TO authenticated
    USING (
        auth.uid() IN (
            SELECT user_id FROM public.sales WHERE administrator IS TRUE
        )
    )
    WITH CHECK (
        auth.uid() IN (
            SELECT user_id FROM public.sales WHERE administrator IS TRUE
        )
    );

CREATE POLICY "Admins can delete open_orders_lago"
    ON public.open_orders_lago FOR DELETE TO authenticated
    USING (
        auth.uid() IN (
            SELECT user_id FROM public.sales WHERE administrator IS TRUE
        )
    );

-- ---------------------------------------------------------------------
-- 3. sync_runs_lago — tilføj er_testdata
-- ---------------------------------------------------------------------

ALTER TABLE public.sync_runs_lago
    ADD COLUMN IF NOT EXISTS er_testdata boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS sync_runs_lago_testdata_idx
    ON public.sync_runs_lago (er_testdata);
