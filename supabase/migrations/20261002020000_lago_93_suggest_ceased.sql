-- §93 (2. okt 2026): sælgeren kan foreslå at en kunde er ophørt.
--
-- Same table, same queue, same UI. Just felt='status'.
-- But: auto-close uses 'bortfaldet' instead of 'gennemfoert' because
-- we know reality overtook the suggestion — not that anyone acted on it.
--
-- Three changes:
--   1. Allow 'bortfaldet' in status CHECK
--   2. Update close_matched_change_suggestions to handle felt='status'
--      by checking companies_lago.is_active instead of column value

-- 1. Expand status CHECK to include 'bortfaldet'
ALTER TABLE public.kunde_aendringsforslag_lago
    DROP CONSTRAINT IF EXISTS kunde_aendringsforslag_lago_status_check;
ALTER TABLE public.kunde_aendringsforslag_lago
    ADD CONSTRAINT kunde_aendringsforslag_lago_status_check
    CHECK (status IN ('afventer', 'gennemfoert', 'afvist', 'bortfaldet'));

-- 2. Update auto-close to handle status suggestions
CREATE OR REPLACE FUNCTION public.close_matched_change_suggestions()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r RECORD;
    v_actual text;
    v_sql text;
    v_closed int := 0;
BEGIN
    FOR r IN
        SELECT id, company_id, felt, felt_source, foreslaaet_vaerdi
          FROM public.kunde_aendringsforslag_lago
         WHERE status = 'afventer'
    LOOP
        -- §93: status suggestions check is_active, not a column value.
        -- A suggestion with felt='status' and foreslaaet_vaerdi='ophørt'
        -- is fulfilled when the customer becomes inactive in VISMA.
        IF r.felt = 'status' THEN
            SELECT CASE WHEN cl.is_active = false THEN 'ophørt' ELSE NULL END
              INTO v_actual
              FROM public.companies_lago cl
             WHERE cl.company_id = r.company_id;
        ELSIF r.felt_source = 'companies' THEN
            v_sql := format(
                'SELECT %I::text FROM public.companies WHERE id = $1',
                r.felt
            );
            BEGIN
                EXECUTE v_sql INTO v_actual USING r.company_id;
            EXCEPTION WHEN OTHERS THEN
                CONTINUE;
            END;
        ELSE
            v_sql := format(
                'SELECT %I::text FROM public.companies_lago WHERE company_id = $1',
                r.felt
            );
            BEGIN
                EXECUTE v_sql INTO v_actual USING r.company_id;
            EXCEPTION WHEN OTHERS THEN
                CONTINUE;
            END;
        END IF;

        IF v_actual IS NOT NULL
           AND lower(btrim(v_actual)) = lower(btrim(r.foreslaaet_vaerdi)) THEN
            UPDATE public.kunde_aendringsforslag_lago
               SET status = CASE
                       WHEN r.felt = 'status' THEN 'bortfaldet'
                       ELSE 'gennemfoert'
                   END,
                   lukket = now(),
                   lukket_grund = CASE
                       WHEN r.felt = 'status' THEN 'kunden er inaktiv i VISMA'
                       ELSE 'rettet i VISMA'
                   END
             WHERE id = r.id;
            v_closed := v_closed + 1;
        END IF;
    END LOOP;
    RETURN v_closed;
END;
$$;
