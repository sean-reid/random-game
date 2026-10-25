import { describe, expect, it } from "vitest";
import { regionOf, winAt, winEach } from "../../src/engine";

const range = { lo: 1, hi: 100 };

describe("winAt", () => {
  it("owns the whole range when alone", () => {
    expect(winAt(50, [], range)).toBeCloseTo(1);
  });

  it("matches the blog example: 65 against 30 covers 48..100", () => {
    expect(regionOf(65, [30], range)).toEqual({ start: 48, end: 100, ties: 0 });
    expect(winAt(65, [30], range)).toBeCloseTo(0.53);
  });

  it("hugging a neighbour in an edge gap takes nearly the whole gap", () => {
    expect(winAt(31, [30], range)).toBeCloseTo(0.7);
    expect(winAt(29, [30], range)).toBeCloseTo(0.29);
  });

  it("interior gaps are worth half their width wherever you stand", () => {
    expect(winAt(40, [30, 80], range)).toBeCloseTo(0.25);
    expect(winAt(55, [30, 80], range)).toBeCloseTo(0.25);
    expect(winAt(70, [30, 80], range)).toBeCloseTo(0.25);
  });

  it("splits exact ties", () => {
    expect(regionOf(32, [30], range)).toEqual({ start: 32, end: 100, ties: 1 });
    expect(winAt(32, [30], range)).toBeCloseTo(0.695);
  });

  it("returns zero for a taken number", () => {
    expect(regionOf(30, [30], range)).toBeNull();
    expect(winAt(30, [30], range)).toBe(0);
  });

  it("everyone's shares sum to one", () => {
    const shares = winEach([12, 30, 50, 51, 80], range);
    let total = 0;
    for (const p of shares.values()) total += p;
    expect(total).toBeCloseTo(1);
  });
});
