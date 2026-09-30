import { useCallback, useRef, useState } from "react";
import { z } from "zod";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";
import { readEdgeFunctionError } from "@/lago/ui/errorMessage";

/**
 * Brief 21 (AI-3) · useForslagFraNote
 *
 * Kalder ai-adapter Edge Function for at faa 0-3 forslag ud af en
 * besoegsnote. Sikkerhedsnettet er tre lag:
 *
 *  1. 6s AbortController-timeout — brief siger "over 6 sekunder = giv op".
 *     Sker det bare én gang under felt-testen, at en saelger star hos en
 *     kunde og kigger paa en spinner, har vi tabt bade AI'en og CRM'et.
 *
 *  2. Zod-validering af svaret — modellen SKAL svare i det format prompten
 *     bad om. Alt andet kasseres stille. Bruger ser aldrig en raa fejl.
 *
 *  3. Kaldet er *aldrig* blokkerende — komponenten renderer sit svar-state
 *     ved siden af "Gem besoeg"-knappen, som ejer sin egen livscyklus.
 *     Den knap venter aldrig paa denne hook.
 */

export const NOTE_MIN_LENGTH = 40;
export const TIMEOUT_MS = 6000;
const PROMPT_ROLE = "udtraek_fra_besoegsnote";
const PROMPT_VERSION = "v1";

const forslagSchema = z.object({
  type: z.enum(["opgave", "opfoelgning"]),
  tekst: z.string().min(1).max(80),
  dato: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  grundlag: z.string().min(1).max(200),
});

const svarSchema = z.object({
  forslag: z.array(forslagSchema).max(3),
});

export type Forslag = z.infer<typeof forslagSchema>;

export type ForslagState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ready";
      forslag: Forslag[];
      /**
       * Tillæg 21A: id på llm_calls-rækken bag dette svar. Bruges når
       * besøget gemmes til at (a) binde de tilføjede tasks tilbage via
       * ai_llm_call_id, og (b) rapportere added/rejected/ignored-tal
       * via record_ai_suggestion_outcomes-RPC. Null hvis Edge Function
       * ikke kunne skrive audit-rækken — så måler vi bare ikke dette
       * kald (ikke-fatal, se audit.ts).
       */
      llmCallId: number | null;
    }
  | { status: "error"; reason: "timeout" | "invalid" | "network" };

interface HentForslagArgs {
  note: string;
  companyId: number;
  salesId: number | null;
}

export function useForslagFraNote() {
  const [state, setState] = useState<ForslagState>({ status: "idle" });
  const inFlight = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    inFlight.current?.abort();
    inFlight.current = null;
    setState({ status: "idle" });
  }, []);

  const hentForslag = useCallback(async (args: HentForslagArgs) => {
    // Anmodninger kan overlappe hvis brugeren trykker to gange — annuller
    // en gammel foer vi starter en ny.
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    setState({ status: "loading" });

    const timeout = setTimeout(() => controller.abort("timeout"), TIMEOUT_MS);

    const supabase = getSupabaseClient();
    const dagsdato = new Date().toISOString().slice(0, 10);
    const inputJson = JSON.stringify({ dagsdato, note: args.note.trim() });

    try {
      const { data, error } = await supabase.functions.invoke("ai-adapter", {
        body: {
          role: PROMPT_ROLE,
          version: PROMPT_VERSION,
          input: inputJson,
          company_id: args.companyId,
          sales_id: args.salesId,
        },
      });

      clearTimeout(timeout);
      if (controller.signal.aborted) {
        // Bruger har enten reset'et eller vi ramte timeout.
        // Ignorer svar — state er sat af aborten selv.
        return;
      }
      inFlight.current = null;

      if (error || !data || typeof data !== "object" || !("text" in data)) {
        // Brief 42-eftersyn (16. sep 2026): AI-3 er det, felttesten
        // måler. Uden diagnostik-log ser vi bare "sælgerne ignorerede
        // forslagene" efter to uger — når sandheden kan være at
        // kaldene aldrig kom igennem. readEdgeFunctionError pakker
        // response-body'en ud af FunctionsHttpError'ens context.
        if (error) {
          try {
            const detail = await readEdgeFunctionError(error);
            console.error("[AI-3] ai-adapter fejlede:", detail);
          } catch {
            console.error("[AI-3] ai-adapter fejlede (uden context)");
          }
        } else {
          console.error("[AI-3] ai-adapter returnerede uden text-felt", data);
        }
        setState({ status: "error", reason: "network" });
        return;
      }

      const raw = (data as { text: unknown }).text;
      if (typeof raw !== "string") {
        console.error("[AI-3] ai-adapter returnerede non-string text", raw);
        setState({ status: "error", reason: "invalid" });
        return;
      }

      const parsed = tryParseSvar(raw);
      if (!parsed) {
        console.error("[AI-3] ai-adapter returnerede ugyldig JSON-form", raw);
        setState({ status: "error", reason: "invalid" });
        return;
      }

      // Tillæg 21A: bær llm_call_id videre. Edge Function returnerer
      // det efter et gennemført kald. Kan være null hvis audit-insertet
      // fejlede — så mister vi målingen for dette kald, ikke selve
      // forslagene.
      const rawId = (data as { llm_call_id?: unknown }).llm_call_id;
      const llmCallId = typeof rawId === "number" ? rawId : null;

      setState({
        status: "ready",
        forslag: parsed.forslag,
        llmCallId,
      });
    } catch (e) {
      clearTimeout(timeout);
      inFlight.current = null;
      if (controller.signal.aborted) {
        setState({ status: "error", reason: "timeout" });
        return;
      }
      // Ellers netvaerks-/uventet fejl. Bruger ser blot "kunne ikke hente".
      // Ingen raa fejl-tekst — det er ikke saelgerens problem.
      void e;
      setState({ status: "error", reason: "network" });
    }
  }, []);

  return { state, hentForslag, reset };
}

function tryParseSvar(raw: string): z.infer<typeof svarSchema> | null {
  // Modellen kan i sjældne tilfaelde wrappe JSON i ```json ... ``` selvom
  // prompten forbyder det. Vi trimmer det, men accepterer ikke andet stoej.
  const trimmed = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  let json: unknown;
  try {
    json = JSON.parse(trimmed);
  } catch {
    return null;
  }
  const parsed = svarSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}
