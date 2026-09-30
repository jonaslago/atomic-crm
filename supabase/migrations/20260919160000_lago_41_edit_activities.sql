-- Brief 41 (16. sep 2026): redigering af aktiviteter i tidslinjen.
--
-- IKKE DEPLOYET AUTONOMT. Kræver godkendelse i dagslys — den ændrer
-- HVEM der kan slette og rette 1.362 importerede VISMA-aktiviteter
-- fra 10. juli. Filen står klar; deploy sker først når admin har
-- læst gennem og accepteret bytte-handlen.
--
-- Tre ting:
--
--   1) update_activity(activity_id, new_note, new_date, new_type, new_done)
--      RPC. Samme rettighedsmodel som soft-delete og mark_activity_done:
--      SECURITY DEFINER, kun ejer eller admin, REVOKE PUBLIC + GRANT
--      authenticated. Valideringen prøves mod den NYE type — ellers
--      var der en bagdør ind i brief 35 §2's "besøg må ikke være i
--      fremtiden"-regel (skift fremtidig smagning til besøg = fremtidigt
--      besøg).
--
--   2) Fjern source='crm_native'-spærringen fra mark_activity_done og
--      soft_delete_customer_activity. Antagelsen bag var at nye
--      VISMA-aktiviteter kom natligt. De gør de ikke — 10. juli-
--      importen var engangs. Spærringen ekskluderer nu de 1.362 rækker
--      fra rettelse eller sletning, hvilket var utilsigtet.
--
--      Ene reelle risiko: en fremtidig kørsel af
--      PROCEDURE_nulstilling_visma_aktiviteter tømmer VISMA-siden og
--      genindlæser 10.-juli-udtrækket. Rettelser mellem 16. sep 2026
--      og den kørsel går tabt. Dokumenteret i selve proceduren,
--      ikke her i koden.
--
--   3) Ai_original_text og ai_original_due_date på tasks-tabellen røres
--      ikke af nogen af de tre RPC'er. AI-3-målingen (brief 21 tillæg A)
--      forbliver intakt selv når en task-referenceret aktivitet rettes.

