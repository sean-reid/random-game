import { describe, expect, it } from "vitest";
import { labelOf, mixText, oddsText, pct, resultText } from "../../src/ui/copy";

const g = (n: number, name = "") => ({ n, name });

describe("copy", () => {
  it("formats percentages to whole numbers", () => {
    expect(pct(0.2718)).toBe("27%");
    expect(pct(0.995)).toBe("100%");
  });

  it("labels by name when there is one", () => {
    expect(labelOf(g(30, " Ana "))).toBe("Ana");
    expect(labelOf(g(30))).toBe("30");
  });

  it("describes the odds for none, one, and many later players", () => {
    expect(oddsText(0, 0.7, 0.7)).toBe("70% chance to win if nobody guesses after you.");
    expect(oddsText(1, 0.41, 0.33)).toBe("41% expected after 1 more player, 33% in a bad round.");
    expect(oddsText(3, 0.28, 0.14)).toBe("28% expected after 3 more players, 14% in a bad round.");
  });

  it("describes the mix and where it came from", () => {
    const mix = { middle: 0.5, anywhere: 0.35, hugger: 0.15 };
    expect(mixText(mix, 0)).toBe(
      "Later players: 50% go for the middle of the biggest gap, 35% anywhere, 15% hug a neighbour, a starting guess until you reveal rounds.",
    );
    expect(mixText(mix, 1)).toContain("learned from 1 guess here");
    expect(mixText(mix, 12)).toContain("learned from 12 guesses here");
  });

  it("names the winner, a spot-on guess, a tie, and nobody", () => {
    expect(resultText([g(40, "Ben")], 33)).toBe("Ben wins with 40, off by 7.");
    expect(resultText([g(33, "Ana")], 33)).toBe("Ana wins with 33, spot on.");
    expect(resultText([g(40, "Ben")], 39)).toBe("Ben wins with 40, off by 1.");
    expect(resultText([g(30, "Ana"), g(50)], 40)).toBe("Ana and 50 tie, each off by 10.");
    expect(resultText([], 7)).toBe("Nobody guessed.");
  });
});
