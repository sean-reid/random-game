import { describe, expect, it } from "vitest";
import { winners } from "../../src/engine";

const g = (n: number, name = "") => ({ n, name });

describe("winners", () => {
  it("picks the closest guess", () => {
    expect(winners([g(30, "Ana"), g(80, "Ben")], 60)).toEqual([g(80, "Ben")]);
  });

  it("returns every guess at the same distance", () => {
    expect(winners([g(30), g(50)], 40)).toEqual([g(30), g(50)]);
  });

  it("returns nothing with no guesses", () => {
    expect(winners([], 7)).toEqual([]);
  });
});
