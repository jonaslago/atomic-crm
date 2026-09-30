import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetIdentity } from "ra-core";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";
import {
  createCompanyNote,
  createTask,
} from "@/lago/customers/dataAccess";
import { useViewSalesId } from "@/lago/portefolje/PortefoljeContext";
import { readErrorMessage } from "@/lago/ui/errorMessage";
import { BESOEG_CODE } from "./types";

// ---------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------

interface Identity {
  id?: number | string;
  fullName?: string;
}

function readIdentitySalesName(identity: Identity | undefined | null): string | null {
  if (!identity) return null;
  const first = (identity as { firstName?: string }).firstName ?? "";
  const last = (identity as { lastName?: string }).lastName ?? "";
  const composed = `${first} ${last}`.trim();
  return composed || identity.fullName || null;
}

function readIdentitySalesId(identity: Identity | undefined | null): number | null {
  if (!identity) return null;
  const raw = identity.id;
  return typeof raw === "number" ? raw : null;
}

interface CommonCtx {
  companyId: number;
  companyName: string;
}

// ---------------------------------------------------------------------
// Cache invalidations (shared)
// ---------------------------------------------------------------------

export function useInvalidateAfterWrite() {
  const qc = useQueryClient();
  return (companyId: number) => {
    qc.invalidateQueries({ queryKey: ["lago-felt-customers"] });
    qc.invalidateQueries({ queryKey: ["lago-customer-list"] });
    qc.invalidateQueries({ queryKey: ["lago-customer", companyId] });
    qc.invalidateQueries({ queryKey: ["lago-soeg-notes"] });
    // Brief 16. sep 2026: hvis en kontakt er oprettet inline (fra
    // ContactsCard eller Opgave-formen), skal Registrér-modalens
    // kontakt-liste også genopfriskes så den nye person straks
    // dukker op i "Hvem?"-vælgeren.
    qc.invalidateQueries({ queryKey: ["lago-registrer-contacts", companyId] });
  };
}

// ---------------------------------------------------------------------
// Besøg
// ---------------------------------------------------------------------

export interface RegisterBesoegInput extends CommonCtx {
  dateIso: string; // YYYY-MM-DD
  description: string | null;
  /** Optional "udført af" — falls back to current identity when null. */
  performedByName?: string | null;
  /** Brief 61 (17. sep 2026): salgs-id på udføreren. Sættes altid når
   *  performer-vælgeren har en kendt sælger (dvs. reelt altid — sælgeren
   *  vælger sig selv fra listen). Uden dette blev sales_id NULL på
   *  hver CRM-native aktivitet, og "Sælgernes uge" kunne ikke matche
   *  Peters besøg til Peters sales_id. */
  performedBySalesId?: number | null;
  /** Brief 21 (AI-3): tilfoejede AI-forslag skrives som tasks knyttet
   *  til foerste kontakt paa kunden. Kraever mindst én kontakt — uden
   *  én kan tasks ikke oprettes, saa forslagene droppes stille med en
   *  advarsel-toast. Ellers skulle vi udvide `tasks`-tabellen til at
   *  tillade company_id, hvilket rammer alle andre task-flow.
   *
   *  Tillæg 21A: hvert forslag bærer nu den oprindelige AI-tekst/dato
   *  + edited-flag. Persisteres på tasks.ai_original_text/
   *  ai_original_due_date/ai_edited, så en post-hoc rapport kan svare
   *  på om forslagene blev omskrevet — ikke bare accepteret. */
  aiForslag?: Array<{
    type: "opgave" | "opfoelgning";
    tekst: string;
    dato: string | null; // YYYY-MM-DD
    original_tekst: string;
    original_dato: string | null;
    edited: boolean;
  }>;
  /** Foerste kontakt-id paa kunden. Bruges kun til aiForslag; besoeget
   *  selv er ikke bundet til en kontakt. */
  primaryContactId?: number | null;
  /** Brief 40 (16. sep 2026): flag der lader advarslen skelne mellem
   *  "kunden har reelt ingen kontakter" og "vi kunne ikke indlæse dem".
   *  Uden det tolker mutation en null-primaryContactId som "kunden er
   *  tom", hvilket producerede en usand advarsel hver gang kontakt-
   *  opslaget aldrig kørte. Standard true = antag der findes kontakter
   *  (den mindre skadelige antagelse hvis caller glemmer flaget). */
  hasCustomerContacts?: boolean;
  /** Brief 40: sat af BesoegForm når contactsQuery fejlede. Skifter
   *  advarslen fra "kunden har ingen kontakter" til "kunne ikke
   *  indlæse kontakter" — sælgeren skal vide hvad han skal gøre. */
  contactsFetchFailed?: boolean;
  /** Brief 40 tillæg A (16. sep 2026): manuelle opfølgninger tilføjet
   *  via FollowUpBuilder under notefeltet. Skrives som tasks bundet til
   *  primaryContactId — samme kode-sti som aiForslag, blot uden
   *  `ai_llm_call_id` (fravær = manuel oprindelse, se
   *  ForslagListe-tilføjelseskoden i insertPayload nedenfor). */
  manualFollowUps?: Array<{
    text: string;
    dueDateIso: string | null;
    assigneeSalesId: number | null;
  }>;
  /** Tillæg 21A: hele AI-kaldets udfald. Rapporteres via RPC
   *  record_ai_suggestion_outcomes så vi kan svare "af de 3 forslag
   *  AI'en gav, blev 1 tilføjet, 1 afvist og 1 overset". Null =
   *  sælgeren trykkede aldrig "Foreslå opfølgninger" eller kaldet
   *  fejlede — så er der intet at rapportere. */
  aiSummary?: {
    llmCallId: number | null;
    returned: number;
    added: number;
    rejected: number;
    ignored: number;
  } | null;
}

