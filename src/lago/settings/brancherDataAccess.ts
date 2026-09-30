import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";

/**
 * Brief 53 §3 + Brief 55 tillæg A (17. sep 2026) · brancher_lago.
 *
 * Referenceliste over VISMA-brancher. Læses af alle authenticated,
 * skrives kun af admin (RLS-håndhævet). branche_visma_tekst er den
 * rå streng fra VISMA — branche_kode er FK'en hertil.
 */

export interface Branche {
  kode: number;
  navn: string;
  aktiv: boolean;
  sortering: number;
}

export async function fetchBrancher(): Promise<Branche[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("brancher_lago")
    .select("kode, navn, aktiv, sortering")
    .order("sortering", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Branche[];
}

export async function updateBranche(
  kode: number,
  patch: Partial<Pick<Branche, "navn" | "aktiv" | "sortering">>,
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("brancher_lago")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("kode", kode);
  if (error) throw error;
}

export async function insertBranche(input: {
  kode: number;
  navn: string;
  aktiv?: boolean;
  sortering?: number;
}): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("brancher_lago").insert({
    kode: input.kode,
    navn: input.navn,
    aktiv: input.aktiv ?? true,
    sortering: input.sortering ?? 0,
  });
  if (error) throw error;
}

/** Brief 53 §3b krav 3: distinkte branche_visma_tekst-værdier i
 *  companies_lago der ikke matches til nogen kode. Fjerner "0" og
 *  tomme værdier — de er kendt-tomme og ville fylde listen med støj. */
export interface UmappetBranche {
  vaerdi: string;
  antal: number;
}

export async function fetchUmappedeBrancher(): Promise<UmappetBranche[]> {
  const supabase = getSupabaseClient();
  // Bruger view? nej — direkte query. Fetcher rå distinkte tekster
  // uden kode, tæller pr. tekst. Klienten filtrerer "0" og tomme.
  const { data, error } = await supabase
    .from("companies_lago")
    .select("branche_visma_tekst")
    .not("branche_visma_tekst", "is", null)
    .is("branche_kode", null);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as Array<{ branche_visma_tekst: string }>) {
    const v = (row.branche_visma_tekst ?? "").trim();
    if (!v || v === "0") continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([vaerdi, antal]) => ({ vaerdi, antal }))
    .sort((a, b) => b.antal - a.antal);
}
