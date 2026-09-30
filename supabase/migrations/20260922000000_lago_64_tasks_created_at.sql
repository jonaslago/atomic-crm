-- Brief 64 §0 (18. sep 2026) · tasks.created_at
--
-- Additiv kolonne. Nullable — så eksisterende rækker BEHOLDER NULL og
-- er ærlige: "vi ved ikke hvornår denne task blev oprettet". Default
-- sættes SEPARAT så fremtidige inserts får now(), men gamle ikke
-- stemples med dagens dato (det ville være et gæt maskeret som fakta).
--
-- Baggrund: AI-3 gøres op 1. oktober på spørgsmålet "hvornår blev
-- opfølgningen oprettet?". Vi kunne kun svare med id-rækkefølge indtil
-- nu. Fremadrettet svarer created_at direkte; historiske rækker forbliver
-- ærligt tomme.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

ALTER TABLE public.tasks
  ALTER COLUMN created_at SET DEFAULT now();

COMMENT ON COLUMN public.tasks.created_at IS
'Brief 64 (18. sep 2026): oprettelsestidspunkt. NULL for raekker fra foer denne migration (18. sep 2026) — vi ved ikke hvornaar de blev oprettet, og et gaet ville staa i modstrid med "vi ved det ikke skal kunne skelnes fra vi ved det". Nye raekker faar now() via kolonne-default.';
