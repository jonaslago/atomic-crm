-- LAGO Domain-brief 19b (rev 4. sep 2026) — produktstamdata.
--
-- 2.465 produkter, ændrer sig sjældent. Importen er en fuld erstatning
-- (delete-all + insert) eller idempotent upsert på produktnr.
--
-- Produkttransaktionerne har varenummeret men ikke navnet — uden denne
-- tabel kan et kundekort kun vise varenumre.
--
-- Bogfoeringsgruppe = Produktgruppe under et andet navn (samme begreb,
-- to navne i VISMA — brug transaktionens Produktgruppe til at filtrere
-- "Salg i DK", og produkttabellens bogføringsgruppe når du senere vil
-- gruppere produktkataloget).

CREATE TABLE IF NOT EXISTS public.products_lago (
    produktnr          text PRIMARY KEY,
    beskrivelse        text,
    bogfoeringsgruppe  text,
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

DROP POLICY IF EXISTS "Authenticated users can read products_lago"
    ON public.products_lago;
CREATE POLICY "Authenticated users can read products_lago"
    ON public.products_lago FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can insert products_lago"
    ON public.products_lago;
CREATE POLICY "Admins can insert products_lago"
    ON public.products_lago FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() IN (
            SELECT user_id FROM public.sales WHERE administrator IS TRUE
        )
    );

DROP POLICY IF EXISTS "Admins can update products_lago"
    ON public.products_lago;
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

DROP POLICY IF EXISTS "Admins can delete products_lago"
    ON public.products_lago;
CREATE POLICY "Admins can delete products_lago"
    ON public.products_lago FOR DELETE TO authenticated
    USING (
        auth.uid() IN (
            SELECT user_id FROM public.sales WHERE administrator IS TRUE
        )
    );
