import { describe, expect, it } from "vitest";
import { transactionsToCsv } from "./export";
import { parseCsv } from "./parse";
import {
  buildImportPreview,
  detectColumnMapping,
  parseCsvAmount,
  parseCsvDate,
  parseCsvType,
} from "./import";
import { contentHash } from "@/lib/repository/hash";
import type { Transaction } from "@/lib/types";

describe("column mapping", () => {
  it("maps common Indian-bank headers", () => {
    const m = detectColumnMapping([
      "Txn Date",
      "Description",
      "Amount (INR)",
      "Dr/Cr",
      "Mode",
    ]);
    expect(m.date).toBe(0);
    expect(m.description).toBe(1);
    expect(m.amount).toBe(2);
    expect(m.type).toBe(3);
    expect(m.paymentMethod).toBe(4);
  });
});

describe("parseCsvAmount", () => {
  it("parses currency-formatted amounts exactly", () => {
    expect(parseCsvAmount("₹1,23,456.78")).toEqual({ ok: true, value: 12_345_678 });
    expect(parseCsvAmount("1,234.56")).toEqual({ ok: true, value: 123_456 });
    expect(parseCsvAmount("-500")).toEqual({ ok: true, value: -50_000 });
    expect(parseCsvAmount("250.50DR")).toEqual({ ok: true, value: -25_050 });
    expect(parseCsvAmount("250.50CR")).toEqual({ ok: true, value: 25_050 });
  });
  it("rejects junk", () => {
    expect(parseCsvAmount("abc").ok).toBe(false);
    expect(parseCsvAmount("").ok).toBe(false);
    expect(parseCsvAmount("1.999").ok).toBe(false);
  });
});

describe("parseCsvDate", () => {
  it("accepts the common formats and normalises to ISO", () => {
    expect(parseCsvDate("2026-11-02")).toEqual({ ok: true, value: "2026-11-02" });
    expect(parseCsvDate("02/11/2026")).toEqual({ ok: true, value: "2026-11-02" });
    expect(parseCsvDate("2-11-2026")).toEqual({ ok: true, value: "2026-11-02" });
    expect(parseCsvDate("2026/11/2")).toEqual({ ok: true, value: "2026-11-02" });
  });
  it("rejects impossible dates", () => {
    expect(parseCsvDate("31/02/2026").ok).toBe(false);
    expect(parseCsvDate("yesterday").ok).toBe(false);
  });
});

describe("parseCsvType", () => {
  it("maps bank debit/credit vocabulary", () => {
    expect(parseCsvType("Debit", "expense")).toEqual({ ok: true, value: "expense" });
    expect(parseCsvType("CREDIT", "expense")).toEqual({ ok: true, value: "income" });
    expect(parseCsvType("", "transfer")).toEqual({ ok: true, value: "transfer" });
    expect(parseCsvType("???", "expense").ok).toBe(false);
  });
});

describe("buildImportPreview", () => {
  const csv = [
    "date,type,amount,description,source",
    "2026-10-01,expense,250.00,Breakfast,Swiggy",
    "2026-10-02,expense,1200,Movie,PVR",
    "02/10/2026,expense,1200,Movie,PVR",
    "not-a-date,expense,100,Bad row,X",
    "2026-10-03,income,60000,Salary,Acme",
    "2026-10-04,expense,abc,Bad amount,X",
    "2026-10-05,expense,300,Groceries,BigBasket",
  ].join("\n");

  it("classifies every row exactly once", () => {
    const preview = buildImportPreview(csv, new Set(), {
      defaultType: "expense",
      defaultCategoryId: null,
    });
    expect(preview.validCount).toBe(4); // breakfast, movie, salary, groceries
    expect(preview.duplicateCount).toBe(1); // second Movie row (in-file)
    expect(preview.errorCount).toBe(2); // bad date, bad amount
  });

  it("marks duplicates against existing records and within the file", () => {
    const existingHash = contentHash("expense", "2026-10-01", 25_000, "Breakfast", "Swiggy");
    const preview = buildImportPreview(csv, new Set([existingHash]), {
      defaultType: "expense",
      defaultCategoryId: null,
    });
    const dupRows = preview.rows.filter((r) => r.status === "duplicate");
    expect(dupRows.length).toBe(2); // 1 vs ledger + 1 in-file
    expect(dupRows.some((r) => r.fileDuplicateOf !== undefined)).toBe(true);
  });

  it("reports the missing-header case as one error row", () => {
    const preview = buildImportPreview("foo,bar\n1,2", new Set(), {
      defaultType: "expense",
      defaultCategoryId: null,
    });
    expect(preview.errorCount).toBe(1);
    expect(preview.rows[0].error).toContain("Required columns missing");
  });
});

describe("export → import round-trip", () => {
  it("preserves values exactly, including quoted fields", () => {
    const txs: Transaction[] = [
      mk("2026-10-01", "expense", 25_050, 'Breakfast, "deluxe"', "Swiggy"),
      mk("2026-10-03", "income", 6_000_000, "Salary", "Acme"),
    ];
    const csv = transactionsToCsv(txs, () => "Food & Dining");
    const preview = buildImportPreview(csv, new Set(), {
      defaultType: "expense",
      defaultCategoryId: null,
    });
    expect(preview.validCount).toBe(2);
    const imported = preview.rows.map((r) => r.input!);
    expect(imported[0].amountPaise).toBe(25_050);
    expect(imported[0].description).toBe('Breakfast, "deluxe"');
    expect(imported[1].amountPaise).toBe(6_000_000);
    expect(imported[1].type).toBe("income");
  });

  it("exports CRLF rows and quotes only when needed", () => {
    const csv = transactionsToCsv(
      [mk("2026-10-01", "expense", 100, "plain", "X")],
      () => "",
    );
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(parseCsv(csv)[1]).toEqual([
      "2026-10-01",
      "expense",
      "1.00",
      "",
      "X",
      "plain",
      "",
      "",
      "no",
    ]);
  });
});

function mk(
  date: string,
  type: Transaction["type"],
  amountPaise: number,
  description: string,
  source: string,
): Transaction {
  return {
    id: description,
    type,
    date,
    amountPaise,
    description,
    source,
    categoryId: null,
    categoryName: null,
    paymentMethod: null,
    notes: null,
    isRecurring: false,
    contentHash: contentHash(type, date, amountPaise, description, source),
    importBatchId: null,
    createdAt: date,
  };
}