export function useRegisterBesoeg() {
  const { data: identity } = useGetIdentity();
  // Brief 84 §4 (28. sep 2026): under dækning = Camilla; ellers = actor.
  // Bruges KUN til AI-forslag task-inserts (assignee), IKKE til selve
  // aktivitetens sales_id — den forbliver actor (§1).
  const viewSalesId = useViewSalesId();
  const invalidate = useInvalidateAfterWrite();

  return useMutation({
    mutationFn: async (input: RegisterBesoegInput) => {
      const supabase = getSupabaseClient();
      const salesName =
        input.performedByName ?? readIdentitySalesName(identity);
      // Brief 61 (17. sep 2026): sales_id sættes altid når vi kender den.
      // Performer-vælgeren giver den for "udført af"-tilfælde (typisk
      // sælgeren selv fra listen); identity giver den ellers. Uden
      // eksplicit performedBySalesId falder vi tilbage til identity.
      // Tidligere satte vi NULL når performedByName var udfyldt — det
      // gjorde "Sælgernes uge"-widget'en blind for alle CRM-native
      // registreringer (widgeten filtrerer på sales_id IN (…)).
      const salesId =
        input.performedBySalesId ?? readIdentitySalesId(identity);
      const insertRes = await supabase
        .from("customer_activities_lago")
        .insert({
          company_id: input.companyId,
          activity_date: input.dateIso,
          activity_type_code: BESOEG_CODE,
          activity_type: "Besøg",
          description: input.description,
          sales_name: salesName,
          sales_id: salesId,
          done: true,
          source: "crm_native",
        })
        .select("id")
        .single<{ id: number }>();
      if (insertRes.error) throw insertRes.error;
      const activityId = insertRes.data.id;

      // Brief 15 (FS-20): et registreret besøg opfylder den planlagte
      // booking — ryd next_visit_planned + note + tildeling så badgen
      // slukker og planen ikke bliver hængende på Min dag.
      //
      // Brief 16. sep 2026: last_visit_at skrives IKKE længere her.
      // En trigger på customer_activities_lago genberegner feltet fra
      // MAX(activity_date). Klient og server kan ikke længere komme
      // ud af trit — og sletning af aktiviteten rykker last_visit_at
      // tilsvarende tilbage (den fejl vi netop rettede fra den
      // anden ende).
      const updateRes = await supabase
        .from("companies_lago")
        .update({
          next_visit_planned: null,
          next_visit_note: null,
          next_visit_planned_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq("company_id", input.companyId);
      if (updateRes.error) throw updateRes.error;

      // Brief 21 (AI-3): tilfoejede AI-forslag → tasks. Kraever mindst
      // én kontakt paa kunden (foreign key). Uden én springes forslag
      // over; UI'et viser advarsel. Fejler et enkelt task-insert,
      // fortsaetter vi — besoeget er allerede gemt og er det vigtige.
      //
      // Tillæg 21A: hver task får ai_llm_call_id + oprindelig tekst/dato
      // + edited-flag. Bruger direkte insert i stedet for createTask så
      // ai_*-kolonnerne kan sættes. Uden llmCallId (fx hvis Edge Function
      // ikke kunne skrive audit-rækken) springes ai-koblingen over —
      // forslagene bliver stadig til tasks, de tælles bare ikke.
      // Brief 40 tillæg B (16. sep 2026): individuelle insert-fejl må
      // ikke tabes stille. Vi opsamler den tekst der ikke blev gemt,
      // så onSuccess kan vise en samlet fejl-toast med præcis den
      // formulering brugeren skal skrive igen. "Non-fatal for besøget"
      // er stadig sandt, men det er ikke sandt for opfølgningen selv.
      const failedFollowUpTexts: string[] = [];

      const forslag = input.aiForslag ?? [];
      const llmCallId = input.aiSummary?.llmCallId ?? null;
      if (forslag.length > 0 && input.primaryContactId != null) {
        // Brief 84 §4: AI-forslags-opfølgninger tildeles den, kunden
        // hører til under (viewSalesId). Camilla er syg, men opgaven er
        // hendes at følge op på. Sælgeren kan overskrive i FollowUp-
        // Builderens "Hvem?"-vælger (som selv defaulter til view).
        const followUpAssigneeSalesId = viewSalesId;
        const supabase = getSupabaseClient();
        for (const f of forslag) {
          try {
            const insertPayload: Record<string, unknown> = {
              contact_id: input.primaryContactId,
              text: f.tekst,
              due_date: f.dato
                ? new Date(`${f.dato}T12:00:00Z`).toISOString()
                : null,
              type: f.type === "opfoelgning" ? "follow-up" : null,
              sales_id: followUpAssigneeSalesId ?? undefined,
              // Brief 40 tillæg (16. sep 2026): eksplicit oprindelse.
              // Ai-stien sætter også ai_llm_call_id, men origin er den
              // markør rapporten filtrerer på — et positivt felt, ikke
              // et fravær.
              origin: "ai",
              // §13 (29. sep 2026): oprettet_af = actorSalesId (den
              // handlende, ikke den passede). Under dækning er det
              // Simon, ikke Camilla — banneret siger "Alt du registrerer,
              // står i dit navn". salesId er allerede actor via
              // input.performedBySalesId ?? identity.
              oprettet_af: salesId ?? undefined,
            };
            if (llmCallId != null) {
              insertPayload.ai_llm_call_id = llmCallId;
              insertPayload.ai_original_text = f.original_tekst;
              insertPayload.ai_original_due_date = f.original_dato
                ? new Date(`${f.original_dato}T12:00:00Z`).toISOString()
                : null;
              insertPayload.ai_edited = f.edited;
            }
            const res = await supabase.from("tasks").insert(insertPayload);
            if (res.error) throw res.error;
          } catch (e) {
            console.error("Kunne ikke gemme AI-forslag som task:", e);
            failedFollowUpTexts.push(f.tekst);
          }
        }
      }

      // Brief 40 tillæg A (16. sep 2026): manuelle opfølgninger →
      // tasks. Samme kontaktbinding og fejl-opsamling som AI-forslag;
      // origin='manual' gør oprindelsen positiv (frem for fravær af
      // ai_llm_call_id, som ville dække enhver fremtidig sti).
      const manualFollowUps = input.manualFollowUps ?? [];
      if (manualFollowUps.length > 0 && input.primaryContactId != null) {
        const supabase2 = getSupabaseClient();
        for (const m of manualFollowUps) {
          try {
            const res = await supabase2.from("tasks").insert({
              contact_id: input.primaryContactId,
              text: m.text,
              due_date: m.dueDateIso
                ? new Date(`${m.dueDateIso}T12:00:00Z`).toISOString()
                : null,
              type: "follow-up",
              sales_id: m.assigneeSalesId ?? undefined,
              origin: "manual",
              // §13 (29. sep 2026): actor som oprettet_af.
              oprettet_af: salesId ?? undefined,
            });
            if (res.error) throw res.error;
          } catch (e) {
            console.error("Kunne ikke gemme manuel opfølgning:", e);
            failedFollowUpTexts.push(m.text);
          }
        }
      }

      // Tillæg 21A: rapportér AI-udfaldet én gang, uanset om nogen
      // forslag blev tilføjet eller ej. Ignoreret-tællingen er det,
      // der afgør om placeringen eller formuleringen er problemet
      // — den skal registreres selvom sælgeren ikke rørte forslagene.
      if (input.aiSummary && input.aiSummary.llmCallId != null) {
        try {
          const supabase = getSupabaseClient();
          const { error } = await supabase.rpc(
            "record_ai_suggestion_outcomes",
            {
              llm_call_id: input.aiSummary.llmCallId,
              returned_count: input.aiSummary.returned,
              added_count: input.aiSummary.added,
              rejected_count: input.aiSummary.rejected,
              ignored_count: input.aiSummary.ignored,
            },
          );
          if (error) throw error;
        } catch (e) {
          // Non-fatal — måling må ikke blokere besøg-registreringen.
          console.error("Kunne ikke registrere AI-udfald:", e);
        }
      }

      return { activityId, failedFollowUpTexts };
    },
    onSuccess: (result, input) => {
      invalidate(input.companyId);
      const antalForslag = input.aiForslag?.length ?? 0;
      const antalManuelle = input.manualFollowUps?.length ?? 0;
      const total = antalForslag + antalManuelle;
      const failed = result.failedFollowUpTexts ?? [];
      // Brief 40 tillæg A: samlet tælling. Toast'en skal ikke afsløre
      // hvilke opfølgninger kom fra AI vs. sælgeren — det er ren
      // implementation-detalje for sælgeren. Målingen sker på task-
      // niveau via ai_llm_call_id-markøren.
      const beskrivelse =
        total > 0 && input.primaryContactId != null
          ? `Besøg + ${total} opfølgning${total > 1 ? "er" : ""} registreret`
          : `Besøg registreret på ${input.companyName}`;
      // Fortryd-mønster (brief 16. sep 2026): ét klik-fejltryk skal
      // kunne rulles tilbage uden at navigere væk. Fortryd kalder
      // samme soft-delete RPC som slet-knappen i tidslinjen bruger.
      toast.success(beskrivelse, {
        action: {
          label: "Fortryd",
          onClick: () => {
            void softDeleteActivityRpc(result.activityId).then(
              () => {
                invalidate(input.companyId);
                toast.success("Besøget er fortrudt");
              },
              (err) => {
                toast.error("Kunne ikke fortryde besøget", {
                  description:
                    readErrorMessage(err),
                });
              },
            );
          },
        },
        duration: 5000,
      });
      // Brief 40 + tillæg A (16. sep 2026): advarslen må kun vises når
      // den er sand. Tre tilstande skal skelnes:
      //   contactsFetchFailed → opslag fejlede (siger det, ikke andet)
      //   hasCustomerContacts === false → kunden er reelt tom
      //   ellers (primaryContactId==null trods contacts>0) → race,
      //     ekstremt sjælden. Log stille i konsol.
      // Dækker både AI-forslag og manuelle opfølgninger (total).
      if (total > 0 && input.primaryContactId == null) {
        if (input.contactsFetchFailed) {
          toast.warning("Opfølgninger ikke gemt", {
            description:
              "Kunne ikke indlæse kundens kontakter — prøv at åbne kundekortet og igen.",
            duration: 6000,
          });
        } else if (input.hasCustomerContacts === false) {
          toast.warning("Opfølgninger ikke gemt", {
            description:
              "Kunden har ingen kontakter — opret en her, så gemmes opfølgningerne på den.",
            duration: 6000,
          });
        } else {
          console.warn(
            "Opfølgninger: primaryContactId=null trods hasCustomerContacts=true",
            { companyId: input.companyId },
          );
        }
      }
      // Brief 40 tillæg B (16. sep 2026): individuelle insert-fejl skal
      // fortælle brugeren hvilken tekst der ikke landede — så han kan
      // skrive den igen. Vises som separat toast fra succes-toasten så
      // begge er læselige samtidig.
      if (failed.length > 0) {
        toast.error(
          failed.length === 1
            ? "1 opfølgning kunne ikke gemmes"
            : `${failed.length} opfølgninger kunne ikke gemmes`,
          {
            description: failed.map((t) => `"${t}"`).join("\n"),
            duration: 10000,
          },
        );
      }
    },
    onError: (err) =>
      toast.error("Kunne ikke registrere besøget", {
        description: readErrorMessage(err),
      }),
  });
}

// ---------------------------------------------------------------------
// Soft-delete af aktiviteter (brief 16. sep 2026, rev. brief 41)
// ---------------------------------------------------------------------
//
// Sletning sker via RPC — ikke direkte UPDATE — så to regler kan
// håndhæves server-side i én transaktion:
//   - kun egen aktivitet, eller admin
//   - trigger genberegner last_visit_at fra MAX(activity_date)
//
// Brief 41 (16. sep 2026): source='crm_native'-spærringen er fjernet i
// migrationen. VISMA-importen af aktiviteter var engangs 10. juli, så
// spærringen ekskluderede utilsigtet 1.362 rækker fra rettelse.
//
// undo=true nulstiller deleted_at igen; brugt af Fortryd-toast'ene og
// af tidslinjens "Fortryd sletning" hvis vi bygger den senere.

async function softDeleteActivityRpc(
  activityId: number,
  undo = false,
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("soft_delete_customer_activity", {
    activity_id: activityId,
    undo,
  });
  if (error) throw error;
}

export interface SoftDeleteActivityInput {
  activityId: number;
  companyId: number;
  companyName?: string;
}

export function useSoftDeleteActivity() {
  const invalidate = useInvalidateAfterWrite();

  return useMutation({
    mutationFn: async (input: SoftDeleteActivityInput) => {
      await softDeleteActivityRpc(input.activityId, false);
      return input;
    },
    onSuccess: (input) => {
      invalidate(input.companyId);
      toast.success("Aktivitet slettet", {
        action: {
          label: "Fortryd",
          onClick: () => {
            void softDeleteActivityRpc(input.activityId, true).then(
              () => {
                invalidate(input.companyId);
                toast.success("Sletning fortrudt");
              },
              (err) => {
                toast.error("Kunne ikke fortryde sletning", {
                  description:
                    readErrorMessage(err),
                });
              },
            );
          },
        },
        duration: 5000,
      });
    },
    onError: (err) =>
      toast.error("Kunne ikke slette aktiviteten", {
        description: readErrorMessage(err),
      }),
  });
}

// ---------------------------------------------------------------------
// Aktivitet (non-besøg)
// ---------------------------------------------------------------------

export interface RegisterAktivitetInput extends CommonCtx {
  activityTypeCode: number;
  activityTypeLabel: string;
  dateIso: string;
  description: string | null;
  /** Optional "udført af" — falls back to current identity when null. */
  performedByName?: string | null;
  /** Brief 61 (17. sep 2026): salgs-id på udføreren. Se
   *  RegisterBesoegInput. */
  performedBySalesId?: number | null;
  /** Brief 40 tillæg A (16. sep 2026): manuelle opfølgninger fra
   *  FollowUpBuilder — samme datamodel som på besøgsregistrering. */
  manualFollowUps?: Array<{
    text: string;
    dueDateIso: string | null;
    assigneeSalesId: number | null;
  }>;
  /** Brief 40's kontakt-binding-regel: kræver primaryContactId + flag
   *  så onSuccess-advarslen kan skelne mellem "kunden har ingen
   *  kontakter" og "opslag fejlede". */
  primaryContactId?: number | null;
  hasCustomerContacts?: boolean;
  contactsFetchFailed?: boolean;
}

/**
 * Brief 35 §1 (16. sep 2026): datoen afgør done-flaget.
 *   fremtidig dato → done=false (planlagt, ikke afholdt endnu)
 *   i dag eller tidligere → done=true (afholdt)
 * Ingen ekstra kontrol, ingen afkrydsning. Sammenligning i lokal-tid
 * (YYYY-MM-DD-streng) fordi activity_date er en `date`-kolonne uden
 * tidszone — todayIso() på klienten er derfor det rigtige referencepunkt.
 */
export function isPlannedDateIso(dateIso: string): boolean {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const todayLocal = `${yyyy}-${mm}-${dd}`;
  return dateIso > todayLocal;
}

export function useRegisterAktivitet() {
  const { data: identity } = useGetIdentity();
  const invalidate = useInvalidateAfterWrite();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (input: RegisterAktivitetInput) => {
      const supabase = getSupabaseClient();
      const salesName =
        input.performedByName ?? readIdentitySalesName(identity);
      // Brief 61 (17. sep 2026): se useRegisterBesoeg — sales_id sættes
      // altid når vi kender den, ellers falder tilbage til identity.
      const salesId =
        input.performedBySalesId ?? readIdentitySalesId(identity);
      const planned = isPlannedDateIso(input.dateIso);
      const res = await supabase.from("customer_activities_lago").insert({
        company_id: input.companyId,
        activity_date: input.dateIso,
        activity_type_code: input.activityTypeCode,
        activity_type: input.activityTypeLabel,
        description: input.description,
        sales_name: salesName,
        sales_id: salesId,
        // Brief 35 §1: fremtidig dato → planlagt (done=false).
        done: !planned,
        source: "crm_native",
      });
      if (res.error) throw res.error;

      // Brief 40 tillæg A + B (16. sep 2026): manuelle opfølgninger →
      // tasks, samme mønster som på useRegisterBesoeg. Fejlede tekster
      // opsamles så brugeren kan se præcis hvad der ikke landede.
      const followUps = input.manualFollowUps ?? [];
      const failedFollowUpTexts: string[] = [];
      if (followUps.length > 0 && input.primaryContactId != null) {
        for (const m of followUps) {
          try {
            const tRes = await supabase.from("tasks").insert({
              contact_id: input.primaryContactId,
              text: m.text,
              due_date: m.dueDateIso
                ? new Date(`${m.dueDateIso}T12:00:00Z`).toISOString()
                : null,
              type: "follow-up",
              sales_id: m.assigneeSalesId ?? undefined,
              origin: "manual",
              // §13 (29. sep 2026): actor som oprettet_af.
              oprettet_af: salesId ?? undefined,
            });
            if (tRes.error) throw tRes.error;
          } catch (e) {
            console.error("Kunne ikke gemme manuel opfølgning:", e);
            failedFollowUpTexts.push(m.text);
          }
        }
      }
      return {
        planned,
        followUpCount: followUps.length,
        failedFollowUpTexts,
      };
    },
    onSuccess: (result, input) => {
      invalidate(input.companyId);
      const verb = result.planned ? "planlagt" : "registreret";
      const suffix =
        result.followUpCount > 0
          ? ` + ${result.followUpCount} opfølgning${
              result.followUpCount > 1 ? "er" : ""
            }`
          : "";
      toast.success(
        `${input.activityTypeLabel} ${verb}${suffix} på ${input.companyName}`,
        {
          action: {
            label: "Åbn tidslinje",
            onClick: () => navigate(`/companies/${input.companyId}/show`),
          },
          duration: 4000,
        },
      );
      // Brief 40 tillæg A: same skelne-mellem-tilstande-advarsel som på
      // useRegisterBesoeg, hvis der var opfølgninger som ikke kunne
      // bindes.
      if (result.followUpCount > 0 && input.primaryContactId == null) {
        if (input.contactsFetchFailed) {
          toast.warning("Opfølgning ikke gemt", {
            description:
              "Kunne ikke indlæse kundens kontakter — prøv at åbne kundekortet og igen.",
            duration: 6000,
          });
        } else if (input.hasCustomerContacts === false) {
          toast.warning("Opfølgning ikke gemt", {
            description:
              "Kunden har ingen kontakter — opret en her, så gemmes opfølgningen på den.",
            duration: 6000,
          });
        }
      }
      // Brief 40 tillæg B: fejlede individuelle inserts fortæller
      // brugeren hvad der skal skrives igen.
      const failed = result.failedFollowUpTexts ?? [];
      if (failed.length > 0) {
        toast.error(
          failed.length === 1
            ? "1 opfølgning kunne ikke gemmes"
            : `${failed.length} opfølgninger kunne ikke gemmes`,
          {
            description: failed.map((t) => `"${t}"`).join("\n"),
            duration: 10000,
          },
        );
      }
    },
    onError: (err) =>
      toast.error("Kunne ikke gemme aktiviteten", {
        description: readErrorMessage(err),
      }),
  });
}

