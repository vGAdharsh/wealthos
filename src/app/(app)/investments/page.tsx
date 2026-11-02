"use client";

import { useCallback, useEffect, useState } from "react";
import { formatINR, toPaise, type Paise } from "@/lib/money";
import { absoluteReturnBps, unrealisedGainPaise, allocationBps } from "@/lib/domain/wealth";
import { xirr } from "@/lib/domain/calculations";
import { useRepository } from "@/lib/repository/provider";
import {
  INVESTMENT_TYPES,
  type Investment,
  type InvestmentFlow,
  type InvestmentInput,
  type InvestmentType,
} from "@/lib/wealth-types";
import { Badge, Button, Card, EmptyState, Input, Label, PageHeader, Select, StatCard } from "@/components/ui";

const EMPTY: InvestmentInput = {
  name: "", investmentType: "mutual_fund", institution: null, purchaseDate: null,
  investedAmountPaise: 0, units: null, navOrPrice: null, currentValuePaise: 0,
  valuationAsOf: null, maturityDate: null, interestRate: null, notes: null,
};

export default function InvestmentsPage() {
  const repo = useRepository();
  const [rows, setRows] = useState<Investment[] | null>(null);
  const [flows, setFlows] = useState<InvestmentFlow[]>([]);
  const [form, setForm] = useState<InvestmentInput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [i, f] = await Promise.all([repo.wealth.listInvestments(), repo.wealth.listInvestmentFlows()]);
      setRows(i);
      setFlows(f);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load investments");
    }
  }, [repo]);

  useEffect(() => {
    load();
  }, [load]);

  const totalInvested = (rows ?? []).reduce((s, r) => s + r.investedAmountPaise, 0);
  const totalCurrent = (rows ?? []).reduce((s, r) => s + r.currentValuePaise, 0);
  const alloc = allocationBps((rows ?? []).map((r) => ({ label: r.name, paise: r.currentValuePaise })));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError(null);
    try {
      const invested = toPaise(String(form.investedAmountPaise === 0 ? "0" : form.investedAmountPaise));
      void invested;
    } catch { /* handled below */ }
    try {
      if (form.investedAmountPaise <= 0) return setError("Invested amount must be positive");
      if (!form.name.trim()) return setError("Give the investment a name");
      if (form.id === undefined) await repo.wealth.createInvestment(form);
      await load();
      setForm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  }

  async function updateValuation(r: Investment, raw: string) {
    try {
      const paise = toPaise(raw);
      await repo.wealth.updateInvestment(r.id, { currentValuePaise: paise, valuationAsOf: new Date().toISOString().slice(0, 10) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid valuation");
    }
  }

  async function addFlow(r: Investment, kind: "contribution" | "withdrawal", raw: string, date: string) {
    try {
      const paise = toPaise(raw);
      if (paise <= 0) throw new Error("Enter a positive amount");
      await repo.wealth.createInvestmentFlow({ investmentId: r.id, kind, amountPaise: paise, date });
      if (kind === "contribution") {
        await repo.wealth.updateInvestment(r.id, { investedAmountPaise: r.investedAmountPaise + paise });
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record flow");
    }
  }

  async function remove(r: Investment) {
    if (!confirm(`Delete "${r.name}" and its recorded flows?`)) return;
    await repo.wealth.deleteInvestment(r.id);
    await load();
  }

  function xirrFor(r: Investment): number | null {
    const mine = flows.filter((f) => f.investmentId === r.id);
    if (mine.length === 0 || r.currentValuePaise <= 0) return null;
    const dated = mine.map((f) => ({
      date: f.date,
      amount: f.kind === "contribution" ? -f.amountPaise : f.amountPaise,
    }));
    dated.push({ date: new Date().toISOString().slice(0, 10), amount: r.currentValuePaise });
    return xirr(dated);
  }

  return (
    <div>
      <PageHeader
        title="Investments"
        subtitle="Your portfolio at cost and at YOUR entered valuations — WealthOS never fabricates live market prices."
        actions={<Button type="button" onClick={() => setForm(form ? null : { ...EMPTY })}>{form ? "Close" : "Add investment"}</Button>}
      />
      {error && <p className="mb-4 rounded-lg bg-dangersoft px-4 py-3 text-sm text-danger">{error}</p>}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Invested capital" value={formatINR(totalInvested)} tone="info" />
        <StatCard label="Current value (your valuations)" value={formatINR(totalCurrent)} tone="info" />
        <StatCard
          label="Unrealised gain"
          value={formatINR(unrealisedGainPaise(totalInvested, totalCurrent))}
          tone={totalCurrent >= totalInvested ? "positive" : "negative"}
          hint={absoluteReturnBps(totalInvested, totalCurrent) !== null ? `${(absoluteReturnBps(totalInvested, totalCurrent)! / 100).toFixed(2)}% absolute` : undefined}
        />
      </div>

      {form && (
        <Card className="mb-8 max-w-2xl">
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label htmlFor="iv-name">Name</Label><Input id="iv-name" required placeholder="e.g. Axis Bluechip Fund" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label htmlFor="iv-type">Type</Label><Select id="iv-type" value={form.investmentType} onChange={(e) => setForm({ ...form, investmentType: e.target.value as InvestmentType })}>{INVESTMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label htmlFor="iv-inv">Invested (₹)</Label><Input id="iv-inv" inputMode="decimal" required value={form.investedAmountPaise === 0 ? "" : form.investedAmountPaise / 100} onChange={(e) => setForm({ ...form, investedAmountPaise: e.target.value === "" ? 0 : toPaiseLoose(e.target.value) })} /></div>
              <div><Label htmlFor="iv-cur">Current value (₹)</Label><Input id="iv-cur" inputMode="decimal" value={form.currentValuePaise === 0 ? "" : form.currentValuePaise / 100} onChange={(e) => setForm({ ...form, currentValuePaise: e.target.value === "" ? 0 : toPaiseLoose(e.target.value) })} /></div>
              <div><Label htmlFor="iv-inst">Institution</Label><Input id="iv-inst" placeholder="e.g. Zerodha" value={form.institution ?? ""} onChange={(e) => setForm({ ...form, institution: e.target.value || null })} /></div>
            </div>
            <p className="text-xs text-muted">Optional: purchase date, units, NAV, maturity, interest rate and notes are supported in the database schema and can be filled later.</p>
            <Button type="submit">Save investment</Button>
          </form>
        </Card>
      )}

      {rows === null ? null : rows.length === 0 ? (
        <EmptyState title="No investments yet" description="Record mutual funds, SIPs, equity, FDs and more. Update valuations yourself — WealthOS will never invent a price." action={<Button type="button" onClick={() => setForm({ ...EMPTY })}>Add investment</Button>} />
      ) : (
        <div className="space-y-4">
          {rows.map((r) => {
            const gain = unrealisedGainPaise(r.investedAmountPaise, r.currentValuePaise);
            const rate = xirrFor(r);
            return (
              <Card key={r.id} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold">{r.name} <Badge>{INVESTMENT_TYPES.find((t) => t.value === r.investmentType)?.label}</Badge>{r.valuationAsOf && <Badge tone="info">valued {r.valuationAsOf}</Badge>}</h2>
                    <p className="mt-0.5 text-xs text-muted">
                      Invested {formatINR(r.investedAmountPaise)} · now {formatINR(r.currentValuePaise)} · gain{" "}
                      <span className={gain >= 0 ? "text-accent" : "text-danger"}>{formatINR(gain)}</span>
                      {rate !== null && ` · XIRR ${(rate * 100).toFixed(2)}% (from your recorded flows)`}
                    </p>
                  </div>
                  <button onClick={() => remove(r)} className="text-xs font-semibold text-danger hover:underline">Delete</button>
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <div>
                    <Label htmlFor={`v-${r.id}`}>Update valuation (₹)</Label>
                    <Input id={`v-${r.id}`} className="max-w-36" inputMode="decimal" placeholder={String(r.currentValuePaise / 100)} onKeyDown={(e) => { if (e.key === "Enter") updateValuation(r, (e.target as HTMLInputElement).value); }} />
                  </div>
                  <div>
                    <Label htmlFor={`f-${r.id}`}>Record flow (₹)</Label>
                    <Input id={`f-${r.id}`} className="max-w-36" inputMode="decimal" placeholder="amount" />
                  </div>
                  <Button type="button" variant="secondary" onClick={() => { const el = document.getElementById(`f-${r.id}`) as HTMLInputElement; const v = el.value; el.value = ""; addFlow(r, "contribution", v, new Date().toISOString().slice(0, 10)); }}>+ Contribution</Button>
                  <Button type="button" variant="secondary" onClick={() => { const el = document.getElementById(`f-${r.id}`) as HTMLInputElement; const v = el.value; el.value = ""; addFlow(r, "withdrawal", v, new Date().toISOString().slice(0, 10)); }}>− Withdrawal</Button>
                </div>
              </Card>
            );
          })}
          {alloc.some((a) => a.bps > 0) && (
            <Card>
              <h2 className="text-base font-semibold">Allocation (by current value)</h2>
              <ul className="mt-4 space-y-2 text-sm">
                {alloc.filter((a) => a.bps > 0).map((a) => (
                  <li key={a.label} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 truncate text-muted">{a.label}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full bg-info" style={{ width: `${a.bps / 100}%` }} /></div>
                    <span className="w-16 text-right tabular-nums">{(a.bps / 100).toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

/** Tolerant decimal → paise for form inputs (floats rejected). */
function toPaiseLoose(v: string): Paise {
  return toPaise(v);
}
