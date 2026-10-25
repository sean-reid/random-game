import { describe, expect, it } from "vitest";
import { fitMix, hugSpots, middleSpots, PRIOR_MIX, type Observation } from "../../src/engine";

const range = { lo: 1, hi: 100 };

describe("later-player types", () => {
  it("a hugger sits next to the neighbour on the wide side", () => {
    expect(hugSpots(range, [30])).toEqual([31]);
    expect(hugSpots(range, [30, 80])).toEqual([29]);
    expect(hugSpots(range, [50])).toEqual([51]);
  });

  it("a middle player bisects the widest gap", () => {
    expect(middleSpots(range, [30])).toEqual([65]);
    expect(middleSpots(range, [])).toEqual([50, 51]);
    expect(middleSpots(range, [50])).toEqual([25, 26, 75]);
    expect(middleSpots(range, [1, 100])).toEqual([50, 51]);
    expect(middleSpots({ lo: 1, hi: 3 }, [1, 3])).toEqual([2]);
  });
});

describe("fitMix", () => {
  const obs = (before: number[], guess: number): Observation => ({ ...range, before, guess });

  it("returns the prior with nothing observed", () => {
    const m = fitMix([]);
    expect(m.middle).toBeCloseTo(PRIOR_MIX.middle);
    expect(m.anywhere).toBeCloseTo(PRIOR_MIX.anywhere);
    expect(m.hugger).toBeCloseTo(PRIOR_MIX.hugger);
  });

  it("moves toward the middle type when everyone bisects", () => {
    const m = fitMix([
      obs([], 50),
      obs([50], 75),
      obs([50, 75], 25),
      obs([50, 75, 25], 62),
      obs([30], 65),
    ]);
    expect(m.middle).toBeGreaterThan(PRIOR_MIX.middle);
    expect(m.hugger).toBeLessThan(PRIOR_MIX.hugger);
  });

  it("moves toward huggers when everyone hugs", () => {
    const m = fitMix([
      obs([50], 51),
      obs([50, 51], 49),
      obs([30], 31),
      obs([30, 31], 29),
      obs([30, 80], 29),
    ]);
    expect(m.hugger).toBeGreaterThan(PRIOR_MIX.hugger);
  });

  it("moves toward anywhere when guesses fit neither rule", () => {
    const m = fitMix([
      obs([50], 7),
      obs([50, 7], 93),
      obs([30], 13),
      obs([30, 13], 44),
      obs([30, 80], 3),
    ]);
    expect(m.anywhere).toBeGreaterThan(PRIOR_MIX.anywhere);
  });

  it("stays normalised", () => {
    const m = fitMix([obs([50], 51), obs([50], 75), obs([50], 7)]);
    expect(m.middle + m.anywhere + m.hugger).toBeCloseTo(1);
  });
});
