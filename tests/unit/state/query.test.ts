import { describe, expect, it } from "vitest";
import { cleanName, DEFAULT, fromQuery, parseRange, toQuery } from "../../../src/state/query";

describe("url state", () => {
  it("leaves defaults out of the query", () => {
    expect(toQuery(DEFAULT)).toBe("");
  });

  it("round-trips range, players and named guesses", () => {
    const s = {
      lo: 0,
      hi: 50,
      after: 3,
      guesses: [
        { n: 30, name: "Ana" },
        { n: 8, name: "" },
      ],
    };
    expect(toQuery(s)).toBe("?lo=0&hi=50&k=3&g=30%3AAna%2C8");
    expect(fromQuery(toQuery(s))).toEqual(s);
  });

  it("keeps the mine marker and strips commas from names", () => {
    const s = {
      lo: 1,
      hi: 100,
      after: 1,
      guesses: [
        { n: 25, name: "", mine: true },
        { n: 30, name: "Smith John" },
      ],
    };
    expect(toQuery(s)).toBe("?g=*25%2C30%3ASmith+John");
    expect(fromQuery(toQuery(s))).toEqual(s);
    expect(cleanName(" Smith,  John ")).toBe("Smith John");
    expect(fromQuery("?g=30%3ASmith%2C+John%2C40").guesses).toEqual([
      { n: 30, name: "Smith" },
      { n: 40, name: "" },
    ]);
  });

  it("parses a range only when both ends are safe integers in order", () => {
    expect(parseRange("1", "100")).toEqual({ lo: 1, hi: 100 });
    expect(parseRange("-50", "50")).toEqual({ lo: -50, hi: 50 });
    expect(parseRange("50", "10")).toBeNull();
    expect(parseRange("", "10")).toBeNull();
    expect(parseRange("1", "1e400")).toBeNull();
  });

  it("drops guesses outside the range, duplicates and junk", () => {
    const s = fromQuery("?hi=10&g=3:Ana,30,3,x,7");
    expect(s).toEqual({
      lo: 1,
      hi: 10,
      after: 1,
      guesses: [
        { n: 3, name: "Ana" },
        { n: 7, name: "" },
      ],
    });
  });

  it("repairs an inverted range and clamps players", () => {
    const s = fromQuery("?lo=9&hi=2&k=99");
    expect(s.lo).toBe(9);
    expect(s.hi).toBe(10);
    expect(s.after).toBe(12);
  });
});
