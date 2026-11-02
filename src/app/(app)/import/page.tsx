/* eslint-disable react-hooks/set-state-in-effect -- async data loading through the repository; replaced by server components in Phase 4 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatINR } from "@/lib/money";
import { buildImportPreview, type ImportPreview } from "@/lib/csv/import";
import { useRepository } from "@/lib/repository/provider";
import type { Category, TxType } from "@/lib/types";
import { Button, Card, Label, PageHeader, Select } from "@/components/ui";

const SAMPLE = [
  "date,type,amount,description,source,payment_method,notes",
  "2026-11-01,income,62500.00,October salary,Acme Corp,bank transfer,",
  "2026-11-02,expense,1240.50,Groceries,BigBasket,UPI,",
  "2026-11-03,expense,450,Movie tickets,PVR,card,",
].join("\r\n");

export default function ImportPage() {
  const repo = useRepository();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [defaultType, setDefaultType] = useState<TxType>("expense");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const csvTextRef = useRef("");

  const loadCategories = useCallback(async () => {
    setCategories(await repo.listCategories());
  }, [repo]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  function onFile(f: File | undefined) {
    if (!f) return;
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      csvTextRef.current = text;
      runPreview(text);
    };
    reader.readAsText(f);
  }

  async function runPreview(text: string) {
    setBusy(true);
    try {
      const existing = await repo.listTransactions();
      const hashes = new Set(existing.map((t) => t.contentHash));
      setPreview(
        buildImportPreview(text, hashes, {
          defaultType,
          defaultCategoryId: categoryId || null,
        }),
      );
    } finally {
      setBusy(false);
    }
  }

  async function rePreview() {
    if (csvTextRef.current) await runPreview(csvTextRef.current);
  }

  async function doImport() {
    if (!preview) return;
    setBusy(true);
    setResult(null);
    try {
      const inputs = preview.rows.filter((r) => r.status === "valid").map((r) => r.input!);
      const inserted = await repo.bulkCreateTransactions(inputs);
      setResult(
        `Imported ${inserted} transaction(s). Skipped ${preview.duplicateCount} duplicate(s) found during preview${inputs.length - inserted > 0 ? ` and ${inputs.length - inserted} that matched existing records` : ""}. ${preview.errorCount} row(s) had errors and were not imported.`,
      );
      setPreview(null);
      csvTextRef.current = "";
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setResult(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  function downloadSample() {
    const blob = new Blob([SAMPLE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wealthos-import-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        title="Import CSV"
        subtitle="From your bank, UPI app or a previous WealthOS export. Rows are previewed, validated and de-duplicated before anything is saved."
        actions={
          <Button type="button" variant="secondary" onClick={downloadSample}>
            Download sample CSV
          </Button>
        }
      />

      <Card className="mb-8 max-w-2xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="i-type">If a row has no type, treat it as</Label>
              <Select id="i-type" value={defaultType} onChange={(e) => { setDefaultType(e.target.value as TxType); }}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="transfer">Internal transfer</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="i-cat">If a row has no category</Label>
              <Select id="i-cat" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); }}>
                <option value="">Uncategorised</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="i-file">CSV file</Label>
            <input
              id="i-file"
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => onFile(e.target.files?.[0])}
              className="block w-full text-sm text-muted file:mr-4 file:rounded-lg file:border-0 file:bg-surface2 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-fg hover:file:opacity-90"
            />
            <p className="mt-2 text-xs text-muted">
              Columns are auto-detected (date, amount, type/debit-credit, description/details/narration, merchant, category, notes). DD/MM/YYYY and YYYY-MM-DD dates are both supported.
            </p>
          </div>
        </div>
      </Card>

      {result && (
        <p className="mb-6 rounded-lg bg-accentsoft px-4 py-3 text-sm text-accent">{result}</p>
      )}

      {preview && (
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              <b>{preview.validCount}</b> ready to import ·{" "}
              <span className="text-warning">{preview.duplicateCount} duplicate(s)</span> ·{" "}
              <span className="text-danger">{preview.errorCount} error(s)</span>
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={rePreview} disabled={busy}>
                Re-check with current settings
              </Button>
              <Button type="button" onClick={doImport} disabled={busy || preview.validCount === 0}>
                {busy ? "Importing…" : `Import ${preview.validCount}`}
              </Button>
            </div>
          </div>

          <div className="max-h-96 overflow-auto rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-border text-left uppercase tracking-wide text-muted">
                  <th className="px-3 py-2 font-medium">Row</th>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Details</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.rowNumber} className="border-b border-border last:border-0">
                    <td className="px-3 py-1.5 tabular-nums">{r.rowNumber}</td>
                    <td className="px-3 py-1.5 tabular-nums">{r.input?.date ?? "—"}</td>
                    <td className="px-3 py-1.5">{r.input?.type ?? "—"}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {r.input ? formatINR(r.input.amountPaise) : "—"}
                    </td>
                    <td className="max-w-48 truncate px-3 py-1.5">
                      {r.input ? `${r.input.description || r.input.source || "—"}` : "—"}
                    </td>
                    <td className="px-3 py-1.5">
                      {r.status === "valid" && <span className="text-accent">New</span>}
                      {r.status === "duplicate" && (
                        <span className="text-warning">
                          Duplicate{r.fileDuplicateOf ? ` of row ${r.fileDuplicateOf} in this file` : " of an existing record"}
                        </span>
                      )}
                      {r.status === "error" && <span className="text-danger">{r.error}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
