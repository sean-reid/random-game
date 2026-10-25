import { describe, expect, it } from "vitest";
import { niceStep, ticks } from "../../src/ui/ticks";

describe("ticks", () => {
  it("lands on round numbers", () => {
    expect(ticks(1, 100, 12)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(ticks(1, 100, 4)).toEqual([50, 100]);
  });

  it("picks 1, 2, 5 steps", () => {
    expect(niceStep(99, 12)).toBe(10);
    expect(niceStep(99, 50)).toBe(2);
    expect(niceStep(999, 12)).toBe(100);
    expect(niceStep(9, 12)).toBe(1);
  });
});
