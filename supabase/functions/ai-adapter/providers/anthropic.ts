import type { AIProvider, AIRequest, AIResponse } from "../types.ts";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export function createAnthropicProvider(apiKey: string): AIProvider {
  return {
    name: "anthropic",
    async call(req: AIRequest): Promise<AIResponse> {
      const res = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: req.model,
          max_tokens: req.maxOutputTokens,
          temperature: req.temperature,
          system: req.systemPrompt,
          messages: [{ role: "user", content: req.userInput }],
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(
          `Anthropic API ${res.status} ${res.statusText}: ${errBody}`,
        );
      }

      const data = await res.json();
      const text =
        data.content
          ?.filter((block: { type: string }) => block.type === "text")
          ?.map((block: { text: string }) => block.text)
          ?.join("") ?? "";

      return {
        text,
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
      };
    },
  };
}
