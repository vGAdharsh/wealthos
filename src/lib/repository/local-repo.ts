/**
 * Local-mode provider: genuine persistence in this browser via
 * localStorage. Used only when Supabase is unconfigured (setup mode).
 * Same interface, same exactness rules as the database provider.
 */

import { toPaise } from "@/lib/money";
import { contentHash } from "./hash";
import type { DataProvider } from "./types";
import { LocalWealth } from "./wealth-local";
import type {
  Budget,
  BudgetInput,
  Category,
  SavingsGoal,
  SavingsGoalInput,
  Transaction,
  TransactionInput,
  TxFilter,
} from "@/lib/types";

const TX_KEY = "wealthos-ledger-v2";
const CAT_KEY = "wealthos-categories-v2";
const BUDGET_KEY = "wealthos-budgets-v2";
const GOAL_KEY = "wealthos-savings-v2";

type StoredTx = Omit<Transaction, "amountPaise"> & { amount: string };
type StoredBudget = Omit<Budget, "amountPaise"> & { amount: string };
type StoredGoal = Omit<SavingsGoal, "targetAmountPaise" | "currentAmountPaise"> & {
  targetAmount: string;
  currentAmount: string;
};

export const SYSTEM_CATEGORIES: Category[] = [
  "Housing & Rent",
  "Utilities",
  "Groceries",
  "Food & Dining",
  "Transportation",
  "Fuel",
  "Healthcare",
  "Education",
  "Insurance",
  "Shopping",
  "Entertainment",
  "Travel",
  "Subscriptions",
  "Family",
  "Personal Care",
  "Financial Obligations",
  "Miscellaneous",
].map((name, i) => ({ id: `sys-${i + 1}`, name, isSystem: true }));

function read<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, rows: T[]): void {
  localStorage.setItem(key, JSON.stringify(rows));
}

function storedToTx(row: StoredTx): Transaction {
  return {
    ...row,
    amountPaise: toPaise(row.amount),
    paymentMethod: row.paymentMethod ?? null,
    notes: row.notes ?? null,
    importBatchId: row.importBatchId ?? null,
  };
}

export class LocalProvider implements DataProvider {
  readonly mode = "local" as const;
  readonly wealth = new LocalWealth();

  async listTransactions(filter?: TxFilter): Promise<Transaction[]> {
    const rows = read<StoredTx>(TX_KEY).map(storedToTx);
    return rows
      .filter((t) => {
        if (filter?.types && !filter.types.includes(t.type)) return false;
        if (filter?.from && t.date < filter.from) return false;
        if (filter?.to && t.date > filter.to) return false;
        if (filter?.categoryId && t.categoryId !== filter.categoryId)
          return false;
        return true;
      })
      .sort((a, b) =>
        a.date === b.date
          ? b.createdAt.localeCompare(a.createdAt)
          : b.date.localeCompare(a.date),
      );
  }

  async createTransaction(input: TransactionInput): Promise<Transaction> {
    const row: StoredTx = {
      id: crypto.randomUUID(),
      type: input.type,
      date: input.date,
      amount: paiseToStoredString(input.amountPaise),
      description: input.description,
      source: input.source,
      categoryId: input.categoryId,
      paymentMethod: input.paymentMethod ?? null,
      notes: input.notes ?? null,
      isRecurring: input.isRecurring,
      contentHash: input.contentHash,
      importBatchId: input.importBatchId ?? null,
      createdAt: new Date().toISOString(),
    };
    const all = read<StoredTx>(TX_KEY);
    all.push(row);
    write(TX_KEY, all);
    return storedToTx(row);
  }

  async updateTransaction(
    id: string,
    patch: Partial<TransactionInput>,
  ): Promise<void> {
    const all = read<StoredTx>(TX_KEY);
    const idx = all.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error("Transaction not found");
    const current = storedToTx(all[idx]);
    const merged = { ...current, ...patch };
    all[idx] = {
      ...all[idx],
      ...(patch as Partial<StoredTx>),
      amount: paiseToStoredString(merged.amountPaise),
      contentHash: contentHash(
        merged.type,
        merged.date,
        merged.amountPaise,
        merged.description,
        merged.source,
      ),
    };
    write(TX_KEY, all);
  }

  async deleteTransaction(id: string): Promise<void> {
    write(
      TX_KEY,
      read<StoredTx>(TX_KEY).filter((t) => t.id !== id),
    );
  }

