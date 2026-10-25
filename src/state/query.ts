import { clampAfter, type Board, type Guess, type Range } from "../engine";

export interface State extends Range {
  after: number;
  guesses: Guess[];
}

export const NAME_MAX = 24;
export const DEFAULT: State = { lo: 1, hi: 100, after: 1, guesses: [] };

// Commas separate guesses in the URL, so a name cannot carry one.
export function cleanName(name: string): string {
  return name.replace(/,/g, " ").replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
}

export function parseRange(lo: string, hi: string): Range | null {
  const a = Number.parseInt(lo, 10);
  const b = Number.parseInt(hi, 10);
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || a >= b) return null;
  return { lo: a, hi: b };
}

export function inRange(range: Range, n: number): boolean {
  return n >= range.lo && n <= range.hi;
}

export function boardOf(s: State): Board {
  return { lo: s.lo, hi: s.hi, guesses: s.guesses.filter((g) => inRange(s, g.n)).map((g) => g.n) };
}

export function toQuery(s: State): string {
  const q = new URLSearchParams();
  if (s.lo !== DEFAULT.lo) q.set("lo", String(s.lo));
  if (s.hi !== DEFAULT.hi) q.set("hi", String(s.hi));
  if (s.after !== DEFAULT.after) q.set("k", String(s.after));
  if (s.guesses.length) {
    q.set(
      "g",
      s.guesses.map((g) => `${g.mine ? "*" : ""}${g.n}${g.name ? `:${g.name}` : ""}`).join(","),
    );
  }
  const out = q.toString();
  return out ? `?${out}` : "";
}

export function fromQuery(query: string): State {
  const q = new URLSearchParams(query);
  const int = (key: string, fallback: number) => {
    const v = Number.parseInt(q.get(key) ?? "", 10);
    return Number.isSafeInteger(v) ? v : fallback;
  };
  const lo = int("lo", DEFAULT.lo);
  const hi = int("hi", DEFAULT.hi);
  const state: State = {
    lo,
    hi: hi > lo ? hi : lo + 1,
    after: clampAfter(int("k", DEFAULT.after)),
    guesses: [],
  };
  const seen = new Set<number>();
  for (const raw of (q.get("g") ?? "").split(",")) {
    if (!raw) continue;
    const mine = raw.startsWith("*");
    const part = mine ? raw.slice(1) : raw;
    const i = part.indexOf(":");
    const n = Number.parseInt(i < 0 ? part : part.slice(0, i), 10);
    const name = i < 0 ? "" : cleanName(part.slice(i + 1));
    if (!Number.isSafeInteger(n) || !inRange(state, n) || seen.has(n)) continue;
    seen.add(n);
    state.guesses.push(mine ? { n, name, mine } : { n, name });
  }
  return state;
}
