import "./style.css";
import { MAX_AFTER, recommend } from "./engine";

const app = document.getElementById("app") as HTMLElement;

const state = {
  lo: 1,
  hi: 100,
  guesses: [] as number[],
  after: 1,
};

app.innerHTML = `
  <h1>Random Game</h1>
  <p class="soft">Someone picked a number. Closest guess wins. Enter the range and the guesses so far.</p>
  <hr />
  <div class="row">
    <label>From <input id="lo" type="number" inputmode="numeric" value="1" /></label>
    <label>To <input id="hi" type="number" inputmode="numeric" value="100" /></label>
    <label>Players after me <input id="after" type="number" inputmode="numeric" min="0" max="${MAX_AFTER}" value="1" /></label>
  </div>
  <div class="row" style="margin-top:1rem">
    <label>Someone guessed <input id="guess" type="number" inputmode="numeric" /></label>
    <button id="add" type="button">Add</button>
    <button id="undo" type="button" disabled>Undo</button>
  </div>
  <ul class="guesses" id="list"></ul>
  <p class="answer" id="answer"></p>
  <p class="soft" id="odds"></p>
  <footer><a href="https://github.com/sean-reid/random-game">Source</a> · <a href="https://sean-reid.github.io/blog/random-game.html">Why this works</a></footer>
`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const lo = $<HTMLInputElement>("lo");
const hi = $<HTMLInputElement>("hi");
const after = $<HTMLInputElement>("after");
const guess = $<HTMLInputElement>("guess");
const add = $<HTMLButtonElement>("add");
const undo = $<HTMLButtonElement>("undo");
const list = $<HTMLUListElement>("list");
const answer = $<HTMLParagraphElement>("answer");
const odds = $<HTMLParagraphElement>("odds");

function readRange(): boolean {
  const a = Number.parseInt(lo.value, 10);
  const b = Number.parseInt(hi.value, 10);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a >= b) return false;
  state.lo = a;
  state.hi = b;
  state.guesses = state.guesses.filter((g) => g >= a && g <= b);
  return true;
}

function render(): void {
  list.replaceChildren(
    ...state.guesses.map((g) => {
      const li = document.createElement("li");
      li.textContent = String(g);
      return li;
    }),
  );
  undo.disabled = state.guesses.length === 0;
  if (!readRange()) {
    answer.textContent = "";
    odds.textContent = "The range needs a smaller first number and a larger second one.";
    return;
  }
  const r = recommend(state, state.after);
  if (r.best === null) {
    answer.textContent = "";
    odds.textContent = "Every number is taken.";
    return;
  }
  answer.innerHTML = `Guess <em>${r.best}</em>`;
  odds.textContent = `${Math.round(r.bestWin * 100)}% chance to win`;
}

function addGuess(): void {
  const g = Number.parseInt(guess.value, 10);
  if (!Number.isFinite(g) || !readRange() || g < state.lo || g > state.hi) return;
  if (!state.guesses.includes(g)) state.guesses.push(g);
  guess.value = "";
  guess.focus();
  render();
}

add.addEventListener("click", addGuess);
guess.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addGuess();
});
undo.addEventListener("click", () => {
  state.guesses.pop();
  render();
});
for (const el of [lo, hi]) el.addEventListener("input", render);
after.addEventListener("input", () => {
  const k = Number.parseInt(after.value, 10);
  state.after = Number.isFinite(k) ? Math.max(0, Math.min(MAX_AFTER, k)) : 0;
  render();
});

render();
