export interface Guess {
  n: number;
  name: string;
}

export function winners(guesses: readonly Guess[], secret: number): Guess[] {
  let best = Infinity;
  let out: Guess[] = [];
  for (const g of guesses) {
    const d = Math.abs(g.n - secret);
    if (d < best) {
      best = d;
      out = [g];
    } else if (d === best) {
      out.push(g);
    }
  }
  return out;
}

export function labelOf(g: Guess): string {
  return g.name.trim() || String(g.n);
}
