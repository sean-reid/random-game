import { freeCount, hugSpots, middleSpots, nthFree, PRIOR_MIX, type Mix } from "./opponents";
import { mulberry32 } from "./random";
import type { Board, CurvePoint, Range, Recommendation } from "./types";
import { insertSorted, lowerBound, winAt } from "./win";

export const MAX_AFTER = 12;
const FULL_SCAN = 400;
const ROLLOUT_BUDGET = 60_000;
const MIN_ROLLOUTS = 40;
const MAX_ROLLOUTS = 300;
const LOW_QUANTILE = 0.1;

function candidates(range: Range, taken: readonly number[]): number[] {
  const { lo, hi } = range;
  const set = new Set<number>();
  const size = hi - lo + 1;
  if (size <= FULL_SCAN) {
    for (let n = lo; n <= hi; n++) set.add(n);
  } else {
    const step = (size - 1) / (FULL_SCAN - 1);
    for (let i = 0; i < FULL_SCAN; i++) set.add(lo + Math.round(i * step));
    const walls = [lo - 1, ...taken, hi + 1];
    for (let i = 0; i + 1 < walls.length; i++) {
      set.add(Math.round(((walls[i] as number) + (walls[i + 1] as number)) / 2));
    }
    for (const g of taken) for (const d of [-2, -1, 1, 2]) set.add(g + d);
  }
  const takenSet = new Set(taken);
  return [...set].filter((n) => n >= lo && n <= hi && !takenSet.has(n)).sort((a, b) => a - b);
}

function nearestGap(x: number, sorted: readonly number[]): number {
  const i = lowerBound(sorted, x);
  const left = i > 0 ? x - (sorted[i - 1] as number) : Infinity;
  const right = i < sorted.length ? (sorted[i] as number) - x : Infinity;
  return Math.min(left, right);
}

function pickBest(curve: readonly CurvePoint[], sorted: readonly number[]): CurvePoint | null {
  let best: CurvePoint | null = null;
  for (const pt of curve) {
    if (best === null || pt.p > best.p + 1e-9) best = pt;
    else if (Math.abs(pt.p - best.p) <= 1e-9) {
      if (pt.low > best.low + 1e-9) best = pt;
      else if (
        Math.abs(pt.low - best.low) <= 1e-9 &&
        nearestGap(pt.x, sorted) > nearestGap(best.x, sorted)
      )
        best = pt;
    }
  }
  return best;
}

// One later player's guess: a type drawn from the mix, then that type's rule.
function reply(
  range: Range,
  state: readonly number[],
  mix: Mix,
  uType: number,
  uSpot: number,
): number | null {
  if (freeCount(range, state) <= 0) return null;
  let spots: number[];
  if (uType < mix.middle) spots = middleSpots(range, state);
  else if (uType < mix.middle + mix.anywhere) {
    return nthFree(range, state, Math.floor(uSpot * freeCount(range, state)));
  } else spots = hugSpots(range, state);
  if (spots.length === 0) return nthFree(range, state, Math.floor(uSpot * freeCount(range, state)));
  return spots[Math.floor(uSpot * spots.length)] as number;
}

function quantile(sortedValues: number[], q: number): number {
  if (sortedValues.length === 0) return 0;
  const i = Math.min(sortedValues.length - 1, Math.floor(q * sortedValues.length));
  return sortedValues[i] as number;
}

export function recommend(
  board: Board,
  after: number,
  mix: Mix = PRIOR_MIX,
  seed = 1,
): Recommendation {
  const sorted = [...board.guesses].sort((a, b) => a - b);
  const k = Math.max(0, Math.min(MAX_AFTER, Math.floor(after)));
  const xs = candidates(board, sorted);
  let curve: CurvePoint[];

  if (k === 0) {
    curve = xs.map((x) => {
      const p = winAt(x, sorted, board);
      return { x, p, low: p };
    });
  } else {
    const rollouts = Math.max(
      MIN_ROLLOUTS,
      Math.min(MAX_ROLLOUTS, Math.round(ROLLOUT_BUDGET / Math.max(1, xs.length * k))),
    );
    const rng = mulberry32(seed);
    const noise: number[][] = [];
    for (let r = 0; r < rollouts; r++) {
      const row: number[] = [];
      for (let i = 0; i < 2 * k; i++) row.push(rng());
      noise.push(row);
    }
    curve = xs.map((x) => {
      const shares: number[] = [];
      for (const row of noise) {
        const state = [...sorted];
        insertSorted(state, x);
        for (let i = 0; i < k; i++) {
          const g = reply(board, state, mix, row[2 * i] as number, row[2 * i + 1] as number);
          if (g === null) break;
          insertSorted(state, g);
        }
        shares.push(
          winAt(
            x,
            state.filter((g) => g !== x),
            board,
          ),
        );
      }
      const mean = shares.reduce((a, b) => a + b, 0) / shares.length;
      shares.sort((a, b) => a - b);
      return { x, p: mean, low: Math.min(mean, quantile(shares, LOW_QUANTILE)) };
    });
  }

  const best = pickBest(curve, sorted);
  return { best: best?.x ?? null, bestWin: best?.p ?? 0, bestLow: best?.low ?? 0, curve };
}
