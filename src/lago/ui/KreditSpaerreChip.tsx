/**
 * Brief 68 (21. sep 2026) · "Kreditspærret"-chip.
 *
 * Rød pill med ORDET "Kreditspærret" — ikke kun en farve eller et ikon.
 * Bruges i kundekortets header, i preview-panelet og i kortets ark.
 * Kun render'es når `spaerret === true`. `false` og `null` giver ingen
 * output — vi tilføjer ikke støj til de 99 % ikke-spærrede kunder.
 *
 * Visuel vægt = status-chip. Ord + farve, ingen ikon-alene-variant.
 * Rød er reserveret til: overskredet besøg (system-owned) og nu dette
 * (VISMA-owned). De to ting ligger aldrig samme sted — status-prikken
 * for besøg står ved navnet ovenover; kreditspærring er sin egen chip.
 */

interface KreditSpaerreChipProps {
  spaerret: boolean | null | undefined;
}

export function KreditSpaerreChip({ spaerret }: KreditSpaerreChipProps) {
  if (spaerret !== true) return null;
  return (
    <span
      className="inline-flex items-center rounded-full bg-[var(--st-red-bg)] px-2 py-0.5 text-[12px] font-medium text-[var(--st-red-fg)]"
      title="Kunden er kreditspærret i VISMA"
    >
      Kreditspærret
    </span>
  );
}
