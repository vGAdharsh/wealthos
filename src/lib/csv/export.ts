/** RFC 4180 CSV export of the unified ledger. */

import type { Transaction } from "@/lib/types";

function escapeField(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

const COLUMNS = [
  "date",
  "type",
  "amount",
  "category",
  "source",
  "description",
  "payment_method",
  "notes",
  "is_recurring",
] as const;

export function transactionsToCsv(
  transactions: Transaction[],
  categoryName: (id: string | null) => string,
): string {
  const lines: string[] = [COLUMNS.join(",")];
  for (const t of transactions) {
    lines.push(
      [
        t.date,
        t.type,
        paiseToCsvAmount(t.amountPaise),
        escapeField(categoryName(t.categoryId)),
        escapeField(t.source),
        escapeField(t.description),
        escapeField(t.paymentMethod ?? ""),
        escapeField(t.notes ?? ""),
        t.isRecurring ? "yes" : "no",
      ].join(","),
    );
  }
  return lines.join("\r\n") + "\r\n";
}

/** Exact paise → plain decimal string (no float). */
export function paiseToCsvAmount(paise: number): string {
  const negative = paise < 0;
  const abs = Math.abs(paise);
  return `${negative ? "-" : ""}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
