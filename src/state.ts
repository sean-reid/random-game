import { clampAfter, type Board, type Guess, type Observation, type Range } from "./engine";

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

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

// A browser that blocks site data throws on any localStorage access.
export function safeStorage(get: () => Storage): Store {
  try {
    const s = get();
    s.getItem("random-game:probe");
    return {
      getItem: (k) => {
        try {
          return s.getItem(k);
        } catch {
          return null;
        }
      },
      setItem: (k, v) => {
        try {
          s.setItem(k, v);
        } catch {
          /* quota or denied: keep going without persistence */
        }
      },
      removeItem: (k) => {
        try {
          s.removeItem(k);
        } catch {
          /* denied */
        }
      },
    };
  } catch {
    return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  }
}

function readJson(storage: Pick<Storage, "getItem">, key: string): unknown {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : undefined;
  } catch {
    return undefined;
  }
}

function writeJson(
  storage: Pick<Storage, "setItem" | "removeItem">,
  key: string,
  value: unknown,
  empty: boolean,
) {
  if (empty) storage.removeItem(key);
  else storage.setItem(key, JSON.stringify(value));
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

export interface RoundLog {
  lo: number;
  hi: number;
  guesses: number[];
  theirs: boolean[];
}

const ROUNDS_KEY = "random-game:rounds";
const MAX_ROUNDS = 200;

const isRoundLog = (v: unknown): v is RoundLog =>
  isRecord(v) &&
  typeof v.lo === "number" &&
  typeof v.hi === "number" &&
  Array.isArray(v.guesses) &&
  Array.isArray(v.theirs) &&
  v.guesses.every((n) => typeof n === "number") &&
  v.theirs.every((b) => typeof b === "boolean") &&
  v.theirs.length === v.guesses.length;

export function loadRounds(storage: Pick<Storage, "getItem">): RoundLog[] {
  const parsed = readJson(storage, ROUNDS_KEY);
  return Array.isArray(parsed) ? parsed.filter(isRoundLog) : [];
}

export function saveRounds(
  storage: Pick<Storage, "setItem" | "removeItem">,
  rounds: RoundLog[],
): void {
  writeJson(storage, ROUNDS_KEY, rounds.slice(-MAX_ROUNDS), rounds.length === 0);
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

const TALLY_KEY = "random-game:tally";

export function loadTally(storage: Pick<Storage, "getItem">): Tally {
  const parsed = readJson(storage, TALLY_KEY);
  const out: Tally = Object.create(null) as Tally;
  if (!isRecord(parsed)) return out;
  for (const [name, v] of Object.entries(parsed)) {
    if (isRecord(v) && typeof v.wins === "number" && typeof v.rounds === "number") {
      out[name] = { wins: v.wins, rounds: v.rounds };
    }
  }
  return out;
}

export function saveTally(storage: Pick<Storage, "setItem" | "removeItem">, tally: Tally): void {
  writeJson(storage, TALLY_KEY, tally, Object.keys(tally).length === 0);
}

export function recordRound(
  tally: Tally,
  players: readonly string[],
  won: readonly string[],
): Tally {
  const out: Tally = Object.assign(Object.create(null) as Tally, tally);
  for (const name of new Set(players)) {
    const prev = Object.hasOwn(out, name)
      ? (out[name] as { wins: number; rounds: number })
      : { wins: 0, rounds: 0 };
    out[name] = { wins: prev.wins + (won.includes(name) ? 1 : 0), rounds: prev.rounds + 1 };
  }
  return out;
}
