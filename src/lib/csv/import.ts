/**
 * CSV import pipeline: header mapping → row validation → duplicate
 * detection → preview rows. Pure functions, fully unit-tested; the UI
 * only renders the preview and calls DataProvider.bulkCreateTransactions
 * with the accepted inputs.
 */

import { toPaise } from "@/lib/money";
import { contentHash } from "@/lib/repository/hash";
import type { TransactionInput, TxType } from "@/lib/types";
import { parseCsv } from "./parse";

export type ColumnMapping = {
  date?: number;
  type?: number;
  amount?: number;
  category?: number;
  description?: number;
  source?: number;
  paymentMethod?: number;
  notes?: number;
};

const HEADER_ALIASES: Record<keyof ColumnMapping, string[]> = {
  date: ["date", "tx date", "transaction date", "txn date", "value date", "posted date", "posting date"],
  type: ["type", "tx type", "transaction type", "txn type", "dr/cr", "debit/credit"],
  amount: ["amount", "value", "amount (inr)", "amount inr", "withdrawal/deposit", "rupees"],
  category: ["category", "expense category", "category name"],
  description: ["description", "details", "narration", "particulars", "remarks", "memo"],
  source: ["source", "merchant", "payee", "paid to", "received from", "party"],
  paymentMethod: ["payment method", "mode", "payment mode", "paid via", "instrument"],
  notes: ["notes", "note", "comment", "comments"],
};

export function detectColumnMapping(headers: string[]): ColumnMapping {
  const norm = headers.map((h) => h.trim().toLowerCase());
  const mapping: ColumnMapping = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [
    keyof ColumnMapping,
    string[],
  ][]) {
    // Exact match first, then starts-with (e.g. "Transaction Date (IST)").
    let idx = norm.findIndex((h) => aliases.includes(h));
    if (idx === -1)
      idx = norm.findIndex((h) => aliases.some((a) => h.startsWith(a)));
    if (idx !== -1) mapping[field] = idx;
  }
  return mapping;
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** Parses "₹1,234.56", "1234.56", "-500" etc. Negative allowed here —
 * the caller decides whether the sign is meaningful for the type. */
export function parseCsvAmount(raw: string): ParseResult<number> {
  let s = raw.trim().replace(/[₹\s]/g, "");
  if (s === "") return { ok: false, error: "Empty amount" };
  let negative = false;
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }
  // Trailing DR/CR notation used by some bank exports.
  if (/(\.\d*)?dr$/i.test(s)) {
    negative = true;
    s = s.replace(/dr$/i, "");
  } else if (/(\.\d*)?cr$/i.test(s)) {
    s = s.replace(/cr$/i, "");
  }
  try {
    const paise = toPaise(s);
    return { ok: true, value: negative ? -paise : paise };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Bad amount" };
  }
}

/** Accepts yyyy-mm-dd, dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy, yyyy/mm/dd. */
export function parseCsvDate(raw: string): ParseResult<string> {
  const s = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) {
    const [, y, m, d] = iso;
    return validDate(y, m, d) ? { ok: true, value: `${y}-${m}-${d}` } : { ok: false, error: `Invalid date: ${raw}` };
  }
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (dmy) {
    const [, a, b, y] = dmy;
    let day = Number(a);
    let month = Number(b);
    if (day > 12 && month <= 12) {
      // DD-MM-YYYY — unambiguous
    } else if (month > 12 && day <= 12) {
      // First field must be the month (e.g. MM-DD-YYYY); swap.
      [day, month] = [month, day];
    }
    const dd = String(day).padStart(2, "0");
    const mm = String(month).padStart(2, "0");
    return validDate(y, mm, dd)
      ? { ok: true, value: `${y}-${mm}-${dd}` }
      : { ok: false, error: `Invalid date: ${raw}` };
  }
  const ymd = /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/.exec(s);
  if (ymd) {
    const [, y, m, d] = ymd;
    const mm = m.padStart(2, "0");
    const dd = d.padStart(2, "0");
    return validDate(y, mm, dd)
      ? { ok: true, value: `${y}-${mm}-${dd}` }
      : { ok: false, error: `Invalid date: ${raw}` };
  }
  return { ok: false, error: `Unrecognised date format: ${raw}` };
}

