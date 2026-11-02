/**
 * Deterministic content hash for duplicate detection (spec Part 10).
 * FNV-1a 64-bit over a normalised string, computed with BigInt integer
 * math — exact, stable across local mode and database mode.
 */

const PRIME = 0x100000001b3n;
const MASK = 0xffffffffffffffffn;
const OFFSET = 0xcbf29ce484222325n;

function fnv1a64(input: string): string {
  let h = OFFSET;
  for (let i = 0; i < input.length; i++) {
    h ^= BigInt(input.charCodeAt(i));
    h = (h * PRIME) & MASK;
  }
  return h.toString(16).padStart(16, "0");
}

function normalise(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function contentHash(
  type: string,
  date: string,
  amountPaise: number,
  description: string,
  source: string,
): string {
  return fnv1a64(
    `${type}|${date}|${amountPaise}|${normalise(description)}|${normalise(source)}`,
  );
}
