import "./style.css";
import { fitMix, MAX_AFTER, recommend, winners, clampAfter, type Mix } from "./engine";
import {
  boardOf,
  cleanName,
  fromQuery,
  inRange,
  loadRounds,
  loadTally,
  NAME_MAX,
  observationsOf,
  parseRange,
  recordRound,
  safeStorage,
  saveRounds,
  saveTally,
  toQuery,
  type RoundLog,
  type State,
  type Tally,
} from "./state";
import { labelOf, mixText, oddsText, resultText } from "./ui/copy";
import { numberAt, renderLine } from "./ui/line";

const app = document.getElementById("app") as HTMLElement;
const storage = safeStorage(() => localStorage);
const state: State = fromQuery(location.search);
let tally: Tally = loadTally(storage);
let rounds: RoundLog[] = loadRounds(storage);
let mix: Mix = fitMix(observationsOf(rounds));
let revealed: number | null = null;
let current: number | null = null;

app.innerHTML = `
  <h1>Random Game</h1>
  <p class="soft">Someone picked a number. Closest guess wins. Enter the range and the guesses so far, and the line shows where to go.</p>
  <div class="row">
    <label>From <input id="lo" type="number" inputmode="numeric" /></label>
    <label>To <input id="hi" type="number" inputmode="numeric" /></label>
    <div class="field">
      <label for="after">Players after me</label>
      <span class="stepper">
        <button id="fewer" type="button" aria-label="Fewer players after me">−</button>
        <input id="after" type="number" inputmode="numeric" min="0" max="${MAX_AFTER}" />
        <button id="more" type="button" aria-label="More players after me">+</button>
      </span>
    </div>
  </div>
  <div class="line" id="line"></div>
  <p class="answer" id="answer"></p>
  <p class="soft" id="odds" aria-live="polite"></p>
  <hr />
  <div class="row">
    <label>Who <input id="name" type="text" list="names" autocomplete="off" maxlength="${NAME_MAX}" placeholder="optional" /></label>
    <label>Guessed <input id="guess" type="number" inputmode="numeric" /></label>
    <label class="check"><input id="mine" type="checkbox" /> that's me</label>
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
  <p id="note" class="soft note" aria-live="polite"></p>
  <details id="board">
    <summary>Scoreboard</summary>
    <table id="tally"></table>
    <button id="reset" type="button">Clear scoreboard and what it learned</button>
  </details>
  <details>
    <summary>How this works</summary>
    <p>Every guess owns the numbers it is closest to, and the secret number is taken to be anywhere in the range with equal chance. The grey curve is the share of the range you would end up with from each spot once the players still to come have guessed, averaged over up to a few hundred plays of the rest of the round. The darker band underneath is a bad round: one play in ten does worse than that. The marker is the top of the curve.</p>
    <p id="mix"></p>
  </details>
  <footer><a href="https://github.com/sean-reid/random-game">Source</a> · <a href="https://sean-reid.github.io/blog/random-game.html">Why this works</a></footer>
`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const lo = $<HTMLInputElement>("lo");
const hi = $<HTMLInputElement>("hi");
const after = $<HTMLInputElement>("after");
const fewer = $<HTMLButtonElement>("fewer");
const more = $<HTMLButtonElement>("more");
const name = $<HTMLInputElement>("name");
const guess = $<HTMLInputElement>("guess");
const mineBox = $<HTMLInputElement>("mine");
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
const note = $<HTMLParagraphElement>("note");
const tallyTable = $<HTMLTableElement>("tally");
const board = $<HTMLDetailsElement>("board");
const reset = $<HTMLButtonElement>("reset");
const mixPara = $<HTMLParagraphElement>("mix");

lo.value = String(state.lo);
hi.value = String(state.hi);
after.value = String(state.after);

function say(message: string): void {
  note.textContent = message;
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
      if (!inRange(state, g.n)) li.classList.add("outside");
      li.append(g.name ? `${g.name} ${g.n}` : String(g.n));
      if (g.mine) li.append(" (me)");
      const x = document.createElement("button");
      x.type = "button";
      x.textContent = "×";
      x.setAttribute("aria-label", `Remove ${labelOf(g)}`);
      x.disabled = revealed !== null;
      x.addEventListener("click", () => {
        state.guesses = state.guesses.filter((v) => v !== g);
        render();
      });
      li.append(x);
      return li;
    }),
  );
  undo.disabled = state.guesses.length === 0 || revealed !== null;
  add.disabled = revealed !== null;
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
    th.scope = "col";
    th.textContent = h;
    head.append(th);
  }
  const body = tallyTable.createTBody();
  for (const [n, v] of rows) {
    const tr = body.insertRow();
    for (const cell of [n, String(v.wins), String(v.rounds)]) tr.insertCell().textContent = cell;
  }
}

