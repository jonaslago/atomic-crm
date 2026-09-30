import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Brief 90 opfølgning (29. sep 2026) · Foldbar note-tekst.
 *
 * Indsatte mails og lange noter fylder hele aktivitetshistorikken —
 * indhold, signatur, telefonnumre, adresse. Sammenfoldning viser de
 * første par linjer og "Vis mere". Sælgeren scanner den vigtige besked
 * (typisk øverst) og folder ud kun hvis der er brug.
 *
 * Bruges hvor lange noter renderes: aktivitetshistorikken, kundekortet,
 * "Seneste registreringer fra feltet", aktivitetssiden.
 *
 * Vi strippe ikke signaturer — sammenfoldning løser det uden at gætte
 * (Jonas 29. sep). Klik, ikke hover; fold gælder både ind og ud.
 *
 * Detektering: efter render måler vi scrollHeight vs clientHeight. Er
 * teksten længere end line-clamp-grænsen, vises knappen. Rerender ved
 * text-ændring så knappen tilpasser sig.
 */

const CLAMP_CLASSES: Record<number, string> = {
  2: "line-clamp-2",
  3: "line-clamp-3",
  4: "line-clamp-4",
  5: "line-clamp-5",
};

interface ExpandableNoteProps {
  text: string;
  /** Antal linjer der vises når foldet sammen. Default 4. */
  clampLines?: 2 | 3 | 4 | 5;
  /** Tailwind-klasser til p-elementet — fx farve, størrelse. */
  className?: string;
}

export function ExpandableNote({
  text,
  clampLines = 4,
  className,
}: ExpandableNoteProps) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Mål kun i sammenfoldet tilstand. I ekspanderet tilstand er
    // scrollHeight = clientHeight fordi clamp'en er fjernet.
    if (expanded) return;
    setOverflows(el.scrollHeight - el.clientHeight > 1);
  }, [text, clampLines, expanded]);

  return (
    <div className="flex flex-col gap-1">
      <p
        ref={ref}
        className={cn(
          "whitespace-pre-wrap break-words",
          !expanded && CLAMP_CLASSES[clampLines],
          className,
        )}
      >
        {text}
      </p>
      {(overflows || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="self-start text-[length:var(--t-sec)] font-medium text-[var(--fg-2)] hover:text-[var(--fg)] underline-offset-2 hover:underline"
        >
          {expanded ? "Vis mindre" : "Vis mere"}
        </button>
      )}
    </div>
  );
}
