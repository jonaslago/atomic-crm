import { useQuery } from "@tanstack/react-query";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";

import { WidgetShell } from "../WidgetShell";

/**
 * Datakvalitet (brief 86 §8 · 28. sep 2026, rev. samme dag efter brief
 * 90-runde).
 *
 * Ét tal i bunden af ledelsens skærm: hvor mange DISTINKTE kunder
 * mangler oplysninger. Første version viste sum af de fire hul-filtre
 * (175), men en kunde kan mangle både segment, kontaktperson og adresse
 * — så 175 var hverken kunder eller registreringer. Overlap-tallet
 * (sum − distinkt) fortæller hvor mange dobbelt-tællinger der er.
 *
 * Ordet "registreringer" er væk: en registrering er en aktivitet (et
 * besøg, et opkald). Her er det huller i kartoteket, ikke i aktivitets-
 * loggen. At bruge samme ord om begge dele gør at ingen stoler på
 * tallene.
 *
 * Kilde: dashboard_datahuller_lago RPC. Payload har både `counts` (fire
 * filtre) og `distinkte_kunder`. Widget'en viser det distinkte tal stort
 * og summen som ordforklaring under.
 */

type HullType = "uden_ejer" | "uden_kontakt" | "uden_adresse" | "uden_segment";

interface Payload {
  counts: Record<HullType, number>;
  distinkte_kunder: number;
}

async function fetchDatakvalitet(): Promise<Payload> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("dashboard_datahuller_lago");
  if (error) throw error;
  const payload = data as Payload | null;
  return {
    counts: payload?.counts ?? {
      uden_ejer: 0,
      uden_kontakt: 0,
      uden_adresse: 0,
      uden_segment: 0,
    },
    distinkte_kunder: payload?.distinkte_kunder ?? 0,
  };
}

export function DatakvalitetWidget() {
  const query = useQuery({
    queryKey: ["lago-datakvalitet-distinkt"],
    queryFn: fetchDatakvalitet,
    staleTime: 5 * 60_000,
  });

  const distinkt = query.data?.distinkte_kunder ?? 0;
  const sum = query.data
    ? Object.values(query.data.counts).reduce((a, b) => a + b, 0)
    : 0;
  const overlap = sum - distinkt;

  return (
    <WidgetShell
      title="Datakvalitet"
      subtitle="Kunder med huller i kartoteket"
      isLoading={query.isPending}
      error={query.error as Error | null}
      isEmpty={false}
    >
      <div className="flex items-baseline gap-3">
        <div className="text-4xl font-bold tabular-nums text-[var(--fg)]">
          {distinkt}
        </div>
        <div className="text-sm text-[var(--fg-2)]">
          {distinkt === 1 ? "kunde mangler oplysninger" : "kunder mangler oplysninger"}
        </div>
      </div>
      {sum > 0 && (
        <div className="mt-2 text-xs text-[var(--fg-3)]">
          {sum} tællinger over fire filtre · {overlap} kunder rammes af flere huller
        </div>
      )}
    </WidgetShell>
  );
}
