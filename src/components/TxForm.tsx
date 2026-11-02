"use client";

import { useState } from "react";
import { formatINR, toPaise, type Paise } from "@/lib/money";
import { contentHash } from "@/lib/repository/hash";
import { useRepository } from "@/lib/repository/provider";
import type {
  Category,
  Transaction,
  TransactionInput,
  TxType,
} from "@/lib/types";
import { Button, Input, Label, Select } from "./ui";

const TYPE_OPTIONS: { value: TxType; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Internal transfer" },
  { value: "refund", label: "Refund received" },
  { value: "reimbursement", label: "Reimbursement" },
];

/**
 * Add/edit form for the unified ledger. Remount with `key` to reset or
 * prefill (editing). Category is required for spending-type records.
 */
export function TxForm({
  categories,
  fixedType,
  editing,
  onDone,
  onCategoriesChanged,
}: {
  categories: Category[];
  fixedType?: TxType;
  editing?: Transaction | null;
  onDone: () => void;
  onCategoriesChanged: () => void;
}) {
  const repo = useRepository();
  const [type, setType] = useState<TxType>(fixedType ?? editing?.type ?? "expense");
  const [amount, setAmount] = useState(editing ? formatINR(editing.amountPaise).replace("₹", "").replace(/,/g, "") : "");
  const [date, setDate] = useState(editing?.date ?? new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState(editing?.description ?? "");
  const [source, setSource] = useState(editing?.source ?? "");
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? "");
  const [paymentMethod, setPaymentMethod] = useState(editing?.paymentMethod ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [isRecurring, setIsRecurring] = useState(editing?.isRecurring ?? false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);

  const needsCategory = type !== "income" && type !== "transfer";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    let paise: Paise;
    try {
      paise = toPaise(amount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid amount");
      return;
    }
    if (paise <= 0) return setError("Enter a non-zero amount");
    if (!date) return setError("Choose a date");
    if (needsCategory && !categoryId) return setError("Choose a category");
    setBusy(true);
    try {
      const input: TransactionInput = {
        type,
        date,
        amountPaise: paise,
        description: description.trim(),
        source: source.trim(),
        categoryId: needsCategory ? categoryId : null,
        paymentMethod: paymentMethod || null,
        notes: notes || null,
        isRecurring,
        contentHash: contentHash(type, date, paise, description.trim(), source.trim()),
      };
      if (editing) await repo.updateTransaction(editing.id, input);
      else await repo.createTransaction(input);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function addCategory() {
    const name = newCategory.trim();
    if (!name) return;
    try {
      const cat = await repo.createCategory(name);
      onCategoriesChanged();
      setCategoryId(cat.id);
      setNewCategory("");
      setShowNewCategory(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create category");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {!fixedType && (
        <div>
          <Label htmlFor="tx-type">Type</Label>
          <Select id="tx-type" value={type} onChange={(e) => setType(e.target.value as TxType)}>
            {TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="tx-amount">Amount (₹)</Label>
          <Input id="tx-amount" inputMode="decimal" placeholder="e.g. 1,240.50" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="tx-date">Date</Label>
          <Input id="tx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="tx-source">{type === "income" ? "Source" : "Merchant / payee"}</Label>
          <Input id="tx-source" placeholder={type === "income" ? "e.g. Acme Corp" : "e.g. BigBasket"} value={source} onChange={(e) => setSource(e.target.value)} />
        </div>
        {needsCategory ? (
          <div>
            <Label htmlFor="tx-category">Category</Label>
            <Select id="tx-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
        ) : (
          <div className="flex items-end pb-1 text-xs text-muted">
            Transfers are never counted as income or spending.
          </div>
        )}
      </div>
      {needsCategory && (
        showNewCategory ? (
          <div className="flex gap-2">
            <Input placeholder="New category name" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
            <Button type="button" variant="secondary" onClick={addCategory}>Create</Button>
            <Button type="button" variant="ghost" onClick={() => setShowNewCategory(false)}>Cancel</Button>
          </div>
        ) : (
          <button type="button" onClick={() => setShowNewCategory(true)} className="text-xs font-semibold text-accent hover:underline">
            + New category
          </button>
        )
      )}
      <div>
        <Label htmlFor="tx-desc">Description (optional)</Label>
        <Input id="tx-desc" placeholder="e.g. Monthly rent, October salary" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="tx-payment">Payment method</Label>
          <Input id="tx-payment" placeholder="e.g. UPI, card, cash" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="tx-notes">Notes</Label>
          <Input id="tx-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="h-4 w-4" />
        Recurring (monthly)
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : editing ? "Save changes" : "Add transaction"}
        </Button>
        {editing && (
          <Button type="button" variant="secondary" onClick={onDone}>
            Cancel edit
          </Button>
        )}
      </div>
    </form>
  );
}
