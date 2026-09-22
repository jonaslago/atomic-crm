import { useQuery } from "@tanstack/react-query";
import { Loader2, Phone, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslate } from "ra-core";

import { cn } from "@/lib/utils";
import { Icon } from "@/lago/ui/Icon";
import { Button as LagoButton } from "@/lago/ui/Button";
import { IconButton } from "@/lago/ui/IconButton";
import { StatusBadge } from "@/lago/ui/StatusBadge";

import { fetchLagoCustomer } from "../dataAccess";
import { RegistrerButton } from "@/lago/registrer/RegistrerButton";
import { formatPhonePairs } from "@/lago/ui/formatPhone";
import { formatYtdPeriod, useSalesYtd } from "../salgstal/useSalesYtd";
import { useOpenOrders } from "../show/useOpenOrders";
import { resolveVisitPriority } from "../priority";
import type { ContactSummary } from "../types";
import { humanDaysSince } from "@/lago/ui/humanDuration";
import { KreditSpaerreChip } from "@/lago/ui/KreditSpaerreChip";

/**
 * Brief 48 §G (16. sep 2026) · preview-panelet skal LÆSES, ikke betjenes.
 *
 * Spørgsmålet, panelet skal besvare, er "skal jeg køre derud?" — ikke
 * "hvad kan jeg gøre herfra". Fanerne Info/Note/Opgave er væk;
 * disposition følger Stitchs opsætning:
 *
 *   [Segment X]                              [Ajour/Trænger/Overskredet]
 *   Kundenavn
 *   Adresse
 *   ─────────────────────────────────────────
 *   KONTAKTPERSON
 *   Navn · Titel · Tlf.
 *   ─────────────────────────────────────────
 *   Seneste besøg      Næste planlagte
 *   ─────────────────────────────────────────
 *   OMSÆTNING I ÅR
 *   Beløb + udvikling
 *   ─────────────────────────────────────────
 *   Åbne ordrer-indstik
 *   Åben opfølgning-indstik
 *   ─────────────────────────────────────────
 *   [Åbn fuldt kundekort]   (primær)
 *   [Registrér] [Ring op]   (sekundær)
 */

const kroner = new Intl.NumberFormat("da-DK", {
  style: "currency",
  currency: "DKK",
  maximumFractionDigits: 0,
});

