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

export default function IncomePage() {
  const repo = useRepository();
  const [rows, setRows] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [txs, cats] = await Promise.all([
        repo.listTransactions({ types: ["income"] }),
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

  return (
    <div>
      <PageHeader
        title="Income"
        subtitle="Salary, bonuses, freelance, business, rental, interest and more — a filtered view of the unified ledger."
        actions={
          <Button type="button" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Close" : "Add income"}
          </Button>
        }
      />

      {error && <p className="mb-4 rounded-lg bg-dangersoft px-4 py-3 text-sm text-danger">{error}</p>}

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <StatCard label="This month" value={formatINR(thisMonth)} tone="info" />
        <StatCard label="All recorded income" value={formatINR(total)} tone="info" />
      </div>

      {showForm ? (
        <Card className="mb-8 max-w-2xl">
          <TxForm
            key="new-income"
            categories={categories}
            fixedType="income"
            onCategoriesChanged={load}
            onDone={() => { setShowForm(false); load(); }}
          />
        </Card>
      ) : null}

      {!loaded ? null : rows.length === 0 ? (
        <EmptyState
          title="No income recorded yet"
          description="Record your first income — amounts are stored exactly, to the paisa, with dates so monthly trends work."
          action={<Button type="button" onClick={() => setShowForm(true)}>Add income</Button>}
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((t) => {
            const d = txDisplay(t);
            return (
              <li key={t.id} className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-sm">
                <span>
                  <span className="font-semibold">{t.source || t.description || "Income"}</span>
                  <span className="text-muted"> · {t.date}</span>
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
