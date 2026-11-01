/* eslint-disable react-hooks/set-state-in-effect -- legacy local-mode hydration reads; replaced by server data in Phase 2 */
"use client";

import { useEffect, useState } from "react";
import { toPaise, formatINR, sumPaise, type Paise } from "@/lib/money";
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

type ExpenseRecord = { id: string; amount: string; category: string; date: string };
const KEY = "wealthos-expenses-v2";
const CATEGORIES = [
  "Housing & Rent", "Utilities", "Groceries", "Food & Dining", "Transportation",
  "Fuel", "Healthcare", "Education", "Insurance", "Shopping", "Entertainment",
  "Travel", "Subscriptions", "Family", "Personal Care", "Financial Obligations",
  "Miscellaneous",
];

export default function ExpensesPage() {
  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(KEY);
    if (raw) setRecords(JSON.parse(raw) as ExpenseRecord[]);
  }, []);

  function persist(next: ExpenseRecord[]) {
    setRecords(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  }

  function add() {
    setError(null);
    let paise: Paise;
    try {
      paise = toPaise(amount);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid amount");
      return;
    }
    if (paise === 0) return setError("Enter a non-zero amount");
    if (!category) return setError("Choose a category");
    if (!date) return setError("Choose a date");
    persist([{ id: crypto.randomUUID(), amount, category, date }, ...records]);
    setAmount("");
  }

  const total = sumPaise(
    records.map((r) => {
      try {
        return toPaise(r.amount);
      } catch {
        return 0;
      }
    }),
  );

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle="Categorised spending records with dates — the basis for every analytic."
        actions={<Badge tone="warning">Local mode — Phase 2 moves this to PostgreSQL</Badge>}
      />
      <Card className="max-w-xl">
        <div className="space-y-4">
          <div>
            <Label htmlFor="amount">Amount (₹)</Label>
            <Input
              id="amount"
              type="text"
              inputMode="decimal"
              placeholder="e.g. 1,240.50"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category">Category</Label>
              <Select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Select category</option>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button onClick={add}>Add expense</Button>
        </div>
      </Card>

      <div className="mt-6 max-w-xl">
        <p className="mb-3 text-sm font-medium text-muted">
          Total recorded: <span className="font-bold text-fg">{formatINR(total)}</span>
        </p>
        {records.length === 0 ? (
          <EmptyState
            title="No expenses recorded yet"
            description="Record your first expense above. Categories mirror the system catalogue that ships with the database in Phase 2."
          />
        ) : (
          <ul className="space-y-2">
            {records.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-sm"
              >
                <span>
                  <span className="font-semibold">{formatINR(toPaiseSafe(r.amount))}</span>
                  <span className="text-muted"> · {r.category} · {r.date}</span>
                </span>
                <button
                  onClick={() => persist(records.filter((x) => x.id !== r.id))}
                  className="text-xs font-semibold text-danger hover:underline"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function toPaiseSafe(amount: string): Paise {
  try {
    return toPaise(amount);
  } catch {
    return 0;
  }
}