function fullName(c: ContactSummary): string {
  return [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || "—";
}

function primaryPhone(c: ContactSummary): string | null {
  return c.phone_jsonb?.[0]?.number ?? null;
}

function dateShort(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function timeShort(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  // Kun tid hvis dato + tid — planlagte besøg gemmes som dato uden
  // timestamp gennem UI'et, men databasekolonnen er timestamptz.
  const hh = d.getHours();
  const mm = d.getMinutes();
  if (hh === 0 && mm === 0) return null;
  return `Kl. ${String(hh).padStart(2, "0")}.${String(mm).padStart(2, "0")}`;
}

interface CustomerPreviewProps {
  companyId: number | null;
  /** Brief 52 §1 (17. sep 2026): ✕ i topbjælken lukker preview. Kaldes
   *  fra parent så list-siden kan rydde selectedId. */
  onClose?: () => void;
}

export function CustomerPreview({ companyId, onClose }: CustomerPreviewProps) {
  const translate = useTranslate();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ["lago-customer", companyId],
    queryFn: () => (companyId ? fetchLagoCustomer(companyId) : null),
    enabled: companyId != null,
  });

  if (companyId == null) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-[var(--fg-2)]">
        {translate("lago.customer_list.preview.placeholder")}
      </div>
    );
  }
  if (query.isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-[var(--fg-2)]">
        <Icon icon={Loader2} className="animate-spin" />
        {translate("lago.customer.loading")}
      </div>
    );
  }
  if (query.error || !query.data) {
    return (
      <div className="p-6 text-sm text-[var(--st-red-fg)]">
        {translate("lago.customer.errors.load_failed")}
      </div>
    );
  }
  const data = query.data;
  const { company, extension, contacts, openTasks } = data;
  const primary = contacts[0];
  // Brief 50 §2 (17. sep 2026): postnummer og by er ét led ("5400
  // Bogense"), adresse-linjen skrives "Adelgade 46 · 5400 Bogense".
  // Én form overalt: her, i kundekortets mobil-header, i Stamdata.
  const zipCity = [company.zipcode, company.city].filter(Boolean).join(" ");
  const address = [company.address, zipCity].filter(Boolean).join(" · ");
  const priority = resolveVisitPriority(data.visitPriority);

  return (
    // Brief 52 §1 (17. sep 2026): sticky topbjælke med "Åbn kundekort"
    // primær + ✕. Den hyppigste handling er nu ét klik væk uden at
    // sælgeren skal rulle. `bg-surface` bevares på hele panelet så
    // topbjælken har samme baggrund når den klæber (ingen glitch).
    <div className="relative flex flex-col bg-[var(--surface)] rounded-[var(--r-2)]">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-[var(--line)] bg-[var(--surface)] px-4 py-2 rounded-t-[var(--r-2)]">
        <span className="text-[length:var(--t-meta)] font-medium uppercase tracking-wider text-[var(--fg-3)]">
          Kundepreview
        </span>
        <div className="flex items-center gap-2">
          <LagoButton
            variant="primary"
            onClick={() => navigate(`/companies/${company.id}/show`)}
          >
            Åbn kundekort
          </LagoButton>
          {onClose && (
            <IconButton icon={X} aria-label="Luk preview" onClick={onClose} />
          )}
        </div>
      </div>
      <div className="flex flex-col gap-4 p-4">
        <PreviewHeader
          name={company.name}
          address={address}
          segment={extension?.segment ?? null}
          status={priority.status}
          daysOverdue={priority.daysOverdue}
          kreditspaerret={extension?.kreditspaerre}
        />

        {/* Brief 65 §4 (18. sep 2026): "vil helst bare ringes op" — vises
          under adressen så den, der ER ved at vælge, ser noten. Vises
          kun når overrider har efterladt en note. */}
        {extension?.besoegsfrekvens_note && (
          <p className="-mt-2 text-[length:var(--t-sec)] italic text-[var(--fg-2)]">
            »{extension.besoegsfrekvens_note}«
          </p>
        )}

        {primary && (
          <PreviewSection label="Kontaktperson">
            <p className="text-base font-bold text-[var(--fg)]">
              {fullName(primary)}
            </p>
            {/* Brief 51 §2 (17. sep 2026): telefonnummeret som TEKST i
              par-format ("21 40 88 99") — man skal kunne læse det op
              til en kollega. Titel er alene hvis nummeret mangler; er
              begge tomme falder linjen væk (ingen tankestreg). */}
            {(primary.title || primaryPhone(primary)) && (
              <p className="text-[length:var(--t-sec)] text-[var(--fg-2)]">
                {primary.title}
                {primary.title && primaryPhone(primary) && (
                  <span aria-hidden> · </span>
                )}
                {primaryPhone(primary) && (
                  <a
                    href={`tel:${primaryPhone(primary)}`}
                    className="text-[var(--ink)] underline-offset-2 hover:underline"
                  >
                    Tlf. {formatPhonePairs(primaryPhone(primary))}
                  </a>
                )}
              </p>
            )}
          </PreviewSection>
        )}

        <div className="grid grid-cols-2 gap-3 border-y border-[var(--line)] py-3">
          {/* Brief 52 §4 (17. sep 2026): "Aldrig besøgt" som én linje —
            før stod "—" som primær + "aldrig" som sekundær ovenpå
            hinanden, to måder at sige ingenting på. */}
          <PreviewMiniStat
            label="Seneste besøg"
            primary={dateShort(extension?.last_visit_at) ?? "Aldrig besøgt"}
            secondary={
              extension?.last_visit_at
                ? `${humanDaysSince(priority.daysSinceVisit)} siden`
                : undefined
            }
          />
          <PreviewMiniStat
            label="Næste planlagte"
            primary={dateShort(extension?.next_visit_planned) ?? "Ingen"}
            secondary={timeShort(extension?.next_visit_planned) ?? undefined}
          />
        </div>

        <OmsaetningPreview
          vismaCustomerNo={extension?.visma_customer_no ?? null}
        />

        <AabneOrdrerIndstik
          vismaCustomerNo={extension?.visma_customer_no ?? null}
        />

        {openTasks.length > 0 && (
          <div className="rounded-[var(--r-2)] bg-[var(--surface-1)] p-3">
            <p className="mb-1 text-[length:var(--t-meta)] font-bold uppercase tracking-wide text-[var(--fg)]">
              Åben opfølgning
            </p>
            <p className="text-[length:var(--t-sec)] text-[var(--fg-2)] line-clamp-2">
              {openTasks[0].text}
            </p>
          </div>
        )}

        {/* Brief 52 §1 (17. sep 2026): "Åbn fuldt kundekort" er flyttet
          op i den sticky topbjælke — én primær pr. blok. Registrér og
          Ring bliver her i bunden, begge SEKUNDÆRE, som handlinger
          man tager EFTER at have læst. */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <RegistrerButton
            variant="secondary"
            companyId={company.id}
            companyName={company.name}
            className="w-full min-w-0"
          />
          {company.phone_number ? (
            <LagoButton
              variant="secondary"
              icon={Phone}
              onClick={() => {
                window.location.href = `tel:${company.phone_number}`;
              }}
              className="w-full justify-center"
            >
              Ring op
            </LagoButton>
          ) : (
            <LagoButton
              variant="secondary"
              disabled
              className="w-full justify-center"
            >
              Intet nr.
            </LagoButton>
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewHeader({
  name,
  address,
  segment,
  status,
  daysOverdue,
  kreditspaerret,
}: {
  name: string;
  address: string;
  segment: "A" | "B" | "C" | "X" | "L" | null;
  status: ReturnType<typeof resolveVisitPriority>["status"];
  daysOverdue: number | null;
  kreditspaerret: boolean | null | undefined;
}) {
  // Ajour-mærkatet er den hurtigste måde at se om kunden er et problem
  // (Brief 48 "vores er bedre"-notat). Grøn for on_plan, gul for soon,
  // rød for overdue/never_visited, neutral for no_urgency.
  const statusVariant =
    status === "on_plan"
      ? "groen"
      : status === "soon"
        ? "gul"
        : status === "overdue" || status === "never_visited"
          ? "roed"
          : "neutral";
  const statusLabel =
    status === "on_plan"
      ? "Ajour"
      : status === "soon"
        ? "Trænger snart"
        : status === "overdue"
          ? `${daysOverdue ?? 0} dage over`
          : status === "never_visited"
            ? "Aldrig besøgt"
            : "—";
  return (
    <div className="flex flex-col gap-2 pb-3 border-b border-[var(--line)]">
      <div className="flex items-center justify-between gap-3">
        {segment ? (
          <SegmentPillPreview segment={segment} />
        ) : (
          <span className="text-[length:var(--t-meta)] text-[var(--fg-3)]">
            Uden segment
          </span>
        )}
        <StatusBadge variant={statusVariant}>{statusLabel}</StatusBadge>
      </div>
      <div>
        <h2 className="text-[length:var(--t-title)] font-bold text-[var(--fg)] tracking-tight leading-tight">
          {name}
        </h2>
        {address && (
          <p className="mt-1 text-[length:var(--t-sec)] text-[var(--fg-2)]">
            {address}
          </p>
        )}
        {kreditspaerret === true && (
          <div className="mt-2">
            <KreditSpaerreChip spaerret={true} />
          </div>
        )}
      </div>
    </div>
  );
}

function SegmentPillPreview({
  segment,
}: {
  segment: "A" | "B" | "C" | "X" | "L";
}) {
  // Preview bruger fyldt for A, neutral StatusBadge-look for resten —
  // matcher §H's kadence: A skiller sig ud, resten fader.
  if (segment === "A") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-[var(--r-1)] bg-[var(--ink)] text-white text-[length:var(--t-meta)] font-bold">
        Segment A
      </span>
    );
  }
  return <StatusBadge variant="neutral">Segment {segment}</StatusBadge>;
}

function PreviewSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-[length:var(--t-meta)] font-bold uppercase tracking-wide text-[var(--fg-3)]">
        {label}
      </p>
      {children}
    </div>
  );
}

