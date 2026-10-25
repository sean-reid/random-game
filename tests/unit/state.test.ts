import { describe, expect, it } from "vitest";
import { DEFAULT, fromQuery, loadTally, recordRound, saveTally, toQuery } from "../../src/state";

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

function fakeStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    store,
  };
}

describe("tally", () => {
  it("records wins and rounds per name", () => {
    const t = recordRound({}, ["Ana", "Ben", "Ana"], ["Ana"]);
    expect(t).toEqual({ Ana: { wins: 1, rounds: 1 }, Ben: { wins: 0, rounds: 1 } });
    expect(recordRound(t, ["Ben"], ["Ben"])).toEqual({
      Ana: { wins: 1, rounds: 1 },
      Ben: { wins: 1, rounds: 2 },
    });
  });

  it("survives a trip through storage and ignores garbage", () => {
    const s = fakeStorage();
    saveTally(s, { Ana: { wins: 2, rounds: 3 } });
    expect(loadTally(s)).toEqual({ Ana: { wins: 2, rounds: 3 } });
    saveTally(s, {});
    expect(s.store.size).toBe(0);
    expect(loadTally(fakeStorage({ "random-game:tally": "[1,2" }))).toEqual({});
    expect(
      loadTally(fakeStorage({ "random-game:tally": '{"x":{"wins":"a","rounds":1}}' })),
    ).toEqual({});
  });
});