function render(): void {
  const range = parseRange(lo.value, hi.value);
  if (range) {
    state.lo = range.lo;
    state.hi = range.hi;
  }
  renderList();
  renderTally();
  syncUrl();
  mixPara.textContent = mixText(mix, observationsOf(rounds).length);
  fewer.disabled = state.after === 0;
  more.disabled = state.after === MAX_AFTER;
  for (const el of [lo, hi]) el.setAttribute("aria-invalid", range ? "false" : "true");
  if (!range) {
    line.innerHTML = "";
    answer.textContent = "";
    current = null;
    guess.placeholder = "";
    odds.textContent = "The range needs a smaller first number and a larger second one.";
    return;
  }
  const b = boardOf(state);
  const r = recommend(b, state.after, mix);
  current = r.best;
  const labels = new Map(state.guesses.filter((g) => g.name).map((g) => [g.n, g.name]));
  line.innerHTML = renderLine(b, r, line.clientWidth, labels, revealed);
  answer.hidden = revealed !== null;
  odds.hidden = revealed !== null;
  if (r.best === null) {
    answer.textContent = "";
    guess.placeholder = "";
    odds.textContent = "Every number is taken.";
    return;
  }
  answer.innerHTML = `Guess <em>${r.best}</em>`;
  odds.textContent = oddsText(state.after, r.bestWin, r.bestLow);
  guess.placeholder = String(r.best);
}

function pruneOutside(): void {
  state.guesses = state.guesses.filter((g) => inRange(state, g.n));
  render();
}

function addGuess(): void {
  if (revealed !== null) return;
  const n = Number.parseInt(guess.value, 10);
  if (!Number.isSafeInteger(n)) return say("Type a whole number to add.");
  if (!parseRange(lo.value, hi.value)) return say("Fix the range first.");
  if (!inRange(state, n)) return say(`${n} is outside ${state.lo} to ${state.hi}.`);
  if (state.guesses.some((g) => g.n === n)) return say(`${n} is already taken.`);
  const g = { n, name: cleanName(name.value) };
  state.guesses.push(mineBox.checked ? { ...g, mine: true } : g);
  say("");
  guess.value = "";
  name.value = "";
  mineBox.checked = false;
  name.focus();
  render();
}

function setAfter(k: number): void {
  state.after = clampAfter(k);
  after.value = String(state.after);
  render();
}

reveal.addEventListener("click", () => {
  if (revealed !== null) return;
  const n = Number.parseInt(secret.value, 10);
  if (!Number.isSafeInteger(n)) return say("Type the number that was picked.");
  if (!parseRange(lo.value, hi.value)) return say("Fix the range first.");
  if (!inRange(state, n)) return say(`${n} is outside ${state.lo} to ${state.hi}.`);
  say("");
  state.guesses = state.guesses.filter((g) => inRange(state, g.n));
  revealed = n;
  const won = winners(state.guesses, n);
  result.textContent = resultText(won, n);
  const named = state.guesses.map((g) => g.name).filter(Boolean);
  if (named.length) {
    tally = recordRound(tally, named, won.map((g) => g.name).filter(Boolean));
    saveTally(storage, tally);
  }
  if (state.guesses.some((g) => !g.mine)) {
    rounds = [
      ...rounds,
      {
        lo: state.lo,
        hi: state.hi,
        guesses: state.guesses.map((g) => g.n),
        theirs: state.guesses.map((g) => !g.mine),
      },
    ];
    saveRounds(storage, rounds);
    mix = fitMix(observationsOf(rounds));
  }
  reveal.hidden = true;
  next.hidden = false;
  render();
  next.focus();
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

reset.addEventListener("click", () => {
  tally = loadTally({ getItem: () => null });
  saveTally(storage, tally);
  rounds = [];
  saveRounds(storage, rounds);
  mix = fitMix([]);
  render();
  name.focus();
});

add.addEventListener("click", addGuess);
for (const el of [guess, name]) {
  el.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    addGuess();
  });
}
guess.addEventListener("input", () => {
  mineBox.checked = current !== null && Number.parseInt(guess.value, 10) === current;
});
// Focus moves to New round during the handler, so the default Enter action must not reach it.
secret.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  reveal.click();
});
undo.addEventListener("click", () => {
  if (revealed !== null) return;
  state.guesses.pop();
  render();
});
for (const el of [lo, hi]) {
  el.addEventListener("input", render);
  el.addEventListener("change", pruneOutside);
}
after.addEventListener("input", () => {
  if (after.value === "") return;
  setAfter(Number.parseInt(after.value, 10));
});
after.addEventListener("change", () => setAfter(Number.parseInt(after.value, 10)));
fewer.addEventListener("click", () => setAfter(state.after - 1));
more.addEventListener("click", () => setAfter(state.after + 1));
line.addEventListener("pointerdown", (e) => {
  if (revealed !== null || !parseRange(lo.value, hi.value)) return;
  const rect = line.getBoundingClientRect();
  guess.value = String(numberAt(state, rect.width, e.clientX - rect.left));
  guess.dispatchEvent(new Event("input"));
  guess.focus();
});
new ResizeObserver(render).observe(line);

render();
