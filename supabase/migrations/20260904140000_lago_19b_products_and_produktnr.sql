-- LAGO Domain-brief 19b (rev 4. sep 2026) — produktnr på salgstransaktion,
-- produktstamdata, opdaterede ordre-datoer, produktgrupper i settings.
--
-- Fire ændringer:
--   1. sales_monthly_lago: produktnr + antal, PK udvides til
--      (kundenr, år, måned, produktnr, salgstype) — så vareprøve på
--      et bestemt produkt kan følges (FS-21), købshistorik pr. produkt
--      (FS-1), mersalgsforslag (FS-17).
--   2. open_orders_lago: drop bekraeftet_lev_dato (LAGO bruger ikke),
--      drop beskrivelse (navnet kommer nu fra products_lago-join),
--      add faerdigmeldingsdato (tom nu, værdifuld ved afsluttede linjer).
--      Ønsket_leveringsdato bliver på tabellen; datakilden ændres i
--      parseren (fra linjen til ordre-hovedet) — kolonnen forbliver.
--   3. Ny tabel products_lago (2.465 rækker, ændrer sig sjældent).
--   4. Produktgruppe-filter flyttes fra hardkodet parser-Set til
--      lago_settings.sales_product_groups — forretningsvalg, ikke
--      konstant.

-- ---------------------------------------------------------------------
-- 1. sales_monthly_lago — udvid PK med produktnr, tilføj antal
-- ---------------------------------------------------------------------

DROP VIEW IF EXISTS public.v_customer_activity_status;
DROP VIEW IF EXISTS public.v_sales_district_periods;
DROP VIEW IF EXISTS public.v_sales_customer_periods;

ALTER TABLE public.sales_monthly_lago
    DROP CONSTRAINT IF EXISTS sales_monthly_lago_pkey;

ALTER TABLE public.sales_monthly_lago
    ADD COLUMN IF NOT EXISTS produktnr text NOT NULL DEFAULT '';

ALTER TABLE public.sales_monthly_lago
    ADD COLUMN IF NOT EXISTS antal numeric(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.sales_monthly_lago
    ADD CONSTRAINT sales_monthly_lago_pkey
    PRIMARY KEY (visma_customer_no, aar, maaned, produktnr, salgstype);

CREATE INDEX IF NOT EXISTS sales_monthly_lago_produktnr_idx
    ON public.sales_monthly_lago (produktnr)
    WHERE produktnr <> '';

-- ---------------------------------------------------------------------
-- 2. open_orders_lago — drop bekraeftet + beskrivelse, add færdigmelding
-- ---------------------------------------------------------------------

DROP VIEW IF EXISTS public.v_open_orders_categorised;

ALTER TABLE public.open_orders_lago
    DROP COLUMN IF EXISTS bekraeftet_lev_dato,
    DROP COLUMN IF EXISTS beskrivelse;

ALTER TABLE public.open_orders_lago
    ADD COLUMN IF NOT EXISTS faerdigmeldingsdato date;

-- ---------------------------------------------------------------------
-- 3. Ny tabel: products_lago
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.products_lago (
    produktnr          text PRIMARY KEY,
    beskrivelse        text,
    bogfoeringsgruppe  text,          -- = Produktgruppe under et andet navn
    oprindelsesland    text,
    appellation        text,
    farve_type         text,
    aargang            text,
    producent          text,
    alc_pct            numeric(4, 2),
    oekologi           text,
    status             text,          -- "2 [Salgsbar]"
    lagerenhed         text,
    ant_pr_kolli       numeric(10, 2),
    er_testdata        boolean NOT NULL DEFAULT true,
    kilde              text NOT NULL DEFAULT 'import'
                       CHECK (kilde IN ('import', 'vbs')),
    synced_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS products_lago_bogfoeringsgruppe_idx
    ON public.products_lago (bogfoeringsgruppe)
    WHERE bogfoeringsgruppe IS NOT NULL;
CREATE INDEX IF NOT EXISTS products_lago_status_idx
    ON public.products_lago (status)
    WHERE status IS NOT NULL;
CREATE INDEX IF NOT EXISTS products_lago_testdata_idx
    ON public.products_lago (er_testdata);

ALTER TABLE public.products_lago ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read products_lago"
    ON public.products_lago FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert products_lago"
    ON public.products_lago FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() IN (
            SELECT user_id FROM public.sales WHERE administrator IS TRUE
        )
    );

CREATE POLICY "Admins can update products_lago"
    ON public.products_lago FOR UPDATE TO authenticated
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

CREATE POLICY "Admins can delete products_lago"
    ON public.products_lago FOR DELETE TO authenticated
    USING (
        auth.uid() IN (
            SELECT user_id FROM public.sales WHERE administrator IS TRUE
        )
    );

-- Udvid sync_runs_lago's datasæt-check til at inkludere 'products'.
ALTER TABLE public.sync_runs_lago
    DROP CONSTRAINT IF EXISTS sync_runs_lago_datasaet_check;
ALTER TABLE public.sync_runs_lago
    ADD CONSTRAINT sync_runs_lago_datasaet_check
    CHECK (datasaet IN ('sales_monthly', 'open_orders', 'customers', 'products'));

-- ---------------------------------------------------------------------
-- 4. Produktgruppe-filter i lago_settings (ikke hardkodet i parser)
-- ---------------------------------------------------------------------

INSERT INTO public.lago_settings(key, value)
VALUES (
    'sales_product_groups',
    '{"groups": [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,45,53,54,88]}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
