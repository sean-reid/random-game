import { describe, expect, it } from "vitest";
import {
  loadRounds,
  loadTally,
  observationsOf,
  recordRound,
  saveRounds,
  saveTally,
} from "../../../src/state/storage";

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

  it("treats reserved property names as ordinary players", () => {
    const t = recordRound({}, ["__proto__", "constructor", "Ana"], ["Ana"]);
    expect(Object.keys(t).sort()).toEqual(["Ana", "__proto__", "constructor"]);
    expect(t["constructor"]).toEqual({ wins: 0, rounds: 1 });
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

describe("round log", () => {
  it("turns each of their guesses into an observation of the board they faced", () => {
    const rounds = [{ lo: 1, hi: 100, guesses: [50, 75, 25], theirs: [true, false, true] }];
    expect(observationsOf(rounds)).toEqual([
      { lo: 1, hi: 100, before: [], guess: 50 },
      { lo: 1, hi: 100, before: [50, 75], guess: 25 },
    ]);
  });

  it("keeps the latest 200 rounds", () => {
    const s = fakeStorage();
    const many = Array.from({ length: 205 }, (_, i) => ({
      lo: 1,
      hi: 10,
      guesses: [i],
      theirs: [true],
    }));
    saveRounds(s, many);
    const back = loadRounds(s);
    expect(back).toHaveLength(200);
    expect(back[0]?.guesses).toEqual([5]);
  });

  it("round-trips through storage and drops malformed rounds", () => {
    const s = fakeStorage();
    const good = { lo: 1, hi: 10, guesses: [3, 7], theirs: [true, true] };
    saveRounds(s, [good]);
    expect(loadRounds(s)).toEqual([good]);
    expect(
      loadRounds(
        fakeStorage({ "random-game:rounds": '[{"lo":1,"hi":10,"guesses":[3],"theirs":[1]}]' }),
      ),
    ).toEqual([]);
    expect(
      loadRounds(
        fakeStorage({ "random-game:rounds": '[{"lo":1,"hi":10,"guesses":[3],"theirs":[]}, 5]' }),
      ),
    ).toEqual([]);
    saveRounds(s, []);
    expect(s.store.size).toBe(0);
  });
});
