import { describe, expect, it } from "vitest";
import { niceStep, ticks } from "../../src/ui/ticks";

describe("ticks", () => {
  it("lands on round numbers", () => {
    expect(ticks(1, 100, 12)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(ticks(1, 100, 4)).toEqual([50, 100]);
  });

  it("picks 1, 2, 5 steps and never goes below one", () => {
    expect(niceStep(99, 12)).toBe(10);
    expect(niceStep(99, 50)).toBe(2);
    expect(niceStep(999, 12)).toBe(100);
    expect(niceStep(9, 12)).toBe(1);
    expect(niceStep(2, 12)).toBe(1);
  });

  it("stays on integers for tiny ranges", () => {
    expect(ticks(1, 3, 12)).toEqual([1, 2, 3]);
    expect(ticks(1, 6, 11)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("stays bounded on huge bounds", () => {
    const out = ticks(9007199254740990, 9007199254740991, 10);
    expect(out.length).toBeLessThanOrEqual(12);
    expect(ticks(1e18, 1e18, 10).length).toBeLessThanOrEqual(12);
  });
});
