import type { LoadedPrompt } from "./types.ts";
import { PROMPTS } from "./prompts/index.ts";

// Prompts are .md files under /prompts/ at the repo root; the build step
// `node lago/sync-prompts.mjs` regenerates ./prompts/*.ts and ./prompts/index.ts
// from them so they can be bundled with the Edge Function.

export function loadPrompt(role: string, version: string): LoadedPrompt {
  if (!/^[a-z0-9_-]+$/i.test(role) || !/^[a-z0-9._-]+$/i.test(version)) {
    throw new Error(`Invalid role/version: ${role}/${version}`);
  }
  const key = `${role}.${version}`;
  const prompt = PROMPTS[key];
  if (!prompt) {
    throw new Error(
      `Unknown prompt: ${key}. Run \`node lago/sync-prompts.mjs\` and confirm /prompts/${role}.${version}.md exists.`,
    );
  }
  return prompt;
}
