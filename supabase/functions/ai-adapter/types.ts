// Provider-agnostic types for the ai-adapter Edge Function.
// CRM code talks to *an* AI provider, never to "Anthropic" directly.

export interface PromptMeta {
  role: string;
  version: string;
  model: string;
  max_output_tokens: number;
  temperature: number;
  description?: string;
}

export interface LoadedPrompt {
  meta: PromptMeta;
  body: string;
}

export interface AIRequest {
  systemPrompt: string;
  userInput: string;
  model: string;
  maxOutputTokens: number;
  temperature: number;
}

export interface AIResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export interface AIProvider {
  name: string;
  call(req: AIRequest): Promise<AIResponse>;
}