  async bulkCreateTransactions(inputs: TransactionInput[]): Promise<number> {
    const all = read<StoredTx>(TX_KEY);
    const existing = new Set(all.map((t) => t.contentHash));
    let inserted = 0;
    for (const input of inputs) {
      if (existing.has(input.contentHash)) continue;
      all.push({
        id: crypto.randomUUID(),
        type: input.type,
        date: input.date,
        amount: paiseToStoredString(input.amountPaise),
        description: input.description,
        source: input.source,
        categoryId: input.categoryId,
        paymentMethod: input.paymentMethod ?? null,
        notes: input.notes ?? null,
        isRecurring: input.isRecurring,
        contentHash: input.contentHash,
        importBatchId: input.importBatchId ?? null,
        createdAt: new Date().toISOString(),
      });
      existing.add(input.contentHash);
      inserted += 1;
    }
    write(TX_KEY, all);
    return inserted;
  }

  async listCategories(): Promise<Category[]> {
    const custom = read<Category & { isSystem: false }>(CAT_KEY);
    return [...SYSTEM_CATEGORIES, ...custom];
  }

  async createCategory(name: string): Promise<Category> {
    const custom = read<Category>(CAT_KEY);
    const cat: Category = {
      id: crypto.randomUUID(),
      name: name.trim(),
      isSystem: false,
    };
    write(CAT_KEY, [...custom, cat]);
    return cat;
  }

  async listBudgets(): Promise<Budget[]> {
    return read<StoredBudget>(BUDGET_KEY).map((b) => ({
      ...b,
      amountPaise: toPaise(b.amount),
    }));
  }

  async createBudget(input: BudgetInput): Promise<Budget> {
    const row = {
      ...input,
      id: crypto.randomUUID(),
    } as unknown as StoredBudget;
    row.amount = paiseToStoredString(input.amountPaise);
    write(BUDGET_KEY, [...read<StoredBudget>(BUDGET_KEY), row]);
    return { ...row, amountPaise: input.amountPaise };
  }

  async updateBudget(
    id: string,
    patch: Partial<BudgetInput>,
  ): Promise<void> {
    const all = read<StoredBudget>(BUDGET_KEY);
    const idx = all.findIndex((b) => b.id === id);
    if (idx === -1) throw new Error("Budget not found");
    all[idx] = { ...all[idx], ...(patch as Partial<StoredBudget>) };
    if (patch.amountPaise !== undefined)
      all[idx].amount = paiseToStoredString(patch.amountPaise);
    write(BUDGET_KEY, all);
  }

  async deleteBudget(id: string): Promise<void> {
    write(
      BUDGET_KEY,
      read<StoredBudget>(BUDGET_KEY).filter((b) => b.id !== id),
    );
  }

  async listSavingsGoals(): Promise<SavingsGoal[]> {
    return read<StoredGoal>(GOAL_KEY).map((g) => ({
      ...g,
      targetAmountPaise: toPaise(g.targetAmount),
      currentAmountPaise: toPaise(g.currentAmount),
    }));
  }

  async createSavingsGoal(input: SavingsGoalInput): Promise<SavingsGoal> {
    const row = {
      ...input,
      id: crypto.randomUUID(),
      targetAmount: paiseToStoredString(input.targetAmountPaise),
      currentAmount: paiseToStoredString(input.currentAmountPaise),
    } as unknown as StoredGoal;
    write(GOAL_KEY, [...read<StoredGoal>(GOAL_KEY), row]);
    return {
      ...input,
      id: row.id,
    };
  }

  async updateSavingsGoal(
    id: string,
    patch: Partial<SavingsGoalInput>,
  ): Promise<void> {
    const all = read<StoredGoal>(GOAL_KEY);
    const idx = all.findIndex((g) => g.id === id);
    if (idx === -1) throw new Error("Savings goal not found");
    all[idx] = { ...all[idx], ...(patch as Partial<StoredGoal>) };
    if (patch.targetAmountPaise !== undefined)
      all[idx].targetAmount = paiseToStoredString(patch.targetAmountPaise);
    if (patch.currentAmountPaise !== undefined)
      all[idx].currentAmount = paiseToStoredString(patch.currentAmountPaise);
    write(GOAL_KEY, all);
  }

  async deleteSavingsGoal(id: string): Promise<void> {
    write(
      GOAL_KEY,
      read<StoredGoal>(GOAL_KEY).filter((g) => g.id !== id),
    );
  }
}

/** Exact paise → "1234.56" string with no float arithmetic. */
export function paiseToStoredString(paise: number): string {
  const negative = paise < 0;
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const p = abs % 100;
  return `${negative ? "-" : ""}${rupees}.${String(p).padStart(2, "0")}`;
}
