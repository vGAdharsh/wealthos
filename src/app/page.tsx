import Link from "next/link";
import { redirect } from "next/navigation";
import {
  createServerSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import { Badge, Card } from "@/components/ui";

const phases = [
  ["Phase 1", "Foundation — this release: design system, navigation, auth-ready database layer, exact money math"],
  ["Phase 2", "Financial engine — transactions, income, expenses, budgets, savings, CSV import/export"],
  ["Phase 3", "Wealth — investments with XIRR, assets, liabilities, net worth, goals, calendar"],
  ["Phase 4", "Analytics — needs vs wants, forecasting with disclosed methods, drill-down reports"],
  ["Phase 5", "AI — assistant with read-only tools, categorisation, monthly review"],
  ["Phase 6", "Knowledge — document upload and source-cited answers (RAG)"],
];

export default async function Home() {
  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect("/dashboard");
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-4xl font-bold tracking-tight">
          Wealth<span className="text-accent">OS</span>
        </h1>
        {!isSupabaseConfigured() && <Badge tone="warning">Setup mode</Badge>}
      </div>
      <p className="text-lg text-muted">
        A personal financial operating system for India — every rupee earned,
        spent, saved and invested, calculated from your own records.
      </p>
      <p className="mt-2 text-sm font-medium text-fg">
        WealthOS calculates. AI interprets. The user decides.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={isSupabaseConfigured() ? "/signin" : "/dashboard"}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accentfg hover:opacity-90"
        >
          {isSupabaseConfigured() ? "Sign in" : "Open the app (local mode)"}
        </Link>
        {isSupabaseConfigured() && (
          <Link
            href="/signup"
            className="rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-semibold hover:bg-surface2"
          >
            Create an account
          </Link>
        )}
      </div>

      <Card className="mt-12">
        <h2 className="text-base font-semibold">Build roadmap</h2>
        <p className="mt-1 text-sm text-muted">
          Modules appear as their phase lands. Pages never show invented
          numbers.
        </p>
        <dl className="mt-4 space-y-3">
          {phases.map(([phase, desc]) => (
            <div key={phase} className="flex gap-3 text-sm">
              <dt className="w-20 shrink-0 font-semibold text-accent">
                {phase}
              </dt>
              <dd className="text-muted">{desc}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </main>
  );
}
