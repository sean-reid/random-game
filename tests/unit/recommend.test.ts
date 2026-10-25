import { describe, expect, it } from "vitest";
import { recommend } from "../../src/engine";

describe("recommend", () => {
  it("hugs the neighbour on the wide side when nobody guesses after you", () => {
    const r = recommend({ lo: 1, hi: 100, guesses: [30] }, 0);
    expect(r.best).toBe(31);
    expect(r.bestWin).toBeCloseTo(0.7);
  });

  it("takes the centre of a flat interior gap", () => {
    const r = recommend({ lo: 1, hi: 100, guesses: [1, 100] }, 0);
    expect(r.best).toBe(50);
  });

  it("hedges against one more player", () => {
    const r = recommend({ lo: 1, hi: 100, guesses: [30] }, 1);
    expect(r.best).toBe(72);
    expect(r.bestWin).toBeCloseTo(0.495);
  });

  it("assumes a later player breaks ties against you", () => {
    const r = recommend({ lo: 1, hi: 100, guesses: [30, 80] }, 1);
    expect(r.best).toBe(25);
    expect(r.bestWin).toBeCloseTo(0.27);
  });

  it("gives a curve point for every free number on a small range", () => {
    const r = recommend({ lo: 1, hi: 10, guesses: [3, 7] }, 0);
    expect(r.curve.map((c) => c.x)).toEqual([1, 2, 4, 5, 6, 8, 9, 10]);
  });

  it("returns nothing when the range is full", () => {
    const r = recommend({ lo: 1, hi: 3, guesses: [1, 2, 3] }, 0);
    expect(r.best).toBeNull();
    expect(r.curve).toHaveLength(0);
  });

  it("stays fast on a large range with many later players", () => {
    const start = performance.now();
    const r = recommend({ lo: 1, hi: 100000, guesses: [500, 25000, 70000] }, 6);
    expect(r.best).not.toBeNull();
    expect(performance.now() - start).toBeLessThan(1500);
  });
});