// ---------------------------------------------------------------------
// Markér-som-afholdt (brief 35 §4)
// ---------------------------------------------------------------------

export interface MarkActivityDoneInput {
  activityId: number;
  companyId: number;
  companyName?: string;
  /** Rettet dato — hvis begivenheden fandt sted en anden dag end
   *  oprindeligt planlagt. Null = brug dagens dato. */
  newDate?: string | null;
}

export function useMarkActivityDone() {
  const invalidate = useInvalidateAfterWrite();

  return useMutation({
    mutationFn: async (input: MarkActivityDoneInput) => {
      const supabase = getSupabaseClient();
      const { error } = await supabase.rpc("mark_activity_done", {
        activity_id: input.activityId,
        new_date: input.newDate ?? null,
      });
      if (error) throw error;
      return input;
    },
    onSuccess: (input) => {
      invalidate(input.companyId);
      toast.success("Aktivitet markeret afholdt", { duration: 3000 });
    },
    onError: (err) =>
      toast.error("Kunne ikke markere aktiviteten afholdt", {
        description: readErrorMessage(err),
      }),
  });
}

// ---------------------------------------------------------------------
// Redigering af aktiviteter (brief 41 · 16. sep 2026)
// ---------------------------------------------------------------------
//
// Én mutation der rammer update_activity RPC'en. Feltselektionen sker
// server-side: null-værdier bevarer eksisterende data. Valideringen
// (fremtidig dato på besøg) sker mod den NYE type i RPC'en så en
// smagning der rettes til besøg + fremtidig dato ikke smutter forbi
// brief 35 §2. done afledes af datoen — planlagt/afholdt-flippet er
// samme mekanik som selve registreringen bruger.
//
// AI-3-målingen (brief 21 tillæg A): tasks.ai_original_text/dato/edited
// røres ikke af RPC'en — den arbejder kun på customer_activities_lago.

