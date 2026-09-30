-- §11 (29. sep 2026): open_order_notes_lago — noter tilknyttet åbne ordre-
-- linjer, importeret sammen med selve ordrelinjerne (§15).
--
-- Ubehandlet tekst i Linienr-rækkefølge (§11c). Ingen fortolkning,
-- ingen kategorisering, ingen automatisk status (§11b). note_type
-- gemmes men bruges IKKE i UI endnu — indholdet respekterer ikke
-- navnene enote/inote (fx enote bærer "Pakkes i gavekartoner…" der er
-- arbejdsinstruktion, ikke kundetekst).
--
-- Én tabel, én skæbne: joinet mod open_orders_lago sker i importen på
-- ordre_nr fra SAMME kørsel — vi må ikke vise noter fra i går på en
-- ordre fra i dag. Derfor DROP+INSERT i én transaction sammen med
-- open_orders_lago-erstatningen.

CREATE TABLE IF NOT EXISTS public.open_order_notes_lago (
    ordre_nr      text NOT NULL,
    linje_nr      text NOT NULL,
    produktnr     text,
    -- 'inote' eller 'enote'. §11b: gemmes, bruges ikke endnu.
    note_type     text CHECK (note_type IN ('inote', 'enote')),
    beskrivelse   text NOT NULL,
    aendret_dato  date,
    synced_at     timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (ordre_nr, linje_nr)
);

CREATE INDEX IF NOT EXISTS open_order_notes_lago_ordre_idx
    ON public.open_order_notes_lago (ordre_nr);

COMMENT ON TABLE public.open_order_notes_lago IS
'§11 (29. sep 2026): notelinjer på åbne ordrer, én række pr. (ordre_nr, linje_nr). Ubehandlet tekst — ingen kategorisering. note_type gemmes men bruges ikke i UI endnu (indhold respekterer ikke inote/enote-skellet). Erstattes i samme transaction som open_orders_lago.';

ALTER TABLE public.open_order_notes_lago ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read open_order_notes_lago"
    ON public.open_order_notes_lago;
CREATE POLICY "Authenticated read open_order_notes_lago"
    ON public.open_order_notes_lago
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can insert open_order_notes_lago"
    ON public.open_order_notes_lago;
CREATE POLICY "Admins can insert open_order_notes_lago"
    ON public.open_order_notes_lago
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() IN (
            SELECT user_id FROM public.sales WHERE administrator IS TRUE
        )
    );

DROP POLICY IF EXISTS "Admins can delete open_order_notes_lago"
    ON public.open_order_notes_lago;
CREATE POLICY "Admins can delete open_order_notes_lago"
    ON public.open_order_notes_lago
    FOR DELETE TO authenticated
    USING (
        auth.uid() IN (
            SELECT user_id FROM public.sales WHERE administrator IS TRUE
        )
    );
