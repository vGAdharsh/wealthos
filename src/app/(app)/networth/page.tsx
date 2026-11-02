/* eslint-disable react-hooks/set-state-in-effect -- async data loading through the repository */
"use client";

import { useCallback, useEffect, useState } from "react";
import { formatINR } from "@/lib/money";
import { netWorthPaise } from "@/lib/domain/calculations";
import { useRepository } from "@/lib/repository/provider";
import type { Asset, Investment, Liability, NetWorthSnapshot } from "@/lib/wealth-types";
import { Badge, Button, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";

export default function NetWorthPage() {
  const repo = useRepository();
  const [data, setData] = useState<{ assets: Asset[]; investments: Investment[]; liabilities: Liability[]; snapshots: NetWorthSnapshot[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [assets, investments, liabilities, snapshots] = await Promise.all([
        repo.wealth.listAssets(),
        repo.wealth.listInvestments(),
        repo.wealth.listLiabilities(),
        repo.wealth.listNetWorthSnapshots(),
      ]);
      setData({ assets, investments, liabilities, snapshots });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load net worth");
    }
  }, [repo]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <div><PageHeader title="Net worth" /><p className="rounded-lg bg-dangersoft px-4 py-3 text-sm text-danger">{error}</p></div>;
  if (!data) return null;

  const totalAssets = data.assets.reduce((s, a) => s + a.valuePaise, 0) + data.investments.reduce((s, i) => s + i.currentValuePaise, 0);
  const totalLiabilities = data.liabilities.reduce((s, l) => s + l.outstandingPaise, 0);
  const nw = netWorthPaise(totalAssets, totalLiabilities);
  const snaps = data.snapshots;
  const maxAbs = Math.max(...snaps.map((s) => Math.abs(s.netWorthPaise)), 1);

  async function snapshot() {
    setBusy(true);
    try {
      await repo.wealth.saveNetWorthSnapshot({
        snapshotDate: new Date().toISOString().slice(0, 10),
        totalAssetsPaise: totalAssets,
        totalLiabilitiesPaise: totalLiabilities,
        netWorthPaise: nw,
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Net worth"
        subtitle="Assets − Liabilities, exactly as the definition says. Investments count at your latest valuation; the asset register excludes them, so nothing double-counts."
        actions={<Badge tone="neutral">{data.assets.length} asset(s) · {data.investments.length} holding(s) · {data.liabilities.length} liabilit(ies)</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total assets (incl. investments)" value={formatINR(totalAssets)} tone="info" />
        <StatCard label="Total liabilities" value={formatINR(totalLiabilities)} tone="negative" />
        <StatCard label="Net worth" value={formatINR(nw)} tone={nw >= 0 ? "positive" : "negative"} />
      </div>

      <Card className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Snapshot history</h2>
          <Button type="button" variant="secondary" onClick={snapshot} disabled={busy}>{busy ? "Saving…" : "Save today's snapshot"}</Button>
        </div>
        {snaps.length === 0 ? (
          <EmptyState title="No snapshots yet" description="Save a snapshot periodically (weekly or monthly works well) to build a trend of your financial position." />
        ) : (
          <ul className="mt-4 space-y-2 text-sm">
            {snaps.slice().reverse().map((s) => (
              <li key={s.id} className="flex items-center gap-3">
                <span className="w-24 shrink-0 tabular-nums text-muted">{s.snapshotDate}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface2">
                  <div className={`h-full rounded-full ${s.netWorthPaise >= 0 ? "bg-accent" : "bg-danger"}`} style={{ width: `${(Math.abs(s.netWorthPaise) / maxAbs) * 100}%` }} />
                </div>
                <span className={`w-32 shrink-0 text-right font-semibold tabular-nums ${s.netWorthPaise >= 0 ? "text-accent" : "text-danger"}`}>{formatINR(s.netWorthPaise)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
