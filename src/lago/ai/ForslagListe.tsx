import { Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

import { Icon } from "@/lago/ui/Icon";
import { ForslagKort, type AktivtForslag } from "./ForslagKort";
import {
  NOTE_MIN_LENGTH,
  useForslagFraNote,
  type Forslag,
} from "./useForslagFraNote";

/**
 * Brief 21 · "Foreslaa opfoelgninger"-panel under notefeltet i
 * RegistrerModal (Besoeg-fanen).
 *
 * Sekvensen brugeren ser:
 *
 *  1. Note under 40 tegn → knap disabled med hint.
 *  2. Note >= 40 tegn → knap aktiv.
 *  3. Klik → spinner (op til 6s). "Gem besoeg" er stadig aktiv hele
 *     vejen — den venter aldrig paa AI'en.
 *  4. Svar med 0 forslag → daempet linje.
 *  5. Svar med 1-3 forslag → kort med Tilfoej/Afvis. Tilfoejede kort
 *     bliver redigerbare og rapporteres til onChange saa RegistrerModal
 *     kan skrive dem sammen med besoeget.
 *  6. Fejl/timeout → daempet linje, ingen raa fejl.
 *
 * onChange kaldes hver gang listen af *tilfoejede* forslag aendrer sig.
 * RegistrerModal ejer state og sender med til Gem besoeg.
 */

/**
 * Tillæg 21A: rapportér ikke bare de tilføjede forslag, men også
 * llm_call_id + optælling af tilføjet/afvist/ignoreret ved gem-tid.
 * Ignoreret = forslag som stadig er "usaet" når besøget gemmes. Den
 * kategori er den vigtigste og den, der let bliver glemt — et forslag
 * ingen forholder sig til er hverken accepteret eller afvist, det er
 * overset. Er der mange af dem, er problemet placeringen eller
 * formuleringen, ikke kvaliteten.
 */
export interface AiRunSummary {
  llmCallId: number | null;
  returned: number;
  added: number;
  rejected: number;
  ignored: number;
}

interface Props {
  note: string;
  companyId: number;
  salesId: number | null;
  onChange: (aktive: AktivtForslag[], summary: AiRunSummary) => void;
}

type ItemStatus = "usaet" | "tilfoejet" | "afvist";

interface Item {
  key: string;
  forslag: Forslag;
  status: ItemStatus;
  aktiv?: AktivtForslag;
}

const EMPTY_SUMMARY: AiRunSummary = {
  llmCallId: null,
  returned: 0,
  added: 0,
  rejected: 0,
  ignored: 0,
};

function buildSummary(items: Item[], llmCallId: number | null): AiRunSummary {
  let added = 0;
  let rejected = 0;
  let ignored = 0;
  for (const it of items) {
    if (it.status === "tilfoejet") added++;
    else if (it.status === "afvist") rejected++;
    else ignored++;
  }
  return {
    llmCallId,
    returned: items.length,
    added,
    rejected,
    ignored,
  };
}

export function ForslagListe({ note, companyId, salesId, onChange }: Props) {
  const { state, hentForslag, reset } = useForslagFraNote();
  const [items, setItems] = useState<Item[]>([]);

  const noteReady = note.trim().length >= NOTE_MIN_LENGTH;
  const loading = state.status === "loading";
  const llmCallId = state.status === "ready" ? state.llmCallId : null;

  const hent = useCallback(async () => {
    reset();
    setItems([]);
    onChange([], EMPTY_SUMMARY);
    await hentForslag({ note, companyId, salesId });
  }, [note, companyId, salesId, hentForslag, reset, onChange]);

  // Naar hook'en er faerdig, hydrer items fra svar. useEffect med
  // state.status som dep-vaerdi saa vi kun hydrer én gang pr. svar.
  useEffect(() => {
    if (state.status !== "ready") return;
    const initial: Item[] = state.forslag.map((f, i) => ({
      key: `f${i}`,
      forslag: f,
      status: "usaet",
    }));
    setItems(initial);
    // Nyt svar = ingen tilfoejede endnu; underret RegistrerModal og
    // rapportér summary (returned=N, alle usaet → ignoreret hvis
    // besoeget gemmes med det samme).
    onChange([], buildSummary(initial, state.llmCallId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  const opdaterItem = (key: string, patch: Partial<Item>) => {
    setItems((prev) => {
      const næste = prev.map((it) =>
        it.key === key ? { ...it, ...patch } : it,
      );
      const aktive = næste
        .filter((it) => it.status === "tilfoejet" && it.aktiv)
        .map((it) => it.aktiv as AktivtForslag);
      onChange(aktive, buildSummary(næste, llmCallId));
      return næste;
    });
  };

  return (
    <div className="rounded-md border border-dashed border-[var(--line-strong)] bg-[var(--surface-2)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon icon={Sparkles} size="sm" className="text-[var(--a-deep)]" />
          <span className="text-sm font-bold">AI-forslag</span>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={hent}
          disabled={!noteReady || loading}
          className="min-h-11 gap-1.5"
          title={
            !noteReady
              ? `Skriv mindst ${NOTE_MIN_LENGTH} tegn i noten`
              : undefined
          }
        >
          {loading ? (
            <Icon icon={Loader2} size="sm" className="animate-spin" />
          ) : (
            <Icon icon={Sparkles} size="sm" />
          )}
          Foreslå opfølgninger
        </Button>
      </div>

      {state.status === "idle" && !noteReady && (
        <p className="text-muted-foreground mt-2 text-sm">
          Skriv mindst {NOTE_MIN_LENGTH} tegn i noten, så kan AI hjælpe
          med at finde opfølgninger.
        </p>
      )}

      {state.status === "error" && (
        <p className="text-muted-foreground mt-2 text-sm italic">
          Kunne ikke hente forslag. Registrér besøget som normalt.
        </p>
      )}

      {state.status === "ready" && items.length === 0 && (
        <p className="text-muted-foreground mt-2 text-sm italic">
          Ingen oplagte opfølgninger i noten.
        </p>
      )}

      {items.length > 0 && (
        <ul className="mt-3 space-y-2">
          {items
            .filter((it) => it.status !== "afvist")
            .map((it) => (
              <li key={it.key}>
                <ForslagKort
                  forslag={it.forslag}
                  status={it.status === "tilfoejet" ? "tilfoejet" : "usaet"}
                  onTilfoej={(aktiv) =>
                    opdaterItem(it.key, { status: "tilfoejet", aktiv })
                  }
                  onAfvis={() => opdaterItem(it.key, { status: "afvist" })}
                  onOpdater={(aktiv) => opdaterItem(it.key, { aktiv })}
                />
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
