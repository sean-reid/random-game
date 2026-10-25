import type { Range } from "./types";
import { isFree as free, winAt } from "./win";

export interface Mix {
  middle: number;
  anywhere: number;
  hugger: number;
}

export const PRIOR_MIX: Mix = { middle: 0.5, anywhere: 0.35, hugger: 0.15 };
export const PRIOR_WEIGHT = 6;

export interface Observation extends Range {
  before: number[];
  guess: number;
}

export function hugSpots(range: Range, sorted: readonly number[]): number[] {
  const tries = new Set<number>([range.lo, range.hi]);
  for (const g of sorted) {
    tries.add(g - 1);
    tries.add(g + 1);
  }
  let best = -1;
  let out: number[] = [];
  for (const n of [...tries].sort((a, b) => a - b)) {
    if (!free(range, sorted, n)) continue;
    const p = winAt(n, sorted, range);
    if (p > best + 1e-12) {
      best = p;
      out = [n];
    } else if (Math.abs(p - best) <= 1e-12) {
      out.push(n);
    }
  }
  return out;
}

// Edge gaps measure from the bound itself; interior gaps exclude both walls.
export function middleSpots(range: Range, sorted: readonly number[]): number[] {
  const walls = [range.lo, ...sorted, range.hi];
  const gaps: { width: number; mid: number }[] = [];
  for (let i = 0; i + 1 < walls.length; i++) {
    const a = walls[i] as number;
    const b = walls[i + 1] as number;
    const edge = i === 0 || i + 2 === walls.length;
    const width = edge ? b - a : b - a - 1;
    if (width > 0) gaps.push({ width, mid: (a + b) / 2 });
  }
  const widest = Math.max(0, ...gaps.map((g) => g.width));
  const out = new Set<number>();
  for (const g of gaps) {
    if (g.width < widest - 1) continue;
    const spots = Number.isInteger(g.mid) ? [g.mid] : [Math.floor(g.mid), Math.ceil(g.mid)];
    for (const n of spots) if (free(range, sorted, n)) out.add(n);
  }
  return [...out].sort((a, b) => a - b);
}

export function freeCount(range: Range, sorted: readonly number[]): number {
  return range.hi - range.lo + 1 - sorted.length;
}

export function nthFree(range: Range, sorted: readonly number[], index: number): number {
  let n = range.lo + index;
  for (const g of sorted) {
    if (g <= n) n++;
    else break;
  }
  return n;
}

export function likelihoods(o: Observation): Mix {
  const sorted = [...o.before].sort((a, b) => a - b);
  const range = { lo: o.lo, hi: o.hi };
  const near = (spots: number[]) => {
    const set = new Set<number>();
    for (const s of spots)
      for (const d of [-1, 0, 1]) if (free(range, sorted, s + d)) set.add(s + d);
    return set;
  };
  const middle = near(middleSpots(range, sorted));
  const hug = new Set(hugSpots(range, sorted));
  const anywhere = 1 / Math.max(1, freeCount(range, sorted));
  return {
    middle: middle.has(o.guess) ? 1 / middle.size : 0,
    anywhere,
    hugger: hug.has(o.guess) ? 1 / hug.size : 0,
  };
}

export function fitMix(
  observations: readonly Observation[],
  prior = PRIOR_MIX,
  weight = PRIOR_WEIGHT,
): Mix {
  const ls = observations.map(likelihoods);
  let mix = { ...prior };
  for (let iter = 0; iter < 60; iter++) {
    const sum = {
      middle: weight * prior.middle,
      anywhere: weight * prior.anywhere,
      hugger: weight * prior.hugger,
    };
    for (const l of ls) {
      const m = mix.middle * l.middle;
      const a = mix.anywhere * l.anywhere;
      const h = mix.hugger * l.hugger;
      const z = m + a + h;
      if (z <= 0) continue;
      sum.middle += m / z;
      sum.anywhere += a / z;
      sum.hugger += h / z;
    }
    const total = sum.middle + sum.anywhere + sum.hugger;
    const next = {
      middle: sum.middle / total,
      anywhere: sum.anywhere / total,
      hugger: sum.hugger / total,
    };
    const delta = Math.abs(next.middle - mix.middle) + Math.abs(next.anywhere - mix.anywhere);
    mix = next;
    if (delta < 1e-9) break;
  }
  return mix;
}
