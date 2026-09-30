// Small helper for LAGO admin scripts that talk to the cloud Supabase
// project via the Management API. We read the personal access token from
// supabase/.env.local (SUPABASE_ACCESS_TOKEN) and hard-code the project
// ref so the scripts stay obvious. Every script that mutates data has to
// pass an explicit `confirm=YES` flag on the command line so nothing runs
// by accident.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

export const PROJECT_REF = "jayufvgsgiuuzpaptjlh";
export const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ENV_PATH = resolve(__dirname, "..", "..", "supabase", ".env.local");

function readEnv() {
  const text = readFileSync(ENV_PATH, "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[key] = val;
  }
  return env;
}

export function accessToken() {
  const env = readEnv();
  const token = env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "SUPABASE_ACCESS_TOKEN missing from supabase/.env.local — cannot talk to Management API",
    );
  }
  return token;
}

/**
 * Run one SQL statement (or multiple, separated by `;`) against the cloud
 * database via POST /v1/projects/{ref}/database/query. Returns the parsed
 * JSON body. Throws on non-2xx with the response body appended.
 */
export async function runSql(sql, { token = accessToken() } = {}) {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`SQL failed (${res.status}): ${body}`);
  }
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

/**
 * Guard for destructive/write scripts. Every mutating script has to be
 * called with `confirm=YES` as an argv entry — no exceptions.
 */
export function requireConfirm(argv = process.argv) {
  if (!argv.some((a) => a === "confirm=YES")) {
    console.error(
      "Refusing to run — re-invoke with confirm=YES on the command line to acknowledge you know this touches production data.",
    );
    process.exit(2);
  }
}
