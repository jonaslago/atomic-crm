-- §24 (1. okt 2026): trigger must require done = true.
--
-- A planned visit whose date has passed without registration is an
-- overdue plan, not a visit. Only a completed activity counts.

CREATE OR REPLACE FUNCTION public.trg_recompute_last_visit_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id bigint;
    v_max_date date;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_company_id := OLD.company_id;
    ELSE
        v_company_id := NEW.company_id;
    END IF;

    IF v_company_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Only COMPLETED visits (done=true, type 1, on or before today).
    -- A planned visit (done=false) with a past date is overdue, not done.
    SELECT MAX(a.activity_date)
      INTO v_max_date
      FROM public.customer_activities_lago a
     WHERE a.company_id = v_company_id
       AND a.activity_type_code = 1
       AND a.deleted_at IS NULL
       AND a.done = true
       AND a.activity_date <= current_date;

    UPDATE public.companies_lago cl
       SET last_visit_at = CASE
               WHEN v_max_date IS NULL THEN NULL
               ELSE (v_max_date::text || ' 12:00:00+00')::timestamptz
           END,
           updated_at = now()
     WHERE cl.company_id = v_company_id;

    RETURN NULL;
END;
$$;

-- Restore the 7 soft-deleted past-dated plans as overdue plans (done=false).
UPDATE public.customer_activities_lago
SET deleted_at = NULL,
    done = false
WHERE id IN (1445, 1448, 1441, 1438, 1446, 1447, 1439);
