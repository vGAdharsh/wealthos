import { createServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { chatCompletion, isAiConfigured, type ChatMessage } from "@/services/ai/provider";
import { TOOL_DEFS, executeTool } from "@/services/ai/tools";

const SYSTEM_PROMPT = `You are the WealthOS AI financial assistant for an Indian user (currency INR, ₹).

Rules you must never break:
1. ALL numbers you state must come from tool results in this conversation. Never calculate, estimate or invent a figure yourself.
2. If a tool returns no data or an error, say honestly that the records needed are not available.
3. Distinguish clearly: the user's actual records, general financial knowledge, and your interpretation.
4. Never present information as guaranteed returns or regulated financial advice. The user decides.
5. Be constructive and non-judgmental. Keep answers short and concrete.
6. Amounts arrive already formatted in Indian rupee notation — use them verbatim.`;

export async function POST(req: Request) {
  if (!isSupabaseConfigured())
    return Response.json({ error: "setup", detail: "Supabase is not configured." }, { status: 503 });
  if (!isAiConfigured())
    return Response.json({ error: "setup", detail: "No AI provider key configured (AI_API_KEY)." }, { status: 503 });

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { messages?: unknown } | null;
  const msgs = Array.isArray(body?.messages) ? body!.messages : null;
  if (!msgs || msgs.length === 0 || msgs.length > 20)
    return Response.json({ error: "invalid_request" }, { status: 400 });

  // Keep only clean, bounded user/assistant turns — tool traffic is rebuilt here.
  const history: ChatMessage[] = (msgs as { role: unknown; content: unknown }[])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.length <= 4000)
    .slice(-10)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const convo: ChatMessage[] = [{ role: "system", content: SYSTEM_PROMPT }, ...history];
  const trace: { tool: string; ok: boolean }[] = [];

  for (let i = 0; i < 6; i++) {
    let message: ChatMessage | null;
    try {
      ({ message } = await chatCompletion(convo, TOOL_DEFS));
    } catch (e) {
      return Response.json({ error: "provider", detail: e instanceof Error ? e.message : "AI provider failed" }, { status: 502 });
    }
    if (!message) break;

    if (message.tool_calls?.length) {
      convo.push(message);
      for (const call of message.tool_calls) {
        let result: unknown;
        let ok = true;
        try {
          const args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
          result = await executeTool(call.function.name, args, supabase);
        } catch (e) {
          ok = false;
          result = { error: e instanceof Error ? e.message : "tool failed" };
        }
        trace.push({ tool: call.function.name, ok });
        convo.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result).slice(0, 8000),
        });
      }
      continue;
    }
    return Response.json({ reply: message.content ?? "", trace });
  }
  return Response.json({ reply: "I could not complete that with the available records.", trace });
}