export interface UpdateActivityInput {
  activityId: number;
  companyId: number;
  companyName?: string;
  /** Ny notetekst, eller null hvis brugeren ikke rørte feltet. */
  newNote?: string | null;
  /** Ny YYYY-MM-DD-dato, eller null. */
  newDate?: string | null;
  /** Ny activity_type_code (1, 2, 4, 5, 10, 99), eller null. */
  newTypeCode?: number | null;
}

export function useUpdateActivity() {
  const invalidate = useInvalidateAfterWrite();

  return useMutation({
    mutationFn: async (input: UpdateActivityInput) => {
      const supabase = getSupabaseClient();
      const { error } = await supabase.rpc("update_activity", {
        activity_id: input.activityId,
        new_note: input.newNote ?? null,
        new_date: input.newDate ?? null,
        new_type_code: input.newTypeCode ?? null,
      });
      if (error) throw error;
      return input;
    },
    onSuccess: (input) => {
      invalidate(input.companyId);
      toast.success("Aktivitet rettet", { duration: 3000 });
    },
    onError: (err) =>
      toast.error("Kunne ikke rette aktiviteten", {
        description: readErrorMessage(err),
      }),
  });
}

// ---------------------------------------------------------------------
// Opgave (Atomic-task)
// ---------------------------------------------------------------------

