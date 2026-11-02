"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toPaise } from "@/lib/money";
import { contentHash } from "@/lib/repository/hash";
import { useRepository } from "@/lib/repository/provider";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/theme";
import { Badge, Button, Card, Input, Label, PageHeader } from "@/components/ui";

type LegacyRow = { amount: string; date?: string; source?: string; category?: string };
type PreviewRow = LegacyRow & { origin: "income" | "expense"; parsed: string | null };

const LEGACY_KEYS: { key: string; origin: "income" | "expense" }[] = [
  { key: "income", origin: "income" },
  { key: "expenses", origin: "expense" },
  { key: "wealthos-income-v2", origin: "income" },
  { key: "wealthos-expenses-v2", origin: "expense" },
];

export default function SettingsPage() {
  const repo = useRepository();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [fallbackDate, setFallbackDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [migrationResult, setMigrationResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    createClient().auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  const scanLegacy = useCallback(() => {
    const rows: PreviewRow[] = [];
    for (const { key, origin } of LEGACY_KEYS) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as LegacyRow[];
        if (!Array.isArray(parsed)) continue;
        for (const row of parsed) {
          if (!row || typeof row.amount !== "string") continue;
          let parsedAmount: string | null = null;
          try {
            toPaise(row.amount);
            parsedAmount = row.amount;
          } catch {
            parsedAmount = null;
          }
          rows.push({ ...row, origin, parsed: parsedAmount });
        }
      } catch {
        /* ignore unreadable key */
      }
    }
    setPreview(rows);
    setMigrationResult(null);
    setError(null);
  }, []);

  async function migrate() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const categories = await repo.listCategories();
      const catByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
      const inputs = [];
      for (const row of preview) {
        if (!row.parsed) continue; // unparseable rows are skipped, reported in preview
        const amountPaise = toPaise(row.parsed);
        if (amountPaise <= 0) continue;
        let categoryId: string | null = null;
        if (row.category) {
          categoryId = catByName.get(row.category.trim().toLowerCase()) ?? null;
          if (!categoryId) {
            const created = await repo.createCategory(row.category.trim());
            catByName.set(row.category.trim().toLowerCase(), created.id);
            categoryId = created.id;
          }
        }
        const description = row.source ?? "";
        inputs.push({
          type: row.origin,
          date: row.date || fallbackDate,
          amountPaise,
          description,
          source: description,
          categoryId,
          paymentMethod: null,
          notes: "Migrated from previous WealthOS browser data",
          isRecurring: false,
          contentHash: contentHash(row.origin, row.date || fallbackDate, amountPaise, description, description),
        });
      }
      const inserted = await repo.bulkCreateTransactions(inputs);
      localStorage.setItem("wealthos-migrated", new Date().toISOString());
      setMigrationResult(
        `Migrated ${inserted} record(s) into your database${inputs.length - inserted > 0 ? ` (${inputs.length - inserted} were already present)` : ""}. The original browser data is untouched until you clear it below.`,
      );
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Migration failed");
    } finally {
      setBusy(false);
    }
  }

  async function clearLegacy() {
    if (!confirm("Delete ALL legacy browser-stored records (income, expenses and interim ledgers)? This cannot be undone.")) return;
    for (const { key } of LEGACY_KEYS) localStorage.removeItem(key);
    setPreview(null);
    setMigrationResult("Legacy browser data cleared.");
  }

  async function signOut() {
    if (isSupabaseConfigured()) await createClient().auth.signOut();
    router.push("/signin");
  }

  async function exportAllCsv() {
    const all = await repo.listTransactions();
    const categories = await repo.listCategories();
    const nameById = new Map(categories.map((c) => [c.id, c.name]));
    const { transactionsToCsv } = await import("@/lib/csv/export");
    const csv = transactionsToCsv(all, (id) => (id ? nameById.get(id) ?? "" : ""));
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wealthos-all-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const migrated = typeof window !== "undefined" && localStorage.getItem("wealthos-migrated");

  return (
    <div>
      <PageHeader
        title="Settings & Profile"
        subtitle="Account, appearance, and your data — import, export and migration."
      />
      <div className="max-w-2xl space-y-6">
        <Card>
          <h2 className="text-base font-semibold">Account</h2>
          {isSupabaseConfigured() ? (
            <>
              <p className="mt-2 text-sm text-muted">
                Signed in as <span className="font-medium text-fg">{email ?? "…"}</span>
              </p>
              <div className="mt-4">
                <Button variant="secondary" onClick={signOut}>Sign out</Button>
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">
              Running in local mode. Create a free Supabase project and set{" "}
              <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
              <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in <code>.env.local</code>{" "}
              to enable accounts, sync and backup.
            </p>
          )}
        </Card>

        <Card>
          <h2 className="text-base font-semibold">Appearance</h2>
          <p className="mt-2 text-sm text-muted">Light, dark, or follow your system.</p>
          <div className="mt-3"><ThemeToggle /></div>
        </Card>

        {isSupabaseConfigured() && (
          <Card>
            <span id="migrate" />
            <h2 className="text-base font-semibold">
              Migrate legacy browser records <Badge tone="warning">one-time</Badge>
            </h2>
            {migrated && (
              <p className="mt-2 text-xs text-muted">Previous migration: {migrated.slice(0, 10)}.</p>
            )}
            <p className="mt-2 text-sm text-muted">
              The pre-database version of WealthOS stored records only in this browser. Scan for them, review, pick a date for the undated old records, and import them into your database. Original data stays untouched until you clear it.
            </p>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div>
                <Label htmlFor="mig-date">Date for undated legacy records</Label>
                <Input id="mig-date" type="date" value={fallbackDate} onChange={(e) => setFallbackDate(e.target.value)} />
              </div>
              <Button type="button" variant="secondary" onClick={scanLegacy}>Scan this browser</Button>
            </div>

            {preview && (
              <div className="mt-4">
                <p className="mb-2 text-sm">
                  Found <b>{preview.length}</b> record(s) — <span className="text-danger">{preview.filter((r) => !r.parsed).length} unparseable</span> (will be skipped).
                </p>
                <div className="max-h-64 overflow-auto rounded-xl border border-border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-surface">
                      <tr className="border-b border-border text-left uppercase tracking-wide text-muted">
                        <th className="px-3 py-2 font-medium">Origin</th>
                        <th className="px-3 py-2 text-right font-medium">Amount</th>
                        <th className="px-3 py-2 font-medium">Source / category</th>
                        <th className="px-3 py-2 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((r, i) => (
                        <tr key={i} className="border-b border-border last:border-0">
                          <td className="px-3 py-1.5">{r.origin}</td>
                          <td className={`px-3 py-1.5 text-right tabular-nums ${r.parsed ? "" : "text-danger"}`}>
                            {r.parsed ?? "unparseable"}
                          </td>
                          <td className="px-3 py-1.5">{r.source || r.category || "—"}</td>
                          <td className="px-3 py-1.5">{r.date || <span className="text-warning">→ {fallbackDate}</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button type="button" onClick={migrate} disabled={busy}>
                    {busy ? "Migrating…" : "Import to database"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setPreview(null)}>Cancel</Button>
                </div>
              </div>
            )}
            {migrationResult && (
              <p className="mt-4 rounded-lg bg-accentsoft px-4 py-3 text-sm text-accent">{migrationResult}</p>
            )}
            {error && <p className="mt-4 rounded-lg bg-dangersoft px-4 py-3 text-sm text-danger">{error}</p>}
          </Card>
        )}

        <Card>
          <h2 className="text-base font-semibold">Your data</h2>
          <p className="mt-2 text-sm text-muted">
            Export everything as CSV at any time — your records are never locked into WealthOS.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" variant="secondary" onClick={exportAllCsv}>Export all transactions (CSV)</Button>
            {repo.mode === "local" && (
              <Button type="button" variant="danger" onClick={clearLegacy}>Clear legacy browser data</Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
