-- Brief 57 §1 (17. sep 2026) · app_state_lago — driftstilstand som data.
--
-- Én række, altid id=1. Vedligeholdelsestilstand slås til/fra via UPDATE
-- fra Indstillinger (admin-only via RLS). Kan LÆSES af enhver
-- authenticated bruger — så MaintenanceGate kan spørge tabellen hvert
-- 30. sekund uden at kræve særlige rettigheder.
--
-- 🔴 URØRLIG for funktionsmigrationer. Hele pointen er at tabellen kan
-- læses mens alt andet er under ombygning. Rører en migration den her,
-- kan brugerne ikke se skærmen der siger "vi bygger". Skriv aldrig
-- ALTER, DROP, TRUNCATE eller RENAME på app_state_lago i en anden
-- migration end en, der EKSPLICIT handler om driftstilstanden.

CREATE TABLE IF NOT EXISTS public.app_state_lago (
    id             int PRIMARY KEY DEFAULT 1,
    vedligehold    boolean NOT NULL DEFAULT false,
    besked         text,
    slutter        timestamptz,
    slaaet_til_af  bigint REFERENCES public.sales(id) ON DELETE SET NULL,
    slaaet_til     timestamptz,
    CONSTRAINT app_state_lago_single_row CHECK (id = 1)
);

COMMENT ON TABLE public.app_state_lago IS
'Brief 57 (17. sep 2026) · driftstilstand. UROERLIG for funktionsmigrationer — bruges af MaintenanceGate til at vise vedligeholdelsesskaerm mens andre tabeller er under ombygning. Rores tabellen af en migration, kan brugerne ikke se skaermen der siger "vi bygger".';

-- Seed én række så SELECT altid returnerer noget. UPDATE bruges herefter,
-- aldrig INSERT (CHECK-constraint forhindrer id != 1 alligevel).
INSERT INTO public.app_state_lago (id, vedligehold)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.app_state_lago ENABLE ROW LEVEL SECURITY;

-- Enhver authenticated bruger må læse — MaintenanceGate poller hvert
-- 30. sekund uden bruger-specifik rettighed.
DROP POLICY IF EXISTS "Authenticated read app_state_lago"
    ON public.app_state_lago;
CREATE POLICY "Authenticated read app_state_lago"
    ON public.app_state_lago
    FOR SELECT
    TO authenticated
    USING (true);

-- Kun admin må slå til/fra. lago_role='admin' er den kanoniske check
-- (samme som brief 27's is_lago_admin()-mønster).
DROP POLICY IF EXISTS "Admin update app_state_lago"
    ON public.app_state_lago;
CREATE POLICY "Admin update app_state_lago"
    ON public.app_state_lago
    FOR UPDATE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.sales
         WHERE sales.user_id = auth.uid()
           AND sales.lago_role = 'admin'
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.sales
         WHERE sales.user_id = auth.uid()
           AND sales.lago_role = 'admin'
      )
    );

-- INSERT/DELETE er blokeret. Én række, altid. Sikret via manglende
-- policy — RLS default er deny.
