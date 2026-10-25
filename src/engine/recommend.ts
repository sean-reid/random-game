import type { Board, CurvePoint, Range, Recommendation } from "./types";
import { insertSorted, lowerBound, winAt } from "./win";

export const MAX_AFTER = 12;
const FULL_SCAN = 400;

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
    if (best === null || pt.p > best.p + 1e-12) best = pt;
    else if (
      Math.abs(pt.p - best.p) <= 1e-12 &&
      nearestGap(pt.x, sorted) > nearestGap(best.x, sorted)
    )
      best = pt;
  }
  return best;
}

function bestReplies(range: Range, sorted: readonly number[]): number[] {
  const curve = candidates(range, sorted).map((x) => ({ x, p: winAt(x, sorted, range) }));
  const top = Math.max(...curve.map((c) => c.p));
  return curve.filter((c) => c.p >= top - 1e-12).map((c) => c.x);
}

// Later players take the best spot left; among equally good spots, the one that hurts me most.
function afterLaterPlayers(
  x: number,
  range: Range,
  sorted: readonly number[],
  after: number,
): number {
  const state = [...sorted];
  insertSorted(state, x);
  for (let i = 0; i < after; i++) {
    const replies = bestReplies(range, state);
    if (replies.length === 0) break;
    let reply = replies[0] as number;
    let left = Infinity;
    for (const r of replies) {
      const others = state.filter((g) => g !== x);
      insertSorted(others, r);
      const p = winAt(x, others, range);
      if (p < left) {
        left = p;
        reply = r;
      }
    }
    insertSorted(state, reply);
  }
  return winAt(
    x,
    state.filter((g) => g !== x),
    range,
  );
}

export function recommend(board: Board, after: number): Recommendation {
  const sorted = [...board.guesses].sort((a, b) => a - b);
  const k = Math.max(0, Math.min(MAX_AFTER, Math.floor(after)));
  const curve = candidates(board, sorted).map((x) => ({
    x,
    p: k === 0 ? winAt(x, sorted, board) : afterLaterPlayers(x, board, sorted, k),
  }));
  const best = pickBest(curve, sorted);
  return { best: best?.x ?? null, bestWin: best?.p ?? 0, curve };
}
