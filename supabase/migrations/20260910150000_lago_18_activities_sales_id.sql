-- LAGO Domain-brief 20 pkt 12 — customer_activities_lago: sales_id FK
-- i stedet for sales_name-tekst.
--
-- Aktivitets-tælleren i "Min status denne uge" er præcis det tal
-- felt-testen skal måle. En tekstmatch (sales_name) giver stille
-- undertælling så snart et navn redigeres — så vi kan ikke måle det
-- ene, testen handler om, med den mekanik.
--
-- Bootstrap: forsøg at slå eksisterende sales_name op i public.sales
-- (via first_name + " " + last_name) og udfyld sales_id hvor der er et
-- entydigt match. Rows uden match bevarer sales_name (som fallback for
-- historiske rækker fra før felt-testen).
--
-- sales_name-kolonnen beholdes IKKE dropped — der kan være historiske
-- rækker (fx VISMA-importerede) uden CRM-bruger-modstykke. Den er
-- fremover en "hvis-alt-svigter"-tekst; sales_id er sandheden.

ALTER TABLE public.customer_activities_lago
    ADD COLUMN IF NOT EXISTS sales_id bigint
        REFERENCES public.sales (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS customer_activities_lago_sales_id_idx
    ON public.customer_activities_lago (sales_id)
    WHERE sales_id IS NOT NULL;

-- Bootstrap: sæt sales_id hvor sales_name matcher ét enkelt CRM-login.
-- Vi matcher case-insensitivt på first_name + " " + last_name.
UPDATE public.customer_activities_lago ca
   SET sales_id = s.id
  FROM public.sales s
 WHERE ca.sales_id IS NULL
   AND ca.sales_name IS NOT NULL
   AND lower(ca.sales_name) = lower(trim(coalesce(s.first_name, '') || ' ' || coalesce(s.last_name, '')))
   AND NOT EXISTS (
       -- Kun opdatér ved ENTYDIGT match (undgå at knytte forkert)
       SELECT 1 FROM public.sales s2
        WHERE s2.id <> s.id
          AND lower(trim(coalesce(s2.first_name, '') || ' ' || coalesce(s2.last_name, ''))) = lower(ca.sales_name)
   );
