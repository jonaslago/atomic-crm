-- Brief 89 tillæg A (28. sep 2026): sjette hensigt "Send med næste ordre".
--
-- Hører sammen med "Venter på andre varer" i Salg og ordrer. Sælgeren
-- ser de 26 kunder med varer, der venter på selskab — og nu kan han
-- også selv sætte en ordre i den tilstand, i stedet for kun at opdage
-- den bagefter. Virker begge veje: en linje der ALLEREDE er MAV kan
-- få hensigten "Send nu" ("vent ikke længere, send det vi har").
--
-- Seks hensigter er grænsen. Flere end det, og det er ikke længere en
-- beslutning, men en formular (brief 89 §2).

-- 1) Udvid CHECK-constraint på hensigt --------------------------------

ALTER TABLE public.ordre_kommentar_lago
    DROP CONSTRAINT IF EXISTS ordre_kommentar_lago_hensigt_check;

ALTER TABLE public.ordre_kommentar_lago
    ADD CONSTRAINT ordre_kommentar_lago_hensigt_check
    CHECK (hensigt IN (
        'send_nu',
        'afvent',
        'leveringsdato',
        'ring_kunde',
        'andet',
        'send_med_naeste_ordre'
    ));

-- 2) Auto-luk-funktion — udvidet ---------------------------------------
--
-- 'send_nu' bortfalder som før (leveret / væk).
-- 'send_med_naeste_ordre' bortfalder når linjen står som MAV i VISMA
-- eller ordren er ekspederet.
-- 'leveringsdato' uændret (matches mod oensket_leveringsdato).
--
-- Ordre-niveau tjek: BOOL_OR(mav) på tværs af linjer på ordren.
-- Så virker den både når kontoret sætter linje-niveau MAV og når
-- hele ordren er markeret.
--
-- STADIG IKKE KOBLET TIL IMPORTEN. Skal kaldes efter åbne-ordrer-import
-- færdiggøres. Se migration 20260928230000_lago_89_ordre_kommentarer.sql.

CREATE OR REPLACE FUNCTION public.close_matched_ordre_kommentarer()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r RECORD;
    v_agg RECORD;
    v_closed int := 0;
BEGIN
    FOR r IN
        SELECT id, ordre_nr, hensigt, aftalt_dato
          FROM public.ordre_kommentar_lago
         WHERE status = 'afventer'
    LOOP
        -- Ordre-niveau aggregering. Én ordre kan have mange linjer;
        -- vi kigger på ordrens tilstand samlet.
        SELECT
            COALESCE(SUM(antal_faerdigmeldt), 0) AS sum_faerdigmeldt,
            MAX(oensket_leveringsdato)           AS oensket_dato,
            BOOL_OR(mav)                         AS har_mav,
            COUNT(*)                              AS linjer
          INTO v_agg
          FROM public.open_orders_lago
         WHERE ordre_nr = r.ordre_nr;

        IF r.hensigt = 'send_nu' THEN
            IF v_agg.linjer = 0 OR v_agg.sum_faerdigmeldt > 0 THEN
                UPDATE public.ordre_kommentar_lago
                   SET status = 'bortfaldet',
                       lukket = now(),
                       lukket_grund =
                         'ordren er ekspederet — set på næste import'
                 WHERE id = r.id;
                v_closed := v_closed + 1;
            END IF;
        ELSIF r.hensigt = 'send_med_naeste_ordre' THEN
            -- Linjen står som MAV i VISMA = kontoret har sat den i den
            -- tilstand vi bad om.
            IF v_agg.linjer > 0 AND v_agg.har_mav THEN
                UPDATE public.ordre_kommentar_lago
                   SET status = 'bortfaldet',
                       lukket = now(),
                       lukket_grund =
                         'linjen står nu som MAV i VISMA'
                 WHERE id = r.id;
                v_closed := v_closed + 1;
            -- Eller: ordren er ekspederet (så MAV er blevet til levering).
            ELSIF v_agg.linjer = 0 OR v_agg.sum_faerdigmeldt > 0 THEN
                UPDATE public.ordre_kommentar_lago
                   SET status = 'bortfaldet',
                       lukket = now(),
                       lukket_grund =
                         'ordren er ekspederet — set på næste import'
                 WHERE id = r.id;
                v_closed := v_closed + 1;
            END IF;
        ELSIF r.hensigt = 'leveringsdato' THEN
            IF v_agg.linjer > 0
               AND v_agg.oensket_dato = r.aftalt_dato THEN
                UPDATE public.ordre_kommentar_lago
                   SET status = 'bortfaldet',
                       lukket = now(),
                       lukket_grund =
                         'aftalt dato står nu på ordren i VISMA'
                 WHERE id = r.id;
                v_closed := v_closed + 1;
            END IF;
        END IF;
        -- 'afvent', 'ring_kunde', 'andet' auto-lukker ikke.
    END LOOP;
    RETURN v_closed;
END;
$$;
