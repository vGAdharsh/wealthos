/**
 * AI provider adapter — provider-independent, OpenAI-compatible, server-only.
 * Key, model and base URL come from environment variables so the model can
 * be replaced without code changes (spec Part 6.6). Never imported from a
 * client component.
 */

export function aiConfig() {
  return {
    apiKey: process.env.AI_API_KEY ?? "",
    baseUrl: process.env.AI_BASE_URL || "https://api.openai.com/v1",
    model: process.env.AI_MODEL || "gpt-4o",
  };
}

export function isAiConfigured(): boolean {
  return aiConfig().apiKey.length > 0;
}

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
};

export async function chatCompletion(
  messages: ChatMessage[],
  tools?: unknown[],
): Promise<{ message: ChatMessage | null }> {
  const cfg = aiConfig();
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      ...(tools ? { tools, tool_choice: "auto" } : {}),
    }),
  });
  if (!res.ok) {
    const detail = res.status === 401 ? "invalid AI key" : `provider returned ${res.status}`;
    throw new Error(`AI provider error: ${detail}`);
  }
  const json = (await res.json()) as {
    choices?: { message?: ChatMessage }[];
  };
  return { message: json.choices?.[0]?.message ?? null };
}
