import type { LagoRole } from "@/lago/auth/useCurrentLagoRole";

/**
 * Brief 84 (28. sep 2026) · portefolje-tilstand i sessionStorage.
 *
 * Vi bruger sessionStorage frem for URL som primær kilde af én grund:
 * react-router's <Link to="/foo"> dropper query-parametre pr. default,
 * så en ?passer=12 ville forsvinde ved første navigation. sessionStorage
 * overlever alle interne navigationer inden for samme fane.
 *
 * URL brugt som ét-gangs-bootstrap i PortefoljeProvider: åbner Simon
 * en delt "/aktiviteter?passer=12"-link, læser vi param'en, skriver
 * til sessionStorage og rydder param'en. Fra da af er det session-
 * storage der styrer. Rydder sessionStorage → Tilbage til mine.
 */

const COVERAGE_KEY = "lago_coverage_v1";
const ROLE_VIEW_KEY = "lago_role_view_v1";

export interface StoredCoverage {
  targetSalesId: number;
  targetUserId: string;
  targetLabel: string;
  targetRole: LagoRole;
  logId: number | null;
}

function safeGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // sessionStorage kan være utilgængelig (private browsing, quota).
    // Dækning virker så kun for denne render — næste reload nulstiller.
  }
}

function safeRemove(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignoreret — se safeSet.
  }
}

export function readCoverage(): StoredCoverage | null {
  const raw = safeGet(COVERAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredCoverage;
    if (typeof parsed.targetSalesId !== "number") return null;
    if (typeof parsed.targetUserId !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCoverage(coverage: StoredCoverage): void {
  safeSet(COVERAGE_KEY, JSON.stringify(coverage));
}

export function updateCoverageLogId(logId: number): void {
  const current = readCoverage();
  if (!current) return;
  writeCoverage({ ...current, logId });
}

export function clearCoverage(): void {
  safeRemove(COVERAGE_KEY);
}

export function readRoleView(): LagoRole | null {
  const raw = safeGet(ROLE_VIEW_KEY);
  if (!raw) return null;
  if (raw === "saelger" || raw === "kontor" || raw === "ledelse" || raw === "admin") {
    return raw;
  }
  return null;
}

export function writeRoleView(role: LagoRole): void {
  safeSet(ROLE_VIEW_KEY, role);
}

export function clearRoleView(): void {
  safeRemove(ROLE_VIEW_KEY);
}
