import "./style.css";
import { MAX_AFTER, recommend } from "./engine";
import { labelOf, winners, type Guess } from "./engine/round";
import {
  fromQuery,
  loadTally,
  recordRound,
  saveTally,
  toQuery,
  type State,
  type Tally,
} from "./state";
import { numberAt, renderLine } from "./ui/line";

const app = document.getElementById("app") as HTMLElement;
const state: State = fromQuery(location.search);
let tally: Tally = loadTally(localStorage);
let revealed: number | null = null;

app.innerHTML = `
  <h1>Random Game</h1>
  <p class="soft">Someone picked a number. Closest guess wins. Enter the range and the guesses so far, and the line shows where to go.</p>
  <div class="row">
    <label>From <input id="lo" type="number" inputmode="numeric" /></label>
    <label>To <input id="hi" type="number" inputmode="numeric" /></label>
    <label>Players after me
      <span class="stepper">
        <button id="fewer" type="button" aria-label="Fewer players after me">−</button>
        <input id="after" type="number" inputmode="numeric" min="0" max="${MAX_AFTER}" />
        <button id="more" type="button" aria-label="More players after me">+</button>
      </span>
    </label>
  </div>
  <div class="line" id="line"></div>
  <p class="answer" id="answer"></p>
  <p class="soft" id="odds"></p>
  <hr />
  <div class="row">
    <label>Who <input id="name" type="text" list="names" autocomplete="off" maxlength="24" placeholder="optional" /></label>
    <label>Guessed <input id="guess" type="number" inputmode="numeric" /></label>
    <button id="add" type="button">Add</button>
    <button id="undo" type="button" disabled>Undo</button>
  </div>
  <datalist id="names"></datalist>
  <ul class="guesses" id="list"></ul>
  <div class="row reveal">
    <label>The number was <input id="secret" type="number" inputmode="numeric" /></label>
    <button id="reveal" type="button">Reveal</button>
    <button id="next" type="button" hidden>New round</button>
  </div>
  <p id="result" class="result" aria-live="polite"></p>
  <details id="board">
    <summary>Scoreboard</summary>
    <table id="tally"></table>
    <button id="reset" type="button">Clear scoreboard</button>
  </details>
  <details>
    <summary>How this works</summary>
    <p>Every guess owns the numbers it is closest to, and the secret number is taken to be anywhere in the range with equal chance. The grey curve is the share of the range you would own from each spot once the players still to come have taken the best spots left, breaking ties against you. The marker is the top of that curve.</p>
    <p>With nobody after you, the best spot hugs the neighbour on the wide side of the biggest gap. With players to come, it backs off to where squeezing you is no longer their best move.</p>
  </details>
  <footer><a href="https://github.com/sean-reid/random-game">Source</a> · <a href="https://sean-reid.github.io/blog/random-game.html">Why this works</a></footer>
`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const lo = $<HTMLInputElement>("lo");
const hi = $<HTMLInputElement>("hi");
const after = $<HTMLInputElement>("after");
const name = $<HTMLInputElement>("name");
const guess = $<HTMLInputElement>("guess");
const add = $<HTMLButtonElement>("add");
const undo = $<HTMLButtonElement>("undo");
const list = $<HTMLUListElement>("list");
const names = $<HTMLDataListElement>("names");
const line = $<HTMLDivElement>("line");
const answer = $<HTMLParagraphElement>("answer");
const odds = $<HTMLParagraphElement>("odds");
const secret = $<HTMLInputElement>("secret");
const reveal = $<HTMLButtonElement>("reveal");
const next = $<HTMLButtonElement>("next");
const result = $<HTMLParagraphElement>("result");
const tallyTable = $<HTMLTableElement>("tally");
const board = $<HTMLDetailsElement>("board");

lo.value = String(state.lo);
hi.value = String(state.hi);
after.value = String(state.after);

function readRange(): boolean {
  const a = Number.parseInt(lo.value, 10);
  const b = Number.parseInt(hi.value, 10);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a >= b) return false;
  state.lo = a;
  state.hi = b;
  state.guesses = state.guesses.filter((g) => g.n >= a && g.n <= b);
  return true;
}

function syncUrl(): void {
  history.replaceState(null, "", `${location.pathname}${toQuery(state)}`);
}

function knownNames(): string[] {
  return [...new Set([...Object.keys(tally), ...state.guesses.map((g) => g.name)])].filter(Boolean);
}

function renderList(): void {
  list.replaceChildren(
    ...state.guesses.map((g) => {
      const li = document.createElement("li");
      li.append(g.name ? `${g.name} ${g.n}` : String(g.n));
      const x = document.createElement("button");
      x.type = "button";
      x.textContent = "×";
      x.setAttribute("aria-label", `Remove ${labelOf(g)}`);
      x.addEventListener("click", () => {
        state.guesses = state.guesses.filter((v) => v !== g);
        render();
      });
      li.append(x);
      return li;
    }),
  );
  undo.disabled = state.guesses.length === 0;
  names.replaceChildren(
    ...knownNames().map((n) => {
      const o = document.createElement("option");
      o.value = n;
      return o;
    }),
  );
}

