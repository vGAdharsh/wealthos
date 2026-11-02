import { createServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { aiConfig, chatCompletion, isAiConfigured } from "@/services/ai/provider";
import { executeTool } from "@/services/ai/tools";

/**
 * Deterministic monthly review: every number is computed by executeTool
 * (integer paise → formatted ₹). If an AI key exists, a short narrative is
 * generated under a strict "use ONLY these numbers" instruction; without a
 * key the deterministic summary is still returned — never a blank page.
 */
export async function GET(req: Request) {
  if (!isSupabaseConfigured())
    return Response.json({ error: "setup" }, { status: 503 });
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const monthParam = new URL(req.url).searchParams.get("month") ?? "";
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam)
    ? monthParam
    : new Date().toISOString().slice(0, 7);

  const summary = (await executeTool("generate_monthly_review", { month }, supabase)) as Record<string, unknown>;

  let narrative: string | null = null;
  if (isAiConfigured()) {
    try {
      const { message } = await chatCompletion([
        {
          role: "user",
          content: `Write a 3-4 sentence friendly monthly financial review for ${month}. Use ONLY these computed figures, verbatim: ${JSON.stringify(summary)}. Mention one improvement idea at most. No guarantees, no advice beyond arithmetic observations.`,
        },
      ]);
      narrative = message?.content ?? null;
    } catch {
      narrative = null; // numbers-only review still works
    }
  }

  return Response.json({ month, summary, narrative, aiEnabled: isAiConfigured(), model: isAiConfigured() ? aiConfig().model : null });
}
