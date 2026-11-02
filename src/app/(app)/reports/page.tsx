/* eslint-disable react-hooks/set-state-in-effect -- async data loading through the repository */
"use client";

import { useCallback, useEffect, useState } from "react";
import { formatINR } from "@/lib/money";
import { savingsRateBps } from "@/lib/domain/calculations";
import { forecastFromMonthlyTotals, unusualCategories, type MonthlyTotal } from "@/lib/domain/forecast";
import { NW_LABELS, type NwClassification } from "@/lib/wealth-types";
import { useRepository } from "@/lib/repository/provider";
import type { Budget, Transaction } from "@/lib/types";
import { Badge, Card, EmptyState, Label, PageHeader, Select, StatCard } from "@/components/ui";

type Range = "3m" | "6m" | "12m";
const RANGE_MONTHS: Record<Range, number> = { "3m": 3, "6m": 6, "12m": 12 };

export default function ReportsPage() {
  const repo = useRepository();
  const [txs, setTxs] = useState<Transaction[] | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [range, setRange] = useState<Range>("6m");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [t, b] = await Promise.all([repo.listTransactions(), repo.listBudgets()]);
      setTxs(t);
      setBudgets(b);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load reports");
    }
  }, [repo]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <div><PageHeader title="Reports & Analytics" /><p className="rounded-lg bg-dangersoft px-4 py-3 text-sm text-danger">{error}</p></div>;
  if (!txs) return null;

  const now = new Date();
  const months: string[] = [];
  for (let i = RANGE_MONTHS[range] - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    months.push(d.toISOString().slice(0, 7));
  }
  const inRange = txs.filter((t) => months.some((m) => t.date.startsWith(m)));

  const monthly = months.map((m) => {
    const rows = inRange.filter((t) => t.date.startsWith(m));
    const income = rows.filter((t) => t.type === "income").reduce((s, t) => s + t.amountPaise, 0);
    const spend = rows.reduce((s, t) => s + (t.type === "expense" ? t.amountPaise : t.type === "refund" || t.type === "reimbursement" ? -t.amountPaise : 0), 0);
    return { month: m, income, spend, saved: income - spend, bps: savingsRateBps(income, spend) };
  });

  const totalIncome = monthly.reduce((s, m) => s + m.income, 0);
  const totalSpend = monthly.reduce((s, m) => s + m.spend, 0);

  // Essential vs discretionary from stored classifications (overrides win — they already do, since overrides are stored).
  const nwSplit = new Map<NwClassification | "unclassified", number>();
  for (const t of inRange.filter((x) => x.type === "expense")) {
    const key = (t.nwClassification ?? "unclassified") as NwClassification | "unclassified";
    nwSplit.set(key, (nwSplit.get(key) ?? 0) + t.amountPaise);
  }

  const byCategory = new Map<string, number>();
  const byMerchant = new Map<string, number>();
  const byMonthCategory = new Map<string, Map<string, number>>();
  for (const t of inRange.filter((x) => x.type === "expense")) {
    const cat = t.categoryName ?? "Uncategorised";
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + t.amountPaise);
    if (t.source) byMerchant.set(t.source, (byMerchant.get(t.source) ?? 0) + t.amountPaise);
    if (!byMonthCategory.has(t.date.slice(0, 7))) byMonthCategory.set(t.date.slice(0, 7), new Map());
    byMonthCategory.get(t.date.slice(0, 7))!.set(cat, (byMonthCategory.get(t.date.slice(0, 7))!.get(cat) ?? 0) + t.amountPaise);
  }
  const topCats = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const topMerchants = [...byMerchant.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const currentMonth = months[months.length - 1];
  const unusual = unusualCategories(byMonthCategory, currentMonth);

  const forecast = forecastFromMonthlyTotals(
    inRange.reduce((acc: MonthlyTotal[], t) => {
      const m = t.date.slice(0, 7);
      const row = acc.find((x) => x.month === m);
      const spend = t.type === "expense" ? t.amountPaise : t.type === "refund" || t.type === "reimbursement" ? -t.amountPaise : 0;
      if (row) row.paise += spend;
      else acc.push({ month: m, paise: spend });
      return acc;
    }, []),
    1,
  );

  const overallBps = savingsRateBps(totalIncome, totalSpend);

  return (
    <div>
      <PageHeader
        title="Reports & Analytics"
        subtitle="Every number here is computed from your records — method and limitations are disclosed, nothing is invented."
        actions={
          <div className="w-40">
            <Label htmlFor="r-range">Period</Label>
            <Select id="r-range" value={range} onChange={(e) => setRange(e.target.value as Range)}>
              <option value="3m">Last 3 months</option>
              <option value="6m">Last 6 months</option>
              <option value="12m">Last 12 months</option>
            </Select>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={`Income (${range})`} value={formatINR(totalIncome)} tone="info" />
        <StatCard label={`Spending (${range})`} value={formatINR(totalSpend)} tone="negative" />
        <StatCard label={`Saved (${range})`} value={formatINR(totalIncome - totalSpend)} tone={totalIncome - totalSpend >= 0 ? "positive" : "negative"} />
        <StatCard label="Savings rate" value={overallBps === null ? "—" : `${(overallBps / 100).toFixed(2)}%`} tone="positive" hint={overallBps === null ? "Needs income" : "Over the selected period"} />
      </div>

      <Card className="mt-8">
        <h2 className="text-base font-semibold">Month by month</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-xs uppercase text-muted"><th className="py-2 pr-4 font-medium">Month</th><th className="py-2 pr-4 text-right font-medium">Income</th><th className="py-2 pr-4 text-right font-medium">Spending</th><th className="py-2 pr-4 text-right font-medium">Saved</th><th className="py-2 text-right font-medium">Rate</th><th className="py-2 text-right font-medium">MoM spending</th></tr></thead>
            <tbody>
              {monthly.map((m, i) => {
                const prev = i > 0 ? monthly[i - 1].spend : null;
                const mom = prev !== null && prev > 0 ? Math.round(((m.spend - prev) * 10000) / prev) : null;
                return (
                  <tr key={m.month} className="border-b border-border last:border-0">
                    <td className="py-2 pr-4 tabular-nums">{m.month}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{formatINR(m.income)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{formatINR(m.spend)}</td>
                    <td className={`py-2 pr-4 text-right tabular-nums ${m.saved >= 0 ? "text-accent" : "text-danger"}`}>{formatINR(m.saved)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{m.bps === null ? "—" : `${(m.bps / 100).toFixed(1)}%`}</td>
                    <td className={`py-2 text-right tabular-nums ${mom !== null && mom > 0 ? "text-warning" : ""}`}>{mom === null ? "—" : `${mom >= 0 ? "+" : ""}${(mom / 100).toFixed(1)}%`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-base font-semibold">Top categories</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {topCats.map(([cat, paise]) => (
              <li key={cat} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-muted">{cat}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full bg-accent" style={{ width: `${(paise / topCats[0][1]) * 100}%` }} /></div>
                <span className="w-28 shrink-0 text-right font-semibold tabular-nums">{formatINR(paise)}</span>
              </li>
            ))}
            {topCats.length === 0 && <li className="text-muted">No spending in this period.</li>}
          </ul>
        </Card>
        <Card>
          <h2 className="text-base font-semibold">Essential vs discretionary</h2>
          <p className="mt-1 text-xs text-muted">Based on the Needs/Wants classification stored on each record — override any classification on the transaction itself.</p>
          <ul className="mt-4 space-y-2 text-sm">
            {[...nwSplit.entries()].map(([k, paise]) => (
              <li key={k} className="flex justify-between">
                <span className="text-muted">{k === "unclassified" ? "Not yet classified" : NW_LABELS[k]}</span>
                <span className="font-semibold tabular-nums">{formatINR(paise)}</span>
              </li>
            ))}
            {nwSplit.size === 0 && <li className="text-muted">No expenses in this period.</li>}
          </ul>
        </Card>
        <Card>
          <h2 className="text-base font-semibold">Top merchants / payees</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {topMerchants.map(([m, paise]) => (
              <li key={m} className="flex justify-between"><span className="truncate text-muted">{m}</span><span className="font-semibold tabular-nums">{formatINR(paise)}</span></li>
            ))}
            {topMerchants.length === 0 && <li className="text-muted">Add merchants/payees to transactions to see this.</li>}
          </ul>
        </Card>
        <Card>
          <h2 className="text-base font-semibold">Needs attention</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {unusual.slice(0, 4).map((u) => (
              <li key={u.category} className="text-muted">
                <Badge tone="warning">+{(u.changeBps / 100).toFixed(0)}%</Badge> {u.category}: {formatINR(u.monthPaise)} in {currentMonth} vs {formatINR(u.baselinePaise)} average of prior months.
              </li>
            ))}
            {unusual.length === 0 && <li className="text-muted">No category is unusually high this month versus its recent baseline.</li>}
          </ul>
        </Card>
      </div>

      <Card className="mt-8">
        <h2 className="text-base font-semibold">Next-month spending estimate</h2>
        {forecast.ok ? (
          <div className="mt-3 text-sm">
            <p><b className="text-lg tabular-nums">{formatINR(forecast.monthlyPaise)}</b> — estimated spending for next month ({formatINR(forecast.totalPaise)} for 1 month).</p>
            <p className="mt-2 text-xs text-muted"><b>Method:</b> {forecast.method} ({forecast.historyUsed.join(", ")}). <b>Limitations:</b> {forecast.limitations}</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">{forecast.reason} {forecast.minimumNeeded}</p>
        )}
        {budgets.length > 0 && (
          <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
            Budget utilisation for the current periods is on your <b>Overview</b> and <b>Budgets</b> pages.
          </p>
        )}
      </Card>
    </div>
  );
}
