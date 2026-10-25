import { describe, expect, it } from "vitest";
import {
  PRIOR_MIX,
  recommend,
  rolloutCount,
  type Board,
  type Mix,
  type Range,
} from "../../src/engine";
import { mulberry32 } from "../../src/engine/random";

// A plain rollout written for clarity, not speed: fresh arrays everywhere, so the
// engine's buffer reuse has something independent to match.
function has(sorted: number[], n: number): boolean {
  return sorted.includes(n);
}

function free(range: Range, sorted: number[], n: number): boolean {
  return n >= range.lo && n <= range.hi && !has(sorted, n);
}

function share(x: number, others: number[], range: Range): number {
  const left = Math.max(...others.filter((g) => g < x));
  const right = Math.min(...others.filter((g) => g > x));
  let start = range.lo;
  let end = range.hi;
  let ties = 0;
  if (Number.isFinite(left)) {
    const s = left + x;
    if (s % 2 === 0) {
      ties++;
      start = s / 2 + 1;
    } else start = (s + 1) / 2;
  }
  if (Number.isFinite(right)) {
    const s = right + x;
    if (s % 2 === 0) {
      ties++;
      end = s / 2 - 1;
    } else end = (s - 1) / 2;
  }
  return (Math.max(0, end - start + 1) + ties / 2) / (range.hi - range.lo + 1);
}

function hug(range: Range, sorted: number[]): number[] {
  const tries = new Set<number>([range.lo, range.hi]);
  for (const g of sorted) tries.add(g - 1).add(g + 1);
  const scored = [...tries]
    .filter((n) => free(range, sorted, n))
    .sort((a, b) => a - b)
    .map((n) => ({ n, p: share(n, sorted, range) }));
  const top = Math.max(...scored.map((s) => s.p));
  return scored.filter((s) => Math.abs(s.p - top) <= 1e-12).map((s) => s.n);
}

function middle(range: Range, sorted: number[]): number[] {
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
    for (const n of [Math.floor(g.mid), Math.ceil(g.mid)]) if (free(range, sorted, n)) out.add(n);
  }
  return [...out].sort((a, b) => a - b);
}

function nthFree(range: Range, sorted: number[], index: number): number {
  const open: number[] = [];
  for (let n = range.lo; n <= range.hi; n++) if (!has(sorted, n)) open.push(n);
  return open[index] as number;
}

function reply(range: Range, state: number[], mix: Mix, uType: number, uSpot: number) {
  const open = range.hi - range.lo + 1 - state.length;
  if (open <= 0) return null;
  let spots: number[];
  if (uType < mix.middle) spots = middle(range, state);
  else if (uType < mix.middle + mix.anywhere)
    return nthFree(range, state, Math.floor(uSpot * open));
  else spots = hug(range, state);
  if (spots.length === 0) return nthFree(range, state, Math.floor(uSpot * open));
  return spots[Math.floor(uSpot * spots.length)] as number;
}

function referenceCurve(board: Board, k: number, mix: Mix, xs: number[], seed: number) {
  const rollouts = rolloutCount(xs.length, k);
  const rng = mulberry32(seed);
  const noise: number[][] = [];
  for (let r = 0; r < rollouts; r++) noise.push(Array.from({ length: 2 * k }, () => rng()));
  return xs.map((x) => {
    const shares = noise.map((row) => {
      let state = [...board.guesses, x].sort((a, b) => a - b);
      for (let i = 0; i < k; i++) {
        const g = reply(board, state, mix, row[2 * i] as number, row[2 * i + 1] as number);
        if (g === null) break;
        state = [...state, g].sort((a, b) => a - b);
      }
      return share(
        x,
        state.filter((g) => g !== x),
        board,
      );
    });
    const n = shares.length;
    const mean = shares.reduce((a, b) => a + b, 0) / n;
    const variance = shares.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1);
    const sorted = [...shares].sort((a, b) => a - b);
    const low = Math.min(mean, sorted[Math.min(n - 1, Math.floor(0.1 * n))] as number);
    return { x, p: mean, low, se: Math.sqrt(variance / n) };
  });
}

const boards: [Board, number][] = [
  [{ lo: 1, hi: 100, guesses: [30, 80] }, 1],
  [{ lo: 1, hi: 100, guesses: [50] }, 4],
  [{ lo: 1, hi: 100, guesses: [1, 2, 3, 50, 98, 99, 100] }, 6],
  [{ lo: -50, hi: 49, guesses: [0, -1, 7] }, 3],
  [{ lo: 1, hi: 100, guesses: [30, 70] }, 12],
  [{ lo: 1, hi: 5, guesses: [2, 4] }, 12],
  [{ lo: 1, hi: 1000, guesses: [100, 101, 500, 900] }, 12],
];
const mixes: Mix[] = [
  PRIOR_MIX,
  { middle: 1, anywhere: 0, hugger: 0 },
  { middle: 0, anywhere: 1, hugger: 0 },
  { middle: 0, anywhere: 0, hugger: 1 },
];

describe("recommend against a plain reference rollout", () => {
  for (const [board, k] of boards) {
    for (const mix of mixes) {
      it(`${board.lo} to ${board.hi} with ${board.guesses.length} guesses, ${k} after, ${JSON.stringify(mix)}`, () => {
        const r = recommend(board, k, mix, null, 7);
        const ref = referenceCurve(
          board,
          k,
          mix,
          r.curve.map((c) => c.x),
          7,
        );
        expect(r.curve.length).toBe(ref.length);
        for (let i = 0; i < ref.length; i++) {
          const a = r.curve[i] as (typeof ref)[number];
          const b = ref[i] as (typeof ref)[number];
          expect(a.x).toBe(b.x);
          expect(Math.abs(a.p - b.p)).toBeLessThan(1e-12);
          expect(Math.abs(a.low - b.low)).toBeLessThan(1e-12);
          expect(Math.abs(a.se - b.se)).toBeLessThan(1e-12);
        }
      });
    }
  }
});
