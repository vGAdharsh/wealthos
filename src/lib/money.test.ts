import { describe, expect, it } from "vitest";
import {
  MoneyParseError,
  addPaise,
  formatINR,
  subPaise,
  sumPaise,
  toPaise,
} from "./money";

describe("toPaise — exact decimal parsing", () => {
  it("parses the spec's worked example exactly", () => {
    expect(toPaise("60000")).toBe(6_000_000);
    expect(toPaise("35000")).toBe(3_500_000);
  });
  it("parses Indian-formatted strings", () => {
    expect(toPaise("₹1,23,456.78")).toBe(12_345_678);
    expect(toPaise("1,23,456.78")).toBe(12_345_678);
    expect(toPaise("12.5")).toBe(1250);
    expect(toPaise("12")).toBe(1200);
    expect(toPaise(".99")).toBe(99);
  });
  it("rejects floats that would lose exactness", () => {
    expect(() => toPaise("10.999")).toThrow(MoneyParseError);
    expect(() => toPaise("-5")).toThrow(MoneyParseError);
    expect(() => toPaise("abc")).toThrow(MoneyParseError);
    expect(() => toPaise("")).toThrow(MoneyParseError);
  });
  it("avoids binary floating-point traps", () => {
    // 0.1 + 0.2 ≠ 0.3 in floats; string parsing must not care.
    expect(addPaise(toPaise("0.1"), toPaise("0.2"))).toBe(30);
  });
});

describe("formatINR — Indian grouping without float intermediates", () => {
  it("groups the Indian way", () => {
    expect(formatINR(12345678)).toBe("₹1,23,456.78");
    expect(formatINR(6000000)).toBe("₹60,000");
    expect(formatINR(3500000)).toBe("₹35,000");
    expect(formatINR(2500000)).toBe("₹25,000");
  });
  it("formats sub-rupee and negative amounts", () => {
    expect(formatINR(45)).toBe("₹0.45");
    expect(formatINR(-250000)).toBe("-₹2,500");
  });
});

describe("arithmetic guards", () => {
  it("sums exactly", () => {
    expect(sumPaise([toPaise("0.01"), toPaise("0.02"), toPaise("0.27")])).toBe(30);
  });
  it("subtracts exactly", () => {
    expect(subPaise(6_000_000, 3_500_000)).toBe(2_500_000);
  });
});