function renderTally(): void {
  const rows = Object.entries(tally).sort(
    (a, b) => b[1].wins - a[1].wins || a[0].localeCompare(b[0]),
  );
  board.hidden = rows.length === 0;
  tallyTable.replaceChildren();
  if (rows.length === 0) return;
  const head = tallyTable.createTHead().insertRow();
  for (const h of ["Player", "Wins", "Rounds"]) {
    const th = document.createElement("th");
    th.textContent = h;
    head.append(th);
  }
  const body = tallyTable.createTBody();
  for (const [n, v] of rows) {
    const tr = body.insertRow();
    for (const cell of [n, String(v.wins), String(v.rounds)]) tr.insertCell().textContent = cell;
  }
}

function playersText(): string {
  if (state.after === 0) return "if nobody guesses after you";
  if (state.after === 1) return "after 1 more player takes the best spot";
  return `after ${state.after} more players take the best spots`;
}

function render(): void {
  renderList();
  renderTally();
  syncUrl();
  if (!readRange()) {
    line.innerHTML = "";
    answer.textContent = "";
    odds.textContent = "The range needs a smaller first number and a larger second one.";
    return;
  }
  const numbers = state.guesses.map((g) => g.n);
  const r = recommend({ ...state, guesses: numbers }, state.after);
  const labels = new Map(state.guesses.filter((g) => g.name).map((g) => [g.n, g.name]));
  line.innerHTML = renderLine(
    { ...state, guesses: numbers },
    r,
    line.clientWidth,
    labels,
    revealed,
  );
  answer.hidden = revealed !== null;
  odds.hidden = revealed !== null;
  if (r.best === null) {
    answer.textContent = "";
    odds.textContent = "Every number is taken.";
    return;
  }
  answer.innerHTML = `Guess <em>${r.best}</em>`;
  odds.textContent = `${Math.round(r.bestWin * 100)}% chance to win ${playersText()}.`;
  guess.placeholder = String(r.best);
}

function addGuess(): void {
  const n = Number.parseInt(guess.value, 10);
  if (!Number.isFinite(n) || !readRange() || n < state.lo || n > state.hi) return;
  if (!state.guesses.some((g) => g.n === n)) state.guesses.push({ n, name: name.value.trim() });
  guess.value = "";
  name.value = "";
  name.focus();
  render();
}

function setAfter(k: number): void {
  state.after = Math.max(0, Math.min(MAX_AFTER, k));
  after.value = String(state.after);
  render();
}

function describe(won: Guess[], n: number): string {
  if (won.length === 0) return "Nobody guessed.";
  const first = won[0] as Guess;
  const gap = Math.abs(first.n - n);
  const by = gap === 0 ? "exactly" : gap === 1 ? "by 1" : `by ${gap}`;
  if (won.length === 1)
    return `${labelOf(first)} wins with ${first.n}, ${by === "exactly" ? "spot on" : `off ${by}`}.`;
  return `${won.map(labelOf).join(" and ")} tie, each off by ${gap}.`;
}

reveal.addEventListener("click", () => {
  const n = Number.parseInt(secret.value, 10);
  if (!Number.isFinite(n) || !readRange() || n < state.lo || n > state.hi || revealed !== null)
    return;
  revealed = n;
  const won = winners(state.guesses, n);
  result.textContent = describe(won, n);
  const named = state.guesses.map((g) => g.name).filter(Boolean);
  if (named.length) {
    tally = recordRound(tally, named, won.map((g) => g.name).filter(Boolean));
    saveTally(localStorage, tally);
  }
  reveal.hidden = true;
  next.hidden = false;
  render();
});

next.addEventListener("click", () => {
  state.guesses = [];
  revealed = null;
  secret.value = "";
  result.textContent = "";
  reveal.hidden = false;
  next.hidden = true;
  render();
  name.focus();
});

$<HTMLButtonElement>("reset").addEventListener("click", () => {
  tally = {};
  saveTally(localStorage, tally);
  render();
});

add.addEventListener("click", addGuess);
for (const el of [guess, name]) {
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addGuess();
  });
}
secret.addEventListener("keydown", (e) => {
  if (e.key === "Enter") reveal.click();
});
undo.addEventListener("click", () => {
  state.guesses.pop();
  render();
});
for (const el of [lo, hi]) el.addEventListener("input", render);
after.addEventListener("input", () => {
  const k = Number.parseInt(after.value, 10);
  setAfter(Number.isFinite(k) ? k : 0);
});
$<HTMLButtonElement>("fewer").addEventListener("click", () => setAfter(state.after - 1));
$<HTMLButtonElement>("more").addEventListener("click", () => setAfter(state.after + 1));
line.addEventListener("pointerdown", (e) => {
  if (!readRange()) return;
  const rect = line.getBoundingClientRect();
  guess.value = String(numberAt(state, rect.width, e.clientX - rect.left));
  guess.focus();
});
new ResizeObserver(render).observe(line);

render();