function validDate(y: string, m: string, d: string): boolean {
  const date = new Date(`${y}-${m}-${d}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.getUTCFullYear() === Number(y) &&
    date.getUTCMonth() + 1 === Number(m) &&
    date.getUTCDate() === Number(d)
  );
}

const TYPE_ALIASES: Record<string, TxType> = {
  income: "income",
  credit: "income",
  salary: "income",
  deposit: "income",
  received: "income",
  expense: "expense",
  debit: "expense",
  purchase: "expense",
  spent: "expense",
  paid: "expense",
  withdrawal: "expense",
  transfer: "transfer",
  internal: "transfer",
  refund: "refund",
  cashback: "refund",
  reimbursement: "reimbursement",
};

export function parseCsvType(raw: string, fallback: TxType): ParseResult<TxType> {
  const s = raw.trim().toLowerCase();
  if (s === "") return { ok: true, value: fallback };
  const t = TYPE_ALIASES[s];
  return t
    ? { ok: true, value: t }
    : { ok: false, error: `Unknown transaction type: ${raw}` };
}

export type ImportRow = {
  rowNumber: number; // 1-based data row (excluding header)
  status: "valid" | "duplicate" | "error";
  error?: string;
  input?: TransactionInput;
  /** duplicate of an earlier row in the same file */
  fileDuplicateOf?: number;
};

export type ImportOptions = {
  /** Applied when the CSV has no type column */
  defaultType: TxType;
  /** Category id applied when the CSV has no/useless category column */
  defaultCategoryId: string | null;
};

export type ImportPreview = {
  rows: ImportRow[];
  validCount: number;
  duplicateCount: number;
  errorCount: number;
};

/**
 * Validates and de-duplicates CSV data rows against `existingHashes`
 * (from the user's current records) and against earlier rows in the
 * same file. Never throws — every problem is reported per row.
 */
export function buildImportPreview(
  csvText: string,
  existingHashes: Set<string>,
  options: ImportOptions,
): ImportPreview {
  const all = parseCsv(csvText);
  if (all.length === 0)
    return { rows: [], validCount: 0, duplicateCount: 0, errorCount: 0 };
  const headers = all[0];
  const mapping = detectColumnMapping(headers);
  if (mapping.amount === undefined || mapping.date === undefined)
    return {
      rows: [
        {
          rowNumber: 0,
          status: "error",
          error: `Required columns missing in header "${headers.join(", ")}" — need at least a date and an amount column.`,
        },
      ],
      validCount: 0,
      duplicateCount: 0,
      errorCount: 1,
    };

  const rows: ImportRow[] = [];
  const fileHashes = new Map<string, number>(); // hash → first rowNumber
  let validCount = 0;
  let duplicateCount = 0;
  let errorCount = 0;

  for (let r = 1; r < all.length; r++) {
    const cells = all[r];
    const rowNumber = r; // header is row 0, data rows 1-based
    const get = (col?: number) =>
      col === undefined ? "" : (cells[col] ?? "").trim();

    const date = parseCsvDate(get(mapping.date));
    if (!date.ok) {
      rows.push({ rowNumber, status: "error", error: date.error });
      errorCount += 1;
      continue;
    }
    const amount = parseCsvAmount(get(mapping.amount));
    if (!amount.ok) {
      rows.push({ rowNumber, status: "error", error: amount.error });
      errorCount += 1;
      continue;
    }
    const type = parseCsvType(get(mapping.type), options.defaultType);
    if (!type.ok) {
      rows.push({ rowNumber, status: "error", error: type.error });
      errorCount += 1;
      continue;
    }
    if (amount.value <= 0) {
      rows.push({
        rowNumber,
        status: "error",
        error: "Non-positive amount after parsing — sign/type mismatch",
      });
      errorCount += 1;
      continue;
    }

    const description = get(mapping.description);
    const source = get(mapping.source);
    const input: TransactionInput = {
      type: type.value,
      date: date.value,
      amountPaise: amount.value,
      description,
      source,
      categoryId: options.defaultCategoryId,
      paymentMethod: get(mapping.paymentMethod) || null,
      notes: get(mapping.notes) || null,
      isRecurring: false,
      contentHash: contentHash(
        type.value,
        date.value,
        amount.value,
        description,
        source,
      ),
    };

    // Duplicate of something already in the ledger?
    if (existingHashes.has(input.contentHash)) {
      rows.push({ rowNumber, status: "duplicate", input });
      duplicateCount += 1;
      continue;
    }
    // Duplicate of an earlier row in this same file?
    const earlier = fileHashes.get(input.contentHash);
    if (earlier !== undefined) {
      rows.push({
        rowNumber,
        status: "duplicate",
        input,
        fileDuplicateOf: earlier,
      });
      duplicateCount += 1;
      continue;
    }

    fileHashes.set(input.contentHash, rowNumber);
    rows.push({ rowNumber, status: "valid", input });
    validCount += 1;
  }

  return { rows, validCount, duplicateCount, errorCount };
}

/** Hashes of the user's current transactions, for duplicate checking. */
export function hashesFromInputs(inputs: TransactionInput[]): Set<string> {
  return new Set(inputs.map((i) => i.contentHash));
}
