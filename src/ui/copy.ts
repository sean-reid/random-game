import type { Guess } from "../engine/round";
import type { Mix } from "../engine";

export const pct = (v: number) => `${Math.round(v * 100)}%`;

export function labelOf(g: Guess): string {
  return g.name.trim() || String(g.n);
}

export function oddsText(after: number, p: number, low: number): string {
  if (after === 0) return `${pct(p)} chance to win if nobody guesses after you.`;
  const who = after === 1 ? "1 more player" : `${after} more players`;
  return `${pct(p)} expected after ${who}, ${pct(low)} in a bad round.`;
}

export function mixText(mix: Mix, seen: number): string {
  const source =
    seen === 0
      ? "That is a starting guess; it learns from the rounds you reveal."
      : `Learned from ${seen} guess${seen === 1 ? "" : "es"} at your table, blended with a starting guess.`;
  return `Each later player is drawn from a mix: ${pct(mix.middle)} go for the middle of the biggest gap, ${pct(mix.anywhere)} anywhere, ${pct(mix.hugger)} hug a neighbour to take the most. ${source}`;
}

export function resultText(won: readonly Guess[], secret: number): string {
  const [first] = won;
  if (!first) return "Nobody guessed.";
  const gap = Math.abs(first.n - secret);
  if (won.length === 1) {
    return `${labelOf(first)} wins with ${first.n}, ${gap === 0 ? "spot on" : `off by ${gap}`}.`;
  }
  return `${won.map(labelOf).join(" and ")} tie, each off by ${gap}.`;
}
