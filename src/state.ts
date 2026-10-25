import { MAX_AFTER, type Observation } from "./engine";
import type { Guess } from "./engine/round";

export interface State {
  lo: number;
  hi: number;
  after: number;
  guesses: Guess[];
}

export const DEFAULT: State = { lo: 1, hi: 100, after: 1, guesses: [] };

export function toQuery(s: State): string {
  const q = new URLSearchParams();
  if (s.lo !== DEFAULT.lo) q.set("lo", String(s.lo));
  if (s.hi !== DEFAULT.hi) q.set("hi", String(s.hi));
  if (s.after !== DEFAULT.after) q.set("k", String(s.after));
  if (s.guesses.length) {
    q.set("g", s.guesses.map((g) => (g.name ? `${g.n}:${g.name}` : String(g.n))).join(","));
  }
  const out = q.toString();
  return out ? `?${out}` : "";
}

export function fromQuery(query: string): State {
  const q = new URLSearchParams(query);
  const int = (key: string, fallback: number) => {
    const v = Number.parseInt(q.get(key) ?? "", 10);
    return Number.isFinite(v) ? v : fallback;
  };
  const lo = int("lo", DEFAULT.lo);
  const hi = int("hi", DEFAULT.hi);
  const state: State = {
    lo,
    hi: hi > lo ? hi : lo + 1,
    after: Math.max(0, Math.min(MAX_AFTER, int("k", DEFAULT.after))),
    guesses: [],
  };
  const seen = new Set<number>();
  for (const part of (q.get("g") ?? "").split(",")) {
    if (!part) continue;
    const i = part.indexOf(":");
    const n = Number.parseInt(i < 0 ? part : part.slice(0, i), 10);
    const name =
      i < 0
        ? ""
        : part
            .slice(i + 1)
            .trim()
            .slice(0, 24);
    if (!Number.isFinite(n) || n < state.lo || n > state.hi || seen.has(n)) continue;
    seen.add(n);
    state.guesses.push({ n, name });
  }
  return state;
}

export interface RoundLog {
  lo: number;
  hi: number;
  guesses: number[];
  theirs: boolean[];
}

const ROUNDS_KEY = "random-game:rounds";
const MAX_ROUNDS = 200;

export function loadRounds(storage: Pick<Storage, "getItem">): RoundLog[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(ROUNDS_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r: unknown): r is RoundLog =>
        !!r &&
        typeof r === "object" &&
        typeof (r as RoundLog).lo === "number" &&
        typeof (r as RoundLog).hi === "number" &&
        Array.isArray((r as RoundLog).guesses) &&
        Array.isArray((r as RoundLog).theirs) &&
        (r as RoundLog).guesses.every((n) => typeof n === "number") &&
        (r as RoundLog).theirs.length === (r as RoundLog).guesses.length,
    );
  } catch {
    return [];
  }
}

export function saveRounds(
  storage: Pick<Storage, "setItem" | "removeItem">,
  rounds: RoundLog[],
): void {
  if (rounds.length === 0) storage.removeItem(ROUNDS_KEY);
  else storage.setItem(ROUNDS_KEY, JSON.stringify(rounds.slice(-MAX_ROUNDS)));
}

export function observationsOf(rounds: readonly RoundLog[]): Observation[] {
  const out: Observation[] = [];
  for (const r of rounds) {
    for (let i = 0; i < r.guesses.length; i++) {
      if (!r.theirs[i]) continue;
      out.push({
        lo: r.lo,
        hi: r.hi,
        before: r.guesses.slice(0, i),
        guess: r.guesses[i] as number,
      });
    }
  }
  return out;
}

export type Tally = Record<string, { wins: number; rounds: number }>;

const KEY = "random-game:tally";

export function loadTally(storage: Pick<Storage, "getItem">): Tally {
  try {
    const raw = storage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Tally = {};
    for (const [name, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (v && typeof v === "object" && "wins" in v && "rounds" in v) {
        const { wins, rounds } = v as { wins: unknown; rounds: unknown };
        if (typeof wins === "number" && typeof rounds === "number") out[name] = { wins, rounds };
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function saveTally(storage: Pick<Storage, "setItem" | "removeItem">, tally: Tally): void {
  if (Object.keys(tally).length === 0) storage.removeItem(KEY);
  else storage.setItem(KEY, JSON.stringify(tally));
}

export function recordRound(
  tally: Tally,
  players: readonly string[],
  won: readonly string[],
): Tally {
  const out: Tally = { ...tally };
  for (const name of new Set(players)) {
    const prev = out[name] ?? { wins: 0, rounds: 0 };
    out[name] = { wins: prev.wins + (won.includes(name) ? 1 : 0), rounds: prev.rounds + 1 };
  }
  return out;
}
