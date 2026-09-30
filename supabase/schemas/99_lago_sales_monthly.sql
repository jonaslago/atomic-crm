-- LAGO Domain-brief 19 — månedlig omsætning pr. kunde.
--
-- Én række pr. (kunde, år, måned). Alle afledte tal (T12M, ÅTD, 3 mdr.,
-- vækst, inaktiv-flag) beregnes i views ovenpå — aldrig gemte kolonner,
-- så definitionen kan justeres uden reimport.
--
-- Nøglen er visma_customer_no (ikke company_id): importen kan køre
-- uden opslag, og rækker for kunder vi endnu ikke har oprettet, går
-- ikke tabt. Join til companies_lago sker i views.
--
-- Kilde: 'import' (manuel VISMA-eksport) eller 'vbs' (kommende sync).
-- Skærmene ved ikke hvilken vej data kom.
--
-- ============================================================
-- SEMANTISK GRÆNSE (læs FØR du joiner med open_orders_lago)
-- ============================================================
-- Denne tabel indeholder UDELUKKENDE FAKTURERET OMSÆTNING —
-- linjer fra VISMAs Produkttransaktioner-tabel (låste). Periodens
-- måned bestemmes af FAKTURERINGSDATOEN på produkttransaktionen
-- (ikke ordredato, ikke leveringsdato) — det er det direktørens
-- rapport grupperer på, så totalerne kan afstemmes.
--
-- open_orders_lago indeholder ikke-fakturerede ordrelinjer og er
-- et FREMADRETTET tal. De to må ALDRIG lægges sammen: en delvist
-- faktureret ordre har nogle linjer her og resten i open_orders_lago
-- — summeres hele ordren, dobbelttælles det fakturerede beløb.

-- Salgstype (brief 19b afsnit 3): FRIFLM tæller fuldt med i omsætning;
-- FRIFL/PROMO/PRØVE er 0 kr. men SKAL følges (vareprøver, FS-5/FS-21).
-- Derfor er salgstype del af PK — vi kan aggregere på tværs når vi vil,
-- men mister ikke salgstype-opdelingen ved at aggregere ved import.

-- Produktnr er del af PK (brief 19b, rev 4. sep): så vareprøve af et
-- bestemt produkt kan følges (FS-21), købshistorik pr. produkt (FS-1),
-- mersalgsforslag (FS-17). Datamængden: 43.388 rækker for 32 måneder
-- (vs 3.411 uden produkt) — begge dele små.
--
-- Salgstype er også del af PK: så PRØVE af samme produkt samme måned
-- kan skilles fra betalt køb af samme produkt.

CREATE TABLE IF NOT EXISTS public.sales_monthly_lago (
    visma_customer_no  text     NOT NULL,
    aar                smallint NOT NULL,
    maaned             smallint NOT NULL CHECK (maaned BETWEEN 1 AND 12),
    produktnr          text     NOT NULL DEFAULT '',
    salgstype          text     NOT NULL DEFAULT '',
    belob              numeric(14, 2) NOT NULL DEFAULT 0,
    antal              numeric(14, 2) NOT NULL DEFAULT 0,
    er_testdata        boolean  NOT NULL DEFAULT true,
    kilde              text     NOT NULL DEFAULT 'import'
                       CHECK (kilde IN ('import', 'vbs')),
    synced_at          timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (visma_customer_no, aar, maaned, produktnr, salgstype)
);

CREATE INDEX IF NOT EXISTS sales_monthly_lago_periode_idx
    ON public.sales_monthly_lago (aar, maaned);

CREATE INDEX IF NOT EXISTS sales_monthly_lago_testdata_idx
    ON public.sales_monthly_lago (er_testdata);

CREATE INDEX IF NOT EXISTS sales_monthly_lago_salgstype_idx
    ON public.sales_monthly_lago (salgstype)
    WHERE salgstype <> '';

CREATE INDEX IF NOT EXISTS sales_monthly_lago_produktnr_idx
    ON public.sales_monthly_lago (produktnr)
    WHERE produktnr <> '';

ALTER TABLE public.sales_monthly_lago ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read sales_monthly_lago"
    ON public.sales_monthly_lago;
CREATE POLICY "Authenticated users can read sales_monthly_lago"
    ON public.sales_monthly_lago
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Admins can insert sales_monthly_lago"
    ON public.sales_monthly_lago;
CREATE POLICY "Admins can insert sales_monthly_lago"
    ON public.sales_monthly_lago
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() IN (
            SELECT user_id FROM public.sales WHERE administrator IS TRUE
        )
    );

DROP POLICY IF EXISTS "Admins can update sales_monthly_lago"
    ON public.sales_monthly_lago;
CREATE POLICY "Admins can update sales_monthly_lago"
    ON public.sales_monthly_lago
    FOR UPDATE
    TO authenticated
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
    ON public.sales_monthly_lago
    FOR DELETE
    TO authenticated
    USING (
        auth.uid() IN (
            SELECT user_id FROM public.sales WHERE administrator IS TRUE
        )
    );
