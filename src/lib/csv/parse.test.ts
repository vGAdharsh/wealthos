import { describe, expect, it } from "vitest";
import { parseCsv } from "./parse";

describe("parseCsv — RFC 4180", () => {
  it("parses simple rows", () => {
    expect(parseCsv("a,b,c\n1,2,3\n")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });
  it("handles quoted fields with commas and quotes", () => {
    expect(
      parseCsv('name,note\n"SuperMart, India","said ""ok"" today"\n'),
    ).toEqual([
      ["name", "note"],
      ["SuperMart, India", 'said "ok" today'],
    ]);
  });
  it("handles embedded newlines inside quotes", () => {
    expect(parseCsv('a,b\n"x\ny",2\n')).toEqual([
      ["a", "b"],
      ["x\ny", "2"],
    ]);
  });
  it("handles CRLF and no trailing newline", () => {
    expect(parseCsv("a,b\r\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
  it("skips blank lines", () => {
    expect(parseCsv("a,b\n\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});
