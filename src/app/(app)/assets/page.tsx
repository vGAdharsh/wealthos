/* eslint-disable react-hooks/set-state-in-effect -- async data loading through the repository */
"use client";

import { useCallback, useEffect, useState } from "react";
import { formatINR, toPaise } from "@/lib/money";
import { allocationBps } from "@/lib/domain/wealth";
import { useRepository } from "@/lib/repository/provider";
import { ASSET_TYPES, type Asset, type AssetInput, type AssetType } from "@/lib/wealth-types";
import { Button, Card, EmptyState, Input, Label, PageHeader, Select, StatCard } from "@/components/ui";

export default function AssetsPage() {
  const repo = useRepository();
  const [rows, setRows] = useState<Asset[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [assetType, setAssetType] = useState<AssetType>("bank");
  const [value, setValue] = useState("");

  const load = useCallback(async () => {
    try {
      setRows(await repo.wealth.listAssets());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load assets");
    }
  }, [repo]);

  useEffect(() => {
    load();
  }, [load]);

  const total = (rows ?? []).reduce((s, r) => s + r.valuePaise, 0);
  const alloc = allocationBps((rows ?? []).map((r) => ({ label: ASSET_TYPES.find((t) => t.value === r.assetType)?.label ?? r.assetType, paise: r.valuePaise })));
  const byType = new Map<string, number>();
  for (const a of alloc) byType.set(a.label, (byType.get(a.label) ?? 0) + a.bps);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const paise = toPaise(value);
      if (!name.trim()) throw new Error("Give the asset a name");
      await repo.wealth.createAsset({ assetType, name: name.trim(), valuePaise: paise, valuationAsOf: new Date().toISOString().slice(0, 10), notes: null });
      setName("");
      setValue("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid value");
    }
  }

  return (
    <div>
      <PageHeader
        title="Assets"
        subtitle="What you own. Investments are tracked separately on their own page, so nothing is double-counted in net worth."
      />
      {error && <p className="mb-4 rounded-lg bg-dangersoft px-4 py-3 text-sm text-danger">{error}</p>}

      <div className="mb-8 max-w-sm"><StatCard label="Total assets" value={formatINR(total)} tone="positive" /></div>

      <Card className="mb-8 max-w-2xl">
        <form onSubmit={create} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div><Label htmlFor="a-name">Name</Label><Input id="a-name" required placeholder="e.g. HDFC Savings" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label htmlFor="a-type">Type</Label><Select id="a-type" value={assetType} onChange={(e) => setAssetType(e.target.value as AssetType)}>{ASSET_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></div>
            <div><Label htmlFor="a-value">Value (₹)</Label><Input id="a-value" inputMode="decimal" required placeholder="e.g. 1,50,000" value={value} onChange={(e) => setValue(e.target.value)} /></div>
          </div>
          <Button type="submit">Add asset</Button>
        </form>
      </Card>

      {rows === null ? null : rows.length === 0 ? (
        <EmptyState title="No assets recorded" description="Add bank balances, cash, deposits, property, vehicle, gold — whatever you own and want counted in net worth." />
      ) : (
        <div className="space-y-4">
          <Card>
            <h2 className="text-base font-semibold">Composition</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {[...byType.entries()].map(([label, bps]) => (
                <li key={label} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 text-muted">{label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full bg-accent" style={{ width: `${bps / 100}%` }} /></div>
                  <span className="w-16 text-right tabular-nums">{(bps / 100).toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </Card>
          <ul className="space-y-2">
            {rows.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-sm">
                <span><span className="font-semibold">{a.name}</span><span className="text-muted"> · {ASSET_TYPES.find((t) => t.value === a.assetType)?.label}{a.valuationAsOf ? ` · valued ${a.valuationAsOf}` : ""}</span></span>
                <span className="flex items-center gap-3">
                  <span className="font-semibold tabular-nums">{formatINR(a.valuePaise)}</span>
                  <button onClick={async () => { await repo.wealth.deleteAsset(a.id); await load(); }} className="text-xs font-semibold text-danger hover:underline">Delete</button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
