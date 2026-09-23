-- Brief 80 (23. sep 2026) — anon kan skrive i vores data
--
-- Supabase Advisors flaggede 16 funktioner som "anon_security_definer_
-- function_executable" — kaldbare uden login via /rest/v1/rpc/<fn>.
-- Blandt dem: update_activity (skriver tekst i besøgsnoter),
-- soft_delete_customer_activity (sletter aktiviteter),
-- derive_sales_id_from_visma (omskriver sælger-ejerskab på alle 1.168
-- kunder), map_branche_kode (omskriver branche på alle kunder).
--
-- Anon-nøglen ligger i JavaScript-bundlen; en vilkårlig person på
-- internettet kunne kalde dem uden konto.
--
-- Fix: fjern EXECUTE-adgangen for anon-rollen på alle funktioner i
-- public. CRM'et kalder kun RPC'er som indlogget bruger (verificeret
-- via grep i src/), så det er en no-op for appen.
--
-- Grant til authenticated bevares — hver funktion har sin egen
-- eksplicitte GRANT TO authenticated i sin oprindelige migration
-- (verificeret i pg_stat_statements-udtrækket 23. sep).
--
-- Bonus: sync_lago_role_to_administrator har mutable search_path
-- (proconfig=null). Det er trigger-funktionen der giver admin-rollen —
-- lav risiko i praksis, men den rigtige at rette først. Sæt fast
-- search_path=public, pg_temp så en injiceret bruger ikke kan omgå den
-- ved at oprette skygge-tabeller i sit eget skema.

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- Fremtidige funktioner: fjern default anon-execute på schema-niveau
-- så nye migrationer ikke genintroducerer problemet
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;

ALTER FUNCTION public.sync_lago_role_to_administrator()
  SET search_path = public, pg_temp;
