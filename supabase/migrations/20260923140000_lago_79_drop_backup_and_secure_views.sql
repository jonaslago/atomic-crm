-- Brief 79 + tillæg A (23. sep 2026)
--
-- Supabase Advisors flaggede `lago_last_visit_backup_20260919` som CRITICAL
-- den 19. sep — tabel uden RLS i public-skemaet, læsbar via anon-nøglen.
-- Målt via pg_stat_user_tables: 3 seq_scans (alle admin-queries), 0
-- opdateringer, 0 sletninger — ingen udenforstående adgang. De 1.167
-- rækker er eksporteret til lago/security-audit_2026-09-23/ (CSV + JSON)
-- så rollback-muligheden overlever. Tabellen droppes.
--
-- Samme migration sætter `security_invoker=on` på seks LAGO-views. I dag
-- er det en no-op fordi alle SELECT-policies bruger `qual=true` (enhver
-- indlogget bruger må læse alt). Men fra 29. sep indfører vi begrænsende
-- sletteregler — bliver viewsene stående som SECURITY DEFINER, omgår de
-- de nye politikker. Ændringen er gratis nu, dyr efter 29. sep.
--
-- init_state urørt (Atomic CRM's egen, security_invoker=off med vilje,
-- sat i 20240808141826_init_state_configure.sql).

DROP TABLE IF EXISTS public.lago_last_visit_backup_20260919;

ALTER VIEW public.customers_with_priority_lago SET (security_invoker = on);
ALTER VIEW public.lago_activity_log             SET (security_invoker = on);
ALTER VIEW public.v_open_orders_categorised     SET (security_invoker = on);
ALTER VIEW public.v_sales_customer_periods      SET (security_invoker = on);
ALTER VIEW public.v_sales_district_periods      SET (security_invoker = on);
ALTER VIEW public.v_customer_activity_status    SET (security_invoker = on);