export interface RegisterOpgaveInput extends CommonCtx {
  /**
   * Kontakt som opgaven bindes til. Én af `contactId` eller
   * `newContact` skal være til stede. `tasks.contact_id` er NOT NULL i
   * kernen — vi omgår ikke schemaet, vi opretter kontakten inline.
   */
  contactId?: number | null;
  /**
   * Brief 16. sep 2026: sælgeren skrev et navn i "Hvem?"-feltet der
   * ikke matcher en eksisterende kontakt. Vi opretter kontakten (kun
   * navn — resten kan udfyldes senere) og bruger dens id til task'en.
   * Åbner 118 af 257 kunder for opfølgninger uden schema-ændring.
   */
  newContact?: {
    firstName: string;
    lastName?: string | null;
  } | null;
  text: string;
  taskType: string;
  dueDateIso: string; // YYYY-MM-DD
  /**
   * sales.id of the assignee. `null` means Backoffice / unassigned queue
   * — nothing lands in a specific user's inbox until someone picks it up.
   * `undefined` falls back to the current identity's sales_id.
   */
  assigneeSalesId?: number | null;
}

export function useRegisterOpgave() {
  // Brief 84 §4 (28. sep 2026): opgaver + inline-kontakter hører til
  // kundens ansvarlige sælger. Under dækning: viewSalesId=Camilla,
  // så opgaven lander i hendes "Mine opgaver" — hvor Simon også kan
  // se den mens han passer for. Uden dækning: viewSalesId=actor.
  // useGetIdentity er ikke længere nødvendig her — actor kommer via
  // useViewSalesId's fallback når der ikke er dækning.
  const viewSalesId = useViewSalesId();
  const invalidate = useInvalidateAfterWrite();

  return useMutation({
    mutationFn: async (input: RegisterOpgaveInput) => {
      // Explicit assigneeSalesId (fx null = backoffice-kø) overskriver
      // som før; ellers = viewSalesId (default).
      const salesId =
        input.assigneeSalesId === undefined
          ? viewSalesId
          : input.assigneeSalesId;

      // Trin 1: skaf en contact_id. Enten fandtes en, eller også
      // oprettes en her, minimal (kun navn + company + first_seen).
      let contactId = input.contactId ?? null;
      let createdContactName: string | null = null;
      if (contactId == null) {
        if (!input.newContact || !input.newContact.firstName.trim()) {
          throw new Error(
            "Vælg en kontakt eller skriv et navn i Hvem?-feltet",
          );
        }
        // Kontakt-ejerskab følger kunden. contacts.sales_id læses som
        // "Fulgt af X" — under dækning peger den på Camilla (kundens
        // ansvarlige), ikke på Simon.
        const created = await insertInlineContact({
          companyId: input.companyId,
          firstName: input.newContact.firstName,
          lastName: input.newContact.lastName ?? null,
          salesId: viewSalesId,
        });
        contactId = created.id;
        createdContactName = created.fullName;
      }

      // Trin 2: opgaven.
      await createTask({
        contact_id: contactId,
        text: input.text,
        due_date: new Date(`${input.dueDateIso}T12:00:00Z`).toISOString(),
        type: input.taskType || null,
        sales_id: salesId ?? undefined,
      });

      return { createdContactName };
    },
    onSuccess: (result, input) => {
      invalidate(input.companyId);
      const message = result.createdContactName
        ? `Opgave + ny kontakt "${result.createdContactName}" tilføjet på ${input.companyName}`
        : `Opgave tilføjet på ${input.companyName}`;
      toast.success(message, { duration: 3500 });
    },
    onError: (err) =>
      toast.error("Kunne ikke gemme opgaven", {
        description: readErrorMessage(err),
      }),
  });
}

