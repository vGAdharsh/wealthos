/* eslint-disable react-hooks/set-state-in-effect -- async data loading through the repository; replaced by server components in Phase 4 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { formatINR, toPaise, type Paise } from "@/lib/money";
import { savingsRateBps } from "@/lib/domain/calculations";
import { useRepository } from "@/lib/repository/provider";
import type { SavingsGoal, Transaction } from "@/lib/types";
import { Badge, Button, Card, EmptyState, Input, Label, PageHeader, Select, StatCard } from "@/components/ui";

const KIND_LABELS = {
  emergency: "Emergency fund",
  short_term: "Short-term savings",
  long_term: "Long-term savings",
} as const;

export default function SavingsPage() {
  const repo = useRepository();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<SavingsGoal["kind"]>("emergency");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [contribute, setContribute] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const [g, t] = await Promise.all([
        repo.listSavingsGoals(),
        repo.listTransactions({ types: ["income", "expense", "refund", "reimbursement"] }),
      ]);
      setGoals(g);
      setTxs(t);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load savings");
    }
  }, [repo]);

  useEffect(() => {
    load().then(() => setLoaded(true));
  }, [load]);

  // Monthly savings = income − (expenses − refunds), per month, last 6 months.
  const monthly = new Map<string, { income: number; spent: number }>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    monthly.set(d.toISOString().slice(0, 7), { income: 0, spent: 0 });
  }
  for (const t of txs) {
    const m = monthly.get(t.date.slice(0, 7));
    if (!m) continue;
    if (t.type === "income") m.income += t.amountPaise;
    else if (t.type === "expense") m.spent += t.amountPaise;
    else m.spent -= t.amountPaise; // refunds offset
  }
  const months = [...monthly.entries()];
  const totals = months.reduce(
    (acc, [, v]) => ({ income: acc.income + v.income, spent: acc.spent + v.spent }),
    { income: 0, spent: 0 },
  );
  const totalSaved = totals.income - totals.spent;
  const rateBps = savingsRateBps(totals.income, totals.spent);
  const maxBar = Math.max(...months.map(([, v]) => Math.abs(v.income - v.spent)), 1);

  async function createGoal(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    let targetPaise: Paise;
    let currentPaise: Paise;
    try {
      targetPaise = toPaise(target);
      currentPaise = current ? toPaise(current) : 0;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid amount");
      return;
    }
    if (targetPaise <= 0) return setError("Target must be a positive amount");
    if (!name.trim()) return setError("Give the goal a name");
    try {
      await repo.createSavingsGoal({
        name: name.trim(),
        kind,
        targetAmountPaise: targetPaise,
        currentAmountPaise: currentPaise,
        targetDate: targetDate || null,
      });
      setName("");
      setTarget("");
      setCurrent("");
      setTargetDate("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save goal");
    }
  }

  async function addContribution(g: SavingsGoal) {
    const raw = contribute[g.id]?.trim();
    if (!raw) return;
    let paise: Paise;
    try {
      paise = toPaise(raw);
    } catch {
      setError("Invalid contribution amount");
      return;
    }
    await repo.updateSavingsGoal(g.id, { currentAmountPaise: g.currentAmountPaise + paise });
    setContribute((c) => ({ ...c, [g.id]: "" }));
    await load();
  }

  async function removeGoal(g: SavingsGoal) {
    if (!confirm(`Delete savings goal "${g.name}"?`)) return;
    await repo.deleteSavingsGoal(g.id);
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Savings"
        subtitle="Computed strictly from your ledger — transfers between accounts never count as new savings."
      />

      {error && <p className="mb-4 rounded-lg bg-dangersoft px-4 py-3 text-sm text-danger">{error}</p>}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Saved (last 6 months)" value={formatINR(totalSaved)} tone={totalSaved >= 0 ? "positive" : "negative"} />
        <StatCard label="Average monthly savings" value={formatINR(Math.round(totalSaved / 6))} tone="info" />
        <StatCard
          label="Savings rate (6 months)"
          value={rateBps === null ? "—" : `${(rateBps / 100).toFixed(2)}%`}
          tone="positive"
          hint={rateBps === null ? "Defined once income exists" : undefined}
        />
      </div>

      <Card className="mb-8">
        <h2 className="text-base font-semibold">Monthly savings — last 6 months</h2>
        <ul className="mt-4 space-y-2">
          {months.map(([m, v]) => {
            const saved = v.income - v.spent;
            const width = (Math.abs(saved) / maxBar) * 100;
            return (
              <li key={m} className="flex items-center gap-3 text-sm">
                <span className="w-16 shrink-0 tabular-nums text-muted">{m}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface2">
                  <div
                    className={`h-full rounded-full ${saved >= 0 ? "bg-accent" : "bg-danger"}`}
                    style={{ width: `${width}%` }}
                  />
                </div>
                <span className={`w-32 shrink-0 text-right font-semibold tabular-nums ${saved >= 0 ? "text-accent" : "text-danger"}`}>
                  {saved >= 0 ? "+" : "−"}{formatINR(Math.abs(saved))}
                </span>
              </li>
            );
          })}
        </ul>
        {months.every(([, v]) => v.income === 0 && v.spent === 0) && (
          <p className="mt-3 text-xs text-muted">Months with no records show as empty — nothing is estimated.</p>
        )}
      </Card>

      <Card className="mb-8 max-w-2xl">
        <h2 className="text-base font-semibold">New savings goal</h2>
        <form onSubmit={createGoal} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="g-name">Name</Label>
              <Input id="g-name" placeholder="e.g. Emergency fund" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="g-kind">Kind</Label>
              <Select id="g-kind" value={kind} onChange={(e) => setKind(e.target.value as SavingsGoal["kind"])}>
                {Object.entries(KIND_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="g-target">Target (₹)</Label>
              <Input id="g-target" inputMode="decimal" placeholder="e.g. 3,00,000" value={target} onChange={(e) => setTarget(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="g-current">Already saved (₹)</Label>
              <Input id="g-current" inputMode="decimal" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="g-date">Target date</Label>
              <Input id="g-date" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </div>
          </div>
          <Button type="submit">Create goal</Button>
        </form>
      </Card>

      {!loaded ? null : goals.length === 0 ? (
        <EmptyState
          title="No savings goals yet"
          description="Start with an emergency fund — a common target is six months of expenses."
        />
      ) : (
        <div className="space-y-4">
          {goals.map((g) => {
            const pct = Math.min(100, Math.round((g.currentAmountPaise / g.targetAmountPaise) * 100));
            return (
              <Card key={g.id} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold">
                      {g.name} <Badge tone="info">{KIND_LABELS[g.kind]}</Badge>
                    </h2>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatINR(g.currentAmountPaise)} of {formatINR(g.targetAmountPaise)}
                      {g.targetDate ? ` · target date ${g.targetDate}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={pct >= 100 ? "accent" : "neutral"}>{pct}%</Badge>
                    <button onClick={() => removeGoal(g)} className="text-xs font-semibold text-danger hover:underline">Delete</button>
                  </div>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface2">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-3 flex gap-2">
                  <Input
                    placeholder="Add contribution (₹)"
                    inputMode="decimal"
                    value={contribute[g.id] ?? ""}
                    onChange={(e) => setContribute((c) => ({ ...c, [g.id]: e.target.value }))}
                    className="max-w-48"
                  />
                  <Button type="button" variant="secondary" onClick={() => addContribution(g)}>Add</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
