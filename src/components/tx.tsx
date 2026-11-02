import type { Transaction, TxType } from "@/lib/types";
import { formatINR } from "@/lib/money";

export const TYPE_LABELS: Record<TxType, string> = {
  income: "Income",
  expense: "Expense",
  transfer: "Transfer",
  refund: "Refund",
  reimbursement: "Reimbursement",
};

/** Signed rendering: money in is +, money out is −, transfers are neutral. */
export function txDisplay(t: Transaction): { text: string; tone: string } {
  if (t.type === "income" || t.type === "refund" || t.type === "reimbursement")
    return { text: `+${formatINR(t.amountPaise)}`, tone: "text-accent" };
  if (t.type === "transfer")
    return { text: formatINR(t.amountPaise), tone: "text-muted" };
  return { text: `−${formatINR(t.amountPaise)}`, tone: "text-danger" };
}
