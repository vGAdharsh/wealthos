/**
 * DataProvider — the single interface every page talks to, regardless of
 * whether WealthOS runs in database mode (Supabase) or local mode
 * (browser storage). Amounts cross this boundary as integer paise only.
 */

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
import type { WealthProvider } from "./wealth";

export interface DataProvider {
  readonly mode: "local" | "database";
  readonly wealth: WealthProvider;

  listTransactions(filter?: TxFilter): Promise<Transaction[]>;
  createTransaction(input: TransactionInput): Promise<Transaction>;
  updateTransaction(
    id: string,
    patch: Partial<TransactionInput>,
  ): Promise<void>;
  deleteTransaction(id: string): Promise<void>;
  /** Bulk insert for CSV import / migration; skips rows whose
   * contentHash already exists for the user. Returns inserted count. */
  bulkCreateTransactions(inputs: TransactionInput[]): Promise<number>;

  listCategories(): Promise<Category[]>;
  createCategory(name: string): Promise<Category>;

  listBudgets(): Promise<Budget[]>;
  createBudget(input: BudgetInput): Promise<Budget>;
  updateBudget(id: string, patch: Partial<BudgetInput>): Promise<void>;
  deleteBudget(id: string): Promise<void>;

  listSavingsGoals(): Promise<SavingsGoal[]>;
  createSavingsGoal(input: SavingsGoalInput): Promise<SavingsGoal>;
  updateSavingsGoal(
    id: string,
    patch: Partial<SavingsGoalInput>,
  ): Promise<void>;
  deleteSavingsGoal(id: string): Promise<void>;
}
