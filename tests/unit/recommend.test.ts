import { describe, expect, it } from "vitest";
import { recommend } from "../../src/engine";

describe("recommend", () => {
  it("hugs the neighbour on the wide side when nobody guesses after you", () => {
    const r = recommend({ lo: 1, hi: 100, guesses: [30] }, 0);
    expect(r.best).toBe(31);
    expect(r.bestWin).toBeCloseTo(0.7);
    expect(r.bestLow).toBeCloseTo(0.7);
  });

  it("takes the centre of a flat interior gap", () => {
    const r = recommend({ lo: 1, hi: 100, guesses: [1, 100] }, 0);
    expect(r.best).toBe(50);
  });

  it("backs away from the neighbour when players follow", () => {
    const r = recommend({ lo: 1, hi: 100, guesses: [30] }, 1);
    expect(r.best).toBeGreaterThan(31);
    expect(r.best).toBeLessThan(100);
    expect(r.bestWin).toBeGreaterThan(0.3);
    expect(r.bestLow).toBeLessThanOrEqual(r.bestWin);
  });

  it("does not sit one step from a 50 with a crowd still to guess", () => {
    const r = recommend({ lo: 1, hi: 100, guesses: [50] }, 4);
    expect(r.best).not.toBeNull();
    expect(Math.abs((r.best as number) - 50)).toBeGreaterThan(2);
    for (const pt of r.curve) expect(pt.low).toBeLessThanOrEqual(pt.p + 1e-12);
  });

  it("depends on the mix", () => {
    const board = { lo: 1, hi: 100, guesses: [30] };
    const huggers = recommend(board, 1, { middle: 0, anywhere: 0, hugger: 1 });
    const middles = recommend(board, 1, { middle: 1, anywhere: 0, hugger: 0 });
    expect(huggers.best).not.toBe(middles.best);
  });

  it("keeps a preferred spot while it stays within the sampling noise", () => {
    const board = { lo: 1, hi: 100, guesses: [30, 70] };
    const r = recommend(board, 12);
    const top = r.curve.reduce((a, b) => (b.p > a.p ? b : a));
    const near = r.curve.find((c) => c.x !== top.x && c.p >= top.p - 2 * top.se) ?? top;
    expect(recommend(board, 12, undefined, near.x).best).toBe(near.x);
    const far = r.curve.reduce((a, b) => (b.p < a.p ? b : a));
    expect(recommend(board, 12, undefined, far.x).best).not.toBe(far.x);
  });

  it("is deterministic", () => {
    const board = { lo: 1, hi: 100, guesses: [30, 80] };
    expect(recommend(board, 3)).toEqual(recommend(board, 3));
  });

  it("gives a curve point for every free number on a small range", () => {
    const r = recommend({ lo: 1, hi: 10, guesses: [3, 7] }, 0);
    expect(r.curve.map((c) => c.x)).toEqual([1, 2, 4, 5, 6, 8, 9, 10]);
  });

  it("keeps the hugging spots in the sampled candidates on a wide range", () => {
    const r = recommend({ lo: 1, hi: 100000, guesses: [30000] }, 0);
    expect(r.best).toBe(30001);
    expect(r.bestWin).toBeCloseTo(0.7);
  });

  it("returns nothing when the range is full", () => {
    const r = recommend({ lo: 1, hi: 3, guesses: [1, 2, 3] }, 0);
    expect(r.best).toBeNull();
    expect(r.curve).toHaveLength(0);
  });

  it("stays fast on a large range with many later players", () => {
    const start = performance.now();
    const r = recommend({ lo: 1, hi: 100000, guesses: [500, 25000, 70000] }, 12);
    expect(r.best).not.toBeNull();
    expect(r.curve.length).toBeLessThanOrEqual(200 + 4 + 12);
    expect(performance.now() - start).toBeLessThan(1500);
  });
});
