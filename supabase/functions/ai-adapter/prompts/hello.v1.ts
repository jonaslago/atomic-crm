// GENERATED from /prompts/hello.v1.md — do not edit by hand.
// Run `node lago/sync-prompts.mjs` after changing the .md source.
import type { LoadedPrompt } from "../types.ts";

export const prompt: LoadedPrompt = {
  meta: {
    role: "hello",
    version: "v1",
    model: "claude-haiku-4-5",
    max_output_tokens: 200,
    temperature: 0,
    description: "First-call smoke test for the LAGO ai-adapter Edge Function.",
  },
  body: "You are answering a one-off smoke test for the LAGO CRM AI plumbing.\n\nReply in Danish with one short sentence (max 25 words) confirming:\n- you received the test,\n- which model you are,\n- and that you understand this is just a plumbing check — no real CRM task is being asked.\n\nDo not add anything else. No greetings, no offers to help.",
};
