-- LAGO Domain-brief 19 — salgsdata-fundament (trin 1).
--
-- Tre nye tabeller + additiv kolonne på companies_lago. Ingen views i
-- denne migration (trin 2). Ingen brugerflade (trin 3-4). Ingen data.
--
-- Additivt, LAGO-only. Ingen upstream-tabeller rørt.

-- ---------------------------------------------------------------------
-- 1. Månedlig omsætning pr. kunde (kunde × år × måned)
--    FAKTURERET omsætning fra VISMAs Produkttransaktioner (låste).
--    Måneden bestemmes af FAKTURERINGSDATOEN — ikke ordre-/leveringsdato.
--    MÅ ALDRIG lægges sammen med open_orders_lago (dobbelttælling af
--    delvist fakturerede ordrer).
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sales_monthly_lago (
    visma_customer_no  text     NOT NULL,
    aar                smallint NOT NULL,
    maaned             smallint NOT NULL CHECK (maaned BETWEEN 1 AND 12),
    belob              numeric(14, 2) NOT NULL DEFAULT 0,
    kilde              text     NOT NULL DEFAULT 'import'
                       CHECK (kilde IN ('import', 'vbs')),
    synced_at          timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (visma_customer_no, aar, maaned)
);

CREATE INDEX IF NOT EXISTS sales_monthly_lago_periode_idx
    ON public.sales_monthly_lago (aar, maaned);

ALTER TABLE public.sales_monthly_lago ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read sales_monthly_lago"
    ON public.sales_monthly_lago;
CREATE POLICY "Authenticated users can read sales_monthly_lago"
    ON public.sales_monthly_lago FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can insert sales_monthly_lago"
    ON public.sales_monthly_lago;
CREATE POLICY "Admins can insert sales_monthly_lago"
    ON public.sales_monthly_lago FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() IN (
            SELECT user_id FROM public.sales WHERE administrator IS TRUE
        )
    );

DROP POLICY IF EXISTS "Admins can update sales_monthly_lago"
    ON public.sales_monthly_lago;
CREATE POLICY "Admins can update sales_monthly_lago"
    ON public.sales_monthly_lago FOR UPDATE TO authenticated
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

DROP POLICY IF EXISTS "Admins can delete sales_monthly_lago"
    ON public.sales_monthly_lago;
CREATE POLICY "Admins can delete sales_monthly_lago"
    ON public.sales_monthly_lago FOR DELETE TO authenticated
    USING (
        auth.uid() IN (
            SELECT user_id FROM public.sales WHERE administrator IS TRUE
        )
    );

-- ---------------------------------------------------------------------
-- 2. Åbne ordrer / "Optagne ordrer" (snapshot)
--    IKKE-FAKTUREREDE ordrelinjer fra VISMAs Ordrelinier (fremadrettet
--    pipeline). "Åben" = kun de ikke-fakturerede linjer, ikke hele
--    ordren — en delvist faktureret ordre har nogle linjer her og
--    resten i sales_monthly_lago. Må ALDRIG lægges sammen med
--    sales_monthly_lago.
--    UI-navn: "Optagne ordrer" (aldrig "pipeline" alene).
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.open_orders_lago (
    ordre_nr           text PRIMARY KEY,
    visma_customer_no  text NOT NULL,
    ordre_dato         date NOT NULL,
    belob              numeric(14, 2) NOT NULL DEFAULT 0,
    kilde              text NOT NULL DEFAULT 'import'
                       CHECK (kilde IN ('import', 'vbs')),
    synced_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS open_orders_lago_customer_idx
    ON public.open_orders_lago (visma_customer_no);

CREATE INDEX IF NOT EXISTS open_orders_lago_dato_idx
    ON public.open_orders_lago (ordre_dato);

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

-- ---------------------------------------------------------------------
-- 3. Synk-kørsler (revisions-spor)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sync_runs_lago (
    id          bigserial PRIMARY KEY,
    datasaet    text NOT NULL
                CHECK (datasaet IN ('sales_monthly', 'open_orders', 'customers')),
    kilde       text NOT NULL
                CHECK (kilde IN ('import', 'vbs')),
    raekker     int  NOT NULL DEFAULT 0,
    periode_fra date,
    periode_til date,
    koert_af    bigint REFERENCES public.sales (id) ON DELETE SET NULL,
    koert_at    timestamptz NOT NULL DEFAULT now(),
    note        text
);

CREATE INDEX IF NOT EXISTS sync_runs_lago_datasaet_koert_at_idx
    ON public.sync_runs_lago (datasaet, koert_at DESC);

ALTER TABLE public.sync_runs_lago ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read sync_runs_lago"
    ON public.sync_runs_lago;
CREATE POLICY "Authenticated users can read sync_runs_lago"
    ON public.sync_runs_lago FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can insert sync_runs_lago"
    ON public.sync_runs_lago;
CREATE POLICY "Admins can insert sync_runs_lago"
    ON public.sync_runs_lago FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() IN (
            SELECT user_id FROM public.sales WHERE administrator IS TRUE
        )
    );

DROP POLICY IF EXISTS "Admins can update sync_runs_lago"
    ON public.sync_runs_lago;
CREATE POLICY "Admins can update sync_runs_lago"
    ON public.sync_runs_lago FOR UPDATE TO authenticated
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

DROP POLICY IF EXISTS "Admins can delete sync_runs_lago"
    ON public.sync_runs_lago;
CREATE POLICY "Admins can delete sync_runs_lago"
    ON public.sync_runs_lago FOR DELETE TO authenticated
    USING (
        auth.uid() IN (
            SELECT user_id FROM public.sales WHERE administrator IS TRUE
        )
    );

-- ---------------------------------------------------------------------
-- 4. Additiv: kundetype-kolonne på companies_lago
-- ---------------------------------------------------------------------

ALTER TABLE public.companies_lago
    ADD COLUMN IF NOT EXISTS kundetype text
    CHECK (kundetype IS NULL OR kundetype IN ('engros', 'horeca', 'andre'));

CREATE INDEX IF NOT EXISTS companies_lago_kundetype_idx
    ON public.companies_lago (kundetype)
    WHERE kundetype IS NOT NULL;
