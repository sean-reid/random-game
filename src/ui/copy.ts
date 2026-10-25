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
  const habits = `${pct(mix.middle)} go for the middle of the biggest gap, ${pct(mix.anywhere)} anywhere, ${pct(mix.hugger)} hug a neighbour`;
  const source =
    seen === 0
      ? "a starting guess until you reveal rounds"
      : `learned from ${seen} guess${seen === 1 ? "" : "es"} here`;
  return `Later players: ${habits}, ${source}.`;
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
