import type { Range } from "./types";

// The len parameters let callers keep a longer buffer and use only its first len entries.
export function lowerBound(sorted: readonly number[], x: number, len = sorted.length): number {
  let lo = 0;
  let hi = len;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((sorted[mid] as number) < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function insertSorted(sorted: number[], x: number): void {
  sorted.splice(lowerBound(sorted, x), 0, x);
}

export function insertInto(buf: number[], len: number, x: number): void {
  const i = lowerBound(buf, x, len);
  for (let j = len; j > i; j--) buf[j] = buf[j - 1] as number;
  buf[i] = x;
}

export function has(sorted: readonly number[], x: number, len = sorted.length): boolean {
  const i = lowerBound(sorted, x, len);
  return i < len && sorted[i] === x;
}

export function isFree(range: Range, sorted: readonly number[], n: number, len = sorted.length) {
  return n >= range.lo && n <= range.hi && !has(sorted, n, len);
}

export interface Region {
  start: number;
  end: number;
  ties: number;
}

// An even sum puts the midpoint on an integer both guesses share.
const startAfter = (left: number, x: number) => {
  const s = left + x;
  return s % 2 === 0 ? s / 2 + 1 : (s + 1) / 2;
};
const endBefore = (x: number, right: number) => {
  const s = right + x;
  return s % 2 === 0 ? s / 2 - 1 : (s - 1) / 2;
};
const tiesBetween = (x: number, left: number | undefined, right: number | undefined) =>
  (left !== undefined && (left + x) % 2 === 0 ? 1 : 0) +
  (right !== undefined && (right + x) % 2 === 0 ? 1 : 0);

export function regionOf(x: number, others: readonly number[], range: Range): Region | null {
  const i = lowerBound(others, x);
  const left = i > 0 ? (others[i - 1] as number) : undefined;
  const right = i < others.length ? (others[i] as number) : undefined;
  if (right === x) return null;
  const start = left === undefined ? range.lo : startAfter(left, x);
  const end = right === undefined ? range.hi : endBefore(x, right);
  return {
    start: Math.max(start, range.lo),
    end: Math.min(end, range.hi),
    ties: tiesBetween(x, left, right),
  };
}

export function shareBetween(
  x: number,
  left: number | undefined,
  right: number | undefined,
  range: Range,
): number {
  const start = Math.max(left === undefined ? range.lo : startAfter(left, x), range.lo);
  const end = Math.min(right === undefined ? range.hi : endBefore(x, right), range.hi);
  const size = range.hi - range.lo + 1;
  return (Math.max(0, end - start + 1) + tiesBetween(x, left, right) / 2) / size;
}

export function winAt(x: number, others: readonly number[], range: Range, len = others.length) {
  const i = lowerBound(others, x, len);
  const left = i > 0 ? (others[i - 1] as number) : undefined;
  const right = i < len ? (others[i] as number) : undefined;
  if (right === x) return 0;
  return shareBetween(x, left, right, range);
}

export function winEach(sorted: readonly number[], range: Range): Map<number, number> {
  const out = new Map<number, number>();
  for (let i = 0; i < sorted.length; i++) {
    const g = sorted[i] as number;
    out.set(
      g,
      winAt(
        g,
        sorted.filter((_, j) => j !== i),
        range,
      ),
    );
  }
  return out;
}
