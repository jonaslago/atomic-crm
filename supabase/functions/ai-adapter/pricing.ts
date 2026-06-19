// Rough per-1M-token list prices (USD), keyed by model.
// Numbers are stale by definition; update when Anthropic changes pricing.
// Sourced June 2026 from https://www.anthropic.com/pricing#api
const ANTHROPIC_USD_PER_M_TOKENS: Record<
  string,
  { input: number; output: number }
> = {
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-opus-4-7": { input: 15, output: 75 },
};

// Indicative FX. Real cost on the Anthropic invoice depends on the day's
// rate plus card-issuer FX margin — this is for in-app indication only.
const USD_TO_DKK = 7.0;

export function estimateCostDkk(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
): number | null {
  if (provider !== "anthropic") return null;
  const rate = ANTHROPIC_USD_PER_M_TOKENS[model];
  if (!rate) return null;
  const usd =
    (inputTokens * rate.input + outputTokens * rate.output) / 1_000_000;
  return Number((usd * USD_TO_DKK).toFixed(4));
}
