 
"use client";

import { useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { Button, Card, Input, PageHeader } from "@/components/ui";

type Msg = { role: "user" | "assistant"; content: string };
type Review = { month: string; summary: Record<string, unknown>; narrative: string | null; aiEnabled: boolean };

const SUGGESTIONS = [
  "How much did I spend last month?",
  "Where is most of my money going?",
  "Am I spending more than usual?",
  "Which subscriptions should I review?",
  "How has my net worth changed?",
  "Am I on track with my emergency fund?",
];

export default function AiPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState<string | null>(null);
  const [trace, setTrace] = useState<string[]>([]);
  const [review, setReview] = useState<Review | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput("");
    setSetup(null);
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setBusy(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const json = await res.json();
      if (res.status === 503) {
        setSetup(json.detail ?? "AI is not configured.");
        return;
      }
      if (!res.ok) {
        setSetup(json.detail ?? "The AI request failed.");
        return;
      }
      setTrace((json.trace ?? []).map((t: { tool: string; ok: boolean }) => `${t.tool}${t.ok ? "" : " (failed)"}`));
      setMessages([...next, { role: "assistant", content: json.reply }]);
    } catch {
      setSetup("Could not reach the AI service.");
    } finally {
      setBusy(false);
    }
  }

  async function loadReview(month: string) {
    setReviewBusy(true);
    try {
      const res = await fetch(`/api/ai/monthly-review?month=${month}`);
      if (res.ok) setReview(await res.json());
    } finally {
      setReviewBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="AI Financial Assistant"
        subtitle="WealthOS calculates. AI interprets. The user decides — every number the assistant states comes from your records through read-only tools."
      />

      {!isSupabaseConfigured() ? (
        <Card>
          <h2 className="text-base font-semibold">Setup needed</h2>
          <p className="mt-2 text-sm text-muted">
            The AI assistant reads your records server-side through your database, so it activates once Supabase (and an AI key) are configured. Everything else in WealthOS already works without it.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted">
            <li><code>NEXT_PUBLIC_SUPABASE_URL</code> + <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> — your database and sign-in</li>
            <li><code>AI_API_KEY</code> (+ optional <code>AI_MODEL</code>, <code>AI_BASE_URL</code>) — server-side only, never shipped to the browser</li>
          </ul>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <div className="flex h-96 flex-col">
              <div className="flex-1 space-y-3 overflow-y-auto">
                {messages.length === 0 && (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                    <p className="max-w-md text-sm text-muted">Ask about your own records. The assistant can only see data your signed-in account can see — via 11 read-only tools; it cannot modify anything.</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {SUGGESTIONS.map((s) => (
                        <button key={s} onClick={() => send(s)} className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-surface2">{s}</button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`max-w-2xl rounded-2xl px-4 py-3 text-sm ${m.role === "user" ? "ml-auto bg-accentsoft" : "bg-surface2"}`}>
                    {m.content}
                  </div>
                ))}
                {busy && <p className="text-xs text-muted">Checking your records…</p>}
              </div>
              <form onSubmit={(e) => { e.preventDefault(); send(); }} className="mt-3 flex gap-2 border-t border-border pt-3">
                <Input placeholder="Ask about your finances…" value={input} onChange={(e) => setInput(e.target.value)} />
                <Button type="submit" disabled={busy || !input.trim()}>Send</Button>
              </form>
              {trace.length > 0 && (
                <p className="mt-2 text-[11px] text-muted">Tools used: {trace.join(", ")}</p>
              )}
              {setup && <p className="mt-2 rounded-lg bg-warningsoft px-3 py-2 text-xs text-warning">{setup}</p>}
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Monthly financial review</h2>
                <p className="mt-1 text-xs text-muted">Deterministic summary — computed from your ledger. The narrative (when AI is configured) is generated under a use-only-these-numbers instruction.</p>
              </div>
              <div className="flex items-end gap-2">
                <div>
                  <label htmlFor="rev-month" className="mb-1.5 block text-sm font-medium">Month</label>
                  <Input id="rev-month" type="month" defaultValue={new Date().toISOString().slice(0, 7)} onChange={(e) => loadReview(e.target.value)} className="max-w-40" />
                </div>
              </div>
            </div>
            {reviewBusy && <p className="mt-3 text-xs text-muted">Computing…</p>}
            {review && !reviewBusy && (
              <div className="mt-4">
                {review.narrative && <p className="mb-4 rounded-xl bg-surface2 px-4 py-3 text-sm">{review.narrative}</p>}
                <pre className="overflow-x-auto rounded-xl border border-border bg-surface2 p-4 text-xs">{JSON.stringify(review.summary, null, 2)}</pre>
                {!review.aiEnabled && <p className="mt-2 text-xs text-muted">AI narrative is off (no key configured) — the deterministic review is shown as-is.</p>}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
