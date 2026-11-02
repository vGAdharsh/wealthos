/**
 * WealthOS domain types. Amounts are ALWAYS integer paise in application
 * code; conversion to/from database numerics happens only at the
 * repository boundary.
 */

import type { Paise } from "./money";

export type TxType =
  | "income"
  | "expense"
  | "transfer"
  | "refund"
  | "reimbursement";

export const TX_TYPES: TxType[] = [
  "income",
  "expense",
  "transfer",
  "refund",
  "reimbursement",
];

export type Category = {
  id: string;
  name: string;
  isSystem: boolean;
};

export type Transaction = {
  id: string;
  type: TxType;
  /** ISO yyyy-mm-dd */
  date: string;
  amountPaise: Paise;
  description: string;
  /** Income source or merchant/payee */
  source: string;
  categoryId: string | null;
  categoryName?: string | null;
  paymentMethod: string | null;
  notes: string | null;
  isRecurring: boolean;
  contentHash: string;
  importBatchId: string | null;
  createdAt: string;
};

export type TransactionInput = Omit<
  Transaction,
  "id" | "createdAt" | "categoryName" | "importBatchId"
> & { importBatchId?: string | null };

export type Budget = {
  id: string;
  name: string;
  /** null = overall budget across categories */
  categoryId: string | null;
  categoryName?: string | null;
  amountPaise: Paise;
  /** ISO yyyy-mm-dd inclusive */
  periodStart: string;
  periodEnd: string;
};

export type BudgetInput = Omit<Budget, "id" | "categoryName">;

export type SavingsGoal = {
  id: string;
  name: string;
  kind: "emergency" | "short_term" | "long_term";
  targetAmountPaise: Paise;
  currentAmountPaise: Paise;
  targetDate: string | null;
};

export type SavingsGoalInput = Omit<SavingsGoal, "id">;

export type TxFilter = {
  types?: TxType[];
  from?: string;
  to?: string;
  categoryId?: string;
};
