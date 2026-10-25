import type { Range } from "./types";

export function lowerBound(sorted: readonly number[], x: number): number {
  let lo = 0;
  let hi = sorted.length;
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

export interface Region {
  start: number;
  end: number;
  ties: number;
}

export function regionOf(x: number, others: readonly number[], range: Range): Region | null {
  const i = lowerBound(others, x);
  const left = i > 0 ? (others[i - 1] as number) : undefined;
  const right = i < others.length ? (others[i] as number) : undefined;
  if (right === x) return null;

  let start = range.lo;
  let end = range.hi;
  let ties = 0;
  if (left !== undefined) {
    const s = left + x;
    if (s % 2 === 0) {
      ties += 1;
      start = s / 2 + 1;
    } else {
      start = (s + 1) / 2;
    }
  }
  if (right !== undefined) {
    const s = right + x;
    if (s % 2 === 0) {
      ties += 1;
      end = s / 2 - 1;
    } else {
      end = (s - 1) / 2;
    }
  }
  return { start: Math.max(start, range.lo), end: Math.min(end, range.hi), ties };
}

export function winAt(x: number, others: readonly number[], range: Range): number {
  const r = regionOf(x, others, range);
  if (r === null) return 0;
  const size = range.hi - range.lo + 1;
  return (Math.max(0, r.end - r.start + 1) + r.ties / 2) / size;
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