// ---------------------------------------------------------------------
// Planlæg næste besøg (brief 15 / FS-20)
// ---------------------------------------------------------------------

export interface PlanNextVisitInput extends CommonCtx {
  /** YYYY-MM-DD. Null = ryd planlægningen. */
  dateIso: string | null;
  /** HH:MM (valgfri). Ignoreret hvis dateIso er null. */
  timeHm?: string | null;
  /** Kort "hvad vil jeg"-note. Ignoreret hvis dateIso er null. */
  note?: string | null;
  /** Sælger planen er tildelt (Domain-brief 18 §3.1). Default =
   *  nuværende bruger. Kontoret kan senere planlægge på en kollegas
   *  vegne ved at overskrive dette. */
  plannedBySalesId?: number | null;
}

/**
 * Skriver `next_visit_planned` (+ note) på companies_lago. Sætter tid
 * lokalt (browserens tidszone) så en dato uden tid lander som midnat
 * lokal tid — konverteres til UTC via ISO string. Kaldes fra kundekort
 * og som "Planlæg næste"-step efter besøgs-registrering.
 */
export function usePlanNextVisit() {
  const invalidate = useInvalidateAfterWrite();

  return useMutation({
    mutationFn: async (input: PlanNextVisitInput) => {
      const supabase = getSupabaseClient();
      let plannedIso: string | null = null;
      if (input.dateIso) {
        const time = input.timeHm && /^\d{2}:\d{2}$/.test(input.timeHm)
          ? input.timeHm
          : "00:00";
        // Byg som lokal tid, konvertér til UTC.
        const localDate = new Date(`${input.dateIso}T${time}:00`);
        if (Number.isNaN(localDate.getTime())) {
          throw new Error("Ugyldig dato/tid");
        }
        plannedIso = localDate.toISOString();
      }
      const res = await supabase
        .from("companies_lago")
        .update({
          next_visit_planned: plannedIso,
          next_visit_note: plannedIso ? (input.note ?? null) : null,
          // Tildeling følger planen: sat når vi planlægger, nul når vi
          // rydder. Default = nuværende bruger (input.plannedBySalesId).
          next_visit_planned_by: plannedIso
            ? (input.plannedBySalesId ?? null)
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq("company_id", input.companyId);
      if (res.error) throw res.error;
    },
    onSuccess: (_, input) => {
      invalidate(input.companyId);
      if (input.dateIso) {
        toast.success(`Besøg planlagt på ${input.companyName}`);
      } else {
        toast.success(`Planlægning ryddet på ${input.companyName}`);
      }
    },
    onError: (err) =>
      toast.error("Kunne ikke planlægge besøget", {
        description: readErrorMessage(err),
      }),
  });
}

// ---------------------------------------------------------------------
// Note (løs)
// ---------------------------------------------------------------------

export interface RegisterNoteInput extends CommonCtx {
  text: string;
  contactId: number | null;
}

export function useRegisterNote() {
  const { data: identity } = useGetIdentity();
  const invalidate = useInvalidateAfterWrite();

  return useMutation({
    mutationFn: async (input: RegisterNoteInput) => {
      await createCompanyNote({
        company_id: input.companyId,
        text: input.text,
        contact_id: input.contactId,
        sales_id: readIdentitySalesId(identity) ?? undefined,
      });
    },
    onSuccess: (_, input) => {
      invalidate(input.companyId);
      toast.success(`Note gemt på ${input.companyName}`);
    },
    onError: (err) =>
      toast.error("Kunne ikke gemme noten", {
        description: readErrorMessage(err),
      }),
  });
}

// ---------------------------------------------------------------------
// Inline-kontaktopret (brief 16. sep 2026)
// ---------------------------------------------------------------------
//
// Delt helper: OpgaveForm bruger den til at oprette en kontakt på vej
// gennem "Gem opgave"-flowet, og ContactsCard bruger den til "Tilføj
// kontakt"-knappen på kundekortet. En kontakt er kun to felter for at
// blive brugbar — navn + company. Resten (email/telefon/titel) kan
// tilføjes senere fra kontakt-siden.

interface InsertInlineContactInput {
  companyId: number;
  firstName: string;
  lastName: string | null;
  salesId: number | null;
}

/** Split fuldt navn ved SIDSTE mellemrum. VISMA-navne bærer
 *  mellemnavne — "Martin Sandy Shalmi" → ("Martin Sandy", "Shalmi").
 *  Uden mellemrum ryger hele navnet i first_name, last_name er null.
 *  Samme regel bruges af Kontakter-parseren (Brief 29) og af
 *  inline-oprettelsen i Registrér → Opgave. */
export function splitNameAtLast(name: string): {
  first_name: string;
  last_name: string | null;
} {
  const trimmed = name.trim().replace(/\s+/g, " ");
  const idx = trimmed.lastIndexOf(" ");
  if (idx === -1) {
    return { first_name: trimmed, last_name: null };
  }
  return {
    first_name: trimmed.slice(0, idx),
    last_name: trimmed.slice(idx + 1),
  };
}

export async function insertInlineContact(
  input: InsertInlineContactInput,
): Promise<{ id: number; fullName: string }> {
  const supabase = getSupabaseClient();
  const nowIso = new Date().toISOString();
  const first = input.firstName.trim();
  const last = (input.lastName ?? "").trim() || null;
  if (!first) {
    throw new Error("Fornavn er påkrævet");
  }
  const res = await supabase
    .from("contacts")
    .insert({
      first_name: first,
      last_name: last,
      company_id: input.companyId,
      sales_id: input.salesId,
      first_seen: nowIso,
      last_seen: nowIso,
      email_jsonb: [],
      phone_jsonb: [],
      tags: [],
    })
    .select("id")
    .single<{ id: number }>();
  if (res.error) throw res.error;
  return {
    id: res.data.id,
    fullName: [first, last].filter(Boolean).join(" "),
  };
}

export interface CreateInlineContactInput {
  companyId: number;
  companyName?: string;
  /** Rå navn — splittes ved første mellemrum. */
  name: string;
}

export function useCreateInlineContact() {
  // Brief 84 §4 (28. sep 2026): kontakt-ejerskab = viewSalesId. Under
  // dækning peger contacts.sales_id på Camilla (kundens ansvarlige),
  // ikke på Simon — så "Fulgt af X" er sandt bagefter.
  const viewSalesId = useViewSalesId();
  const invalidate = useInvalidateAfterWrite();

  return useMutation({
    mutationFn: async (input: CreateInlineContactInput) => {
      const { first_name: firstName, last_name: lastName } = splitNameAtLast(
        input.name,
      );
      if (!firstName) throw new Error("Skriv et navn");
      const created = await insertInlineContact({
        companyId: input.companyId,
        firstName,
        lastName,
        salesId: viewSalesId,
      });
      return created;
    },
    onSuccess: (result, input) => {
      invalidate(input.companyId);
      const where = input.companyName ? ` på ${input.companyName}` : "";
      toast.success(`Kontakt "${result.fullName}" tilføjet${where}`, {
        duration: 3500,
      });
    },
    onError: (err) =>
      toast.error("Kunne ikke tilføje kontakten", {
        description: readErrorMessage(err),
      }),
  });
}
