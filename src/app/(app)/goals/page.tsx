"use client";

import { useCallback, useEffect, useState } from "react";
import { formatINR, toPaise, type Paise } from "@/lib/money";
import { projectedGoalContribution } from "@/lib/domain/wealth";
import { useRepository } from "@/lib/repository/provider";
import { GOAL_TYPES, type FinancialGoal, type FinancialGoalInput, type GoalType } from "@/lib/wealth-types";
import { Badge, Button, Card, EmptyState, Input, Label, PageHeader, Select } from "@/components/ui";

export default function GoalsPage() {
  const repo = useRepository();
  const [rows, setRows] = useState<FinancialGoal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [goalType, setGoalType] = useState<GoalType>("emergency_fund");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [priority, setPriority] = useState<FinancialGoalInput["priority"]>("medium");
  const [frequency, setFrequency] = useState<FinancialGoalInput["contributionFrequency"]>("monthly");

  const load = useCallback(async () => {
    try {
      setRows(await repo.wealth.listFinancialGoals());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load goals");
    }
  }, [repo]);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (!name.trim()) throw new Error("Give the goal a name");
      const targetPaise = toPaise(target);
      const currentPaise = current ? toPaise(current) : 0;
      await repo.wealth.createFinancialGoal({
        name: name.trim(), goalType, targetAmountPaise: targetPaise, currentAmountPaise: currentPaise,
        targetDate: targetDate || null, priority, contributionFrequency: frequency, linkedAccount: null,
      });
      setName(""); setTarget(""); setCurrent(""); setTargetDate("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid value");
    }
  }

  async function contribute(g: FinancialGoal) {
    const raw = prompt(`Add contribution to "${g.name}" (₹)`);
    if (!raw) return;
    try {
      const paise = toPaise(raw);
      await repo.wealth.updateFinancialGoal(g.id, { currentAmountPaise: g.currentAmountPaise + paise });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid amount");
    }
  }

  return (
    <div>
      <PageHeader
        title="Financial Goals"
        subtitle="Goals with transparent, arithmetic contribution plans — labelled assumptions, never 'guaranteed' outcomes."
      />
      {error && <p className="mb-4 rounded-lg bg-dangersoft px-4 py-3 text-sm text-danger">{error}</p>}

      <Card className="mb-8 max-w-2xl">
        <form onSubmit={create} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label htmlFor="g-name">Name</Label><Input id="g-name" required placeholder="e.g. Home down payment" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label htmlFor="g-type">Type</Label><Select id="g-type" value={goalType} onChange={(e) => setGoalType(e.target.value as GoalType)}>{GOAL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div><Label htmlFor="g-target">Target (₹)</Label><Input id="g-target" inputMode="decimal" required value={target} onChange={(e) => setTarget(e.target.value)} /></div>
            <div><Label htmlFor="g-cur">Saved so far (₹)</Label><Input id="g-cur" inputMode="decimal" value={current} onChange={(e) => setCurrent(e.target.value)} /></div>
            <div><Label htmlFor="g-date">Target date</Label><Input id="g-date" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} /></div>
            <div><Label htmlFor="g-freq">Contribute</Label><Select id="g-freq" value={frequency} onChange={(e) => setFrequency(e.target.value as FinancialGoalInput["contributionFrequency"])}><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option><option value="one_time">One time</option></Select></div>
          </div>
          <div className="flex items-center gap-3">
            <Label htmlFor="g-pri">Priority</Label>
            <Select id="g-pri" className="max-w-32" value={priority} onChange={(e) => setPriority(e.target.value as FinancialGoalInput["priority"])}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></Select>
          </div>
          <Button type="submit">Create goal</Button>
        </form>
      </Card>

      {rows === null ? null : rows.length === 0 ? (
        <EmptyState title="No goals yet" description="Define what you're saving for — emergency fund, home, education, retirement — and see the arithmetic of getting there." />
      ) : (
        <div className="space-y-4">
          {rows.map((g) => {
            const pct = Math.min(100, Math.round((g.currentAmountPaise / g.targetAmountPaise) * 100));
            const plan = projectedGoalContribution(g.targetAmountPaise, g.currentAmountPaise, g.targetDate, g.contributionFrequency);
            return (
              <Card key={g.id} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold">
                      {g.name} <Badge tone={g.priority === "high" ? "danger" : g.priority === "medium" ? "warning" : "neutral"}>{g.priority}</Badge>
                      <Badge>{GOAL_TYPES.find((t) => t.value === g.goalType)?.label}</Badge>
                    </h2>
                    <p className="mt-0.5 text-xs text-muted">{formatINR(g.currentAmountPaise)} of {formatINR(g.targetAmountPaise)}{g.targetDate ? ` · by ${g.targetDate}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={pct >= 100 ? "accent" : "neutral"}>{pct}%</Badge>
                    <button onClick={() => contribute(g)} className="text-xs font-semibold text-accent hover:underline">+ Add</button>
                    <button onClick={async () => { if (confirm(`Delete goal "${g.name}"?`)) { await repo.wealth.deleteFinancialGoal(g.id); await load(); } }} className="text-xs font-semibold text-danger hover:underline">Delete</button>
                  </div>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} /></div>
                {plan.feasible ? (
                  <p className="mt-3 text-xs text-muted">
                    Suggested: <b className="text-fg">{formatINR(plan.perPeriodPaise)}</b> per {plan.periodsLabel} ({plan.periods} ×). {plan.assumption}
                  </p>
                ) : (
                  <p className="mt-3 text-xs text-muted">{plan.reason}</p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export type { Paise };