-- ---------------------------------------------------------------------
-- 1) update_activity
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_activity(
    activity_id bigint,
    new_note text DEFAULT NULL,
    new_date date DEFAULT NULL,
    new_type_code int DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_activity RECORD;
    v_sales_id bigint;
    v_is_admin boolean;
    v_final_type int;
    v_final_date date;
    v_final_done boolean;
BEGIN
    SELECT id, company_id, sales_id, activity_date, activity_type_code, done
      INTO v_activity
      FROM public.customer_activities_lago
     WHERE id = activity_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Aktivitet % findes ikke', activity_id;
    END IF;

    SELECT id, administrator
      INTO v_sales_id, v_is_admin
      FROM public.sales
     WHERE user_id = auth.uid();

    IF v_sales_id IS NULL THEN
        RAISE EXCEPTION 'Brugeren har ingen sales-profil';
    END IF;

    -- Kun ejeren eller admin. Ejerskabet bæres på sales_id — matcher
    -- soft-delete og mark_activity_done. source-spærringen er væk
    -- (brief 41 §2), fordi VISMA-importen af aktiviteter var engangs.
    IF NOT COALESCE(v_is_admin, false)
       AND v_activity.sales_id IS DISTINCT FROM v_sales_id THEN
        RAISE EXCEPTION 'Kun ejeren eller admin kan rette denne aktivitet';
    END IF;

    -- Valideringen prøves mod den NYE type (brief 41 §2b): en fremtidig
    -- smagning der rettes til besøg må ikke lande som fremtidigt besøg,
    -- fordi det bryder brief 35 §2 (besøg kan ikke være i fremtiden).
    v_final_type := COALESCE(new_type_code, v_activity.activity_type_code);
    v_final_date := COALESCE(new_date, v_activity.activity_date);

    IF v_final_type = 1 AND v_final_date > current_date THEN
        RAISE EXCEPTION 'Et besøg kan ikke være i fremtiden — brug Planlæg besøg';
    END IF;

    -- done følger datoen (brief 35 §1): fremtidig → planlagt, i dag/
    -- tidligere → afholdt. Type-skift til besøg + past date gør en
    -- planlagt aktivitet til et afholdt besøg.
    v_final_done := v_final_date <= current_date;

    UPDATE public.customer_activities_lago
       SET activity_date = v_final_date,
           activity_type_code = v_final_type,
           -- activity_type-teksten holdes i sync med koden når den
           -- ændres. Sæt kun hvis new_type_code er ikke-null; ellers
           -- bevar den nuværende (kunne have været manuelt tekst).
           activity_type = CASE
               WHEN new_type_code IS NULL THEN activity_type
               WHEN new_type_code = 1 THEN 'Besøg'
               WHEN new_type_code = 5 THEN 'Opkald'
               WHEN new_type_code = 10 THEN 'Smagning/Promotion'
               WHEN new_type_code = 2 THEN 'Kampagne'
               WHEN new_type_code = 4 THEN 'Egen henvendelse'
               ELSE 'Andet'
           END,
           description = COALESCE(new_note, description),
           done = v_final_done,
           updated_at = now()
     WHERE id = activity_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_activity(bigint, text, date, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_activity(bigint, text, date, int)
    TO authenticated;

-- ---------------------------------------------------------------------
-- 2) Fjern source-spærringen fra de to eksisterende RPC'er
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.soft_delete_customer_activity(
    activity_id bigint,
    undo boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_activity RECORD;
    v_sales_id bigint;
    v_is_admin boolean;
BEGIN
    SELECT company_id, source, sales_id
      INTO v_activity
      FROM public.customer_activities_lago
     WHERE id = activity_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Aktivitet % findes ikke', activity_id;
    END IF;

    -- Brief 41 §2 (16. sep 2026): source='crm_native'-spærring fjernet.
    -- VISMA-importen af aktiviteter var engangs 10. juli — spærringen
    -- ekskluderede utilsigtet 1.362 rækker fra rettelse eller sletning.

    SELECT id, administrator
      INTO v_sales_id, v_is_admin
      FROM public.sales
     WHERE user_id = auth.uid();

    IF v_sales_id IS NULL THEN
        RAISE EXCEPTION 'Brugeren har ingen sales-profil';
    END IF;

    IF NOT COALESCE(v_is_admin, false)
       AND v_activity.sales_id IS DISTINCT FROM v_sales_id THEN
        RAISE EXCEPTION 'Kun ejeren eller admin kan slette denne aktivitet';
    END IF;

    IF undo THEN
        UPDATE public.customer_activities_lago
           SET deleted_at = NULL,
               updated_at = now()
         WHERE id = activity_id;
    ELSE
        UPDATE public.customer_activities_lago
           SET deleted_at = now(),
               updated_at = now()
         WHERE id = activity_id;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_activity_done(
    activity_id bigint,
    new_date date DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_activity RECORD;
    v_sales_id bigint;
    v_is_admin boolean;
BEGIN
    SELECT company_id, source, sales_id, activity_date, done
      INTO v_activity
      FROM public.customer_activities_lago
     WHERE id = activity_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Aktivitet % findes ikke', activity_id;
    END IF;

    -- Brief 41 §2 (16. sep 2026): source='crm_native'-spærring fjernet.
    -- Se soft_delete_customer_activity ovenfor for begrundelse.

    SELECT id, administrator
      INTO v_sales_id, v_is_admin
      FROM public.sales
     WHERE user_id = auth.uid();

    IF v_sales_id IS NULL THEN
        RAISE EXCEPTION 'Brugeren har ingen sales-profil';
    END IF;

    IF NOT COALESCE(v_is_admin, false)
       AND v_activity.sales_id IS DISTINCT FROM v_sales_id THEN
        RAISE EXCEPTION 'Kun ejeren eller admin kan markere denne aktivitet afholdt';
    END IF;

    IF new_date IS NOT NULL AND new_date > current_date THEN
        RAISE EXCEPTION 'Afholdt-dato kan ikke ligge i fremtiden (%)', new_date;
    END IF;

    UPDATE public.customer_activities_lago
       SET done = true,
           activity_date = COALESCE(new_date, current_date),
           updated_at = now()
     WHERE id = activity_id;
END;
$$;

-- GRANT for begge er allerede sat fra deres oprindelige migrations —
-- kun body'en ændres her. Ingen behov for nye GRANTs.
