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

// The Into variants read the first len entries of sorted, write spots into out from
// index 0, and return how many they wrote, so a rollout can reuse both arrays.
export function hugSpotsInto(
  range: Range,
  sorted: readonly number[],
  len: number,
  out: number[],
): number {
  let best = -1;
  let count = 0;
  let last = NaN;
  // Tries run lo, then each guess's two neighbours, then hi; the free ones come out
  // ascending, with a repeat only ever next to its twin.
  for (let t = 0; t <= 2 * len + 1; t++) {
    let n: number;
    if (t === 0) n = range.lo;
    else if (t > 2 * len) n = range.hi;
    else n = (sorted[(t - 1) >> 1] as number) + (t % 2 === 1 ? -1 : 1);
    if (n === last || !free(range, sorted, n, len)) continue;
    last = n;
    const p = winAt(n, sorted, range, len);
    if (p > best + 1e-12) {
      best = p;
      count = 0;
      out[count++] = n;
    } else if (Math.abs(p - best) <= 1e-12) {
      out[count++] = n;
    }
  }
  return count;
}

export function hugSpots(range: Range, sorted: readonly number[]): number[] {
  const out: number[] = [];
  hugSpotsInto(range, sorted, sorted.length, out);
  return out;
}

// Edge gaps measure from the bound itself; interior gaps exclude both walls.
function gapWidth(a: number, b: number, edge: boolean): number {
  return edge ? b - a : b - a - 1;
}

export function middleSpotsInto(
  range: Range,
  sorted: readonly number[],
  len: number,
  out: number[],
): number {
  let widest = 0;
  for (let i = 0; i <= len; i++) {
    const a = i === 0 ? range.lo : (sorted[i - 1] as number);
    const b = i === len ? range.hi : (sorted[i] as number);
    widest = Math.max(widest, gapWidth(a, b, i === 0 || i === len));
  }
  let count = 0;
  for (let i = 0; i <= len; i++) {
    const a = i === 0 ? range.lo : (sorted[i - 1] as number);
    const b = i === len ? range.hi : (sorted[i] as number);
    const width = gapWidth(a, b, i === 0 || i === len);
    if (width <= 0 || width < widest - 1) continue;
    const mid = (a + b) / 2;
    const first = Number.isInteger(mid) ? mid : Math.floor(mid);
    const spotsEnd = Number.isInteger(mid) ? mid : Math.ceil(mid);
    for (let n = first; n <= spotsEnd; n++) {
      if (free(range, sorted, n, len) && out[count - 1] !== n) out[count++] = n;
    }
  }
  return count;
}

export function middleSpots(range: Range, sorted: readonly number[]): number[] {
  const out: number[] = [];
  middleSpotsInto(range, sorted, sorted.length, out);
  return out;
}

export function freeCount(range: Range, sorted: readonly number[], len = sorted.length): number {
  return range.hi - range.lo + 1 - len;
}

export function nthFree(
  range: Range,
  sorted: readonly number[],
  index: number,
  len = sorted.length,
): number {
  let n = range.lo + index;
  for (let i = 0; i < len; i++) {
    if ((sorted[i] as number) <= n) n++;
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
