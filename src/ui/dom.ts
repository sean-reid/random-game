import type { Guess, Range } from "../engine";
import { inRange } from "../state/query";
import type { Tally } from "../state/storage";
import { labelOf, pct } from "./copy";

export function template(maxAfter: number, nameMax: number): string {
  return `
  <h1>Random Game</h1>
  <p class="soft">Someone picked a number. Closest guess wins. Enter the range and the guesses so far, and the line shows where to go.</p>
  <div class="row">
    <label>From <input id="lo" type="number" inputmode="numeric" /></label>
    <label>To <input id="hi" type="number" inputmode="numeric" /></label>
    <div class="field">
      <label for="after">Players after me</label>
      <span class="stepper">
        <button id="fewer" type="button" aria-label="Fewer players after me">−</button>
        <input id="after" type="number" inputmode="numeric" min="0" max="${maxAfter}" />
        <button id="more" type="button" aria-label="More players after me">+</button>
      </span>
    </div>
  </div>
  <div class="line" id="line"></div>
  <p class="answer" id="answer"></p>
  <p class="soft" id="odds" aria-live="polite"></p>
  <hr />
  <div class="row">
    <label>Who <input id="name" type="text" list="names" autocomplete="off" maxlength="${nameMax}" placeholder="optional" /></label>
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
    <p id="mix" class="soft"></p>
    <button id="reset" type="button">Clear scoreboard and what it learned</button>
  </details>
  <footer><a href="https://github.com/sean-reid/random-game">Source</a> · <a href="https://sean-reid.github.io/blog/random-game.html">Why this works</a></footer>
`;
}

export function mount(root: HTMLElement, maxAfter: number, nameMax: number) {
  root.innerHTML = template(maxAfter, nameMax);
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  return {
    lo: $<HTMLInputElement>("lo"),
    hi: $<HTMLInputElement>("hi"),
    after: $<HTMLInputElement>("after"),
    fewer: $<HTMLButtonElement>("fewer"),
    more: $<HTMLButtonElement>("more"),
    name: $<HTMLInputElement>("name"),
    guess: $<HTMLInputElement>("guess"),
    mine: $<HTMLInputElement>("mine"),
    add: $<HTMLButtonElement>("add"),
    undo: $<HTMLButtonElement>("undo"),
    list: $<HTMLUListElement>("list"),
    names: $<HTMLDataListElement>("names"),
    line: $<HTMLDivElement>("line"),
    answer: $<HTMLParagraphElement>("answer"),
    odds: $<HTMLParagraphElement>("odds"),
    secret: $<HTMLInputElement>("secret"),
    reveal: $<HTMLButtonElement>("reveal"),
    next: $<HTMLButtonElement>("next"),
    result: $<HTMLParagraphElement>("result"),
    note: $<HTMLParagraphElement>("note"),
    tally: $<HTMLTableElement>("tally"),
    board: $<HTMLDetailsElement>("board"),
    reset: $<HTMLButtonElement>("reset"),
    mix: $<HTMLParagraphElement>("mix"),
  };
}

export type Refs = ReturnType<typeof mount>;

export function renderChips(
  list: HTMLUListElement,
  guesses: readonly Guess[],
  range: Range,
  shares: ReadonlyMap<number, number>,
  locked: boolean,
  onRemove: (g: Guess) => void,
): void {
  list.replaceChildren(
    ...guesses.map((g) => {
      const li = document.createElement("li");
      if (!inRange(range, g.n)) li.classList.add("outside");
      li.append(g.name ? `${g.name} ${g.n}` : String(g.n));
      if (g.mine) li.append(" (me)");
      const share = shares.get(g.n);
      if (share !== undefined) {
        const s = document.createElement("span");
        s.className = "share";
        s.textContent = pct(share);
        li.append(s);
      }
      const x = document.createElement("button");
      x.type = "button";
      x.textContent = "×";
      x.setAttribute("aria-label", `Remove ${labelOf(g)}`);
      x.disabled = locked;
      x.addEventListener("click", () => onRemove(g));
      li.append(x);
      return li;
    }),
  );
}

export function renderNames(datalist: HTMLDataListElement, names: readonly string[]): void {
  datalist.replaceChildren(
    ...names.map((n) => {
      const o = document.createElement("option");
      o.value = n;
      return o;
    }),
  );
}

export function renderTally(
  table: HTMLTableElement,
  details: HTMLDetailsElement,
  tally: Tally,
): void {
  const rows = Object.entries(tally).sort(
    (a, b) => b[1].wins - a[1].wins || a[0].localeCompare(b[0]),
  );
  details.hidden = rows.length === 0;
  table.replaceChildren();
  if (rows.length === 0) return;
  const head = table.createTHead().insertRow();
  for (const h of ["Player", "Wins", "Rounds"]) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = h;
    head.append(th);
  }
  const body = table.createTBody();
  for (const [n, v] of rows) {
    const tr = body.insertRow();
    for (const cell of [n, String(v.wins), String(v.rounds)]) tr.insertCell().textContent = cell;
  }
}
