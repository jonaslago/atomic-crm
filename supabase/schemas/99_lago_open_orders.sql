-- LAGO Domain-brief 19b — åbne ordrelinjer ("Optagne ordrer").
--
-- Gemmer de RÅ felter fra VISMAs Ordrelinier + Ordrer (hoveder).
-- Kategorien (restordre / mav / uden_dato / med_dato / en_primeur)
-- udledes i view — aldrig som gemt kolonne, så regeljustering ikke
-- kræver reimport.
--
-- Linjeniveau, ikke ordreniveau: en ordre kan have både restordre-
-- linjer og normale linjer. PK = (ordre_nr, linje_nr).
--
-- ============================================================
-- SEMANTISK GRÆNSE (læs FØR du joiner med sales_monthly_lago)
-- ============================================================
-- Denne tabel indeholder UDELUKKENDE IKKE-FAKTUREREDE ORDRELINJER
-- fra VISMAs Ordrelinier-tabel (fremadrettet pipeline af bunden
-- omsætning). sales_monthly_lago indeholder de FAKTUREREDE linjer
-- fra Produkttransaktioner. De to må ALDRIG lægges sammen.
--
-- En delvist faktureret ordre har nogle linjer her og resten i
-- sales_monthly_lago. Summeres hele ordren via begge tabeller,
-- dobbelttælles det fakturerede beløb.
--
-- UI-navn: "Optagne ordrer" (må ALDRIG kaldes "pipeline" alene —
-- ordet er reserveret; brief 19 skelner mellem "Optagne ordrer"
-- fra VISMA og "Muligheder / Aftaler" fra Atomic deals/FS-18).
--
-- Import er ERSTATNING (truncate + insert i én transaktion), fordi
-- en ordre der ikke længere er åben, skal forsvinde. Undtagelsen
-- fra "import sletter aldrig".

CREATE TABLE IF NOT EXISTS public.open_orders_lago (
    ordre_nr              text NOT NULL,
    linje_nr              text NOT NULL,

    visma_customer_no     text NOT NULL,

    -- Fra ordrehovedet (Ordrer)
    ordre_dato            date NOT NULL,
    ordreart              text,          -- "2 [Leveres med andre varer]" = MAV
    status                text,          -- "21 [En Primeur]" = femte kategori
    kampagne              text,          -- læsbar tekst, fx "Julepris 2026"
    saelger               text,          -- Sælger/indkøber

    -- Fra ordrelinjen (Ordrelinier). Bekræftet leveringsdato udgår
    -- helt (LAGO bruger ikke); beskrivelse udgår (navnet joines fra
    -- products_lago). Ønsket_leveringsdato hentes nu fra ordre-hovedet
    -- (22.828 af 28.516 ordrer har den vs. 185 af 1.241 linjer) —
    -- kolonnen bliver dog på tabellen så kategorien er ét sted.
    produktnr             text,
    produktgruppe         text,          -- "1 [Vin]" — tal foran klammen
    kundeprisgruppe       text,          -- Engros/HoReCa historisk pr. linje
    salgstype             text,          -- FRIFLM/FRIFL/PROMO/PRØVE/tom
    antal                 numeric(14, 2),
    -- Brief 78 tillæg A §1: rest = Antal − Reserveret mod lager (VISMAs
    -- egen formel, "I rest"). Brief 25's rest = Antal − Antal
    -- færdigmeldt gav altid rest = Antal fordi VISMA aldrig dellevererer
    -- på samme ordre.
    rest                  numeric(14, 2),
    i_rest                numeric(14, 2), -- deprecated fossil; skrives ikke
    ej_faktureret         numeric(14, 2) NOT NULL DEFAULT 0, -- beløbet
    oensket_leveringsdato date,          -- fra ordre-hovedet; "uden dato" måles her
    faerdigmeldingsdato   date,          -- Brief 78 tillæg A §2: kolonnen
                                         -- findes ikke i OSR-udtrækket. Altid
                                         -- NULL. Bruges ikke i visning.
    sellerno              text,          -- sælger pr. linje
    -- Brief 78 tillæg A §3 (22. sep 2026): OSRs "Note"-kolonne — ordrens
    -- formål (fx "Portvinspakke 2026 - rest"). Ens på alle linjer i samme
    -- ordre. Udfyldt på 1.632 af 1.979 (83%) rækker.
    note                  text,
    -- Brief 78 §1 (22. sep 2026): rå værdi fra "Undtages lagerhåndtering"-
    -- kolonnen. Tidligere brugt som import-filter (brief 25 tillæg B),
    -- hvilket droppede kundens prissatte linje (fx AEvin 34696·1
    -- "91801-Jul" 3.163,80 kr). Nu importeres alle linjer; par-håndtering
    -- sker i visnings-laget.
    undtages_lagerhaandtering boolean NOT NULL DEFAULT false,

    er_testdata           boolean NOT NULL DEFAULT true,
    kilde                 text NOT NULL DEFAULT 'import'
                          CHECK (kilde IN ('import', 'vbs')),
    synced_at             timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (ordre_nr, linje_nr)
);

CREATE INDEX IF NOT EXISTS open_orders_lago_customer_idx
    ON public.open_orders_lago (visma_customer_no);
CREATE INDEX IF NOT EXISTS open_orders_lago_dato_idx
    ON public.open_orders_lago (ordre_dato);
CREATE INDEX IF NOT EXISTS open_orders_lago_testdata_idx
    ON public.open_orders_lago (er_testdata);
CREATE INDEX IF NOT EXISTS open_orders_lago_i_rest_idx
    ON public.open_orders_lago (i_rest)
    WHERE i_rest > 0;
CREATE INDEX IF NOT EXISTS open_orders_lago_status_idx
    ON public.open_orders_lago (status)
    WHERE status IS NOT NULL;

ALTER TABLE public.open_orders_lago ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read open_orders_lago"
    ON public.open_orders_lago;
CREATE POLICY "Authenticated users can read open_orders_lago"
    ON public.open_orders_lago FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can insert open_orders_lago"
    ON public.open_orders_lago;
CREATE POLICY "Admins can insert open_orders_lago"
    ON public.open_orders_lago FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() IN (
            SELECT user_id FROM public.sales WHERE administrator IS TRUE
        )
    );

DROP POLICY IF EXISTS "Admins can update open_orders_lago"
    ON public.open_orders_lago;
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

DROP POLICY IF EXISTS "Admins can delete open_orders_lago"
    ON public.open_orders_lago;
CREATE POLICY "Admins can delete open_orders_lago"
    ON public.open_orders_lago FOR DELETE TO authenticated
    USING (
        auth.uid() IN (
            SELECT user_id FROM public.sales WHERE administrator IS TRUE
        )
    );
