import type { AppState } from "./dataAccess";

/**
 * Brief 57 §3 · sælger-skærmen. En HEL skærm, ikke et banner — et banner
 * over en flade der er under ombygning får folk til at prøve alligevel.
 *
 * Ingen knapper (ingen "prøv igen"-knap folk trykker på i ét væk).
 * Siden lukker op af sig selv når `slutter` er passeret — useAppState
 * poller hvert 30. sekund + har en timer på slutter-tidspunktet.
 */

const DEFAULT_BESKED = "Vi opdaterer LAGO CRM. Prøv igen om et par minutter.";

function formatSlutterHhMm(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}.${mm}`;
}

export function MaintenancePage({ state }: { state: AppState }) {
  const besked = state.besked?.trim() || DEFAULT_BESKED;
  const slutterHhMm = formatSlutterHhMm(state.slutter);
  return (
    <main
      role="status"
      aria-live="polite"
      className="flex min-h-dvh flex-col items-center justify-center bg-[var(--surface)] px-6 py-10 text-center"
    >
      <div className="text-7xl" aria-hidden>
        🍇
      </div>
      <h1 className="mt-6 text-2xl font-bold text-[var(--fg)]">
        Vi opdaterer lige
      </h1>
      <p className="mt-4 max-w-md whitespace-pre-wrap text-[length:var(--t-body)] text-[var(--fg-2)]">
        {besked}
      </p>
      {slutterHhMm && (
        <p className="mt-6 text-[length:var(--t-body)] text-[var(--fg-3)]">
          Åbner igen ca. {slutterHhMm}
        </p>
      )}
    </main>
  );
}
