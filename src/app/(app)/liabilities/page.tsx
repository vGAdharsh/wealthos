/* eslint-disable react-hooks/set-state-in-effect -- async data loading through the repository */
"use client";

import { useCallback, useEffect, useState } from "react";
import { formatINR, toPaise, type Paise } from "@/lib/money";
import { useRepository } from "@/lib/repository/provider";
import { LIABILITY_TYPES, type Liability, type LiabilityInput, type LiabilityType } from "@/lib/wealth-types";
import { Button, Card, EmptyState, Input, Label, PageHeader, Select, StatCard } from "@/components/ui";

export default function LiabilitiesPage() {
  const repo = useRepository();
  const [rows, setRows] = useState<Liability[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [liabilityType, setLiabilityType] = useState<LiabilityType>("credit_card");
  const [outstanding, setOutstanding] = useState("");
  const [emi, setEmi] = useState("");
  const [emiDay, setEmiDay] = useState("");

  const load = useCallback(async () => {
    try {
      setRows(await repo.wealth.listLiabilities());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load liabilities");
    }
  }, [repo]);

  useEffect(() => {
    load();
  }, [load]);

  const total = (rows ?? []).reduce((s, r) => s + r.outstandingPaise, 0);
  const monthlyEmi = (rows ?? []).reduce((s, r) => s + (r.emiAmountPaise ?? 0), 0);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const out = toPaise(outstanding);
      const emiPaise: Paise | null = emi ? toPaise(emi) : null;
      if (!name.trim()) throw new Error("Give the liability a name");
      const input: LiabilityInput = {
        liabilityType,
        name: name.trim(),
        outstandingPaise: out,
        interestRate: null,
        emiAmountPaise: emiPaise,
        emiDueDay: emiDay ? Number(emiDay) : null,
        notes: null,
      };
      await repo.wealth.createLiability(input);
      setName("");
      setOutstanding("");
      setEmi("");
      setEmiDay("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid value");
    }
  }

  return (
    <div>
      <PageHeader
        title="Liabilities & Debt"
        subtitle="What you owe — credit cards, personal, home, vehicle and education loans."
      />
      {error && <p className="mb-4 rounded-lg bg-dangersoft px-4 py-3 text-sm text-danger">{error}</p>}

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <StatCard label="Total outstanding" value={formatINR(total)} tone="negative" />
        <StatCard label="Monthly EMI commitments" value={formatINR(monthlyEmi)} tone="warning" hint="From recorded EMI amounts" />
      </div>

      <Card className="mb-8 max-w-2xl">
        <form onSubmit={create} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label htmlFor="l-name">Name</Label><Input id="l-name" required placeholder="e.g. SBI Home Loan" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label htmlFor="l-type">Type</Label><Select id="l-type" value={liabilityType} onChange={(e) => setLiabilityType(e.target.value as LiabilityType)}>{LIABILITY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><Label htmlFor="l-out">Outstanding (₹)</Label><Input id="l-out" inputMode="decimal" required value={outstanding} onChange={(e) => setOutstanding(e.target.value)} /></div>
            <div><Label htmlFor="l-emi">EMI (₹, optional)</Label><Input id="l-emi" inputMode="decimal" value={emi} onChange={(e) => setEmi(e.target.value)} /></div>
            <div><Label htmlFor="l-day">EMI day (1–31)</Label><Input id="l-day" type="number" min={1} max={31} value={emiDay} onChange={(e) => setEmiDay(e.target.value)} /></div>
          </div>
          <Button type="submit">Add liability</Button>
        </form>
      </Card>

      {rows === null ? null : rows.length === 0 ? (
        <EmptyState title="No liabilities recorded" description="Record loans and card outstanding to see your true net worth and EMI load." />
      ) : (
        <ul className="space-y-2">
          {rows.map((l) => (
            <li key={l.id} className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-sm">
              <span>
                <span className="font-semibold">{l.name}</span>
                <span className="text-muted"> · {LIABILITY_TYPES.find((t) => t.value === l.liabilityType)?.label}</span>
                {l.emiAmountPaise !== null && <span className="text-muted"> · EMI {formatINR(l.emiAmountPaise)}{l.emiDueDay ? ` on day ${l.emiDueDay}` : ""}</span>}
              </span>
              <span className="flex items-center gap-3">
                <span className="font-semibold tabular-nums text-danger">{formatINR(l.outstandingPaise)}</span>
                <button onClick={async () => { await repo.wealth.deleteLiability(l.id); await load(); }} className="text-xs font-semibold text-danger hover:underline">Delete</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
