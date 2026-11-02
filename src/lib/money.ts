/**
 * WealthOS money primitives.
 *
 * RULE (spec Part 8): never use floating-point arithmetic for financial
 * amounts where exact decimal arithmetic is required. All monetary values
 * in application code are integers in paise (₹1 = 100 paise).
 *
 * Parsing is done with STRING arithmetic, never Number("1.23") * 100.
 */

export type Paise = number;

export class MoneyParseError extends Error {}

/**
 * Parse a user-entered decimal amount ("1,23,456.78", "₹250", "250.5")
 * into exact integer paise. Rejects negative, non-numeric, >2 decimal
 * places, and unsafe integers.
 */
export function toPaise(input: string | number): Paise {
  const s = String(input).trim().replace(/[₹,\s]/g, "");
  if (s.length === 0 || s === ".") throw new MoneyParseError("Empty amount");
  if (s.startsWith("-") || s.startsWith("+"))
    throw new MoneyParseError("Signed amounts are not valid here");
  if (!/^\d*(\.\d*)?$/.test(s))
    throw new MoneyParseError(`Not a valid decimal amount: ${input}`);
  const [wholeRaw, fracRaw = ""] = s.split(".");
  const whole = wholeRaw === "" ? "0" : wholeRaw;
  if (fracRaw.length > 2)
    throw new MoneyParseError("Amounts support at most 2 decimal places (paise)");
  const frac = (fracRaw + "00").slice(0, 2);
  // String-concatenated integer avoids any float intermediate.
  const paise = Number(`${stripLeadingZeros(whole)}${frac}`);
  if (!Number.isSafeInteger(paise))
    throw new MoneyParseError("Amount is too large");
  return paise;
}

function stripLeadingZeros(s: string): string {
  const stripped = s.replace(/^0+(?=\d)/, "");
  return stripped === "" ? "0" : stripped;
}

/** Exact integer addition with overflow guard. */
export function addPaise(a: Paise, b: Paise): Paise {
  const sum = a + b;
  if (!Number.isSafeInteger(sum)) throw new MoneyParseError("Overflow");
  return sum;
}

/** Exact integer subtraction with overflow guard. */
export function subPaise(a: Paise, b: Paise): Paise {
  const diff = a - b;
  if (!Number.isSafeInteger(diff)) throw new MoneyParseError("Overflow");
  return diff;
}

/** Sum a list of paise amounts exactly. */
export function sumPaise(amounts: Paise[]): Paise {
  return amounts.reduce((acc, n) => addPaise(acc, n), 0);
}

/**
 * Format integer paise as an Indian-rupee string with exact Indian digit
 * grouping (₹1,23,45,678.90), computed WITHOUT any float intermediate.
 */
export function formatINR(paise: Paise): string {
  const negative = paise < 0;
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const p = abs % 100;
  const rupeeStr = groupIndian(String(rupees));
  const frac = p === 0 && isWholeRupeeAmount(paise) ? "" : `.${String(p).padStart(2, "0")}`;
  return `${negative ? "-" : ""}₹${rupeeStr}${frac}`;
}

function isWholeRupeeAmount(paise: Paise): boolean {
  // Show paise whenever the amount is not a whole rupee; whole amounts
  // render without decimals for cleaner dashboards.
  return paise % 100 === 0;
}

function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  // Indian grouping: rest is grouped in twos from the right.
  const parts: string[] = [];
  let r = rest;
  while (r.length > 2) {
    parts.unshift(r.slice(-2));
    r = r.slice(0, -2);
  }
  if (r.length > 0) parts.unshift(r);
  return `${parts.join(",")},${last3}`;
}
