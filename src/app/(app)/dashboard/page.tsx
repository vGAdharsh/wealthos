/* eslint-disable react-hooks/set-state-in-effect -- legacy local-mode hydration reads; replaced by server data in Phase 2 */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toPaise, formatINR, sumPaise, type Paise } from "@/lib/money";
import { savingsRateBps } from "@/lib/domain/calculations";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  StatCard,
} from "@/components/ui";

type LegacyRecord = { amount: string };

function readLocalPaise(key: string): { paise: Paise; unparsed: number } {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { paise: 0, unparsed: 0 };
    const rows = JSON.parse(raw) as LegacyRecord[];
    let unparsed = 0;
    const amounts = rows.map((r) => {
      try {
        return toPaise(r.amount);
      } catch {
        unparsed += 1;
        return 0;
      }
    });
    return { paise: sumPaise(amounts), unparsed };
  } catch {
    return { paise: 0, unparsed: 0 };
  }
}

export default function DashboardPage() {
  const [income, setIncome] = useState<Paise>(0);
  const [expenses, setExpenses] = useState<Paise>(0);
  const [unparsed, setUnparsed] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const inc = readLocalPaise("income");
    const exp = readLocalPaise("expenses");
    setIncome(inc.paise);
    setExpenses(exp.paise);
    setUnparsed(inc.unparsed + exp.unparsed);
    setLoaded(true);
  }, []);

  const bps = savingsRateBps(income, expenses);
  const balance = income - expenses;

  if (!loaded) return null;

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle="Every figure below is computed from your own records."
        actions={<Badge tone="warning">Local mode — PostgreSQL sync arrives in Phase 2</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Income" value={formatINR(income)} tone="info" />
        <StatCard label="Expenses" value={formatINR(expenses)} tone="negative" />
        <StatCard
          label="Net position (income − expenses)"
          value={formatINR(balance)}
          tone={balance >= 0 ? "positive" : "negative"}
          hint="Net worth (assets − liabilities) arrives in Phase 3"
        />
        <StatCard
          label="Savings rate"
          value={bps === null ? "—" : `${(bps / 100).toFixed(2)}%`}
          tone="positive"
          hint={bps === null ? "Defined once income exists" : "Saved share of income"}
        />
      </div>

      {unparsed > 0 && (
        <p className="mt-4 rounded-lg bg-warningsoft px-4 py-3 text-sm text-warning">
          {unparsed} legacy record(s) could not be parsed and are excluded from
          the totals above.
        </p>
      )}

      {income === 0 && expenses === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No records yet"
            description="Add your first income and expense records. In local mode they are stored in this browser; Phase 2 moves everything into your own PostgreSQL database with per-user security."
            action={
              <div className="flex justify-center gap-3">
                <Link href="/income">
                  <Button>Add income</Button>
                </Link>
                <Link href="/expenses">
                  <Button variant="secondary">Add expense</Button>
                </Link>
              </div>
            }
          />
        </div>
      ) : (
        <Card className="mt-8">
          <h2 className="text-base font-semibold">Where this is going</h2>
          <p className="mt-2 text-sm text-muted">
            Phase 2 replaces browser storage with PostgreSQL + Row Level
            Security and brings drill-down into every figure, budgets and
            category analytics. Phase 4 adds the needs-vs-wants engine and
            forecasts with disclosed methods.
          </p>
        </Card>
      )}
    </div>
  );
}
