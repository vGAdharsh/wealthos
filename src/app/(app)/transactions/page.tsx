/* eslint-disable react-hooks/set-state-in-effect -- async data loading through the repository; replaced by server components in Phase 4 */
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatINR } from "@/lib/money";
import { useRepository } from "@/lib/repository/provider";
import type { Category, Transaction, TxType } from "@/lib/types";
import { TxForm } from "@/components/TxForm";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Label,
  PageHeader,
  Select,
} from "@/components/ui";
import { TYPE_LABELS, txDisplay } from "@/components/tx";


export default function TransactionsPage() {
  const repo = useRepository();
  const [rows, setRows] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [txs, cats] = await Promise.all([
        repo.listTransactions({
          types: typeFilter === "all" ? undefined : [typeFilter as TxType],
          from: from || undefined,
          to: to || undefined,
        }),
        repo.listCategories(),
      ]);
      setRows(txs);
      setCategories(cats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load");
    }
  }, [repo, typeFilter, from, to]);

  useEffect(() => {
    load().then(() => setLoaded(true));
  }, [load]);

  async function remove(t: Transaction) {
    if (!confirm(`Delete this ${TYPE_LABELS[t.type].toLowerCase()} of ${formatINR(t.amountPaise)}?`)) return;
    try {
      await repo.deleteTransaction(t.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete");
    }
  }

  async function exportCsv() {
    const all = await repo.listTransactions();
    const nameById = new Map(categories.map((c) => [c.id, c.name]));
    const { transactionsToCsv } = await import("@/lib/csv/export");
    const csv = transactionsToCsv(all, (id) => (id ? nameById.get(id) ?? "" : ""));
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wealthos-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        title="Transactions"
        subtitle="One unified ledger — income, expenses, transfers and refunds. Transfers never count as income or spending."
        actions={
          <>
            <Link href="/import">
              <Button variant="secondary" type="button">Import CSV</Button>
            </Link>
            <Button variant="secondary" type="button" onClick={exportCsv}>Export CSV</Button>
            <Button type="button" onClick={() => { setEditing(null); setShowForm(!showForm); }}>
              {showForm && !editing ? "Close" : "Add transaction"}
            </Button>
          </>
        }
      />

      {error && (
        <p className="mb-4 rounded-lg bg-dangersoft px-4 py-3 text-sm text-danger">{error}</p>
      )}

      {showForm || editing ? (
        <Card className="mb-8 max-w-2xl">
          <h2 className="mb-4 text-base font-semibold">
            {editing ? "Edit transaction" : "New transaction"}
          </h2>
          <TxForm
            key={editing?.id ?? "new"}
            categories={categories}
            editing={editing}
            onCategoriesChanged={load}
            onDone={() => { setShowForm(false); setEditing(null); load(); }}
          />
        </Card>
      ) : null}

      <Card className="mb-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="f-type">Type</Label>
            <Select id="f-type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">All types</option>
              {Object.entries(TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="f-from">From</Label>
            <Input id="f-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="f-to">To</Label>
            <Input id="f-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </Card>

      {!loaded ? null : rows.length === 0 ? (
        <EmptyState
          title="No transactions match"
          description="Add a transaction, relax the filters, or import a CSV from your bank or UPI app export."
          action={<Button type="button" onClick={() => setShowForm(true)}>Add transaction</Button>}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Details</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const d = txDisplay(t);
                return (
                  <tr key={t.id} className="border-b border-border last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums">{t.date}</td>
                    <td className="px-4 py-3">
                      {TYPE_LABELS[t.type]}
                      {t.isRecurring && <Badge tone="info">recurring</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      {t.description || "—"}
                      {t.source && <span className="text-muted"> · {t.source}</span>}
                    </td>
                    <td className="px-4 py-3 text-muted">{t.categoryName ?? "—"}</td>
                    <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums ${d.tone}`}>
                      {d.text}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button onClick={() => { setShowForm(true); setEditing(t); }} className="mr-3 text-xs font-semibold text-info hover:underline">Edit</button>
                      <button onClick={() => remove(t)} className="text-xs font-semibold text-danger hover:underline">Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
