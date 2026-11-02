/* eslint-disable react-hooks/set-state-in-effect -- async data loading through the repository; replaced by server components in Phase 4 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { formatINR, toPaise, type Paise } from "@/lib/money";
import { budgetUtilisation } from "@/lib/domain/calculations";
import { useRepository } from "@/lib/repository/provider";
import type { Budget, Category, Transaction } from "@/lib/types";
import { Badge, Button, Card, EmptyState, Input, Label, PageHeader, Select } from "@/components/ui";

export default function BudgetsPage() {
  const repo = useRepository();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // form state
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [categoryId, setCategoryId] = useState("");

  const load = useCallback(async () => {
    try {
      const [b, c, t] = await Promise.all([
        repo.listBudgets(),
        repo.listCategories(),
        repo.listTransactions({ types: ["expense", "refund", "reimbursement"] }),
      ]);
      setBudgets(b);
      setCategories(c);
      setTxs(t);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load budgets");
    }
  }, [repo]);

  useEffect(() => {
    load().then(() => setLoaded(true));
  }, [load]);

  function spendFor(b: Budget): Paise {
    // Spending = expenses − refunds/reimbursements inside the budget's
    // period and scope. Transfers and income are never spending.
    return txs
      .filter(
        (t) =>
          t.date >= b.periodStart &&
          t.date <= b.periodEnd &&
          (b.categoryId === null || t.categoryId === b.categoryId),
      )
      .reduce(
        (sum, t) =>
          sum + (t.type === "expense" ? t.amountPaise : -t.amountPaise),
        0,
      );
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    let paise: Paise;
    try {
      paise = toPaise(amount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid amount");
      return;
    }
    if (paise <= 0) return setError("Budget must be a positive amount");
    const [y, m] = month.split("-").map(Number);
    const periodStart = `${month}-01`;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const periodEnd = `${month}-${String(lastDay).padStart(2, "0")}`;
    try {
      await repo.createBudget({
        name: name.trim() || (categoryId ? `${categories.find((c) => c.id === categoryId)?.name} — ${month}` : `Overall — ${month}`),
        categoryId: categoryId || null,
        amountPaise: paise,
        periodStart,
        periodEnd,
      });
      setAmount("");
      setName("");
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save budget");
    }
  }

  async function remove(b: Budget) {
    if (!confirm(`Delete budget "${b.name}"?`)) return;
    await repo.deleteBudget(b.id);
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Budgets"
        subtitle="Budget vs actual spending. Spending counts expenses minus refunds; transfers are never spending."
        actions={
          <Button type="button" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Close" : "New budget"}
          </Button>
        }
      />

      {error && <p className="mb-4 rounded-lg bg-dangersoft px-4 py-3 text-sm text-danger">{error}</p>}

      {showForm ? (
        <Card className="mb-8 max-w-2xl">
          <form onSubmit={create} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="b-name">Name (optional)</Label>
                <Input id="b-name" placeholder="Auto-generated if blank" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="b-amount">Amount (₹)</Label>
                <Input id="b-amount" inputMode="decimal" placeholder="e.g. 25,000" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="b-month">Month</Label>
                <Input id="b-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="b-cat">Scope</Label>
                <Select id="b-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">Overall (all categories)</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted">
              A category-scoped budget tracks only that category; an overall budget tracks all spending in the month. Alerts: warning at 80%, over-budget at 100%.
            </p>
            <Button type="submit">Create budget</Button>
          </form>
        </Card>
      ) : null}

      {!loaded ? null : budgets.length === 0 ? (
        <EmptyState
          title="No budgets yet"
          description="Create a monthly budget — overall or per category — and WealthOS tracks utilisation from your actual records."
          action={<Button type="button" onClick={() => setShowForm(true)}>New budget</Button>}
        />
      ) : (
        <div className="space-y-4">
          {budgets.map((b) => {
            const u = budgetUtilisation(spendFor(b), b.amountPaise);
            const pct = Math.round(u.utilisationBps / 100);
            return (
              <Card key={b.id} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold">
                      {b.name}
                      {b.categoryName ? <span className="text-muted"> · {b.categoryName}</span> : <span className="text-muted"> · overall</span>}
                    </h2>
                    <p className="mt-0.5 text-xs text-muted">
                      {b.periodStart} → {b.periodEnd} · spent {formatINR(u.spentPaise)} of {formatINR(u.budgetPaise)} · {formatINR(Math.max(0, u.remainingPaise))} left
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={u.isOverBudget ? "danger" : u.utilisationBps >= 8000 ? "warning" : "accent"}>
                      {u.isOverBudget ? "Over budget" : pct >= 80 ? "Watch — 80%+" : "On track"} · {pct}%
                    </Badge>
                    <button onClick={() => remove(b)} className="text-xs font-semibold text-danger hover:underline">Delete</button>
                  </div>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface2">
                  <div
                    className={`h-full rounded-full ${u.isOverBudget ? "bg-danger" : u.utilisationBps >= 8000 ? "bg-warning" : "bg-accent"}`}
                    style={{ width: `${Math.min(100, u.utilisationBps / 100)}%` }}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
