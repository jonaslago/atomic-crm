-- LAGO Domain-brief 19 — synk-kørsler (revisions-spor).
--
-- Én række pr. import- eller VBS-sync-kørsel. Fodrer synk-status-linjen
-- ("Salgsdata synkroniseret 31. aug 14:12") og er vores eneste spor
-- af, hvornår tallene sidst var rigtige.

CREATE TABLE IF NOT EXISTS public.sync_runs_lago (
    id          bigserial PRIMARY KEY,
    datasaet    text NOT NULL
                CHECK (datasaet IN ('sales_monthly', 'open_orders', 'customers')),
    kilde       text NOT NULL
                CHECK (kilde IN ('import', 'vbs')),
    raekker     int  NOT NULL DEFAULT 0,
    periode_fra date,
    periode_til date,
    er_testdata boolean NOT NULL DEFAULT true,
    koert_af    bigint REFERENCES public.sales (id) ON DELETE SET NULL,
    koert_at    timestamptz NOT NULL DEFAULT now(),
    note        text
);

CREATE INDEX IF NOT EXISTS sync_runs_lago_datasaet_koert_at_idx
    ON public.sync_runs_lago (datasaet, koert_at DESC);

CREATE INDEX IF NOT EXISTS sync_runs_lago_testdata_idx
    ON public.sync_runs_lago (er_testdata);

ALTER TABLE public.sync_runs_lago ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read sync_runs_lago"
    ON public.sync_runs_lago;
CREATE POLICY "Authenticated users can read sync_runs_lago"
    ON public.sync_runs_lago
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Admins can insert sync_runs_lago"
    ON public.sync_runs_lago;
CREATE POLICY "Admins can insert sync_runs_lago"
    ON public.sync_runs_lago
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() IN (
            SELECT user_id FROM public.sales WHERE administrator IS TRUE
        )
    );

DROP POLICY IF EXISTS "Admins can update sync_runs_lago"
    ON public.sync_runs_lago;
CREATE POLICY "Admins can update sync_runs_lago"
    ON public.sync_runs_lago
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

DROP POLICY IF EXISTS "Admins can delete sync_runs_lago"
    ON public.sync_runs_lago;
CREATE POLICY "Admins can delete sync_runs_lago"
    ON public.sync_runs_lago
    FOR DELETE
    TO authenticated
    USING (
        auth.uid() IN (
            SELECT user_id FROM public.sales WHERE administrator IS TRUE
        )
    );
