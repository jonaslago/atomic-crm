-- §101-1 fix: RPC anchor must be GLOBAL, not per customer.
--
-- LAGO's last invoicing day is one date, the same for all customers.
-- A customer who last bought in March must still be measured against
-- the same anchor as everyone else — otherwise each customer is on
-- its own calendar.

CREATE OR REPLACE FUNCTION public.sales_ytd_for_customer(
    p_customer_no text,
    p_current_year int,
    p_last_year int,
    p_through_month int
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH global_anchor AS (
    -- One date for everyone: LAGO's last invoicing day
    SELECT COALESCE(MAX(fakturadato), current_date) AS d
    FROM sales_monthly_lago
  )
  SELECT jsonb_build_object(
    'ytd_this_year', COALESCE((
      SELECT SUM(belob) FROM sales_monthly_lago
      WHERE visma_customer_no = p_customer_no
        AND fakturadato BETWEEN make_date(p_current_year, 1, 1)
                             AND (SELECT d FROM global_anchor)
    ), 0),
    'ytd_last_year', COALESCE((
      SELECT SUM(belob) FROM sales_monthly_lago
      WHERE visma_customer_no = p_customer_no
        AND fakturadato BETWEEN make_date(p_last_year, 1, 1)
                             AND ((SELECT d FROM global_anchor) - INTERVAL '1 year')::date
    ), 0),
    'has_any_history', EXISTS (
      SELECT 1 FROM sales_monthly_lago
      WHERE visma_customer_no = p_customer_no
      LIMIT 1
    ),
    'anchor_date', (SELECT d FROM global_anchor)
  );
$$;

-- v_customer_activity_status: add comment explaining why whole-year
-- comparison is correct here (so nobody "fixes" it to day-grain).
COMMENT ON VIEW public.v_customer_activity_status IS
'Inaktiv (bought >belob_min in vindue_aar years, 0 in T12M) + ny_i_aar. '
'Uses WHOLE-YEAR comparison (aar_int), NOT day-grain ÅTD. This is intentional: '
'ny_i_aar asks "did the customer buy anything at all last year?" — a binary '
'yes/no over 12 months. Day-grain would falsely mark customers as "new" in '
'January before anyone has invoiced. Same for inaktiv: T12M is the activity '
'window, not a YTD comparison. Do not change to fakturadato-based ÅTD.';
