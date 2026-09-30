-- Brief 39 (16. sep 2026): Debitorinfo-kolonne på companies_lago.
--
-- Kundeudtrækket bærer nu en "Debitorinfo"-kolonne (tidligere hed
-- feltet "Oplysning 7", som viste sig udgået). Feltet er fri tekst,
-- typisk kort — noter om debitor-forhold, betalingsvaner, kontakt-
-- referencer. VISMA er master; gemmes i companies_lago-sidecar-tabellen
-- da companies-tabellen ikke har et frit tekst-noter-felt vi bør
-- overtage.
--
-- Additiv, ikke destruktiv: ADD COLUMN IF NOT EXISTS. Ingen eksisterende
-- data røres. Kolonnen forbliver NULL indtil næste kundeimport skriver
-- den — importen kl. 23.59 i dag bringer det første indhold.

ALTER TABLE public.companies_lago
    ADD COLUMN IF NOT EXISTS debitorinfo text;

COMMENT ON COLUMN public.companies_lago.debitorinfo IS
    'Brief 39: fri tekst fra VISMA Kundeudtrækkets Debitorinfo-kolonne. Tidligere kaldt Oplysning 7 (udgået).';
