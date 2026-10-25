import {
  freeCount,
  hugSpotsInto,
  middleSpotsInto,
  nthFree,
  PRIOR_MIX,
  type Mix,
} from "./opponents";
import { mulberry32 } from "./random";
import type { Board, CurvePoint, Range, Recommendation } from "./types";
import { insertInto, isFree, lowerBound, shareBetween, winAt } from "./win";

export const MAX_AFTER = 12;

export function clampAfter(after: number): number {
  return Number.isFinite(after) ? Math.max(0, Math.min(MAX_AFTER, Math.floor(after))) : 0;
}
const FULL_SCAN = 400;
const ROLLOUT_GRID = 200;
const ROLLOUT_BUDGET = 60_000;
const NOISE_SIGMAS = 2;
const MIN_ROLLOUTS = 40;
const MAX_ROLLOUTS = 300;
const LOW_QUANTILE = 0.1;

export function rolloutCount(candidates: number, after: number): number {
  return Math.max(
    MIN_ROLLOUTS,
    Math.min(MAX_ROLLOUTS, Math.round(ROLLOUT_BUDGET / Math.max(1, candidates * after))),
  );
}

function candidates(range: Range, taken: readonly number[], grid: number): number[] {
  const { lo, hi } = range;
  const set = new Set<number>();
  const size = hi - lo + 1;
  if (size <= FULL_SCAN) {
    for (let n = lo; n <= hi; n++) set.add(n);
  } else {
    const step = (size - 1) / (grid - 1);
    for (let i = 0; i < grid; i++) set.add(lo + Math.round(i * step));
    const walls = [lo - 1, ...taken, hi + 1];
    for (let i = 0; i + 1 < walls.length; i++) {
      set.add(Math.round(((walls[i] as number) + (walls[i + 1] as number)) / 2));
    }
    for (const g of taken) for (const d of [-2, -1, 1, 2]) set.add(g + d);
  }
  return [...set].filter((n) => isFree(range, taken, n)).sort((a, b) => a - b);
}

function nearestGap(x: number, sorted: readonly number[]): number {
  const i = lowerBound(sorted, x);
  const left = i > 0 ? x - (sorted[i - 1] as number) : Infinity;
  const right = i < sorted.length ? (sorted[i] as number) - x : Infinity;
  return Math.min(left, right);
}

// Candidates within the sampling noise of the top share are ties; a tie keeps the
// preferred spot if it is one, then takes the better bad round, then the roomier spot.
function pickBest(
  curve: readonly CurvePoint[],
  sorted: readonly number[],
  prefer: number | null,
): CurvePoint | null {
  let top: CurvePoint | null = null;
  for (const pt of curve) if (top === null || pt.p > top.p) top = pt;
  if (top === null) return null;
  const floor = top.p - NOISE_SIGMAS * top.se - 1e-9;
  const tied = curve.filter((pt) => pt.p >= floor);
  const kept = tied.find((pt) => pt.x === prefer);
  if (kept) return kept;
  let best = top;
  for (const pt of tied) {
    if (pt.low > best.low + 1e-9) best = pt;
    else if (
      Math.abs(pt.low - best.low) <= 1e-9 &&
      nearestGap(pt.x, sorted) > nearestGap(best.x, sorted)
    )
      best = pt;
  }
  return best;
}

// One later player's guess: a type drawn from the mix, then that type's rule. The
// state is the first len entries of buf; spots is scratch for the rule's list.
function reply(
  range: Range,
  buf: readonly number[],
  len: number,
  mix: Mix,
  uType: number,
  uSpot: number,
  spots: number[],
): number | null {
  const open = freeCount(range, buf, len);
  if (open <= 0) return null;
  let count: number;
  if (uType < mix.middle) count = middleSpotsInto(range, buf, len, spots);
  else if (uType < mix.middle + mix.anywhere)
    return nthFree(range, buf, Math.floor(uSpot * open), len);
  else count = hugSpotsInto(range, buf, len, spots);
  if (count === 0) return nthFree(range, buf, Math.floor(uSpot * open), len);
  return spots[Math.floor(uSpot * count)] as number;
}

// Plays the rest of the round out once per noise row with x placed, writing x's final
// share into shares. buf holds the board, x and up to k replies; spots is scratch.
function rollout(
  board: Range,
  sorted: readonly number[],
  x: number,
  k: number,
  mix: Mix,
  noise: Float64Array,
  shares: Float64Array,
  buf: number[],
  spots: number[],
): void {
  for (let r = 0; r < shares.length; r++) {
    for (let i = 0; i < sorted.length; i++) buf[i] = sorted[i] as number;
    let len = sorted.length;
    insertInto(buf, len++, x);
    for (let i = 0; i < k; i++) {
      const u = r * 2 * k + 2 * i;
      const g = reply(board, buf, len, mix, noise[u] as number, noise[u + 1] as number, spots);
      if (g === null) break;
      insertInto(buf, len++, g);
    }
    const at = lowerBound(buf, x, len);
    shares[r] = shareBetween(
      x,
      at > 0 ? (buf[at - 1] as number) : undefined,
      at + 1 < len ? (buf[at + 1] as number) : undefined,
      board,
    );
  }
}

function quantile(sortedValues: Float64Array, q: number): number {
  if (sortedValues.length === 0) return 0;
  const i = Math.min(sortedValues.length - 1, Math.floor(q * sortedValues.length));
  return sortedValues[i] as number;
}

export function recommend(
  board: Board,
  after: number,
  mix: Mix = PRIOR_MIX,
  prefer: number | null = null,
  seed = 1,
): Recommendation {
  const sorted = [...board.guesses].sort((a, b) => a - b);
  const k = clampAfter(after);
  const xs = candidates(board, sorted, k === 0 ? FULL_SCAN : ROLLOUT_GRID);
  let curve: CurvePoint[];

  if (k === 0) {
    curve = xs.map((x) => {
      const p = winAt(x, sorted, board);
      return { x, p, low: p, se: 0 };
    });
  } else {
    const rollouts = rolloutCount(xs.length, k);
    const rng = mulberry32(seed);
    const noise = new Float64Array(rollouts * 2 * k);
    for (let i = 0; i < noise.length; i++) noise[i] = rng();
    const shares = new Float64Array(rollouts);
    const buf: number[] = new Array<number>(sorted.length + k + 1).fill(0);
    const spots: number[] = [];
    curve = xs.map((x) => {
      rollout(board, sorted, x, k, mix, noise, shares, buf, spots);
      const n = shares.length;
      let sum = 0;
      for (let i = 0; i < n; i++) sum += shares[i] as number;
      const mean = sum / n;
      let squares = 0;
      for (let i = 0; i < n; i++) squares += ((shares[i] as number) - mean) ** 2;
      const variance = squares / Math.max(1, n - 1);
      shares.sort();
      return {
        x,
        p: mean,
        low: Math.min(mean, quantile(shares, LOW_QUANTILE)),
        se: Math.sqrt(variance / n),
      };
    });
  }

  const best = pickBest(curve, sorted, prefer);
  return { best: best?.x ?? null, bestWin: best?.p ?? 0, bestLow: best?.low ?? 0, curve };
}
