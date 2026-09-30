-- Brief 29 (16. sep 2026): kontaktpersoner ind i CRM'et via engangsimport.
--
-- Fem nye kolonner på contacts_lago:
--
--   is_webshop_user   Webkunde-flag fra VISMA. 182 af 528 kontakter er
--                     webshop-brugere; kontakt-visningen skal bære et
--                     mærkat ("adgang styres i VISMA") så en sælger ikke
--                     tror at han lukker et login ved at rette kontakten.
--
--   visma_created_by  DQ-5 forærende: hvem oprettede rækken i VISMA og
--   visma_created_at  hvornår. Kan ikke rekonstrueres senere. Ingen
--   visma_updated_by  visning bygges nu — Simon får dem som råtal.
--   visma_updated_at
--
-- Ingen ny tabel — visma_aktoer_nr sidder allerede på contacts_lago fra
-- Domain-brief 6. Denne migration er additiv og påvirker ingen upstream
-- rækker.

ALTER TABLE public.contacts_lago
    ADD COLUMN IF NOT EXISTS is_webshop_user  boolean,
    ADD COLUMN IF NOT EXISTS visma_created_by text,
    ADD COLUMN IF NOT EXISTS visma_created_at timestamptz,
    ADD COLUMN IF NOT EXISTS visma_updated_by text,
    ADD COLUMN IF NOT EXISTS visma_updated_at timestamptz;

COMMENT ON COLUMN public.contacts_lago.is_webshop_user IS
  'Brief 29 §2 · VISMA Webkunde-flag. True = kontakten har et webshop-login. Kontakt-visningen viser et mærkat om at adgangen styres i VISMA — ikke i CRM''et. Sæt hverken TRUE eller FALSE fra CRM-flow''et: kun VISMA-importen skriver til feltet.';
