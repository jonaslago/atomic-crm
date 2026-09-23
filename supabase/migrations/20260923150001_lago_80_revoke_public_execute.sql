-- Brief 80 tillæg (23. sep 2026) — REVOKE FROM anon rakte ikke langt nok
--
-- Efter den første revoke havde 17 funktioner stadig anon-execute — via
-- default GRANT TO PUBLIC-rollen (anon er medlem af PUBLIC). Blandt dem:
-- merge_contacts(loser_id, winner_id) som SKRIVER (merger to kontakter).
-- Trigger-funktioner var også flagget, men kan ikke kaldes som RPC.
--
-- Fix: REVOKE ON ALL FUNCTIONS ... FROM PUBLIC. Alle callable funktioner
-- har allerede eksplicit `GRANT TO authenticated` (verificeret i pg_proc.
-- proacl), så authenticated bevares uændret. Triggers er ikke berørt af
-- funktion-execute-privilege — trigger-mekanismen kalder dem separat.

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
