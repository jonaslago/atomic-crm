-- Tillæg A til brief 21 (16. sep 2026): måling af AI-3-udfaldet.
--
-- Hvorfor: uden dette måler vi kun aktivitet (kaldet knappen tryks),
-- ikke værdi (blev forslagene brugt, afvist eller overset). Et AI-udtræk
-- brugt 10 gange og afvist 10 gange ville se identisk ud med et der
-- blev accepteret hver gang.
--
-- Fire trin:
--
--   1) `llm_calls` får fire tælle-kolonner (count_returned, _added,
--      _rejected, _ignored). Ignoreret = forslag som lå på skærmen
--      da besøget blev gemt uden at sælgeren rørte det. Den kategori
--      er den vigtigste — den viser om placeringen eller formuleringen
--      er problemet, ikke kvaliteten.
--
--   2) `tasks` får fire ai-felter: hvilket llm_calls-kald tasken kom
--      fra, den oprindelige tekst + dato (så en post-hoc rapport kan
--      spørge om AI'ens råd blev omskrevet), og et redigeret-flag.
--      NULL på ai_llm_call_id = ikke fra AI. Kolonnerne nedarver
--      eksisterende RLS-policier på tasks.
--
--   3) `record_ai_suggestion_outcomes` RPC: klienten kan ikke UPDATE-e
--      llm_calls-rækker direkte (kun læse dem). SECURITY DEFINER-funktion
--      er den simplest sikre vej — den håndhæver at brugeren kun
--      opdaterer et kald hvor user_id matcher, og at tællingerne ikke
--      overstiger count_returned.
--
--   4) Ingen skærm. Rapport-forespørgslerne kan skrives 1. okt mod de
--      nye kolonner. Bygger vi en skærm til en måling vi laver én gang,
--      har vi brugt mere tid på at måle end på at bygge (brief §5).

-- 1) Kolonner på llm_calls
ALTER TABLE public.llm_calls
    ADD COLUMN IF NOT EXISTS count_returned int,
    ADD COLUMN IF NOT EXISTS count_added    int,
    ADD COLUMN IF NOT EXISTS count_rejected int,
    ADD COLUMN IF NOT EXISTS count_ignored  int;

-- 2) Kolonner på tasks
ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS ai_llm_call_id      bigint
        REFERENCES public.llm_calls (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS ai_original_text    text,
    ADD COLUMN IF NOT EXISTS ai_original_due_date timestamptz,
    ADD COLUMN IF NOT EXISTS ai_edited           boolean;

-- Index så rapport-forespørgslerne (fx "hvor mange tasks stammer fra
-- kald X") kan svare uden fuld scan. Delvist filter: langt størstedelen
-- af tasks er ikke fra AI.
CREATE INDEX IF NOT EXISTS tasks_ai_llm_call_id_idx
    ON public.tasks (ai_llm_call_id)
    WHERE ai_llm_call_id IS NOT NULL;

-- 3) RPC
--
-- Klienten kender alle fire tal: count_returned kommer fra parseren
-- (0-3 gyldige forslag) og de tre udfald opgøres i ForslagListe når
-- besøget gemmes. Én RPC-tur er billigere end fire round-trips, og
-- SECURITY DEFINER holder klient-siden ude fra selve UPDATE-rettigheden.
CREATE OR REPLACE FUNCTION public.record_ai_suggestion_outcomes(
    llm_call_id bigint,
    returned_count int,
    added_count int,
    rejected_count int,
    ignored_count int
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner uuid;
BEGIN
    IF returned_count < 0 OR added_count < 0
       OR rejected_count < 0 OR ignored_count < 0 THEN
        RAISE EXCEPTION 'AI-udfaldstællinger kan ikke være negative';
    END IF;

    IF added_count + rejected_count + ignored_count > returned_count THEN
        RAISE EXCEPTION
            'Sum af udfald (%) overstiger antal returnerede forslag (%)',
            added_count + rejected_count + ignored_count, returned_count;
    END IF;

    SELECT user_id
      INTO v_owner
      FROM public.llm_calls
     WHERE id = llm_call_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'llm_calls-række % findes ikke', llm_call_id;
    END IF;

    -- Kun ejeren af kaldet må rapportere udfaldet.
    IF v_owner IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Kun ejeren af AI-kaldet kan rapportere udfald';
    END IF;

    UPDATE public.llm_calls
       SET count_returned = returned_count,
           count_added    = added_count,
           count_rejected = rejected_count,
           count_ignored  = ignored_count
     WHERE id = llm_call_id;
END;
$$;

REVOKE ALL ON FUNCTION
    public.record_ai_suggestion_outcomes(bigint, int, int, int, int)
    FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
    public.record_ai_suggestion_outcomes(bigint, int, int, int, int)
    TO authenticated;