function PreviewMiniStat({
  label,
  primary,
  secondary,
}: {
  label: string;
  primary: string;
  secondary?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[length:var(--t-meta)] text-[var(--fg-3)]">
        {label}
      </span>
      <span className="text-[var(--fg)] font-medium">{primary}</span>
      {secondary && (
        <span className="text-[length:var(--t-meta)] text-[var(--fg-3)]">
          {secondary}
        </span>
      )}
    </div>
  );
}

function OmsaetningPreview({
  vismaCustomerNo,
}: {
  vismaCustomerNo: string | null;
}) {
  const query = useSalesYtd(vismaCustomerNo);
  if (!vismaCustomerNo) return null;
  // Brief 52 §4 (17. sep 2026): label og forskel-format skal være
  // IDENTISKE med kundekortets OmsaetningSection. Preview sagde
  // "OMSÆTNING I ÅR" + "-7.436 kr. i forhold til sidste år"; kortet
  // sagde "ÅTD (jan–sep)" + "-7.436 kr. (-10,8 %)". Samme datapunkter,
  // to sprog — sælgeren skulle regne ud at de var det samme.
  const label = query.data
    ? `ÅTD (${formatYtdPeriod(query.data.throughMonth)})`
    : "ÅTD";
  if (query.isPending) {
    return (
      <PreviewSection label={label}>
        <p className="text-[length:var(--t-sec)] text-[var(--fg-2)]">Henter…</p>
      </PreviewSection>
    );
  }
  // #200 §2 (18. sep 2026): fejl må ikke skjule sektionen tavst. Uden
  // en synlig besked kan sælgeren ikke skelne "ingen omsætning" fra
  // "opslag fejlede" — og ÅTD er dét tal, der afgør om et besøg er
  // det tidsværd.
  if (query.error) {
    return (
      <PreviewSection label={label}>
        <p className="text-[length:var(--t-sec)] text-[var(--st-red-fg)]">
          Kunne ikke hente omsætningen.
        </p>
      </PreviewSection>
    );
  }
  if (!query.data) return null;
  const d = query.data;
  const diff = d.ytdThisYear - d.ytdLastYear;
  const diffPositive = diff >= 0;
  const diffPct = d.ytdLastYear > 0 ? (diff / d.ytdLastYear) * 100 : null;
  const pctNumber = new Intl.NumberFormat("da-DK", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const pctText =
    diffPct != null
      ? `(${diffPct >= 0 ? "+" : ""}${pctNumber.format(diffPct)} %)`
      : null;
  return (
    <PreviewSection label={label}>
      <p className="text-[length:var(--t-title)] font-bold text-[var(--fg)] tabular-nums tracking-tight">
        {kroner.format(d.ytdThisYear)}
      </p>
      {d.ytdLastYear > 0 && (
        <p
          className={cn(
            "text-[length:var(--t-sec)] font-medium tabular-nums",
            diffPositive
              ? "text-[var(--st-green-fg)]"
              : "text-[var(--st-red-fg)]",
          )}
        >
          {diffPositive ? "+" : ""}
          {kroner.format(diff)}
          {pctText && <span className="ml-2">{pctText}</span>}
        </p>
      )}
    </PreviewSection>
  );
}

function AabneOrdrerIndstik({
  vismaCustomerNo,
}: {
  vismaCustomerNo: string | null;
}) {
  const query = useOpenOrders(vismaCustomerNo);
  const orders = query.data?.orders ?? [];
  const totals = query.data?.totals;
  if (!vismaCustomerNo || orders.length === 0) return null;
  // Brief 75 tillæg C (22. sep 2026): sammendragslinjen skal bære
  // beløbet. "N ordrer · X kr. · alt klar" når intet afventer, ellers
  // "N ordrer · X kr. · Y kr. afventer". Det er hele svaret på én linje —
  // målestokken er hvor ofte sælgeren slipper for at folde ud.
  const iAltFmt = totals ? kroner.format(totals.iAlt) : "";
  const afventerFmt = totals ? kroner.format(totals.afventer) : "";
  const summary =
    totals && totals.afventer > 0
      ? `${orders.length} ordrer · ${iAltFmt} · ${afventerFmt} afventer`
      : `${orders.length} ordrer · ${iAltFmt} · alt klar`;
  const primaryRestNote = orders.find((o) => o.restNote)?.restNote;
  return (
    <div className="rounded-[var(--r-2)] bg-[var(--surface-1)] p-3">
      <p className="text-[length:var(--t-meta)] font-bold uppercase tracking-wide text-[var(--fg)]">
        Åbne ordrer
      </p>
      <p className="mt-1 text-[length:var(--t-sec)] text-[var(--fg-2)]">
        {summary}
      </p>
      {primaryRestNote && (
        <p className="mt-1 text-[length:var(--t-sec)] text-[var(--fg-2)]">
          {primaryRestNote}
        </p>
      )}
    </div>
  );
}
