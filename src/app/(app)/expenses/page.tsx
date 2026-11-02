/* eslint-disable react-hooks/set-state-in-effect -- async data loading through the repository; replaced by server components in Phase 4 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { formatINR } from "@/lib/money";
import { useRepository } from "@/lib/repository/provider";
import type { Category, Transaction } from "@/lib/types";
import { TxForm } from "@/components/TxForm";
import { txDisplay } from "@/components/tx";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  StatCard,
} from "@/components/ui";

export default function ExpensesPage() {
  const repo = useRepository();
  const [rows, setRows] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [txs, cats] = await Promise.all([
        repo.listTransactions({ types: ["expense"] }),
        repo.listCategories(),
      ]);
      setRows(txs);
      setCategories(cats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load");
    }
  }, [repo]);

  useEffect(() => {
    load().then(() => setLoaded(true));
  }, [load]);

  const total = rows.reduce((sum, r) => sum + r.amountPaise, 0);
  const thisMonth = rows
    .filter((r) => r.date.startsWith(new Date().toISOString().slice(0, 7)))
    .reduce((sum, r) => sum + r.amountPaise, 0);

  // Category breakdown for the current view.
  const byCategory = new Map<string, number>();
  for (const r of rows) {
    const key = r.categoryName ?? "Uncategorised";
    byCategory.set(key, (byCategory.get(key) ?? 0) + r.amountPaise);
  }
  const topCategories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle="Categorised spending with dates — the basis for every analytic WealthOS produces."
        actions={
          <Button type="button" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Close" : "Add expense"}
          </Button>
        }
      />

      {error && <p className="mb-4 rounded-lg bg-dangersoft px-4 py-3 text-sm text-danger">{error}</p>}

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <StatCard label="This month" value={formatINR(thisMonth)} tone="negative" />
        <StatCard label="All recorded expenses" value={formatINR(total)} tone="negative" />
      </div>

      {showForm ? (
        <Card className="mb-8 max-w-2xl">
          <TxForm
            key="new-expense"
            categories={categories}
            fixedType="expense"
            onCategoriesChanged={load}
            onDone={() => { setShowForm(false); load(); }}
          />
        </Card>
      ) : null}

      {rows.length > 0 && (
        <Card className="mb-8">
          <h2 className="text-base font-semibold">Top categories (all time)</h2>
          <ul className="mt-4 space-y-2">
            {topCategories.map(([name, paise]) => (
              <li key={name} className="flex items-center gap-3 text-sm">
                <span className="w-40 shrink-0 truncate text-muted">{name}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface2">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(paise / topCategories[0][1]) * 100}%` }} />
                </div>
                <span className="w-28 shrink-0 text-right font-semibold tabular-nums">{formatINR(paise)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!loaded ? null : rows.length === 0 ? (
        <EmptyState
          title="No expenses recorded yet"
          description="Record your first expense — categories mirror the system catalogue, and dates make budgets and trends possible."
          action={<Button type="button" onClick={() => setShowForm(true)}>Add expense</Button>}
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((t) => {
            const d = txDisplay(t);
            return (
              <li key={t.id} className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-sm">
                <span>
                  <span className="font-semibold">{t.description || t.source || "Expense"}</span>
                  <span className="text-muted"> · {t.categoryName ?? "Uncategorised"} · {t.date}</span>
                  {t.isRecurring && <Badge tone="info">recurring</Badge>}
                </span>
                <span className={`font-semibold tabular-nums ${d.tone}`}>{d.text}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
