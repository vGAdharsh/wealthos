/* eslint-disable react-hooks/set-state-in-effect -- async data loading through the repository; replaced by server components in Phase 4 */
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatINR, sumPaise } from "@/lib/money";
import { savingsRateBps } from "@/lib/domain/calculations";
import { useRepository } from "@/lib/repository/provider";
import type { Budget, Transaction } from "@/lib/types";
import { txDisplay } from "@/components/tx";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  StatCard,
} from "@/components/ui";

function monthScope(offset = 0): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return d.toISOString().slice(0, 7);
}

export default function DashboardPage() {
  const repo = useRepository();
  const [txs, setTxs] = useState<Transaction[] | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [legacyCount, setLegacyCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const [all, b] = await Promise.all([
        repo.listTransactions(),
        repo.listBudgets(),
      ]);
      setTxs(all);
      setBudgets(b);
      if (repo.mode === "database") {
        const legacy = ["income", "expenses", "wealthos-income-v2", "wealthos-expenses-v2"];
        let count = 0;
        for (const key of legacy) {
          try {
            const raw = localStorage.getItem(key);
            if (raw) count += (JSON.parse(raw) as unknown[]).length;
          } catch {
            /* ignore unreadable legacy keys */
          }
        }
        setLegacyCount(count);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load dashboard");
    }
  }, [repo]);

  useEffect(() => {
    load();
  }, [load]);

  if (error)
    return (
      <div>
        <PageHeader title="Overview" />
        <p className="rounded-lg bg-dangersoft px-4 py-3 text-sm text-danger">{error}</p>
      </div>
    );
  if (!txs) return null;

  const month = monthScope();
  const inMonth = (t: Transaction) => t.date.startsWith(month);
  const monthIncome = sumPaise(txs.filter((t) => t.type === "income" && inMonth(t)).map((t) => t.amountPaise));
  const monthExpense = sumPaise(
    txs.filter((t) => (t.type === "expense" || t.type === "refund" || t.type === "reimbursement") && inMonth(t)).map((t) =>
      t.type === "expense" ? t.amountPaise : -t.amountPaise,
    ),
  );
  const monthSavings = monthIncome - monthExpense;
  const bps = savingsRateBps(monthIncome, monthExpense);

  const budgetRows = budgets.map((b) => {
    const spending = sumPaise(
      txs
        .filter(
          (t) =>
            t.date >= b.periodStart &&
            t.date <= b.periodEnd &&
            (b.categoryId === null || t.categoryId === b.categoryId),
        )
        .map((t) => (t.type === "expense" ? t.amountPaise : t.type === "refund" || t.type === "reimbursement" ? -t.amountPaise : 0)),
    );
    return { budget: b, spending };
  });

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle={`Figures for ${month}, computed from your records.`}
        actions={
          repo.mode === "local" ? (
            <Badge tone="warning">Local mode — PostgreSQL sync in database mode</Badge>
          ) : (
            <Badge tone="accent">Database mode</Badge>
          )
        }
      />

      {legacyCount > 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warningsoft px-4 py-3">
          <p className="text-sm text-warning">
            We found <b>{legacyCount}</b> record(s) from the old browser-only version. Move them into your database so they back up, sync and secure.
          </p>
          <Link href="/settings#migrate">
            <Button type="button" variant="secondary">Review migration</Button>
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Income this month" value={formatINR(monthIncome)} tone="info" />
        <StatCard label="Spending this month" value={formatINR(monthExpense)} tone="negative" hint="Expenses minus refunds" />
        <StatCard
          label="Saved this month"
          value={formatINR(monthSavings)}
          tone={monthSavings >= 0 ? "positive" : "negative"}
        />
        <StatCard
          label="Savings rate"
          value={bps === null ? "—" : `${(bps / 100).toFixed(2)}%`}
          tone="positive"
          hint={bps === null ? "Defined once the month has income" : "Saved share of this month's income"}
        />
      </div>

      {budgetRows.length > 0 && (
        <Card className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">Budgets this period</h2>
            <Link href="/budgets" className="text-xs font-semibold text-accent hover:underline">Manage budgets</Link>
          </div>
          <ul className="space-y-3">
            {budgetRows.map(({ budget, spending }) => {
              const pct = Math.round((spending / budget.amountPaise) * 100);
              const over = spending > budget.amountPaise;
              return (
                <li key={budget.id} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span>
                      {budget.name}
                      <span className="text-muted"> · {formatINR(spending)} of {formatINR(budget.amountPaise)}</span>
                    </span>
                    <Badge tone={over ? "danger" : pct >= 80 ? "warning" : "accent"}>{pct}%</Badge>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface2">
                    <div
                      className={`h-full rounded-full ${over ? "bg-danger" : pct >= 80 ? "bg-warning" : "bg-accent"}`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Recent transactions</h2>
          <Link href="/transactions" className="text-xs font-semibold text-accent hover:underline">View all</Link>
        </div>
        {txs.length === 0 ? (
          <EmptyState
            title="No records yet"
            description="Add income and expenses — or import a CSV — and this dashboard comes alive with your own numbers."
            action={
              <div className="flex justify-center gap-3">
                <Link href="/income"><Button type="button">Add income</Button></Link>
                <Link href="/expenses"><Button type="button" variant="secondary">Add expense</Button></Link>
              </div>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {txs.slice(0, 6).map((t) => {
              const d = txDisplay(t);
              return (
                <li key={t.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span>
                    <span className="font-medium">{t.description || t.source || t.type}</span>
                    <span className="text-muted"> · {t.date}</span>
                  </span>
                  <span className={`font-semibold tabular-nums ${d.tone}`}>{d.text}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
