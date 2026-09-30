-- Sletteregler (29. sep 2026) · én log-tabel for soft-deletes.
--
-- Manglende log på aktiviteter var ikke et bevidst fravalg — det blev
-- noteret som et hul 28. sep. Denne tabel dækker begge tabeller vi
-- allerede soft-deleter, og den er skrevet så den næste soft-delete-
-- funktion, nogen tilføjer, ikke kan omgå den: trigger på deleted_at.
--
-- Fire eksisterende bløde sletninger på customer_activities_lago
-- efterregistreres IKKE — vi ved ikke hvem. Loggen begynder her.
--
-- Ikke nu: visning for ejeren. Skriv loggen først, vis den bagefter.

-- 1. Tabel ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sletninger_lago (
    id            bigserial PRIMARY KEY,
    objekt_type   text NOT NULL
                    CHECK (objekt_type IN ('note', 'aktivitet', 'opgave')),
    objekt_id     bigint NOT NULL,
    company_id    bigint,
    slettet_af    bigint NOT NULL,
    slettet       timestamptz NOT NULL DEFAULT now(),
    begrundelse   text,
    genskabt      timestamptz
);

CREATE INDEX IF NOT EXISTS sletninger_lago_objekt_idx
    ON public.sletninger_lago (objekt_type, objekt_id);
CREATE INDEX IF NOT EXISTS sletninger_lago_company_idx
    ON public.sletninger_lago (company_id)
    WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sletninger_lago_slettet_idx
    ON public.sletninger_lago (slettet DESC);
CREATE INDEX IF NOT EXISTS sletninger_lago_aktive_idx
    ON public.sletninger_lago (objekt_type, objekt_id, slettet DESC)
    WHERE genskabt IS NULL;

COMMENT ON TABLE public.sletninger_lago IS
'Sletteregler (29. sep 2026): én log for soft-deletes på tværs af noter, aktiviteter og senere opgaver. Skrives fra triggere på deleted_at, ikke fra mutations — så ingen ny slettevej kan omgå loggen.';

ALTER TABLE public.sletninger_lago ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read sletninger" ON public.sletninger_lago;
CREATE POLICY "Authenticated read sletninger"
    ON public.sletninger_lago
    FOR SELECT TO authenticated USING (true);

-- Ingen INSERT/UPDATE-policy for authenticated — kun triggers (SECURITY
-- DEFINER) må skrive. Det er en ekstra garanti mod at loggen fabrikeres
-- eller manipuleres fra klienten.

-- 2. Trigger-funktion -------------------------------------------------
--
-- Én funktion, to argumenter (via TG_ARGV): objekt_type og navnet på
-- company_id-kolonnen på trigger-tabellen (samme kolonne er "company_id"
-- på begge nuværende tabeller, men vi giver den som argument så en ny
-- soft-delete-tabel med anden foreign key kan bruge samme funktion).
--
-- Actor via auth.uid() → sales.id-lookup. NULL hvis kalderen ikke er
-- knyttet til en sales-række — tolereres men trigger fejler så. Rejste
-- vi det, ville en admin uden sales-række låse hele slette-flowet.
-- I stedet: 0 som sentinel-værdi, så vi kan finde de her rækker og
-- rette dem senere hvis det bliver et problem.
--
-- Begrundelse via current_setting('lago.slette_begrundelse', true).
-- SET LOCAL fra RPC'en gør at strengen kun lever i den ene transaction.

CREATE OR REPLACE FUNCTION public.log_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_type          text := TG_ARGV[0];
    v_company_col   text := TG_ARGV[1];
    v_company_id    bigint;
    v_actor_id      bigint;
    v_begrundelse   text;
BEGIN
    -- Overgang fra "ikke slettet" til "slettet": INSERT logrække.
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        -- Hent company_id dynamisk fra den nye række via kolonnenavnet.
        EXECUTE format('SELECT ($1).%I::bigint', v_company_col)
            INTO v_company_id
            USING NEW;
        SELECT s.id INTO v_actor_id
            FROM public.sales s
            WHERE s.user_id = auth.uid()
            LIMIT 1;
        v_begrundelse := NULLIF(
            current_setting('lago.slette_begrundelse', true),
            ''
        );
        INSERT INTO public.sletninger_lago (
            objekt_type, objekt_id, company_id, slettet_af, begrundelse
        ) VALUES (
            v_type,
            NEW.id,
            v_company_id,
            COALESCE(v_actor_id, 0),
            v_begrundelse
        );
    -- Overgang fra "slettet" til "ikke slettet": Fortryd. Sæt genskabt
    -- på seneste aktive logrække for samme (type, id).
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
        UPDATE public.sletninger_lago
           SET genskabt = now()
         WHERE id = (
             SELECT id FROM public.sletninger_lago
              WHERE objekt_type = v_type
                AND objekt_id = NEW.id
                AND genskabt IS NULL
              ORDER BY slettet DESC
              LIMIT 1
         );
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.log_soft_delete() FROM PUBLIC;

-- 3. Tilføj deleted_at til company_notes_lago -------------------------

ALTER TABLE public.company_notes_lago
    ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS company_notes_lago_active_idx
    ON public.company_notes_lago (company_id, created_at DESC)
    WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.company_notes_lago.deleted_at IS
'Soft-delete markør. Sat af soft_delete-RPC; nulstillet af restore-RPC. Trigger log_soft_delete_on_note skriver til sletninger_lago.';

-- 4. Triggere på begge tabeller ---------------------------------------

DROP TRIGGER IF EXISTS log_soft_delete_on_note ON public.company_notes_lago;
CREATE TRIGGER log_soft_delete_on_note
AFTER UPDATE OF deleted_at ON public.company_notes_lago
FOR EACH ROW
WHEN (OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
EXECUTE FUNCTION public.log_soft_delete('note', 'company_id');

DROP TRIGGER IF EXISTS log_soft_delete_on_activity
    ON public.customer_activities_lago;
CREATE TRIGGER log_soft_delete_on_activity
AFTER UPDATE OF deleted_at ON public.customer_activities_lago
FOR EACH ROW
WHEN (OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
EXECUTE FUNCTION public.log_soft_delete('aktivitet', 'company_id');

-- 5. RPC'er der bærer begrundelsen ind ---------------------------------
--
-- Klienten kalder disse i stedet for at UPDATE direkte. SET LOCAL sætter
-- begrundelsen for samme transaction, UPDATE fyrer triggeren, triggeren
-- læser current_setting. Klienter der stadig UPDATE direkte får en
-- logrække uden begrundelse — det er OK. Ingen data mistes.

CREATE OR REPLACE FUNCTION public.soft_delete_note(
    p_id bigint,
    p_begrundelse text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    PERFORM set_config(
        'lago.slette_begrundelse',
        COALESCE(p_begrundelse, ''),
        true
    );
    UPDATE public.company_notes_lago
       SET deleted_at = now()
     WHERE id = p_id AND deleted_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_note(p_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    UPDATE public.company_notes_lago
       SET deleted_at = NULL
     WHERE id = p_id AND deleted_at IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_activity(
    p_id bigint,
    p_begrundelse text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    PERFORM set_config(
        'lago.slette_begrundelse',
        COALESCE(p_begrundelse, ''),
        true
    );
    UPDATE public.customer_activities_lago
       SET deleted_at = now()
     WHERE id = p_id AND deleted_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_activity(p_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    UPDATE public.customer_activities_lago
       SET deleted_at = NULL
     WHERE id = p_id AND deleted_at IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_note(bigint, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_note(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.soft_delete_activity(bigint, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_activity(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_note(bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_note(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_activity(bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_activity(bigint) TO authenticated;
